// Data model (ported from store.js). Observations are independent: every record
// points to the observation it belongs to. Unlike the prototype, every function takes
// the state explicitly so the same code runs in the browser and on the server.
import { localDateTime, uid } from './dates';
import { topic, type TopicId } from './topics';

export type CheckinStatus = 'recorded' | 'unknown' | 'skipped' | 'text-only';
export type DataSource = 'none' | 'sample' | 'apple-health';
export type PlanStatus = 'active' | 'observing' | 'stopped' | 'replaced';

export type Origin = 'personal' | 'synthetic' | 'demo-live';
export interface Observation { id: string; topicId: TopicId; time: string; status: 'active' | 'paused'; createdAt: string; goalIds?: string[]; confirmed?: boolean }
export interface Checkin {
  origin?: Origin; cutoff?: string; timezone?: string;
  id: string; observationId: string; topicId: TopicId; source: string; status: CheckinStatus; score: number | null;
  occurredAt: string; date: string; note: string; createdAt: string; editedAt?: string; feedbackId?: string;
}
export interface Entry {
  origin?: Origin; caffeinated?: 'yes' | 'no' | 'unknown';
  id: string; kind: 'food' | 'caffeine'; name: string; occurredAt: string; date: string; note: string; createdAt: string;
  size?: string; mg?: number | null; source?: string; editedAt?: string;
  photoUrl?: string; // bundled sample path or /api/photo/<id>
  extracted?: PhotoExtraction | null; // what Gemini proposed, kept next to what the user confirmed
}
export interface PhotoExtraction { name: string; note: string; caffeinated: 'yes' | 'no' | 'unsure'; drink?: string | null; confirm: string[]; model: string }
export interface StepDraft {
  topicId: TopicId; kind: 'step' | 'observe'; title: string; desc: string; duration: string; days: string; step: string;
  lineageId?: string; fromFactor?: string | null; why?: string; stepId?: string;
}
export interface Plan {
  stepId?: string; relatedObservationIds?: string[]; basedOn?: { aiReviewId: string; requestId: string; fromPlanId: string; fromVersion: number }; safetyHold?: { reasons: string[]; feedbackIds: string[]; resolvedAt?: string };
  id: string; lineageId: string; version: number; title: string; desc: string; duration: string; days: string;
  kind: 'step' | 'observe'; fromFactor: string | null; step: string; start: string; review: string;
  observationId: string; topicId: TopicId; acceptedAt: string; status: PlanStatus; history: { status: PlanStatus; at: string }[];
}
export interface Feedback {
  origin?: Origin;
  id: string; planId: string; planVersion: number; observationId: string; date: string; at: string;
  execution?: string; answer?: string | null; score: number | null; change?: string; barriers?: string[]; note?: string;
}
export interface Decision { aiReviewId?: string; newPlanId?: string; id: string; choice: string; reason: string; planId: string; version: number; at: string }
export interface ConversationChoice { id: string; label: string; text: string; topicId?: TopicId }
export interface ConversationInteraction {
  kind: 'clarification' | 'confirmation' | 'suggestions'; question?: string; options: ConversationChoice[];
}
export interface ConversationInsight { id: string; title: string; text: string; limitations?: string[]; evidenceIds?: string[] }
export interface Message {
  role: 'user' | 'guide'; text: string;
  interaction?: ConversationInteraction; insights?: ConversationInsight[]; draft?: StepDraft | null; logOffer?: { name: string; note: string; topicId: TopicId } | null;
  action?: { type: 'review'; planId: string } | { type: 'context' } | { type: 'feedback'; planId: string } | { type: 'data' } | { type: 'caffeine' } | { type: 'checkin'; topicId: TopicId } | null;
  meta?: { via: 'gemini' | 'verified-summary' | 'preset' | 'safety'; safety?: string; cited?: string[] };
}
export interface HRVSample { t:string; ms:number; timestamp?:string }
export interface HealthInterval { start:string; end:string; startAt?:string; endAt?:string }
export interface HealthImport {
  sleep: Record<string, number>; activity: Record<string, number>; cycle: string[];
  hrvSamples?: Record<string, HRVSample[]>; workouts?: Record<string, HealthInterval[]>; mindful?: Record<string, HealthInterval[]>; timezone?: string;
  range: [string, string] | null; via: 'export-xml' | 'bridge' | 'ios-app' | 'simulated'; importedAt: string;
  records: number | null; fileName?: string; granted?: string[];
}
export interface Profile {
  goals?: { id: string; label: string; observationIds: string[]; priority: number }[]; includeCycleContext?: boolean; includeDemoInAI?: boolean;
  consent?: { terms: boolean; health: boolean; share: boolean; at?: string };
  concerns?: string[]; goalId: string | null; attempts: string[]; attemptsNote: string; constraint: string; context: string[];
}
export interface AIReview {
  id: string; contract: 'aura.review.v1'; requestId: string; planId: string; planVersion: number; inputRevision: number;
  mode: 'personal' | 'demo'; feedbackIds: string[]; summary: string; recommendation: 'adjust' | 'continue' | 'observe' | 'stop';
  reasons: string[]; proposal: StepDraft | null; safety: { pause: boolean; message?: string }; model?: string; responseId?: string;
  via: 'gemini' | 'verified-summary' | 'safety'; at: string; cited?: string[];
}
export interface SafetyEvent { id: string; level: string; topicId?: TopicId; planId?: string; at: string; reasons: string[] }
export interface CaffeineCoverage { id: string; from: string; to: string; status: 'yes' | 'no' | 'unknown'; confirmed: boolean; origin?: Origin }
export interface State {
  inputRevision?: number; mode?: 'personal' | 'demo'; timezone?: string; aiReviews?: AIReview[]; safetyEvents?: SafetyEvent[]; caffeineCoverage?: CaffeineCoverage[];

