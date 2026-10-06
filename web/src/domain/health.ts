// Health data sources (ported from health.js). Sample history and real Apple Health data
// are kept apart: sample values are generated on the fly and never written into the
// imported store, and every value carries its source.
//
// Real data paths:
//   1. Apple Health export: Health app › profile › Export All Health Data, unzip, choose
//      export.xml. Parsed in the browser (streamed); only daily totals are saved.
//   2. Native bridge for the iOS PoC: `window.AuraHealthBridge` (see bridge()).
//   3. Linked from the Aura iOS app: the app sends daily totals to the server for this
//      session (src/server/healthLink.ts); the browser adopts them (via:'ios-app').
import { addDays, uid } from './dates';
import { topic } from './topics';
import { activeObservations, type HealthImport, type Observation, type State, type DataSource } from './state';

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const EXERCISE = 'HKQuantityTypeIdentifierAppleExerciseTime';
const FLOW = 'HKCategoryTypeIdentifierMenstrualFlow';
const ASLEEP = /HKCategoryValueSleepAnalysisAsleep/; // Asleep, AsleepCore/Deep/REM/Unspecified; excludes InBed & Awake

// ---------- sample (synthetic) ----------
const SAMPLE_SLEEP = [7.2, 6.3, 7.8, 6.5, 7.5, 8.0, 6.2, 6.8, 7.4, 5.9, 7.1, 7.9, 6.6, 7.3];
const SAMPLE_MOVE = [25, 0, 40, 0, 30, 0, 0, 35, 0, 20, 0, 45, 0, 15];
export function sampleDay(date: string, today: string) {
  const n = Math.round((+new Date(today + 'T12:00') - +new Date(date + 'T12:00')) / 86400000);
  if (n < 0 || n > 13) return { sleep: null, activity: null, cycle: false };
  return { sleep: SAMPLE_SLEEP[n], activity: SAMPLE_MOVE[n], cycle: n === 3 || n === 4 };
}
// Example check-ins, clearly labeled source:'sample'. Deterministic, noisy,
// and not built to show any particular effect.
export const SAMPLE_SCORES: Record<string, (number | null)[]> = {
  'evening-energy': [3, 2, 4, null, 3, 3, 2, 4, 3, 2, 3, 4, 2, 3],
  'rested-waking': [3, 2, 4, 3, 3, 4, 2, 3, 3, 2, 3, 4, 3, null],
  'afternoon-sleepiness': [2, 4, 2, 3, null, 2, 4, 3, 2, 4, 3, 2, 3, 3]
};
export const SAMPLE_CAFFEINE_DAYS = [1, 3, 4, 6, 8, 9, 11, 13];

export function seedSample(s: State, obs: Observation, today: string) {
  const scores = SAMPLE_SCORES[obs.topicId];
  const t = topic(obs.topicId).timing.defaultTime;
  for (let n = 1; n <= 13; n++) {
    const date = addDays(today, -n);
    if (s.checkins.some(c => c.source === 'sample' && c.observationId === obs.id && c.date === date)) continue;
    const score = scores[n];
    s.checkins.push({
      id: uid('smp'), observationId: obs.id, topicId: obs.topicId, source: 'sample',
      occurredAt: `${date}T${t}`, date, status: score === null ? 'unknown' : 'recorded', score, note: '', createdAt: new Date().toISOString()
    });
  }
  for (const n of SAMPLE_CAFFEINE_DAYS) {
    const date = addDays(today, -n);
    if (s.entries.some(e => e.source === 'sample' && e.date === date)) continue;
    s.entries.push({ id: uid('smp'), source: 'sample', kind: 'caffeine', name: 'Coffee', size: '1 cup', mg: null, occurredAt: `${date}T${n % 3 ? '10:30' : '15:00'}`, date, note: '', createdAt: new Date().toISOString() });
  }
}
export function setDataSource(s: State, src: DataSource, today: string) {
  s.dataSource = src;
  if (src === 'sample') activeObservations(s).forEach(o => seedSample(s, o, today));
  else {
    s.checkins = s.checkins.filter(c => c.source !== 'sample');
    s.entries = s.entries.filter(e => e.source !== 'sample');
  }
}

