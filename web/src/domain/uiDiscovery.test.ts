import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemo } from './demo';
import { analyze, findings } from './uiDiscovery';
import { createExportParser } from './health';
import { addObservation, blank, saveCheckin, saveEntry } from './state';
import { todayISO } from './dates';

// Golden values captured from the prototype (aura-ai.elliechenhere.chatgpt.site) on
// Mon 2026-10-05 05:58 local time, by running its own demo.build(day) + analyze().
const PROTOTYPE = {
  d1: [{ topic: 'evening-energy', state: 'collecting', validDays: 0, unknown: 0, skipped: 0, missing: 1, factors: [['caffeine-before', [0, 0], null, 'insufficient'], ['short-sleep', [0, 0], null, 'insufficient'], ['movement-same', [0, 0], null, 'insufficient']], findings: [] }],
  d4: [
    { topic: 'evening-energy', state: 'collecting', validDays: 3, unknown: 0, skipped: 0, missing: 1, factors: [['caffeine-before', [2, 1], null, 'insufficient'], ['short-sleep', [1, 2], null, 'insufficient'], ['movement-same', [1, 2], null, 'insufficient']], findings: [] },
    { topic: 'rested-waking', state: 'collecting', validDays: 3, unknown: 0, skipped: 0, missing: 0, factors: [['short-sleep', [1, 2], null, 'insufficient'], ['caffeine-late', [1, 2], null, 'insufficient'], ['movement-prev', [1, 2], null, 'insufficient']], findings: [] }
  ],
  d10: [
    { topic: 'evening-energy', state: 'ready', validDays: 7, unknown: 1, skipped: 0, missing: 2, factors: [['caffeine-before', [5, 2], [3.2, 2.5], 'difference'], ['short-sleep', [4, 3], [2.5, 3.7], 'difference'], ['movement-same', [3, 4], [3, 3], 'no-difference']], findings: ['Your energy was higher on days with caffeine earlier that day', 'Your energy was higher on days after 7+ hours of sleep'] },
    { topic: 'rested-waking', state: 'ready', validDays: 7, unknown: 0, skipped: 1, missing: 1, factors: [['short-sleep', [3, 4], [2.3, 3], 'difference'], ['caffeine-late', [3, 4], [2.3, 3], 'difference'], ['movement-prev', [3, 4], [3, 2.5], 'difference']], findings: ['Your restedness was higher on days after 7+ hours of sleep', 'Your restedness was higher on days with no caffeine after 2 pm the day before', 'Your restedness was higher on days after exercise the day before'] }
  ]
};

describe('demo timelines match the prototype', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 5, 5, 58, 31)); });
  afterEach(() => vi.useRealTimers());

  for (const day of [1, 4, 10] as const) {
    it(`day ${day}`, () => {
      const now = new Date();
      const s = buildDemo(day, now);
      const got = s.observations.map(o => {
        const r = analyze(s, o, todayISO(now));
        return {
          topic: o.topicId, state: r.state, validDays: r.validDays, unknown: r.unknown, skipped: r.skipped, missing: r.missing,
          factors: r.factors.map(f => [f.id, f.n, f.means || null, f.state]), findings: findings(r).map(x => x.i.headline)
        };
      });
      expect(got).toEqual(PROTOTYPE[`d${day}`]);
    });
  }
});

describe('check-in counting', () => {
  it('keeps not sure, skipped and missing apart and only scores recorded days', () => {
    const s = blank();
    const o = addObservation(s, 'evening-energy');
    o.createdAt = '2026-10-01T09:00:00.000Z';
    saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: '2026-10-01T21:00', status: 'recorded', score: 3 });
    saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: '2026-10-02T21:00', status: 'unknown', score: 4 });
    saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: '2026-10-03T21:00', status: 'skipped' });
    const r = analyze(s, o, '2026-10-05');
    expect(r).toMatchObject({ validDays: 1, unknown: 1, skipped: 1, missing: 2, state: 'collecting' });
    expect(s.checkins[1].score).toBeNull();
  });

  it('uses the latest check-in of a day, not one per record', () => {
    const s = blank();
    const o = addObservation(s, 'evening-energy');
    saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: '2026-10-05T18:00', status: 'recorded', score: 2 });
    saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: '2026-10-05T21:00', status: 'recorded', score: 4 });
    expect(analyze(s, o, '2026-10-05').validDays).toBe(1);
  });
});

