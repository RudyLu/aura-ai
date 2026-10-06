import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionId } from '@/server/session';
import { deleteSession, loadHealthImport, loadState, saveState } from '@/server/repo';
import { geminiConfigured, MODEL } from '@/server/gemini';
import type { State } from '@/domain/state';

export const dynamic = 'force-dynamic';

// The client owns its session's State; the server checks its shape and size and keeps it.
const StateSchema = z.object({
  v: z.literal(2),
  onboarded: z.boolean(),
  profile: z.object({}).passthrough(),
  observations: z.array(z.object({ id: z.string(), topicId: z.string() }).passthrough()).max(10),
  checkins: z.array(z.object({ id: z.string(), observationId: z.string(), occurredAt: z.string() }).passthrough()).max(5000),
  entries: z.array(z.object({ id: z.string(), kind: z.enum(['food', 'caffeine']), occurredAt: z.string() }).passthrough()).max(5000),
  plans: z.array(z.object({}).passthrough()).max(500),
  feedbacks: z.array(z.object({}).passthrough()).max(2000),
  decisions: z.array(z.object({}).passthrough()).max(1000),
  messages: z.array(z.object({ role: z.enum(['user', 'guide']), text: z.string().max(4000) }).passthrough()).max(1000),
  dataSource: z.enum(['none', 'sample', 'apple-health']),
  healthTypes: z.object({ sleep: z.boolean(), activity: z.boolean(), cycle: z.boolean() }),
  healthImport: z.object({}).passthrough().nullable()
}).passthrough();
const MAX_BYTES = 900_000; // Firestore documents are capped at 1 MiB

export async function GET() {
  const sid = await sessionId();
  const [state, linkedHealth] = await Promise.all([loadState(sid), loadHealthImport(sid)]);
  return NextResponse.json({ state, linkedHealth, ai: { enabled: geminiConfigured(), model: geminiConfigured() ? MODEL : null } });
}

export async function PUT(req: Request) {
  const sid = await sessionId();
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'Too many records to save in this demo session.' }, { status: 413 });
  const parsed = StateSchema.safeParse(JSON.parse(raw)?.state);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid state', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  await saveState(sid, parsed.data as unknown as State);
  return NextResponse.json({ ok: true });
}

// "Delete all records and restart": removes this session's records and photos only.
export async function DELETE() {
  const sid = await sessionId();
  await deleteSession(sid);
  return NextResponse.json({ ok: true });
}
