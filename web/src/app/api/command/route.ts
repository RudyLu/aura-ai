import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionId } from '@/server/session';
import { mutateState } from '@/server/repo';
import { applySafetyFeedback, hasSafetyHold, migrateState, modeOf, modeSid, DaySchema, WallTimeSchema, wallClock } from '@/server/statePolicy';
import { acceptPlan, dayCheckin, saveCheckin, setPlanStatus, type Feedback } from '@/domain/state';
import { stepDraft } from '@/domain/uiSteps';
import { stepsBlocked } from '@/server/agent';
import { planConfirmation } from '@/domain/chatPresentation';
import { offeredDemoDraft } from '@/domain/demoConversation';
import { buildDemo } from '@/domain/demo';
import { uid } from '@/domain/dates';
import { isTopicId } from '@/domain/topics';
export const dynamic = 'force-dynamic';
const Body = z.object({ action: z.enum(['demo','feedback','accept','decide']), inputRevision: z.number().int().nonnegative(), data: z.record(z.string(), z.unknown()) });
export async function POST(req: Request) {
  const sid = modeSid(await sessionId(), req), mode = modeOf(req);
  try {
    const q = Body.parse(await req.json()), d = q.data;
    const result = await mutateState(sid, raw => {
      let state = migrateState(raw, mode);
      if ((state.inputRevision || 0) !== q.inputRevision) throw new Error('Records changed. Refresh and try again.');
      if (q.action === 'demo') {
        if (mode !== 'demo' || ![1,4,10].includes(Number(d.day))) throw new Error('Invalid demo');
        const instant = new Date(String(d.now)); if (!Number.isFinite(+instant)) throw new Error('Invalid demo date');
        const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: String(d.timezone), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
        // Build synthetic wall-clock dates in the visitor's timezone, not the server's.
        const now = new Date(parts.replace(' ', 'T'));
        state = buildDemo(Number(d.day), now); state.timezone = typeof d.timezone === 'string' ? d.timezone : undefined;
      } else if (q.action === 'feedback') {
        const p = state.plans.find(p => p.id === d.planId && p.version === d.planVersion);
        if (!p || ['replaced'].includes(p.status)) throw new Error('Plan not found or replaced');
        const parsed = z.object({ id: z.string().max(100), date: DaySchema, execution: z.enum(['Done','Partly done','Not done','Not sure']), answer: z.enum(['1','2','3','4','5','unknown','skipped']), change: z.enum(['Not answered','Better','About the same','Worse','Not sure']), barriers: z.array(z.string().max(100)).max(10), note: z.string().max(2000), occurredAt: WallTimeSchema }).parse(d);
        if (parsed.date !== parsed.occurredAt.slice(0,10)) throw new Error('Feedback date mismatch');
        if (wallClock(state.timezone) && parsed.occurredAt.slice(0,16) > wallClock(state.timezone)!) throw new Error('Feedback time is in the future');
        const old = state.feedbacks.find(f => f.id === parsed.id);
        if (old && old.planId !== p.id) throw new Error('Feedback belongs to another plan');
        const fb: Feedback = { ...parsed, planId: p.id, planVersion: p.version, observationId: p.observationId, at: new Date().toISOString(), score: /^[1-5]$/.test(parsed.answer) ? Number(parsed.answer) : null, origin: mode === 'demo' ? 'demo-live' : 'personal' };
        state.feedbacks = state.feedbacks.filter(f => f.id !== fb.id).concat(fb);
        const linked = state.checkins.find(c => c.feedbackId === fb.id);
        const existing = dayCheckin(state, p.observationId, fb.date);
        // Only this topic's confirmed feeling can be reused; no cross-topic score copying.
        if (!existing || linked) saveCheckin(state, { id: linked?.id, observationId: p.observationId, topicId: p.topicId, occurredAt: parsed.occurredAt, source: 'plan feedback', feedbackId: fb.id, status: fb.score === null ? parsed.answer as 'unknown' | 'skipped' : 'recorded', score: fb.score, note: fb.note });
        applySafetyFeedback(state, fb);
        if (hasSafetyHold(state, p.topicId) && p.status === 'active') setPlanStatus(p, 'stopped');
      } else {
        const review = typeof d.aiReviewId === 'string' ? state.aiReviews?.find(r => r.id === d.aiReviewId) : null;
        const p = typeof d.planId === 'string' ? state.plans.find(p => p.id === d.planId) : null;
        if (review && (review.mode !== mode || review.inputRevision !== q.inputRevision || review.planId !== p?.id || review.planVersion !== p?.version || review.requestId !== d.requestId)) throw new Error('Review is stale. Review again before confirming.');
        if (d.aiReviewId && !review) throw new Error('Review not found');
        if (q.action === 'accept') {
          if (!isTopicId(d.topicId)) throw new Error('Unknown topic');
          const o = state.observations.find(o => o.id === d.observationId && o.topicId === d.topicId && o.status === 'active');
          if (!o) throw new Error('Confirm the observation before accepting a plan');
          if (review && (review.recommendation !== 'adjust' || !review.proposal || review.safety.pause)) throw new Error('This review does not approve a replacement action');
          const demoDraft = offeredDemoDraft(state, String(d.stepId));
          if (demoDraft && stepsBlocked(state, o.topicId)) throw new Error('This topic is on safety hold. Observe or stop.');
          const draft = review?.proposal || demoDraft || stepDraft(String(d.stepId), d.topicId);
          if (review && p?.observationId !== o.id) throw new Error('Review belongs to another observation');
          if (!draft || draft.topicId !== o.topicId) throw new Error('Action not approved for this topic');
          if (hasSafetyHold(state, o.topicId) && draft.kind !== 'observe') throw new Error('This topic is on safety hold. Observe or stop.');
          if (typeof d.step === 'string' && d.step !== draft.step) throw new Error('Edited intervention text is not approved. Use the reviewed recording action.');
          const dates = z.object({ start: DaySchema, review: DaySchema }).parse(d);
          if (dates.review < dates.start) throw new Error('Review must follow start');
          const next = acceptPlan(state, { ...draft, lineageId: review && p ? p.lineageId : demoDraft ? state.plans.find(prior => prior.observationId === o.id && ['active', 'observing'].includes(prior.status))?.lineageId : undefined }, { ...dates, observationId: o.id, topicId: o.topicId, step: draft.step });
          if (demoDraft) { const offered = state.messages.at(-1); if (offered) offered.draft = null; }
          if (review && p) next.basedOn = { aiReviewId: review.id, requestId: review.requestId, fromPlanId: p.id, fromVersion: p.version };
          state.messages.push(planConfirmation(state, next));
          state.decisions.push({ id: uid('dec'), choice: 'accept', reason: '', planId: p?.id || next.id, version: p?.version || next.version, newPlanId: next.id, aiReviewId: review?.id, at: new Date().toISOString() });
        } else {
          if (!p || p.version !== d.planVersion || p.status === 'replaced') throw new Error('Plan not found or replaced');
          const choice = z.enum(['continue','observe','stop']).parse(d.choice);
          if (review && (review.safety.pause || ['stop','observe'].includes(review.recommendation)) && choice === 'continue') throw new Error('This review does not approve continuing');
          if (hasSafetyHold(state, p.topicId) && choice === 'continue') throw new Error('Safety hold: observe or stop only');
          if (choice === 'stop') setPlanStatus(p, 'stopped');
          else if (choice === 'observe') { setPlanStatus(p, 'observing'); p.kind = 'observe'; if (p.safetyHold) p.safetyHold.resolvedAt = new Date().toISOString(); }
          else setPlanStatus(p, p.kind === 'observe' ? 'observing' : 'active');
          state.decisions.push({ id: uid('dec'), choice, aiReviewId: review?.id, reason: '', planId: p.id, version: p.version, at: new Date().toISOString() });
        }
      }
      state.inputRevision = q.inputRevision + 1;
      return { state, result: { state } };
    });
    return NextResponse.json(result);
  } catch (e) { const error = e instanceof Error ? e.message : 'Could not save'; return NextResponse.json({ error }, { status: /changed|stale/.test(error) ? 409 : 400 }); }
}
