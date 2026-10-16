import { z } from 'zod';
import { blank, normalizeGoals, setPlanStatus, type State, type Feedback } from '@/domain/state';
import { GOAL_IDS, isTopicId, TOPIC_IDS } from '@/domain/topics';
import { uid } from '@/domain/dates';

export const modeOf = (req: Request): 'personal' | 'demo' => new URL(req.url).searchParams.get('mode') === 'demo' ? 'demo' : 'personal';
export const modeSid = (sid: string, req: Request) => modeOf(req) === 'demo' ? `${sid}-demo` : sid;
const topicId = z.enum(TOPIC_IDS as [string, ...string[]]);
export const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
export const DaySchema = z.string().refine(validDay, 'Invalid date');
export const TimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const WallTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?Z)?$/).refine(value => validDay(value.slice(0,10)));
const occurredAt = WallTimeSchema;
export const timezoneValid = (zone: string) => { try { new Intl.DateTimeFormat('en',{timeZone:zone}).format(); return true; } catch { return false; } };
export const TimezoneSchema = z.string().max(100).refine(timezoneValid);
export function wallClock(zone?: string, instant = new Date()) {
  if (!zone || !timezoneValid(zone)) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).format(instant).replace(' ','T');
}
const intervals = z.record(DaySchema,z.array(z.object({start:TimeSchema,end:z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/),startAt:z.string().datetime({offset:true}).optional(),endAt:z.string().datetime({offset:true}).optional()}).refine(w => w.startAt && w.endAt ? Date.parse(w.endAt) > Date.parse(w.startAt) : w.start < w.end)).max(100));
const hrvSamples = z.record(DaySchema,z.array(z.object({t:TimeSchema,ms:z.number().positive().max(10000),timestamp:z.string().datetime({offset:true}).optional()})).max(2000));
const origin = z.enum(['personal', 'synthetic', 'demo-live']).optional();
export const StateSchema = z.object({
  v: z.literal(2), onboarded: z.boolean(), profile: z.object({ constraint: z.string().max(500), attempts: z.array(z.string().max(300)).max(50), attemptsNote: z.string().max(2000), goals: z.array(z.enum(GOAL_IDS as [string, ...string[]])).max(GOAL_IDS.length).refine(g => new Set(g).size === g.length, 'Duplicate goal').optional(), includeCycleContext:z.boolean().optional(),includeDemoInAI:z.boolean().optional() }).passthrough(),
  observations: z.array(z.object({ id: z.string().min(1).max(100), topicId, time: TimeSchema, status: z.enum(['active','paused']), createdAt: z.string() }).passthrough()).max(10),
  checkins: z.array(z.object({ id: z.string().min(1).max(100), observationId: z.string(), topicId, occurredAt, date: DaySchema, status: z.enum(['recorded','unknown','skipped']), score: z.number().int().min(1).max(5).nullable(), origin, note: z.string().max(2000).optional() }).passthrough()).max(5000),
  entries: z.array(z.object({ id: z.string().min(1).max(100), kind: z.enum(['food','caffeine']), occurredAt, date: DaySchema, origin, name: z.string().max(500), caffeinated:z.enum(['yes','no','unknown']).optional(),mg:z.number().min(0).max(2000).nullable().optional(), note: z.string().max(2000).optional() }).passthrough()).max(5000),
  plans: z.array(z.object({}).passthrough()).max(500), feedbacks: z.array(z.object({}).passthrough()).max(2000), decisions: z.array(z.object({}).passthrough()).max(1000),
  messages: z.array(z.object({ role: z.enum(['user','guide']), text: z.string().max(4000) }).passthrough()).max(1000),
  dataSource: z.enum(['none','sample','apple-health']), healthTypes: z.object({ sleep: z.boolean(), activity: z.boolean(), cycle: z.boolean(), hrv: z.boolean().optional() }),
  healthImport: z.object({ sleep: z.record(z.string(),z.number().min(0).max(24)), activity: z.record(z.string(),z.number().min(0).max(1440)), cycle: z.array(z.string()), importedAt: z.string(), via: z.enum(['export-xml','bridge','ios-app','simulated']),hrvSamples:hrvSamples.optional(),workouts:intervals.optional(),mindful:intervals.optional() }).passthrough().nullable(),
  caffeineCoverage: z.array(z.object({ id: z.string(), from: occurredAt, to: occurredAt, status: z.enum(['yes','no','unknown']), confirmed: z.boolean(), origin }).refine(c => c.from < c.to)).max(2000).optional(),
  timezone: TimezoneSchema.optional(), inputRevision: z.number().int().nonnegative().optional()
}).passthrough();

