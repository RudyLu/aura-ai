'use client';
// Bottom sheets (ported from sheets.js and demo.js sheet()).
import { useEffect, useRef } from 'react';
import { addDays, daysBetween, dateRange, fmtDate, fmtDay, localDateTime } from '@/domain/dates';
import { analyze, factorsFor, findings, MIN_DAYS } from '@/domain/discovery';
import { SCENARIOS } from '@/domain/demo';
import { daily, healthSummary } from '@/domain/health';
import { activeObservations, currentPlans, dayCheckin, observation, plan as findPlan } from '@/domain/state';
import { CONCERNS, topic, TOPIC_IDS } from '@/domain/topics';
import { Btn, CHECK, checkinStatus, ErrorLine, flower, goalArt, Option, Raw, ScalePreview, ScaleSlider } from './core';
import { dispatch, pickDeviceFile, SAMPLE_PHOTOS } from './actions';
import { HealthImportControls } from './onboarding';
import { PLAN_STATUS } from './today';
import { S, today, ui } from './store';

const BARRIERS = ['Overtime', 'Plans changed', 'Logging was inconvenient', 'The step was too difficult', 'Felt unwell', 'Other'];
const EXECUTION = ['Done', 'Partly done', 'Not done', 'Not sure'];
const CHANGE = ['Not answered', 'Better', 'About the same', 'Worse', 'Not sure'];
const DRINKS = ['Coffee', 'Espresso', 'Latte or cappuccino', 'Black tea', 'Green tea', 'Energy drink', 'Other'];

function AnswerOptions({ topicId, choice, act }: { topicId: string; choice: string | null | undefined; act: 'pick-answer' | 'fb-answer' }) {
  const t = topic(topicId);
  const opt = (v: string, label: string) => <button type="button" aria-pressed={choice === v} className={`altanswer ${choice === v ? 'selected' : ''}`} onClick={e => dispatch(act, v, {}, e.currentTarget)}>{label}</button>;
  return (
    <>
      <ScaleSlider topicId={topicId} choice={choice} ctx={act === 'fb-answer' ? 'fb' : 'checkin'} />
      <div className="altanswers" role="group" aria-label="Other answers">{opt('unknown', 'Not sure')}{opt('skipped', 'Skip today')}</div>
      {t.higherIsBetter ? null : <p className="soft center">{t.direction}</p>}
    </>
  );
}

// ---------- check-in (create or correct) ----------
function CheckinSheet() {
  const o = observation(S(), ui.m.obsId)!;
  const t = topic(o.topicId);
  const rec = ui.m.recId ? S().checkins.find(c => c.id === ui.m.recId) : null;
  if (ui.m.choice === undefined) ui.m.choice = rec ? (rec.status === 'recorded' ? String(rec.score) : rec.status) : null;
  const when = rec ? rec.occurredAt : (ui.m.date && ui.m.date !== today() ? `${ui.m.date}T${o.time}` : localDateTime());
  return (
    <>
      <p className="eyebrow">{t.name} · {rec ? 'Correct a record' : 'Check-in'}</p><h2>{t.question}</h2><p className="timingline">{t.dateRule}</p>
      <AnswerOptions topicId={o.topicId} choice={ui.m.choice} act="pick-answer" />
      <label className="inputlabel">When<input id="chk-time" type="datetime-local" defaultValue={when} max={localDateTime()} /></label>
      <label className="inputlabel">Note <small>Optional</small><input id="chk-note" defaultValue={rec?.note || ui.m.note || ''} placeholder="A late meeting, a workout, a coffee…" /></label>
      {rec?.source === 'plan feedback' ? <p className="soft">This answer came from step feedback. Correcting it here updates both.</p> : null}
      <Btn act="save-checkin">{rec ? 'Save correction' : 'Save check-in'}</Btn>
      {rec ? <Btn act="delete-record" data={{ kind: 'checkin', rec: rec.id }} cls="text danger">Delete this record</Btn> : null}
      <ErrorLine />
    </>
  );
}

