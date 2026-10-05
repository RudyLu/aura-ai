'use client';
// Explore and Discovery (ported from views.js explore()/discoveryDetail() and chart.js overlay()).
import { useEffect, useRef } from 'react';
import { addDays, dateRange, fmtDate, fmtDay } from '@/domain/dates';
import { analyze, findings, insight, type FactorResult } from '@/domain/discovery';
import { daily, sourceLabel } from '@/domain/health';
import { activeObservations, dayCheckin, type Checkin, type Entry, type Observation } from '@/domain/state';
import { topic, TOPIC_IDS } from '@/domain/topics';
import { Btn, checkinStatus, plural, SourceTag } from './core';
import { dispatch } from './actions';
import { dayRecords } from './today';
import { S, today, ui } from './store';

const FACTOR_COPY = { insufficient: 'Not enough days', 'no-difference': 'No clear difference', difference: 'Difference in your records' };
const timeOf = (iso: string) => iso.slice(11, 16);

// ---------- readiness ----------
function readiness(obs: Observation) {
  const s = S();
  const r = analyze(s, obs, today());
  const t = topic(obs.topicId);
  const caffeineDays = new Set(s.entries.filter(e => e.kind === 'caffeine' && (e.source !== 'sample' || s.dataSource === 'sample')).map(e => e.date)).size;
  const sleepOn = s.dataSource !== 'none' && s.healthTypes.sleep;
  const left = Math.max(0, r.minDays - r.validDays);
  const ready = r.factors.filter(f => f.state !== 'insufficient').length;
  const title = r.state === 'collecting' ? `Building your ${t.name.toLowerCase()} picture` : r.state === 'insufficient' ? 'Not enough to compare yet' : `${plural(ready, 'comparison')} ready`;
  const lead = r.state === 'ready' ? 'Averages from your records, not causes.'
    : r.state === 'insufficient' ? 'Keep logging caffeine and check-ins so each comparison has days on both sides.'
      : r.validDays === 0 ? 'Your first check-in starts the picture.'
        : r.validDays === 1 ? `Your first check-in is saved. ${r.minDays - 1} more days to go.`
          : `${r.validDays} of ${r.minDays} days recorded.`;
  const have = [`${plural(r.validDays, 'day')} with a check-in`, `${plural(caffeineDays, 'day')} with caffeine logged`, sleepOn ? `Sleep from ${sourceLabel(s.dataSource, s.healthImport).toLowerCase()}` : null].filter(Boolean) as string[];
  const need = [left ? `${plural(left, 'more day')} with a ${t.timing.label.toLowerCase()} check-in` : null, sleepOn ? null : 'Sleep data (optional)'].filter(Boolean) as string[];
  return { r, t, title, lead, have, need, caffeineDays, sleepOn };
}

function Meter({ n, of, label }: { n: number; of: number; label: string }) {
  return <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={Math.min(n, of)} aria-label={label}><i style={{ width: `${Math.min(100, Math.round(n / of * 100))}%` }} /></div>;
}
function ReadinessBlock({ obs }: { obs: Observation }) {
  const { r, t, title, lead } = readiness(obs);
  return <><div className="dischead"><strong>{title}</strong></div>{r.state === 'collecting' ? <Meter n={r.validDays} of={r.minDays} label={`${t.name}: ${r.validDays} of ${r.minDays} days`} /> : null}<p className="disclead">{lead}</p></>;
}

