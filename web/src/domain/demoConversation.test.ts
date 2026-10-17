import { describe, expect, it } from 'vitest';
import { buildDemo } from './demo';
import { blank, type State } from './state';
import { DEMO_TURNS, demoProposal, nextDemoTurn, offeredDemoDraft, scriptedDemoReply } from './demoConversation';
import { AuraReplySchema } from './conversation';

function advance(s: State) {
  const next = nextDemoTurn(s)!;
  s.messages.push({ role: 'user', text: next.turn.user });
  const reply = scriptedDemoReply(s, next.turn.user)!;
  AuraReplySchema.parse(reply);
  s.messages.push({ role: 'guide', text: reply.text, meta: { via: reply.via, cited: reply.cited }, draft: reply.draft });
  return reply;
}
describe('labeled demo conversation', () => {
  for (const day of [1, 4, 10]) it(`day ${day} advances only completed dialogue and survives reload`, () => {
    let s = buildDemo(day);
    for (const turn of DEMO_TURNS[day]) {
      expect(nextDemoTurn(s)?.turn.user).toBe(turn.user);
      expect(scriptedDemoReply(s, 'An unrelated question')).toBeNull();
      const reply = advance(s);
      expect(reply.text).toBe(turn.reply);
      if (turn.proposal) expect(offeredDemoDraft(s, reply.draft!.stepId!)).toEqual(demoProposal(turn.proposal));
      s = JSON.parse(JSON.stringify(s));
    }
    expect(nextDemoTurn(s)).toBeNull();
  });
  it('never scripts personal conversations, even with a copied prompt or demo metadata', () => {
    const s = blank(); s.demo = { day: 1, start: '2026-10-01' };
    expect(nextDemoTurn(s)).toBeNull();
    expect(scriptedDemoReply(s, DEMO_TURNS[1][0].user)).toBeNull();
    expect(offeredDemoDraft(s, demoProposal('walk').stepId!)).toBeNull();
  });
  it('does not skip an unanswered or failed user message', () => {
    const s = buildDemo(1), text = DEMO_TURNS[1][0].user;
    s.messages.push({ role: 'user', text });
    expect(nextDemoTurn(s)?.index).toBe(0);
    expect(offeredDemoDraft(s, demoProposal('walk').stepId!)).toBeNull();
  });
  it('later snapshots preserve the same walk, logging and reading story', () => {
    const four = buildDemo(4), ten = buildDemo(10);
    for (const s of [four, ten]) {
      expect(s.plans.find(p => p.stepId === demoProposal('walk').stepId)?.status).toBe('stopped');
      expect(s.plans.find(p => p.stepId === 'chat:caffeine-log')?.status).toBe('active');
      expect(s.decisions.some(d => d.choice === 'stop' && d.reason.includes('Overtime'))).toBe(true);
    }
    const reading = ten.plans.find(p => p.stepId === demoProposal('quiet').stepId)!;
    expect(reading.status).toBe('active');
    expect(ten.feedbacks.filter(f => f.planId === reading.id)).toHaveLength(3);
    expect(ten.messages[0].text).toContain('preloaded scenario events');
  });
});
