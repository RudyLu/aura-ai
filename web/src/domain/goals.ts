import { CONCERNS, TOPIC_IDS, type TopicId } from './topics';
import { addObservation, type State } from './state';

// Goal labels share the onboarding catalog; editing goals never edits concerns.
export function goalOptions(s: State) {
  const catalog = Object.values(CONCERNS).map(c => ({ id: c.id, label: c.goal, group: c.group, topicIds: TOPIC_IDS.filter(t => !!c.w[t]).sort((a, b) => (c.w[b] || 0) - (c.w[a] || 0)) }));
  const extra = (s.profile.goals || []).filter(g => !CONCERNS[g.id]).map(g => ({
    id: g.id, label: g.label, group: 'energy',
    topicIds: [...new Set(s.observations.filter(o => g.observationIds.includes(o.id) || o.goalIds?.includes(g.id)).map(o => o.topicId))]
  }));
  return [...extra, ...catalog].map(option => {
    const prior = s.profile.goals?.find(g => g.id === option.id);
    const existing = s.observations.filter(o => prior?.observationIds.includes(o.id) && option.topicIds.includes(o.topicId)).map(o => o.topicId);
    return { ...option, trackingTopicIds: existing.length ? existing : option.topicIds.slice(0, 1) };
  });
}

export function updateGoals(s: State, selection: string[]) {
  const options = goalOptions(s);
  if (!Array.isArray(selection) || new Set(selection).size !== selection.length) throw new Error('Choose each goal only once.');
  for (const g of selection) {
    const option = options.find(o => o.id === g);
    if (!option || !option.trackingTopicIds.length) throw new Error('This goal has no configured observation.');
  }
  const previous = s.profile.goals || [];
  const goals = selection.map((g, i) => {
    const option = options.find(o => o.id === g)!;
    const prior = previous.find(p => p.id === g);
    const observationIds = [...new Set(option.trackingTopicIds)].map(t => {
      const existing = s.observations.find(o => o.topicId === t);
      return existing && prior?.observationIds.includes(existing.id) ? existing.id : addObservation(s, t).id;
    });
    return { id: g, label: prior?.label || option.label, priority: prior?.priority || previous.length + i + 1, observationIds };
  });
  goals.sort((a, b) => a.priority - b.priority).forEach((g, i) => g.priority = i + 1);
  s.profile.goals = goals;
  for (const o of s.observations) o.goalIds = goals.filter(g => g.observationIds.includes(o.id)).map(g => g.id);
}
