# Guided Aura demo — Day 1 / 4 / 10

Based on main (178f852), retaining its goal catalog, Agent, Review, choice validation and safety persistence.

The user-approved suggested prompts are a scripted demonstration, labeled **Scripted demo** in each reply. They do not call Gemini. Personal mode and free-text chat retain the existing Agent integration. This scripted presentation does not replace the existing live Agent or AI review generator.

Open Demo, choose a day, confirm the rebuild, then open Aura. The next full user message appears as a suggestion pill above the composer. Tap it to send; the next pill appears after the reply. Completed turns persist across reload. Once the scripted sequence is finished, ordinary suggestions return.

## Day 1 — Start with the goal, then a manageable action

Five prompts: energy after work → earlier coffee / overtime → what to do today → ask for an action beyond tracking → confirm a comfortable route and five minutes.

After the third reply, **Check in: Evening energy** opens the real form. Confirm/save to persist it. After the fifth reply, preview **Try a short walk after work**, choose the step, check dates and **Confirm and start**. The plan is not created merely by sending the prompt.

## Day 4 — Understand progress and choose a quiet bedtime routine

The snapshot retains the same story: the Day 1 walk was paused on Day 2 around overtime; coffee logging became the recording plan. Three scored evenings are present before today's check-in. Passing the overall four-day threshold does not guarantee every factor has enough valid paired records.

Five prompts: progress → whether to stop coffee → useful next record → bedtime scrolling → confirm reading without delaying sleep.

Preview and confirm **Make room for a quieter bedtime routine**. It belongs to waking restedness; the coffee log remains a recording plan, and the walk remains stopped.

## Day 10 — Review feedback and choose an adjustment

The snapshot preserves the paused walk, coffee records, and the reading plan accepted on Day 4. The reading plan has synthetic execution/change/barrier feedback and is due for review.

Four prompts: what was learned → what to try next → disclose intake / main-sleep timing → agree on 6 pm with no intake increase.

Preview and confirm **Try an earlier caffeine time**. This replaces the reading plan on the waking-restedness observation, retaining its lineage, previous version and feedback. The agreed clock time is a scenario preference, not a universal caffeine cutoff. Existing safety-hold and unedited-instruction checks still apply.

## Scenario continuity

These are preloaded snapshots of one authored story, not an elapsed-time simulation. Switching days intentionally rebuilds demo state and discards current demo edits after confirmation. Each later node includes an explicitly labeled recap. Personal data remains separate. A presenter should say “Now we jump ahead to the next snapshot,” rather than implying that live changes were carried forward.

Source-backed action definitions and limitations: [Action categories and evidence](mock-demo-actions-and-evidence.md). The fixed question/reply pairs and arrangements live in `src/domain/demoConversation.ts`.

## Reply presentation and confirmed-step handoff

The conversation has a scrollable viewport above the composer. New Aura replies reveal sentence by sentence, following the latest segment; actions become available when the reply finishes. Existing history is shown immediately. Reduced-motion preferences bypass the reveal sequence.

After a successful plan acceptance, the server saves an Aura acknowledgement with the actual inclusive plan duration, linked goal and review date. This is labeled **Step confirmed**, not Gemini-generated. It is saved atomically with the plan and remains in chat after reload. The presenter can pause on that acknowledgement before jumping to the next demo snapshot.
