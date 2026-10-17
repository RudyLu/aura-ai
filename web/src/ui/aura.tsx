'use client';
// Aura chat (ported from views.js chat()). Replies come from /api/aura.
import { replySegments } from '@/domain/chatPresentation';
import { scrollAuraToLatest } from './chatScroll';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { activeObservations, currentPlans, plan as findPlan, type Message, type Plan } from '@/domain/state';
import { nextDemoTurn, isScriptedDemoMessage } from '@/domain/demoConversation';
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
  if (a.type === 'review') return <Btn act="open" val="review" data={{ plan: a.planId }} cls="smallaction msgaction">Review your step</Btn>;
  if (a.type === 'context') return <Btn act="open" val="food" cls="smallaction msgaction">Add context</Btn>;
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
  const next = nextDemoTurn(s);
  if (next) return [[next.turn.user, 'prompt', next.turn.user]];
  const plans = currentPlans(s);
  if (plans.length) return [['Review my step', 'open', 'review', { plan: plans[0].id }], ['Add context', 'open', 'food'], ['Change my step', 'prompt', 'Help me adjust my step for a busy week.']];
  const dynamic = s.messages.at(-1)?.interaction;
  if (dynamic?.kind === 'suggestions') return dynamic.options.map(o => [o.label, 'prompt', o.text]);
  if (!s.messages.length) return [
    ['A hard day, a hot cocoa, and no energy', 'prompt', 'I had a difficult meeting, bought a hot cocoa, and fell asleep on the sofa. I feel exhausted.'],
    ['Help me explore my coffee habit', 'prompt', 'Help me explore my coffee habit'],
    ['Help me understand my week', 'prompt', 'Help me understand my week']
  ];
  if (ui.draft) return [];
  return [['I’m working late this week', 'prompt', 'I’m working late this week'], ['I want energy for exercise', 'prompt', 'I want energy for exercise']];
}