describe('caffeine timing rules', () => {
  const setup = () => {
    const s = blank();
    const o = addObservation(s, 'evening-energy');
    for (const [d, score] of [['01', 2], ['02', 2], ['03', 4], ['04', 4]] as const) {
      saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: `2026-10-${d}T21:00`, status: 'recorded', score });
    }
    return { s, o };
  };
  it('counts only drinks before the check-in time', () => {
    const { s, o } = setup();
    saveEntry(s, { kind: 'caffeine', name: 'Coffee', occurredAt: '2026-10-01T10:00' });
    saveEntry(s, { kind: 'caffeine', name: 'Coffee', occurredAt: '2026-10-02T10:00' });
    saveEntry(s, { kind: 'caffeine', name: 'Coffee', occurredAt: '2026-10-03T22:00' }); // after the check-in
    const f = analyze(s, o, '2026-10-05').factors.find(x => x.id === 'caffeine-before')!;
    expect(f.n).toEqual([2, 0]); // unlogged windows remain unknown
    s.caffeineCoverage = ['03','04'].map(d => ({ id:d, from:`2026-10-${d}T00:00`, to:`2026-10-${d}T21:00`, status:'no', confirmed:true }));
    const confirmed = analyze(s,o,'2026-10-05').factors.find(x => x.id === 'caffeine-before')!;
    expect(confirmed.n).toEqual([2,2]);
    expect(confirmed.means).toEqual([2,4]);
  });
  it('caffeine-late looks at the previous day after 14:00', () => {
    const s = blank();
    const o = addObservation(s, 'rested-waking');
    for (const d of ['02', '03', '04', '05']) saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: `2026-10-${d}T08:00`, status: 'recorded', score: 3 });
    saveEntry(s, { kind: 'caffeine', name: 'Coffee', occurredAt: '2026-10-01T15:00' });
    saveEntry(s, { kind: 'caffeine', name: 'Coffee', occurredAt: '2026-10-02T14:00' });
    saveEntry(s, { kind: 'caffeine', name: 'Coffee', occurredAt: '2026-10-03T13:59' });
    const f = analyze(s, o, '2026-10-05').factors.find(x => x.id === 'caffeine-late')!;
    expect(f.n).toEqual([2, 0]);
    s.caffeineCoverage = ['03','04'].map(d => ({ id:d, from:`2026-10-${d}T14:00`, to:`2026-10-${String(Number(d)+1).padStart(2,'0')}T00:00`, status:'no', confirmed:true }));
    expect(analyze(s,o,'2026-10-05').factors.find(x => x.id === 'caffeine-late')!.n).toEqual([2,2]);
  });
});

describe('Apple Health export parser', () => {
  it('unions overlapping sleep from phone and watch, skips in-bed and awake', () => {
    const p = createExportParser();
    const rec = (type: string, value: string, start: string, end: string) =>
      `<Record type="${type}" sourceName="x" value="${value}" startDate="${start} +0800" endDate="${end} +0800"/>`;
    const SL = 'HKCategoryTypeIdentifierSleepAnalysis';
    const xml = [
      rec(SL, 'HKCategoryValueSleepAnalysisAsleepCore', '2026-10-01 23:00:00', '2026-10-02 03:00:00'),
      rec(SL, 'HKCategoryValueSleepAnalysisAsleepUnspecified', '2026-10-02 02:00:00', '2026-10-02 06:30:00'),
      rec(SL, 'HKCategoryValueSleepAnalysisInBed', '2026-10-01 22:00:00', '2026-10-02 07:00:00'),
      rec(SL, 'HKCategoryValueSleepAnalysisAwake', '2026-10-02 06:30:00', '2026-10-02 07:00:00'),
      `<Record type="HKQuantityTypeIdentifierAppleExerciseTime" value="12" startDate="2026-10-02 18:00:00 +0800" endDate="2026-10-02 18:12:00 +0800"/>`,
      `<Record type="HKCategoryTypeIdentifierMenstrualFlow" value="HKCategoryValueMenstrualFlowMedium" startDate="2026-10-03 08:00:00 +0800" endDate="2026-10-03 08:00:00 +0800"/>`
    ].join('\n');
    // Split mid-tag to exercise the chunk carry-over.
    p.push(xml.slice(0, 137)); p.push(xml.slice(137));
    const out = p.finish();
    expect(out.sleep['2026-10-02']).toBe(7.5);
    expect(out.activity['2026-10-02']).toBe(12);
    expect(out.cycle).toEqual(['2026-10-03']);
    expect(out.range).toEqual(['2026-10-02', '2026-10-03']);
  });
});
