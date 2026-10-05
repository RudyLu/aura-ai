'use client';
// Splash and the setup flow (ported from app.js).
import { useEffect, useRef } from 'react';
import { CONCERN_GROUPS, CONCERNS, rankTopics, topic } from '@/domain/topics';
import { factorsFor, MIN_DAYS } from '@/domain/discovery';
import { healthSummary, sourceLabel } from '@/domain/health';
import { AuraMark, Btn, ErrorLine, HEALTH_TILE, Option, Raw } from './core';
import { dispatch, hasBridge, OB_LAST, OB_TITLES, runHealthImport } from './actions';
import { render, S, ui, type OnboardingDraft } from './store';

const ATTEMPTS = ['An earlier bedtime', 'Less or earlier caffeine', 'More exercise', 'Short breaks or naps', 'Tracking with another app', 'Nothing yet'];
const CONSTRAINTS = ['Keep it simple', 'Overtime and changing plans', 'Shift work', 'Family or caregiving'];

export function Splash() {
  return (
    <section className="splash aura-splash">
      <div className="aura-opening">
        <AuraMark size="aura-large" />
        <p className="splashlogo"><span className="logotype">Aura<span>.ai</span></span></p>
        <h1>Understand<br />how you live.</h1>
        <p>Every life has a glow.<br />We help you see it.</p>
      </div>
      <div className="splashbottom">
        <Btn act="begin">Get started</Btn>
        <Btn act="demo" cls="text">See a demo timeline</Btn>
        <small>Prototype. Your records are kept for this browser session only. {ui.ai.enabled ? 'Aura’s replies come from Gemini and are checked against your records.' : 'AI is off here, so Aura’s replies are preset.'}</small>
      </div>
    </section>
  );
}

// Back, step count and progress bar: identical on every setup screen.
const ObHead = ({ i }: { i: number }) => (
  <div className="obhead">
    <div className="steprow"><Btn act="ob-back" cls="quiet">Back</Btn><span>{i + 1} of {OB_LAST + 1}</span></div>
    <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={OB_LAST + 1} aria-valuenow={i + 1} aria-label="Setup progress"><i style={{ width: `${(i + 1) / (OB_LAST + 1) * 100}%` }} /></div>
  </div>
);

function DiscoveryPreview({ data, types, topicId }: { data: string; types: OnboardingDraft['types']; topicId: string }) {
  const has = (need: string) => need === 'caffeine' ? true : (data !== 'none' && types[need as 'sleep']);
  return (
    <section className="discoverypreview"><p className="eyebrow">After {MIN_DAYS} days of check-ins</p><p>Aura compares your days by:</p>
      <ul className="factorlist">{factorsFor(topicId).map(f => (
        <li key={f.id} className={has(f.needs) ? 'on' : 'off'}><span>{f.label}</span>{has(f.needs) ? null : <small>Needs {f.needs === 'sleep' ? 'sleep' : 'movement'} data</small>}</li>
      ))}</ul>
    </section>
  );
}

// Agreements before starting. Terms and health-data consent are required;
// sharing anonymous usage data is optional and off by default.
function Consents({ o }: { o: OnboardingDraft }) {
  const box = (key: 'terms' | 'health' | 'share', required: boolean, body: React.ReactNode) => (
    <label className="consent">
      <input type="checkbox" checked={o.consent[key]} aria-required={required || undefined} onChange={e => dispatch('ob-consent', key, { checked: e.target.checked ? '1' : '' })} />
      <span>{body}{required ? null : <> <em>Optional</em></>}</span>
    </label>
  );
  return (
    <fieldset className="consents"><legend>Before you start</legend>
      {box('terms', true, <>I agree to the <Btn act="open" val="legal" data={{ doc: 'terms' }} cls="inlinelink">Terms of Service</Btn> and <Btn act="open" val="legal" data={{ doc: 'privacy' }} cls="inlinelink">Privacy Policy</Btn>.</>)}
      {box('health', true, <>Aura may use my check-ins{o.data === 'apple-health' ? ' and Apple Health data' : ''} to show my records and compare days, including sending them to Google Gemini to write replies. <Btn act="open" val="legal" data={{ doc: 'health' }} cls="inlinelink">What this means</Btn></>)}
      {box('share', false, 'Share anonymous usage data. Never includes your records.')}
      <p className="soft">Aura is not a medical device and doesn’t diagnose or treat any condition.</p>
    </fieldset>
  );
}

