import { AuraReplySchema, ReviewSchema } from '@/domain/conversation';
import { updateGoals } from '@/domain/goals';
// Interactions (ported from events.js). Every control calls dispatch(action, value, data),
// mirroring the prototype's data-act / data-val / data-* attributes. The fake parts are
// replaced: Aura's replies come from /api/aura (Gemini, grounded), food photos from
// /api/photo (Gemini vision), and records are saved to this visitor's server session.
import { addDays, localDateTime, uid } from '@/domain/dates';
import { analyze, insight } from '@/domain/uiDiscovery';
import { stepDraft } from '@/domain/uiSteps';
import { buildDemo } from '@/domain/demo';
import { bridge, importExportFile, importFromBridge, seedSample, setDataSource, simulateAppleHealth } from '@/domain/health';
import {
  acceptPlan, activeObservations, addObservation, blank, currentPlans, dayCheckin, observation, plan as findPlan,
  removeRecord, saveCheckin, saveEntry, setPlanStatus, type CheckinStatus, type Feedback, type HealthImport, type Message, type PhotoExtraction, type StepDraft
} from '@/domain/state';
import { CONCERNS, GOALS, topic, isTopicId, type TopicId } from '@/domain/topics';
import { apiUrl, command, switchMode, refreshLinkedHealth, flush, render, resetAll, S, save, setSt, toast, today, ui, type ModalData } from './store';

export type ActData = Record<string, string | undefined>;

export const SAMPLE_PHOTOS = [
  { id: 'mocha', src: '/assets/food/iced-mocha.jpg', name: 'Iced mocha' },
  { id: 'salad', src: '/assets/food/salad.jpg', name: 'Spinach salad' },
  { id: 'lasagna', src: '/assets/food/lasagna.jpg', name: 'Lasagna' }
];
export const OB_TITLES = ['What’s been getting in the way lately?', 'Your first observation.', 'When should Aura ask?', 'What have you tried so far?', 'What should a step work around?', 'Sync with Apple Health', 'Check your starting point.'];
export const OB_LAST = OB_TITLES.length - 1;

const val = (id: string) => { const el = document.getElementById(id) as HTMLInputElement | null; return el ? el.value : ''; };
const checked = (id: string) => !!(document.getElementById(id) as HTMLInputElement | null)?.checked;

// Errors appear in the sheet's error line; the field they concern gets focus.
function err(msg: string, field?: string) {
  ui.err = { msg, field };
  render();
  if (field) requestAnimationFrame(() => (document.querySelector(field) as HTMLElement | null)?.focus());
}
// Destructive actions ask for a second tap in place (no browser dialogs).
let armTimer: ReturnType<typeof setTimeout> | undefined;
function confirmTap(key: string) {
  if (ui.armed === key) { ui.armed = null; return true; }
  ui.armed = key; render();
  clearTimeout(armTimer);
  armTimer = setTimeout(() => { ui.armed = null; render(); }, 4000);
  return false;
}
let seq = 0;
let opener: HTMLElement | null = null;
export function openModal(name: string, data: ModalData = {}, from?: HTMLElement | null) {
  if (!ui.modal) opener = from || null;
  ui.modal = name; ui.m = data; ui.modalSeq = ++seq; ui.err = null;
}
// Sheets opened from Settings return to Settings when they close.
export function close() {
  const back = ui.m && ui.m.back;
  ui.err = null;
  if (back) { ui.modal = back; ui.m = {}; ui.modalSeq = ++seq; return; }
  if (ui.modal) { const el = opener; opener = null; requestAnimationFrame(() => el?.isConnected && el.focus()); }
  ui.modal = null; ui.m = {};
}
function ensureObservation(topicId: TopicId) {
  const s = S();
  let o = activeObservations(s).find(x => x.topicId === topicId);
  if (!o) {
    o = addObservation(s, topicId);
    if (s.dataSource === 'sample') seedSample(s, o, today());
    save();
    toast(`${topic(topicId).name} added to your observations`);
  }
  return o;
}
export const focusTopic = (): TopicId => (activeObservations(S())[0] || { topicId: 'evening-energy' as const }).topicId;

