// Client state: the session's records (`st`, saved to the server) and the transient
// interface state (`ui`, never saved), as in the prototype's app.js. Event handlers
// mutate them and call render(); components read them through useApp().
import { useSyncExternalStore } from 'react';
import { blank, type Entry, type PhotoExtraction, type State, type StepDraft } from '@/domain/state';
import type { TopicId } from '@/domain/topics';
import { todayISO } from '@/domain/dates';

export interface OnboardingDraft {
  consent: { terms: boolean; health: boolean; share: boolean }; concerns: string[]; goalId: string | null;
  topicId: TopicId | null; time: string | null; attempts: string[]; attemptsNote: string; constraint: string;
  data: 'none' | 'sample' | 'apple-health'; types: { sleep: boolean; activity: boolean; cycle: boolean }; rankedFor?: string;
}
export interface ModalData {
  obsId?: string; recId?: string; planId?: string; date?: string; doc?: string; back?: string; choice?: string | null;
  time?: string; note?: string; name?: string; drink?: string; size?: string; caffeine?: boolean; target?: string;
  topicId?: TopicId; from?: string | null; picking?: boolean; photo?: string; extraction?: PhotoExtraction | null;
  reading?: boolean; photoError?: string; fill?: number;
}
export interface UI {
  ready: boolean; page: 'splash' | 'onboarding' | 'app'; tab: 'today' | 'explore' | 'aura';
  modal: string | null; m: ModalData; modalSeq: number; step: number; ob: OnboardingDraft | null; fromReview: boolean;
  draft: StepDraft | null; auraState: 'idle' | 'listening' | 'understanding' | 'insight'; pending: boolean;
  logOffer: { name: string; note: string; topicId: TopicId } | null;
  explore: { obsId: string | null; range: number; date: string | null; metric: string };
  fb: { planId?: string; step: number; d: Record<string, unknown> & { barriers?: string[] } };
  importing: number | null; chartPlayed: boolean; quick: Record<string, string>; goalsOpen: boolean;
  dayAt: { h: number; time: string } | null; err: { msg: string; field?: string } | null; armed: string | null;
  toast: string | null; ai: { enabled: boolean; model: string | null }; saveError: string | null;
}

export const ui: UI = {
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
export function render() { version++; listeners.forEach(l => l()); }
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
  saveTimer = setTimeout(() => { inflight = push(); }, 250);
}
async function push() {
  try {
    const res = await fetch('/api/session', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: st }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Save failed (${res.status})`);
    if (ui.saveError) { ui.saveError = null; render(); }
  } catch (e) {
    ui.saveError = e instanceof Error ? e.message : 'Couldn’t save. Check your connection.';
    render();
  }
}
// Wait until the server has the latest records (before asking Aura about them).
export async function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; inflight = push(); }
  await inflight;
}

export async function load() {
  try {
    const res = await fetch('/api/session');
    const { state, ai } = await res.json();
    if (state && state.v === 2) st = Object.assign(blank(), state);
    ui.ai = ai;
  } catch { /* start blank; saving will report problems */ }
  ui.page = st.onboarded ? 'app' : 'splash';
  ui.ready = true;
  render();
}

export async function resetAll() {
  await fetch('/api/session', { method: 'DELETE' });
  st = blank();
}

export const photoOf = (r: Entry) => r.photoUrl || null;
