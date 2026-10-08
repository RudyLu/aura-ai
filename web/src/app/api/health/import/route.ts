import { modeSid } from '@/server/statePolicy';
import { NextResponse } from 'next/server';
import { sessionId } from '@/server/session';
import { deleteHealthImport } from '@/server/repo';

export const dynamic = 'force-dynamic';

// "Remove Apple Health data": forget what the iOS app sent for this session.
export async function DELETE(req: Request) {
  await deleteHealthImport(modeSid(await sessionId(), req));
  return NextResponse.json({ ok: true });
}
