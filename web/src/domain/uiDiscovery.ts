// Discovery: descriptive comparisons for one observation at a time (ported from discovery.js).
// Unit of analysis is a distinct day with a valid (scored) check-in for that observation.
// "Not sure" and "Skip" are counted but never used as scores. Each comparison splits valid
// days by one factor whose timing can precede the feeling (e.g. caffeine logged before the
// check-in, sleep ending that morning).
//
// Observation state:  collecting   – fewer than MIN_DAYS valid days
//                     insufficient – enough days, but no factor has MIN_GROUP days on both sides
//                     ready        – at least one factor can be compared
// Factor state:       insufficient | no-difference | difference
import { addDays, dateRange } from './dates';
import { daily } from './health';
import { dayCheckin, type Checkin, type Observation, type State, type StepDraft } from './state';
import { topic, type TopicId } from './topics';

export const MIN_DAYS = 4;
export const MIN_GROUP = 2;
export const MEANINGFUL = 0.5; // scale points; smaller gaps are reported as no clear difference
export const WINDOW = 28;
export const ANALYSIS_CONFIG = { version: 'discovery.legacy.v1', window: WINDOW, minDays: MIN_DAYS, minGroup: MIN_GROUP, statistic: 'mean', gap: MEANINGFUL, reviewStatus: 'existing-pending-alternative' };

export type FactorId = 'short-sleep' | 'caffeine-before' | 'caffeine-late' | 'movement-same' | 'movement-prev';
export type Needs = 'sleep' | 'caffeine' | 'activity';
interface FactorDef {
  id: FactorId; label: string; needs: Needs; sides: [string, string]; groups: [string, string]; timing: string;
  classify: (s: State, date: string, today: string, chk: Checkin) => boolean | null;
}
export interface FactorResult {
  recordIds?: [string[],string[]]; excludedRecordIds?: string[]; id: FactorId; label: string; groups: [string, string]; sides: [string, string]; timing: string; needs: Needs;
  n: [number, number]; excluded: number; state: 'insufficient' | 'no-difference' | 'difference';
  means?: [number, number]; diff?: number;
}
export interface Analysis {
  configVersion: string; analysisId: string; evidenceRecordIds: string[]; limitations: string[]; observationId: string; topicId: TopicId; construct: string; direction: string;
  state: 'collecting' | 'insufficient' | 'ready'; validDays: number; minDays: number; minGroup: number;
  unknown: number; skipped: number; missing: number; window: [string, string]; factors: FactorResult[]; usedSample: boolean;
}

const caffeineOn = (s: State, date: string) => s.entries.filter(e => e.kind === 'caffeine' && e.date === date && (e.source !== 'sample' || s.dataSource === 'sample'));
export function caffeineWindow(s: State, from: string, to: string): boolean | null {
  if (s.entries.some(e => e.kind === 'caffeine' && e.caffeinated !== 'no' && e.caffeinated !== 'unknown' && e.occurredAt >= from && e.occurredAt < to && (e.source !== 'sample' || s.dataSource === 'sample'))) return true;
  const confirmed = (s.caffeineCoverage || []).filter(c => c.confirmed && c.from <= from && c.to >= to).at(-1);
  return confirmed?.status === 'no' ? false : null;
}

