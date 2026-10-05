// Anonymous visitor session (PRD F9): an httpOnly cookie names this visitor's own
// record set. Every read and write is scoped to it, so visitors never see or reset
// each other's data.
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

const COOKIE = 'aura_sid';
const SID = /^[0-9a-f-]{36}$/;

export async function sessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && SID.test(existing)) return existing;
  const sid = randomUUID();
  jar.set(COOKIE, sid, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return sid;
}
