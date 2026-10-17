# Aura Mock Demo — Action Categories and Evidence

Updated: October 17, 2026

## Implementation decision

Enable the five existing caffeine, sleep, and walking actions with the wording and eligibility rules below for reviewer exploration beyond the scripted demo. Keep all recording and observe-only actions available. A lifestyle action is not required for every goal. This specification is an implementation decision, not a claim that the changes are deployed or clinically validated.

Scope: update existing action content and selection rules; no new action category or content-management system is required. This document supersedes the earlier pending-review language. Preserve runtime safety handling and user confirmation before starting or changing a plan.

## Verified inventory and implementation baseline

Inventory was inspected in the local `ellie/aura-v2` checkout at `4751510`. The five lifestyle actions are suppressed by the empty intervention map in `web/src/domain/uiDiscovery.ts`, but remain in the legacy catalog in `web/src/domain/discovery.ts` and the Agent menu in `web/src/domain/steps.ts`. They are not uniformly disabled across all code paths. Synchronize Discovery and Agent behavior when implementing this specification.

| Existing ID | Existing title | Target decision and title |
| --- | --- | --- |
| `finding:caffeine-before:1` | Last coffee before noon | Enable: Try an earlier caffeine time |
| `finding:caffeine-late:1` | No caffeine after 2 pm | Enable: Try an earlier caffeine time |
| `finding:short-sleep:1` | Wind down 30 minutes earlier | Enable: Make room for a quieter bedtime routine |
| `finding:movement-same:0` | A 10-minute walk after work | Enable: Try a short walk after work |
| `finding:movement-prev:0` | A 10-minute evening walk | Enable: Try a short, comfortable evening walk |

Retain these IDs. The two caffeine entries share content; show only one caffeine action in a recommendation set.

| Existing recording/observation ID | Existing title | Target behavior |
| --- | --- | --- |
| `chat:checkin-tonight` | Answer tonight’s evening-energy check-in, or skip it | Keep available for `evening-energy`; answering and skipping are valid choices. This is the exact catalog title corresponding to “Answer tonight’s check-in, or skip it.” |
| `observe:${topicId}` | Keep noticing [topic] | Keep available; substitute the actual topic name; preserve observe-only behavior. Defined in `web/src/domain/uiSteps.ts`. |
| `chat:caffeine-log` | Log each caffeinated drink with its time | Keep available for relevant caffeine observation; no intake change required. |
| `chat:movement-notice` | Check your evening energy on days you move | Keep available for `evening-energy`; notice already-planned activity, without adding a workout. |
| `chat:busy-week` | Answer one [check-in name] this week | Keep available for the relevant topic; the user chooses a day. |
| `chat:waking-checkin` | Answer a waking check-in each morning | Keep available for `rested-waking`; rename to “Check in after your main sleep.” Replace “Each morning for 7 days” with “After your main sleep, for 7 days” and remove the within-one-hour requirement. |

These are catalog/UI availability observations, not an end-to-end verification of the deployed build.

## 1. Caffeine timing

### `finding:caffeine-before:1`

- **Eligibility:** A user wants to explore caffeine timing, or has a sleep-related goal and reports late caffeine use. Afternoon sleepiness, focus, or evening energy alone is insufficient. Existing `afternoon-sleepiness` or `evening-energy` observations may remain attached, but must not be presented as proof of a sleep benefit. Sleep-specific monitoring uses an existing or user-confirmed `rested-waking` observation.
- **Conditions:** Establish actual caffeine use, usual timing, main-sleep timing, and willingness to try a timing adjustment. Caffeine before a check-in does not establish caffeine close to sleep. Ask about missing timing context before recommending.
- **Expected behavior:** Explain the option using general sleep guidance and the user's stated context. Never infer that an earlier drink will improve evening energy from the `caffeine-before` comparison.
- **Acceptance:** With only an afternoon-slump goal and unknown intake timing, clarify or offer relevant recording. With confirmed late intake and interest in adjustment, offer the action without promising benefit.

### `finding:caffeine-late:1`

- **Eligibility:** Fall asleep more easily, Wake up rested, or Keep steadier sleep times, with `rested-waking`. Other goals qualify only when the user also expresses a sleep concern and chooses that observation.
- **Conditions:** Confirm late intake relative to the user's main sleep and agree on a feasible earlier time. An existing after-2-pm grouping is an analysis setting, not a universal cutoff.
- **Expected behavior:** Adapt to shift schedules and the user's sleep period. Do not equate an earlier clock time with a suitable recommendation for every schedule.
- **Acceptance:** A shift worker receives main-sleep-relative wording. A user who does not consume caffeine does not receive this action. Both caffeine entries produce at most one visible option.

### Shared wording

**Try an earlier caffeine time**

> If it fits your routine, try moving a usual late caffeinated drink earlier. Log when you have it and keep noticing how you feel. There is no need to increase your intake.

If a waking observation is active, add: “Continue recording how rested you feel after your main sleep.” Do not silently create a new observation.