// ---------- onboarding ----------
export function startOnboarding() {
  const s = S();
  ui.ob = { consent: { terms: false, health: false, share: false }, concerns: [], goalId: null, topicId: null, time: null, attempts: [], attemptsNote: '', constraint: 'Keep it simple', data: 'apple-health', types: { sleep: true, activity: true, cycle: true, hrv: true } };
  // Apple Health starts on (simulated unless a real export or the bridge is used); the user can switch it off.
  if (ui.mode === 'demo' && !s.healthImport) { s.healthImport = simulateAppleHealth(today()); save(); }
  ui.step = 0; ui.fromReview = false; ui.page = 'onboarding';
}
function saveObFields() {
  if (!ui.ob) return;
  if (ui.step === 2 && document.getElementById('ob-time')) ui.ob.time = val('ob-time');
  if (ui.step === 3 && document.getElementById('ob-attempt-note')) ui.ob.attemptsNote = val('ob-attempt-note').trim();
}
function finishOnboarding() {
  const s = S(), o = ui.ob!;
  s.profile = { ...s.profile, consent: { ...o.consent, at: new Date().toISOString() }, concerns: o.concerns, goalId: (GOALS.find(g => g.topicId === o.topicId) || { id: null }).id, attempts: o.attempts, attemptsNote: o.attemptsNote, constraint: o.constraint, context: [] };
  s.healthTypes = { ...o.types };
  const obs = addObservation(s, o.topicId!, o.time);
  const priorGoals = s.profile.goals || [];
  s.profile.goals = o.concerns.map((id,i) => priorGoals.find(g => g.id === id) || ({ id, label: CONCERNS[id]?.goal || id, observationIds: [], priority: i+1 }));
  obs.goalIds = s.profile.goals.filter(g => !!CONCERNS[g.id]?.w[obs.topicId]).map(g => g.id);
  for (const g of s.profile.goals) if (obs.goalIds.includes(g.id) && !g.observationIds.includes(obs.id)) g.observationIds.push(obs.id);
  s.onboarded = true;
  setDataSource(s, o.data === 'apple-health' && !s.healthImport ? 'none' : o.data, today());
  save();
  ui.todaySweepDone = false;
  ui.page = 'app'; ui.tab = 'today'; ui.ob = null;
  ui.explore.obsId = obs.id;
}

// ---------- Apple Health ----------
function applyHealthImport(h: HealthImport) {
  const s = S();
  s.healthImport = h;
  if (ui.ob) ui.ob.data = 'apple-health'; else setDataSource(s, 'apple-health', today());
  save();
}
export async function runHealthImport(file: File) {
  ui.importing = 0; ui.err = null; render();
  try {
    let last = 0;
    const h = await importExportFile(file, p => { if (p - last > 0.05) { last = p; ui.importing = p; render(); } });
    ui.importing = null;
    applyHealthImport(h); render();
    toast('Apple Health records imported');
  } catch (e) {
    ui.importing = null;
    err(e instanceof Error ? e.message : 'Couldn’t read that file.');
  }
}
async function runBridgeImport() {
  const s = S();
  const types = Object.entries(ui.ob ? ui.ob.types : s.healthTypes).filter(([, v]) => v).map(([k]) => k);
  try {
    applyHealthImport(await importFromBridge(types, addDays(today(), -60), today()));
    render(); toast('Apple Health connected');
  } catch (e) { err(e instanceof Error ? e.message : 'Apple Health is not available.'); }
}
export const hasBridge = () => !!bridge();

