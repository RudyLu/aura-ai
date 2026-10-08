import { describe, expect, it } from 'vitest';
import { TOPIC_IDS, topic } from './topics';
import { addObservation, blank, saveCheckin, saveEntry } from './state';
import { analyze, caffeineWindow } from './uiDiscovery';
import { hrvBaseline, hrvDay, hrvIndex, hrvSampleInWorkout } from './hrv';
import { simulateAppleHealth, createExportParser } from './health';
import { buildDemo } from './demo';

describe('five independent topic definitions', () => {
  it.each(TOPIC_IDS)('%s has its own scale and timing', id => {
    const t = topic(id), s = blank(), o = addObservation(s,id);
    expect(t.labels).toHaveLength(5); expect(o.time).toBe(t.timing.defaultTime);
    saveCheckin(s,{ observationId:o.id,topicId:id,status:'recorded',score:3,occurredAt:'2026-10-07T18:00' });
    expect(s.checkins[0].topicId).toBe(id);
  });
  it('rejects unsupported topic IDs instead of assigning an energy score',()=>{expect(()=>topic('unknown')).toThrow();});
  it.each(['stress','productivity'] as const)('%s never inherits energy comparisons', id => {
    const s = blank(), o = addObservation(s,id); expect(analyze(s,o,'2026-10-08').factors).toEqual([]);
  });
  it('higher stress/sleepiness are different from higher energy/productivity', () => {
    expect(topic('stress').higherIsBetter).toBe(false); expect(topic('afternoon-sleepiness').higherIsBetter).toBe(false);
    expect(topic('productivity').higherIsBetter).toBe(true);
  });
});
describe('coverage and origin', () => {
  it('missing caffeine is unknown; later intake is not earlier exposure', () => {
    const s = blank(); saveEntry(s,{kind:'caffeine',name:'Coffee',occurredAt:'2026-10-08T17:00'});
    expect(caffeineWindow(s,'2026-10-08T00:00','2026-10-08T15:00')).toBeNull();
    s.caffeineCoverage!.push({id:'none',from:'2026-10-08T00:00',to:'2026-10-08T15:00',status:'no',confirmed:true});
    expect(caffeineWindow(s,'2026-10-08T00:00','2026-10-08T15:00')).toBe(false);
  });
  it('demo additions are labeled separately from synthetic history', () => {
    const s = buildDemo(10); expect(s.checkins.every(c => c.origin === 'synthetic')).toBe(true);
    saveEntry(s,{kind:'food',name:'Lunch',occurredAt:'2026-10-08T12:00'}); expect(s.entries.at(-1)?.origin).toBe('demo-live');
  });
});
describe('HRV boundaries and pending rules', () => {
  it('uses reverse log position, never a stress score or age range', () => {
    expect(hrvIndex(30,{low:21,high:157})).toBe(82); expect(hrvIndex(95,{low:21,high:157})).toBe(25);
    expect(hrvIndex(0,{low:21,high:157})).toBeNull(); expect(hrvIndex(30,{low:30,high:30})).toBeNull();
  });
  it('excludes displayed day, outside-window and workout samples', () => {
    const h = simulateAppleHealth('2026-10-08'), before = hrvBaseline(h,'2026-10-08');
    h.hrvSamples!['2026-10-08'].push({t:'12:00',ms:9999}); expect(hrvBaseline(h,'2026-10-08')).toEqual(before);
    h.hrvSamples!['2026-10-08'] = [{t:'07:59',ms:10},{t:'08:00',ms:50},{t:'10:00',ms:60},{t:'18:30',ms:900},{t:'22:00',ms:999}];
    const s = blank(); s.dataSource = 'apple-health'; s.healthImport = h;
    const d = hrvDay(s,'2026-10-08','2026-10-08','21:00')!;
    expect(d.slots[0].hrv).toBe(50); expect(d.slots[1].hrv).toBe(60); expect(d.slots[5].excluded).toBe('workout'); expect(d.daily).toBeNull();
  });
  it('real data retains raw values while policy is pending; future slots remain empty', () => {
    const s = blank(); s.dataSource = 'apple-health'; s.healthImport = {...simulateAppleHealth('2026-10-08'),via:'export-xml'};
    const d = hrvDay(s,'2026-10-08','2026-10-08','11:00')!;
    expect(d.policyPending).toBe(true); expect(d.daily).toBeNull(); expect(d.slots.every(x => x.index === null)).toBe(true);
    expect(d.slots[3].hrv).toBeNull(); expect(d.slots[3].future).toBe(true);
  });
  it('retains exact workout boundaries inside the same minute', () => {
    const h = simulateAppleHealth('2026-10-08');
    h.workouts!['2026-10-08'] = [{start:'10:00',end:'10:00',startAt:'2026-10-08T10:00:20+08:00',endAt:'2026-10-08T10:00:40+08:00'}];
    expect(hrvSampleInWorkout(h,'2026-10-08',{t:'10:00',ms:50,timestamp:'2026-10-08T10:00:25+08:00'})).toBe(true);
    expect(hrvSampleInWorkout(h,'2026-10-08',{t:'10:00',ms:50,timestamp:'2026-10-08T10:00:40+08:00'})).toBe(false);
  });
  it('imports HRV with units/timestamps plus cross-midnight workout exclusions', () => {
    const parser = createExportParser(); const xml = '<Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" unit="s" value="0.05" startDate="2026-10-07 08:00:00 +0800" endDate="2026-10-07 08:00:00 +0800"/><Workout startDate="2026-10-07 23:00:00 +0800" endDate="2026-10-08 09:00:00 +0800"/>';
    parser.push(xml.slice(0,120)); parser.push(xml.slice(120)); const h = parser.finish();
    expect(h.hrvSamples['2026-10-07'][0].ms).toBe(50); expect(h.timezone).toBe('+0800'); expect(h.workouts['2026-10-08'][0]).toMatchObject({start:'00:00',end:'09:00'});
  });
});
