# Aura Mock Demo — Action Categories and Evidence

Updated: October 16, 2026

**Purpose:** Map the prototype's existing actions to credible guidance and provide source-informed wording for RD review. This is a proposed content revision, not approval to enable pending actions.

**Implementation reference:** The current-action inventory below reflects the frontend handoff baseline. Reconcile it with Rudy's latest implementation before making changes. This document does not claim that the proposed wording is implemented.

## 1. Caffeine Timing

### Current actions

- Last coffee before noon.
- No caffeine after 2 pm.

**Category:** Caffeine timing / sleep habits.

**Evidence:** NIH/NHLBI advises avoiding caffeine that may interfere with sleep. A randomized crossover study also examined how caffeine dose and timing affect subsequent sleep. These sources do not establish noon or 2 pm as universal cutoffs.

- [NIH/NHLBI — Healthy Sleep Habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits)
- [Dose and Timing Effects of Caffeine on Subsequent Sleep — randomized crossover trial](https://pubmed.ncbi.nlm.nih.gov/39377163/)

### Proposed action

**Try an earlier caffeine time**

> If it fits your routine, move your usual late caffeinated drink earlier. Record the time and continue your sleep-related check-in.

### RD notes

- Base the explanation on sleep guidance, not a promise of improved evening energy.
- If the demo requires an exact clock time, define it explicitly for that scenario and planned bedtime. Do not present it as a universal research-backed rule.
- Do not infer that caffeine caused the user's recorded feelings.

## 2. Sleep Routine

### Current action

- Wind down 30 minutes earlier for three nights.

**Category:** Sleep preparation / bedtime routine.

**Evidence:** NIH/NHLBI recommends quiet time before bed and relaxation practices. This supports the general direction, not the exact “30 minutes earlier for three nights” schedule.

- [NIH/NHLBI — Healthy Sleep Habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits)

### Proposed action

**Make room for a quieter bedtime routine**

> Choose a quiet activity before your planned bedtime, such as reading or relaxing without bright screens. Continue recording how rested you feel after waking.

### RD notes

- If retaining the existing 30-minute, three-night schedule, label it as a demo plan setting—not a proven treatment duration.
- Do not instruct users to reduce sleep or force an earlier bedtime.
- Do not claim the action treats insomnia.

## 3. Physical Activity

### Current actions

- A 10-minute walk after work.
- A 10-minute evening walk.

**Category:** Everyday physical activity.

**Evidence:** WHO identifies walking as physical activity and states that some activity is better than none. This supports an accessible activity option, but not a guaranteed improvement in evening energy or next-morning restedness from this exact schedule.

- [WHO — Physical Activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity)

### Proposed action

**Try a short, comfortable walk**

> If walking is suitable for you and fits your schedule, try a short walk at a comfortable pace. Continue your usual check-in and note how you feel.

### RD notes

- The existing 10-minute, three-days-per-week schedule may remain a proposed demo setting, subject to content approval.
- Keep after-work and evening timing tied to the selected scenario; do not assume they produce the same outcome.
- Do not automatically increase duration or intensity when feedback shows no improvement.

## 4. Recording and Self-Monitoring

### Current actions

- Record caffeinated drinks and their times.
- Complete a waking or evening check-in.
- Notice feelings after already-planned activity.
- Reduce recording frequency during a busy week.

**Category:** Self-monitoring / flexible goal planning.

**Evidence:** NICE supports goals and planning, feedback and monitoring as behavior-change techniques. It does not validate Aura's exact recording frequency or guarantee a health benefit from recording.

- [NICE PH49 — Behaviour Change: Individual Approaches](https://www.nice.org.uk/guidance/ph49/chapter/1-Recom-)

### Suggested copy

**Notice your caffeine routine**

> Record caffeinated drinks and their times without changing your usual intake.

**Check in after waking**

> Record how rested you feel after your main sleep.

**Keep it manageable this week**

> Choose an available day for a check-in. You can skip and return later.

### RD notes

- Keep recording optional.
- Do not describe recording as treatment.
- Missing caffeine records must remain unknown, rather than count as no intake.

## Shared Demo Rules

- Use these sources to explain the general rationale, not to claim that mock records prove an action works.
- Clearly identify synthetic history and describe findings as belonging to the demo scenario.
- Keep exact durations, frequencies and clock times distinguishable from research findings.
- Let the Agent select from fixed, agreed action content rather than invent new instructions.
- Require user confirmation before starting or changing a plan.
- Preserve existing safety blocking and PRD approval requirements. Source references alone do not approve an action.
- Period dates remain background context only; do not generate period-derived actions.

## Requested RD Outcome

Reconcile these categories with the latest action catalog, identify the copy changes required, and confirm the small subset proposed for demo approval. No new action category or content-management system is required.

For the confirmed Discovery and mock-period scope, refer to [PRD v0.3, §3.1](https://app.notion.com/p/3eccf214d45e80429dbbef6afaab1841). This document does not introduce a separate analysis configuration.
