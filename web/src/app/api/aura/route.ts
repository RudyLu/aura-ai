import { migrateState, modeOf, modeSid } from '@/server/statePolicy';
import { geminiConfigured } from '@/server/gemini';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionId } from '@/server/session';
import { loadState, mutateState } from '@/server/repo';
import { respond } from '@/server/agent';
import { allowAiCall } from '@/server/limits';
import { setPlanStatus, type State } from '@/domain/state';
import { uid } from '@/domain/dates';
import { isTopicId, TOPIC_IDS, type TopicId } from '@/domain/topics';

export const dynamic = 'force-dynamic';

const TopicSchema = z.enum(TOPIC_IDS as [TopicId, ...TopicId[]]);
const Body = z.object({
  text: z.string().trim().min(1).max(2000), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inputRevision: z.number().int().nonnegative().optional(),
  selectedTopic: TopicSchema.nullable().optional(),
  choice: z.object({ messageIndex: z.number().int().nonnegative(), optionId: z.string().min(1).max(100), topicId: TopicSchema.optional() }).optional()
});

// A chosen option must belong to Aura's latest saved message and match what was offered.
function resolveChoice(s: State, text: string, choice: NonNullable<z.infer<typeof Body>['choice']>) {
  const m = s.messages[choice.messageIndex];
  const option = m?.role === 'guide' ? m.interaction?.options.find(o => o.id === choice.optionId) : undefined;
  if (!option || s.messages.slice(choice.messageIndex + 1).some(x => x.role === 'guide')) throw new Error('That option is no longer available. Type your reply instead.');
  if ((option.topicId || undefined) !== (choice.topicId || undefined) || option.text !== text) throw new Error('That option does not match what Aura offered.');
  return isTopicId(option.topicId) ? option.topicId : null;
}

// Aura reads this session's saved records (never another visitor's) and replies.
export async function POST(req: Request) {
  const sid = modeSid(await sessionId(), req), mode = modeOf(req);
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  const q = body.data;
  const state = migrateState(await loadState(sid), mode);
  // The original Agent remains unchanged. Its canned offline replies are not shown as live AI.
  if (mode === 'demo' && !state.profile.includeDemoInAI) return NextResponse.json({ code: 'DEMO_CONSENT_REQUIRED', error: 'Allow demo records to be sent to Gemini in Settings first.' }, { status: 403 });
  if (q.inputRevision !== undefined && q.inputRevision !== (state.inputRevision || 0)) return NextResponse.json({ error: 'Records changed. Refresh and try again.' }, { status: 409 });
  let topicId: TopicId | null = null;
  try { if (q.choice) topicId = resolveChoice(state, q.text, q.choice); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (!geminiConfigured()) return NextResponse.json({ status: 'not-integrated', error: 'Gemini is not connected. Your message is saved; no Agent response was generated.' }, { status: 503 });
  if (!allowAiCall(sid)) {
    return NextResponse.json({ reply: { text: 'I need a short rest before the next message. Your records are saved; try again in a little while.', action: null, draft: null, logOffer: null, via: 'verified-summary' } });
  }
  // The latest user message is already in the saved history; pass the turns before it.
  const history = state.messages.at(-1)?.text === q.text ? state.messages.slice(0, -1) : state.messages;
  const reply = await respond(state, q.text, history, q.today, { topicId, selectedTopic: q.selectedTopic });

  // A reported health concern or worsening is kept on the server (PRD §3.3): it pauses the
  // active step and blocks new steps until resolved; a later chat cannot bypass it.
  const level = reply.safety?.level;
  if (reply.via === 'safety' && (level === 'emergency' || level === 'professional' || level === 'worse')) {
    const saved = await mutateState(sid, raw => {
      const s = migrateState(raw, mode);
      const p = reply.stopPlanId ? s.plans.find(p => p.id === reply.stopPlanId) : undefined;
      (s.safetyEvents ||= []).push({ id: uid('safety'), level, topicId: level === 'worse' ? p?.topicId : undefined, planId: p?.id, at: new Date().toISOString(), reasons: [reply.safety!.rule || reply.safety!.reason] });
      if (p && p.status === 'active') { p.safetyHold ||= { reasons: [`chat-${level}`], feedbackIds: [] }; setPlanStatus(p, 'stopped'); }
      s.inputRevision = (s.inputRevision || 0) + 1;
      return { state: s, result: s };
    });
    return NextResponse.json({ reply, inputRevision: saved.inputRevision, plans: saved.plans, safetyEvents: saved.safetyEvents });
  }
  return NextResponse.json({ reply });
}
