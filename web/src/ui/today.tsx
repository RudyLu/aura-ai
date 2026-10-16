'use client';
// Today (ported from views.js home()).
import { useEffect, useRef } from 'react';
import { addDays, dateRange, fmtDay } from '@/domain/dates';
import { analyze, findings } from '@/domain/uiDiscovery';
import { activeObservations, currentPlans, dayCheckin, observation, userGoals, type Checkin, type Entry, type Observation, type Plan, type State } from '@/domain/state';
import { topic } from '@/domain/topics';
import { AuraMark, Btn, checkinStatus, GEAR, goalArt, LOG_ART, plural, Raw, ScaleSlider } from './core';
import { dispatch } from './actions';
import { render, S, today, ui } from './store';

export const PLAN_STATUS: Record<string, string> = { active: 'Current step', observing: 'Observing only', stopped: 'Stopped', replaced: 'Replaced by a newer version' };
export const reviewOn = (p: Plan) => (today() >= p.review ? 'Review due' : `Review on ${new Date(p.review + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}`);
const timeOf = (iso: string) => iso.slice(11, 16);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Records for one day (check-ins, food, caffeine), oldest first.
export function dayRecords(s: State, day: string) {
  const withSample = s.dataSource === 'sample';
  return [
    ...s.checkins.filter(c => c.date === day && (c.source !== 'sample' || withSample)).map(c => ({ kind: 'checkin' as const, at: c.occurredAt, r: c })),
    ...s.entries.filter(e => e.date === day && (e.source !== 'sample' || withSample)).map(e => ({ kind: 'entry' as const, at: e.occurredAt, r: e }))
  ].sort((a, b) => a.at.localeCompare(b.at));
}

// Decide the single most useful thing to do now.
type Next = { kind: 'checkin' | 'later'; obs: Observation } | { kind: 'plan'; plan: Plan } | { kind: 'done' };
function nextUp(s: State): Next {
  const obs = activeObservations(s);
  const now = new Date().toTimeString().slice(0, 5);
  const pending = obs.filter(o => !dayCheckin(s, o.id, today())).sort((a, b) => a.time.localeCompare(b.time));
  const due = pending.filter(o => o.time <= now);
  if (due.length) return { kind: 'checkin', obs: due[0] };
  const p = currentPlans(s).find(x => x.status === 'active' && x.start <= today() && !s.feedbacks.some(f => f.planId === x.id && f.date === today()));
  if (p) return { kind: 'plan', plan: p };
  if (pending.length) return { kind: 'later', obs: pending[0] };
  return { kind: 'done' };
}

function QuickScale({ o }: { o: Observation }) {
  const v = ui.quick[o.id];
  return (
    <>
      <ScaleSlider topicId={o.topicId} choice={v} ctx="quick" obs={o.id} />
      <div className="quickactions">
        <Btn act="quick-save" data={{ obs: o.id }} disabled={!v}>Save check-in</Btn>
        <Btn act="open" val="checkin" data={{ obs: o.id, choice: v, keepDate: '1' }} cls="text quicknote">Add a note</Btn>
      </div>
    </>
  );
}

