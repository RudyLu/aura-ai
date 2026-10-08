import { modeSid } from '@/server/statePolicy';
import { NextResponse } from 'next/server';
import { sessionId } from '@/server/session';
import { createLink } from '@/server/repo';
import { LINK_TTL_MS, linkUrls, newToken, publicOrigin } from '@/server/healthLink';

export const dynamic = 'force-dynamic';

// Start linking Apple Health: a one-time token for this session, opened in the iOS app.
export async function POST(req: Request) {
  const sid = modeSid(await sessionId(), req);
  const token = newToken(), expiresAt = Date.now() + LINK_TTL_MS;
  await createLink({ token, sid, expiresAt, status: 'pending' });
  return NextResponse.json({ token, expiresAt, ...linkUrls(publicOrigin(req), token) });
}
