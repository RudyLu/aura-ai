import { describe, expect, it } from 'vitest';
import { updateGoals } from './goals';
import { addObservation, blank, saveCheckin } from './state';

describe('Settings goal editing', () => {
  it('updates both sides without changing onboarding concerns or deleting history', () => {
    const s = blank(); s.profile.concerns = ['drained'];
    const evening = addObservation(s, 'evening-energy');
    updateGoals(s, ['drained']);
    saveCheckin(s, { observationId: evening.id, topicId: evening.topicId, status: 'recorded', score: 3 });
    const records = structuredClone(s.checkins);
    updateGoals(s, ['wake-tired']);
    expect(s.profile.concerns).toEqual(['drained']);
    expect(evening.goalIds).toEqual([]); expect(evening.status).toBe('active');
    expect(s.checkins).toEqual(records);
    const waking = s.observations.find(o => o.topicId === 'rested-waking')!;
    expect(waking.goalIds).toEqual(['wake-tired']);
    expect(s.profile.goals![0].observationIds).toEqual([waking.id]);
  });
  it('rejects unknown goals before changing anything', () => {
    const s = blank(), before = structuredClone(s);
    expect(() => updateGoals(s, ['wake-tired', 'not-a-goal'])).toThrow();
    expect(s).toEqual(before);
  });
  it('chooses the strongest catalog match and shares check-ins between goals', () => {
    const s = blank();
    updateGoals(s, ['caffeine', 'slump']);
    expect(s.observations).toHaveLength(1);
    expect(s.observations[0].topicId).toBe('afternoon-sleepiness');
    expect(s.observations[0].goalIds).toEqual(['caffeine', 'slump']);
  });
  it('keeps shared observations and links to goals still selected', () => {
    const s = blank();
    updateGoals(s, ['drained', 'low-energy']);
    const o = s.observations[0]; o.status = 'paused';
    updateGoals(s, ['low-energy']);
    expect(o.goalIds).toEqual(['low-energy']); expect(o.status).toBe('paused');
    expect(s.profile.goals![0].observationIds).toEqual([o.id]);
    updateGoals(s, []);
    expect(s.observations).toHaveLength(1); expect(o.goalIds).toEqual([]);
  });
});
