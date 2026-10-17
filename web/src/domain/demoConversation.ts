// User-approved, explicitly labeled demo dialogue. Free text still uses the live Agent.
import type { Message, State, StepDraft } from './state';
import type { TopicId } from './topics';

export interface DemoTurn { user: string; reply: string; checkin?: TopicId; proposal?: 'walk' | 'quiet' | 'caffeine' }
export const DEMO_TURNS: Record<number, DemoTurn[]> = {
  1: [
    { user: 'I’m usually drained after work, but I want energy for things I enjoy. Can you help?', reply: 'Let’s focus on how much energy you have left after work. Your demo sleep records give us some context, but we don’t have evening check-ins yet to compare them with. How would you describe your energy this evening?' },
    { user: 'I’ve already tried having coffee earlier. My overtime makes routines difficult.', reply: 'You’ve already tried moving coffee earlier, and overtime makes a fixed routine difficult. We can start by observing your evenings without asking you to change another habit. When you record your energy, you can add a short note if you worked late.' },
    { user: 'What should I do today?', reply: 'Start with one evening-energy check-in. If you’re unsure how to score it, you can describe it in words. That gives us a starting point for understanding how you feel after work.', checkin: 'evening-energy' },
    { user: 'I want energy for things I enjoy after work. Is there something I can try besides tracking?', reply: 'A short walk could be one option if you’d like a manageable way to be active. General activity guidance supports walking, though it doesn’t tell us it will improve your evening energy. Would walking after work feel comfortable and fit your day?' },
    { user: 'Yes. There’s a comfortable route near home. Five minutes sounds manageable.', reply: 'You could try a five-minute walk near home after work, at your own pace, on days it fits. Keep your evening-energy check-in so we can review how it felt and whether the arrangement worked for you. Would you like to start this plan?', proposal: 'walk' }
  ],
  4: [
    { user: 'I’ve been tracking for a few days. What have you noticed about my evening energy?', reply: 'You have three evenings recorded so far in this demo scenario. That’s still below the minimum for a comparison, so I can’t draw a useful conclusion about sleep or caffeine yet. After overtime made the walking plan difficult, you chose to pause it and collect drink times alongside your evening energy.' },
    { user: 'Do I need to stop drinking afternoon coffee?', reply: 'Your records don’t establish that afternoon coffee is behind your low energy. Your current plan is to record drinks and their times without changing your intake. You’ve also tried earlier coffee already, so there’s no need to repeat that suggestion automatically.' },
    { user: 'What’s the most useful thing to do next?', reply: 'Your next evening-energy check-in would bring you to four recorded evenings. We can then check which comparisons have enough matching records; some may still need more data. If you had a drink you haven’t logged today, you can add it too.', checkin: 'evening-energy' },
    { user: 'I’ve been logging coffee, but I also scroll in bed after overtime. Is there something practical I could try?', reply: 'You’ve named a bedtime routine you’d like to change. General sleep guidance supports quiet time before sleep. Your walking plan is paused, so we can consider one manageable routine rather than stacking activities. Could a quiet activity fit your evening without taking away sleep time?' },
    { user: 'I could read a few pages instead of scrolling. I don’t want to go to bed later.', reply: 'Try reading a few pages in place of scrolling before your main sleep, without delaying bedtime. Keep checking how rested you feel after waking. This is an option for your sleep routine; your records haven’t shown that it will improve your evening energy. Would you like to confirm this plan?', proposal: 'quiet' }
  ],
  10: [
    { user: 'What have we learned about my goal of having more energy after work?', reply: 'In this demo scenario, you’ve kept evening-energy and waking-restedness records, paused the walk when overtime got in the way, and tried reading instead of scrolling before sleep. Your feedback includes feeling about the same. We shouldn’t describe that as improvement or assume any routine caused a change.' },
    { user: 'I’ve logged my coffee, but my energy feels about the same. What should I actually try next?', reply: 'Your feedback in this demo scenario includes feeling about the same, and overtime made logging harder. You’ve already tried earlier caffeine, so I’d first check what you tried before suggesting it again. What timing did you try, and when do you usually sleep?' },
    { user: 'I moved it to 4 pm, but sometimes still have one at 8 pm. I usually sleep at midnight. I could move the 8 pm drink earlier.', reply: 'Moving that usual late drink earlier is an option supported by general sleep guidance. It isn’t a conclusion from your energy comparison, and there’s no need to increase your intake. What earlier time would fit your routine?' },
    { user: 'Six would work, with the same drink and amount.', reply: 'The proposed change is to move your usual 8 pm drink to 6 pm, without adding more caffeine. This would replace the reading plan as your active sleep-related step, while preserving its history. Continue your waking-restedness check-in. We can review how manageable it was and how you felt, without assuming the change caused any difference. Would you like to confirm this plan?', proposal: 'caffeine' }
  ]
};