// ---------- food & caffeine (create or correct) ----------
function FoodSheet() {
  const rec = ui.m.recId ? S().entries.find(e => e.id === ui.m.recId) : null;
  const photo = ui.m.photo || rec?.photoUrl;
  const x = ui.m.extraction;
  if (ui.m.picking) {
    return (
      <>
        <p className="eyebrow">Food & drinks</p><h2>Choose a photo</h2>
        <div className="photogrid">{SAMPLE_PHOTOS.map(p => <button key={p.id} type="button" className="photopick" aria-label={p.name} onClick={e => dispatch('pick-photo', p.id, {}, e.currentTarget)}><img src={p.src} alt="" /></button>)}</div>
        <label className="filebutton">From this device<input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) pickDeviceFile(f); }} /></label>
        <Btn act="photo-cancel" cls="text">Cancel</Btn>
        <ErrorLine />
      </>
    );
  }
  const k = `${ui.modalSeq}-${ui.m.fill || 0}`; // remount fields when the photo fills them
  return (
    <>
      <p className="eyebrow">Food & drinks{rec ? ' · Correct a record' : ''}</p><h2>What did you have?</h2>
      {photo ? (
        <>
          <button type="button" className="photoswap" aria-label="Change photo" onClick={e => dispatch('photo-pick-open', undefined, {}, e.currentTarget)}><img className="foodpreview" src={photo} alt="Selected food photo" /><span>Change</span></button>
          {ui.m.reading ? <p className="soft" role="status">Gemini is reading the photo…</p> : null}
          {x ? <div className="callout"><strong>Filled in from the photo.</strong> Check the details before saving.{x.confirm.length ? <><br /><small>Worth checking: {x.confirm.join(' · ')}</small></> : null}</div> : null}
          {ui.m.photoError ? <p className="soft">{ui.m.photoError}</p> : null}
        </>
      ) : (
        <div className="photobuttons">
          <label className="filebutton">Take a photo<input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) pickDeviceFile(f); }} /></label>
          <Btn act="photo-pick-open" cls="filebutton">Choose a photo</Btn>
        </div>
      )}
      <label className="inputlabel">Food or drink<input key={`n${k}`} id="food-name" defaultValue={rec?.name || ui.m.name || ''} placeholder="e.g. Sandwich and iced latte" /></label>
      <label className="inputlabel">When did you have it?<input id="food-time" type="datetime-local" defaultValue={rec?.occurredAt || ui.m.time || localDateTime()} /></label>
      <label className="inputlabel">Notes <small>Optional</small><input key={`o${k}`} id="food-note" defaultValue={rec?.note || ui.m.note || ''} placeholder="Anything you want to remember" /></label>
      {rec ? null : (
        <label className="permission"><div><strong>Includes a caffeinated drink</strong>{x && x.caffeinated === 'unsure' ? <small>Not sure from the photo. Please check.</small> : null}</div>
          <input key={`c${k}`} id="food-caffeine" type="checkbox" defaultChecked={!!ui.m.caffeine} /></label>
      )}
      <Btn act="save-food" disabled={ui.m.reading}>{rec ? 'Save correction' : 'Confirm and save'}</Btn>
      {rec ? <Btn act="delete-record" data={{ kind: 'entry', rec: rec.id }} cls="text danger">Delete this record</Btn> : null}
      <ErrorLine />
    </>
  );
}
function CaffeineSheet() {
  const rec = ui.m.recId ? S().entries.find(e => e.id === ui.m.recId) : null;
  const when = rec?.occurredAt || ui.m.time || (ui.m.date && ui.m.date !== today() ? `${ui.m.date}T12:00` : localDateTime());
  return (
    <>
      <p className="eyebrow">Caffeine{rec ? ' · Correct a record' : ''}</p><h2>A little context<br />for your cup.</h2>
      <label className="inputlabel">Drink<select id="drink-type" defaultValue={rec?.name || ui.m.drink || 'Coffee'}>{DRINKS.map(d => <option key={d}>{d}</option>)}</select></label>
      <label className="inputlabel">Serving / size<input id="drink-size" defaultValue={rec?.size || ui.m.size || ''} placeholder="e.g. 1 cup, 250 ml, or 2 shots" /></label>
      <label className="inputlabel">When did you drink it?<input id="drink-time" type="datetime-local" defaultValue={when} /></label>
      <label className="inputlabel">Caffeine amount <small>Optional, mg from a label</small><input id="drink-mg" type="number" min={0} max={2000} step="any" defaultValue={rec?.mg ?? ''} placeholder="Leave blank if unknown" /></label>
      <label className="inputlabel">Note <small>Optional</small><input id="drink-note" defaultValue={rec?.note || ''} /></label>
      <Btn act="save-drink">{rec ? 'Save correction' : 'Save drink'}</Btn>
      {rec ? <Btn act="delete-record" data={{ kind: 'entry', rec: rec.id }} cls="text danger">Delete this record</Btn> : null}
      <ErrorLine />
    </>
  );
}

