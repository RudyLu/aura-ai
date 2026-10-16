// Client state: the session's records (`st`, saved to the server) and the transient
// interface state (`ui`, never saved), as in the prototype's app.js. Event handlers
// mutate them and call render(); components read them through useApp().
import { useSyncExternalStore } from 'react';
import { blank, type AIReview, type Entry, type HealthImport, type PhotoExtraction, type State, type StepDraft } from '@/domain/state';
import { setDataSource } from '@/domain/health';
import type { TopicId } from '@/domain/topics';
import { todayISO } from '@/domain/dates';

export interface OnboardingDraft {
  consent: { terms: boolean; health: boolean; share: boolean }; concerns: string[];
  topicId: TopicId | null; time: string | null; attempts: string[]; attemptsNote: string; constraint: string;
  data: 'none' | 'sample' | 'apple-health'; types: { sleep: boolean; activity: boolean; cycle: boolean; hrv?: boolean }; rankedFor?: string;
}
export interface ModalData {
  obsId?: string; recId?: string; planId?: string; date?: string; doc?: string; back?: string; choice?: string | null;
  time?: string; note?: string; name?: string; drink?: string; size?: string; caffeine?: boolean; target?: string;
  aiReviewId?: string; requestId?: string; topicId?: TopicId; from?: string | null; picking?: boolean; photo?: string; extraction?: PhotoExtraction | null;
  reading?: boolean; photoError?: string; fill?: number;
  link?: { status: 'starting' | 'waiting' | 'expired' | 'error'; token?: string; url?: string; appUrl?: string; qr?: string; expiresAt?: number };
}
export interface UI {
  todaySweepDone: boolean; auraIntroDone: boolean; freshMsg: number;
  chatError: string | null; failedMessage: string | null; nextUp: number | null;
  mode: 'personal' | 'demo'; previousTab: 'today' | 'explore'; saving: boolean; reviewStatus: 'idle' | 'loading' | 'error' | 'not-integrated'; reviewError: string | null; reviewResult: AIReview | null;
  ready: boolean; page: 'splash' | 'onboarding' | 'app'; tab: 'today' | 'explore' | 'aura';
  modal: string | null; m: ModalData; modalSeq: number; step: number; ob: OnboardingDraft | null; fromReview: boolean;
  draft: StepDraft | null; auraState: 'idle' | 'listening' | 'understanding' | 'insight'; pending: boolean;
  logOffer: { name: string; note: string; topicId: TopicId } | null;
  explore: { obsId: string | null; range: number; date: string | null; metric: string; week?: number };
  fb: { planId?: string; step: number; d: Record<string, unknown> & { barriers?: string[] } };
  importing: number | null; chartPlayed: boolean; quick: Record<string, string>; goalsOpen: boolean;
  dayAt: { h: number; time: string } | null; err: { msg: string; field?: string } | null; armed: string | null;
  toast: string | null; ai: { enabled: boolean; model: string | null }; saveError: string | null;
}

export const ui: UI = {
  todaySweepDone: false, auraIntroDone: false, freshMsg: 0,
  chatError: null, failedMessage: null, nextUp: null,
  mode: 'personal', previousTab: 'today', saving: false, reviewStatus: 'idle', reviewError: null, reviewResult: null,
  ready: false, page: 'splash', tab: 'today', modal: null, m: {}, modalSeq: 0, step: 0, ob: null, fromReview: false,
  draft: null, auraState: 'idle', pending: false, logOffer: null,
  explore: { obsId: null, range: 7, date: null, metric: 'all' }, fb: { step: 0, d: {} },
  importing: null, chartPlayed: false, quick: {}, goalsOpen: false, dayAt: null, err: null, armed: null,
  toast: null, ai: { enabled: false, model: null }, saveError: null
};

let st: State = blank();
export const S = () => st;
export const setSt = (x: State) => { st = x; };
export const today = () => todayISO();

// ---------- render loop ----------
let version = 0;
const listeners = new Set<() => void>();
export function render() { version++; keepDraft(); listeners.forEach(l => l()); }

// The onboarding answers live only in memory, so a reload (for example Safari coming back
// from the Aura iOS app after linking Apple Health) would start the user over. Keep them in
// this browser until onboarding finishes. They are never sent to the server.
const DRAFT_KEY = 'aura_onboarding_draft';
export const apiUrl = (path: string) => `${path}${path.includes('?') ? '&' : '?'}mode=${ui.mode}`;
function keepDraft() {
  try {
    if (!ui.ready) return;
    if (ui.page === 'onboarding' && ui.ob) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ob: ui.ob, step: ui.step, fromReview: ui.fromReview, at: Date.now() }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage unavailable: onboarding just won't survive a reload */ }
}
function restoreDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d?.ob || Date.now() - d.at > 24 * 60 * 60 * 1000) return false;
    ui.ob = d.ob; ui.step = d.step; ui.fromReview = !!d.fromReview; ui.page = 'onboarding';
    return true;
  } catch { return false; }
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useApp() { useSyncExternalStore(subscribe, () => version, () => 0); return { st, ui }; }

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  ui.toast = msg; render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; render(); }, 2600);
}

