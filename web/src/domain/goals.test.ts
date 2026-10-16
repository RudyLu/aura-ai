import { describe, expect, it } from 'vitest';
import { updateGoals } from './goals';
import { addObservation, blank, saveCheckin } from './state';

describe('Settings goal editing', () => {
  it('updates both sides without changing onboarding concerns or deleting history', () => {
    const s = blank(); s.profile.concerns = ['drained'];
    const evening = addObservation(s, 'evening-energy');
    updateGoals(s, [{ id: 'drained', topicIds: ['evening-energy'] }]);
    saveCheckin(s, { observationId: evening.id, topicId: evening.topicId, status: 'recorded', score: 3 });
    const records = structuredClone(s.checkins);
    updateGoals(s, [{ id: 'wake-tired', topicIds: ['rested-waking'] }]);
    expect(s.profile.concerns).toEqual(['drained']);
    expect(evening.goalIds).toEqual([]); expect(evening.status).toBe('active');
    expect(s.checkins).toEqual(records);
    const waking = s.observations.find(o => o.topicId === 'rested-waking')!;
    expect(waking.goalIds).toEqual(['wake-tired']);
    expect(s.profile.goals![0].observationIds).toEqual([waking.id]);
  });
  it('rejects unsuitable or missing observations before changing anything', () => {
    const s = blank(), before = structuredClone(s);
    expect(() => updateGoals(s, [{ id: 'wake-tired', topicIds: ['evening-energy'] }])).toThrow();
    expect(() => updateGoals(s, [{ id: 'drained', topicIds: [] }])).toThrow();
    expect(s).toEqual(before);
  });
  it('keeps shared observations and links to goals still selected', () => {
    const s = blank();
    updateGoals(s, [{ id: 'drained', topicIds: ['evening-energy'] }, { id: 'low-energy', topicIds: ['evening-energy'] }]);
    const o = s.observations[0]; o.status = 'paused';
    updateGoals(s, [{ id: 'low-energy', topicIds: ['evening-energy'] }]);
    expect(o.goalIds).toEqual(['low-energy']); expect(o.status).toBe('paused');
    expect(s.profile.goals![0].observationIds).toEqual([o.id]);
    updateGoals(s, []);
    expect(s.observations).toHaveLength(1); expect(o.goalIds).toEqual([]);
  });
});