// ---------- add observation ----------
function AddObsSheet() {
  const active = activeObservations(S()).map(o => o.topicId);
  const choices = TOPIC_IDS.filter(id => !active.includes(id));
  if (!ui.m.topicId || !choices.includes(ui.m.topicId)) ui.m.topicId = choices[0];
  const t = topic(ui.m.topicId);
  return (
    <>
      <p className="eyebrow">New observation</p><h2>Notice something else.</h2><p>Each one has its own question and time.</p>
      <div className="options" role="radiogroup">{choices.map(id => <Option key={id} text={topic(id).name} on={id === ui.m.topicId} act="pick-topic" val={id} sub={topic(id).question} />)}</div>
      <ScalePreview topicId={ui.m.topicId!} />
      <label className="inputlabel">Check-in time <small>{t.timing.label}</small><input key={t.id} id="obs-time" type="time" defaultValue={t.timing.defaultTime} /></label>
      <Btn act="save-obs">Add observation</Btn>
    </>
  );
}

// ---------- data sources ----------
const Switch = ({ act, on, label }: { act: string; on: boolean; label: string }) => (
  <button type="button" className="switch" role="switch" aria-checked={on} aria-label={label} onClick={e => dispatch(act, undefined, {}, e.currentTarget)}><i /></button>
);
function DataSheet() {
  const s = S();
  const on = s.dataSource === 'apple-health' && !!s.healthImport;
  const h = s.healthImport;
  return (
    <>
      <p className="eyebrow">Data sources</p><h2>Sleep and movement</h2>
      <div className="synccard"><span className="synclabel">Apple Health<small>{on && h ? healthSummary(h) + (h.via === 'simulated' ? ' · simulated' : '') : 'Off'}</small></span><Switch act="health-toggle" on={on} label="Apple Health" /></div>
      {on ? (
        <fieldset className="typepicker"><legend>Sharing</legend>
          {([['sleep', 'Sleep'], ['activity', 'Movement'], ['cycle', 'Period dates']] as const).map(([k, t]) => (
            <label className="permission" key={k}><div><strong>{t}</strong></div><input type="checkbox" checked={s.healthTypes[k]} onChange={e => dispatch('toggle-type', k, { checked: e.target.checked ? '1' : '' })} /></label>
          ))}
        </fieldset>
      ) : null}
      <div className="synccard"><span className="synclabel">Sample history<small>Fictional check-ins, coffee, sleep and movement for demos</small></span><Switch act="sample-toggle" on={s.dataSource === 'sample'} label="Sample history" /></div>
      <details className="realimport"><summary>Use a real Health export</summary><HealthImportControls /></details>
      {h ? <Btn act="clear-health" cls="text danger">Remove Apple Health data</Btn> : null}
    </>
  );
}

function HealthPermSheet() {
  const types = ui.ob ? ui.ob.types : S().healthTypes;
  return (
    <>
      <p className="eyebrow">Simulated permission · prototype</p><h2>Aura would like to read your health data</h2><p>Read only. You can change this any time.</p>
      <fieldset className="typepicker">{([['sleep', 'Sleep', 'Time asleep each night'], ['activity', 'Exercise minutes', 'Daily total'], ['cycle', 'Period dates', 'Dates only; no predictions']] as const).map(([k, t, d]) => (
        <label className="permission" key={k}><div><strong>{t}</strong><small>{d}</small></div><input type="checkbox" id={`perm-${k}`} defaultChecked={types[k]} /></label>
      ))}</fieldset>
      <Btn act="health-allow">Allow</Btn><Btn act="close" cls="text">Don’t allow</Btn>
      <ErrorLine />
      <p className="soft">A browser can’t read Apple Health directly. Allowing loads 30 days of fictional records, labeled “simulated”. For your real data, use an export.xml or the Aura iOS app.</p>
    </>
  );
}

// ---------- plan preview & acceptance ----------
function PreviewSheet() {
  const d = ui.draft!, t = topic(d.topicId);
  const f = d.fromFactor || '';
  const group = f.startsWith('movement') ? 'movement' : f === 'short-sleep' ? 'sleep' : f.startsWith('caffeine') ? 'alertness' : (CONCERNS[(S().profile.concerns || [])[0]] || {}).group || 'energy';
  const nDays = (String(d.days).match(/\d+/) || ['7'])[0];
  const when = [
    ['Today', `Keep your usual ${t.name.toLowerCase()} check-in.`],
    [`Next ${nDays} ${/night/.test(d.days) ? 'nights' : 'days'}`, (d.step.split(/(?<=\.)\s+/).filter(x => !/as usual/i.test(x)).join(' ')) || d.step],
    ['Then', 'Look back together and decide what’s next.']
  ];
  return (
    <>
      <div className="steptop"><Raw cls="goaltile" html={goalArt(group, 64)} />
        <p className="eyebrow">A small step for {t.name.toLowerCase()}</p><h2>{d.title}</h2>
        <p className="stepmeta">{d.duration} · {d.days}</p><p className="steplede">{d.desc}</p></div>
      {d.why ? <div className="stepwhy"><span className="eyebrow">Why this</span><p>{d.why}.</p></div> : null}
      <ol className="steptimeline" aria-label="How it goes">{when.map(([k, v]) => <li key={k}><span className="tldot" aria-hidden="true" /><small>{k}</small><p>{v}</p></li>)}</ol>
      <Btn act="open" val="accept">Choose this step</Btn><Btn act="adjust-chat" cls="text">Make it fit my week</Btn>
      <p className="soft center stepnote">A change in your score won’t prove what caused it, but it’s a good clue.</p>
    </>
  );
}