// Discovery hero: the observation over two weeks, cut by a line at the best day.
function BestDayHero({ obs }: { obs: Observation }) {
  const s = S();
  const t = topic(obs.topicId);
  const end = today();
  const dates = dateRange(addDays(end, -13), end);
  const withSample = s.dataSource === 'sample';
  const vals = dates.map(d => { const c = dayCheckin(s, obs.id, d, { includeSample: withSample }); return c && c.status === 'recorded' ? c.score! : null; });
  const scored = vals.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
  if (scored.length < 2) return null;
  const best = scored.reduce((a, b) => (t.higherIsBetter ? b[0] >= a[0] : b[0] <= a[0]) ? b : a);
  const bi = best[1], bd = dates[bi];
  const W = 320, Hh = 132, base = 118, top = 26;
  const x = (i: number) => 8 + i * (W - 16) / (dates.length - 1);
  const y = (v: number) => base - (v / 5) * (base - top);
  const pts = scored.map(([v, i]) => [x(i), y(v)]);
  const line = pts.reduce((d, p, i) => i ? d + ` C ${(pts[i - 1][0] + p[0]) / 2} ${pts[i - 1][1]}, ${(pts[i - 1][0] + p[0]) / 2} ${p[1]}, ${p[0]} ${p[1]}` : `M ${p[0]} ${p[1]}`, '');
  const area = `${line} L ${pts.at(-1)![0]} ${base} L ${pts[0][0]} ${base} Z`;
  const bx = x(bi);
  const h = daily(s, bd, end);
  const chk = dayCheckin(s, obs.id, bd, { includeSample: withSample })!;
  const drinks = s.entries.filter(e => e.date === bd && e.kind === 'caffeine' && (e.source !== 'sample' || withSample));
  const before = drinks.filter(e => e.occurredAt < chk.occurredAt);
  const food = s.entries.filter(e => e.date === bd && e.kind === 'food' && (e.source !== 'sample' || withSample));
  const tags = [
    h.sleep !== null ? ['sleep', `Sleep ${h.sleep} h`] : null,
    ['caffeine', drinks.length ? `Caffeine ×${drinks.length}${before.length ? ' · last ' + before.at(-1)!.occurredAt.slice(11, 16) : ''}` : 'No caffeine'],
    h.activity !== null ? ['move', h.activity ? `Movement ${h.activity} min` : 'No exercise'] : null,
    food.length ? ['food', food.map(f => f.name).join(', ')] : null,
    h.cycle ? ['cycle', 'Period day'] : null
  ].filter(Boolean) as [string, string][];
  const label = t.higherIsBetter ? `Highest ${t.construct.toLowerCase()}` : `Least ${t.construct.toLowerCase()}`;
  return (
    <div className="besthero">
      <div className="bestplot">
        <ul className="besttags" aria-label={`On ${fmtDate(bd)}`}>{tags.map(([k, v]) => <li key={k} className={`tag-${k}`}>{v}</li>)}</ul>
        <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" role="img" aria-label={`${t.name} over the last 14 days. ${label} on ${fmtDate(bd)}: ${chk.score} of 5.`}>
          <defs><linearGradient id="bestwash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffba79" stopOpacity=".75" /><stop offset=".55" stopColor="#9b7fe0" stopOpacity=".35" /><stop offset="1" stopColor="#9b7fe0" stopOpacity="0" /></linearGradient></defs>
          {dates.map((d, i) => <line key={d} x1={x(i)} x2={x(i)} y1={top - 8} y2={base} stroke="#ffffff" strokeOpacity=".07" />)}
          <path d={area} fill="url(#bestwash)" /><path d={line} fill="none" stroke="#ffba79" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1={bx} x2={bx} y1={top - 12} y2={base} stroke="#ffffff" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="bestmark" style={{ left: `${(bx / W * 100).toFixed(2)}%` }} />
      </div>
      <div className="bestaxis"><span>{fmtDate(dates[0])}</span><span>Today</span></div>
      <p className="bestline"><span className="eyebrow">{label} · {fmtDay(bd)}</span><strong>{checkinStatus(chk, obs.topicId)}</strong></p>
      <Btn act="exp-goto" val={bd} cls="quiet bestgo">See this day</Btn>
    </div>
  );
}

