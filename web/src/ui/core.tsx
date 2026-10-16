'use client';
// Shared pieces ported from app.js: buttons that dispatch actions, the live Aura mark,
// the 1–5 slider, and the SVG art (kept as markup strings and injected into their
// parent element, so the CSS sees the same structure as the prototype).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { topic } from '@/domain/topics';
import type { Checkin } from '@/domain/state';
import { dispatch, type ActData } from './actions';
import { ui } from './store';

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function Btn({ act, val, data, cls = 'primary', children, disabled, label, id, style }: {
  act: string; val?: string | number; data?: ActData; cls?: string; children: ReactNode; disabled?: boolean; label?: string; id?: string; style?: CSSProperties;
}) {
  const key = `${act}|${val ?? ''}|${data ? Object.values(data).join('|') : ''}`;
  const armed = ui.armed === key;
  return (
    <button type="button" className={cls} disabled={disabled} aria-disabled={disabled || undefined} aria-label={label} id={id} style={style}
      onClick={e => dispatch(act, val === undefined ? undefined : String(val), data || {}, e.currentTarget, key)}>
      {armed ? armedLabel(act) : children}
    </button>
  );
}
const armedLabel = (act: string) => ({
  'delete-record': 'Tap again to delete', 'pause-obs': 'Tap again to stop observing', 'clear-health': 'Tap again to remove',
  reset: 'Tap again to delete everything', 'demo-load': 'Tap again: rebuilds demo records'
}[act] || 'Tap again');

export const Raw = ({ html, cls, tag = 'span', label }: { html: string; cls?: string; tag?: 'span' | 'div' | 'i'; label?: string }) => {
  const T = tag;
  return <T className={cls} aria-hidden={label ? undefined : true} aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
};

export const AuraMark = ({ size = '', state = 'idle' }: { size?: string; state?: string }) => (
  <span className={`live-aura aura-heart ${size}`} data-aura-state={state} aria-hidden="true"><span className="aura-atmosphere" /><span className="aura-core"><img className="aura-heart-image" src={`/assets/brand/aura-heart-${size === 'aura-hero' || size === 'aura-large' ? 'companion' : 'mark'}-v1.png`} width={1280} height={1280} alt="" draggable={false} /></span><span className="aura-ripple" /></span>
);

export function Option({ text, on, act, val, sub, type = 'radio' }: { text: string; on: boolean; act: string; val: string; sub?: string; type?: 'radio' | 'check' }) {
  const key = `${act}|${val}|`;
  return (
    <button type="button" className={`option ${on ? 'selected' : ''}`} role={type === 'radio' ? 'radio' : undefined}
      aria-checked={type === 'radio' ? on : undefined} aria-pressed={type === 'radio' ? undefined : on}
      onClick={e => dispatch(act, val, {}, e.currentTarget, key)}>
      <span>{ui.armed === key ? armedLabel(act) : text}{sub ? <small className="optsub">{sub}</small> : null}</span>
    </button>
  );
}