function AcceptSheet() {
  const d = ui.draft!;
  const active = activeObservations(S());
  const target = ui.m.target || (active.find(o => o.topicId === d.topicId)?.id || `new:${d.topicId}`);
  ui.m.target = target;
  const opts = [...active.map(o => [o.id, topic(o.topicId).name]), ...TOPIC_IDS.filter(id => !active.some(o => o.topicId === id)).map(id => [`new:${id}`, `Start observing: ${topic(id).name}`])];
  const tid = target.startsWith('new:') ? target.slice(4) : observation(S(), target)!.topicId;
  const t = topic(tid);
  const observe = d.kind === 'observe';
  return (
    <>
      <p className="eyebrow">{observe ? 'Observe only' : 'Accept a small step'}</p><h2>{observe ? 'Keep noticing, no change.' : 'Make the next step clear.'}</h2>
      <label className="inputlabel">Linked observation<select id="plan-obs" value={target} onChange={e => dispatch('plan-obs', undefined, { value: e.target.value })}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {observe ? <p className="soft">No routine change. You will only answer your check-in.</p> : <label className="inputlabel">What you will do<textarea id="plan-step" defaultValue={d.step} /></label>}
      <label className="inputlabel">Start date<input id="plan-start" type="date" defaultValue={today()} /></label>
      <label className="inputlabel">Review date<input id="plan-review" type="date" defaultValue={addDays(today(), d.fromFactor ? 3 : 6)} /></label>
      <div className="callout">You will answer: “{t.question}”<br />{observe ? 'Feelings only, no execution log.' : 'Each feedback: what you did, this answer, and anything that got in the way.'}<br />A review date does not guarantee enough records to compare.</div>
      <Btn act="confirm-plan">{observe ? 'Start observing' : 'Confirm and start'}</Btn><Btn act="close" cls="text">Keep as a suggestion</Btn>
      <ErrorLine />
    </>
  );
}

// ---------- step feedback ----------
function FeedbackSheet() {
  const p = findPlan(S(), ui.fb.planId)!, t = topic(p.topicId), d = ui.fb.d, i = ui.fb.step;
  return (
    <>
      <p className="eyebrow">Step feedback · {i + 1} of 3 · {fmtDate(today())}</p><h2>{['What did you do?', t.question, 'What else was happening?'][i]}</h2><p>{p.title}</p>
      {i === 0 ? <div className="scaleopts" role="radiogroup" aria-label="Execution">{EXECUTION.map(x => <button key={x} type="button" role="radio" aria-checked={d.execution === x} className={`scaleopt ${d.execution === x ? 'selected' : ''}`} onClick={e => dispatch('fb-exec', x, {}, e.currentTarget)}><span>{x}</span></button>)}</div> : null}
      {i === 1 ? <><AnswerOptions topicId={p.topicId} choice={d.answer as string} act="fb-answer" /><label className="inputlabel">Compared with before the step? <small>Optional</small><select id="fb-change" defaultValue={(d.change as string) || 'Not answered'}>{CHANGE.map(x => <option key={x}>{x}</option>)}</select></label></> : null}
      {i === 2 ? (
        <>
          <fieldset className="typepicker"><legend>Anything get in the way? <small>Optional</small></legend>{BARRIERS.map(x => (
            <label className="permission" key={x}><div><strong>{x}</strong></div><input type="checkbox" defaultChecked={(d.barriers || []).includes(x)} onChange={e => dispatch('fb-barrier', x, { checked: e.target.checked ? '1' : '' })} /></label>
          ))}</fieldset>
          <label className="inputlabel">Other changes or a note<textarea id="fb-note" placeholder="Anything else to keep in context" defaultValue={(d.note as string) || ''} /></label>
        </>
      ) : null}
      <Btn act="fb-next">{i === 2 ? 'Save feedback' : 'Continue'}</Btn>{i ? <Btn act="fb-back" cls="text">Back</Btn> : null}
      <ErrorLine />
    </>
  );
}