function DiscoveryDetail({ obs }: { obs: Observation }) {
  const s = S();
  const { r, have, need, caffeineDays, sleepOn } = readiness(obs);
  const t = topic(obs.topicId);
  const unavailable = (f: FactorResult) => f.needs !== 'caffeine' && (s.dataSource === 'none' || !s.healthTypes[f.needs]);
  const shown = r.factors.filter(f => !unavailable(f));
  if (r.state === 'collecting') {
    const item = (done: boolean, text: string) => <li className={done ? 'done' : ''}><span aria-hidden="true">{done ? '✓' : '○'}</span>{text}{done ? <span className="sr-only"> (done)</span> : null}</li>;
    return (
      <><BestDayHero obs={obs} /><ReadinessBlock obs={obs} />
        <details className="limits"><summary>What Discovery needs</summary><ul className="needlist">
          {item(r.validDays >= r.minDays, `Answer your ${t.name.toLowerCase()} check-in on ${r.minDays} days (${r.validDays} so far)`)}
          {item(caffeineDays > 0, 'Caffeine logged with its time')}
          {item(sleepOn, 'Sleep data connected (optional)')}
        </ul></details></>
    );
  }
  if (r.state === 'ready') {
    const found = findings(r).filter(x => !unavailable(x.f));
    const bars = (f: FactorResult) => (
      <div className="cmpbars">{[0, 1].map(k => (
        <div key={k} className={k === insight(r, f)?.better ? 'win' : ''}><span>{f.groups[k]}</span><i style={{ ['--w' as string]: `${(f.means![k] / 5 * 100).toFixed(0)}%` }} /><b>{f.means![k]}</b><small>{plural(f.n[k], 'day')}</small></div>
      ))}</div>
    );
    const top = found[0];
    const rest = shown.filter(f => f !== top?.f);
    return (
      <><BestDayHero obs={obs} />
        {top ? (
          <article className="finding"><p className="eyebrow">What your records show</p><h3>{top.i.headline}</h3>{bars(top.f)}
            {top.i.step
              ? <div className="tryit"><p className="eyebrow">Something small to try</p><strong>{top.i.step.title}</strong><p>{top.i.step.desc}</p><Btn act="disc-try" val={top.f.id} data={{ obs: obs.id }}>Try it</Btn></div>
              : <p className="soft">Nothing to change yet. Keep checking in.</p>}
          </article>
        ) : (
          <article className="finding"><p className="eyebrow">What your records show</p><h3>No clear differences yet</h3><p className="soft">Your {t.name.toLowerCase()} looks similar across the days compared. More days will make this clearer.</p></article>
        )}
        {rest.length ? (
          <details className="limits"><summary>More comparisons ({rest.length})</summary><ul className="factors">{rest.map(f => {
            const i = insight(r, f);
            return (
              <li key={f.id}><div className="factorhead"><strong>{i ? i.headline : f.label}</strong><span className={`statechip small ${f.state}`}>{FACTOR_COPY[f.state]}</span></div>
                {f.state === 'insufficient' ? <p>{f.n[0]} vs {f.n[1]} days so far · needs {r.minGroup} on each side</p> : bars(f)}
                {i && i.step ? <Btn act="disc-try" val={f.id} data={{ obs: obs.id }} cls="quiet">{`Try: ${i.step.title}`}</Btn> : null}</li>
            );
          })}</ul></details>
        ) : null}
        <p className="soft findnote">Based on {plural(r.validDays, 'day')} with a check-in. Averages show what went together, not what caused it. A small step is how you find out.{r.usedSample ? ' Includes sample records.' : ''}</p></>
    );
  }
  return (
    <><BestDayHero obs={obs} /><ReadinessBlock obs={obs} />
      <details className="limits"><summary>What Discovery needs</summary>
        <dl className="havemiss"><div><dt>Have</dt><dd>{have.join(' · ')}</dd></div>{need.length ? <div><dt>Still needed</dt><dd>{need.join(' · ')}</dd></div> : null}</dl>
        <p className="soft">Only days with a 1–5 answer count, with at least {r.minGroup} days on each side of a comparison.</p></details></>
  );
}