// ---------- Apple Health export.xml (streaming) ----------
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
// "2026-09-30 23:12:04 +0800" → wall-clock ms and local date
const parseHKDate = (s: string | null) => {
  const m = s && s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], ms: Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`) };
};

export function createExportParser() {
  let tail = '';
  let count = 0;
  const sleepIntervals: Record<string, [number, number][]> = {}; // wake date → [[start,end],...]
  const activity: Record<string, number> = {};
  const cycle = new Set<string>();
  let minDate: string | null = null, maxDate: string | null = null;
  const seen = (d: string) => { if (!minDate || d < minDate) minDate = d; if (!maxDate || d > maxDate) maxDate = d; };

  function handle(tag: string) {
    const type = attr(tag, 'type');
    if (type !== SLEEP && type !== EXERCISE && type !== FLOW) return;
    const start = parseHKDate(attr(tag, 'startDate'));
    const end = parseHKDate(attr(tag, 'endDate'));
    if (!start || !end) return;
    count++;
    if (type === SLEEP) {
      if (!ASLEEP.test(attr(tag, 'value') || '')) return;
      (sleepIntervals[end.date] = sleepIntervals[end.date] || []).push([start.ms, end.ms]);
      seen(end.date);
    } else if (type === EXERCISE) {
      const v = parseFloat(attr(tag, 'value') || '');
      if (!Number.isFinite(v)) return;
      activity[start.date] = (activity[start.date] || 0) + v;
      seen(start.date);
    } else {
      const v = attr(tag, 'value') || '';
      if (/None$/.test(v)) return;
      cycle.add(start.date);
      seen(start.date);
    }
  }

  return {
    push(chunk: string) {
      const text = tail + chunk;
      const re = /<Record\b[^>]*>/g;
      let m: RegExpExecArray | null, last = 0;
      while ((m = re.exec(text))) { handle(m[0]); last = re.lastIndex; }
      // Keep a possibly incomplete tag for the next chunk.
      const lt = text.lastIndexOf('<');
      tail = lt >= last && text.indexOf('>', lt) === -1 ? text.slice(lt) : '';
      if (tail.length > 100000) tail = '';
    },
    finish() {
      const sleep: Record<string, number> = {};
      for (const [date, list] of Object.entries(sleepIntervals)) {
        // Union overlapping intervals so phone + watch do not double count.
        list.sort((a, b) => a[0] - b[0]);
        let total = 0, cur: [number, number] | null = null;
        for (const iv of list) {
          if (!cur || iv[0] > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [iv[0], iv[1]]; }
          else cur[1] = Math.max(cur[1], iv[1]);
        }
        if (cur) total += cur[1] - cur[0];
        sleep[date] = Math.round(total / 360000) / 10; // hours, 1 decimal
      }
      for (const d of Object.keys(activity)) activity[d] = Math.round(activity[d]);
      const range: [string, string] | null = minDate && maxDate ? [minDate, maxDate] : null;
      return { sleep, activity, cycle: [...cycle].sort(), records: count, range };
    }
  };
}

export async function importExportFile(file: File, onProgress?: (p: number) => void): Promise<HealthImport> {
  if (!/\.xml$/i.test(file.name)) throw new Error('Choose export.xml from the unzipped Apple Health export.');
  const parser = createExportParser();
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.length;
    parser.push(decoder.decode(value, { stream: true }));
    onProgress?.(read / file.size);
  }
  parser.push(decoder.decode());
  const out = parser.finish();
  if (!out.records) throw new Error('No sleep, exercise or cycle records were found in this file.');
  return Object.assign(out, { via: 'export-xml' as const, fileName: file.name, importedAt: new Date().toISOString() });
}

interface Bridge {
  isAvailable(): boolean;
  requestAuthorization(types: string[]): Promise<string[]>;
  fetchDaily(q: { types: string[]; from: string; to: string }): Promise<{ sleep?: Record<string, number>; activity?: Record<string, number>; cycle?: string[] }>;
}
export const bridge = (): Bridge | null => {
  const b = typeof window !== 'undefined' ? (window as unknown as { AuraHealthBridge?: Bridge }).AuraHealthBridge : undefined;
  return b && typeof b.isAvailable === 'function' && b.isAvailable() ? b : null;
};
export async function importFromBridge(types: string[], from: string, to: string): Promise<HealthImport> {
  const b = bridge();
  if (!b) throw new Error('Apple Health bridge not available in this browser.');
  const granted = await b.requestAuthorization(types);
  const data = await b.fetchDaily({ types: granted, from, to });
  return { sleep: data.sleep || {}, activity: data.activity || {}, cycle: data.cycle || [], range: [from, to], via: 'bridge', granted, importedAt: new Date().toISOString(), records: null };
}

// ---------- one accessor for every screen ----------
// Returns { sleep, activity, cycle, source } for a date given the chosen
// source and permitted types. Missing stays null; nothing is filled in.
export interface Daily { sleep: number | null; activity: number | null; cycle: boolean; source: 'sample' | 'apple-health' | null }
export function daily(s: State, date: string, today: string): Daily {
  const t = s.healthTypes;
  if (s.dataSource === 'sample') {
    const d = sampleDay(date, today);
    return { sleep: t.sleep ? d.sleep : null, activity: t.activity ? d.activity : null, cycle: t.cycle ? d.cycle : false, source: 'sample' };
  }
  if (s.dataSource === 'apple-health' && s.healthImport) {
    const h = s.healthImport;
    const sl = h.sleep[date], ac = h.activity[date];
    return {
      sleep: t.sleep && sl !== undefined ? sl : null,
      activity: t.activity && ac !== undefined ? ac : null,
      cycle: t.cycle && h.cycle.includes(date),
      source: 'apple-health'
    };
  }
  return { sleep: null, activity: null, cycle: false, source: null };
}

export const sourceLabel = (src: DataSource, imp: HealthImport | null | undefined) =>
  src === 'sample' ? 'Sample history' : src === 'apple-health' ? (imp && imp.via === 'simulated' ? 'Apple Health · simulated' : imp && imp.via === 'ios-app' ? 'Apple Health · via iOS app' : 'Apple Health') : 'Not connected';

// Prototype stand-in for a HealthKit permission: fictional but realistic
// daily records for the last 30 days, marked via:'simulated'.
export function simulateAppleHealth(today: string): HealthImport {
  const sleep: Record<string, number> = {}, activity: Record<string, number> = {}, cycle: string[] = [];
  const add = (iso: string, n: number) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  for (let n = 0; n < 30; n++) {
    const d = add(today, -n);
    const wd = new Date(d + 'T12:00').getDay();
    const wave = Math.sin(n * 1.7) * 0.6 + Math.cos(n * 0.9) * 0.4;
    sleep[d] = Math.round(((wd === 0 || wd === 6) ? 7.9 : 6.7) * 10 + wave * 10) / 10;
    activity[d] = [1, 3, 5].includes(wd) ? 25 + (n % 3) * 10 : (wd === 6 ? 50 : 0);
  }
  for (const n of [2, 3, 4, 5]) cycle.push(add(today, -n));
  return { sleep, activity, cycle: cycle.sort(), range: [add(today, -29), today], via: 'simulated', importedAt: new Date().toISOString(), records: null };
}

export function healthSummary(h: HealthImport) {
  const n = Object.keys(h.sleep).length, a = Object.values(h.activity).filter(v => v > 0).length;
  return `${n} nights of sleep · ${a} active days · ${h.cycle.length} period dates`;
}
