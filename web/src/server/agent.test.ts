import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemo } from '@/domain/demo';
import { addObservation, blank, saveCheckin, type Message } from '@/domain/state';
import { buildFacts, clarificationsSoFar, respond, type ModelOut } from './agent';
import { reviewPlan } from './review';
import * as gemini from './gemini';

vi.mock('./gemini', () => ({ geminiConfigured: vi.fn(() => true), generateJSON: vi.fn(), MODEL: 'test-model' }));
const gen = vi.mocked(gemini.generateJSON);
// The safety classifier is the first model call; answer "general" so the reply call is next.
const replies = (...outs: unknown[]) => { gen.mockReset(); gen.mockResolvedValueOnce({ level: 'general', reason: 'ok' }); for (const o of outs) gen.mockResolvedValueOnce(o); };
const out = (o: Partial<ModelOut>): ModelOut => ({ reply: 'I hear you.', cited: [], topicId: '', clarify: false, clarifyTopics: [], stepId: '', action: 'none', offerLogName: '', offerLogNote: '', ...o });
const today = '2026-10-10';
const demo = () => buildDemo(10, new Date(2026, 9, 10, 12, 0));
beforeEach(() => { vi.mocked(gemini.geminiConfigured).mockReturnValue(true); });

describe('context the model receives', () => {
  it('omits menstrual records unless the user allowed them (M03)', () => {
    const s = demo(); s.healthTypes.cycle = true;
    const has = () => buildFacts(s, today).facts.some(f => /period day/.test(f.text));
    s.profile.includeCycleContext = false; s.dataSource = 'sample';
    expect(has()).toBe(false);
    expect(buildFacts(s, today).facts.find(f => f.id === 'rec:week')!.text).toMatch(/not shared/);
  });
  it('gives stress and productivity no comparisons (M10)', () => {
    const s = blank(); const o = addObservation(s, 'stress');
    for (let d = 1; d <= 9; d++) saveCheckin(s, { observationId: o.id, topicId: 'stress', status: 'recorded', score: d % 5 + 1, occurredAt: `2026-10-0${d}T21:30` });
    const { facts } = buildFacts(s, today);
    expect(facts.some(f => f.id.startsWith('cmp:stress'))).toBe(false);
    expect(facts.find(f => f.id === 'obs:stress')!.text).toMatch(/not configured/);
  });
  it('treats unlogged caffeine as unknown, not none (M09)', () => {
    expect(buildFacts(blank(), today).facts.find(f => f.id === 'rec:week')!.text).toMatch(/not logged \(unknown/);
  });
  it('marks demo records as synthetic, and only in demo', () => {
    expect(buildFacts(demo(), today).facts.find(f => f.id === 'demo')!.text).toMatch(/synthetic demo history/);
    expect(buildFacts(blank(), today).facts.some(f => f.id === 'demo')).toBe(false);
  });
  it('labels evidence types', () => {
    const types = new Set(buildFacts(demo(), today).facts.map(f => f.type));
    expect([...types]).toEqual(expect.arrayContaining(['user_report', 'verified_summary', 'context']));
  });
});

describe('topic resolution and clarification', () => {
  it('asks which topic instead of defaulting to the first observation', async () => {
    replies(out({ reply: 'That sounds draining. Is it more about energy in the evening, or feeling sleepy?', clarify: true, clarifyTopics: ['evening-energy', 'afternoon-sleepiness'], action: 'checkin', stepId: '' }));
    const r = await respond(demo(), 'I feel drained', [], today);
    expect(r.via).toBe('gemini');
    expect(r.action).toBeNull();
    expect(r.interaction?.kind).toBe('clarification');
    expect(r.interaction?.options.map(o => o.topicId)).toEqual(['evening-energy', 'afternoon-sleepiness', undefined]);
  });
  it('after two clarifications offers the templates instead of asking again', async () => {
    const asked: Message = { role: 'guide', text: 'Which one?', interaction: { kind: 'clarification', options: [{ id: 'stress', label: 'Stress', text: 'x', topicId: 'stress' }] } };
    const history: Message[] = [asked, { role: 'user', text: 'hmm' }, asked, { role: 'user', text: 'not sure' }];
    expect(clarificationsSoFar(history)).toBe(2);
    replies(out({ clarify: true, clarifyTopics: ['stress', 'productivity'] }));
    const r = await respond(demo(), 'not sure', history, today);
    expect(r.interaction?.kind).toBe('suggestions');
    expect(r.interaction?.options).toHaveLength(6);
  });
  it('a confirmed choice overrides the model and keeps actions on that topic', async () => {
    const s = demo();
    replies(out({ topicId: 'evening-energy', action: 'checkin', stepId: 'observe:rested-waking' }));
    const r = await respond(s, 'I mean how rested I feel', [], today, { topicId: 'rested-waking' });
    expect(r.action).toEqual({ type: 'checkin', topicId: 'rested-waking' });
    expect(r.draft?.topicId).toBe('rested-waking');
  });
  it('retries once on an off-topic step, then falls back to a code-only summary', async () => {
    replies(out({ topicId: 'afternoon-sleepiness', stepId: 'chat:checkin-tonight' }), out({ topicId: 'afternoon-sleepiness', stepId: 'chat:checkin-tonight' }));
    const r = await respond(demo(), 'afternoons are rough', [], today);
    expect(gen).toHaveBeenCalledTimes(3);
    expect(r.via).toBe('verified-summary');
    expect(r.draft).toBeNull();
  });
  it('builds insight cards from cited comparisons only', async () => {
    const s = demo(); const cmp = buildFacts(s, today).facts.find(f => f.type === 'allowed_comparison')!;
    replies(out({ topicId: cmp.id.split(':')[1], cited: [cmp.id], reply: 'Here is what your records show.' }));
    const r = await respond(s, 'what do my records show', [], today);
    expect(r.insights?.[0].id).toBe(cmp.id);
    expect(r.insights?.[0].limitations?.length).toBeGreaterThan(0);
  });
  it('blocks new steps while a health concern is open', async () => {
    const s = demo(); s.safetyEvents = [{ id: 'e', level: 'professional', at: 'now', reasons: ['x'] }];
    replies(out({ topicId: 'evening-energy', stepId: 'chat:busy-week' }), out({ topicId: 'evening-energy' }));
    const r = await respond(s, 'busy week', [], today);
    expect(r.draft).toBeNull();
  });
});

describe('Day 10 review', () => {
  const q = (s: ReturnType<typeof demo>) => ({ planId: s.plans[0].id, planVersion: s.plans[0].version, inputRevision: s.inputRevision || 0, requestId: 'req-1', today });
  it('returns a validated adjust proposal on the plan\'s own topic', async () => {
    const s = demo(); s.mode = 'demo';
    gen.mockReset(); gen.mockResolvedValueOnce({ summary: 'Overtime made the step hard this week.', recommendation: 'adjust', reasons: ['You noted overtime.'], proposalStepId: 'chat:busy-week', cited: ['plan:review'] });
    const r = await reviewPlan(s, q(s));
    expect(r.contract).toBe('aura.review.v1');
    expect(r.recommendation).toBe('adjust');
    expect(r.proposal?.topicId).toBe(s.plans[0].topicId);
    expect(r.feedbackIds).toEqual(s.feedbacks.filter(f => f.planId === s.plans[0].id).map(f => f.id));
  });
  it('rejects a proposal for another topic and errors after the retry', async () => {
    const s = demo();
    const bad = { summary: 'Try this.', recommendation: 'adjust', reasons: ['x'], proposalStepId: 'observe:stress', cited: [] };
    gen.mockReset(); gen.mockResolvedValueOnce(bad).mockResolvedValueOnce(bad);
    await expect(reviewPlan(s, q(s))).rejects.toThrow(/verified review/);
  });
  it('forces observe/stop without a proposal after reported worsening', async () => {
    const s = demo(); s.feedbacks.filter(f => f.planId === s.plans[0].id).at(-1)!.change = 'Worse';
    gen.mockReset();
    gen.mockResolvedValueOnce({ summary: 'Keep going.', recommendation: 'continue', reasons: ['x'], proposalStepId: '', cited: [] })
      .mockResolvedValueOnce({ summary: 'You said you felt worse, so let’s pause.', recommendation: 'observe', reasons: ['You reported feeling worse.'], proposalStepId: '', cited: [] });
    const r = await reviewPlan(s, q(s));
    expect(r.recommendation).toBe('observe');
    expect(r.safety.pause).toBe(true);
    expect(r.proposal).toBeNull();
  });
  it('stays not-integrated without Gemini', async () => {
    vi.mocked(gemini.geminiConfigured).mockReturnValue(false);
    const s = demo();
    await expect(reviewPlan(s, q(s))).rejects.toThrow('not-integrated');
  });
});
