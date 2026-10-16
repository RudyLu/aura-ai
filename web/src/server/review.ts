// Transport contract only. Rudy owns review generation, context, reasoning and safety.
import type { State, AIReview } from '@/domain/state';
import { validDay, wallClock } from './statePolicy';
export interface ReviewRequest { planId: string; planVersion: number; inputRevision: number; requestId: string; today: string }
export function assertSnapshot(s: State, q: ReviewRequest) {
  const cutoff = wallClock(s.timezone);
  if (!validDay(q.today) || (cutoff && q.today > cutoff.slice(0,10))) throw new Error('Invalid or future review cutoff');
  const p = s.plans.find(p => p.id === q.planId);
  if (!p || p.version !== q.planVersion || (s.inputRevision || 0) !== q.inputRevision || p.status === 'replaced') throw new Error('This review is stale. Review the latest records again.');
  return p;
}
export async function reviewPlan(s: State, q: ReviewRequest): Promise<AIReview> {
  assertSnapshot(s,q);
  throw new Error('not-integrated');
}
