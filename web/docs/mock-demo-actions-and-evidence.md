# Aura Mock Demo — Action Categories and Evidence

Updated: October 17, 2026

**Purpose:** Document the product-confirmed action categories and copy for reviewer exploration, with supporting evidence. Product scope and wording were confirmed on October 17, 2026. Activation depends on traceable source evidence, fixed eligibility/limitations and passing engineering checks in PRD §3.3. No named professional health-content reviewer or external sign-off is required for this mock demo; do not claim clinical validation.

**Availability reported by Rudy:** Lifestyle actions were disabled and recording/check-in actions were enabled at his production review. This document does not establish that deployment has changed.

**Implementation reference:** The current-action inventory below reflects the frontend handoff baseline. Reconcile it with Rudy's latest implementation before making changes. The wording is product-confirmed; implementation and deployed availability still require verification.

## 1. Caffeine Timing

### Earlier action labels — not the confirmed replacement copy

- Last coffee before noon.
- No caffeine after 2 pm.

**Category:** Caffeine timing / sleep habits.

**Evidence:** NIH/NHLBI advises avoiding caffeine that may interfere with sleep. A randomized crossover study also examined how caffeine dose and timing affect subsequent sleep. These sources do not establish noon or 2 pm as universal cutoffs.

- [NIH/NHLBI — Healthy Sleep Habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits)
- [Dose and Timing Effects of Caffeine on Subsequent Sleep — randomized crossover trial](https://pubmed.ncbi.nlm.nih.gov/39377163/)

### Product-confirmed action

**Try an earlier caffeine time**

> If it fits your routine, move your usual late caffeinated drink earlier. Record the time and continue your sleep-related check-in.

### RD notes

- Use rested-waking as the primary observation in a relevant sleep context. Base the explanation on sleep guidance, not a promise of improved evening energy.
- Use the fixed earlier-time wording without imposing a new clock cutoff. Existing intake and planned sleep times may be described as context; the Agent must not invent a timing prescription.
- Do not infer that caffeine caused the user's recorded feelings.

## 2. Sleep Routine

### Earlier action label — not the confirmed replacement copy

- Wind down 30 minutes earlier for three nights.

**Category:** Sleep preparation / bedtime routine.

**Evidence:** NIH/NHLBI recommends quiet time before bed and relaxation practices. This supports the general direction, not the exact “30 minutes earlier for three nights” schedule.

- [NIH/NHLBI — Healthy Sleep Habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits)

### Product-confirmed action

**Make room for a quieter bedtime routine**

> Choose a quiet activity before your planned bedtime, such as reading or relaxing without bright screens. Continue recording how rested you feel after waking.

### RD notes

- Use the confirmed flexible wording above; do not carry over the earlier mandatory 30-minute, three-night prescription.
- Use rested-waking as the primary observation; evening energy may supply context but is not an interchangeable outcome. Do not instruct users to reduce sleep or force an earlier bedtime.
- Do not claim the action treats insomnia.

## 3. Physical Activity

### Earlier action labels — not the confirmed replacement copy

- A 10-minute walk after work.
- A 10-minute evening walk.

**Category:** Everyday physical activity.

**Evidence:** WHO identifies walking as physical activity and states that some activity is better than none. This supports an accessible activity option, but not a guaranteed improvement in evening energy or next-morning restedness from this exact schedule.

- [WHO — Physical Activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity)

### Product-confirmed action

**Try a short, comfortable walk**

> If walking is suitable for you and fits your schedule, try a short walk at a comfortable pace. Continue your usual check-in and note how you feel.

### RD notes

- Use the confirmed short, comfortable walk wording; do not enforce the earlier 10-minute, three-days-per-week prescription.
- For this demo, use evening-energy as the primary observation when the user wants a suitable activity-related step. Record execution separately. Do not attach the action to rested-waking, stress or productivity automatically; do not assume after-work and evening timing produce identical outcomes.
- Do not automatically increase duration or intensity when feedback shows no improvement.

## 4. Recording and Self-Monitoring

### Recording and observation inventory

- Record caffeinated drinks and their times.
- Complete a waking or evening check-in.
- Answer tonight’s check-in, or skip it.
- Keep noticing [topic].
- Notice feelings after already-planned activity.
- Reduce recording frequency during a busy week.

**Category:** Self-monitoring / flexible goal planning.

**Evidence:** NICE supports goals and planning, feedback and monitoring as behavior-change techniques. It does not validate Aura's exact recording frequency or guarantee a health benefit from recording.

- [NICE PH49 — Behaviour Change: Individual Approaches](https://www.nice.org.uk/guidance/ph49/chapter/1-Recom-)

### Product-confirmed copy

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
- Preserve safety blocking and the evidence/configuration and engineering checks in PRD §3.3. Sources support the documented rationale, not guaranteed safety or effectiveness; no additional named professional sign-off is required.
- Period dates remain background context only; do not generate period-derived actions.

## Implementation and release requirements

- Prepare all three lifestyle categories for eligible reviewer exploration, not only the scripted demo. Product scope and wording are confirmed; record per-action source links, supported rationale, evidence limitations, eligible contexts, exclusions, stopping conditions, engineering test results and actual deployment availability separately.
- For caffeine timing, use a relevant sleep/rested-waking context. An evening-energy/caffeine group difference alone must not trigger the action. Do not increase intake or prescribe a universal clock cutoff.
- Keep all recording alternatives, including activity already planned, optional check-ins, and “Keep noticing [topic]”. Do not force lifestyle steps for every goal.
- Seven days is a demo plan setting, not an effectiveness threshold. Use “After your main sleep, for 7 days”; replace “within an hour of waking” with “after waking from your main sleep”.
- Say “in this demo scenario” in synthetic findings, chat and Review. Show the actual analysis date range, group counts and missingness. Never treat absent caffeine logs as confirmed no intake or use a group difference as proof of causation.
- Preserve user confirmation, safety blocking, refusals, constraints, feedback and prior plan versions. If an action does not pass its release checks, leave that action unavailable and offer recording/observation; another cleared category need not remain disabled.
- RD verifies current action IDs and deployed copy against this inventory. No new category or content-management system is required.

For the confirmed Discovery and mock-period scope, refer to [PRD v0.3, §3.1](https://app.notion.com/p/3eccf214d45e80429dbbef6afaab1841). This document does not introduce a separate analysis configuration.
