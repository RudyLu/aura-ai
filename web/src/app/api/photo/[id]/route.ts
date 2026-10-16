import { modeSid } from '@/server/statePolicy';
import { sessionId } from '@/server/session';
import { loadPhoto } from '@/server/repo';

export const dynamic = 'force-dynamic';

// Photos are served only to the session that uploaded them.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^ph_[a-z0-9]+$/.test(id)) return new Response('Not found', { status: 404 });
  const photo = await loadPhoto(modeSid(await sessionId(), req), id);
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(photo.data), { headers: { 'Content-Type': photo.contentType, 'Cache-Control': 'private, max-age=86400' } });
}
