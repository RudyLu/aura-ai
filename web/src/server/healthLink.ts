// Linking Apple Health from the Aura iOS app to a web session (opt-in, any browser).
// The web session asks for a one-time token; the app reads HealthKit, computes daily
// totals on the phone and sends them with the token. Only daily totals leave the phone.
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { HealthImport } from '@/domain/state';

export const LINK_TTL_MS = 10 * 60 * 1000;
export const TOKEN = /^[A-Za-z0-9_-]{22}$/;
export const newToken = () => randomBytes(16).toString('base64url');

export interface HealthLink { token: string; sid: string; expiresAt: number; status: 'pending' | 'done'; completedAt?: string }

// What the token is good for right now: 'pending' accepts one upload, nothing else does.
export function linkState(link: HealthLink | null, now = Date.now()): 'missing' | 'pending' | 'done' | 'expired' {
  if (!link) return 'missing';
  if (link.status === 'done') return 'done';
  return now > link.expiresAt ? 'expired' : 'pending';
}

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MAX_DAYS = 400;
export const SyncSchema = z.object({
  sleep: z.record(DAY, z.number().min(0).max(24)).refine(r => Object.keys(r).length <= MAX_DAYS),
  activity: z.record(DAY, z.number().min(0).max(1440)).refine(r => Object.keys(r).length <= MAX_DAYS),
  cycle: z.array(DAY).max(MAX_DAYS),
  range: z.tuple([DAY, DAY]),
  granted: z.array(z.enum(['sleep', 'activity', 'cycle'])).max(3),
  device: z.string().max(80).optional()
});
export type SyncPayload = z.infer<typeof SyncSchema>;

export function toHealthImport(p: SyncPayload, now = new Date()): HealthImport {
  const round = (r: Record<string, number>, k: number) => Object.fromEntries(Object.entries(r).map(([d, v]) => [d, Math.round(v * k) / k]));
  return {
    sleep: round(p.sleep, 10), activity: round(p.activity, 1), cycle: [...new Set(p.cycle)].sort(),
    range: p.range, via: 'ios-app', granted: p.granted, importedAt: now.toISOString(), records: null,
    ...(p.device ? { fileName: p.device } : {})
  };
}

// Public origin for links shown to people (Cloud Run sits behind a proxy).
export function publicOrigin(req: Request) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const h = req.headers, u = new URL(req.url);
  const host = h.get('x-forwarded-host') || h.get('host') || u.host;
  const proto = h.get('x-forwarded-proto')?.split(',')[0] || u.protocol.replace(':', '');
  return `${proto}://${host}`;
}
export const linkUrls = (origin: string, token: string) => ({
  url: `${origin}/link/${token}`,
  appUrl: `aura://link?t=${token}&h=${encodeURIComponent(origin)}`
});
