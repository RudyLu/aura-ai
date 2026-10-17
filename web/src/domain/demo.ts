// Demo timelines for reviewers (ported from demo.js): the same app on day 1, day 4 and
// day 10, built by back-dating realistic records so nothing waits on a real week.
// All demo records are ordinary, editable records; state.demo marks the run.
import { addDays, todayISO, uid } from './dates';
import { demoProposal } from './demoConversation';
import { simulateAppleHealth } from './health';
import { acceptPlan, addObservation, blank, saveCheckin, saveEntry, type Feedback, type State } from './state';

export const SCENARIOS = [
  { day: 1, title: 'Day 1 · Just set up', desc: 'Apple Health connected. First check-in still to do; nothing to compare yet.' },
  { day: 4, title: 'Day 4 · Collecting', desc: 'Three evenings recorded. The walk was paused around overtime; coffee logging continues. Explore a quieter bedtime routine next.' },
  { day: 10, title: 'Day 10 · Review day', desc: 'Review the same story: a paused walk, coffee records and a reading routine. Consider an earlier time for a usual late drink.' }
];

// Small deterministic noise so scenarios look the same on every load.
const jitter = (n: number, k: number) => ((n * 37 + k * 11) % 7) / 7;

// `now` is the visitor's local wall clock, so records never sit after "now" for them.
export function buildDemo(day: number, now = new Date()): State {
  const st = blank();
  const today = todayISO(now);
  const start = addDays(today, -(day - 1));
  const iso = (n: number) => addDays(start, n); // n = 0 on day 1

  st.onboarded = true; st.mode = 'demo';
  st.demo = { day, start };
  st.profile = { consent: { terms: true, health: true, share: false, at: now.toISOString() }, concerns: ['drained', 'caffeine', 'wake-tired'], goalId: 'evening-energy', attempts: ['Less or earlier caffeine'], attemptsNote: '', constraint: 'Overtime and changing plans', context: [] };
  st.healthTypes = { sleep: true, activity: true, cycle: true, hrv: true };
  st.healthImport = simulateAppleHealth(today);
  // Over the scenario's own days, use a varied week so both sides of each comparison fill.
  const SLEEP = [6.2, 7.4, 7.0, 6.3, 6.0, 6.5, 7.6, 7.3, 6.1, 6.8];
  const MOVE = [0, 30, 0, 25, 0, 0, 40, 0, 35, 0];
  for (let n = 0; n < day; n++) { st.healthImport.sleep[iso(n)] = SLEEP[n]; st.healthImport.activity[iso(n)] = MOVE[n]; }
  st.dataSource = 'apple-health';

  const energy = addObservation(st, 'evening-energy', '21:00');
  energy.createdAt = `${start}T09:00:00.000Z`;
  let rested = null;
  if (day >= 4) { rested = addObservation(st, 'rested-waking', '08:00'); rested.createdAt = `${iso(1)}T09:00:00.000Z`; }

  // Plan: accepted on day 2; on the review-day scenario its review is due today.
  let plan = null;
  if (day >= 4) {
    plan = acceptPlan(st, { topicId: 'evening-energy', title: 'Log each caffeinated drink with its time', desc: 'Get to know your coffee rhythm before changing anything.', duration: '30 sec a day', days: 'For 7 days', kind: 'step', stepId: 'chat:caffeine-log' },
      { step: 'Log each caffeinated drink with the time you had it. Keep answering your evening-energy check-in as usual. No change to your intake.', start: iso(1), review: day >= 8 ? today : iso(7), observationId: energy.id, topicId: energy.topicId });
    plan.acceptedAt = `${iso(1)}T13:10:00.000Z`;
    plan.history = [{ status: 'active', at: plan.acceptedAt }];
  }

  for (let n = 0; n < day - 1; n++) { // every day before today
    const d = iso(n);
    const sleep = st.healthImport.sleep[d];
    // Caffeine: a morning coffee most days, an afternoon one on some.
    if (n % 3 !== 0) saveEntry(st, { kind: 'caffeine', name: 'Coffee', size: '1 cup', occurredAt: `${d}T09:${20 + n}`, mg: null });
    if (n % 3 === 1) saveEntry(st, { kind: 'caffeine', name: 'Latte or cappuccino', size: 'Large', occurredAt: `${d}T15:40`, mg: null });
    if (n === day - 2) saveEntry(st, { kind: 'food', name: 'Spinach salad', note: 'Avocado, eggs, tomatoes', occurredAt: `${d}T12:30`, photoUrl: '/assets/food/salad.jpg' });
    if (n === day - 3 && day > 2) saveEntry(st, { kind: 'food', name: 'Lasagna', note: 'Late dinner after overtime', occurredAt: `${d}T20:45`, photoUrl: '/assets/food/lasagna.jpg' });

    // Evening energy: lower after short nights, with noise; one "not sure", one missed day.
    if (n === 4) continue;
    const base = sleep < 7 ? 2 : 3;
    const score = Math.min(5, base + (jitter(n, 1) > 0.55 ? 1 : 0));
    const status = n === 6 ? 'unknown' : 'recorded';
    const chk = saveCheckin(st, { observationId: energy.id, topicId: energy.topicId, occurredAt: `${d}T21:${10 + n}`, status, score: status === 'recorded' ? score : null, note: n === 5 ? 'Overtime again' : '' });

    if (plan && n >= 1) {
      const execution = n === 5 ? 'Partly done' : 'Done';
      const fb: Feedback = { id: uid('fb'), planId: plan.id, planVersion: 1, observationId: energy.id, date: d, at: `${d}T21:20:00.000Z`, execution, answer: status === 'recorded' ? String(score) : 'unknown', score: chk.score, change: n >= 5 ? 'About the same' : 'Not answered', barriers: n === 5 ? ['Overtime'] : [], note: n === 5 ? 'Forgot to log the afternoon coffee' : '' };
      st.feedbacks.push(fb);
      chk.source = 'plan feedback'; chk.feedbackId = fb.id;
    }
    if (rested && n >= 1) {
      const r = sleep < 6.8 ? 2 : sleep > 7.6 ? 4 : 3;
      saveCheckin(st, { observationId: rested.id, topicId: rested.topicId, occurredAt: `${d}T08:${10 + n}`, status: n === 3 ? 'skipped' : 'recorded', score: r });
    }
  }
  // Later nodes are labeled snapshots of the same story, not continuations of live edits.
  // Keep the existing coffee plan/records; preserve the earlier walk and reading history.
  if (day >= 4) {
    const historyState = { ...st, plans: [] };
    const walkDraft = demoProposal('walk');
    const walk = acceptPlan(historyState, walkDraft, { step: walkDraft.step, start, review: iso(6), observationId: energy.id, topicId: 'evening-energy' });
    walk.acceptedAt = `${start}T18:00:00.000Z`;
    walk.status = 'stopped';
    walk.history = [{ status: 'active', at: walk.acceptedAt }, { status: 'stopped', at: `${iso(1)}T18:00:00.000Z` }];
    st.plans.push(walk);
    st.feedbacks.push({ id: uid('fb'), planId: walk.id, planVersion: walk.version, observationId: energy.id, date: iso(1), at: `${iso(1)}T21:20:00.000Z`, execution: 'Not done', score: null, change: 'Not answered', barriers: ['Overtime'], note: 'Paused the walk around overtime; chose coffee logging without an intake change.', origin: 'synthetic' });
    st.decisions.push({ id: uid('dec'), choice: 'stop', reason: 'Overtime made the walking arrangement difficult. Chose coffee logging instead.', planId: walk.id, version: walk.version, at: `${iso(1)}T18:00:00.000Z` });
    let recap = 'Earlier in this demo story: you chose a five-minute walk near home on Day 1. On Day 2, overtime made it difficult, so you paused that plan and chose to log coffee times without changing intake. These are preloaded scenario events; switching days does not carry over live edits.';
    if (day >= 10 && rested) {
      const quietDraft = demoProposal('quiet');
      const quiet = acceptPlan(st, quietDraft, { step: quietDraft.step, start: iso(3), review: today, observationId: rested.id, topicId: 'rested-waking' });
      quiet.acceptedAt = `${iso(3)}T18:00:00.000Z`;
      quiet.history = [{ status: 'active', at: quiet.acceptedAt }];
      for (const n of [5, 7, 8]) st.feedbacks.push({ id: uid('fb'), planId: quiet.id, planVersion: quiet.version, observationId: rested.id, date: iso(n), at: `${iso(n)}T08:20:00.000Z`, execution: n === 5 ? 'Partly done' : 'Done', score: null, change: 'About the same', barriers: n === 5 ? ['Overtime'] : [], note: 'Read a few pages instead of scrolling without delaying sleep.', origin: 'synthetic' });
      recap += ' On Day 4, you chose reading a few pages instead of scrolling before sleep. That plan is due for review today; its feedback includes feeling about the same.';
    }
    st.messages.push({ role: 'guide', text: recap, meta: { via: 'preset', cited: ['demo-dialogue:recap'] } });
  }
  // Today's demo entries never sit after the current time.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const at = (hm: string, back: number) => { const [h, m] = hm.split(':').map(Number); const t = Math.max(5, Math.min(h * 60 + m, nowMin - back)); return `${today}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  // Today: a morning coffee and an afternoon iced mocha, no evening answer yet.
  if (day > 1) {
    saveEntry(st, { kind: 'caffeine', name: 'Coffee', size: '1 cup', occurredAt: at('09:15', 90), mg: null });
    saveEntry(st, { kind: 'food', name: 'Iced mocha', note: 'Whipped cream, chocolate syrup', occurredAt: at('15:05', 40), photoUrl: '/assets/food/iced-mocha.jpg' });
    saveEntry(st, { kind: 'caffeine', name: 'Latte or cappuccino', size: '1 tall glass', occurredAt: at('15:05', 40), mg: null });
    if (rested) saveCheckin(st, { observationId: rested.id, topicId: rested.topicId, occurredAt: at('08:05', 150), status: 'recorded', score: 3 });
  }
  if (plan) {
    // Synthetic timelines contain records and plans, not fabricated Agent replies.

  }
  st.caffeineCoverage = [];
  for (let n = -1; n < day - 1; n++) {
    const d = iso(n);
    st.caffeineCoverage.push({ id: uid('cov'), from: `${d}T00:00`, to: `${addDays(d, 1)}T00:00`, confirmed: true,
      status: st.entries.some(e => e.kind === 'caffeine' && e.date === d) ? 'yes' : 'no', origin: 'synthetic' });
  }
  // A confirmed yes window does not mean caffeine after 14:00; explicit late-window coverage.
  for (let n = -1; n < day - 1; n++) {
    const d = iso(n);
    st.caffeineCoverage.push({ id: uid('cov'), from: `${d}T14:00`, to: `${addDays(d, 1)}T00:00`, confirmed: true,
      status: st.entries.some(e => e.kind === 'caffeine' && e.date === d && e.occurredAt.slice(11) >= '14:00') ? 'yes' : 'no', origin: 'synthetic' });
  }
  st.checkins.forEach(r => r.origin = 'synthetic'); st.entries.forEach(r => r.origin = 'synthetic'); st.feedbacks.forEach(r => r.origin = 'synthetic');
  st.profile.goals = st.observations.map((o, i) => ({ id: `goal:${o.topicId}`, label: o.topicId === 'evening-energy' ? 'Have energy after work' : 'Feel rested when I wake up', observationIds: [o.id], priority: i + 1 }));
  for (const o of st.observations) o.goalIds = st.profile.goals.filter(g => g.observationIds.includes(o.id)).map(g => g.id);
  return st;
}
