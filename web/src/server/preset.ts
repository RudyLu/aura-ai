// The prototype's preset replies (events.js replyFor), kept as the reply when Gemini is
// not configured at all (local development). Every message they produce is labeled
// "preset" in the UI. They never run when Gemini is configured but failing: then Aura
// gives a verified summary instead (see agent.ts).
import { activeObservations, type State } from '@/domain/state';
import { sourceLabel } from '@/domain/health';
import { stepDraft } from '@/domain/steps';
import { topic } from '@/domain/topics';
import type { AuraReply } from './agent';

export function presetReply(s: State, text: string): AuraReply {
  const t = text.toLowerCase();
  const focus = (activeObservations(s)[0] || { topicId: 'evening-energy' as const }).topicId;
  const out = (text: string, extra: Partial<AuraReply> = {}): AuraReply => ({ text, action: null, draft: null, logOffer: null, via: 'preset', ...extra });
  if (/cocoa|difficult meeting|sofa|exhausted/.test(t)) {
    return out('That sounds like a demanding day. You don’t have to turn tonight into another task.\n\nWould you like to keep the cocoa and your evening energy in today’s record? We can revisit them when you have more space. One day doesn’t tell us what caused the tiredness.',
      { draft: stepDraft('chat:checkin-tonight', focus), logOffer: { name: 'Hot cocoa', note: 'After a difficult meeting. Felt exhausted.', topicId: 'evening-energy' } });
  }
  if (/coffee|caffeine/.test(t)) {
    const n = s.entries.filter(e => e.kind === 'caffeine' && e.source !== 'sample').length;
    return out(`${n ? `You have ${n} caffeine ${n === 1 ? 'entry' : 'entries'}. ` : ''}Let’s notice when your drinks happen, alongside your ${topic(focus).checkinName}. Log each drink with its time. No need to change anything yet.`,
      { action: { type: 'caffeine' }, draft: stepDraft('chat:caffeine-log', focus) });
  }
  if (/exercise|workout|movement/.test(t)) {
    return out('Let’s keep movement in the picture without adding a workout. On days you already move, notice your evening energy afterwards.', { draft: stepDraft('chat:movement-notice', focus) });
  }
  if (/cycle|period/.test(t)) {
    return out('Period dates can be optional context alongside your check-ins. Dates alone can’t explain a change in how you feel. You can include them in your data sources.', { action: { type: 'data' } });
  }
  if (/late|busy|overtime|adjust/.test(t)) {
    return out('A busy week deserves a smaller step. How about answering just one check-in, on a day you choose, with no routine change?', { draft: stepDraft('chat:busy-week', focus) });
  }
  if (/week|pattern|sleep|rested/.test(t)) {
    const src = sourceLabel(s.dataSource, s.healthImport);
    return out(s.dataSource !== 'none'
      ? `Your ${src.toLowerCase()} shows different sleep lengths across the week. That is context, not a cause. To compare it with how you feel, a waking check-in helps: it asks how rested you feel after your main sleep.`
      : 'You haven’t connected sleep data yet. A waking check-in is a good start: it asks how rested you feel after your main sleep. You can add Apple Health whenever you like.',
    { action: { type: 'data' }, draft: stepDraft('chat:waking-checkin', focus) });
  }
  if (/same|better|reflect/.test(t)) {
    return out('Thanks for separating what you did from how you felt. A few entries aren’t enough to judge an effect. You can keep observing, or simplify the next step.');
  }
  return out('Thanks for sharing. Without the AI service I can help with a busy week, coffee timing, movement, or your recent sleep. Which would you like to start with?');
}