// ---------- completion moments ----------
function DayCircles({ days, stateOf }: { days: string[]; stateOf: (d: string) => string }) {
  return (
    <ol className={`daycircles ${days.length > 7 ? 'tight' : ''}`}>{days.map(d => {
      const st_ = stateOf(d);
      const wd = new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short' });
      return <li key={d} className={`${st_} ${d === today() ? 'istoday' : ''}`} aria-label={`${fmtDay(d)}: ${st_ === 'on' ? 'done' : st_ === 'part' ? 'partly' : st_ === 'miss' ? 'missed' : 'not yet'}`}><Raw tag="i" html={st_ === 'on' || st_ === 'part' ? CHECK : ''} /><small>{wd}</small></li>;
    })}</ol>
  );
}
const ChoiceCards = ({ q, hint, children }: { q: string; hint?: string; children: React.ReactNode }) => (
  <section className="donepanel" aria-label={q}><h2>{q}</h2>{hint ? <p className="donehint">{hint}</p> : null}<div className="choicecards">{children}</div></section>
);
const Choice = ({ label, act, val, filled }: { label: string; act: string; val: string; filled: boolean }) => (
  <button type="button" className="choicecard" onClick={e => dispatch(act, val, {}, e.currentTarget)}><span className={`cc ${filled ? 'fill' : ''}`} aria-hidden="true" /><strong>{label}</strong></button>
);

function DoneSheet() {
  const s = S();
  const o = observation(s, ui.m.obsId)!, t = topic(o.topicId);
  const c = dayCheckin(s, o.id, today());
  let streak = 0; while (dayCheckin(s, o.id, addDays(today(), -streak))) streak++;
  const back = Math.min(Math.max(streak - 1, 0), 2);
  const days = dateRange(addDays(today(), -back), addDays(today(), 4 - back));
  const week = dateRange(addDays(today(), -6), today()).filter(d => dayCheckin(s, o.id, d)).length;
  const plan = currentPlans(s).find(p => p.observationId === o.id && p.status === 'active' && p.start <= today() && today() < p.review && !s.feedbacks.some(f => f.planId === p.id && f.date === today()));
  const caffeineToday = s.entries.some(e => e.kind === 'caffeine' && e.date === today());
  let panel;
  if (plan) panel = <ChoiceCards q="Did you do your step today?" hint={plan.title}><Choice label="Not today" act="done-step" val="no" filled={false} /><Choice label="Yes" act="done-step" val="yes" filled /></ChoiceCards>;
  else if (!caffeineToday && factorsFor(o.topicId).some(f => f.needs === 'caffeine')) panel = <ChoiceCards q="Any caffeine today?"><Choice label="None" act="close" val="" filled={false} /><Choice label="Yes, add it" act="done-open" val="caffeine" filled /></ChoiceCards>;
  else panel = <ChoiceCards q="Anything else from today?"><Choice label="Food" act="done-open" val="food" filled={false} /><Choice label="Caffeine" act="done-open" val="caffeine" filled={false} /></ChoiceCards>;
  return (
    <>
      <div className="donetop"><Raw html={flower(week, 7)} />
        <h1>{streak >= 2 ? 'Good job!' : 'Nice start!'}</h1>
        <p className="donesub">{c ? `${t.name} · ${checkinStatus(c, o.topicId)}` : `You checked in on ${t.name.toLowerCase()}.`}</p>
        <div className="streakcard"><p>{streak ? `${streak} day streak` : 'This week'}</p><DayCircles days={days} stateOf={d => d > today() ? '' : dayCheckin(s, o.id, d) ? 'on' : 'miss'} /></div>
      </div>
      {panel}<Btn act="close" cls="text donefinish">Skip & finish</Btn>
    </>
  );
}