// Today hero: the week as dots on an arc, then the one thing to do now underneath.
function RingHero({ o }: { o: Observation }) {
  const s = S();
  const days = dateRange(addDays(today(), -6), today());
  const t = topic(o.topicId);
  const r = analyze(s, o, today());
  const cx = 160, cy = 168, R = 132;
  const start0 = (o.createdAt || '').slice(0, 10);
  const pt = (deg: number, rad: number) => [cx + rad * Math.cos(deg * Math.PI / 180), cy + rad * Math.sin(deg * Math.PI / 180)];
  const found = r.state === 'ready' ? findings(r).length : 0;
  const [ax, ay] = pt(198, R), [bx, by] = pt(342, R);
  return (
    <div className="ringhero" role="group" aria-label={`${t.name}, last 7 days`}>
      <svg viewBox="0 -14 320 200" aria-hidden="true">
        <path d={`M ${ax.toFixed(1)} ${ay.toFixed(1)} A ${R} ${R} 0 0 1 ${bx.toFixed(1)} ${by.toFixed(1)}`} className="rtrack" />
        {days.map((d, i) => {
          const a = 198 + i * (144 / 6);
          const [x, y] = pt(a, R), [lx, ly] = pt(a, R + 26);
          const c = dayCheckin(s, o.id, d);
          const cls = c ? (c.status === 'recorded' ? `on s${c.score}` : 'meh') : d < start0 ? 'pre' : 'empty';
          const wd = new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'narrow' });
          return (
            <g key={d} className={`rdot ${cls} ${d === today() ? 'now' : ''}`}>
              <title>{`${fmtDay(d)}: ${c ? checkinStatus(c, o.topicId) : 'No check-in'}`}</title>
              {d === today() ? <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="17" className="nowring" /> : null}
              <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="12" />
              {c && c.status === 'recorded' ? <text x={x.toFixed(1)} y={(y + 4.5).toFixed(1)}>{c.score}</text> : null}
              <text className="wd" x={lx.toFixed(1)} y={(ly + 4).toFixed(1)}>{wd}</text>
            </g>
          );
        })}
      </svg>
      <div className="ringcenter"><p className="eyebrow">{t.name}</p>
        {r.state !== 'ready'
          ? <><b>{r.validDays}<small>/{r.minDays}</small></b><span>days to your first findings</span></>
          : found ? <><b>{found}</b><span>{found === 1 ? 'finding' : 'findings'} from your records</span></> : <><b>{r.validDays}</b><span>days recorded</span></>}
        {r.state === 'ready' ? <button type="button" className="ringlink" onClick={e => dispatch('tab', 'explore', {}, e.currentTarget)}>See in Explore ›</button> : null}
      </div>
    </div>
  );
}

function NextCard({ n }: { n: Next }) {
  const s = S();
  const obs = activeObservations(s);
  let o: Observation | undefined, action: React.ReactNode;
  if (n.kind === 'checkin' || n.kind === 'later') {
    o = n.obs;
    const t = topic(o.topicId);
    action = <><p className="eyebrow">{n.kind === 'checkin' ? 'Now' : `Later today · ${o.time}`}</p><h2 id="h-next">{t.question}</h2><QuickScale o={o} /></>;
  } else if (n.kind === 'plan') {
    const p = n.plan;
    o = observation(s, p.observationId) || obs[0];
    const days = dateRange(p.start, p.review);
    const fbDays = new Set(s.feedbacks.filter(f => f.planId === p.id).map(f => f.date));
    const dayN = Math.min(days.length, days.indexOf(today()) + 1 || days.length);
    action = (
      <><p className="eyebrow">Your step · {today() >= p.review ? 'Review day' : `Day ${dayN} of ${days.length}`}</p><h2 id="h-next">{p.title}</h2>
        <ol className="stepdots" aria-label={`${fbDays.size} of ${days.length} days with feedback`}>{days.map(d => <li key={d} className={`${fbDays.has(d) ? 'on' : ''} ${d === today() ? 'now' : ''}`} />)}</ol>
        {today() >= p.review ? <Btn act="open" val="review" data={{ plan: p.id }}>Review your step</Btn> : <Btn act="feedback" data={{ plan: p.id }}>How did it go today?</Btn>}</>
    );
  } else {
    o = obs[0];
    const next = o ? [...obs].sort((a, b) => a.time.localeCompare(b.time))[0] : null;
    action = <div className="donerow"><AuraMark size="aura-small" /><div><h2 id="h-next">All done for today.</h2>{next ? <p className="herosub">Next: {topic(next.topicId).name.toLowerCase()}, tomorrow at {next.time}</p> : null}</div></div>;
  }
  return <section className="todayhero" aria-labelledby="h-next">{o ? <RingHero o={o} /> : null}<div className="heroaction">{action}</div></section>;
}