export function demoProposal(kind: NonNullable<DemoTurn['proposal']>): StepDraft {
  const shared = { kind: 'step' as const, days: 'For 7 days', duration: 'When it fits', why: 'General guidance and your stated preferences; not proof of a personal benefit' };
  if (kind === 'walk') return { ...shared, stepId: 'finding:movement-same:0', topicId: 'evening-energy', title: 'Try a short walk after work', why: 'WHO recognizes walking as physical activity. This option follows your interest and comfortable route; it does not establish an energy benefit', desc: 'A comfortable route near home, at your own pace. Five minutes is your choice, not an evidence-based treatment duration.', duration: '5 minutes, when it fits', step: 'If walking feels comfortable and fits your day, try a five-minute walk near home after work at your own pace. Answer your evening-energy check-in as usual.' };
  if (kind === 'quiet') return { ...shared, stepId: 'finding:short-sleep:1', topicId: 'rested-waking', title: 'Make room for a quieter bedtime routine', why: 'NHLBI sleep guidance supports quiet time before sleep. Your chosen reading replaces scrolling without delaying sleep', desc: 'Read a few pages instead of scrolling before your main sleep, without delaying bedtime.', step: 'Before your main sleep, read a few pages instead of scrolling, without delaying bedtime. Keep noticing how rested you feel after waking.' };
  return { ...shared, stepId: 'finding:caffeine-late:1', topicId: 'rested-waking', title: 'Try an earlier caffeine time', why: 'NHLBI sleep guidance advises avoiding caffeine that may interfere with sleep. The timing follows your stated routine, not a proven effect in your records', desc: 'Move your usual 8 pm caffeinated drink to 6 pm, with the same drink and amount. Six is your agreed time, not a universal cutoff.', step: 'If it fits your routine, move your usual 8 pm caffeinated drink to 6 pm, with the same drink and amount. Do not increase your intake. Continue recording how rested you feel after your main sleep.' };
}

const marker = (day: number, index: number) => `demo-dialogue:${day}:${index}`;
export const isScriptedDemoMessage = (m: Message) => m.meta?.via === 'preset' && m.meta.cited?.some(id => id.startsWith('demo-dialogue:'));
export function nextDemoTurn(s: State): { turn: DemoTurn; index: number } | null {
  if (s.mode !== 'demo' || !s.demo) return null;
  const turns = DEMO_TURNS[s.demo.day];
  if (!turns) return null;
  let index = 0;
  // Progress only on completed replies, so errors/retries/reload cannot skip a prompt.
  for (const m of s.messages) if (m.role === 'guide' && isScriptedDemoMessage(m) && m.meta?.cited?.includes(marker(s.demo.day, index))) index++;
  return turns[index] ? { turn: turns[index], index } : null;
}

export function scriptedDemoReply(s: State, text: string) {
  const next = nextDemoTurn(s);
  if (!next || next.turn.user !== text) return null;
  const { turn, index } = next;
  return { text: turn.reply, via: 'preset' as const, cited: [marker(s.demo!.day, index)], action: turn.checkin ? { type: 'checkin' as const, topicId: turn.checkin } : null, draft: turn.proposal ? demoProposal(turn.proposal) : null, logOffer: null };
}

// Demo arrangements are fixed, and only become accept-able after the matching dialogue.
// They never replace the live/personal action catalog.
export function offeredDemoDraft(s: State, stepId: string): StepDraft | null {
  if (s.mode !== 'demo' || !s.demo) return null;
  const turns = DEMO_TURNS[s.demo.day] || [];
  const index = turns.findIndex(t => t.proposal && demoProposal(t.proposal).stepId === stepId);
  if (index < 0) return null;
  const last = s.messages.at(-1);
  if (last?.role !== 'guide' || last.draft?.stepId !== stepId || last.meta?.via !== 'preset' || !last.meta.cited?.includes(marker(s.demo.day, index))) return null;
  return demoProposal(turns[index].proposal!);
}