function ReviewSheet() {
  const s = S();
  const p = findPlan(s, ui.m.planId)!;
  const t = topic(p.topicId);
  const obs = observation(s, p.observationId)!;
  const end = today() < p.review ? today() : p.review;
  const days = p.start <= end ? dateRange(p.start, end) : [];
  const fbs = s.feedbacks.filter(f => f.planId === p.id);
  const dayRecs = days.map(d => ({ d, c: dayCheckin(s, p.observationId, d, { includeSample: false }), h: daily(s, d, today()) }));
  const scored = dayRecs.filter(x => x.c && x.c.status === 'recorded');
  const changes = fbs.filter(f => f.change && f.change !== 'Not answered');
  const barriers: Record<string, number> = {};
  fbs.forEach(f => (f.barriers || []).forEach(b => { barriers[b] = (barriers[b] || 0) + 1; }));
  const notes = fbs.filter(f => f.note);
  const worse = changes.some(f => f.change === 'Worse') || fbs.some(f => (f.barriers || []).includes('Felt unwell'));
  const disc = analyze(s, obs, today());
  const mean = scored.length ? Math.round(scored.reduce((a, x) => a + x.c!.score!, 0) / scored.length * 10) / 10 : null;
  const done = fbs.filter(f => f.execution === 'Done').length, partly = fbs.filter(f => f.execution === 'Partly done').length;
  const changeCounts = ['Better', 'About the same', 'Worse', 'Not sure'].map(x => [x, changes.filter(f => f.change === x).length] as const).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const dayN = days.length, total = daysBetween(p.start, p.review) + 1;
  const topFind = disc.state === 'ready' ? findings(disc)[0] : null;
  const isReview = today() >= p.review;
  const ratio = dayN ? done / dayN : 0;
  const didLine = p.kind === 'observe' ? 'You kept noticing, with no routine change.'
    : !fbs.length ? 'No feedback yet. Tell Aura how it went whenever it fits.'
      : ratio >= 0.6 ? 'You kept it up on most days.' : ratio >= 0.3 ? 'You fit it in on some days.' : 'It was hard to fit in this time.';
  const topBarrier = Object.entries(barriers).sort((x, y) => y[1] - x[1])[0];
  const feltLine = (changeCounts.length ? ` Your ${t.construct.toLowerCase()} felt mostly ${changeCounts[0][0].toLowerCase()}.` : '') + (topBarrier ? ` ${topBarrier[0]} got in the way${topBarrier[1] > 1 ? ` ${topBarrier[1]} times` : ' once'}.` : '');
  const decided = p.status === 'stopped' || p.status === 'replaced';
  const fbState = (d: string) => { const f = fbs.find(x => x.date === d); return f ? (f.execution === 'Done' ? 'on' : f.execution === 'Partly done' ? 'part' : 'miss') : d < today() ? 'miss' : ''; };
  const left = total - dayN;
  return (
    <>
      <div className="donetop"><Raw html={flower(p.kind === 'observe' ? scored.length : done + partly, Math.min(10, total))} />
        <h1>{isReview ? 'Step complete' : left > 0 ? `${left} ${left === 1 ? 'day' : 'days'} to go` : 'Last day'}</h1>
        <p className="donesub">{p.title}</p>
        <p className="reviewlede">{didLine}{feltLine}</p>
        {p.kind === 'observe' ? null : <div className="streakcard"><p>{done} of {total} days done</p><DayCircles days={dateRange(p.start, p.review)} stateOf={fbState} />{mean === null ? null : <small className="streakfoot">Average {t.construct.toLowerCase()} {mean.toFixed(1)} / 5</small>}</div>}
      </div>
      {isReview && topFind ? (
        <button type="button" className="reviewfind" onClick={e => topFind.i.step ? dispatch('disc-try', topFind.f.id, { obs: obs.id }, e.currentTarget) : dispatch('goexplore', undefined, { obs: obs.id }, e.currentTarget)}>
          <span className="eyebrow">From your records</span><strong>{topFind.i.headline}</strong><small>{topFind.i.step ? `Next idea: ${topFind.i.step.title} ›` : 'See in Explore ›'}</small>
        </button>
      ) : null}
      {worse ? <p className="callout warn">You reported feeling worse or unwell. Consider pausing this step, and talk with a health professional if it continues.</p> : null}
      {decided ? <p className="soft center">This version is {PLAN_STATUS[p.status].toLowerCase()}. Its records stay in your history.</p> : (
        <>
          <ChoiceCards q={isReview ? 'What next?' : 'How’s the step going?'}>
            <Choice label={isReview ? 'Adjust it' : 'Make it easier'} act="decide" val="adjust" filled={false} /><Choice label="Keep going" act="decide" val="continue" filled />
          </ChoiceCards>
          <div className="donelinks"><Btn act="decide" val="observe" cls="quiet">Just observe</Btn><span aria-hidden="true">·</span><Btn act="decide" val="stop" cls="quiet">Stop the step</Btn></div>
          {isReview ? null : <Btn act="close" cls="text donefinish">Skip & finish</Btn>}
        </>
      )}
      <details className="limits small"><summary>What this can’t tell you</summary><ul className="notes">
        <li>{scored.length < MIN_DAYS ? `Only ${scored.length} scored ${scored.length === 1 ? 'day' : 'days'}; too few for a pattern.` : `${scored.length} scored days is still a small sample.`}</li>
        <li>Scores shift with mood, expectations and timing.</li>
        <li>Without a period off the step, a change can’t be credited to it.</li>
        {notes.length ? <li>Your notes: {notes.slice(-2).map(f => `${fmtDate(f.date)} “${f.note}”`).join('; ')}</li> : null}
      </ul></details>
    </>
  );
}