// Your day: a time-of-day strip with everything logged today, and one card per kind.
function LogSection() {
  const s = S();
  const recs = dayRecords(s, today());
  const H0 = 5, PX = 46; // 05:00 onwards, px per hour
  const xOf = (iso: string) => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return Math.max(0, (h + m / 60 - H0)) * PX; };
  const now = new Date(); const nowX = Math.max(0, (now.getHours() + now.getMinutes() / 60 - H0) * PX);
  const rows: number[] = [];
  const tl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tl.current;
    if (el) el.scrollLeft = ui.dayAt ? (ui.dayAt.h - H0) * PX : nowX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    const el = tl.current!;
    const atNow = nowX - el.scrollLeft < PX / 12; // within 5 minutes
    if (atNow) { if (ui.dayAt) { ui.dayAt = null; render(); } return; }
    const h = H0 + el.scrollLeft / PX;
    const mins = Math.round(h * 60 / 5) * 5;
    const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    if (ui.dayAt?.time !== time) { ui.dayAt = { h, time }; render(); }
  };
  const label = ui.dayAt ? ui.dayAt.time : 'Now';
  const scrollLeft = tl.current?.scrollLeft ?? nowX;
  const items = recs.map(x => {
    const left = xOf(x.r.occurredAt);
    let row = 0; while (rows[row] !== undefined && left - rows[row] < 38) row++;
    rows[row] = left;
    const near = Math.abs(left - scrollLeft) < 26 ? 'near' : '';
    if (x.kind === 'checkin') {
      const r = x.r as Checkin;
      return (
        <button key={r.id} type="button" className={`tlitem ${near}`} style={{ left, top: row * 50 }} aria-label={`${topic(r.topicId).name} at ${timeOf(r.occurredAt)}, edit`}
          onClick={e => dispatch('open', 'checkin', { obs: r.observationId, rec: r.id }, e.currentTarget)}>
          <span className={`tlface score s${r.score || 0} ${r.status !== 'recorded' ? 'meh' : ''}`}>{r.status === 'recorded' ? r.score : '–'}</span><small>{timeOf(r.occurredAt)}</small>
        </button>
      );
    }
    const r = x.r as Entry;
    return (
      <button key={r.id} type="button" className={`tlitem ${near}`} style={{ left, top: row * 50 }} aria-label={`${r.name} at ${timeOf(r.occurredAt)}, edit`}
        onClick={e => dispatch('open', r.kind, { rec: r.id }, e.currentTarget)}>
        {r.photoUrl ? <span className={`tlface ${r.kind}`}><img src={r.photoUrl} alt="" /></span> : <Raw cls={`tlface ${r.kind}`} html={LOG_ART[r.kind]} />}<small>{timeOf(r.occurredAt)}</small>
      </button>
    );
  });
  const height = rows.length ? rows.length * 50 : 18;
  const food = recs.filter(x => x.kind === 'entry' && (x.r as Entry).kind === 'food').map(x => x.r as Entry);
  const drinks = recs.filter(x => x.kind === 'entry' && (x.r as Entry).kind === 'caffeine').map(x => x.r as Entry);
  const card = (kind: 'food' | 'caffeine', title: string, body: React.ReactNode, sub: string) => (
    <button type="button" className={`kindcard ${kind}`} onClick={e => dispatch('open', kind, { fromDay: '1' }, e.currentTarget)}>
      <span className="kindtitle">{title}</span>{body}<span className="kindsub">{sub}</span><span className="kindadd" aria-hidden="true">＋</span>
    </button>
  );
  const foodBody = food.length
    ? <span className="kindbody"><span className="thumbs">{food.slice(-3).map(f => f.photoUrl ? <img key={f.id} src={f.photoUrl} alt="" /> : <Raw key={f.id} tag="i" html={LOG_ART.food} />)}</span></span>
    : <Raw cls="kindbody" html={LOG_ART.food} />;
  const cupBody = drinks.length ? <span className="kindbody"><span className="cups">{drinks.map(d => <i key={d.id} />)}</span></span> : <Raw cls="kindbody" html={LOG_ART.caffeine} />;
  return (
    <section className="logday" aria-labelledby="h-log">
      <div className="sechead"><h2 id="h-log">Your day</h2>{recs.length ? <small>{plural(recs.length, 'entry', 'entries')}</small> : null}</div>
      <div className={`daytlwrap ${ui.dayAt ? 'past' : ''}`}>
        <div className="daytl" ref={tl} onScroll={onScroll}>
          <div className="tlinner" style={{ width: Math.ceil(nowX), height: height + 34 }}>
            {[6, 9, 12, 15, 18, 21].filter(h => (h - H0) * PX < nowX - 30).map(h => <span key={h} className="tltick" style={{ left: (h - H0) * PX }}>{String(h).padStart(2, '0')}:00</span>)}
            {items}
          </div>
        </div>
        <div className="tlpin" aria-hidden="true"><span className="tlpinline" /><b className="tlpintime">{label}</b></div>
      </div>
      <p className="tlhint" aria-live="polite">Slide the day to pick a time · logging at <b className="tlat">{ui.dayAt ? label : 'now'}</b></p>
      {recs.length ? null : <p className="soft logempty">Nothing yet today. Add a meal or a coffee below.</p>}
      <div className="kindcards">
        {card('food', 'Food', foodBody, food.length ? `${plural(food.length, 'meal')} today` : 'Add a meal')}
        {card('caffeine', 'Caffeine', cupBody, drinks.length ? `${plural(drinks.length, 'drink')} · last ${timeOf(drinks.at(-1)!.occurredAt)}` : 'Add a drink')}
        <button type="button" className="kindcard aura" onClick={e => dispatch('tab', 'aura', {}, e.currentTarget)}><span className="kindtitle">Aura</span><span className="kindbody"><AuraMark size="aura-small" /></span><span className="kindsub">Talk it through</span></button>
      </div>
    </section>
  );
}

