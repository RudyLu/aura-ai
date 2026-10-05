// The reviewed step whitelist (PRD §7.3 rule 3): Aura may only offer steps from here, by ID.
// Finding steps come from discovery STEPS; the conversational ones are the prototype's
// replyFor drafts. Nothing here asks for less sleep, fasting, more stimulants, medication
// changes or hard exercise.
import { STEPS } from './discovery';
import { topic, type TopicId } from './topics';
import type { StepDraft } from './state';

type Template = (topicId: TopicId) => Omit<StepDraft, 'stepId'>;

const CHAT_STEPS: Record<string, { label: string; fixedTopic?: TopicId; make: Template }> = {
  'checkin-tonight': {
    label: 'After a hard day: answer or skip tonight’s check-in, no new task',
    fixedTopic: 'evening-energy',
    make: () => ({ topicId: 'evening-energy', kind: 'step', title: 'Answer tonight’s evening-energy check-in, or skip it', desc: 'Leave a little room for tonight. A moment to notice, not another task.', duration: '20 seconds', days: 'When you feel ready', step: 'If it feels useful, answer your evening energy check-in and add a short note about your day. You can skip and return later.' })
  },
  'caffeine-log': {
    label: 'Log each caffeinated drink with its time for 7 days, no change in intake',
    make: topicId => ({ topicId, kind: 'step', title: 'Log each caffeinated drink with its time', desc: 'Get to know your coffee rhythm before changing anything.', duration: '30 sec a day', days: 'For 7 days', step: `Log each caffeinated drink with the time you had it. Keep answering your ${topic(topicId).checkinName} as usual. No change to your intake.` })
  },
  'movement-notice': {
    label: 'On days you already move, notice evening energy afterwards (no new workout)',
    fixedTopic: 'evening-energy',
    make: () => ({ topicId: 'evening-energy', kind: 'step', title: 'Check your evening energy on days you move', desc: 'Notice the activity you already do. No new workout.', duration: '1 min', days: 'After your usual activity', step: 'On a day you already planned to move, note what you did. Answer your evening energy check-in as usual. Skip if no activity was planned.' })
  },
  'busy-week': {
    label: 'For a busy week: answer just one check-in on a day you choose',
    make: topicId => ({ topicId, kind: 'step', title: `Answer one ${topic(topicId).checkinName} this week`, desc: 'A gentler step for a busy week. Keep your goal, with more flexibility.', duration: '20 sec', days: 'One day you choose', step: `On one available day, answer your ${topic(topicId).checkinName} and add a short note about what the day was like.` })
  },
  'waking-checkin': {
    label: 'Answer a waking check-in each morning for 7 days, no routine change',
    fixedTopic: 'rested-waking',
    make: () => ({ topicId: 'rested-waking', kind: 'step', title: 'Answer a waking check-in each morning', desc: 'Add how rested you feel to the sleep picture.', duration: '20 sec', days: 'Each morning for 7 days', step: 'Within an hour of waking, answer “How rested do you feel right now?”. No change to your routine.' })
  }
};

export const STEP_IDS = [...Object.keys(CHAT_STEPS).map(k => `chat:${k}`), ...Object.keys(STEPS).map(k => `finding:${k}`)];

// One line per step for the model to choose from.
export const stepMenu = () => [
  ...Object.entries(CHAT_STEPS).map(([k, v]) => `chat:${k} — ${v.label}`),
  ...Object.entries(STEPS).map(([k, v]) => `finding:${k} — ${v.title} (only when that finding exists)`)
].join('\n');

export function stepDraft(stepId: string, focusTopic: TopicId, why?: string): StepDraft | null {
  const [kind, key] = [stepId.slice(0, stepId.indexOf(':')), stepId.slice(stepId.indexOf(':') + 1)];
  if (kind === 'chat' && CHAT_STEPS[key]) {
    const c = CHAT_STEPS[key];
    return { ...c.make(c.fixedTopic || focusTopic), stepId };
  }
  if (kind === 'finding' && STEPS[key]) {
    return { ...STEPS[key], topicId: focusTopic, kind: 'step', fromFactor: key.split(':')[0], why, stepId };
  }
  return null;
}
