import { NextResponse } from 'next/server';
import { completeLink, getLink } from '@/server/repo';
import { linkState, SyncSchema, TOKEN, toHealthImport } from '@/server/healthLink';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 900_000;

// Called by the Aura iOS app (no cookie): `Authorization: Bearer <link token>` and the
// daily totals it computed on the phone. Each token works once, for 10 minutes.
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!TOKEN.test(token)) return NextResponse.json({ error: 'Missing link token' }, { status: 401 });
  const state = linkState(await getLink(token));
  if (state === 'missing') return NextResponse.json({ error: 'Unknown link. Start again from Aura in your browser.' }, { status: 404 });
  if (state !== 'pending') return NextResponse.json({ error: 'This link has expired or was already used. Start again from Aura in your browser.' }, { status: 410 });

  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BYTES) return NextResponse.json({ error: 'Too much data' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });

  const h = toHealthImport(parsed.data);
  if (!(await completeLink(token, h))) return NextResponse.json({ error: 'This link has expired or was already used.' }, { status: 410 });
  return NextResponse.json({ ok: true, nights: Object.keys(h.sleep).length, activeDays: Object.values(h.activity).filter(v => v > 0).length, periodDates: h.cycle.length });
}