function ObsRow({ o }: { o: Observation }) {
  const t = topic(o.topicId);
  return <li className="row"><span className="dot" aria-hidden="true" /><span className="rowtext"><strong>{t.name}</strong><small>{o.time}</small></span><Btn act="open" val="checkin" data={{ obs: o.id }} cls="smallaction">Check in</Btn></li>;
}
function PlanRow({ p }: { p: Plan }) {
  const done = S().feedbacks.some(f => f.planId === p.id && f.date === today());
  const action = today() >= p.review
    ? <Btn act="open" val="review" data={{ plan: p.id }} cls="smallaction">Review</Btn>
    : p.status === 'active'
      ? <Btn act="feedback" data={{ plan: p.id }} cls={done ? 'quiet' : 'smallaction'}>{done ? 'Edit' : 'How did it go?'}</Btn>
      : <Btn act="open" val="review" data={{ plan: p.id }} cls="quiet">Details</Btn>;
  return (
    <li className="row step"><span className="dot step" aria-hidden="true" />
      <button type="button" className="rowtext linkish" onClick={e => dispatch('open', 'review', { plan: p.id }, e.currentTarget)}><strong>{p.title}</strong><small>{p.status === 'observing' ? 'Observing only' : done ? 'Feedback added' : 'Your step'} · {reviewOn(p)}</small></button>{action}
    </li>
  );
}

