import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionId } from '@/server/session';
import { loadState, mutateState } from '@/server/repo';
import { migrateState, modeOf, modeSid, DaySchema } from '@/server/statePolicy';
import { assertSnapshot, reviewPlan } from '@/server/review';
import { allowAiCall } from '@/server/limits';
export const dynamic = 'force-dynamic';
const Body = z.object({ planId: z.string(), planVersion: z.number().int(), inputRevision: z.number().int(), requestId: z.string().min(1).max(100), today: DaySchema });
export async function POST(req: Request) {
  const visitor = await sessionId(), sid = modeSid(visitor, req), mode = modeOf(req);
  try {
    const q = Body.parse(await req.json());
    if (!allowAiCall(visitor)) return NextResponse.json({ status: 'error', error: 'Review limit reached. Try again later.' }, { status: 429 });
    const s = migrateState(await loadState(sid), mode);
    const existing = s.aiReviews?.find(r => r.requestId === q.requestId);
    if (existing) { assertSnapshot(s, q); return NextResponse.json({ status: 'ok', result: existing }); }
    const result = await reviewPlan(s, q);
    await mutateState(sid, raw => {
      const state = migrateState(raw, mode); assertSnapshot(state, q);
      if (!state.aiReviews!.some(r => r.requestId === result.requestId)) state.aiReviews!.push(result);
      // Saving an ordinary result does not advance the input revision.
      return { state, result: null };
    });
    const saved = migrateState(await loadState(sid),mode);
    return NextResponse.json({ status: 'ok', result, inputRevision:saved.inputRevision,plans:saved.plans,safetyEvents:saved.safetyEvents });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Review failed';
    return NextResponse.json({ status: error === 'not-integrated' ? 'not-integrated' : 'error', error }, { status: error === 'not-integrated' ? 200 : /stale/.test(error) ? 409 : 503 });
  }
}
