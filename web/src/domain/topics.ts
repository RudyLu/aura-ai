// Topic definitions (ported from topics.js). Each observation topic owns its question,
// its five scale labels, the construct it measures, its timing and its missing/skip wording.
export type TopicId = 'evening-energy' | 'rested-waking' | 'afternoon-sleepiness' | 'stress' | 'productivity';
export interface Topic {
  id: TopicId; name: string; construct: string; icon: string; question: string; shortQuestion: string;
  checkinName: string; labels: string[]; lead: string; direction: string; higherIsBetter: boolean;
  timing: { label: string; window: [number, number]; defaultTime: string; hint: string };
  dateRule: string; summary: string; missing: string; unknown: string; skip: string;
}
export interface Concern { id: string; goal: string; label: string; w: Partial<Record<TopicId, number>> }
export interface ConcernGroup { id: string; label: string; items: Concern[] }

export const TOPICS: Record<TopicId, Topic> = {
  'evening-energy': {
    id: 'evening-energy',
    name: 'Evening energy',
    construct: 'Energy',
    icon: '☀',
    question: 'How much energy do you have for the rest of your evening?',
    shortQuestion: 'Energy for your evening',
    checkinName: 'evening-energy check-in',
    labels: ['Very low', 'Low', 'Moderate', 'High', 'Very high'],
    lead: 'My energy for the evening is',
    direction: 'Higher means more energy.',
    higherIsBetter: true,
    timing: {
      label: 'End of your day',
      window: [17, 23],
      defaultTime: '21:00',
      hint: 'After work or your main commitments are done.'
    },
    dateRule: 'The evening you are describing.',
    summary: 'One short check-in at the end of your day.',
    missing: 'No evening check-in',
    unknown: 'Not sure how much energy I have',
    skip: 'Skipped this evening'
  },
  'rested-waking': {
    id: 'rested-waking',
    name: 'Rested on waking',
    construct: 'Restedness',
    icon: '☾',
    question: 'How rested do you feel right now, after your main sleep?',
    shortQuestion: 'How rested you feel after waking',
    checkinName: 'waking check-in',
    labels: ['Not at all rested', 'Slightly rested', 'Somewhat rested', 'Mostly rested', 'Fully rested'],
    lead: 'Right now, I feel',
    direction: 'Higher means more rested.',
    higherIsBetter: true,
    timing: {
      label: 'Soon after waking',
      window: [4, 12],
      defaultTime: '08:00',
      hint: 'Within an hour of getting up from your main sleep.'
    },
    dateRule: 'The morning you woke up.',
    summary: 'A short check-in within an hour of waking.',
    missing: 'No waking check-in',
    unknown: 'Not sure how rested I feel',
    skip: 'Skipped this morning'
  },
  'afternoon-sleepiness': {
    id: 'afternoon-sleepiness',
    name: 'Afternoon sleepiness',
    construct: 'Sleepiness',
    icon: '◷',
    question: 'How sleepy have you felt this afternoon?',
    shortQuestion: 'Sleepiness this afternoon',
    checkinName: 'afternoon-sleepiness check-in',
    labels: ['Not sleepy', 'Slightly sleepy', 'Somewhat sleepy', 'Very sleepy', 'Struggling to stay awake'],
    lead: 'This afternoon, I was',
    direction: 'Higher means sleepier. This scale runs the opposite way to energy and restedness.',
    higherIsBetter: false,
    timing: {
      label: 'Mid to late afternoon',
      window: [13, 18],
      defaultTime: '15:30',
      hint: 'Between lunch and the end of your afternoon.'
    },
    dateRule: 'The afternoon you are describing.',
    summary: 'A short check-in in the mid to late afternoon.',
    missing: 'No afternoon check-in',
    unknown: 'Not sure how sleepy I feel',
    skip: 'Skipped this afternoon'
  },
  stress: {
    id: 'stress', name: 'Perceived stress', construct: 'Perceived stress', icon: '≈',
    question: 'How stressed have you felt today?', shortQuestion: 'Stress today', checkinName: 'perceived-stress check-in',
    labels: ['Not stressed', 'A little stressed', 'Somewhat stressed', 'Quite stressed', 'Very stressed'],
    lead: 'Today, I felt', direction: 'Higher means more stressed.', higherIsBetter: false,
    timing: { label: 'End of your day', window: [17, 23], defaultTime: '21:30', hint: 'Looking back over the day up to this check-in.' },
    dateRule: 'The day you are describing.', summary: 'A short check-in at the end of your day.',
    missing: 'No perceived-stress check-in', unknown: 'Not sure how stressed I felt', skip: 'Skipped today'
  },
  productivity: {
    id: 'productivity', name: 'Productivity', construct: 'Perceived productivity', icon: '✓',
    question: 'How productive did today feel?', shortQuestion: 'How productive today felt', checkinName: 'productivity check-in',
    labels: ['Not productive', 'A little productive', 'Somewhat productive', 'Quite productive', 'Very productive'],
    lead: 'Today felt', direction: 'Higher means more productive as perceived.', higherIsBetter: true,
    timing: { label: 'After your work day', window: [16, 23], defaultTime: '18:30', hint: 'When your main work for the day is done.' },
    dateRule: 'The day you are describing.', summary: 'A short check-in after your work day.',
    missing: 'No productivity check-in', unknown: 'Not sure how productive it felt', skip: 'Skipped today'
  }

};