**Evidence:** NHLBI advises avoiding caffeine that may interfere with sleep. A randomized crossover trial examined dose and timing in 23 males and found different effects for 100 mg and 400 mg doses. This supports considering timing and dose, not universal noon/2-pm deadlines or a guarantee of better evening energy. Trial-specific doses and time intervals must not become individualized prescriptions. NHLBI — Healthy Sleep Habits; Gardiner et al. — Dose and timing effects of caffeine on subsequent sleep.

**Product safety rules for both actions:** Do not recommend increased intake, compensatory concentrated consumption, abrupt total cessation, or changes conflicting with clinician guidance. Do not propose an arrangement that conflicts with disclosed work-safety needs. Personal records show associations, not that caffeine caused a feeling. Missing intake records remain unknown, not confirmed non-use.

## 2. Sleep routine — `finding:short-sleep:1`

- **Eligibility:** Sleep-related goals with `rested-waking`. Energy-related goals qualify only when the user also reports a bedtime-routine concern; explain that the action concerns sleep preparation, not a proven energy treatment.
- **Conditions:** The user wants to try a feasible quiet routine. One short-sleep record alone does not trigger the recommendation.
- **Expected behavior:** Refer to the user's main sleep and available schedule. Do not interpret an under-seven-hours analysis group as an individual diagnosis or prescribed sleep target.

**Make room for a quieter bedtime routine**

> Before your main sleep, choose a quiet activity that fits your routine, such as reading or relaxing away from bright screens. Keep noticing how rested you feel after waking.

**Evidence and limitations:** NHLBI supports quiet time before bed and relaxation practices. It does not establish “30 minutes earlier for three nights” as a validated treatment schedule. NHLBI — Healthy Sleep Habits.

**Safety:** Do not reduce sleep opportunity, force earlier sleep, change medication, or claim to treat insomnia. The routine must not displace sleep or conflict with required duties or clinician guidance.

**Acceptance:** Offer for a stated, feasible wind-down preference. Adapt to daytime main sleep. Do not recommend sacrificing sleep to complete the routine.

## 3. Walking

### `finding:movement-same:0`

- **Eligibility:** Stay active; Have energy after work, Feel more energetic, or Have energy to exercise only when the user also wants a manageable activity option. Use the relevant `evening-energy` observation without promising improvement.
- **Conditions:** The user indicates walking is comfortable and feasible, with suitable timing and surroundings. If there is no after-work context, confirm a suitable time and adapt the title.
- **Expected behavior:** Offer a manageable length and comfortable pace. A daily activity total may include activity after the check-in; it cannot demonstrate that walking improved that evening's energy.

**Try a short walk after work**

> If walking feels comfortable and fits your day, try a short walk after work at your own pace. Choose a manageable length, and answer your evening-energy check-in as usual.

**Acceptance:** Offer when the user wants activity and reports feasibility. Do not infer feasibility from an activity record or recommend walking solely because an energy score is low.

### `finding:movement-prev:0`

- **Eligibility:** Sleep-related goals with `rested-waking`, plus user interest in everyday walking.
- **Conditions:** Evening walking is comfortable, safe, feasible, and does not delay main sleep.
- **Expected behavior:** Explain this as an optional activity to explore, not a demonstrated way to improve next-morning restedness. Previous-day activity is not evidence about evening walking specifically.

**Try a short, comfortable evening walk**

> If it fits your routine, try a short evening walk at a comfortable pace without delaying your main sleep. After waking, record how rested you feel.

**Acceptance:** Offer when the stated conditions hold. If evening timing would delay sleep, do not offer that arrangement; discuss another feasible option or recording without silently changing the plan.

### Shared evidence and safety

WHO recognizes walking as physical activity and supports doing some activity rather than none. This does not validate a ten-minute, three-days-per-week schedule as a way to improve a particular user's energy or restedness. WHO — Physical activity.

Product rules: do not recommend walking against disclosed mobility/activity restrictions or in unsafe surroundings. Stop if activity causes discomfort or symptoms; preserve the existing safety response for concerning symptoms. Do not automatically increase duration, frequency, or intensity when the user reports no improvement. Ten minutes may be an adjustable plan option, not a requirement.

## 4. Recording and self-monitoring

Recording is a meaningful next step in its own right. Connect it to a relevant goal, question, or observation; do not offer it mechanically whenever a lifestyle action is unavailable.

- **Notice your caffeine routine:** “Record caffeinated drinks and their times without changing your usual intake.”
- **Check in after your main sleep:** “Record how rested you feel after waking from your main sleep.”
- **Keep it manageable this week:** “Choose an available day for a check-in. You can skip and return later.”
- **Keep noticing [topic]:** “Answer your [check-in name] when it fits, or skip.” Render the actual topic and check-in name.
- **Tonight's check-in:** Keep the existing evening-energy wording and explicit skip choice.

