// Discovery: descriptive comparisons for one observation at a time.
// Unit of analysis is a distinct day with a valid (scored) check-in for that
// observation. "Not sure" and "Skip" are counted but never used as scores.
// Each comparison splits valid days by one factor whose timing can precede the
// feeling (e.g. caffeine logged before the check-in, sleep ending that morning).
//
// Observation state:  collecting   – fewer than MIN_DAYS valid days
//                     insufficient – enough days, but no factor has MIN_GROUP days on both sides
//                     ready        – at least one factor can be compared
// Factor state:       insufficient | no-difference | difference
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Store = isNode ? require('./store.js') : root.AuraStore;
  const Health = isNode ? require('./health.js') : root.AuraHealth;
  const Topics = isNode ? require('./topics.js') : root.AuraTopics;

  const MIN_DAYS = 4;
  const MIN_GROUP = 2;
  const MEANINGFUL = 0.5; // scale points; smaller gaps are reported as no clear difference
  const WINDOW = 28;

  const caffeineOn = (state, date) => state.entries.filter(e => e.kind === 'caffeine' && e.date === date);

  function factorsFor(topicId) {
    const sleepFactor = {
      id: 'short-sleep', label: 'Sleep under 7 hours', needs: 'sleep', sides: ['after under 7 hours of sleep', 'after 7+ hours of sleep'],
      groups: ['Under 7 hours', '7 hours or more'],
      timing: 'Sleep ending on the morning of that day.',
      classify: (state, date, today) => {
        const h = Health.daily(state, date, today).sleep;
        return h === null ? null : h < 7;
      }
    };
    const caffeineBefore = {
      id: 'caffeine-before', label: 'Caffeine before the check-in', needs: 'caffeine', sides: ['with caffeine earlier that day', 'without caffeine before your check-in'],
      groups: ['Caffeine logged earlier that day', 'No caffeine logged before it'],
      timing: 'Only drinks logged before the check-in time count.',
      classify: (state, date, _t, chk) => caffeineOn(state, date).some(e => e.occurredAt < chk.occurredAt)
    };
    const caffeineLate = {
      id: 'caffeine-late', label: 'Caffeine after 2 pm the day before', needs: 'caffeine', sides: ['after caffeine past 2 pm the day before', 'with no caffeine after 2 pm the day before'],
      groups: ['Caffeine after 2 pm the day before', 'None logged after 2 pm'],
      timing: 'Drinks logged after 14:00 on the previous day.',
      classify: (state, date) => caffeineOn(state, Store.addDays(date, -1)).some(e => e.occurredAt.slice(11) >= '14:00')
    };
    const moveSame = {
      id: 'movement-same', label: 'Recorded exercise that day', needs: 'activity', sides: ['with exercise', 'without exercise'],
      groups: ['Exercise recorded', 'No exercise recorded'],
      timing: 'Exercise time is daily; it may fall after the check-in.',
      classify: (state, date, today) => {
        const m = Health.daily(state, date, today).activity;
        return m === null ? null : m > 0;
      }
    };
    const movePrev = {
      id: 'movement-prev', label: 'Recorded exercise the day before', needs: 'activity', sides: ['after exercise the day before', 'without exercise the day before'],
      groups: ['Exercise the day before', 'None the day before'],
      timing: 'Exercise recorded on the previous day.',
      classify: (state, date, today) => {
        const m = Health.daily(state, Store.addDays(date, -1), today).activity;
        return m === null ? null : m > 0;
      }
    };
    if (topicId === 'rested-waking') return [sleepFactor, caffeineLate, movePrev];
    if (topicId === 'afternoon-sleepiness') return [sleepFactor, caffeineBefore];
    return [caffeineBefore, sleepFactor, moveSame];
  }

  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const round1 = x => Math.round(x * 10) / 10;

  function analyze(state, obs, today = Store.todayISO()) {
    const topic = Topics.topic(obs.topicId);
    const from = Store.addDays(today, -(WINDOW - 1));
    const days = Store.dateRange(from, today);
    const includeSample = state.dataSource === 'sample';
    const latest = days.map(d => ({ date: d, chk: Store.dayCheckin(obs.id, d, { includeSample }) }));
    const valid = latest.filter(x => x.chk && x.chk.status === 'recorded');
    const unknown = latest.filter(x => x.chk && x.chk.status === 'unknown').length;
    const skipped = latest.filter(x => x.chk && x.chk.status === 'skipped').length;
    const missing = latest.filter(x => !x.chk && x.date >= (obs.createdAt || '').slice(0, 10)).length;

    const factors = factorsFor(obs.topicId).map(f => {
      const yes = [], no = [];
      let excluded = 0;
      for (const { date, chk } of valid) {
        const c = f.classify(state, date, today, chk);
        if (c === null) excluded++;
        else (c ? yes : no).push(chk.score);
      }
      const out = { id: f.id, label: f.label, groups: f.groups, sides: f.sides, timing: f.timing, needs: f.needs, n: [yes.length, no.length], excluded };
      if (yes.length < MIN_GROUP || no.length < MIN_GROUP) return Object.assign(out, { state: 'insufficient' });
      const m = [round1(mean(yes)), round1(mean(no))];
      const diff = round1(m[0] - m[1]);
      return Object.assign(out, { means: m, diff, state: Math.abs(diff) < MEANINGFUL ? 'no-difference' : 'difference' });
    });

    let state_ = 'collecting';
    if (valid.length >= MIN_DAYS) state_ = factors.some(f => f.state !== 'insufficient') ? 'ready' : 'insufficient';
    const usedSample = includeSample && (valid.some(x => x.chk.source === 'sample') || state.dataSource === 'sample');

    return {
      observationId: obs.id, topicId: obs.topicId, construct: topic.construct, direction: topic.direction,
      state: state_, validDays: valid.length, minDays: MIN_DAYS, minGroup: MIN_GROUP,
      unknown, skipped, missing, window: [from, today], factors, usedSample
    };
  }

  // Plain-language sentence for one factor; never causal.
  function describe(result, f) {
    const c = result.construct.toLowerCase();
    if (f.state === 'insufficient') {
      return `Not enough days to compare yet: ${f.n[0]} vs ${f.n[1]} days (needs ${result.minGroup} on each side).`;
    }
    if (f.state === 'no-difference') {
      return `No clear difference: average ${c} ${f.means[0]} on ${f.n[0]} days vs ${f.means[1]} on ${f.n[1]} days.`;
    }
    const dir = f.diff > 0 ? 'higher' : 'lower';
    return `Average ${c} was ${dir} (${f.means[0]} vs ${f.means[1]}) on days with “${f.groups[0].toLowerCase()}”, across ${f.n[0]} and ${f.n[1]} days. This describes your records; it does not show a cause.`;
  }

  // Small steps that test the better side of a difference. Keyed by factor and
  // by which side (0 = factor present, 1 = absent) had the better average.
  const STEPS = {
    'caffeine-before:1': { title: 'Last coffee before noon', desc: 'Swap the afternoon cup for water or decaf and see how the evening feels.', duration: 'No extra time', days: 'For 3 days', step: 'For the next 3 days, have your last caffeinated drink before noon. Log any drinks with their time and answer your check-in as usual.' },
    'caffeine-late:1': { title: 'No caffeine after 2 pm', desc: 'A small timing change, not a cut.', duration: 'No extra time', days: 'For 3 days', step: 'For the next 3 days, have your last caffeinated drink before 2 pm. Log drinks with their time and answer your check-in as usual.' },
    'short-sleep:1': { title: 'Wind down 30 minutes earlier', desc: 'A little more room for sleep, without a strict bedtime.', duration: '30 min earlier', days: 'For 3 nights', step: 'For the next 3 nights, start winding down 30 minutes earlier than usual. Keep answering your check-in as usual.' },
    'movement-same:0': { title: 'A 10-minute walk after work', desc: 'Small enough for a busy day.', duration: '10 min', days: '3 days this week', step: 'On 3 days this week, take a 10-minute walk after work. Answer your check-in as usual.' },
    'movement-prev:0': { title: 'A 10-minute evening walk', desc: 'Light movement, then notice the next day.', duration: '10 min', days: '3 days this week', step: 'On 3 evenings this week, take a 10-minute walk. Answer your check-in the next day as usual.' }
  };
  // What one comparison suggests: the better side, a plain headline, and a step to try.
  function insight(result, f) {
    if (f.state !== 'difference') return null;
    const higherIsBetter = Topics.topic(result.topicId).higherIsBetter;
    const better = (higherIsBetter ? f.means[0] > f.means[1] : f.means[0] < f.means[1]) ? 0 : 1;
    const word = higherIsBetter ? 'higher' : 'lower';
    const headline = `Your ${result.construct.toLowerCase()} was ${word} on days ${f.sides[better]}`;
    const s = STEPS[`${f.id}:${better}`];
    return { better, headline, gap: Math.abs(f.diff), step: s ? Object.assign({ topicId: result.topicId, kind: 'step', fromFactor: f.id, why: headline }, s) : null };
  }
  // The comparisons with a difference, biggest gap first.
  const findings = result => result.factors.map(f => ({ f, i: insight(result, f) })).filter(x => x.i).sort((a, b) => b.i.gap - a.i.gap);

  const api = { analyze, describe, insight, findings, STEPS, factorsFor, MIN_DAYS, MIN_GROUP, MEANINGFUL, WINDOW };
  if (isNode) module.exports = api;
  else root.AuraDiscovery = api;
})(typeof window !== 'undefined' ? window : globalThis);