export function migrateState(raw: State | null, mode: 'personal' | 'demo'): State {
  const s = Object.assign(blank(), raw || {});
  s.mode = mode; s.inputRevision ||= 0; s.aiReviews ||= []; s.safetyEvents ||= []; s.caffeineCoverage ||= [];
  s.healthTypes.hrv ??= true;
  normalizeGoals(s);
  // Retain legacy fictional imports for recovery, but do not treat them as personal health data.
  if (mode === 'personal' && s.healthImport?.via === 'simulated') s.dataSource = 'none';
  s.checkins.forEach(c => { c.cutoff ||= c.occurredAt; c.timezone ||= s.timezone; });
  s.checkins.forEach(r => r.origin ??= mode === 'demo' || s.demo || r.source === 'sample' ? 'synthetic' : 'personal');
  s.entries.forEach(r => r.origin ??= mode === 'demo' || s.demo || r.source === 'sample' ? 'synthetic' : 'personal');
  s.feedbacks.forEach(r => r.origin ??= mode === 'demo' || s.demo ? 'synthetic' : 'personal');
  return s;
}
// Presentation gate: mirrors the v2 paused-plan state, not a new Agent safety rule.
export function hasSafetyHold(s: State, topic?: string) {
  return s.plans.some(p => (!topic || p.topicId === topic) && p.safetyHold && !p.safetyHold.resolvedAt);
}
export function validateRelations(s: State) {
  const now = wallClock(s.timezone);
  if (now) {
    if ([...s.checkins,...s.entries].some(r => r.occurredAt.slice(0,16) > now)) throw new Error('Record time is in the future');
    if ((s.caffeineCoverage || []).some(c => c.to.slice(0,16) > now)) throw new Error('Cannot confirm a future caffeine window');
  }
  const ids = [...s.observations, ...s.checkins, ...s.entries].map(x => x.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate record ID');
  for (const o of s.observations) {
    if (!isTopicId(o.topicId)) throw new Error('Unknown topic');
  }
  for (const c of s.checkins) {
    const o = s.observations.find(o => o.id === c.observationId);
    if (!o || o.topicId !== c.topicId) throw new Error('Check-in does not match its observation');
    if (c.date !== c.occurredAt.slice(0, 10) || (c.status === 'recorded' ? c.score === null : c.score !== null)) throw new Error('Invalid check-in');
  }
  for (const e of s.entries) if (e.date !== e.occurredAt.slice(0,10)) throw new Error('Invalid entry date');
}
// Existing feedback behavior: worse/unwell pauses this plan. No classifier or new topic-wide policy.
export function applySafetyFeedback(s: State, feedback: Feedback) {
  for (const f of [feedback]) if (f.change === 'Worse' || f.barriers?.includes('Felt unwell')) {
    const p = s.plans.find(p => p.id === f.planId);
    if (p && p.status === 'active') {
      p.safetyHold ||= { reasons: ['reported-worse-or-unwell'], feedbackIds: [f.id] };
      setPlanStatus(p, 'stopped');
    }
  }
}
export function inputSignature(s: State) {
  return JSON.stringify([s.profile,s.observations,s.checkins,s.entries,s.plans,s.feedbacks,s.decisions,s.dataSource,s.healthTypes,s.healthImport,s.caffeineCoverage,s.timezone,s.safetyEvents]);
}