// Link real Apple Health through the Aura iOS app: a one-time link shown as a QR code
// (desktop) or an "Open the Aura app" button (iPhone). The app sends daily totals to
// this session; this sheet polls until they arrive.
async function startHealthLink(el?: HTMLElement | null) {
  openModal('healthlink', { back: ui.modal === 'data' ? 'data' : undefined, link: { status: 'starting' } }, el);
  render();
  const seqAt = ui.modalSeq;
  try {
    const res = await fetch(apiUrl('/api/health/link'), { method: 'POST' });
    if (!res.ok) throw new Error();
    const l: { token: string; url: string; appUrl: string; expiresAt: number } = await res.json();
    const { default: QRCode } = await import('qrcode');
    const qr = await QRCode.toString(l.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    if (ui.modalSeq !== seqAt) return;
    ui.m.link = { ...l, qr, status: 'waiting' };
    render();
    pollHealthLink(seqAt, l.token, l.expiresAt);
  } catch {
    if (ui.modalSeq === seqAt) { ui.m.link = { status: 'error' }; render(); }
  }
}
function pollHealthLink(seqAt: number, token: string, expiresAt: number) {
  const tick = async () => {
    if (ui.modalSeq !== seqAt) return; // sheet closed: stop
    if (Date.now() > expiresAt) { ui.m.link!.status = 'expired'; render(); return; }
    try {
      const res = await fetch(apiUrl(`/api/health/link/${token}`));
      const out: { status?: string; import?: HealthImport | null } = await res.json();
      if (ui.modalSeq !== seqAt) return;
      if (out.status === 'done' && out.import) {
        await refreshLinkedHealth(); if (ui.ob) ui.ob.data = 'apple-health';
        close(); render(); toast('Apple Health connected');
        return;
      }
      if (out.status === 'expired' || res.status === 404) { ui.m.link!.status = 'expired'; render(); return; }
    } catch { /* offline for a moment: keep trying until the link expires */ }
    setTimeout(tick, 2000);
  };
  setTimeout(tick, 2000);
}

// ---------- food photos: Gemini proposes, the user confirms ----------
export async function readPhoto(body: FormData) {
  const seqAt = ui.modalSeq;
  Object.assign(ui.m, { picking: false, reading: true, photoError: undefined, extraction: null });
  render();
  try {
    const res = await fetch(apiUrl('/api/photo'), { method: 'POST', body });
    const out: { photoUrl?: string; extraction?: PhotoExtraction | null; error?: string } = await res.json();
    if (ui.modalSeq !== seqAt) return; // the sheet was closed meanwhile
    if (!res.ok || !out.photoUrl) { Object.assign(ui.m, { reading: false, photoError: out.error || 'Couldn’t upload the photo.' }); render(); return; }
    const x = out.extraction;
    Object.assign(ui.m, {
      reading: false, photo: out.photoUrl, extraction: x || null, photoError: out.error,
      ...(x ? { name: x.name, note: x.note, caffeine: x.caffeinated === 'yes', drink: x.drink || undefined } : {}),
      fill: (ui.m.fill || 0) + 1 // remount the fields with the suggested values
    });
  } catch {
    if (ui.modalSeq === seqAt) Object.assign(ui.m, { reading: false, photoError: 'Couldn’t reach the server. Fill in the details yourself.' });
  }
  render();
}
export function pickDeviceFile(f: File) {
  if (!f.type.startsWith('image/') || f.size > 8 * 1024 * 1024) { err('Choose an image smaller than 8 MB.'); return; }
  const fd = new FormData(); fd.set('photo', f);
  ui.m.photo = URL.createObjectURL(f);
  readPhoto(fd);
}

// ---------- Aura ----------
function revealLatestAuraMessage() {
  requestAnimationFrame(() => {
    if (ui.tab !== 'aura') return;
    const message = document.querySelector('.messages .cb:last-child');
    message?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
}
export async function sendToAura(text: string, retry = false, choice?: { messageIndex: number; optionId: string; topicId?: TopicId }) {
  if (ui.pending) return;
  const s = S();
  if (!retry) s.messages.push({ role: 'user', text });
  ui.freshMsg = s.messages.length;
  ui.chatError = null; ui.failedMessage = null;
  ui.pending = true; ui.auraState = 'understanding'; ui.page = 'app'; ui.tab = 'aura'; ui.logOffer = null; ui.draft = null;
  close(); save(); render();
  revealLatestAuraMessage();
  let reply: ReturnType<typeof AuraReplySchema.parse>;
  const abort = new AbortController(); const timeout = setTimeout(()=>abort.abort(),30000);
  try {
    await flush();
    const res = await fetch(apiUrl('/api/aura'), { signal: abort.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, today: today(), inputRevision: S().inputRevision || 0, choice, selectedTopic: choice?.topicId || (ui.explore.obsId ? S().observations.find(o => o.id === ui.explore.obsId)?.topicId || null : null) }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not reach Aura. Try again.');
    reply = AuraReplySchema.parse(data.reply);
    if (typeof data.inputRevision === 'number') S().inputRevision = data.inputRevision;
    if (Array.isArray(data.plans)) S().plans = data.plans;
  } catch (e) {
    ui.chatError = e instanceof Error ? e.message : 'Could not reach Aura.';
    ui.failedMessage = text; ui.pending = false; ui.auraState = 'idle'; render(); return;
  } finally { clearTimeout(timeout); }
  if (reply.stopPlanId) {
    const p = findPlan(S(), reply.stopPlanId);
    if (p && p.status === 'active') {
      try { await command('decide',{planId:p.id,planVersion:p.version,choice:'stop'}); toast('Step paused'); }
      catch(e) { ui.chatError = e instanceof Error ? e.message : 'Could not save the paused step.'; }
    }
  }
  S().messages.push({ role: 'guide', text: reply.text, action: reply.action as Message['action'] || null, meta: { via: reply.via, safety: reply.safety?.level, cited: reply.cited }, interaction: reply.interaction as Message['interaction'], insights: reply.insights, draft: reply.draft as StepDraft | null, logOffer: reply.logOffer as typeof ui.logOffer });
  ui.freshMsg = S().messages.length;
  ui.draft = reply.draft as StepDraft || null; ui.logOffer = reply.logOffer as typeof ui.logOffer || null;
  ui.pending = false; ui.auraState = 'insight';
  save(); render();
  revealLatestAuraMessage();
  setTimeout(() => { ui.auraState = 'idle'; render(); }, 1600);
}

// ---------- the dispatcher ----------
export function dispatch(a: string, v: string | undefined, d: ActData, el?: HTMLElement | null, key = `${a}|${v ?? ""}|`) {
  const s = S();
  if (a !== 'scale-range') ui.err = null;
  const done = () => {
    render();
    if (!ui.modal && ['tab', 'begin', 'demo-load', 'goexplore', 'home', 'confirm-plan'].includes(a)) {
      // Aura opens at the latest message; other tabs at the top.
      requestAnimationFrame(() => (ui.tab === 'aura' && ui.page === 'app' && S().messages.length) ? window.scrollTo(0, document.documentElement.scrollHeight) : window.scrollTo(0, 0));
    }
  };

  switch (a) {
    // navigation
    case 'home': if (ui.page === 'app') { ui.tab = 'today'; close(); } break;
    case 'tab': if (v === 'aura' && ui.tab !== 'aura') ui.previousTab = ui.tab; ui.page = 'app'; ui.tab = v as typeof ui.tab; close(); break;
    case 'aura-close': {
      const page=document.querySelector('.chatpage');
      if(page && !matchMedia('(prefers-reduced-motion: reduce)').matches){
        if(page.classList.contains('leaving')) return;
        page.classList.add('leaving');
        setTimeout(()=>{ui.tab=ui.previousTab;close();render();window.scrollTo(0,0);},240);return;
      }
      ui.tab=ui.previousTab;close();break;
    }
    case 'begin': startOnboarding(); break;
    case 'demo': openModal('demo', {}, el); break;
    case 'demo-personal': switchMode('personal').catch(e => err(e.message)); return;
    case 'demo-load': {
      if (!confirmTap(key)) { toast('Tap the same timeline again to confirm. Personal records are kept.'); return; }
      (async () => {
        await switchMode('demo');
        await command('demo', { day: Number(v), now: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        ui.page = 'app'; ui.tab = 'today'; ui.modal = null; ui.reviewResult = null; render();
      })().catch(e => err(e.message)); return;
    }
    case 'open': {
      const m: ModalData = { obsId: d.obs, recId: d.rec, planId: d.plan, date: d.date, doc: d.doc };
      if (ui.modal === 'settings') m.back = 'settings';
      if (d.choice) m.choice = d.choice;
      if (v === 'checkin' && !d.rec && !d.keepDate && d.date === undefined) m.date = ui.tab === 'explore' ? ui.explore.date || undefined : undefined;
      if (v === 'caffeine' && ui.tab === 'explore' && !d.rec && !d.date) m.date = ui.explore.date || undefined;
      // Logging from Your day uses the time under the centre pin.
      if (d.fromDay && ui.dayAt && (v === 'food' || v === 'caffeine')) m.time = `${today()}T${ui.dayAt.time}`;
      openModal(v!, m, el);
      break;
    }
    case 'chat-photo': openModal('food',{picking:true},el); break;
    case 'chat-retry': if (ui.failedMessage) sendToAura(ui.failedMessage, true); return;
    case 'nextup-shuffle': ui.nextUp = (ui.nextUp || 0) + 1; break;
    case 'close': close(); break;
    case 'backdrop': close(); break;
    case 'goals-toggle': ui.goalsOpen = !ui.goalsOpen; break;
    case 'disc-try': {
      // A finding's suggested step opens the usual step preview.
      const o = observation(s, d.obs);
      if (!o) break;
      const r = analyze(s, o, today());
      const f = r.factors.find(x => x.id === v);
      const i = f && insight(r, f);
      if (!i || !i.step) break;
      ui.draft = { ...i.step };
      openModal('preview', {}, el);
      break;
    }
    case 'goexplore':
      ui.page = 'app'; ui.tab = 'explore'; close();
      if (d.obs) ui.explore.obsId = d.obs;
      break;

    // onboarding
    case 'ob-concern': { const o = ui.ob!; o.concerns = o.concerns.includes(v!) ? o.concerns.filter(x => x !== v) : [...o.concerns, v!]; break; }
    case 'ob-topic': {
      const deck = document.getElementById('topic-deck');
      const card = deck?.querySelector<HTMLElement>(`[data-topic="${v}"]`);
      if (card && deck) deck.scrollTo({ left: card.offsetLeft - (deck.clientWidth - card.clientWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      ui.ob!.topicId = v as TopicId; ui.ob!.time = null;
      break;
    }
    case 'ob-attempt': {
      saveObFields();
      const o = ui.ob!;
      o.attempts = v === 'Nothing yet' ? (o.attempts.includes(v) ? [] : [v]) : (o.attempts.includes(v!) ? o.attempts.filter(x => x !== v) : [...o.attempts.filter(x => x !== 'Nothing yet'), v!]);
      break;
    }
    case 'ob-constraint': saveObFields(); ui.ob!.constraint = v!; break;
    case 'ob-edit': saveObFields(); ui.step = +v!; ui.fromReview = true; break;
    case 'ob-back':
      saveObFields();
      if (ui.fromReview) { ui.step = OB_LAST; ui.fromReview = false; } else if (ui.step) ui.step--; else ui.page = 'splash';
      break;
    case 'ob-next': {
      saveObFields();
      const o = ui.ob!;
      if (ui.step === 0 && !o.concerns.length) return err('Choose at least one.');
      if (ui.step === 1 && !o.topicId) return err('Choose an observation to continue.');
      if (ui.step === 2 && !o.time) o.time = topic(o.topicId).timing.defaultTime;
      if (ui.step === OB_LAST && !(o.consent.terms && o.consent.health)) return err('Agree to the terms and allow data use to start.');
      if (ui.step === OB_LAST) finishOnboarding();
      else if (ui.fromReview) { ui.step = OB_LAST; ui.fromReview = false; }
      else ui.step++;
      requestAnimationFrame(() => window.scrollTo(0, 0));
      break;
    }
    case 'ob-consent': ui.ob!.consent[v as 'terms'] = d.checked === '1'; break;
    case 'ob-type': ui.ob!.types[v as 'sleep'] = d.checked === '1'; break;
    case 'toggle-type': s.healthTypes[v as 'sleep'] = d.checked === '1'; save(); break;
    case 'health-bridge': runBridgeImport(); return;
    case 'health-link': startHealthLink(el); return;

    // check-ins
    case 'scale-range': {
      if (d.ctx === 'checkin') ui.m.choice = v;
      if (d.ctx === 'fb') ui.fb.d.answer = v;
      if (d.ctx === 'quick') ui.quick[d.obs!] = v!;
      break;
    }
    case 'pick-answer': ui.m.choice = v; break;
    case 'done-open': openModal(v!, {}); break;
    case 'done-step': {
      // Answer "did you do your step" from the completion screen; today's check-in is the feeling answer.
      const o = observation(s, ui.m.obsId);
      const p = o && currentPlans(s).find(x => x.observationId === o.id && x.status === 'active');
      const c = o && dayCheckin(s, o.id, today());
      if (!o || !p || !c) { close(); break; }
      const fb: Feedback = { id: uid('fb'), planId: p.id, planVersion: p.version, observationId: o.id, date: today(), at: new Date().toISOString(), execution: v === 'yes' ? 'Done' : 'Not done', answer: c.status === 'recorded' ? String(c.score) : c.status, score: c.score, change: 'Not answered', barriers: [], note: '' };
      ui.saving = true; render();
      command('feedback', { ...fb, change: 'Not answered', barriers: [], occurredAt: localDateTime() }).then(() => openModal('review', { planId: p.id })).catch(e => err(e.message)).finally(() => { ui.saving = false; render(); }); return;
    }
    case 'quick-save': {
      // Save straight from Today: now, with the slider's answer.
      const o = observation(s, d.obs)!, q = ui.quick[o.id];
      if (!q) return;
      saveCheckin(s, { observationId: o.id, topicId: o.topicId, occurredAt: localDateTime(), status: 'recorded', score: +q, note: '' });
      delete ui.quick[o.id];
      save();
      openModal('done', { obsId: o.id }, el);
      break;
    }
    case 'checkin-topic': {
      if (!isTopicId(v)) return err('Choose a valid check-in topic.');
      const o = activeObservations(s).find(o => o.topicId === v);
      if (!o) { openModal('addobs', { topicId: v }, el); break; }
      const note = ui.logOffer?.note || '';
      ui.logOffer = null;
      openModal('checkin', { obsId: o.id, note }, el);
      break;
    }
    case 'save-checkin': {
      const o = observation(s, ui.m.obsId)!, time = val('chk-time');
      if (!ui.m.choice) return err('Slide to answer, or choose “Not sure” or “Skip today”, or save your words only.');
      if (!time) return err('Add when this was.', '#chk-time');
      if (time.slice(0, 16) > localDateTime()) return err('This time is in the future.', '#chk-time');
      const rec = ui.m.recId ? s.checkins.find(c => c.id === ui.m.recId) : null;
      const recorded = /^[1-5]$/.test(ui.m.choice);
      if (ui.m.choice === 'text-only' && !val('chk-note').trim()) return err('Add the words you want to save.', '#chk-note');
      saveCheckin(s, Object.assign(rec ? { id: rec.id, source: rec.source, feedbackId: rec.feedbackId, createdAt: rec.createdAt } : {}, {
        observationId: o.id, topicId: o.topicId, occurredAt: time, status: (recorded ? 'recorded' : ui.m.choice) as CheckinStatus, score: recorded ? +ui.m.choice : null, note: val('chk-note').trim()
      }));
      if (rec && rec.feedbackId) { const f = s.feedbacks.find(x => x.id === rec.feedbackId); if (f) { f.answer = ui.m.choice; f.score = recorded ? +ui.m.choice : null; } }
      save();
      if (!rec && time.slice(0, 10) === today()) { openModal('done', { obsId: o.id }); break; }
      if (ui.tab === 'aura') ui.nextUp = 0;
      toast(rec ? 'Correction saved' : 'Check-in saved');
      close();
      break;
    }
    case 'delete-record': {
      if (!confirmTap(key)) return;
      const kind = d.kind as 'checkin' | 'entry', id = d.rec!;
      if (kind === 'checkin') { const c = s.checkins.find(x => x.id === id); if (c && c.feedbackId) { const f = s.feedbacks.find(x => x.id === c.feedbackId); if (f) { f.answer = null; f.score = null; } } }
      removeRecord(s, kind, id); save(); toast('Record deleted'); close(); break;
    }

    // food & caffeine
    case 'save-food': {
      const name = val('food-name').trim(), time = val('food-time');
      if (!name) return err('Add a food or drink name.', '#food-name');
      if (!time) return err('Add when you had it.', '#food-time');
      if (time > localDateTime()) return err('This time is in the future.', '#food-time');
      if (ui.m.reading) return err('Still reading the photo…');
      const caffeine = val('food-caffeine') as 'yes' | 'no' | 'unknown';
      const photo = ui.m.photo && !ui.m.photo.startsWith('blob:') ? ui.m.photo : undefined;
      saveEntry(s, { id: ui.m.recId, kind: 'food', caffeinated: caffeine, name, occurredAt: time, note: val('food-note').trim(), photoUrl: photo, extracted: ui.m.extraction ?? undefined });
      save();
      if (ui.tab === 'aura') ui.nextUp = 0;
      toast(ui.m.recId ? 'Correction saved' : `${name} saved`);
      if (caffeine === 'yes') openModal('caffeine', { time, drink: ui.m.drink, size: '' }); else close();
      break;
    }
    case 'photo-pick-open': ui.m.picking = true; break;
    case 'photo-cancel': ui.m.picking = false; break;
    case 'pick-photo': {
      const p = SAMPLE_PHOTOS.find(x => x.id === v)!;
      ui.m.photo = p.src;
      const fd = new FormData(); fd.set('sample', p.id);
      readPhoto(fd);
      return;
    }
    case 'save-drink': {
      const time = val('drink-time'), raw = val('drink-mg'), mg = raw === '' ? null : Number(raw);
      if (!time) return err('Add when you drank it.', '#drink-time');
      if (time > localDateTime()) return err('This time is in the future.', '#drink-time');
      if (mg !== null && (!Number.isFinite(mg) || mg < 0 || mg > 2000)) return err('Enter 0–2000 mg, or leave it blank if unknown.', '#drink-mg');
      saveEntry(s, { id: ui.m.recId || undefined, kind: 'caffeine', caffeinated: 'yes', name: val('drink-type'), size: val('drink-size').trim(), occurredAt: time, mg, note: val('drink-note').trim() });
      if (ui.tab === 'aura') ui.nextUp = 0;
      save(); toast(ui.m.recId ? 'Correction saved' : 'Drink saved'); close(); break;
    }
    case 'log-offer': {
      const offer = ui.logOffer;
      ui.logOffer = null;
      openModal('food', { name: offer?.name, note: offer?.note, fill: 1 }, el);
      break;
    }

    // observations & data
    case 'save-goals': {
      try { updateGoals(s, JSON.parse(d.goals || '[]')); }
      catch (error) { return err(error instanceof Error ? error.message : 'Check your goal selections.'); }
      save(); close(); toast('Goals saved'); break;
    }
    case 'share-toggle': s.profile.consent = Object.assign({ terms: true, health: true, share: false }, s.profile.consent, { share: !(s.profile.consent && s.profile.consent.share) }); save(); break;
    case 'save-obsedit': {
      const o = observation(s, ui.m.obsId)!, time = val('obsedit-time');
      if (!time) return err('Choose a time.', '#obsedit-time');
      o.time = time;
      o.goalIds = (s.profile.goals || []).filter(g => checked(`goal-link-${g.id}`)).map(g => g.id);
      for (const g of s.profile.goals || []) g.observationIds = g.observationIds.filter(id => id !== o.id).concat(o.goalIds.includes(g.id) ? [o.id] : []);
      save(); toast(`${topic(o.topicId).name} at ${time}`); close(); break;
    }
    case 'pause-obs': {
      if (!confirmTap(key)) return;
      const o = observation(s, ui.m.obsId)!; o.status = 'paused'; save(); toast(`Stopped observing ${topic(o.topicId).name.toLowerCase()}`); close(); break;
    }
    case 'pick-topic': ui.m.topicId = v as TopicId; break;
    case 'save-obs': { const o = addObservation(s, ui.m.topicId!, val('obs-time')); o.goalIds = (s.profile.goals || []).filter(g => !!CONCERNS[g.id]?.w[o.topicId]).map(g => g.id); for (const g of s.profile.goals || []) if (o.goalIds.includes(g.id) && !g.observationIds.includes(o.id)) g.observationIds.push(o.id); o.goalIds = (s.profile.goals || []).filter(g => checked(`goal-link-${g.id}`)).map(g => g.id); for (const g of s.profile.goals || []) g.observationIds = g.observationIds.filter(id => id !== o.id).concat(o.goalIds.includes(g.id) ? [o.id] : []); if (s.dataSource === 'sample') seedSample(s, o, today()); save(); ui.explore.obsId = o.id; toast(`${topic(o.topicId).name} added`); close(); break; }
    case 'exp-obs': ui.explore.obsId = v!; break;
    case 'exp-date': ui.explore.date = v!; break;
    case 'exp-metric': ui.explore.metric = v!; break;
    case 'exp-range-set': ui.explore.range = +v!; break;
    case 'goal-remove': {
      s.profile.goals = (s.profile.goals || []).filter(g => g.id !== v);
      s.observations.forEach(o => o.goalIds = (o.goalIds || []).filter(id => id !== v));
      save();
      toast('Removed the goal. Add it back in Settings.');
      break;
    }
    case 'exp-goto': if (v! < addDays(today(), -(ui.explore.range - 1))) ui.explore.range = 14; ui.explore.date = v!; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
    case 'health-toggle': openModal('data', {}, el); break;
    case 'health-use-toggle': {
      if (!s.healthImport) return;
      const on = (ui.ob ? ui.ob.data : s.dataSource) === 'apple-health';
      if (ui.ob) ui.ob.data = on ? 'none' : 'apple-health';
      else { setDataSource(s, on ? 'none' : 'apple-health', today()); save(); }
      break;
    }
    case 'sample-toggle':
      if (ui.mode === 'personal') { openModal('demo', {}, el); break; }
      setDataSource(s, s.dataSource === 'sample' ? 'none' : 'sample', today()); save();
      toast(s.dataSource === 'sample' ? 'Sample history on' : 'Sample history off');
      break;
    case 'clear-health': {
      if (!confirmTap(key) || ui.saving) return;
      ui.saving=true;render();
      (async()=>{await flush();const res=await fetch(apiUrl('/api/health/import'),{method:'DELETE'});if(!res.ok)throw new Error('Could not remove health data. Try again.');S().healthImport=null;if(S().dataSource==='apple-health')setDataSource(S(),'none',today());save();await flush();toast('Apple Health data removed');})().catch(e=>err(e.message)).finally(()=>{ui.saving=false;render();});return;
    }

    // Aura & plans
    case 'prompt': sendToAura(v!); return;
    case 'adjust-chat': sendToAura('Help me adjust this step for a busy week.'); return;
    case 'observe': { const id = ui.draft?.topicId; if (!id) return err('Choose a check-in topic first.'); ui.draft = stepDraft(`observe:${id}`, id); openModal('accept', {}, el); break; }
    case 'plan-obs': ui.m.target = d.value; break;
    case 'confirm-plan': {
      if (ui.saving || !ui.draft) return;
      const draft = ui.draft, target = ui.m.target || activeObservations(s).find(o => o.topicId === draft.topicId)?.id;
      const reviewId = ui.m.aiReviewId, requestId = ui.m.requestId;
      const source = reviewId ? s.aiReviews?.find(r => r.id === reviewId) : null;
      const step = draft.kind === 'observe' ? draft.step : val('plan-step');
      ui.saving = true; render();
      command('accept', { stepId: draft.stepId, topicId: draft.topicId, observationId: target, step, start: val('plan-start'), review: val('plan-review'), aiReviewId: reviewId, requestId, planId: source?.planId }).then(() => {
        ui.draft = null; const lastGuide = S().messages.findLast(m=>m.role==='guide'); if(lastGuide) lastGuide.draft=null; save(); close(); ui.page = 'app'; ui.tab = 'aura'; toast('Step saved');
      }).catch(e => err(e.message)).finally(() => { ui.saving = false; render(); }); return;
    }

    case 'feedback': {
      const p = findPlan(s, d.plan)!;
      const existing = s.feedbacks.find(f => f.planId === p.id && f.date === today());
      ui.fb = { planId: p.id, step: 0, d: existing ? { ...existing } : {} };
      openModal('feedback', { planId: p.id }, el);
      break;
    }
    case 'fb-exec': ui.fb.d.execution = v; break;
    case 'fb-answer': ui.fb.d.answer = v; break;
    case 'fb-barrier': { const list = ui.fb.d.barriers || []; ui.fb.d.barriers = d.checked === '1' ? [...list, v!] : list.filter(x => x !== v); break; }
    case 'fb-back': if (ui.fb.step === 1) ui.fb.d.change = val('fb-change'); if (ui.fb.step === 2) ui.fb.d.note = val('fb-note'); ui.fb.step--; break;
    case 'fb-next': {
      const fd = ui.fb.d;
      if (ui.fb.step === 0 && !fd.execution) return err('Choose an answer, including Not sure.');
      if (ui.fb.step === 1) { if (!fd.answer) return err('Slide to answer, or choose “Not sure” or “Skip today”, or save your words only.'); fd.change = val('fb-change'); }
      if (ui.fb.step < 2) { ui.fb.step++; break; }
      fd.note = val('fb-note').trim();
      const p = findPlan(s, ui.fb.planId)!;
      if (ui.saving) return;
      ui.saving = true; fd.id ||= uid('fb'); render();
      command('feedback', { ...fd, id: fd.id, date: fd.date || today(), occurredAt: `${fd.date || today()}T${localDateTime().slice(11,16)}`, planId: p.id, planVersion: p.version, change: fd.change || 'Not answered', barriers: fd.barriers || [] }).then(() => {
        ui.reviewStatus = 'idle'; ui.reviewResult = null; openModal('review', { planId: p.id }); toast('Feedback saved');
      }).catch(e => err(e.message)).finally(() => { ui.saving = false; render(); }); return;
    }
    case 'review-ai': requestReview(ui.m.planId!); return;
    case 'review-accept': {
      const r = ui.reviewResult || s.aiReviews?.filter(r => r.planId === ui.m.planId).at(-1);
      if (!r?.proposal) return;
      ui.draft = r.proposal; openModal('accept', { target: s.plans.find(p => p.id === r.planId)?.observationId, aiReviewId: r.id, requestId: r.requestId }); break;
    }
    case 'decide': {
      const p = findPlan(s, ui.m.planId)!;
      if (v === 'adjust') { ui.reviewStatus = 'idle'; requestReview(p.id); return; }
      if (ui.saving) return;
      ui.saving = true; render();
      const r = ui.reviewResult || s.aiReviews?.filter(r => r.planId === p.id).at(-1);
      command('decide', { planId: p.id, planVersion: p.version, choice: v, aiReviewId: r?.id, requestId: r?.requestId }).then(() => { close(); toast('Decision saved'); }).catch(e => err(e.message)).finally(() => { ui.saving = false; render(); }); return;
    }
    case 'cycle-context': s.profile.includeCycleContext = d.checked === '1'; save(); break;
    case 'demo-ai-consent': s.profile.includeDemoInAI = d.checked === '1'; save(); break;
    case 'caffeine-none': {
      const date = ui.m.date || today();
      (s.caffeineCoverage ||= []).push({ id: uid('cov'), from: `${date}T00:00`, to: date === today() ? localDateTime() : `${addDays(date,1)}T00:00`, status: 'no', confirmed: true, origin: ui.mode === 'demo' ? 'demo-live' : 'personal' }); save(); toast(date === today() ? 'No caffeine confirmed up to now' : 'No caffeine confirmed for this day'); close(); break;
    }
    case 'profile-save': s.profile.constraint = val('profile-constraint').trim() || 'Keep it simple'; save(); toast('Constraints saved'); break;
    case 'goal-priority': { const g = s.profile.goals?.find(g => g.id === v); if (g) { s.profile.goals!.forEach(g => g.priority += 1); g.priority = 1; save(); } break; }
    case 'exp-week': ui.explore.week = Math.min(0, (ui.explore.week || 0) + Number(v)); break;

    // about
    case 'resetup': {
      close(); startOnboarding();
      const o = activeObservations(s)[0];
      Object.assign(ui.ob!, { consent: Object.assign({ terms: false, health: false, share: false }, s.profile.consent || {}), concerns: s.profile.concerns || [], rankedFor: (s.profile.concerns || []).join(','), goalId: s.profile.goalId, topicId: o?.topicId || null, time: o?.time || null, attempts: s.profile.attempts || [], attemptsNote: s.profile.attemptsNote || '', constraint: s.profile.constraint, data: s.dataSource, types: { ...s.healthTypes } });
      ui.step = OB_LAST;
      break;
    }
    case 'reset': {
      if (!confirmTap(key)) return;
      resetAll().then(() => { Object.assign(ui, { page: 'splash', tab: 'today', modal: null, m: {}, draft: null, logOffer: null }); render(); }).catch(e=>err(e.message));
      return;
    }
    default: return;
  }
  done();
}

export async function requestReview(planId: string) {
  if (ui.reviewStatus === 'loading') return;
  ui.reviewStatus = 'loading'; ui.reviewError = null; ui.reviewResult = null; render();
  const mode = ui.mode, modalSeq = ui.modalSeq;
  const abort = new AbortController(); const timeout = setTimeout(()=>abort.abort(),25000);
  try {
    await flush();
    const p = S().plans.find(p => p.id === planId); if (!p) throw new Error('Plan not found');
    const revision = S().inputRevision || 0;
    const requestId=uid('rvq');
    const res = await fetch(apiUrl('/api/review'), { signal: abort.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, planVersion: p.version, inputRevision: revision, requestId, today: today() }) });
    const data = await res.json();
    if (mode !== ui.mode || modalSeq !== ui.modalSeq) return;
    if (data.status === 'not-integrated') { ui.reviewStatus = 'not-integrated'; return; }
    if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'Review unavailable');
    data.result = ReviewSchema.parse(data.result);
    if (data.result.requestId !== requestId || data.result.planId !== p.id || data.result.planVersion !== p.version || data.result.mode !== mode || data.result.inputRevision !== revision) throw new Error('Review response does not match this plan and records.');
    if (revision !== (S().inputRevision || 0)) throw new Error('Records changed. Review again.');
    if (data.inputRevision !== undefined) { S().inputRevision=data.inputRevision; S().plans=data.plans; S().safetyEvents=data.safetyEvents; }
    (S().aiReviews ||= []).push(data.result); ui.reviewResult = data.result; ui.reviewStatus = 'idle';
  } catch (e) { ui.reviewStatus = 'error'; ui.reviewError = e instanceof Error ? e.message : 'Review failed'; }
  finally { clearTimeout(timeout); if (ui.reviewStatus === 'loading') ui.reviewStatus = 'idle'; render(); }
}