// ---------- settings & info ----------
function SettingsSheet() {
  const s = S();
  const goals = (s.profile.concerns || []).map(c => CONCERNS[c]).filter(Boolean);
  const obs = activeObservations(s);
  const row = (label: string, value: string, act: string, v?: string, data?: Record<string, string>, cls = '') => (
    <li key={label}><button type="button" className={`setrow ${cls}`} onClick={e => dispatch(act, v, data || {}, e.currentTarget)}><span>{label}</span>{value ? <b>{value}</b> : null}<i aria-hidden="true">›</i></button></li>
  );
  return (
    <>
      <h2 className="setttitle">Your settings</h2>
      <div className="setlabel"><span>Your goals</span><Btn act="resetup" cls="quiet" label="Edit goals">Edit</Btn></div>
      {goals.length ? <div className="goalcards">{goals.map(g => <div key={g.id} className="goalcard"><Raw html={goalArt(g.group, 64)} /><span>{g.goal}</span></div>)}</div> : <ul className="setlist">{row('Choose your goals', '', 'resetup')}</ul>}
      <p className="setlabel"><span>Your observations</span></p>
      <ul className="setlist">{obs.map(o => row(topic(o.topicId).name, o.time, 'open', 'obsedit', { obs: o.id }))}{obs.length < TOPIC_IDS.length ? row('Add an observation', '', 'open', 'addobs', {}, 'add') : null}</ul>
      <p className="setlabel"><span>Data</span></p>
      <ul className="setlist">{row('Apple Health', s.dataSource === 'apple-health' && s.healthImport ? (s.healthImport.via === 'simulated' ? 'Simulated' : 'Imported') : 'Off', 'open', 'data')}{row('Sample history', s.dataSource === 'sample' ? 'On' : 'Off', 'open', 'data')}</ul>
      {s.plans.length ? <><p className="setlabel"><span>Your steps</span></p><ul className="setlist">{row('Steps and decisions', String(s.plans.length), 'open', 'history')}</ul></> : null}
      <p className="setlabel"><span>Privacy</span></p>
      <ul className="setlist">
        <li><div className="setrow"><span>Share anonymous usage data</span><Switch act="share-toggle" on={!!(s.profile.consent && s.profile.consent.share)} label="Share anonymous usage data" /></div></li>
        {row('Terms of Service', '', 'open', 'legal', { doc: 'terms' })}{row('Privacy Policy', '', 'open', 'legal', { doc: 'privacy' })}
      </ul>
      <p className="setlabel"><span>Prototype</span></p>
      <ul className="setlist">{row('Demo timeline', s.demo ? `Day ${s.demo.day}` : '', 'open', 'demo')}{row('Full setup review', '', 'resetup')}{row('About this prototype', '', 'open', 'about')}</ul>
    </>
  );
}

function ObsEditSheet() {
  const o = observation(S(), ui.m.obsId)!, t = topic(o.topicId);
  return (
    <>
      <p className="eyebrow">Observation</p><h2>{t.name}</h2><p>“{t.question}”</p>
      <label className="inputlabel">Check-in time <small>{t.timing.label}</small><input id="obsedit-time" type="time" defaultValue={o.time} /></label>
      <Btn act="save-obsedit">Save</Btn>{activeObservations(S()).length > 1 ? <Btn act="pause-obs" cls="text danger">Stop observing this</Btn> : null}
      <ErrorLine />
      <p className="soft">Stopping keeps your records.</p>
    </>
  );
}

// Placeholder legal copy for the prototype; final text comes from legal review.
const LEGAL: Record<string, [string, string[]]> = {
  terms: ['Terms of Service', ['Aura helps you notice patterns in your own records. It does not give medical advice, diagnose or treat any condition.', 'You are responsible for what you choose to record and for decisions you make with it.', 'You can delete all your records at any time from Settings › About this prototype.']],
  privacy: ['Privacy Policy', ['Your check-ins, notes and photos are stored for this browser session in Google Cloud, separate from every other visitor. Nobody else can open them.', 'When you talk with Aura or add a food photo, the relevant records or the photo are sent to Google Gemini (Vertex AI) to write a reply or suggest fields. They are not used to train models.', 'Apple Health data is read only from an export file you choose (or the Aura iOS app), and only daily totals of the types you allow are saved.', 'Anonymous usage data is shared only if you turn it on, and never includes your records.']],
  health: ['Using your data', ['Aura uses your check-ins and, if you connect it, sleep, exercise minutes and period dates.', 'They are used to show your records, charts and Discovery comparisons, and as context for Aura’s replies.', 'You can stop sharing any type, or remove imported data, in Settings › Data.']]
};
function LegalSheet() {
  const [title, items] = LEGAL[ui.m.doc || 'terms'] || LEGAL.terms;
  return <><p className="eyebrow">Prototype placeholder · not final legal text</p><h2>{title}</h2><ul className="notes legal">{items.map(x => <li key={x}>{x}</li>)}</ul><Btn act="close">Close</Btn></>;
}