  v: 2; onboarded: boolean; profile: Profile;
  observations: Observation[]; checkins: Checkin[]; entries: Entry[]; plans: Plan[];
  feedbacks: Feedback[]; decisions: Decision[]; messages: Message[];
  dataSource: DataSource; healthTypes: { sleep: boolean; activity: boolean; cycle: boolean; hrv?: boolean };
  healthImport: HealthImport | null; demo?: { day: number; start: string } | null;
}

export const blank = (): State => ({
  v: 2, inputRevision: 0, mode: 'personal', aiReviews: [], safetyEvents: [], caffeineCoverage: [],
  onboarded: false,
  profile: { goalId: null, attempts: [], attemptsNote: '', context: [], constraint: 'Keep it simple' },
  observations: [], checkins: [], entries: [], plans: [], feedbacks: [], decisions: [], messages: [],
  dataSource: 'none',
  healthTypes: { sleep: true, activity: true, cycle: true, hrv: true },
  healthImport: null
});

// Drop undefined keys so they never overwrite defaults (e.g. a new record's id).
const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

// ---------- observations ----------
export function addObservation(s: State, topicId: TopicId, time?: string | null): Observation {
  const existing = s.observations.find(o => o.topicId === topicId);
  if (existing) {
    existing.status = 'active';
    if (time) existing.time = time;
    return existing;
  }
  topic(topicId);
  const o: Observation = { confirmed: true, id: uid('obs'), topicId, time: time || topic(topicId).timing.defaultTime, status: 'active', createdAt: new Date().toISOString() };
  s.observations.push(o);
  return o;
}
export const observation = (s: State, id: string | undefined) => s.observations.find(o => o.id === id);
export const activeObservations = (s: State) => s.observations.filter(o => o.status === 'active');

