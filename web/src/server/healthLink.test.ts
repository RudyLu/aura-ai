import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { linkState, linkUrls, LINK_TTL_MS, newToken, SyncSchema, TOKEN, toHealthImport, type HealthLink } from './healthLink';

const payload = {
  sleep: { '2026-10-01': 7.234, '2026-10-02': 5.9 }, activity: { '2026-10-01': 30.4, '2026-10-02': 0 },
  cycle: ['2026-10-02', '2026-10-01', '2026-10-02'], range: ['2026-08-07', '2026-10-06'], granted: ['sleep', 'activity', 'cycle'], device: 'iPhone'
};

describe('link tokens', () => {
  it('are url-safe and match the route pattern', () => {
    const t = newToken();
    expect(TOKEN.test(t)).toBe(true);
    expect(linkUrls('https://aura.example', t)).toEqual({
      url: `https://aura.example/link/${t}`, appUrl: `aura://link?t=${t}&h=https%3A%2F%2Faura.example`
    });
  });
  it('work once and expire', () => {
    const now = 1_000_000;
    const link: HealthLink = { token: 'x', sid: 's', expiresAt: now + LINK_TTL_MS, status: 'pending' };
    expect(linkState(null, now)).toBe('missing');
    expect(linkState(link, now)).toBe('pending');
    expect(linkState(link, now + LINK_TTL_MS + 1)).toBe('expired');
    expect(linkState({ ...link, status: 'done' }, now)).toBe('done');
  });
});

describe('sync payload', () => {
  it('accepts daily totals and normalizes them', () => {
    const h = toHealthImport(SyncSchema.parse(payload), new Date('2026-10-06T00:00:00Z'));
    expect(h).toMatchObject({ sleep: { '2026-10-01': 7.2, '2026-10-02': 5.9 }, activity: { '2026-10-01': 30, '2026-10-02': 0 }, cycle: ['2026-10-01', '2026-10-02'], via: 'ios-app', fileName: 'iPhone', importedAt: '2026-10-06T00:00:00.000Z' });
  });
  it.each([
    ['bad date key', { ...payload, sleep: { 'Oct 1': 7 } }],
    ['impossible sleep', { ...payload, sleep: { '2026-10-01': 30 } }],
    ['negative minutes', { ...payload, activity: { '2026-10-01': -5 } }],
    ['unknown type', { ...payload, granted: ['heartRate'] }],
    ['missing range', { ...payload, range: undefined }]
  ])('rejects %s', (_, body) => {
    expect(SyncSchema.safeParse(body).success).toBe(false);
  });
});

describe('repo (file mode)', () => {
  let dir: string;
  let repo: typeof import('./repo');
  beforeAll(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'aura-'));
    process.env.DATA_DIR = dir;
    repo = await import('./repo');
  });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.DATA_DIR; });

  it('saves the import once, for the session that made the link', async () => {
    const h = toHealthImport(SyncSchema.parse(payload));
    const token = newToken();
    await repo.createLink({ token, sid: 'sid-a', expiresAt: Date.now() + LINK_TTL_MS, status: 'pending' });
    expect(await repo.completeLink(token, h)).toBe(true);
    expect(await repo.completeLink(token, h)).toBe(false); // reused
    expect(linkState(await repo.getLink(token))).toBe('done');
    expect(await repo.loadHealthImport('sid-a')).toEqual(h);
    expect(await repo.loadHealthImport('sid-b')).toBeNull();
  });
  it('refuses an expired link', async () => {
    const token = newToken();
    await repo.createLink({ token, sid: 'sid-c', expiresAt: Date.now() - 1, status: 'pending' });
    expect(await repo.completeLink(token, toHealthImport(SyncSchema.parse(payload)))).toBe(false);
    expect(await repo.loadHealthImport('sid-c')).toBeNull();
  });
  it('reset removes the import and the session’s links', async () => {
    const token = newToken();
    await repo.createLink({ token, sid: 'sid-d', expiresAt: Date.now() + LINK_TTL_MS, status: 'pending' });
    await repo.completeLink(token, toHealthImport(SyncSchema.parse(payload)));
    await repo.deleteSession('sid-d');
    expect(await repo.loadHealthImport('sid-d')).toBeNull();
    expect(await repo.getLink(token)).toBeNull();
  });
});
