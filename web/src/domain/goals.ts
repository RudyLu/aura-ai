import { CONCERNS, TOPIC_IDS, type TopicId } from './topics';
import { addObservation, type State } from './state';

export type GoalSelection = { id: string; topicIds: TopicId[] };

// Goal labels share the onboarding catalog; editing goals never edits concerns.
export function goalOptions(s: State) {
  const catalog = Object.values(CONCERNS).map(c => ({ id: c.id, label: c.goal, group: c.group, topicIds: TOPIC_IDS.filter(t => !!c.w[t]) }));
  const extra = (s.profile.goals || []).filter(g => !CONCERNS[g.id]).map(g => ({
    id: g.id, label: g.label, group: 'energy',
    topicIds: [...new Set(s.observations.filter(o => g.observationIds.includes(o.id) || o.goalIds?.includes(g.id)).map(o => o.topicId))]
  }));
  return [...extra, ...catalog];
}

export function updateGoals(s: State, selection: GoalSelection[]) {
  const options = goalOptions(s);
  if (!Array.isArray(selection) || new Set(selection.map(g => g.id)).size !== selection.length) throw new Error('Choose each goal only once.');
  for (const g of selection) {
    const option = options.find(o => o.id === g.id);
    if (!option || !Array.isArray(g.topicIds) || !g.topicIds.length || g.topicIds.some(t => !option.topicIds.includes(t))) throw new Error('Choose at least one suitable observation for each goal.');
  }
  const previous = s.profile.goals || [];
  const goals = selection.map((g, i) => {
    const prior = previous.find(p => p.id === g.id);
    const observationIds = [...new Set(g.topicIds)].map(t => {
      const existing = s.observations.find(o => o.topicId === t);
      return existing && prior?.observationIds.includes(existing.id) ? existing.id : addObservation(s, t).id;
    });
    return { id: g.id, label: prior?.label || options.find(o => o.id === g.id)!.label, priority: prior?.priority || previous.length + i + 1, observationIds };
  });
  goals.sort((a, b) => a.priority - b.priority).forEach((g, i) => g.priority = i + 1);
  s.profile.goals = goals;
  for (const o of s.observations) o.goalIds = goals.filter(g => g.observationIds.includes(o.id)).map(g => g.id);
}