// Setup question 1: what has been getting in the way lately (multi-select).
// Each concern weights the observation topics it relates to.
export const CONCERN_GROUPS: ConcernGroup[] = [
  { id: 'sleep', label: 'Sleep', items: [
    { id: 'fall-asleep', goal: 'Fall asleep more easily', label: 'Hard to fall asleep', w: { 'rested-waking': 2 } },
    { id: 'wake-tired', goal: 'Wake up rested', label: 'Waking up tired', w: { 'rested-waking': 3 } },
    { id: 'irregular', goal: 'Keep steadier sleep times', label: 'Irregular sleep times', w: { 'rested-waking': 2, 'afternoon-sleepiness': 1 } }] },
  { id: 'alertness', label: 'Alertness', items: [
    { id: 'slump', goal: 'Get through the afternoon', label: 'Afternoon slump', w: { 'afternoon-sleepiness': 3 } },
    { id: 'focus', goal: 'Focus more easily', label: 'Hard to focus', w: { productivity: 3, 'afternoon-sleepiness': 1 } },
    { id: 'caffeine', goal: 'Rely less on caffeine', label: 'Relying on caffeine', w: { 'afternoon-sleepiness': 2, 'evening-energy': 1 } }] },
  { id: 'energy', label: 'Energy', items: [
    { id: 'drained', goal: 'Have energy after work', label: 'Drained after work', w: { 'evening-energy': 3 } },
    { id: 'low-energy', goal: 'Feel more energetic', label: 'Low energy most days', w: { 'evening-energy': 1, 'afternoon-sleepiness': 1, 'rested-waking': 1 } }] },
  { id: 'movement', label: 'Movement', items: [
    { id: 'too-tired-exercise', goal: 'Have energy to exercise', label: 'Too tired to exercise', w: { 'evening-energy': 2 } },
    { id: 'inactive', goal: 'Stay active', label: 'Hard to stay active', w: { 'evening-energy': 1 } }] },
  { id: 'mood', label: 'Mood', items: [
    { id: 'stressed', goal: 'Feel less tense', label: 'Stressed or tense', w: { stress: 3, 'evening-energy': 1 } },
    { id: 'low-mood', goal: 'Lift your mood', label: 'Low mood', w: { 'evening-energy': 1 } }] }
];
export const CONCERNS: Record<string, Concern & { group: string }> = Object.fromEntries(CONCERN_GROUPS.flatMap(g => g.items.map(i => [i.id, Object.assign({ group: g.id }, i)])));
// Goals: what the user wants to improve. Each onboarding concern is one goal (same ID);
// the concern label is only the wording used to pick it. Which check-ins suit a goal
// comes from this fixed table (the concern weights), never from stored links.
export interface Goal { id: string; label: string; problem: string; group: string; topics: TopicId[] }
export const GOAL_CATALOG: Record<string, Goal> = Object.fromEntries(Object.values(CONCERNS).map(c => [c.id, {
  id: c.id, label: c.goal, problem: c.label, group: c.group,
  topics: (Object.entries(c.w) as [TopicId, number][]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t)
}]));
export const GOAL_IDS = Object.keys(GOAL_CATALOG);
export const isGoalId = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(GOAL_CATALOG, id);
export const goalSuits = (goalId: string, topicId: TopicId) => !!GOAL_CATALOG[goalId]?.topics.includes(topicId);
// Topics ordered by how well they match the chosen concerns, with the reasons.
export function rankTopics(concernIds: string[] = []) {
  const ids = Object.keys(TOPICS) as TopicId[];
  return ids.map((id, k) => {
    const why = concernIds.filter(c => CONCERNS[c] && CONCERNS[c].w[id]);
    const score = why.reduce((a, c) => a + (CONCERNS[c].w[id] || 0), 0);
    return { id, score, why: why.sort((a, b) => (CONCERNS[b].w[id] || 0) - (CONCERNS[a].w[id] || 0)).map(c => CONCERNS[c].label), k };
  }).sort((a, b) => b.score - a.score || a.k - b.k);
}


export const TOPIC_IDS = Object.keys(TOPICS) as TopicId[];
export const isTopicId = (id: unknown): id is TopicId => typeof id === 'string' && Object.hasOwn(TOPICS, id);
// Null is a UI placeholder only. Business logic must call requireTopic.
export const topic = (id: string | null | undefined): Topic => id == null ? TOPICS['evening-energy'] : requireTopic(id);
export function requireTopic(id: string): Topic {
  if (!isTopicId(id)) throw new Error('Unknown topic');
  return TOPICS[id];
}
export const TOPIC_CATALOG_VERSION = 'topics.2026-10-07.v1.2';
export const topicDefinition = (id: TopicId) => ({ ...requireTopic(id), version: TOPIC_CATALOG_VERSION,
  metricId: `self-report:${id}`, analysisStatus: ['stress', 'productivity'].includes(id) ? 'not_configured' : 'enabled',
  allowedActionIds: [`observe:${id}`, 'context:caffeine'] });
export const scaleLabel = (topicId: string, score: number | null | undefined) =>
  score === null || score === undefined ? null : `${score} · ${topic(topicId).labels[score - 1]}`;