// ---------- persistence: the server keeps this session's records ----------
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> = Promise.resolve();
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = undefined; inflight = inflight.catch(() => {}).then(push); }, 250);
}
async function push() {
  const target = st, mode = ui.mode;
  const snapshot = structuredClone(target);
  snapshot.timezone ||= Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const res = await fetch(`/api/session?mode=${mode}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: snapshot }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
    if (target === st && mode === ui.mode) {
      st.inputRevision = data.inputRevision; st.timezone = snapshot.timezone;
      st.plans = data.state.plans; st.feedbacks = data.state.feedbacks; st.decisions = data.state.decisions;
      st.aiReviews = data.state.aiReviews; st.safetyEvents = data.state.safetyEvents;
      ui.saveError = null; render();
    }
  } catch (e) {
    ui.saveError = e instanceof Error ? e.message : 'Couldn’t save. Check your connection.';
    render();
  }
}
export async function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; inflight = inflight.catch(() => {}).then(push); }
  await inflight;
  if (ui.saveError) { await push(); if (ui.saveError) throw new Error(ui.saveError); }
}
export async function load() {
  try {
    const savedMode = localStorage.getItem('aura-mode');
    if (savedMode === 'demo') ui.mode = 'demo';
    const res = await fetch(apiUrl('/api/session'));
    if (!res.ok) throw new Error('Could not load records. Refresh to retry.');
    const { state, ai, linkedHealth } = await res.json();
    if (state && state.v === 2) st = Object.assign(blank(), state);
    st.mode = ui.mode; ui.ai = ai;
    if (linkedHealth && adoptLinked(st, linkedHealth)) save();
  } catch (e) { ui.saveError = e instanceof Error ? e.message : 'Could not load records.'; }
  ui.page = st.onboarded ? 'app' : 'splash';
  if (!st.onboarded && ui.mode === 'personal') restoreDraft();
  restoreConversation(); ui.ready = true; render();
}
export async function switchMode(mode: 'personal' | 'demo') {
  if (ui.pending || ui.saving || ui.reviewStatus === 'loading') throw new Error('Wait for the current request to finish.');
  await flush();
  const res = await fetch(`/api/session?mode=${mode}`), data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not switch records');
  ui.mode = mode; try {localStorage.setItem('aura-mode', mode);}catch {/* Mode isolation does not depend on browser storage. */}
  st = Object.assign(blank(), data.state); st.mode = mode;
  ui.page = st.onboarded ? 'app' : 'splash'; ui.tab = 'today'; ui.modal = null; ui.draft = null; ui.logOffer = null; ui.reviewResult = null;
  ui.chatError = null; ui.failedMessage = null; ui.nextUp = null; restoreConversation(); render();
}
export async function command(action: string, data: Record<string, unknown>) {
  await flush();
  const res = await fetch(apiUrl('/api/command'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, inputRevision: st.inputRevision || 0, data }) });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || 'Could not save. Try again.');
  st = out.state; render(); return st;
}
export async function resetAll() {
  await flush();
  const res = await fetch(apiUrl('/api/session'), { method: 'DELETE' });
  if (!res.ok) throw new Error('Could not reset records');
  st = blank(); st.mode = ui.mode;
}
export async function refreshLinkedHealth() {
  const mode = ui.mode;
  try {
    const res = await fetch(apiUrl('/api/session'));
    const { linkedHealth, state } = await res.json();
    if (mode !== ui.mode || !state) return;
    const adopted = !!linkedHealth && adoptLinked(st, linkedHealth);
    // Finishing an iOS link saves the import into the server's records and advances their
    // revision. Take the new revision (and the server-owned records) even when this browser
    // already holds a newer import, or every later save is rejected as stale.
    const advanced = (state.inputRevision || 0) > (st.inputRevision || 0);
    if (advanced) {
      if (state.healthImport && (!st.healthImport || st.healthImport.importedAt <= state.healthImport.importedAt)) { st.healthImport = state.healthImport; st.dataSource = state.dataSource; }
      st.inputRevision = state.inputRevision; st.plans = state.plans; st.feedbacks = state.feedbacks; st.decisions = state.decisions; st.aiReviews = state.aiReviews; st.safetyEvents = state.safetyEvents;
    }
    if (adopted || advanced) { ui.reviewResult = null; render(); }
  } catch { /* Retain previous records; manual import/link stays available. */ }
}

// Use Apple Health from the iOS app unless the session already has it or something newer
// (for example an export.xml imported afterwards).
export function adoptLinked(s: State, h: HealthImport) {
  if (s.healthImport && s.healthImport.importedAt >= h.importedAt) return false;
  s.healthImport = h;
  if (s.onboarded) setDataSource(s, 'apple-health', todayISO());
  return true;
}

export const photoOf = (r: Entry) => r.photoUrl || null;

function restoreConversation() {
  const last = st.messages.at(-1);
  ui.draft = last?.role === 'guide' ? last.draft || null : null;
  ui.logOffer = last?.role === 'guide' ? last.logOffer || null : null;
}
