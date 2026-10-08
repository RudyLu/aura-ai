import { addDays } from './dates';
import type { HealthImport, HRVSample, State } from './state';

// The supplied PDF explicitly marks these baseline/binning values pending.
// Keep the reference configuration executable for labeled demos; real imports
// show raw SDNN until product approval of the configuration/timezone policy.
export const HRV_RULES = {
  version: 'hrv.reference.2026-10-06', reviewStatus: 'pending' as const,
  dayStart: '08:00', dayEnd: '22:00', slotMinutes: 120, slotValue: 'mean',
  baselineWindowDays: 30, baselineMinDays: 7, baselineMinSamples: 20, minValidSlots: 3
};
const minute = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const HRV_SLOTS = Array.from({ length: 7 }, (_, i) => hm(480 + i * 120));
const positive = (x: number) => Number.isFinite(x) && x > 0;
export const hrvSampleInWorkout = (h:HealthImport,date:string,x:HRVSample) => (h.workouts?.[date] || []).some(w => x.timestamp && w.startAt && w.endAt ? Date.parse(x.timestamp) >= Date.parse(w.startAt) && Date.parse(x.timestamp) < Date.parse(w.endAt) : minute(x.t) >= minute(w.start) && minute(x.t) < minute(w.end));
const valid = (h: HealthImport, date: string, cutoff = '23:59') => (h.hrvSamples?.[date] || []).filter(x => positive(x.ms) && minute(x.t) >= 480 && minute(x.t) < 1320 && x.t <= cutoff && !hrvSampleInWorkout(h, date, x));
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const r = p / 100 * (sorted.length - 1), lo = Math.floor(r), hi = Math.ceil(r);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (r - lo);
}
export function hrvBaseline(h: HealthImport, date: string) {
  const values: number[] = []; let days = 0;
  for (let n = 1; n <= HRV_RULES.baselineWindowDays; n++) {
    const xs = valid(h, addDays(date, -n));
    if (xs.length) { days++; values.push(...xs.map(x => x.ms)); }
  }
  values.sort((a, b) => a - b);
  const low = percentile(values, 5), high = percentile(values, 95);
  const ok = days >= HRV_RULES.baselineMinDays && values.length >= HRV_RULES.baselineMinSamples && low !== null && high !== null && high > low;
  return { ok, low, high, days, samples: values.length, needDays: HRV_RULES.baselineMinDays, needSamples: HRV_RULES.baselineMinSamples };
}
export function hrvIndex(value: number, base: { low: number | null; high: number | null } | null) {
  if (!positive(value) || !base || base.low === null || base.high === null || !positive(base.low) || base.high <= base.low) return null;
  return Math.round(Math.max(0, Math.min(100, 100 * Math.log(base.high / value) / Math.log(base.high / base.low))));
}
export function hrvDay(s: State, date: string, today: string, nowHM: string) {
  const h = s.healthImport;
  if (s.dataSource !== 'apple-health' || !h || !h.hrvSamples || s.healthTypes.hrv === false) return null;
  const simulated = h.via === 'simulated', base = simulated ? hrvBaseline(h, date) : {ok:false,low:null,high:null,days:0,samples:0,needDays:HRV_RULES.baselineMinDays,needSamples:HRV_RULES.baselineMinSamples};
  const policyPending = !simulated && HRV_RULES.reviewStatus === 'pending';
  const samples = date > today ? [] : valid(h, date, date === today ? nowHM : '23:59');
  const slots = HRV_SLOTS.map(t => {
    const start = minute(t), end = start + 120;
    const xs = samples.filter(x => minute(x.t) >= start && minute(x.t) < end);
    const hrv = !policyPending && xs.length ? xs.reduce((sum, x) => sum + x.ms, 0) / xs.length : null;
    const excluded = (h.hrvSamples?.[date] || []).filter(x => minute(x.t) >= start && minute(x.t) < end && hrvSampleInWorkout(h, date, x)).length;
    const overlap = (list: { start: string; end: string }[]) => list.filter(w => minute(w.start) < end && minute(w.end) > start);
    return { t, end: hm(end), hrv, n: xs.length, rawSamples: xs, index: hrv !== null && base.ok && !policyPending ? hrvIndex(hrv, base) : null,
      future: date > today || (date === today && t > nowHM), excluded: excluded && !xs.length ? 'workout' : null,
      workouts: overlap(h.workouts?.[date] || []), mindful: overlap(h.mindful?.[date] || []) };
  });
  const indexes = slots.flatMap(x => x.index === null ? [] : [x.index]);
  return { rawSamples:samples, slots, base, simulated, policyPending, periods: indexes.length,
    state: policyPending ? 'pending' : !base.ok ? 'building' : indexes.length < 3 ? 'insufficient' : 'ok',
    daily: !policyPending && base.ok && indexes.length >= 3 ? Math.round(indexes.reduce((a, b) => a + b, 0) / indexes.length) : null };
}
