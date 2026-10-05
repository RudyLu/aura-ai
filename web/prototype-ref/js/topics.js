// Topic definitions. Each observation topic owns its question, its five scale
// labels, the construct it measures, its timing and its missing/skip wording.
// Nothing else in the app may hard-code topic copy.
(function (root) {
  const TOPICS = {
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
      name: 'Feeling rested on waking',
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
    }
  };

  const GOALS = [
    { id: 'evening-energy', label: 'More energy after work', topicId: 'evening-energy' },
    { id: 'rested', label: 'Feel rested when I wake up', topicId: 'rested-waking' },
    { id: 'afternoon', label: 'Stay awake in the afternoon', topicId: 'afternoon-sleepiness' },
    { id: 'balance', label: 'Find balance on busy days', topicId: 'evening-energy' }
  ];

  // Setup question 1: what has been getting in the way lately (multi-select).
  // Each concern weights the observation topics it relates to.
  const CONCERN_GROUPS = [
    { id: 'sleep', label: 'Sleep', items: [
      { id: 'fall-asleep', goal: 'Fall asleep more easily', label: 'Hard to fall asleep', w: { 'rested-waking': 2 } },
      { id: 'wake-tired', goal: 'Wake up rested', label: 'Waking up tired', w: { 'rested-waking': 3 } },
      { id: 'irregular', goal: 'Keep steadier sleep times', label: 'Irregular sleep times', w: { 'rested-waking': 2, 'afternoon-sleepiness': 1 } }] },
    { id: 'alertness', label: 'Alertness', items: [
      { id: 'slump', goal: 'Get through the afternoon', label: 'Afternoon slump', w: { 'afternoon-sleepiness': 3 } },
      { id: 'focus', goal: 'Focus more easily', label: 'Hard to focus', w: { 'afternoon-sleepiness': 2 } },
      { id: 'caffeine', goal: 'Rely less on caffeine', label: 'Relying on caffeine', w: { 'afternoon-sleepiness': 2, 'evening-energy': 1 } }] },
    { id: 'energy', label: 'Energy', items: [
      { id: 'drained', goal: 'Have energy after work', label: 'Drained after work', w: { 'evening-energy': 3 } },
      { id: 'low-energy', goal: 'Feel more energetic', label: 'Low energy most days', w: { 'evening-energy': 1, 'afternoon-sleepiness': 1, 'rested-waking': 1 } }] },
    { id: 'movement', label: 'Movement', items: [
      { id: 'too-tired-exercise', goal: 'Have energy to exercise', label: 'Too tired to exercise', w: { 'evening-energy': 2 } },
      { id: 'inactive', goal: 'Stay active', label: 'Hard to stay active', w: { 'evening-energy': 1 } }] },
    { id: 'mood', label: 'Mood', items: [
      { id: 'stressed', goal: 'Feel less tense', label: 'Stressed or tense', w: { 'evening-energy': 1, 'rested-waking': 1 } },
      { id: 'low-mood', goal: 'Lift your mood', label: 'Low mood', w: { 'evening-energy': 1 } }] }
  ];
  const CONCERNS = Object.fromEntries(CONCERN_GROUPS.flatMap(g => g.items.map(i => [i.id, Object.assign({ group: g.id }, i)])));
  // Topics ordered by how well they match the chosen concerns, with the reasons.
  function rankTopics(concernIds = []) {
    const ids = Object.keys(TOPICS);
    return ids.map((id, k) => {
      const why = concernIds.filter(c => CONCERNS[c] && CONCERNS[c].w[id]);
      const score = why.reduce((a, c) => a + CONCERNS[c].w[id], 0);
      return { id, score, why: why.sort((a, b) => CONCERNS[b].w[id] - CONCERNS[a].w[id]).map(c => CONCERNS[c].label), k };
    }).sort((a, b) => b.score - a.score || a.k - b.k);
  }

  const topic = id => TOPICS[id] || TOPICS['evening-energy'];
  const scaleLabel = (topicId, score) => {
    if (score === null || score === undefined) return null;
    return `${score} · ${topic(topicId).labels[score - 1]}`;
  };

  const api = { TOPICS, GOALS, CONCERN_GROUPS, CONCERNS, rankTopics, topic, scaleLabel, TOPIC_IDS: Object.keys(TOPICS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuraTopics = api;
})(typeof window !== 'undefined' ? window : globalThis);
