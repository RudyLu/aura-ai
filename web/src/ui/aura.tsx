'use client';
// Aura chat (ported from views.js chat()). Replies come from /api/aura.
import { useState } from 'react';
import { activeObservations, currentPlans, plan as findPlan, type Message, type Plan } from '@/domain/state';
import { topic } from '@/domain/topics';
import { AuraMark, Btn } from './core';
import { dispatch, sendToAura } from './actions';
import { reviewOn, PLAN_STATUS } from './today';
import { S, today, ui } from './store';

function MessageAction({ m }: { m: Message }) {
  const a = m.action;
  if (!a) return null;
  const s = S();
  if (a.type === 'feedback') {
    const p = findPlan(s, a.planId);
    if (!p || !['active', 'observing'].includes(p.status)) return null;
    return p.status === 'active'
      ? <Btn act="feedback" data={{ plan: p.id }} cls="smallaction msgaction">How did it go?</Btn>
      : <Btn act="open" val="checkin" data={{ obs: p.observationId }} cls="smallaction msgaction">{`Check in: ${topic(p.topicId).name}`}</Btn>;
  }
  if (a.type === 'data') return <Btn act="open" val="data" cls="smallaction msgaction">Manage data sources</Btn>;
  if (a.type === 'caffeine') return <Btn act="open" val="caffeine" cls="smallaction msgaction">＋ Log a drink</Btn>;
  if (a.type === 'checkin') {
    const o = activeObservations(s).find(x => x.topicId === a.topicId);
    return o ? <Btn act="open" val="checkin" data={{ obs: o.id }} cls="smallaction msgaction">{`Check in: ${topic(a.topicId).name}`}</Btn> : null;
  }
  return null;
}

// Where a reply came from, so nobody mistakes a fallback for the model.
const VIA: Record<string, string> = { preset: 'Preset reply', 'verified-summary': 'Summary from your records', safety: 'Safety message' };

function PlanCard({ p }: { p: Plan }) {
  const t = topic(p.topicId);
  const done = S().feedbacks.some(f => f.planId === p.id && f.date === today());
  return (
    <article className={`plancard compact ${p.status}`}><span className="eyebrow">{PLAN_STATUS[p.status]} · {reviewOn(p)}</span><h3>{p.title}</h3>
      <div className="obsactions">
        {p.status === 'active'
          ? <Btn act="feedback" data={{ plan: p.id }} cls="smallaction">{done ? 'Edit today’s feedback' : 'How did it go?'}</Btn>
          : <Btn act="open" val="checkin" data={{ obs: p.observationId }} cls="smallaction">{`Check in: ${t.name}`}</Btn>}
        <Btn act="open" val="review" data={{ plan: p.id }} cls="quiet">Details</Btn>
      </div>
    </article>
  );
}

function suggestions(): [string, string, string, Record<string, string>?][] {
  const s = S();
  const plans = currentPlans(s);
  if (plans.length) return [['Review my step', 'open', 'review', { plan: plans[0].id }], ['Add context', 'open', 'food'], ['Change my step', 'prompt', 'Help me adjust my step for a busy week.']];
  if (!s.messages.length) return [
    ['A hard day, a hot cocoa, and no energy', 'prompt', 'I had a difficult meeting, bought a hot cocoa, and fell asleep on the sofa. I feel exhausted.'],
    ['Help me explore my coffee habit', 'prompt', 'Help me explore my coffee habit'],
    ['Help me understand my week', 'prompt', 'Help me understand my week']
  ];
  if (ui.draft) return [];
  return [['I’m working late this week', 'prompt', 'I’m working late this week'], ['I want energy for exercise', 'prompt', 'I want energy for exercise']];
}

export function Aura() {
  const s = S();
  const [text, setText] = useState('');
  const d = ui.draft;
  const sug = suggestions();
  const send = () => { const t = text.trim(); if (t && !ui.pending) { setText(''); sendToAura(t); } };
  const offer = ui.logOffer && !ui.pending ? ui.logOffer : null;
  return (
    <main className="chatpage">
      <div className="chatheading"><AuraMark size="aura-chat" state={ui.auraState} /><div><h2>Aura</h2><small>{ui.pending ? 'Taking a moment to understand…' : 'A little space to think together.'}</small></div></div>
      {currentPlans(s).map(p => <PlanCard key={p.id} p={p} />)}
      <div className="messages" aria-live="polite">
        <div className="bubble guide"><span className="speaker">Aura</span>Hi, I’m Aura. Tell me about your day, and we’ll make sense of it together.</div>
        {s.messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.meta?.safety === 'emergency' ? ' urgent' : ''}`}>
            {m.role === 'guide' ? <span className="speaker">Aura{m.meta && VIA[m.meta.via] ? <small className="via"> · {VIA[m.meta.via]}</small> : null}</span> : null}
            {m.text.split('\n').map((line, k) => <span key={k}>{k ? <br /> : null}{line}</span>)}
            <MessageAction m={m} />
          </div>
        ))}
        {d ? (
          <div className="draft"><span className="eyebrow">A suggestion, not a commitment · {topic(d.topicId).name}</span><h3>{d.title}</h3><p>{d.desc}</p>
            <div className="tags"><span>{d.duration}</span><span>{d.days}</span></div>
            <Btn act="open" val="preview">See this small step</Btn><Btn act="observe" cls="text">Just observe for now</Btn></div>
        ) : null}
      </div>
      {ui.pending ? <p className="aura-understanding" role="status">Aura is putting your words in context.</p> : null}
      {offer ? (
        <div className="aura-log-offer"><p>Keep one detail from your day?</p>
          {offer.name ? <Btn act="log-offer" cls="smallaction">{`Record the ${offer.name.toLowerCase()}`}</Btn> : <Btn act="log-offer" cls="smallaction">Log food or a drink</Btn>}
          <Btn act="checkin-topic" val={offer.topicId} cls="smallaction">{`Check in: ${topic(offer.topicId).name}`}</Btn></div>
      ) : null}
      {sug.length ? <div className="suggestions">{sug.map(([l, act, v, data]) => <button key={l} type="button" disabled={ui.pending} onClick={e => dispatch(act, v, data || {}, e.currentTarget)}>{l}</button>)}</div> : null}
      <div className="chatdock">
        <form id="chat-form" className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
          <label className="sr-only" htmlFor="message">Message Aura</label>
          <textarea id="message" placeholder="What has today felt like?" rows={1} required value={text} maxLength={2000}
            onChange={e => { setText(e.target.value); if (!ui.pending) ui.auraState = e.target.value ? 'listening' : 'idle'; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button aria-label="Send message" type="submit" disabled={ui.pending}>↑</button>
        </form>
        <small className="footnote">{ui.ai.enabled ? 'Replies by Gemini, checked against your records. Not medical advice.' : 'AI is off here: preset replies. Not medical advice.'}</small>
      </div>
    </main>
  );
}
