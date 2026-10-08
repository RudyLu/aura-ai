import { NextResponse } from 'next/server';
import { sessionId } from '@/server/session';
import { deleteSession, loadHealthImport, loadState, mutateState } from '@/server/repo';
import { geminiConfigured, MODEL } from '@/server/gemini';
import { inputSignature, migrateState, modeOf, modeSid, StateSchema, validateRelations } from '@/server/statePolicy';
import type { State } from '@/domain/state';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const visitor = await sessionId(), mode = modeOf(req), sid = modeSid(visitor, req);
  const [raw, linkedHealth] = await Promise.all([loadState(sid), loadHealthImport(sid)]);
  // Preserve an old single-slot demo in its own slot before personal state is used.
  if (mode === 'personal' && raw?.demo) {
    await mutateState(`${visitor}-demo`, old => ({ state: old || migrateState(raw, 'demo'), result: null }));
  }
  if (mode === 'personal' && raw?.demo) await mutateState(`${visitor}-legacy-demo`, old => ({ state: old || raw, result: null }));
  const state = migrateState(mode === 'personal' && raw?.demo ? null : raw, mode);
  return NextResponse.json({ state, linkedHealth, ai: { enabled: geminiConfigured(), model: geminiConfigured() ? MODEL : null } });
}
export async function PUT(req: Request) {
  const visitor = await sessionId(), sid = modeSid(visitor, req), mode = modeOf(req);
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 900_000) return NextResponse.json({ error: 'Too many records to save.' }, { status: 413 });
    const body = JSON.parse(raw), parsed = StateSchema.safeParse(body.state);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid records', issues: parsed.error.issues.slice(0,5) }, { status: 400 });
    const incoming = parsed.data as unknown as State; validateRelations(incoming);
    const before = await loadState(sid);
    if (mode === 'personal' && before?.demo) await mutateState(`${visitor}-legacy-demo`, old => ({ state: old || before, result: null }));
    const result = await mutateState(sid, stored => {
      const old = migrateState(mode === 'personal' && stored?.demo ? null : stored, mode);
      if ((incoming.inputRevision || 0) !== (old.inputRevision || 0)) throw new Error('Records changed in another tab. Refresh before saving.');
      // Plan decisions and feedback use dedicated validated commands. The client
      // cannot rewrite server-owned plans, reviews or durable safety restrictions.
      incoming.plans = old.plans; incoming.feedbacks = old.feedbacks; incoming.decisions = old.decisions;
      incoming.aiReviews = old.aiReviews; incoming.safetyEvents = old.safetyEvents;
      incoming.mode = mode;
      if (mode === 'personal') { incoming.demo = null;
        if (incoming.dataSource === 'sample' && old.dataSource !== 'sample') throw new Error('Use Demo mode for sample history');
        if (incoming.healthImport?.via === 'simulated' && old.healthImport?.via !== 'simulated') throw new Error('Use Demo mode for fictional health records');
      }
      // Corrections to confirmed feeling records also update their linked feedback; safety history is retained.
      for (const c of incoming.checkins) {
        const prior = old.checkins.find(x => x.id === c.id);
        c.feedbackId = prior?.feedbackId; c.cutoff = c.occurredAt; c.timezone = incoming.timezone;
        const f = incoming.feedbacks.find(f => f.id === c.feedbackId);
        if (f) { f.answer = c.status === 'recorded' ? String(c.score) : c.status; f.score = c.score; }
      }
      for (const c of old.checkins.filter(c => c.feedbackId && !incoming.checkins.some(x => x.id === c.id))) {
        const f = incoming.feedbacks.find(f => f.id === c.feedbackId); if (f) { f.answer = null; f.score = null; }
      }
      validateRelations(incoming);
      for (const r of [...incoming.checkins, ...incoming.entries]) {
        const prior = [...old.checkins, ...old.entries].find(x => x.id === r.id);
        if (mode === 'personal' && r.source === 'sample' && !prior) throw new Error('Use Demo mode for sample records');
        r.origin = prior?.origin || (mode === 'demo' ? 'demo-live' : 'personal');
      }
      // Imported/simulated source labels survive migration, but client-created personal records cannot be synthetic.
      incoming.inputRevision = (old.inputRevision || 0) + (inputSignature(incoming) === inputSignature(old) ? 0 : 1);
      return { state: incoming, result: { ok: true, inputRevision: incoming.inputRevision, state: incoming } };
    });
    return NextResponse.json(result);
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Could not save records';
    return NextResponse.json({ error }, { status: /another tab/.test(error) ? 409 : 400 });
  }
}
export async function DELETE(req: Request) {
  await deleteSession(modeSid(await sessionId(), req));
  return NextResponse.json({ ok: true });
}