export function Onboarding() {
  const o = ui.ob!, i = ui.step, st = S();
  if (i === 1) return <TopicDeck o={o} />;
  if (i === 5) return <SyncScreen step on={o.data === 'apple-health' && !!st.healthImport} />;
  let body: React.ReactNode = null;
  if (i === 0) body = (
    <><p>Pick any that fit. Aura will suggest where to start.</p>
      <div className="concerns">{CONCERN_GROUPS.map(g => (
        <fieldset className="concerngroup" key={g.id}><legend>{g.label}</legend>
          <div className="chips">{g.items.map(c => <button key={c.id} type="button" className="chip" aria-pressed={o.concerns.includes(c.id)} onClick={e => dispatch('ob-concern', c.id, {}, e.currentTarget)}>{c.label}</button>)}</div>
        </fieldset>
      ))}</div></>
  );
  if (i === 2) {
    const t = topic(o.topicId);
    body = <><p>{t.timing.hint}</p><label className="inputlabel">Reminder time<input id="ob-time" type="time" defaultValue={o.time || t.timing.defaultTime} /></label><p className="soft">You can still check in at another time.</p></>;
  }
  if (i === 3) body = (
    <><p>Pick any. Aura won’t suggest them again.</p>
      <div className="options">{ATTEMPTS.map(a => <Option key={a} text={a} on={o.attempts.includes(a)} act="ob-attempt" val={a} type="check" />)}</div>
      <label className="inputlabel">Anything to add? <small>Optional</small><input id="ob-attempt-note" defaultValue={o.attemptsNote} placeholder="e.g. Tried no coffee after 3 pm for a week" /></label></>
  );
  if (i === 4) body = (
    <><p>Suggested steps will fit around it.</p>
      <div className="options" role="radiogroup" aria-label="Constraint">{CONSTRAINTS.map(c => <Option key={c} text={c} on={o.constraint === c} act="ob-constraint" val={c} />)}</div></>
  );
  if (i === OB_LAST) {
    const t = topic(o.topicId);
    const row = (label: string, value: React.ReactNode, step: number) => (
      <div className="reviewrow"><div><small>{label}</small><p>{value}</p></div><Btn act="ob-edit" val={step} cls="quiet" label={`Edit ${label}`}>Edit</Btn></div>
    );
    const dataText = o.data === 'apple-health' && st.healthImport ? sourceLabel('apple-health', st.healthImport) : 'Only my check-ins';
    body = (
      <><p>Tap Edit to change anything.</p>
        <div className="reviewlist">
          {row('Getting in the way', o.concerns.map(c => CONCERNS[c]?.label).filter(Boolean).join(', ') || 'Not answered', 0)}
          {row('Observation', t.name, 1)}
          {row('Check-in time', o.time || t.timing.defaultTime, 2)}
          {row('Already tried', <>{o.attempts.join(', ') || 'Not answered'}{o.attemptsNote ? <><br /><span className="soft">{o.attemptsNote}</span></> : null}</>, 3)}
          {row('Work around', o.constraint, 4)}
          {row('Data', dataText, 5)}
        </div>
        <DiscoveryPreview data={o.data === 'apple-health' && !st.healthImport ? 'none' : o.data} types={o.types} topicId={o.topicId!} />
        <Consents o={o} /></>
    );
  }
  const canNext = (i === 0 && o.concerns.length > 0) || (i >= 2 && i < OB_LAST) || (i === OB_LAST && o.consent.terms && o.consent.health);
  const nextLabel = i === 0 && !ui.fromReview ? (o.concerns.length ? `Continue · ${o.concerns.length} selected` : 'Choose at least one') : i === OB_LAST ? 'Start observing' : ui.fromReview ? 'Back to review' : 'Continue';
  return (
    <main className="survey"><ObHead i={i} /><h1>{OB_TITLES[i]}</h1>{body}
      <div className="surveybottom"><Btn act="ob-next" disabled={!canNext}>{nextLabel}</Btn><ErrorLine id="ob-error" /></div>
    </main>
  );
}