function HistorySheet() {
  const s = S();
  const plans = [...s.plans].reverse();
  return (
    <>
      <p className="eyebrow">History</p><h2>Your decisions stay with you.</h2>
      {plans.length ? plans.map(p => (
        <article className="logentry" key={p.id}><div><strong>v{p.version} · {p.title}</strong><p>{topic(p.topicId).name} · {PLAN_STATUS[p.status]}</p>
          <small>{fmtDate(p.start)} – {fmtDate(p.review)} · {s.feedbacks.filter(f => f.planId === p.id).length} feedback</small>
          {(p.history || []).map((h, i) => <small key={i}>{new Date(h.at).toLocaleString()} · {PLAN_STATUS[h.status]}</small>)}
          {s.decisions.filter(d => d.planId === p.id).map(d => <small key={d.id}>Decision: {d.choice}{d.reason ? ` · “${d.reason}”` : ''}</small>)}
          <Btn act="open" val="review" data={{ plan: p.id }} cls="quiet">Open review</Btn></div></article>
      )) : <p>No accepted steps yet.</p>}
    </>
  );
}

function AboutSheet() {
  return (
    <>
      <h2>Aura.ai</h2><p>Understand how you live.</p>
      <div className="callout">
        {ui.ai.enabled
          ? <>Aura’s replies and photo suggestions come from Google Gemini ({ui.ai.model}). Numbers are computed by the app and every reply is checked against them before it’s shown. Safety checks run before and after each reply.</>
          : <>AI is not configured in this environment, so Aura’s replies are preset and photos are not read automatically.</>}
        {' '}Sample data is fictional and labeled. Apple Health data comes only from an export file you choose, or is simulated and labeled.
      </div>
      <p className="soft">Your records are saved for this browser session, apart from every other visitor. {ui.saveError ? `Last save failed: ${ui.saveError}` : ''}</p>
      <Btn act="open" val="demo" cls="smallaction">Demo timeline (day 1 · 4 · 10)</Btn><Btn act="resetup" cls="smallaction">Edit setup</Btn><Btn act="reset" cls="text danger">Delete all records and restart</Btn>
    </>
  );
}

function DemoSheet() {
  const cur = S().demo;
  return (
    <>
      <p className="eyebrow">Demo timeline · for review</p><h2>See Aura over a week</h2>
      <p>Each option back-dates realistic records so you can see what changes as days pass. It replaces the records in this session only.</p>
      <div className="options">{SCENARIOS.map(s => <Option key={s.day} text={s.title} on={!!cur && cur.day === s.day} act="demo-load" val={String(s.day)} sub={s.desc} />)}</div>
      <ErrorLine />
    </>
  );
}

const SHEETS: Record<string, [string, () => React.ReactNode]> = {
  checkin: ['Check-in', CheckinSheet], food: ['Food', FoodSheet], caffeine: ['Caffeine', CaffeineSheet], addobs: ['Add observation', AddObsSheet],
  demo: ['Demo timeline', DemoSheet], settings: ['Settings', SettingsSheet], legal: ['Terms and privacy', LegalSheet], obsedit: ['Observation', ObsEditSheet],
  data: ['Data sources', DataSheet], healthperm: ['Health permission', HealthPermSheet], preview: ['Suggested step', PreviewSheet], accept: ['Accept step', AcceptSheet],
  feedback: ['Step feedback', FeedbackSheet], review: ['Review', ReviewSheet], done: ['Check-in saved', DoneSheet], history: ['History', HistorySheet], about: ['About', AboutSheet]
};

export function Modal() {
  const m = ui.modal!;
  const [label, Body] = SHEETS[m] || SHEETS.about;
  const ref = useRef<HTMLElement>(null);
  // Focus the sheet when a new one opens; keep Tab inside it; Escape closes.
  useEffect(() => { ref.current?.focus(); }, [ui.modalSeq]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { dispatch('close', undefined, {}); return; }
    if (e.key !== 'Tab') return;
    const f = [...(ref.current?.querySelectorAll<HTMLElement>('button,input,select,textarea,summary') || [])].filter(x => !(x as HTMLButtonElement).disabled);
    if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === ref.current)) { e.preventDefault(); f.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0]?.focus(); }
  };
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) dispatch('backdrop', undefined, {}); }}>
      <section ref={ref} key={ui.modalSeq} className={`sheet ${['review', 'settings', 'done'].includes(m) ? 'fullsheet' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKey}>
        <Btn act="close" cls="close" label="Close">×</Btn>
        <Body />
      </section>
    </div>
  );
}
