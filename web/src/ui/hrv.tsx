'use client';
import { useState } from 'react';
import { hrvDay } from '@/domain/hrv';
import { S, today } from './store';

export function HRVCard({ day }: { day: string }) {
  const [selected, select] = useState<number | null>(null);
  const s = S(), d = hrvDay(s, day, today(), new Date().toTimeString().slice(0,5));
  if (!d) return null;
  const max = Math.max(120, ...d.rawSamples.map(x=>x.ms), ...d.slots.map(x => x.hrv || 0)), ceiling = max <= 120 ? 120 : Math.ceil(max/40)*40;
  const x = (i: number) => 38+i*43, y = (value: number) => 160-value/ceiling*118;
  const good = d.slots.flatMap((v,i) => v.hrv === null ? [] : [{...v,i}]);
  const hi = good.length ? good.reduce((a,b) => a.hrv! > b.hrv! ? a : b) : null;
  const lo = good.length ? good.reduce((a,b) => a.hrv! < b.hrv! ? a : b) : null;
  let path = '', last = false;
  for (const [i,v] of d.slots.entries()) { if (v.hrv === null || v.future) { last = false; continue; } path += `${last ? ' L' : ' M'} ${x(i)} ${y(v.hrv)}`; last = true; }
  const rawX = (t:string) => 25 + ((Number(t.slice(0,2))*60+Number(t.slice(3))-480)/840)*305;
  const slot = selected !== null ? d.slots[selected] : null;
  const events = slot ? [...s.checkins.filter(r => r.date === day && r.occurredAt.slice(11,16) >= slot.t && r.occurredAt.slice(11,16) < slot.end).map(r => `Check-in: ${r.note || r.topicId}`), ...s.entries.filter(r => r.date === day && r.occurredAt.slice(11,16) >= slot.t && r.occurredAt.slice(11,16) < slot.end).map(r => r.name), ...slot.workouts.map(() => 'Workout'), ...slot.mindful.map(() => 'Mindful session')] : [];
  return <section className="hrvblock" aria-labelledby="h-hrv">
    <div className="chartcardhead"><h3 id="h-hrv">{d.policyPending ? 'Heart rate variability' : 'HRV relative index'}</h3><small>Apple Health{d.simulated ? ' · Simulated' : ''}</small></div>
    <div className="hrvsum">{d.policyPending ? <><p className="hrvlabel">Raw HRV only</p><p className="hrvmeta">Personal baseline and time-bin rules are pending approval. No relative index is calculated for real data.</p></> : !d.base.ok ? <><p className="hrvlabel">Building your baseline</p><p className="hrvmeta">{d.base.days} of {d.base.needDays} days · {d.base.samples} of {d.base.needSamples} samples{d.simulated ? ' · proposed demo thresholds' : ''}</p></> : <><p className="hrvlabel">Daily HRV index</p><p className={d.daily === null ? 'hrvnone' : 'hrvnum'}>{d.daily === null ? 'Not enough data yet' : d.daily}</p><p className="hrvmeta">Based on {d.periods} sampled periods{d.periods < 3 ? ' · needs 3' : ''}</p></>}</div>
    <details className="hrvinfo"><summary>What this means</summary><p>{d.policyPending ? 'Individual confirmed SDNN samples are shown without bin averages or a relative index.' : 'Average of available periods today.'} It doesn’t represent your whole day or measure perceived stress. A higher index means lower HRV within your own range.{d.simulated ? ' Demo calculation uses the pending reference configuration.' : ''}</p></details>
    <div className="hrvlegend"><span><i className="lh"/>HRV (ms)</span>{d.base.ok && !d.policyPending ? <span><i className="ls"/>HRV relative index (0–100)</span> : null}</div>
    <svg className="hrvplot" viewBox="0 0 360 210" role="img" aria-label="Daily HRV with gaps for missing or excluded samples. Tap a period for values.">
      {[0,1,2,3,4].map(k => <g key={k}><line x1="25" x2="330" y1={y(ceiling*k/4)} y2={y(ceiling*k/4)} className="hg"/><text x="22" y={y(ceiling*k/4)+4} textAnchor="end" className="ht">{ceiling*k/4}</text>{d.base.ok && !d.policyPending ? <text x="334" y={160-k*118/4+4} className="ht">{k*25}</text> : null}</g>)}
      {d.slots.map((v,i) => <g key={v.t}>{v.index !== null && !v.future ? <rect x={x(i)-12} y={160-v.index/100*118} width="24" height={v.index/100*118} className="hbar"/> : null}<text x={x(i)} y="181" textAnchor="middle" className={`ht x ${v.future ? 'future' : ''}`}>{v.t}</text>{v.excluded ? <text x={x(i)} y="198" textAnchor="middle" className="ht">workout</text> : null}</g>)}
      {d.policyPending ? d.rawSamples.map((v,i) => <circle key={`raw:${i}`} cx={rawX(v.t)} cy={y(v.ms)} r="4" className="hdot"><title>{v.t} · {v.ms} ms</title></circle>) : null}
      {d.slots.map((v,i) => [...s.entries.filter(e=>e.date===day && e.occurredAt.slice(11,16)>=v.t && e.occurredAt.slice(11,16)<v.end).map(e=>e.name),...s.checkins.filter(c=>c.date===day && c.occurredAt.slice(11,16)>=v.t && c.occurredAt.slice(11,16)<v.end).map(c=>'Check-in'),...v.workouts.map(()=>'Workout'),...v.mindful.map(()=>'Mindful session')].length ? <circle key={`event:${i}`} cx={x(i)} cy="205" r="3" fill="#b49aff"><title>Confirmed records in this period</title></circle> : null)}
      <path d={path} className="hline"/>{good.filter(v => !v.future).map(v => <circle key={v.i} cx={x(v.i)} cy={y(v.hrv!)} r="4" className="hdot"/>)}
      {hi && lo && hi.i !== lo.i ? [hi,lo].map((v,i) => <g key={i}><line x1={x(v.i)} x2={x(v.i)} y1={i ? 30 : 16} y2={y(v.hrv!)-5} stroke="#ffcf9e" strokeDasharray="3 3"/><text x={Math.max(70,Math.min(285,x(v.i)))} y={i ? 26 : 12} textAnchor="middle" className="ht">{i ? 'Lowest' : 'Highest'} HRV {Math.round(v.hrv!)} ms · {v.t}</text></g>) : null}
      {d.slots.map((v,i) => <rect key={v.t} x={x(i)-20} y="35" width="40" height="135" fill="transparent" role="button" tabIndex={0} aria-label={`${v.t}–${v.end}: ${v.hrv === null ? 'No sample' : `${Math.round(v.hrv)} ms`}`} onFocus={() => select(i)} onMouseEnter={() => select(i)} onClick={() => select(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') select(i); }}/>) }
    </svg>
    {!d.rawSamples.length ? <p className="soft">No HRV from your watch yet {day === today() ? 'today' : 'on this day'}.</p> : null}
    {slot ? <p className="hrvtip" role="status">{slot.t}–{slot.end} · {d.policyPending && slot.rawSamples.length ? slot.rawSamples.map(x=>`${x.t}: ${x.ms} ms`).join(' · ') : slot.hrv === null ? slot.excluded ? 'Workout samples excluded' : 'No sample' : `HRV ${Math.round(slot.hrv)} ms (${slot.n} samples)`}{slot.index !== null ? ` · Index ${slot.index}` : ''}{events.length ? ` · ${events.join(' · ')}` : ''}</p> : null}
    <p className="hrvmeta">It doesn’t measure stress. Records in the same period do not establish a cause.</p>
  </section>;
}
