// Demo timelines for reviewers: the same app on day 1, day 4 and day 10,
// built by back-dating realistic records so nothing waits on a real week.
// All demo records are ordinary, editable records; state.demo marks the run.
(function () {
  const A = window.AuraApp, S = window.AuraStore, H = window.AuraHealth;

  const SCENARIOS = [
    { day: 1, title: 'Day 1 · Just set up', desc: 'Apple Health connected. First check-in still to do; nothing to compare yet.' },
    { day: 4, title: 'Day 4 · Collecting', desc: 'Three evenings recorded and a step in progress. Discovery 3 of 4 days: tonight’s check-in unlocks the first findings.' },
    { day: 10, title: 'Day 10 · Review day', desc: 'Over a week of check-ins, coffee and sleep. Findings with a step to try, and the step review is due today.' }
  ];

  // Small deterministic noise so scenarios look the same on every load.
  const jitter = (n, k) => ((n * 37 + k * 11) % 7) / 7;

  function build(day) {
    S.reset();
    const st = S.get();
    A.setSt(st);
    const today = S.todayISO();
    const start = S.addDays(today, -(day - 1));
    const iso = n => S.addDays(start, n); // n = 0 on day 1

    st.onboarded = true;
    st.demo = { day, start };
    st.profile = { consent: { terms: true, health: true, share: false, at: new Date().toISOString() }, concerns: ['drained', 'caffeine', 'wake-tired'], goalId: 'evening-energy', attempts: ['Less or earlier caffeine'], attemptsNote: '', constraint: 'Overtime and changing plans', context: [] };
    st.healthTypes = { sleep: true, activity: true, cycle: true };
    st.healthImport = H.simulateAppleHealth(today);
    // Over the scenario's own days, use a varied week so both sides of each comparison fill.
    const SLEEP = [6.2, 7.4, 7.0, 6.3, 6.0, 6.5, 7.6, 7.3, 6.1, 6.8];
    const MOVE = [0, 30, 0, 25, 0, 0, 40, 0, 35, 0];
    for (let n = 0; n < day; n++) { st.healthImport.sleep[iso(n)] = SLEEP[n]; st.healthImport.activity[iso(n)] = MOVE[n]; }
    st.dataSource = 'apple-health';

    const energy = S.addObservation('evening-energy', '21:00');
    energy.createdAt = `${start}T09:00:00.000Z`;
    let rested = null;
    if (day >= 4) { rested = S.addObservation('rested-waking', '08:00'); rested.createdAt = `${iso(1)}T09:00:00.000Z`; }

    // Plan: accepted on day 2; on the review-day scenario its review is due today.
    let plan = null;
    if (day >= 4) {
      plan = S.acceptPlan({ title: 'Log each caffeinated drink with its time', desc: 'Get to know your coffee rhythm before changing anything.', duration: '30 sec a day', days: 'For 7 days', kind: 'step' },
        { step: 'Log each caffeinated drink with the time you had it. Keep answering your evening-energy check-in as usual. No change to your intake.', start: iso(1), review: day >= 8 ? today : iso(7), observationId: energy.id, topicId: energy.topicId });
      plan.acceptedAt = `${iso(1)}T13:10:00.000Z`;
      plan.history = [{ status: 'active', at: plan.acceptedAt }];
    }

    for (let n = 0; n < day - 1; n++) { // every day before today
      const d = iso(n);
      const sleep = st.healthImport.sleep[d];
      // Caffeine: a morning coffee most days, an afternoon one on some.
      if (n % 3 !== 0) S.saveEntry({ kind: 'caffeine', name: 'Coffee', size: '1 cup', occurredAt: `${d}T09:${20 + n}`, mg: null });
      if (n % 3 === 1) S.saveEntry({ kind: 'caffeine', name: 'Latte or cappuccino', size: 'Large', occurredAt: `${d}T15:40`, mg: null });
      if (n === day - 2) S.saveEntry({ kind: 'food', name: 'Spinach salad', note: 'Avocado, eggs, tomatoes', occurredAt: `${d}T12:30`, photoData: 'assets/food/salad.jpg' });
      if (n === day - 3 && day > 2) S.saveEntry({ kind: 'food', name: 'Lasagna', note: 'Late dinner after overtime', occurredAt: `${d}T20:45`, photoData: 'assets/food/lasagna.jpg' });

      // Evening energy: lower after short nights, with noise; one "not sure", one missed day.
      if (n === 4) continue;
      const base = sleep < 7 ? 2 : 3;
      const score = Math.min(5, base + (jitter(n, 1) > 0.55 ? 1 : 0));
      const status = n === 6 ? 'unknown' : 'recorded';
      const chk = S.saveCheckin({ observationId: energy.id, topicId: energy.topicId, occurredAt: `${d}T21:${10 + n}`, status, score: status === 'recorded' ? score : null, note: n === 5 ? 'Overtime again' : '' });

      if (plan && n >= 1) {
        const execution = n === 5 ? 'Partly done' : 'Done';
        const fb = { id: S.uid('fb'), planId: plan.id, planVersion: 1, observationId: energy.id, date: d, at: `${d}T21:20:00.000Z`, execution, answer: status === 'recorded' ? String(score) : 'unknown', score: chk.score, change: n >= 5 ? 'About the same' : 'Not answered', barriers: n === 5 ? ['Overtime'] : [], note: n === 5 ? 'Forgot to log the afternoon coffee' : '' };
        st.feedbacks.push(fb);
        chk.source = 'plan feedback'; chk.feedbackId = fb.id;
      }
      if (rested && n >= 1) {
        const r = sleep < 6.8 ? 2 : sleep > 7.6 ? 4 : 3;
        S.saveCheckin({ observationId: rested.id, topicId: rested.topicId, occurredAt: `${d}T08:${10 + n}`, status: n === 3 ? 'skipped' : 'recorded', score: r });
      }
    }
    // Today's demo entries never sit after the current time.
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const at = (hm, back) => { const [h, m] = hm.split(':').map(Number); const t = Math.max(5, Math.min(h * 60 + m, nowMin - back)); return `${today}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
    // Today: a morning coffee and an afternoon iced mocha, no evening answer yet.
    if (day > 1) {
      S.saveEntry({ kind: 'caffeine', name: 'Coffee', size: '1 cup', occurredAt: at('09:15', 90), mg: null });
      S.saveEntry({ kind: 'food', name: 'Iced mocha', note: 'Whipped cream, chocolate syrup', occurredAt: at('15:05', 40), photoData: 'assets/food/iced-mocha.jpg' });
      S.saveEntry({ kind: 'caffeine', name: 'Latte or cappuccino', size: '1 tall glass', occurredAt: at('15:05', 40), mg: null });
      if (rested) S.saveCheckin({ observationId: rested.id, topicId: rested.topicId, occurredAt: at('08:05', 150), status: 'recorded', score: 3 });
    }
    if (plan) {
      st.messages.push(
        { role: 'user', text: 'Help me explore my coffee habit' },
        { role: 'guide', text: 'Let’s notice when your drinks happen, alongside your evening-energy check-in. Log each drink with its time. No need to change anything yet.', action: { type: 'caffeine' } },
        { role: 'guide', text: 'Your step is saved and linked to evening energy. When you’ve tried it, tell me how it went. What you did and how you felt are kept separate.', action: { type: 'feedback', planId: plan.id } }
      );
    }
    S.save();
    Object.assign(A.ui, { page: 'app', tab: 'today', modal: null, m: {}, draft: null, explore: { obsId: energy.id, range: 7, date: null, metric: 'all' }, chartPlayed: false });
  }

  function sheet() {
    const cur = A.st().demo;
    return `<p class="eyebrow">Demo timeline · for review</p><h2>See Aura over a week</h2><p>Each option back-dates realistic records so you can see what changes as days pass. It replaces the records in this browser.</p>
      <div class="options">${SCENARIOS.map(s => A.option(A.E(s.title), cur && cur.day === s.day, 'demo-load', s.day, A.E(s.desc))).join('')}</div>`;
  }

  A.demo = { SCENARIOS, build, sheet };
})();