// 1–5 answer as one slider with a sentence that reads the answer back.
// ctx says where the value lives: checkin sheet, step feedback, or Today.
export const sentence = (topicId: string, v: number) => {
  const l = topic(topicId).labels[v - 1];
  return (/^[A-Z][a-z]/.test(l) && !/^Not /.test(l) ? l.toLowerCase() : l.charAt(0).toLowerCase() + l.slice(1)) + '.';
};
export function ScaleSlider({ topicId, choice, ctx, obs }: { topicId: string; choice: string | null | undefined; ctx: 'checkin' | 'fb' | 'quick'; obs?: string }) {
  const t = topic(topicId);
  const set = /^[1-5]$/.test(String(choice ?? ''));
  const v = set ? +choice! : 1;
  const rail = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const position = useRef((v - 1) / 4);
  const selected = useRef(v);
  const animation = useRef<number | null>(null);
  const paint = (fraction: number) => {
    position.current = fraction;
    const el = rail.current;
    if (!el) return;
    const width = Math.max(1, el.clientWidth - 36);
    el.style.setProperty('--position', `${fraction * 100}%`);
    el.style.setProperty('--lens-x', `${18 + fraction * width}px`);
    el.querySelectorAll<HTMLElement>('.railmarks i').forEach((mark, index) => {
      const distance = (index % 33) / 32 * (width - 2) + 1 - fraction * width;
      const strength = Math.exp(-Math.pow(distance / 13, 2));
      mark.style.transform = `translateX(${distance * .18 * strength}px) scaleY(${1 + .5 * strength})`;
    });
  };
  const settle = (target: number) => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { animation.current = null; paint(target); return; }
    const from = position.current;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 260);
      paint(from + (target - from) * (1 - Math.pow(1 - progress, 4)));
      if (progress < 1) animation.current = requestAnimationFrame(step);
      else animation.current = null;
    };
    animation.current = requestAnimationFrame(step);
  };
  const choose = (value: number) => {
    selected.current = value;
    dispatch('scale-range', String(value), { ctx, obs: obs || '' });
  };
  useEffect(() => {
    if (!dragging.current && animation.current === null) { selected.current = v; paint((v - 1) / 4); }
  }, [v, topicId, set]);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const resize = new ResizeObserver(() => paint(position.current));
    resize.observe(el);
    return () => { resize.disconnect(); if (animation.current !== null) cancelAnimationFrame(animation.current); };
  }, []);
  const point = (x: number) => {
    const box = rail.current!.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (x - box.left - 18) / (box.width - 36)));
    const movement = fraction - position.current;
    rail.current?.style.setProperty('--sheen-angle', `${105 + Math.max(-12, Math.min(12, movement * 500))}deg`);
    paint(fraction);
    const score = Math.round(fraction * 4) + 1;
    if (!set || score !== selected.current) choose(score);
  };
  const marks = Array.from({ length: 33 }, (_, i) => <i key={i} />);
  return (
    <div className={`slider ruler ${set ? 'set' : ''}`} data-topic={topicId}>
      <p className="sllead">{t.lead || t.name}</p>
      <p className="slvalue" aria-hidden="true">{set ? sentence(topicId, v) : 'Slide to answer'}</p>
      <div ref={rail} className="rulerrail" role="slider" tabIndex={0} aria-label={t.question} aria-valuemin={1} aria-valuemax={5} aria-valuenow={v} aria-valuetext={set ? `${v}, ${t.labels[v - 1]}` : 'Not answered'}
        onPointerDown={e => { if (animation.current !== null) { cancelAnimationFrame(animation.current); animation.current = null; } dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); point(e.clientX); }}
        onPointerMove={e => { if (dragging.current) point(e.clientX); }}
        onPointerUp={e => { if (dragging.current) { point(e.clientX); dragging.current = false; settle((selected.current - 1) / 4); } }}
        onPointerCancel={() => { dragging.current = false; settle((selected.current - 1) / 4); }}
        onKeyDown={e => { let n=v; if(e.key==='ArrowRight'||e.key==='ArrowUp')n=Math.min(5,v+1);else if(e.key==='ArrowLeft'||e.key==='ArrowDown')n=Math.max(1,v-1);else if(e.key==='Home')n=1;else if(e.key==='End')n=5;else return;e.preventDefault();choose(n);settle((n-1)/4); }}>
        <span className="railmarks" aria-hidden="true">{marks}</span>
        <span className="railcolour" aria-hidden="true"><span className="railmarks">{marks}</span></span>
        <span className="movinglens" aria-hidden="true" />
      </div>

      <div className="slends" aria-hidden="true"><span>{t.labels[0]}</span><span>{t.labels[4]}</span></div>
    </div>
  );
}

export function ScalePreview({ topicId }: { topicId: string }) {
  const t = topic(topicId);
  return (
    <>
      <ol className="scalepreview" aria-label="Answer scale">{t.labels.map((l, i) => <li key={l}><b>{i + 1}</b>{l}</li>)}</ol>
      <p className="soft">{t.direction} You can also answer “Not sure” or skip a day.</p>
    </>
  );
}