// Top of Today: the goals the user chose in setup.
function GoalHeader() {
  const s = S();
  const goals = userGoals(s);
  const gear = <button type="button" className="gear" aria-label="Settings" onClick={e => dispatch('open', 'settings', {}, e.currentTarget)} dangerouslySetInnerHTML={{ __html: GEAR }} />;
  if (!goals.length) return <div className="greeting goalhead"><div className="goaltop"><p>{greeting()}, Alex</p>{gear}</div><h1>Make room<br />for yourself.</h1></div>;
  const more = goals.slice(1);
  return (
    <div className="greeting goalhead">
      <div className="goaltop"><p>{greeting()}, Alex</p>{gear}</div>
      <div className="goalmain"><Raw cls="goaltile" html={goalArt(goals[0].group, 64)} /><div><p className="goallabel">Your main goal</p><h1>{goals[0].label}</h1></div></div>
      {more.length ? (
        <div className={`moregoals ${ui.goalsOpen || more.length > 2 ? 'overflows' : ''}`}>
          <span className="morelabel">Also working on</span>
          <ul className={`goaltags ${ui.goalsOpen ? 'open' : 'clamp'}`} id="goaltags">
            {more.map(g => <li key={g.id}>#{g.label.charAt(0).toLowerCase() + g.label.slice(1)}<Btn act="goal-remove" val={g.id} cls="" label={`Remove goal: ${g.label}`}>×</Btn></li>)}
          </ul>
          <button type="button" className="seeall" aria-controls="goaltags" aria-expanded={ui.goalsOpen} onClick={e => dispatch('goals-toggle', undefined, {}, e.currentTarget)}>{ui.goalsOpen ? 'Show less' : `See all (${more.length})`}</button>
        </div>
      ) : null}
    </div>
  );
}

// All executed comparisons remain available; no largest-gap action is promoted.
function FindingCard() {
  const available = activeObservations(S()).filter(o => analyze(S(),o,today()).state === 'ready');
  if (!available.length) return null;
  return <section className="todayfinding" aria-labelledby="h-find"><p className="eyebrow">From your records</p><h2 id="h-find">Explore your comparisons</h2><p>See all available comparisons, counts and limits. These records don’t establish causes.</p>{available.map(o=><Btn key={o.id} act="goexplore" data={{obs:o.id}} cls="quiet">{topic(o.topicId).name}</Btn>)}</section>;
}

export const TOPIC_HUES: Record<string, string> = { 'evening-energy': '#ffba79', 'rested-waking': '#e6cf8f', 'afternoon-sleepiness': '#c3a6d9', stress: '#9fb4e0', productivity: '#9ccfb8' };
export function Today() {
  const s = S(), obs = activeObservations(s), plans = currentPlans(s);
  const p = plans.find(p => p.status === 'active') || plans[0];
  const pending = obs.filter(o => !dayCheckin(s, o.id, today()));
  const focus = pending.sort((a,b) => a.time.localeCompare(b.time))[0];
  const left = pending.length + (p?.status === 'active' && today() < p.review && !s.feedbacks.some(f => f.planId === p.id && f.date === today()) ? 1 : 0);
  const total = obs.length + (p?.status === 'active' ? 1 : 0);
  const progress = total ? (total-left)/total : 1;
  const days = p ? dateRange(p.start, p.review) : [], dayN = Math.min(days.length, Math.max(1, days.indexOf(today())+1));
  const recs = dayRecords(s, today());
  const light = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sweep=light.current, heading=sweep?.parentElement?.querySelector('.todayhead');
    if (!sweep || ui.todaySweepDone || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    sweep.classList.add('play'); heading?.classList.add('energized');
    const titleTimer=setTimeout(()=>heading?.classList.remove('energized'),2600);
    const settleTimer=setTimeout(()=>{sweep.classList.remove('play');ui.todaySweepDone=true;},3200);
    return ()=>{clearTimeout(titleTimer);clearTimeout(settleTimer);sweep.classList.remove('play');heading?.classList.remove('energized');};
  }, []);
  return <main className="today todayA">
    <div ref={light} className="daysweep" style={{ ['--p' as string]: Math.max(.25,progress) }} aria-hidden="true"><span className="dswash" /><span className="dscore" /><span className="dsstreak" /></div><div className="todaysky" aria-hidden="true"><span className="stars" /></div>
    {s.demo ? <button type="button" className="demochip" onClick={e => dispatch('open','demo',{},e.currentTarget)}>Demo timeline · Day {s.demo.day} <span>Change</span></button> : null}
    <div className="pagehead todayhead"><div className="todaytop"><p className="eyebrow">Today · {new Date().toLocaleDateString('en',{weekday:'short',day:'2-digit'})}</p><button className="gear" aria-label="Settings" onClick={e => dispatch('open','settings',{},e.currentTarget)} dangerouslySetInnerHTML={{__html:GEAR}} /></div>
      <h1>{left ? `${['No','One','Two','Three','Four','Five','Six'][left] || left} ${left === 1 ? 'thing' : 'things'} left` : 'All done for today'}{left && obs[0] ? <> for your <em style={{color:TOPIC_HUES[obs[0].topicId]}}>{topic(obs[0].topicId).construct.toLowerCase()}</em></> : null}</h1>
    </div>
    <section className="chartcard tcard" aria-labelledby="h-check"><div className="chartcardhead"><h2 id="h-check">Check in</h2><small>{focus ? `${focus.time} · ${topic(focus.topicId).name}` : 'All done'}</small></div>
      {focus ? <><p className="checkq">{topic(focus.topicId).question}</p><QuickScale o={focus} /></> : <p className="soft checkdone">Everything checked in today.</p>}
      {pending.length > 1 ? <ul className="rows">{pending.filter(o => o !== focus).map(o => <ObsRow key={o.id} o={o}/>)}</ul> : null}
      <ul className="donelist">{obs.filter(o => !!dayCheckin(s,o.id,today())).map(o => { const c = dayCheckin(s,o.id,today())!; return <li key={o.id}><i className="hue" style={{background:TOPIC_HUES[o.topicId]}}/><span>{topic(o.topicId).name}</span><b>{c.status === 'recorded' ? `${c.score}/5` : c.status}</b><Btn act="open" val="checkin" data={{obs:o.id,rec:c.id}} cls="quiet">Edit</Btn></li>; })}</ul>
    </section>
    {p ? <section className="chartcard tcard" aria-labelledby="h-step"><div className="chartcardhead"><h2 id="h-step">Your step</h2><small>{today() >= p.review ? 'Review day' : `Day ${dayN} of ${days.length}`}</small></div><div className="stepbar tbar"><i style={{width:`${dayN/Math.max(days.length,1)*100}%`}} /></div><p className="tstep">{p.title}</p><div className="tactions"><Btn act={today() >= p.review ? 'open' : 'feedback'} val="review" data={{plan:p.id}} cls="pillbtn">{today() >= p.review ? 'Review your step' : 'How did it go?'}</Btn><Btn act="open" val="history" cls="pillbtn ghost">History</Btn></div></section> : null}
    <section className="chartcard tcard" aria-labelledby="h-recs"><div className="chartcardhead"><h2 id="h-recs">Today’s records</h2><small>{recs.length ? `${recs.length} so far` : 'Nothing yet'}</small></div>
      <ul className="reclist">{recs.map(x => { const r = x.r, chk = x.kind === 'checkin' ? r as Checkin : null, e = r as Entry; return <li key={r.id}><button className="recrow" onClick={ev => dispatch('open',chk ? 'checkin' : e.kind,{rec:r.id,obs:chk?.observationId},ev.currentTarget)}><time>{timeOf(r.occurredAt)}</time><span className={`ric ${chk?.status === 'recorded' ? 'recordglow' : ''}`}>{chk ? <b>{chk.score || '–'}</b> : e.photoUrl ? <img src={e.photoUrl} alt=""/> : <Raw html={LOG_ART[e.kind]}/>}</span><span className="recname"><span className="rn">{chk ? topic(chk.topicId).name : e.name}</span><OriginTag origin={r.origin}/></span><small>{chk ? checkinStatus(chk,chk.topicId) : e.kind === 'food' ? 'Food' : 'Caffeine'}</small></button></li>; })}</ul>
      {!recs.length ? <p className="soft recempty">Add a meal or a drink when it happens.</p> : null}
      <div className="tactions"><Btn act="open" val="food" cls="pillbtn ghost">＋ Food</Btn><Btn act="open" val="caffeine" cls="pillbtn ghost">＋ Drink</Btn><Btn act="tab" val="aura" cls="pillbtn ghost">Talk to Aura</Btn></div>
    </section>
    <FindingCard />
  </main>;
}
export function OriginTag({ origin }: { origin?: string }) { return origin === 'synthetic' ? <span className="badge synth">Synthetic</span> : origin === 'demo-live' ? <span className="badge live">Added during demo</span> : null; }