export function factorsFor(topicId: string): FactorDef[] {
  topic(topicId);
  if (topicId === 'stress' || topicId === 'productivity') return [];
  const sleepFactor: FactorDef = {
    id: 'short-sleep', label: 'Sleep under 7 hours', needs: 'sleep', sides: ['after under 7 hours of sleep', 'after 7+ hours of sleep'],
    groups: ['Under 7 hours', '7 hours or more'],
    timing: 'Sleep ending on the morning of that day.',
    classify: (s, date, today) => {
      const h = daily(s, date, today).sleep;
      return h === null ? null : h < 7;
    }
  };
  const caffeineBefore: FactorDef = {
    id: 'caffeine-before', label: 'Caffeine before the check-in', needs: 'caffeine', sides: ['with caffeine earlier that day', 'without caffeine before your check-in'],
    groups: ['Caffeine logged earlier that day', 'Confirmed no caffeine before it'],
    timing: 'Only drinks logged before the check-in time count.',
    classify: (s, date, _t, chk) => caffeineWindow(s, `${date}T00:00`, chk.occurredAt)
  };
  const caffeineLate: FactorDef = {
    id: 'caffeine-late', label: 'Caffeine after 2 pm the day before', needs: 'caffeine', sides: ['after caffeine past 2 pm the day before', 'with no caffeine after 2 pm the day before'],
    groups: ['Caffeine after 2 pm the day before', 'Confirmed none after 2 pm'],
    timing: 'Drinks logged after 14:00 on the previous day.',
    classify: (s, date) => caffeineWindow(s, `${addDays(date, -1)}T14:00`, `${date}T00:00`)
  };
  const moveSame: FactorDef = {
    id: 'movement-same', label: 'Recorded exercise that day', needs: 'activity', sides: ['with exercise', 'without exercise'],
    groups: ['Exercise recorded', 'No exercise recorded'],
    timing: 'Exercise time is daily; it may fall after the check-in.',
    classify: (s, date, today) => {
      const m = daily(s, date, today).activity;
      return m === null ? null : m > 0;
    }
  };
  const movePrev: FactorDef = {
    id: 'movement-prev', label: 'Recorded exercise the day before', needs: 'activity', sides: ['after exercise the day before', 'without exercise the day before'],
    groups: ['Exercise the day before', 'None the day before'],
    timing: 'Exercise recorded on the previous day.',
    classify: (s, date, today) => {
      const m = daily(s, addDays(date, -1), today).activity;
      return m === null ? null : m > 0;
    }
  };
  if (topicId === 'rested-waking') return [sleepFactor, caffeineLate, movePrev];
  if (topicId === 'afternoon-sleepiness') return [sleepFactor, caffeineBefore];
  return [caffeineBefore, sleepFactor, moveSame];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function analyze(s: State, obs: Observation, today: string): Analysis {
  const t = topic(obs.topicId);
  const from = addDays(today, -(WINDOW - 1));
  const days = dateRange(from, today);
  const includeSample = s.dataSource === 'sample';
  const latest = days.map(d => ({ date: d, chk: dayCheckin(s, obs.id, d, { includeSample }) }));
  const valid = latest.filter((x): x is { date: string; chk: Checkin } => !!x.chk && x.chk.status === 'recorded');
  const unknown = latest.filter(x => x.chk && x.chk.status === 'unknown').length;
  const skipped = latest.filter(x => x.chk && x.chk.status === 'skipped').length;
  const missing = latest.filter(x => !x.chk && x.date >= (obs.createdAt || '').slice(0, 10)).length;

  const factors = factorsFor(obs.topicId).map((f): FactorResult => {
    const yes: number[] = [], no: number[] = [];
    let excluded = 0; const recordIds:[string[],string[]] = [[],[]], excludedRecordIds:string[] = [];
    for (const { date, chk } of valid) {
      const c = f.classify(s, date, today, chk);
      if (c === null) { excluded++; excludedRecordIds.push(chk.id); }
      else { (c ? yes : no).push(chk.score as number); recordIds[c ? 0 : 1].push(chk.id); }
    }
    const out = { id: f.id, label: f.label, groups: f.groups, sides: f.sides, timing: f.timing, needs: f.needs,recordIds,excludedRecordIds, n: [yes.length, no.length] as [number, number], excluded };
    if (yes.length < MIN_GROUP || no.length < MIN_GROUP) return { ...out, state: 'insufficient' };
    const m: [number, number] = [round1(mean(yes)), round1(mean(no))];
    const diff = round1(m[0] - m[1]);
    return { ...out, means: m, diff, state: Math.abs(diff) < MEANINGFUL ? 'no-difference' : 'difference' };
  });

  let state: Analysis['state'] = 'collecting';
  if (valid.length >= MIN_DAYS) state = factors.some(f => f.state !== 'insufficient') ? 'ready' : 'insufficient';
  const usedSample = includeSample && (valid.some(x => x.chk.source === 'sample') || s.dataSource === 'sample');

  return {
    configVersion: ANALYSIS_CONFIG.version, analysisId: `analysis:${obs.id}:${today}:${ANALYSIS_CONFIG.version}`, evidenceRecordIds: valid.map(x => x.chk.id), limitations: ['Small descriptive sample; no causal inference.', 'Untimed activity is same-day co-occurrence only.', 'Caffeine absence requires a confirmed window.'],
    observationId: obs.id, topicId: obs.topicId, construct: t.construct, direction: t.direction,
    state, validDays: valid.length, minDays: MIN_DAYS, minGroup: MIN_GROUP,
    unknown, skipped, missing, window: [from, today], factors, usedSample
  };
}

// Plain-language sentence for one factor; never causal.
export function describe(result: Analysis, f: FactorResult) {
  const c = result.construct.toLowerCase();
  if (f.state === 'insufficient') return `Not enough days to compare yet: ${f.n[0]} vs ${f.n[1]} days (needs ${result.minGroup} on each side).`;
  if (f.state === 'no-difference') return `No clear difference: average ${c} ${f.means![0]} on ${f.n[0]} days vs ${f.means![1]} on ${f.n[1]} days.`;
  const dir = f.diff! > 0 ? 'higher' : 'lower';
  return `Average ${c} was ${dir} (${f.means![0]} vs ${f.means![1]}) on days with “${f.groups[0].toLowerCase()}”, across ${f.n[0]} and ${f.n[1]} days. This describes your records; it does not show a cause.`;
}

// Small steps that test the better side of a difference. Keyed by factor and
// by which side (0 = factor present, 1 = absent) had the better average.
type StepCopy = Pick<StepDraft, 'title' | 'desc' | 'duration' | 'days' | 'step'>;
export const STEPS: Record<string, StepCopy> = {
  'caffeine-before:1': { title: 'Last coffee before noon', desc: 'Swap the afternoon cup for water or decaf and see how the evening feels.', duration: 'No extra time', days: 'For 3 days', step: 'For the next 3 days, have your last caffeinated drink before noon. Log any drinks with their time and answer your check-in as usual.' },
  'caffeine-late:1': { title: 'No caffeine after 2 pm', desc: 'A small timing change, not a cut.', duration: 'No extra time', days: 'For 3 days', step: 'For the next 3 days, have your last caffeinated drink before 2 pm. Log drinks with their time and answer your check-in as usual.' },
  'short-sleep:1': { title: 'Wind down 30 minutes earlier', desc: 'A little more room for sleep, without a strict bedtime.', duration: '30 min earlier', days: 'For 3 nights', step: 'For the next 3 nights, start winding down 30 minutes earlier than usual. Keep answering your check-in as usual.' },
  'movement-same:0': { title: 'A 10-minute walk after work', desc: 'Small enough for a busy day.', duration: '10 min', days: '3 days this week', step: 'On 3 days this week, take a 10-minute walk after work. Answer your check-in as usual.' },
  'movement-prev:0': { title: 'A 10-minute evening walk', desc: 'Light movement, then notice the next day.', duration: '10 min', days: '3 days this week', step: 'On 3 evenings this week, take a 10-minute walk. Answer your check-in the next day as usual.' }
};
export interface Insight { better: 0 | 1; headline: string; gap: number; step: StepDraft | null }
// What one comparison suggests: the better side, a plain headline, and a step to try.
export function insight(result: Analysis, f: FactorResult): Insight | null {
  if (f.state !== 'difference') return null;
  const higherIsBetter = topic(result.topicId).higherIsBetter;
  const m = f.means!;
  const better: 0 | 1 = (higherIsBetter ? m[0] > m[1] : m[0] < m[1]) ? 0 : 1;
  const word = higherIsBetter ? 'higher' : 'lower';
  const headline = `Your ${result.construct.toLowerCase()} was ${word} on days ${f.sides[better]}`;
  const key = `${f.id}:${better}`;
  // Intervention approval is pending in the behavioral specifications.
  const approvedInterventions: Record<string, StepCopy> = {};
  const sc = approvedInterventions[key];
  return { better, headline, gap: Math.abs(f.diff!), step: sc ? { ...sc, topicId: result.topicId, kind: 'step', fromFactor: f.id, why: headline, stepId: `finding:${key}` } : null };
}
// Preserve catalog order: a larger difference is not stronger evidence.
export const findings = (result: Analysis) => result.factors
  .map(f => ({ f, i: insight(result, f) }))
  .filter((x): x is { f: FactorResult; i: Insight } => !!x.i);