// "3/5 · Moderate", "Not sure", "Skipped" — never a bare number.
export function checkinStatus(c: Checkin | null | undefined, topicId: string) {
  if (!c) return null;
  if (c.status === 'recorded') return `${c.score}/5 · ${topic(topicId).labels[(c.score || 1) - 1]}`;
  return c.status === 'unknown' ? 'Not sure' : 'Skipped';
}
export const SourceTag = ({ source }: { source?: string }) =>
  source === 'sample' ? <span className="badge sample">Sample</span> : source === 'plan feedback' ? <span className="badge">From step feedback</span> : null;

export function ErrorLine({ id = 'sheet-error' }: { id?: string }) {
  return <p id={id} className="error" role="alert">{ui.err?.msg || ''}</p>;
}

// ---------- art (markup strings from the prototype) ----------
let artN = 0;
export function goalArt(group: string, size = 80) {
  const id = `ga${artN++}`;
  const glow = `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`;
  const shine = (cx: number, cy: number, r: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * .6}" fill="#fff" opacity=".55" filter="url(#${id}s)"/>`;
  const soft = `<filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>`;
  const art: Record<string, string> = {
    sleep: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff7ec"/><stop offset=".45" stop-color="#b9c4f5"/><stop offset="1" stop-color="#7a5fd0"/></radialGradient><mask id="${id}m"><rect width="100" height="100" fill="#fff"/><circle cx="62" cy="40" r="25" fill="#000"/></mask></defs>
      <circle cx="40" cy="58" r="20" fill="#9b8cf0" opacity=".5" filter="url(#${id}b)"/>
      <circle cx="48" cy="52" r="28" fill="url(#${id}g)" mask="url(#${id}m)"/>${shine(34, 42, 6)}
      <path d="M74 20l1.6 4.4 4.4 1.6-4.4 1.6L74 32l-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#ffe7c7"/><circle cx="80" cy="44" r="1.6" fill="#fff" opacity=".8"/>`,
    alertness: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#ffd46b"/><stop offset="1" stop-color="#f08a3c"/></radialGradient></defs>
      <circle cx="50" cy="52" r="24" fill="#ffb84d" opacity=".35" filter="url(#${id}b)"/>
      <path d="M50 14C53 38 58 45 82 50 58 55 53 62 50 88 47 62 42 55 18 50 42 45 47 38 50 14z" fill="url(#${id}g)"/>${shine(46, 40, 4)}
      <circle cx="76" cy="24" r="2" fill="#fff4d6"/>`,
    energy: `<defs>${glow}${soft}<linearGradient id="${id}g" x1=".5" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#ffd9a8"/><stop offset=".5" stop-color="#ff8a6a"/><stop offset="1" stop-color="#e2507a"/></linearGradient></defs>
      <ellipse cx="50" cy="62" rx="24" ry="22" fill="#ff7a6a" opacity=".4" filter="url(#${id}b)"/>
      <path d="M50 12C58 30 76 42 76 62a26 26 0 0 1-52 0c0-20 18-32 26-50z" fill="url(#${id}g)"/>
      <path d="M50 46c4 8 12 13 12 21a12 12 0 0 1-24 0c0-8 8-13 12-21z" fill="#fff1d6" opacity=".75"/>`,
    movement: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#e6fffa"/><stop offset=".45" stop-color="#6fd6e2"/><stop offset="1" stop-color="#3a62b8"/></radialGradient><mask id="${id}f"><rect x="0" y="54" width="100" height="50" fill="#fff" transform="rotate(-18 50 54)"/></mask></defs>
      <circle cx="50" cy="52" r="26" fill="#5ccfe0" opacity=".4" filter="url(#${id}b)"/>
      <ellipse cx="50" cy="54" rx="40" ry="11" fill="none" stroke="#cdeeff" stroke-opacity=".4" stroke-width="2.4" transform="rotate(-18 50 54)"/>
      <circle cx="50" cy="52" r="22" fill="url(#${id}g)"/>${shine(42, 42, 5)}
      <ellipse cx="50" cy="54" rx="40" ry="11" fill="none" stroke="#e6fbff" stroke-width="2.4" transform="rotate(-18 50 54)" mask="url(#${id}f)"/>
      <circle cx="87" cy="42" r="3.6" fill="#fff"/>`,
    mood: `<defs>${glow}${soft}<radialGradient id="${id}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff0f6"/><stop offset=".5" stop-color="#f6a3c4"/><stop offset="1" stop-color="#9a6be0"/></radialGradient><radialGradient id="${id}h" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f2fffb"/><stop offset=".5" stop-color="#9fe0d8"/><stop offset="1" stop-color="#6a8de0"/></radialGradient></defs>
      <circle cx="50" cy="54" r="28" fill="#e79ad0" opacity=".38" filter="url(#${id}b)"/>
      <circle cx="62" cy="40" r="15" fill="url(#${id}h)" opacity=".95"/>
      <circle cx="44" cy="58" r="22" fill="url(#${id}g)"/>${shine(37, 49, 5)}${shine(58, 35, 3)}`
  };
  return `<svg class="goalart" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${art[group] || ''}</svg>`;
}

export const HEALTH_TILE = `<svg viewBox="0 0 48 48" width="56" height="56"><defs><linearGradient id="heartg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b8a"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs><path d="M24 40.5S9 31.4 9 20.6A8.2 8.2 0 0 1 24 16a8.2 8.2 0 0 1 15 4.6C39 31.4 24 40.5 24 40.5z" fill="url(#heartg)"/></svg>`;

export const LOG_ART: Record<'food' | 'caffeine', string> = {
  food: `<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><defs><radialGradient id="lgfruit" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#ffe9cf"/><stop offset=".45" stop-color="#f5b69e"/><stop offset="1" stop-color="#cc798d"/></radialGradient><filter id="lgfruitblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs><ellipse cx="32" cy="36" rx="16" ry="18" fill="#edb38b" opacity=".2" filter="url(#lgfruitblur)"/><path d="M32 23c-7-7-20-3-20 10 0 12 10 23 20 23s20-11 20-23c0-13-13-17-20-10z" fill="url(#lgfruit)"/><path d="M32 21c0-8 7-13 14-13-1 8-7 13-14 13z" fill="#bdc9ad"/><path d="M32 23c-2-5-2-8 0-11" fill="none" stroke="#e4c6aa" stroke-width="2" stroke-linecap="round"/></svg>`,
  caffeine: `<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><defs><radialGradient id="lgdrop" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="#fff3d5"/><stop offset=".42" stop-color="#e7bb84"/><stop offset="1" stop-color="#aa765e"/></radialGradient><filter id="lgdropblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs><ellipse cx="32" cy="35" rx="15" ry="18" fill="#edbd87" opacity=".22" filter="url(#lgdropblur)"/><path d="M32 6c-3 12-17 22-17 33a17 17 0 0 0 34 0C49 28 35 18 32 6z" fill="url(#lgdrop)"/><path d="M32 22c-2 6-8 11-8 17a8 8 0 0 0 8 8" fill="none" stroke="#fff3dd" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/></svg>`
};

export const GEAR = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

// A flower whose petals fill one per day: filled of total.
export function flower(filled: number, total = 8) {
  const n = Math.max(5, Math.min(10, total));
  const petals = Array.from({ length: n }, (_, i) => `<ellipse cx="50" cy="22" rx="7.5" ry="15" transform="rotate(${(360 / n) * i} 50 50)" fill="${i < filled ? 'url(#flw)' : '#ffffff26'}"/>`).join('');
  return `<svg class="flower" viewBox="0 0 100 100" width="104" height="104" aria-hidden="true"><defs><linearGradient id="flw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9b8"/><stop offset="1" stop-color="#eeb28b"/></linearGradient><radialGradient id="flc"><stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#eeb28b00"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#flc)" opacity="${filled ? .25 : 0}"/>${petals}</svg>`;
}
export const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