// Setup step 2: one topic per card; swipe or use the dots. The centred card is the selection.
function TopicDeck({ o }: { o: OnboardingDraft }) {
  const ranked = rankTopics(o.concerns);
  const key = o.concerns.join(',');
  if (!o.topicId || o.rankedFor !== key) { o.topicId = ranked[0].id; o.rankedFor = key; }
  const t = topic(o.topicId);
  const deck = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const d = deck.current, card = d?.querySelector<HTMLElement>(`[data-topic="${o.topicId}"]`);
    if (d && card) d.scrollLeft = card.offsetLeft - (d.clientWidth - card.clientWidth) / 2;
    // Only on first show; afterwards the scroll position drives the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    const d = deck.current!, mid = d.scrollLeft + d.clientWidth / 2;
    let best: HTMLElement | null = null, dist = Infinity;
    d.querySelectorAll<HTMLElement>('.topiccard').forEach(c => { const x = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (x < dist) { dist = x; best = c; } });
    const id = (best as HTMLElement | null)?.dataset.topic;
    if (id && id !== o.topicId) { o.topicId = id as typeof o.topicId; o.time = null; render(); }
  };
  return (
    <main className="topicdeck"><ObHead i={1} /><p className="decklabel">Your first observation</p>
      <div className="deck" id="topic-deck" ref={deck} onScroll={onScroll} role="group" aria-roledescription="carousel" aria-label="Suggested observations">
        {ranked.map((r, k) => {
          const tt = topic(r.id);
          const tag = k === 0 && r.score ? 'Best match' : r.score ? 'Also fits' : 'Another option';
          return (
            <article key={r.id} className="topiccard" data-topic={r.id} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${ranked.length}: ${tt.name}, ${tag}`}>
              <div className={`topicart art-${r.id}`} aria-hidden="true"><span className="orb" /><span className="haze" /><span className={`matchtag ${k === 0 && r.score ? 'best' : ''}`}>{tag}</span></div>
              <div className="topictext"><h1>{tt.name}</h1><p className="topicq">“{tt.question}”</p>
                {r.why.length ? <p className="topicwhy">For {r.why.map((w, j) => <span key={w}>{j ? ' · ' : ''}<b>{w}</b></span>)}</p> : null}</div>
            </article>
          );
        })}
      </div>
      <div className="deckdots" role="tablist" aria-label="Choose a topic">
        {ranked.map(r => <button key={r.id} type="button" role="tab" className="deckdot" aria-selected={r.id === o.topicId} aria-label={topic(r.id).name} onClick={e => dispatch('ob-topic', r.id, {}, e.currentTarget)} />)}
      </div>
      <div className="deckbottom"><Btn act="ob-next" cls="primary deckcta">{`Observe ${t.name.toLowerCase()}`}</Btn></div>
    </main>
  );
}

// Full-screen "Sync with Apple Health" (setup step 6).
export function SyncScreen({ on, step }: { on: boolean; step?: boolean }) {
  const st = S(), h = st.healthImport;
  const types = ui.ob ? ui.ob.types : st.healthTypes;
  return (
    <main className="syncscreen">{step ? <ObHead i={5} /> : null}
      <div className="synchero"><h1>Sync with<br />Apple Health</h1><p>See sleep, movement and period dates next to your check-ins. Read only.</p></div>
      <Raw cls="healthtile" tag="div" html={HEALTH_TILE} />
      <div className="syncbottom">
        <div className="synccard"><span className="synclabel">Apple Health<small>{on ? (h && h.via === 'simulated' ? 'Connected · simulated' : 'Connected') : 'Sleep, movement and period dates'}</small></span>
          <button type="button" className="switch" role="switch" aria-checked={on} aria-label="Apple Health" onClick={e => dispatch('health-toggle', undefined, {}, e.currentTarget)}><i /></button></div>
        {on ? (
          <fieldset className="synctypes"><legend>Choose what to import</legend>
            {([['sleep', 'Sleep', 'Time asleep each night'], ['activity', 'Exercise minutes', 'Daily total'], ['cycle', 'Period dates', 'Dates only; no predictions']] as const).map(([k, t, d]) => (
              <label className="permission" key={k}><div><strong>{t}</strong><small>{d}</small></div>
                <input type="checkbox" checked={types[k]} onChange={e => dispatch(ui.ob ? 'ob-type' : 'toggle-type', k, { checked: e.target.checked ? '1' : '' })} /></label>
            ))}
          </fieldset>
        ) : null}
        <Btn act="ob-next" cls="primary syncnext">{on ? 'Continue' : 'Continue without it'}</Btn>
        <details className="realimport"><summary>Use a real Health export instead</summary><HealthImportControls /></details>
      </div>
    </main>
  );
}

export function HealthImportControls() {
  const h = S().healthImport;
  const status = ui.importing !== null
    ? <p className="soft" role="status">Reading export… {Math.round(ui.importing * 100)}%</p>
    : h && h.via !== 'simulated' ? <div className="callout"><strong>Imported {new Date(h.importedAt).toLocaleDateString()}</strong><br />{healthSummary(h)}<br /><small>{h.via === 'bridge' ? 'Via the Aura app bridge' : `From ${h.fileName}, read in this browser`}</small></div> : null;
  return (
    <div className="healthimport">
      {hasBridge() ? <Btn act="health-bridge" cls="smallaction">{h ? 'Refresh from Apple Health' : 'Connect Apple Health'}</Btn> : null}
      <label className="filebutton">{h && h.via !== 'simulated' ? 'Import a newer export.xml' : 'Choose export.xml'}
        <input type="file" accept=".xml,text/xml,application/xml" onChange={e => { const f = e.target.files?.[0]; if (f) runHealthImport(f); e.target.value = ''; }} /></label>
      <details><summary>How to get export.xml</summary><p className="soft">On iPhone: Health › your profile picture › Export All Health Data. Unzip the file and choose <b>export.xml</b>. It is read in this browser; only daily totals (sleep hours, exercise minutes, period dates) are saved to your session.</p></details>
      {status}<ErrorLine id="health-error" />
    </div>
  );
}
