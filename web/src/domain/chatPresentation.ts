import { daysBetween, fmtDate } from './dates';
import { goalsForTopic, type Message, type Plan, type State } from './state';

// Preserve sentence punctuation and paragraph boundaries, including decimal numbers/times.
export function replySegments(text: string): string[] {
  return text.split(/\n+|(?<!\b(?:Dr|Mr|Mrs|Ms|vs|e\.g|i\.e)\.)(?<=[.!?])\s+(?=[A-Z“‘])/u).map(part => part.trim()).filter(Boolean);
}

// A factual acknowledgement of a successfully saved command, never a generated claim.
export function planConfirmation(s: State, p: Plan): Message {
  const goal = goalsForTopic(s, p.topicId)[0]?.label;
  const days = daysBetween(p.start, p.review) + 1;
  const duration = days === 1 ? 'one day' : `${days} days`;
  return {
    role: 'guide',
    text: `Great, your step is confirmed: “${p.title}”.\nLet’s ${p.kind === 'observe' ? 'keep observing' : 'try this arrangement'} for ${duration}${goal ? ` and see how it fits your goal of “${goal}”` : ' and see how it fits your day'}. We’ll review on ${fmtDate(p.review)}.\nWe’ll look at what you managed and how you felt, then decide together what to keep or adjust.`,
    meta: { via: 'preset', cited: [`plan-confirmed:${p.id}`] },
    action: p.kind === 'observe' ? { type: 'checkin', topicId: p.topicId } : { type: 'feedback', planId: p.id }
  };
}