NICE supports goals/planning and self-monitoring as behavior-change techniques. It does not validate Aura's exact frequency or guarantee a health benefit from journaling. NICE PH49, Recommendation 7.

Acceptance: skipping does not create an answer or completed action; observe-only does not change the user's routine. Offer pause/adjust controls only where implemented, and never claim an unsupported change was saved.

## 5. Shared Agent and plan rules

These are product selection rules informed by the cited sources, not a clinically validated recommendation algorithm.

1. Match both the user's goal and context. Sharing `evening-energy` does not make mood/stress goals automatically eligible for caffeine or walking actions. Unlisted goals receive no automatic lifestyle mapping; ask about the relevant concern or offer meaningful observation.
2. Support two recommendation routes: a real, relevant finding, or an explicit user need that meets the action conditions. Without a finding, describe general guidance; never say “your data shows” or fabricate a finding to pass validation.
3. Retain the existing IDs. For explicit-need recommendations, update the current finding-only gate to distinguish recommendation provenance from catalog identity. Only actual finding-backed suggestions receive finding text or factor-based rationale. Never bypass the gate by inventing evidence.
4. Ask only for missing context needed by the action. When context is insufficient, clarify, offer relevant recording, or offer no action.
5. Use fixed action content. Adapt user-confirmed timing and plan settings without inventing additional health instructions.
6. Require user acceptance before creating or changing a plan. Declining, browsing, or skipping is not completion. Do not repeatedly pressure a user who declines.
7. Three days, three nights, three days per week, and seven days are adjustable demo plan settings, not research-backed treatment durations. Remove mandatory noon/2-pm cutoffs, a mandatory 30-minute shift, and a mandatory ten-minute walk from copy and metadata. If a setting is retained as an option, label it as a plan choice.
8. Plan review addresses observations, feasibility, and user feedback. No improvement does not establish failure and must not trigger automatic escalation.
9. Mark synthetic history clearly; describe its findings as demo-scenario observations. Keep period dates as background context only, with no period-derived actions.
10. Apply the same eligibility and safety rules in Discovery, Agent suggestions, and plan acceptance. Recheck relevant conditions at acceptance so stale drafts cannot bypass them.

### Concrete arrangements and plan dates

Before acceptance, confirm the specific drink/timing, quiet activity, or walk timing/length the user will try. This arrangement defines Done / Partly done / Not done; record perceived change separately. Not doing the action is not a worse feeling score.

New demo plans default to seven days unless another supported duration is user-confirmed. Show and save start and Review dates; seven days does not require daily execution. Existing Day 10 plans keep their original dates and feedback. Reopening the app, viewing Review, or updating wording must not restart them. A confirmed adjustment creates a new version while preserving prior history.

If evening walking does not fit a shift worker's or another user's routine, offer another eligible option, relevant observation, or no action. Do not silently rename/reschedule the action; a changed arrangement needs confirmation and its own eligibility checks.

## 6. Acceptance checklist

| Scenario | Expected result |
| --- | --- |
| Reviewer explores outside the scripted demo | All three categories can be offered when their conditions hold. |
| Afternoon fatigue with unknown caffeine timing | Clarify or offer recording; no automatic cutoff recommendation. |
| Late caffeine, sleep concern, interest in adjustment | Offer earlier timing without promising a benefit. |
| Shift worker with daytime main sleep | Use main-sleep-relative language, not fixed morning/night assumptions. |
| User wants a feasible quiet routine | Offer the routine without reducing sleep opportunity. |
| User wants comfortable, feasible after-work activity | Offer a short walk without claiming an energy benefit. |
| Walking conflicts with restrictions or sleep timing | Do not offer that arrangement; recording or no action is acceptable. |
| Explicit relevant user need, no finding | A general option can be offered without fabricated evidence. |
| Both caffeine IDs qualify | Show one caffeine option. |
| No suitable lifestyle action | Relevant recording or no action; never force a match. |
| User declines or skips | No plan/completion is created and no repeated pressure. |
| Missing caffeine records | Unknown remains unknown, not “no caffeine.” |
| Discovery versus chat versus acceptance | Consistent content, eligibility, safety, and provenance handling. |

## RD delivery

Implement the five lifestyle actions and retain all six recording/observation templates above. Synchronize the two discovery catalogs and the Agent/acceptance path; verify this checklist. This documentation change does not itself enable runtime actions.

For the existing Discovery and mock-period scope, retain [PRD v0.3, section 3.1](https://app.notion.com/p/3eccf214d45e80429dbbef6afaab1841) as the background reference; this specification does not introduce a separate analysis configuration.

## Source links

- [NHLBI — Healthy Sleep Habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits)
- [Gardiner et al. — Dose and timing effects of caffeine on subsequent sleep](https://pubmed.ncbi.nlm.nih.gov/39377163/)
- [WHO — Physical activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity)
- [NICE PH49 — Recommendation 7](https://www.nice.org.uk/guidance/ph49/chapter/1-recommendations)
