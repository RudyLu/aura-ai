import { describe, expect, it } from 'vitest';
import { buildDemo } from './demo';
import { planConfirmation, replySegments } from './chatPresentation';

describe('chat presentation', () => {
  it('reveals sentences without breaking times, decimals, or losing text', () => {
    const text = 'Your score was 3.2. Move the 8 pm drink to 6 pm.\nDoes that fit your day?';
    expect(replySegments(text)).toEqual(['Your score was 3.2.', 'Move the 8 pm drink to 6 pm.', 'Does that fit your day?']);
  });
  it('acknowledges saved dates and the linked goal without promising a benefit', () => {
    const s = buildDemo(10), p = s.plans.find(p=>p.topicId==='rested-waking')!;
    p.start='2026-10-17'; p.review='2026-10-23';
    const message=planConfirmation(s,p);
    expect(message.text).toContain('7 days');
    expect(message.text).toContain('Feel rested when I wake up');
    expect(message.text).toContain('Oct 23');
    expect(message.text).toContain(p.title);
    expect(message.meta?.cited).toEqual([`plan-confirmed:${p.id}`]);
    expect(message.action).toEqual({type:'feedback',planId:p.id});
  });
  it('observing uses a check-in and handles a one-day plan', () => {
    const s=buildDemo(4), p=s.plans[0]; p.kind='observe';p.review=p.start;
    const message=planConfirmation(s,p);
    expect(message.text).toContain('keep observing for one day');
    expect(message.action).toEqual({type:'checkin',topicId:p.topicId});
  });
});