// Shown in place of Aura's next message while /api/aura works. The note follows what the
// server actually does (safety check, records, grounding check) and reassures on long waits.
const WAIT_NOTES: [number, string][] = [[0, 'Waiting for Aura…'], [7, 'Still waiting for a response…'], [14, 'This is taking a little longer.']];
function TypingBubble() {
  const [secs, setSecs] = useState(0);
  useEffect(() => { const t = setInterval(() => setSecs(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const note = WAIT_NOTES.filter(([at]) => secs >= at).at(-1)![1];
  return (
    <div className="bubble guide typing-bubble" role="status">
      <span className="speaker">Aura</span>
      <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="typing-note">{note}</span>
    </div>
  );
}

function NextUpCard() {
  const s=S();
  if (ui.nextUp === null || ui.pending) return null;
  const opts=[
    ...(!s.entries.some(e=>e.kind==='food' && e.date===today()) ? [{label:'Add what you ate today?',act:'open',value:'food',cta:'Log food'}] : []),
    ...(!s.entries.some(e=>e.kind==='caffeine' && e.date===today()) ? [{label:'Any coffee or tea today?',act:'open',value:'caffeine',cta:'Log a drink'}] : []),
    {label:'See how this week is shaping up',act:'goexplore',value:'',cta:'Open Explore'},
    {label:'Talk through your week with Aura',act:'prompt',value:'Help me understand my week',cta:'Start'}
  ];
  const o=opts[ui.nextUp % opts.length];
  return <article className="stepcard nextup"><p className="nexttag">Your next action</p><h3>{o.label}</h3><div className="nextfoot"><Btn act={o.act} val={o.value} cls="pillbtn">{o.cta}</Btn><Btn act="nextup-shuffle" cls="quiet">Another idea</Btn></div></article>;
}

// New replies reveal complete sentences. History is immediate and reduced motion
// skips the sequence; actionable controls appear when the answer is complete.
function ReplyText({ text, animate, onRevealing }: { text: string; animate: boolean; onRevealing: (value: boolean) => void }) {
  const parts = useMemo(() => replySegments(text), [text]);
  const [count, setCount] = useState(() => animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : parts.length);
  const revealing = count < parts.length;
  useLayoutEffect(() => {
    if (!animate) return;
    onRevealing(revealing);
    const frame = requestAnimationFrame(() => scrollAuraToLatest(false));
    return () => cancelAnimationFrame(frame);
  }, [count, animate, revealing, onRevealing]);
  // Release the parent's reveal lock if this reply stops animating mid-reveal or unmounts.
  useLayoutEffect(() => {
    if (!animate) return;
    return () => onRevealing(false);
  }, [animate, onRevealing]);
  useEffect(() => {
    if (!revealing) return;
    const timer = setTimeout(() => setCount(n => n + 1), Math.min(1100, Math.max(650, parts[count - 1].length * 9)));
    return () => clearTimeout(timer);
  }, [count, revealing, parts]);
  return <div className="replytext" aria-busy={revealing}>{parts.slice(0, count).map((part, i) => <span className={animate ? 'replysegment reveal' : 'replysegment'} key={i}>{part}</span>)}</div>;
}

export function Aura() {
  const s = S();
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const initialMessages = useRef(s.messages.length);
  const hero = !s.messages.length && !currentPlans(s).length;
  // Re-attach when the hero view gives way to the conversation, which mounts these nodes.
  useLayoutEffect(() => {
    const viewport = document.querySelector('.chatbody');
    const content = document.querySelector('.convo');
    const dock = document.querySelector('.chatdock');
    if (!viewport || !content || !dock) return;
    const observer = new ResizeObserver(() => scrollAuraToLatest(false));
    observer.observe(content); observer.observe(dock);
    scrollAuraToLatest(false);
    return () => observer.disconnect();
  }, [hero]);
  useLayoutEffect(() => {
    if (!ui.modal) scrollAuraToLatest(false);
  }, [s.messages.length, ui.pending, ui.modal, revealing]);
  const heroOrbRect = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (hero) {
      heroOrbRect.current = document.querySelector('.orbhero .aura-hero')?.getBoundingClientRect() || null;
      return;
    }
    const from = heroOrbRect.current;
    heroOrbRect.current = null;
    const orb = document.querySelector<HTMLElement>('.orbtop .aura-top');
    if (!from || !orb || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = orb.getBoundingClientRect();
    const x = from.x + from.width / 2 - to.x - to.width / 2;
    const y = from.y + from.height / 2 - to.y - to.height / 2;
    const animation = orb.animate([
      { transform: `translate(${x}px, ${y}px) scale(${from.width / to.width})`, opacity: 1 },
      { transform: 'translate(0, 0) scale(1)', opacity: .9 }
    ], { duration: 700, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    // The hero shows the companion artwork; cross-fade it into the small mark while it moves.
    const fade = orb.querySelector('.aura-heart-handover')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-in' });
    return () => { animation.cancel(); fade?.cancel(); };
  }, [hero]);
  useEffect(() => {
    const page=document.querySelector('.chatpage');
    if (!page || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    page.classList.add('entering');
    const enterTimer=setTimeout(()=>page.classList.remove('entering'),950);
    return ()=>{clearTimeout(enterTimer);page.classList.remove('entering');};
  }, []);
  const previousHero=useRef(hero);
  useEffect(()=>{
    if(previousHero.current && !hero && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      const page=document.querySelector('.chatpage');page?.classList.add('fromhero');
      const timer=setTimeout(()=>page?.classList.remove('fromhero'),800);
      previousHero.current=hero;return()=>{clearTimeout(timer);page?.classList.remove('fromhero');};
    }
    previousHero.current=hero;
  },[hero]);
  const d = ui.draft;
  const sug = suggestions();
  const send = () => { const t = text.trim(); if (t && !ui.pending && !revealing) { setText(''); sendToAura(t); } };
  const offer = ui.logOffer && !ui.pending ? ui.logOffer : null;
  return (
    <main className={`chatpage scene v2 ${hero ? 'hero' : 'talk'} ${ui.pending ? 'thinking' : ''} ${ui.chatError ? 'haserror' : ''} ${attach ? 'menuopen' : ''}`}>
      <div className="scenebg" aria-hidden="true"><span className="stars"/></div>
      {attach ? <div className="actionglass" aria-hidden="true" onClick={() => setAttach(false)} /> : null}
      <button className="auraclose" aria-label="Close Aura" onClick={() => dispatch('aura-close',undefined,{})}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      {hero ? <div className="aurahero"><div className="orbhero"><AuraMark size="aura-hero" state={ui.auraState}/></div><h1>How was your day?</h1><p>Tell Aura what happened. We’ll make sense of it together.</p></div> : <div className="orbtop" aria-hidden="true"><AuraMark size="aura-top" state={ui.auraState}/></div>}
      <div className="chatbody"><div className="convo">
      {currentPlans(s).map(p => <PlanCard key={p.id} p={p} />)}
      <div className="messages" aria-live="polite">
        {!hero ? <div className="cb aura">Hi, I’m Aura. Tell me about your day, and we’ll make sense of it together.</div> : null}
        {s.messages.map((m, i) => (
          <div key={i} className={`cb ${m.role === 'guide' ? 'aura' : 'me'}${m.meta?.safety === 'emergency' ? ' urgent' : ''}${ui.freshMsg === s.messages.length && i === s.messages.length-1 ? ' fresh' : ''}`}>
            {m.role === 'guide' ? <span className="speaker">Aura{m.meta && VIA[m.meta.via] ? <small className="via"> · {m.meta.cited?.some(id => id.startsWith('plan-confirmed:')) ? 'Step confirmed' : isScriptedDemoMessage(m) ? 'Scripted demo' : VIA[m.meta.via]}</small> : null}</span> : null}
            {m.role === 'guide' ? <ReplyText text={m.text} animate={i >= initialMessages.current && i === s.messages.length - 1 && ui.freshMsg === s.messages.length && m.meta?.safety !== 'emergency'} onRevealing={setRevealing} /> : m.text}
            {!(revealing && i === s.messages.length - 1) ? <MessageAction m={m} /> : null}
            {m.insights?.map(insight => <article className="agentinsight" key={insight.id}><strong>{insight.title}</strong><p>{insight.text}</p>{insight.limitations?.map((l,k)=><small key={k}>{l}</small>)}</article>)}
            {m.interaction && m.interaction.kind !== 'suggestions' ? <div className="agentchoices" role="group" aria-label={m.interaction.question || 'Choose a reply'}>{m.interaction.question ? <p>{m.interaction.question}</p> : null}{m.interaction.options.map(o=><button key={o.id} className="pillopt" disabled={ui.pending || revealing || i !== s.messages.length-1} onClick={()=>sendToAura(o.text,false,{messageIndex:i,optionId:o.id,topicId:o.topicId})}>{o.label}</button>)}</div> : null}
          </div>
        ))}
        {d && !revealing ? (
          <div className="stepcard suggestion"><span className="eyebrow">A suggestion, not a commitment · {topic(d.topicId).name}</span><h3>{d.title}</h3><p>{d.desc}</p>
            <div className="tags"><span>{d.duration}</span><span>{d.days}</span></div>
            <Btn act="open" val="preview">See this small step</Btn><Btn act="observe" cls="text">Just observe for now</Btn></div>
        ) : null}
        {ui.pending ? <TypingBubble /> : null}
        {ui.chatError ? <div className="chaterror" role="alert"><p>{ui.chatNeedsDemoConsent ? 'Allow labeled demo records to be sent to Gemini to continue.' : ui.chatError}</p><small>Your message is kept.</small><Btn act={ui.chatNeedsDemoConsent ? 'chat-allow-demo' : 'chat-retry'} cls="pillbtn" disabled={ui.pending}>{ui.chatNeedsDemoConsent ? 'Allow and continue' : 'Try again'}</Btn></div> : null}
        <NextUpCard />
      </div>
      {offer ? (
        <div className="aura-log-offer"><p>Keep one detail from your day?</p>
          {offer.name ? <Btn act="log-offer" cls="smallaction">{`Record the ${offer.name.toLowerCase()}`}</Btn> : <Btn act="log-offer" cls="smallaction">Log food or a drink</Btn>}
          <Btn act="checkin-topic" val={offer.topicId} cls="smallaction">{`Check in: ${topic(offer.topicId).name}`}</Btn></div>
      ) : null}
      </div></div>
      <div className="chatdock">
        {attach ? <div className="pillstack attach" role="menu">{[['food','Log food'],['caffeine','Log a drink'],['chatcheckin','Check in'],['photo','Choose a photo']].map(([id,label],i) => <button key={i} className="pillopt" role="menuitem" onClick={() => { setAttach(false); if(id==='photo') dispatch('chat-photo',undefined,{}); else dispatch('open',id,{}); }}>{label}</button>)}</div> : null}
        {sug.length ? <div className={`pillrow ${nextDemoTurn(s) ? 'demoprompts' : ''}`}>{sug.map(([l,act,v,data]) => <button key={l} className="pillopt" disabled={ui.pending || revealing} onClick={e => { const interaction=s.messages.at(-1)?.interaction; const option=interaction?.kind === 'suggestions' ? interaction.options.find(o=>o.label===l && o.text===v) : null; if(option) sendToAura(option.text,false,{messageIndex:s.messages.length-1,optionId:option.id,topicId:option.topicId}); else dispatch(act,v,data || {},e.currentTarget); }}>{l}</button>)}</div> : null}
        <div className="composerrow"><form id="chat-form" className={`composer pillcomposer ${text.trim() ? 'hastext' : ''}`} onSubmit={e => { e.preventDefault(); send(); }}>
          <button type="button" className={`cplus ${attach ? 'open' : ''}`} aria-expanded={attach} aria-label="Add to the conversation" onClick={() => setAttach(!attach)}>＋</button>
          <label className="sr-only" htmlFor="message">Message Aura</label>
          <textarea id="message" placeholder="Talk to Aura…" rows={1} required value={text} maxLength={2000}
            onChange={e => { setText(e.target.value); if (!ui.pending) ui.auraState = e.target.value ? 'listening' : 'idle'; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button className="csend" aria-label={ui.pending ? 'Waiting for Aura' : 'Send message'} type="submit" disabled={ui.pending || revealing} aria-busy={ui.pending}>↑</button>
        </form></div>
        <small className="footnote">{s.mode === 'demo' ? 'Suggested prompts use scripted demo replies. Free text uses Gemini when connected. Not medical advice.' : ui.ai.enabled ? 'Replies by Gemini, checked against your records. Not medical advice.' : 'Gemini is not connected. Messages are saved; AI replies are unavailable. Not medical advice.'}</small>
      </div>
    </main>
  );
}
