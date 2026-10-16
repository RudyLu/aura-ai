import { describe, expect, it, vi } from 'vitest';
import { checkOutput, ruleCheck } from './safety';
import { buildFacts, grounding, respond } from './agent';
import { buildDemo } from '@/domain/demo';
import { todayISO } from '@/domain/dates';

vi.mock('./gemini', () => ({ geminiConfigured: () => false, generateJSON: vi.fn(), MODEL: 'test' }));

describe('safety rules (PRD §7.3)', () => {
  it.each([
    ['I have the worst headache of my life, it came on suddenly', 'emergency'],
    ['my chest pain started an hour ago', 'emergency'],
    ['I can’t breathe properly', 'emergency'],
    ['sometimes I think about ending it, I want to kill myself', 'emergency'],
    ['how much melatonin should I take?', 'out-of-scope'],
    ['should I stop taking my antidepressants', 'out-of-scope'],
    ['do I have insomnia?', 'out-of-scope'],
    ['my period has been very heavy and I soak through pads', 'professional'],
    ['My period is really heavy this month and I feel dizzy', 'professional'],
    ['the step made me feel worse', 'worse'],
    ['I feel dizzy after the run', 'worse'],
    ['coffee after lunch, then a long meeting', 'general']
  ])('%s → %s', (text, level) => {
    expect(ruleCheck(text).level).toBe(level);
  });

  it('respects negation', () => {
    expect(ruleCheck('No chest pain, just tired').level).toBe('general');
    expect(ruleCheck('I don’t have chest pain today').level).toBe('general');
    expect(ruleCheck('without any shortness of breath').level).toBe('general');
  });

  it('flags causal, diagnostic and reassuring replies', () => {
    expect(checkOutput('Short sleep causes your low energy.')).toContain('causal');
    expect(checkOutput('You might have insomnia.')).toContain('diagnosis');
    expect(checkOutput('You’re fine, nothing to worry about.')).toContain('reassurance');
    expect(checkOutput('Try 3 mg of melatonin tonight.')).toContain('medication');
    expect(checkOutput('Your energy was higher on days after 7+ hours of sleep.')).toEqual([]);
  });
});

describe('emergency input never reaches the model', () => {
  it('returns the fixed message and no step', async () => {
    const s = buildDemo(10);
    const r = await respond(s, 'sudden severe headache and my face is drooping', [], todayISO());
    expect(r.via).toBe('safety');
    expect(r.draft).toBeNull();
    expect(r.text).toMatch(/emergency services/);
  });
  it('reported worsening pauses the active step', async () => {
    const s = buildDemo(10);
    const r = await respond(s, 'I feel worse since starting this', [], todayISO());
    expect(r.stopPlanId).toBe(s.plans[0].id);
  });
});

describe('grounding check (PRD §3.2)', () => {
  const s = buildDemo(10, new Date(2026, 9, 5, 12, 0));
  const { facts } = buildFacts(s, '2026-10-05');
  const cmp = facts.find(f => f.id === 'cmp:evening-energy:short-sleep')!;
  const base = { cited: [cmp.id], topicId: 'evening-energy', clarify: false, clarifyTopics: [], stepId: '', action: 'none', offerLogName: '', offerLogNote: '' };

  it('accepts numbers that appear in cited facts', () => {
    const out = { ...base, reply: `That comparison covers ${cmp.numbers.slice(0, 2).join(' and ')}.` };
    expect(grounding(out, facts, 'how was my week', true)).toEqual([]);
  });
  it('rejects invented numbers and unknown citations', () => {
    const out = { ...base, cited: [cmp.id, 'made-up'], reply: 'Your energy was 40% higher after good sleep.' };
    const p = grounding(out, facts, 'how was my week', true);
    expect(p.join(' ')).toMatch(/made-up/);
    expect(p.join(' ')).toMatch(/40/);
  });
  it('rejects unapproved finding steps, and any step when steps are disabled', () => {
    expect(grounding({ ...base, reply: 'Maybe try this.', stepId: 'finding:short-sleep:1' }, facts, 'x', true).join(' ')).toMatch(/not on the menu/);
    expect(grounding({ ...base, reply: 'Maybe try this.', stepId: 'chat:busy-week' }, facts, 'x', true)).toEqual([]);
    expect(grounding({ ...base, reply: 'Maybe try this.', stepId: 'chat:busy-week' }, facts, 'x', false).join(' ')).toMatch(/No step/);
  });
  it('never routes an afternoon request to an evening-energy step or another topic\'s comparison', () => {
    const afternoon = { ...base, cited: [], topicId: 'afternoon-sleepiness', reply: 'Maybe try this.' };
    expect(grounding({ ...afternoon, stepId: 'chat:checkin-tonight' }, facts, 'x', true).join(' ')).toMatch(/another topic/);
    expect(grounding({ ...afternoon, stepId: 'chat:busy-week' }, facts, 'x', true)).toEqual([]);
    expect(grounding({ ...afternoon, cited: [cmp.id] }, facts, 'x', true).join(' ')).toMatch(/compares another topic/);
    expect(grounding({ ...base, topicId: '', reply: 'Maybe.', stepId: 'chat:busy-week' }, facts, 'x', true).join(' ')).toMatch(/clear topic/);
  });
});