// ---------- overlay chart ----------
interface Series { key: string; label: string; color: string; unit: string; scale?: number; band?: boolean; ticks?: { v: number; label: string }[]; values: (number | boolean | null)[]; marks?: (string | null)[]; reading: string; source: string }
function Overlay({ dates, series, selected, focus, selectedLabel }: { dates: string[]; series: Series[]; selected: number; focus: string; selectedLabel: string }) {
  const n = dates.length, base = 262, amp = 220;
  const x = (i: number) => 12 + (n === 1 ? 0 : i * 336 / (n - 1));
  const half = n === 1 ? 168 : 168 / (n - 1);
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (!ui.chartPlayed && ref.current) { ref.current.classList.add('chart-enter'); ui.chartPlayed = true; } }, []);
  const band = (t: Series) => {
    const on = focus === 'all' || focus === t.key;
    return (
      <g key={t.key} data-series={t.key} opacity={on ? 1 : 0.35}>{t.values.map((v, i) => v ? (
        <g key={i}><rect x={Math.max(12, x(i) - half)} y={22} width={Math.min(348, x(i) + half) - Math.max(12, x(i) - half)} height={base - 22} fill={t.color} fillOpacity={focus === t.key ? 0.26 : 0.14} /><circle cx={x(i)} cy={30} r={3} fill={t.color} /></g>
      ) : null)}</g>
    );
  };
  const shape = (t: Series) => {
    if (t.band) return band(t);
    const y = (v: number) => base - v / t.scale! * amp;
    const runs: [number, number][][] = []; let run: [number, number][] = [];
    t.values.forEach((v, i) => { if (v === null || v === undefined) { if (run.length) runs.push(run); run = []; } else run.push([x(i), y(v as number)]); });
    if (run.length) runs.push(run);
    const line = (pts: [number, number][]) => pts.reduce((d, p, i) => i ? d + ` C ${(pts[i - 1][0] + p[0]) / 2} ${pts[i - 1][1]}, ${(pts[i - 1][0] + p[0]) / 2} ${p[1]}, ${p[0]} ${p[1]}` : `M ${p[0]} ${p[1]}`, '');
    const on = focus === 'all' || focus === t.key;
    return (
      <g key={t.key} data-series={t.key} opacity={on ? 1 : 0.14}>
        {runs.map((r, k) => (
          <g key={k}>
            {r.length > 1 ? <><path d={`${line(r)} L ${r.at(-1)![0]} ${base} L ${r[0][0]} ${base} Z`} fill={`url(#wash-${t.key})`} /><path d={line(r)} fill="none" stroke={t.color} strokeWidth="2" /></> : null}
            {r.map(p => <circle key={p[0]} cx={p[0]} cy={p[1]} r={p[0] === x(selected) ? 4 : 2} fill={t.color} />)}
          </g>
        ))}
        {focus === t.key ? (t.marks || []).map((m, i) => m ? <text key={i} x={x(i)} y={base - 6} textAnchor="middle" fill={t.color} fontSize="11">{m === 'unknown' ? '?' : '–'}</text> : null) : null}
      </g>
    );
  };
  const f = series.find(s => s.key === focus && !s.band);
  const sx = x(selected);
  return (
    <svg ref={ref} className="overlayplot" viewBox="0 0 360 292" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label={`${series.map(s => `${s.label} ${s.unit}`).join(', ')} on a shared date axis. Each signal has its own scale; heights are not comparable across signals. Missing records are gaps.`}>
      <defs>{series.map(t => <linearGradient key={t.key} id={`wash-${t.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.color} stopOpacity=".48" /><stop offset="100%" stopColor={t.color} stopOpacity=".025" /></linearGradient>)}</defs>
      {dates.map((d, i) => <line key={d} x1={x(i)} x2={x(i)} y1={22} y2={base} stroke="#ffffff" strokeOpacity=".1" />)}
      {f ? f.ticks!.map(t => { const yy = base - t.v / f.scale! * amp; return <g key={t.v}><line x1={12} x2={348} y1={yy} y2={yy} stroke="#ffffff" strokeOpacity=".08" /><text x={14} y={yy - 5} fill={f.color} fontSize="10" opacity=".9">{t.label}</text></g>; }) : null}
      {series.filter(t => t.band).map(shape)}{series.filter(t => !t.band && t.key !== focus).map(shape)}{series.filter(t => !t.band && t.key === focus).map(shape)}
      <line x1={sx} x2={sx} y1={18} y2={base + 4} stroke="#f6eedc" strokeOpacity=".7" />
      <text x={sx} y={284} textAnchor={selected === 0 ? 'start' : selected === n - 1 ? 'end' : 'middle'} fill="#f6eedc" fontSize="10">{selectedLabel}</text>
    </svg>
  );
}

export function RecordRow({ kind, r }: { kind: 'checkin' | 'entry'; r: Checkin | Entry }) {
  const editable = r.source !== 'sample';
  if (kind === 'checkin') {
    const c = r as Checkin, tt = topic(c.topicId);
    return (
      <article className="recordrow"><div><strong>{tt.name}</strong><small>{timeOf(c.occurredAt)} · {checkinStatus(c, c.topicId)} <SourceTag source={c.source} />{c.editedAt ? <> <span className="badge">Edited</span></> : null}</small>{c.note ? <p>{c.note}</p> : null}</div>
        {editable ? <Btn act="open" val="checkin" data={{ obs: c.observationId, rec: c.id }} cls="quiet" label={`Edit ${tt.name} check-in at ${timeOf(c.occurredAt)}`}>Edit</Btn> : null}</article>
    );
  }
  const e = r as Entry;
  const extra = e.kind === 'caffeine' && e.mg !== null && e.mg !== undefined ? ` · ${e.mg} mg` : '';
  return (
    <article className="recordrow">{e.photoUrl ? <img src={e.photoUrl} alt={`Photo for ${e.name}`} /> : null}
      <div><strong>{e.name}</strong><small>{timeOf(e.occurredAt)} · {e.kind === 'caffeine' ? 'Caffeine' : 'Food'}{extra} <SourceTag source={e.source} />{e.extracted ? <> <span className="badge">From photo · confirmed</span></> : null}{e.editedAt ? <> <span className="badge">Edited</span></> : null}</small>{e.size || e.note ? <p>{[e.size, e.note].filter(Boolean).join(' · ')}</p> : null}</div>
      {editable ? <Btn act="open" val={e.kind} data={{ rec: e.id }} cls="quiet" label={`Edit ${e.name}`}>Edit</Btn> : null}</article>
  );
}

export function Explore() {
  const s = S();
  const obs = activeObservations(s);
  if (!obs.find(o => o.id === ui.explore.obsId)) ui.explore.obsId = obs[0]?.id || null;
  const o = obs.find(x => x.id === ui.explore.obsId) || null;
  const end = today();
  const dates = dateRange(addDays(end, -(ui.explore.range - 1)), end);
  if (!ui.explore.date || !dates.includes(ui.explore.date)) ui.explore.date = end;
  const day = ui.explore.date;
  const sel = dates.indexOf(day);
  const t = o ? topic(o.topicId) : null;
  const withSample = s.dataSource === 'sample';
  const hd = dates.map(d => daily(s, d, end));
  const srcName = sourceLabel(s.dataSource, s.healthImport);
  const dayH = hd[sel];
  const recs = dayRecords(s, day);
  const focus = ui.explore.metric || 'all';
  const ov: Series[] = [];
  let dayChk: Checkin | null = null;
  if (o && t) {
    const chk = dates.map(d => dayCheckin(s, o.id, d, { includeSample: withSample }));
    dayChk = chk[sel];
    ov.push({
      key: 'feeling', label: t.name, color: '#ffba79', unit: `1–5, ${t.higherIsBetter ? 'higher = more' : 'higher = sleepier'}`, scale: 5,
      ticks: [{ v: 1, label: `1 ${t.labels[0]}` }, { v: 3, label: `3 ${t.labels[2]}` }, { v: 5, label: `5 ${t.labels[4]}` }],
      values: chk.map(c => c && c.status === 'recorded' ? c.score : null), marks: chk.map(c => c && c.status !== 'recorded' ? c.status : null),
      reading: checkinStatus(dayChk, o.topicId) || 'No check-in', source: dayChk ? (dayChk.source === 'sample' ? 'Sample' : 'Your check-in') : ''
    });
  }
  ov.push({ key: 'sleep', label: 'Sleep', color: '#b49aff', unit: '0–10 hours', scale: 10, ticks: [{ v: 0, label: '0 h' }, { v: 5, label: '5 h' }, { v: 10, label: '10 h' }], values: hd.map(x => x.sleep), reading: dayH.sleep === null ? 'No record' : dayH.sleep + ' h', source: srcName });
  ov.push({ key: 'activity', label: 'Movement', color: '#66cddd', unit: '0–60 minutes', scale: 60, ticks: [{ v: 0, label: '0 min' }, { v: 30, label: '30 min' }, { v: 60, label: '60+ min' }], values: hd.map(x => x.activity === null ? null : Math.min(60, x.activity)), reading: dayH.activity === null ? 'No record' : dayH.activity + ' min', source: srcName });
  if (s.dataSource !== 'none' && s.healthTypes.cycle) ov.push({ key: 'cycle', band: true, label: 'Period', color: '#f29bb5', unit: 'dates only, no phase prediction', values: hd.map(x => !!x.cycle), reading: dayH.cycle ? 'Recorded' : '—', source: srcName });
  const focusSeries = ov.find(x => x.key === focus);
  const datesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = datesRef.current, el = strip?.querySelector<HTMLElement>('.selected');
    if (strip && el) strip.scrollLeft = el.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
  });
  const needCheckin = o && !dayChk && day <= end;
  return (
    <main className="explore-full"><div className="pagehead"><h1>Explore</h1></div>
      <div className="obschips" role="tablist" aria-label="Observation">
        {obs.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === ui.explore.obsId} onClick={e => dispatch('exp-obs', x.id, {}, e.currentTarget)}>{topic(x.topicId).name}</button>)}
        {obs.length < TOPIC_IDS.length ? <Btn act="open" val="addobs" cls="chipadd" label="Add an observation">＋</Btn> : null}
      </div>
      <section className="focuschart layeredchart" aria-label="Timeline">
        {focusSeries ? <p className="chartintro">{focusSeries.label} · {focusSeries.unit}</p> : null}
        <div className="overlaytabs" aria-label="Highlight a signal">
          {[{ key: 'all', label: 'All signals', color: '#fff' }, ...ov].map(x => <button key={x.key} type="button" aria-pressed={focus === x.key} style={{ ['--signal' as string]: x.color }} onClick={e => dispatch('exp-metric', x.key, {}, e.currentTarget)}><i />{x.label}</button>)}
        </div>
        <div className="dateaxis overlaydates" ref={datesRef}>
          {dates.map(d => <button key={d} type="button" className={d === day ? 'selected' : ''} aria-pressed={d === day} aria-label={fmtDay(d)} onClick={e => dispatch('exp-date', d, {}, e.currentTarget)}><small>{new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short' })}</small>{d.slice(8)}</button>)}
        </div>
        <Overlay dates={dates} series={ov} selected={sel} focus={focus} selectedLabel={day === end ? 'TODAY' : day.slice(5)} />
        <div className="rangeseg" role="group" aria-label="Days shown">{[7, 14].map(n => <button key={n} type="button" aria-pressed={ui.explore.range === n} onClick={e => dispatch('exp-range-set', String(n), {}, e.currentTarget)}>{n} days</button>)}</div>
      </section>
      <section className="chart-details"><p className="readingdate">{fmtDay(day)}{day === end ? ' · Today' : ''}</p>
        <div className={`signalreadings ${ov.length > 3 ? 'four' : ''}`}>
          {ov.map(x => <div key={x.key} style={{ ['--signal' as string]: x.color, opacity: focus === 'all' || focus === x.key ? 1 : 0.45 }}><span><i />{x.label}</span><strong>{x.reading}</strong>{x.source === 'Sample' ? <small>Sample</small> : null}</div>)}
        </div>
        {needCheckin ? <Btn act="open" val="checkin" data={{ obs: o!.id, date: day }} cls="smallaction wide">{`Check in for ${day === end ? 'today' : fmtDate(day)}`}</Btn> : null}
        <details className="chartscales"><summary>How to read this</summary><ul className="notes"><li>Each signal has its own scale{o ? `: ${t!.name} 1–5` : ''}, sleep 0–10 h, movement 0–60 min.</li><li>Pink columns are period dates.</li><li>Curves moving together don’t mean they’re related.</li></ul></details>
      </section>
      {o ? <section className="discovery" aria-label="Discovery"><DiscoveryDetail obs={o} /></section> : null}
      {day === end ? null : (
        <>
          <div className="sectionlabel" id="records"><h2>{fmtDate(day)} records</h2><Btn act="open" val="caffeine" data={{ date: day }} cls="quiet">＋ Caffeine</Btn></div>
          <div className="dayevents">{recs.length ? recs.map(x => <RecordRow key={x.r.id} kind={x.kind} r={x.r} />) : <p className="soft">Nothing recorded.</p>}
            {dayH.cycle ? <article className="recordrow"><div><strong>Period date recorded</strong><small>{srcName} · date only</small></div></article> : null}</div>
        </>
      )}
      <div className="srcrow"><span>Sleep & movement · <b>{srcName}</b></span><Btn act="open" val="data" cls="quiet">Manage</Btn></div>
    </main>
  );
}
