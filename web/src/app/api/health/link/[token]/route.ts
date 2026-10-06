import { NextResponse } from 'next/server';
import { sessionId } from '@/server/session';
import { getLink, loadHealthImport } from '@/server/repo';
import { linkState, TOKEN } from '@/server/healthLink';

export const dynamic = 'force-dynamic';

// The browser polls this while the iOS app is linking. Only the session that created
// the token can see it.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sid = await sessionId();
  const link = TOKEN.test(token) ? await getLink(token) : null;
  if (!link || link.sid !== sid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const status = linkState(link);
  return NextResponse.json(status === 'done' ? { status, import: await loadHealthImport(sid) } : { status });
}