// ---------- check-ins ----------
export function saveCheckin(s: State, fields: Partial<Checkin> & { observationId: string; topicId: TopicId; status: CheckinStatus }): Checkin {
  const occurredAt = fields.occurredAt || localDateTime();
  const record = Object.assign({ id: uid('chk'), source: 'check-in', origin: s.mode === 'demo' ? 'demo-live' : 'personal', note: '', createdAt: new Date().toISOString(), score: null },
    defined(fields), { occurredAt, date: occurredAt.slice(0, 10) }) as Checkin;
  if (record.status !== 'recorded') record.score = null;
  const i = s.checkins.findIndex(c => c.id === record.id);
  if (i >= 0) s.checkins[i] = Object.assign({}, s.checkins[i], record, { editedAt: new Date().toISOString() });
  else s.checkins.push(record);
  return i >= 0 ? s.checkins[i] : record;
}
// Latest check-in for an observation on a date (by occurredAt, then creation).
export function dayCheckin(s: State, obsId: string, date: string, { includeSample = true } = {}): Checkin | null {
  return s.checkins
    .filter(c => c.observationId === obsId && c.date === date && (includeSample || c.source !== 'sample'))
    .sort((a, b) => (a.occurredAt + a.createdAt).localeCompare(b.occurredAt + b.createdAt))
    .at(-1) || null;
}

// ---------- food & caffeine ----------
export function saveEntry(s: State, fields: Partial<Entry> & { kind: Entry['kind']; occurredAt: string }): Entry {
  const rec = Object.assign({ id: uid('ent'), origin: s.mode === 'demo' ? 'demo-live' : 'personal', createdAt: new Date().toISOString(), note: '', name: '' }, defined(fields),
    { date: fields.occurredAt.slice(0, 10) }) as Entry;
  const i = s.entries.findIndex(e => e.id === rec.id);
  if (i >= 0) s.entries[i] = Object.assign({}, s.entries[i], rec, { editedAt: new Date().toISOString() });
  else s.entries.push(rec);
  return i >= 0 ? s.entries[i] : rec;
}
export function removeRecord(s: State, kind: 'checkin' | 'entry', id: string) {
  if (kind === 'checkin') s.checkins = s.checkins.filter(r => r.id !== id);
  else s.entries = s.entries.filter(r => r.id !== id);
}

// ---------- plans ----------
export function setPlanStatus(plan: Plan, status: PlanStatus) {
  plan.status = status;
  plan.history = plan.history || [];
  plan.history.push({ status, at: new Date().toISOString() });
}
export function acceptPlan(s: State, draft: Omit<StepDraft, 'step'> & { step?: string }, fields: { step: string; start: string; review: string; observationId: string; topicId: TopicId }): Plan {
  const lineageId = draft.lineageId || uid('lin');
  const prior = s.plans.filter(p => p.lineageId === lineageId);
  prior.forEach(p => { if (p.status !== 'stopped' && p.status !== 'replaced') setPlanStatus(p, 'replaced'); });
  // One current plan per observation: an older current plan for the same observation is replaced.
  s.plans.filter(p => p.observationId === fields.observationId && ['active', 'observing'].includes(p.status))
    .forEach(p => setPlanStatus(p, 'replaced'));
  const plan: Plan = {
    id: uid('plan'), lineageId, version: prior.length + 1,
    relatedObservationIds: s.observations.filter(o => o.id !== fields.observationId && o.status === 'active' && (o.goalIds || []).some(g => s.observations.find(primary => primary.id === fields.observationId)?.goalIds?.includes(g))).map(o => o.id),
    stepId: draft.stepId, title: draft.title, desc: draft.desc, duration: draft.duration, days: draft.days,
    kind: draft.kind || 'step', fromFactor: draft.fromFactor || null,
    step: fields.step, start: fields.start, review: fields.review, observationId: fields.observationId, topicId: fields.topicId,
    acceptedAt: new Date().toISOString(), status: draft.kind === 'observe' ? 'observing' : 'active', history: []
  };
  plan.history.push({ status: plan.status, at: plan.acceptedAt });
  s.plans.push(plan);
  return plan;
}
export const plan = (s: State, id: string | undefined) => s.plans.find(p => p.id === id);
export const currentPlans = (s: State) => s.plans.filter(p => ['active', 'observing'].includes(p.status));
export const currentPlanFor = (s: State, obsId: string) => currentPlans(s).find(p => p.observationId === obsId) || null;
