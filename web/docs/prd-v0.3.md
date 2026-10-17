# Aura — Product Requirements Document v0.3

- Source: [PRD v0.3 in Notion](https://app.notion.com/p/3eccf214d45e80429dbbef6afaab1841)
- Source last edited: October 17, 2026
- Synced to this repository: October 17, 2026 (Asia/Taipei)

This file mirrors the source PRD, including the October 17 confirmed action, evidence-backed release and goal-management decisions. Implementation and deployment require separate acceptance evidence. Linked specification appendices and the Notion change log remain external references; their contents are not copied into this file.

---

Product Requirements Document (PRD) v0.3 · Updated: 2026-10-17

[Aura — Topic Behavior Definitions](https://app.notion.com/p/3f2cf214d45e81fc8c75c85102f8fe21)
[Aura — Gemini Implementation Prompt](https://app.notion.com/p/3f2cf214d45e819781fdf6280dd0de17)
[Aura — Multifactor Understanding and Response Policy](https://app.notion.com/p/3f2cf214d45e81208829c7bbc29813f4)
[Aura · Daily HRV & Relative Index Tracking — Spec](https://app.notion.com/p/3f3cf214d45e814bbf93fbdc78172ee4)
**Reading guide for reviewers:** This document specifies product requirements, not verified implementation status. The judging flow uses labelled mock/synthetic history and actual supported backend interactions. Confirmed Discovery rules are in §3.1; action content and evidence-backed engineering release checks are in §3.3–§3.3.1. Historical alternatives in §3.1.1 and real-data future scope are not active demo requirements. This submission does not require a named professional health-content reviewer and must not claim clinical or professional validation.
## 1. MVP scope
Problem: How can people make choices when multiple lifestyle factors, physical feelings and practical constraints overlap?
The MVP must demonstrate **traceable evidence from labelled scenario records, trade-offs between two goals, a feasible user-confirmed next step, and subsequent feedback-based review**. Personal-record support remains a product capability; judges do not need to supply real health history.
The Agent organizes overlapping lifestyle signals and feelings, clarifies what is known and missing, and helps users choose a next step that fits their current circumstances.
Agent capabilities:
1. **Maintain the whole picture:** Understand simultaneous concerns instead of treating each issue as an unrelated tool.
2. **Organize uncertainty:** Distinguish evidence-supported observations, user hypotheses and missing information.
3. **Help users focus:** Jointly choose a direction worth observing or adjusting within a complex situation.
4. **Revise over time:** Update understanding and next steps as data, constraints or feelings change.
**Scenario: Maintaining a basic sense of well-being during a busy period makes the Agent's value easiest to demonstrate.**
The value lies in responding to real-life constraints. When users cannot follow a plan, the system should offer a smaller plan or observation-only mode rather than repeat reminders. No new calendar integration is required; a brief statement and structured options are sufficient for v1.
Busy schedules and constraints require only brief input; the challenge is adjusting plans appropriately. **When a user says “I have to work late this week,” preserve the goal and help simplify the approach.**
**Storyline:**
> **“I want energy after work for things that matter to me, so I often rely on afternoon coffee. I also worry about sleeping poorly. I want to find an approach that works for me, but I am working late this week, so the plan cannot be difficult to follow.”**
---
The capabilities below remain the product MVP direction. For the judging demo, use clearly labelled mock/synthetic history; the confirmed demo scope and §3.1 take precedence. Synthetic data must not be presented as proof of real-device integration or health effectiveness. Preserve existing import functionality; no additional real-data integration work is required for this demo.
<table header-row="true">
<colgroup>
<col width="51">
<col>
<col>
<col>
</colgroup>
<tr>
<td>ID</td>
<td>Feature</td>
<td>MVP behavior</td>
<td>Acceptance criteria</td>
</tr>
<tr>
<td>F1</td>
<td>Multiple concurrent concerns</td>
<td>Create multiple observation topics, each defining the feeling to track, while sharing contextual data.</td>
<td>A user can track at least two topics simultaneously, each with its own progress and findings, without re-entering lifestyle data.</td>
</tr>
<tr>
<td>F2</td>
<td>Multiple data sources</td>
<td>Demonstrate shared lifestyle signals through labelled mock source records, retaining provenance and timestamps. Preserve existing real-data entry points without making their validation a demo requirement.</td>
<td>Merge mock records into a timeline without double-counting duplicates; explain missingness and conflict handling. Do not claim physical-device integration from synthetic sources. Real imports, device connectivity and sync are outside demo acceptance.</td>
</tr>
<tr>
<td>F3</td>
<td>Lightweight daily recording</td>
<td>Record the topic-specific 1–5 feeling score, occurrence time and optional notes; support Not sure and skipping. A separate Save words only check-in option is not part of this demo.</td>
<td>Allow creation and editing; distinguish missing records from explicitly reported absence.</td>
</tr>
<tr>
<td>F4</td>
<td>Food-photo extraction</td>
<td>Gemini proposes food/drink types and fields requiring confirmation from an uploaded photo. Save only after user confirmation.</td>
<td>Support extraction, correction and saving from actual photos, with editable intake time. Do not assert precise nutrition or unknown ingredients from an image.</td>
</tr>
<tr>
<td>F5</td>
<td>Period dates</td>
<td>For this demo, show clearly labelled mock period dates. With user permission and when relevant, dates may provide Agent context. Do not enable period-related comparisons.</td>
<td>Display mock dates alongside other records. Without permission, exclude period dates from Agent context. Do not infer cycle phases, predict periods, claim causation or recurring cycle patterns. Real-data extensions and the proposed 56-day period lookback are future scope.</td>
</tr>
<tr>
<td>F6</td>
<td>Pattern / Discovery</td>
<td>Align timestamps and compare predefined conditions; Gemini explains supported results.</td>
<td>Every number is traceable to data, comparison groups and observation dates. Provide normal states for insufficient data and no consistent pattern.</td>
</tr>
<tr>
<td>F7</td>
<td>Small-step plans</td>
<td>The Agent proposes low-risk lifestyle observation/adjustment steps with rationale, tracking fields and a review point.</td>
<td>Users can accept, modify, decline or choose observation only. Plans do not start without acceptance.</td>
</tr>
<tr>
<td>F8</td>
<td>Feedback and updates</td>
<td>Record execution and perceived change separately; review alongside new data.</td>
<td>Keep done/partly/not done separate from better/same/worse, with uncertainty options. Preserve prior plans and reasons when updating.</td>
</tr>
<tr>
<td>F9</td>
<td>Interactive demo</td>
<td>Provide historical cases, time nodes, live record entry, reanalysis and case reset.</td>
<td>Label synthetic data; each node accesses only information available by its cutoff. New records pass through the actual analysis flow.</td>
</tr>
</table>
- **Future real-device integration:** Device/platform combinations, access methods and completion criteria require a separate future specification. Existing file imports remain available but are outside this demo's acceptance scope. Multiple synthetic sources demonstrate an integration model, not completed real-device connectivity.
### Data-entry feasibility research — historical reference; real-data future scope
The earlier research proposal compared a full iPhone app, a lightweight iPhone connector plus web, and Apple Health export plus web, covering fields, permissions, updates, operation and effort. This work is not a prerequisite for the mock-data judging demo. Preserve existing functionality; future real-data extensions need their own scope. Research ownership does not imply all development ownership, and support for other brands or AirPods is not promised.
### Period data: mock demo scope and real-data future scope
For the judging demo, use clearly labelled mock period dates as chart background information. With user permission and when relevant, the Agent may describe the supplied date context. Do not generate period-related group comparisons, infer cycle phases, predict periods, claim causation or recommend lifestyle changes based on these dates. No new real period-data import/sync functionality is required for this demo; preserve existing import functionality.
**Future scope — real data:** Evaluate a separate 56-day period lookback without extending the general 28-day Discovery window. Fifty-six days does not guarantee sufficient data or two complete cycles. Before future comparisons, check for separate period episodes, valid feeling check-ins on period and comparison days, and confirmed data coverage. Missing bleeding records must not automatically count as non-period days. Episode grouping, minimum valid-day counts and coverage rules remain to be specified.
Future implementation must handle one-time iPhone snapshots and re-sync: distinguish the actual received date range, last sync time and subsequent unknown dates. Unsynced dates must not be treated as no bleeding. Users must be able to inspect dates cited by an analysis.
Previously available real period history of approximately two months may be retained for future validation; it is not a submission prerequisite. Never reconstruct unrecorded historical feelings. Keep real and synthetic data separate.
### Out of scope for this submission
- Financial/credit-card transaction integrations, payments and subscriptions.
- Arbitrary disease diagnosis, medication adjustment and treatment advice.
- General-purpose health chat and arbitrary third-party tool operation.
- Complete long-term effectiveness validation and support for all wearable brands.
**Retrieval scope — confirmed:** No dynamic RAG for this submission. Use the limited, sourced, versioned content and fixed action whitelist in §3.3.1. No general medical Q&A, vector index or unrestricted runtime web retrieval. Omitting RAG does not authorize invented advice; references must support the actual action rationale and its limitations.
## 2. Prototype
Design prototype: [Aura prototype](https://aura-ai.elliechenhere.chatgpt.site/)
Engineering Gemini-enabled deployment: [Aura Cloud Run](https://aura-web-664697749037.us-central1.run.app/)
GitHub: [Aura engineering repository](https://github.com/RudyLu/aura-ai), with changes reviewed through [PR #1](https://github.com/RudyLu/aura-ai/pull/1). Use the deployed engineering version for acceptance. The earlier design prototype and ZIP handoff are historical references, not evidence of deployed feature parity.
1. **Start / topic setup:** Onboarding selects concerns and recommends supported goals/observations; later Settings edits goals directly (§2.1). Clarify the tracked feeling and recording method. Do not equate ambiguous experiences with device sleep stages.
2. **Data connection:** Choose available sources and confirm their purpose; show acquired and missing signals.
3. **Today:** Shared check-ins, photo/text recording, current small steps and feedback entry.
4. **Timeline:** Lifestyle events, subjective feelings, period dates and undertaken steps, filterable by topic.
5. **Topics and Discovery:** Observations, evidence, limitations and next steps; separate states per topic.
6. **Review:** Execution, before/after records and Agent updates; continue, modify or stop.
Concurrent topics do not imply many simultaneous changes. Prefer only a small number of active steps per round to avoid burden and uninterpretable results.
### Topic setup options: historical alternatives and effort estimates
Free text is an expression method, not a promise to support arbitrary health questions. These planning estimates assume one engineer familiar with the technology, with basic UI, database and Gemini calls already available. Person-days are workload, not calendar duration or a delivery commitment. Estimates exclude topic-specific analysis engines, health-content validation and overall integration; engineering must reassess them.
<table header-row="true">
<tr>
<td>Option</td>
<td>User experience</td>
<td>Initial estimate</td>
<td>Scope and trade-offs</td>
</tr>
<tr>
<td>A. Templates only</td>
<td>Select a scenario card and adjust time and feeling.</td>
<td>1–2 person-days</td>
<td>Template selection, configuration and persistence; most predictable, with limited personal expression.</td>
</tr>
<tr>
<td>B. Free text mapped to templates</td>
<td>Describe freely → Agent organizes → user confirms; ask 1–2 questions if needed.</td>
<td>3–5 person-days</td>
<td>Structured extraction, template mapping, clarification and unsupported-input handling; preserves expression while constraining analysis.</td>
</tr>
<tr>
<td>C. Freely created observations</td>
<td>The Agent designs tracking fields, analysis and recommendations.</td>
<td>8–15+ person-days, potentially increasing</td>
<td>Dynamic observation specifications and validation. The main uncertainty is validating new analyses and advice, which prompts alone cannot solve.</td>
</tr>
</table>
**Target for this version: constrained option B using the existing five-topic catalog, with mapping/clarification and user confirmation.** Five topics do not mean five completed comparison engines. Stress and productivity provide recording, contextual summaries and plan reviews only in v1; unconfigured factor comparisons remain disabled. Engineering must confirm complete scope and effort. Additional wording for an existing template and a new tracking/analysis method require separate estimates.
#### Option B mapping behavior — constrained five-topic scope
Maintain a topic configuration catalog, not just a keyword-to-symptom dictionary. Each template defines the tracked feeling, confirmation question, scale, required signals, analysis windows and comparisons, insufficient-data response, permitted next steps and unsupported scope.
Decompose free text into feeling, time, context/event and location, then ask for confirmation. For “My brain feels dull during afternoon meetings,” clarify sleepiness, fatigue or difficulty concentrating; do not treat these as synonyms or infer location.
Suggested flow: free text → structured extraction → candidate templates → clarification if needed → user confirmation → observation creation. If mapping fails, explain supported scope and allow a personal record instead of forcing an unsuitable template.
Acceptance for option B must cover different expressions mapping to one template, confirmation of ambiguity, reuse of shared fields across topics and no forced mapping for unsupported input.
### Input boundaries and check-ins — confirmed October 2
- Express topics as time/location/context plus feeling, such as afternoon low energy, not feeling rested after waking or a racing mind before bed. Do not add GPS. Use the five existing topics below; free text cannot create unvalidated analyses.
- Clear match: create after confirmation. Ambiguous/multiple topics: ask at most two clarification questions, then offer scenario cards. No match: choose another template or save a record only. Safety concerns take priority. Allow only valid template IDs; model-reported confidence is not sufficient.
- Service failures and prompt injection must not start plans. Test synonyms, misspellings, mixed and out-of-scope inputs. Re-estimate option B's 3–5 person-days to include boundaries; if time is insufficient, use customizable scenario templates plus text notes, which do not enable new analysis.
- Each observation topic has at most one valid, confirmed time-window summary per day, with editable versions. Store event notes separately; they do not add valid days. Use independent 1–5 subjective scales for the five topics; see §2.1 for questions, labels and directions. The old afternoon-fatigue scale remains only in the historical proposal in §3.1.1 and must not be applied directly to afternoon-sleepiness.
- Use each topic's own 1–5 scale with optional notes, plus “Not sure” and skip states. Remove the standalone “Save words only” check-in option; users wanting a text-only description may use Aura chat. Existing test/legacy text-only records retain a null score and never add a numeric comparison day. Unanswered is unknown, not symptom-free; scores from different topics are not interchangeable.
- Initially show due reviews when the app opens; background scheduling and push notifications are not promised.
### 2.1 Topics, goals and daily records — behavioral baseline; not clinical scales
<table header-row="true">
<tr>
<td>Topic ID</td>
<td>Goal / feeling</td>
<td>1–5 direction</td>
<td>Local window / default time</td>
</tr>
<tr>
<td>evening-energy</td>
<td>Have energy after work for meaningful activities; remaining evening energy.</td>
<td>Higher = more energy</td>
<td>17:00–23:00 / 21:00</td>
</tr>
<tr>
<td>rested-waking</td>
<td>Feel rested after waking from the main sleep period.</td>
<td>Higher = more rested</td>
<td>After waking from the main sleep; 08:00 is a configurable demo reminder, not a required one-hour completion deadline.</td>
</tr>
<tr>
<td>afternoon-sleepiness</td>
<td>Stay alert in the afternoon; perceived afternoon sleepiness.</td>
<td>Higher = sleepier</td>
<td>13:00–18:00 / 15:30</td>
</tr>
<tr>
<td>stress</td>
<td>Understand perceived stress and daily arrangements.</td>
<td>Higher = more stressed</td>
<td>17:00–23:00 / 21:30; daily reflection</td>
</tr>
<tr>
<td>productivity</td>
<td>Understand arrangements that meet personal work expectations; perceived productivity.</td>
<td>Higher = more productive</td>
<td>16:00–23:00 / 18:30</td>
</tr>
</table>
See the Topic Behavior Definitions appendix for full English questions and five-level labels. Fatigue, sleepiness, focus and energy are not synonyms. Natural language may propose labels for confirmation, but must not assign precise scores automatically. Early responses cover only experiences before their cutoff.
**Data relationship: Goal → Observation → Check-in / Metric → Analysis → Agent response → optional Plan → Feedback → Review.**
Goals and observations may have many-to-many links. Share sleep, caffeine, activity, period dates and notes, but not scores for different feelings. Each plan has one primary observation; related observations provide context. Offer at most one primary intervention per round. Users can keep recording after declining/stopping a plan. Do not produce an overall health score.
#### Onboarding and Settings — confirmed goal management
- Onboarding retains concern questions to establish the initial context and recommend goals/observations. Concern responses describe the starting context; they are not the ongoing source of truth for current goals.
- Settings → Your goals → Edit opens a dedicated goal selector. It does not reopen onboarding, “Check your starting point”, or concern selection.
- Users select goals only. The system displays the matched observation as read-only text, preserving existing suitable links; for a new goal, select the highest-weight suitable topic from the fixed catalog, using catalog order to break ties. Reuse the same observation/check-in when goals share a topic. Do not invent a new scale or equate different feelings merely to fill a goal link.
- Update both sides of the goal/observation relationship atomically. Removing a goal removes only links to that goal; retain observations, other goal links, prior plans and historical records. Do not stop an observation merely because its last goal was removed.
- Preserve existing stopped-observation status when a link is unchanged. If adding a goal will resume a stopped observation, disclose this in the selection summary before saving. Closing without saving discards the draft.
- Settings goal cards show current goals, not a fresh derivation from onboarding concerns. Agent context uses current goals, confirmed observation links and actual records, while retaining relevant historical context.
- Concern = the initial difficulty or need selected during onboarding; Goal = the desired direction; Observation = the specific repeated feeling question; Check-in = one dated answer. Keep these distinct in UI, Agent context and API data.
- Demo Gemini consent can be granted in Settings or through “Allow and continue” on a consent-blocked conversation. Both update the same demo permission; persist it before retrying the original message, without adding a duplicate user message. Other failures retain “Try again”. Period-context consent is separate and is never enabled by this action.
- Catalog mappings express supported tracking relationships, not proof that a feeling measures every aspect of a broad goal. If a goal has no suitable configured observation, do not force an unrelated pairing; explain the supported scope and offer a supported goal or recording alternative.
### Required Discovery card content
- Observation topic and data period.
- A specific observation or “Not enough information to assess yet.”
- Record counts, results and missingness for each condition/comparison group.
- Access to relevant raw records and their temporal order.
- Uncertainty and other concurrently changing factors.
- An optional next step.
## 3. Agent behavior and analysis requirements
- **Memory:** Topics, confirmed records, coverage, existing observations, accepted/declined steps, execution barriers, feedback and next review date.
- **Division of responsibilities:** Reproducible code organizes data and computes comparisons. Gemini extracts image/text fields, understands personal context, explains results and suggests next steps. Outputs must satisfy structured schemas and grounding checks.
- Do not describe association as causation. Describe improvement as an observation during an attempt, not a proven effect of the step.
- Respect temporal order; a drink recorded after a feeling cannot explain that earlier feeling.
- Observation length, missing records and insufficient comparison groups must affect output. Label potentially coincidental patterns across signals as unconfirmed.
- Do not invent precise confidence percentages or force new advice after every feedback update.
- Understand barriers when a step was not completed. If completed without change, offer continuing observation, adjustment or stopping; do not manufacture an improvement narrative.
- Restrict advice to the source-backed, fixed daily-life actions in §3.3.1. Stop automated lifestyle experiments when professional assessment is indicated. Apply the engineering safety and evidence checks in §3.3; no separate named professional content sign-off is required for this demo.
Initially trigger analysis after confirmed records are added or on user request. Add daily batch analysis only if time permits; do not claim scheduling that is not implemented.
### 3.1 Discovery: confirmed mock-demo rules — decision dated 2026-10-16
**Decision: Minimize changes for the judging demo by retaining the existing Discovery implementation rather than adopting the historical alternative. These are confirmed product requirements; Rudy must verify implementation, deployment and test status. This is not a completion claim.**
- Analysis window: the most recent 28 calendar days relative to the current demo cutoff date. Never use records after that node's cutoff.
- Minimum data: at least 4 valid scored days for the topic, with at least 2 valid paired days in each group for each factor comparison. A paired day requires both a confirmed applicable feeling score and valid factor classification/timing data. Check each factor independently; total answered days do not authorize comparisons with missing factor data.
- Statistic: retain the mean, not the median. Never combine scores from different topics.
- Difference classification: retain the existing “no clear difference” classification when the absolute difference between group means is below 0.5 points. This is a product classification threshold, not statistical significance, clinical validity or proof of effectiveness.
- Retain existing collecting, insufficient and comparison states. Do not add the historical 3-day summary / 5-day comparison stages for this demo. Existing records and missing-data explanations remain accessible below comparison thresholds.
- Keep the current 7/14-day chart display options. Chart-range changes must not silently alter the 28-day analysis window. Each Discovery card must clearly show its actual start/end dates and both groups' valid-day counts so users can distinguish chart and analysis periods.
- Mock data must contain sufficient valid paired records and explicitly confirmed no-caffeine windows. No record does not mean no intake. Unconfirmed windows remain unknown and are excluded from the no-caffeine group. Mock mode must not weaken data-validity rules or fabricate personal confirmations.
- Period dates are permission-gated mock context only, excluded from this demo's factor comparisons. The proposed 56-day period lookback and additional real-data coverage/sync work are future scope. Stress/productivity must not enable unconfigured comparisons; HRV remains excluded from Discovery v1.
- Preserve confirmed factor-specific timing and allowed claims; correct missing-data and temporal-order errors. Retaining thresholds does not authorize unconfigured factors, the old fatigue scale or unapproved health actions.
**Acceptance:** Verify insufficient status at 3 valid days, eligibility at 4 valid days with 2 per group, and insufficient status when either group has only 1 day. Test the mean, the 0.5-point boundary and the 28-day window. Check chart/analysis range labels, future-data exclusion, unknown versus confirmed no-caffeine windows, and absence of period-related comparisons. Record actual analysis IDs, configVersion and test results.
### 3.1.1 Historical analysis proposal — not adopted for this demo
**The following historical 14-day / 5-day / median / staged 3-and-5-day / no-cutoff alternative is retained for traceability, not as a demo acceptance requirement. Any future adoption requires a separate decision and versioning. It does not override §3.1.**
This is the original afternoon-fatigue proposal, not the adopted specification for afternoon-sleepiness. The demo retains the 28-day / 4-valid-day / mean / 0.5-point rules in §3.1. Do not mix the two configurations. Engineering must verify active topic/analysis IDs, configVersion, grouping and temporal pairing; unconfigured analyses remain disabled.
**Historical status:** The numbers below were proposed product-display conditions, not medical or statistical validity standards. The October 2 discussion required decisions on topic, factors, groups, windows and minimum-data rules.
**Fixed candidate catalog:** The Agent chooses only predefined analyses. The historical proposal allowed at most three analyses per topic in v1, without model-created cutoffs or combinatorial searches. It proposed starting with “afternoon fatigue × previous night's sleep duration.” Other factors require explicit specifications; do not add analyses merely to reach three.
**Predefined groups:** Each analysis fixes one grouping condition and compares the same feeling measure across both groups.
<table header-row="true">
<tr>
<td>Field</td>
<td>Afternoon fatigue × previous night's sleep</td>
</tr>
<tr>
<td>Outcome</td>
<td>Fatigue from 14:00–17:00 that day, on a 1–5 scale</td>
</tr>
<tr>
<td>Condition group A</td>
<td>Confirmed paired sleep duration below 7 hours</td>
</tr>
<tr>
<td>Comparison group B</td>
<td>Confirmed paired sleep duration of at least 7 hours</td>
</tr>
<tr>
<td>Display</td>
<td>Valid-day count and median fatigue score per group, plus the difference between medians</td>
</tr>
<tr>
<td>Interpretation limit</td>
<td>Seven hours is a predefined analysis cutoff, not a medical recommendation for the individual. Do not repeatedly change cutoffs until a result appears.</td>
</tr>
</table>
For a potential “afternoon caffeine × that night's sleep” analysis, group A would require confirmed caffeine intake between 14:00 and bedtime; group B would require explicit confirmation of no intake in that window. Missing records do not qualify as B. This analysis remained unselected. Caffeine consumed after afternoon fatigue cannot explain that earlier fatigue.
**Define timing per analysis, not a generic previous-24-hours window.** The fatigue proposal pairs the most recent confirmed main sleep ending before 14:00 and within the preceding 24 hours. For example, October 1 at 22:00 through October 2 at 07:00 pairs with October 2 afternoon. Without confirmed main sleep, or for travel across time zones or complex shift schedules, mark this analysis inapplicable while preserving records. Store naps separately; do not substitute them for main sleep.
The caffeine/sleep proposal uses 14:00 through bedtime and analyzes the subsequent sleep period. The 14:00 cutoff is a product proposal, not a medical conclusion about caffeine duration.
**Historical staged display proposal:** To support 3–5 days of internal testing, at most seven days, before the October 18 submission, the proposal removed the requirement to collect 14 valid days first. The following was recorded as an October 2 revision; it is not adopted for the current demo.
<table header-row="true">
<tr>
<td>Data stage</td>
<td>Permitted display</td>
<td>Prohibited claims</td>
</tr>
<tr>
<td>From the first record</td>
<td>Timeline, existing records and missing fields; Agent-assisted observation setup.</td>
<td>No cross-day association claims.</td>
</tr>
<tr>
<td>3 valid paired days</td>
<td>Daily sleep/fatigue summaries and questions worth continuing to record.</td>
<td>Do not call three days a stable pattern.</td>
</tr>
<tr>
<td>At least 5 valid paired days, with at least 2 in each group</td>
<td>Preliminary descriptive comparison: counts, scores, medians and differences. Always label “Limited records; for observation only.”</td>
<td>No reliable-association, statistical-significance, causal or effectiveness claims.</td>
</tr>
<tr>
<td>Further records; not a submission prerequisite</td>
<td>Update the same comparison and show whether results change.</td>
<td>More days do not automatically upgrade confidence.</td>
</tr>
</table>
These unvalidated numbers only governed proposed display stages. Five valid days might still be insufficient: A=4, B=1 would show a summary and explain that the other condition has only one day. Do not ask users to change sleep deliberately to fill groups.
The historical proposal accumulated data from observation start and used a rolling 14-calendar-day window thereafter, with dates shown. Coverage would be **displayed, not gated by a hard 70% minimum**, for example “6 complete days in the last 10 days.” Explain potential missing-data bias. Sleep-only or fatigue-only days are not valid pairs. Do not impute averages or treat missing values as zero. Use the final confirmed daily time-window summary; repeated same-day check-ins do not create extra days.
- **Historical testing/demo arrangement:** A 3–5-day internal trial, at most seven days, after a working build; no fixed October 3 start, two-week continuous trial or external recruitment. Ellie would test personal real records and recording experience; Rudy would use an isolated demo session for functionality and boundaries. Feelings, time and source could be stored in a fixed format for later import. Do not reconstruct unrecorded fatigue from Watch history.
- **Acceptance within three days:** Validate import/input → summary → supported small step or observation → feedback → update. Real-data insufficiency should produce correct summaries and missing-data states. Use clearly labelled synthetic cases for two-group comparisons. The historical five-day/two-per-group condition was a display threshold, not a submission or trial-success requirement. A shorter test must not rebrand three records as a reliable pattern. Testing may finish once acceptance passes; seven days was a maximum, not a required duration.
For current action selection, use the fixed source-backed whitelist and engineering checks in §3.3–§3.3.1; preliminary differences do not prove effectiveness. Record execution and feelings as soon as a step is accepted. A short review may say “The user reported feeling better/unchanged,” not “Improvement is proven.” Demonstrate long-term flows using separately labelled synthetic history, not as a real trial result.
**Historical descriptive-comparison proposal:** No statistical-significance claims. Use fixed analyses and subsequent data to limit arbitrary result selection.
1. Show records, summaries or preliminary comparisons according to the proposed stage. Insufficient comparison data must not block recording and feedback.
2. Once eligible, show both groups without requiring a one-level difference. Equal medians should be described as equal in these records; otherwise show the difference. Always disclose limited data rather than assert a stable pattern.
3. List all executed candidate comparisons, including insufficient results, rather than only the largest difference.
4. Retain analysis dates and versions. Rolling windows reuse records and are not independent validation. Separate, non-overlapping periods would each need sufficient data and still permit descriptive direction only. A second round is not a submission requirement; execution and feelings can be reviewed at any time.
5. Do not provide p-values, significance or precise confidence percentages. These display rules do not resolve autocorrelation, confounding or multiple comparisons. Inferential testing requires a separately defined and validated method, not merely a p-value cutoff.
**Historical open work:** After topic selection, define inputs, windows, groups, minimum data, missingness and chance-pattern handling. Statistical tests and numeric criteria had not been selected. These historical discussion numbers were not formal requirements before approval; the current demo decision is §3.1.
### 3.2 Agent grounding and data validation — October 2 baseline with additions
#### Multifactor understanding and responses
Check safety → resolve intent/topic → read goals, confirmed records, permitted summaries/comparisons, constraints and plan feedback → select 1–3 relevant facts → acknowledge limitations → ask one useful question or offer an optional action. Do not re-ask known overtime details or duration. Do not force recording or plan creation when the user wants conversation.
Separate three evidence types: user_report, verified_summary and allowed_comparison. The model must not calculate trends, invent cutoffs or rank concurrent changes as causes.
For “I feel very stressed,” acknowledge the feeling first. Mention sleep changes only if supported by a valid summary; do not say sleep caused stress. Include period dates only with permission and relevance; do not infer hormones or cycle phases. HRV cannot substitute for subjective feelings or override discomfort with reassuring values. Without valid summaries, cite only confirmed individual records.
Stress/productivity may use contextual summaries and reviews but must not introduce comparisons under the label “summary.” Until summary rules and valid-day thresholds are confirmed, do not say “worse than usual.” Typical responses are 3–5 sentences, with detailed evidence in expandable cards; not every turn needs a new plan.
Add contextSummaries separately from validatedAnalyses. Each includes ID, calculation version, period/comparison period, timezone, cutoff, inputRevision, source/origin, coverage, evidence/exclusions, values/units, limitations and permittedClaimTypes. Measure coverage separately per signal. Missing values are not zero. Do not claim change across incompatible sources/processing or overlapping comparison periods.
#### Bounded tools and grounding checks
Use limited tools and explicit states: inspect coverage, retrieve period records, run allowed comparisons, ask a follow-up, propose a whitelisted step and review a plan. Enforce access and call limits in code; numerical calculations are programmatic.
Code renders numerical cards directly. The model cites valid analysis IDs and allowed claim types, with checks for visitor, time, evidence and data thresholds. Correct numbers do not authorize causal interpretation. Free-form explanations still need validation; automated checks cannot guarantee detection of every semantic error. Proposed failure policy: retry at most once; if still invalid, display verified summaries and an explanation-unavailable message, without unverified advice.
### 3.3 Safety boundaries and evidence-backed release requirements
**Boundary: The Agent may organize records and support low-risk everyday observation. It must not diagnose, prescribe, guarantee safety or cause users to delay seeking help.**
<table header-row="true">
<tr>
<td>Level</td>
<td>Example triggers / scope</td>
<td>Required product behavior</td>
</tr>
<tr>
<td>Urgent concern</td>
<td>Sudden extremely severe headache; headache with new weakness, speech difficulty or confusion; persistent sudden chest pain, or chest pain with breathlessness/dizziness.</td>
<td>Immediately show a fixed help message and stop small-step and ordinary analysis recommendations. Do not require questionnaire completion or wait for a long Gemini response.</td>
</tr>
<tr>
<td>Professional assessment needed</td>
<td>Recurring or worsening discomfort; heavy periods affecting daily life, persistent issues or bleeding between periods.</td>
<td>Pause lifestyle experiments targeting the symptom and recommend contacting a healthcare professional. Recording and summaries may remain. Heavy/irregular bleeding is not automatically an emergency; apply the higher level if urgent concerns also occur.</td>
</tr>
<tr>
<td>Outside product capability</td>
<td>Disease diagnosis, medication changes/stopping, supplement dosage, treatment or requests to ignore warnings.</td>
<td>Clearly decline and offer available recording/help information. Do not force-map to a lifestyle topic.</td>
</tr>
<tr>
<td>General observation</td>
<td>Supported topic, no identified warning and a whitelisted recommendation.</td>
<td>Only then offer an eligible fixed, source-backed action from §3.3.1 for user confirmation. Failure to identify a warning is not a determination of safety.</td>
</tr>
</table>
These examples draw on [NHS headaches](https://www.nhs.uk/symptoms/headaches/), [NHS chest pain](https://www.nhs.uk/symptoms/chest-pain/) and [NHS heavy periods](https://www.nhs.uk/conditions/heavy-periods/), consulted October 1, 2026. They inform product blocking rules, not diagnosis or an exhaustive triage list. Configure emergency information for the user's location; do not apply UK numbers universally.
**Six non-negotiable rules**
1. Do not recommend changing/stopping medication, adding supplements or replacing professional treatment.
2. Do not propose deliberate sleep deprivation, fasting, extreme dietary restriction, increased alcohol/stimulants or forced strenuous exercise. Do not re-induce discomfort to test a hypothesis.
3. Choose only the product-confirmed, source-backed fixed actions in §3.3.1; otherwise offer recording/observation. Do not independently customize interventions for pregnancy, specific illnesses or unsupported contexts.
4. If the user reports worsening or a new warning, stop the current step and reassess safety. Never automatically intensify the step.
5. Normal health values, a previously benign pattern or absence of keyword matches do not justify “You are fine” or “You do not need care.” Safety checks must understand meaning and negation, not just strings.
6. Check both input and recommendation output before mapping/analysis. If the safety service fails, do not issue new health steps; preserve recording and general help entry points.
**Example urgent-concern message:**
> What you’ve described may require immediate medical attention. This app cannot determine the cause. Contact your local emergency services or go to an emergency department now. Do not wait for the app’s analysis.
**General explanation:**
> This app helps you record and understand patterns in your daily life. It does not provide diagnosis or treatment and is not a real-time medical monitoring service. If symptoms persist, worsen, or concern you, seek medical advice.
- **Demo release gate — evidence and engineering verification:** For each fixed action, keep its source links, supported rationale, evidence limitations, eligible topics/context, exclusions and stopping conditions in the action catalog. RD verifies server-side whitelist enforcement, exact instructions, user confirmation, refusal/observation alternatives, and safety blocking through chat, findings and Review. Test warnings, paraphrases, negated/past events, medication requests, worsening and service failure. Enable actions when these evidence/configuration and engineering checks pass; leave only a failing or unconfigured action unavailable. No named professional health-content reviewer or external sign-off is an additional gate for this mock demo. Do not claim professional/clinical approval, guaranteed safety or proven effectiveness. The existing stop/help behavior remains mandatory; a disclaimer does not replace it.
### 3.3.1 Mock-demo actions — product decision, October 17, 2026
**Product scope, wording and eligibility are confirmed:** Support all three lifestyle categories below for eligible reviewer exploration, not only the scripted path. The activation criteria are evidence/configuration traceability and passing engineering checks in §3.3, not an additional named professional review. These decisions describe intended behavior, not verified deployment or clinical validation.
The main story remains energy after work, with sleep, caffeine and overtime context: clarify evidence and uncertainty → choose a feasible next step → capture execution, feelings and barriers separately → review and continue the user's choices.
**Fixed lifestyle action content**
- **Caffeine timing — “Try an earlier caffeine time”:** “If it fits your routine, move your usual late caffeinated drink earlier. Record the time and continue your sleep-related check-in.” Offer when the user wants to explore late caffeine and sleep, using rested-waking as the primary supported observation. Do not prescribe a universal noon/2 pm cutoff, increase intake, or claim this improves evening energy. An energy/caffeine group difference alone is not an eligibility trigger.
- **Sleep routine — “Make room for a quieter bedtime routine”:** “Choose a quiet activity before your planned bedtime, such as reading or relaxing without bright screens. Continue recording how rested you feel after waking.” Use `rested-waking` as the primary observation for a relevant sleep/restedness goal and bedtime context. Evening energy can be related context but is not an interchangeable outcome. Do not reduce sleep, force an earlier bedtime or claim insomnia treatment.
- **Everyday activity — “Try a short, comfortable walk”:** “If walking is suitable for you and fits your schedule, try a short walk at a comfortable pace. Continue your usual check-in and note how you feel.” For this demo, use `evening-energy` as the primary observation when the user explicitly wants an activity-related next step and can comfortably participate. Check-ins record evening feelings, not activity completion; record execution separately. Do not automatically attach this action to `rested-waking`, stress or productivity. Do not present walking as a proven remedy for evening fatigue or next-morning restedness, or automatically increase intensity after no improvement.
**Recording and observation alternatives**
- “Notice your caffeine routine”: record caffeinated drinks and their times without changing usual intake.
- “Check in after waking”: record how rested the user feels after their main sleep.
- “Keep it manageable this week”: choose an available day for a check-in; skipping and returning later are allowed.
- Retain the existing observation after already-planned activity; do not turn it into a new exercise instruction.
- Retain “Answer tonight's check-in, or skip it” and “Keep noticing \[topic\]”. Include both in the action inventory.
**Plan timing and user control**
Seven days is a demo plan setting, not a validated treatment or effectiveness threshold. Use “After your main sleep, for 7 days” instead of “Each morning for 7 days”; replace “within an hour of waking” with “after waking from your main sleep”. Do not impose the old fixed noon/2 pm, 30-minute/three-night or walking-frequency prescriptions through other templates.
The Agent selects only fixed eligible action IDs and cannot invent instructions, intensify a plan or force an action for every goal. Offer recording, observation, declining or deferring as valid alternatives. Require confirmation before starting or changing a plan. Preserve safety blocking, prior choices, barriers, feedback and plan versions.
**Synthetic evidence and Review**
Use “in this demo scenario” when discussing synthetic findings in cards, chat and Review. Show analysis dates, group counts and missingness. The caffeine comparison may say: “In this demo scenario, average recorded energy scores were higher on days with caffeine logged before the check-in than on days confirmed to have no caffeine before it. This does not show that caffeine caused the difference.” Only use this statement when the actual direction and explicit coverage support it; otherwise report the actual result or insufficient data. Unknown intake must not enter the no-caffeine group.
Neither this comparison nor a Day 10 before/after review proves an action worked. General guidance supplies the action rationale; personal records and stated constraints help choose a relevant direction. Keep execution, perceived change and barriers separate.
**Evidence and inventory**
See [Aura Mock Demo — Action Categories and Evidence](https://github.com/RudyLu/aura-ai/blob/ellie/aura-v2/web/docs/mock-demo-actions-and-evidence.md) for NIH/NHLBI, caffeine-study, WHO and NICE sources. Keep the supporting finding, applicable population/context and limitation with each action; sources do not establish every exact time, duration or outcome. Track product-confirmed content, evidence/configuration completeness, engineering verification and deployment separately. No reviewer-name field is required for activation. Documentation edits do not switch production actions on.
## 4. Data and technical design — existing deployment and integration requirements
The integration target is the Next.js engineering repository and its Cloud Run deployment. Preserve existing Gemini, session persistence and backend contracts. ZIP (7) and the earlier design prototype are historical handoff materials; they must not override the current repository's API/schema/version contracts.
Flow: connect/import/photo/check-in → normalize and obtain user confirmation → personal timeline → analysis → Gemini explanation and next step → save feedback → reanalyze.
Minimum data entities, including Goal, Observation, ContextSummary, AnalysisConfig, Review, SafetyEvent and DemoSession:
- Goal / Observation: goals, priorities, constraints, valid topic IDs, independent scales and observation links.
- ContextSummary / AnalysisConfig: separate summaries from comparisons; retain windows, sources, coverage, evidence and version/review status.
- Review: request ID, plan ID/version, inputRevision, session/mode, evidence, proposal and confirmation status.
- SafetyEvent: persist blocking scope and release conditions. Stopping a plan does not resolve the health concern.
- DemoSession: isolated visitor, mode, scenario, cutoff, origin and revision. Browser storage slots alone do not provide server isolation.
- Topic: question, tracked item, start date and status.
- Signal / Log: type, value, unit, occurrence start/end and timezone/offset, recording/import time, revision and historical visibility, source, quality/confirmation and import identifiers.
- Insight: topic, data cutoff, cited records/comparison results, limitations and generation version.
- Plan: step, rationale, acceptance state, tracked items and duration/review point.
- Feedback: execution, feeling changes, notes, related plan and timestamp.
Isolate data by user and keep API keys server-side. Explain personal-data purposes and deletion mechanisms. Use synthetic demo data by default and never commit private health records to a public repository. Raw-photo storage, authentication and retention periods remain to be selected.
### 4.1 AI integration contract with the existing frontend
Use the repository's actual Review route, structured response schemas, revision/version checks and existing Review UI as the integration contract. The old ZIP adapter names and browser globals are historical references, not required interfaces for this implementation. Preserve the traceable feedback → backend Review → user confirmation → new plan-version flow.
Request review only after feedback saves successfully. Clearly show “Not integrated” when no model is connected; do not label QA fixtures as AI. Present the response first, then create a new plan version only after user confirmation, retaining the original. The server supplies goals/priorities/constraints, related observations, shared records, summaries/comparisons and safety state.
Validate request/session/mode/plan/version/inputRevision both when a response arrives and when changes are confirmed. Reject stale proposals or request a fresh review if data changes. Saving a Review alone must not be mistaken for an input change. Client-provided allowed flags, safety flags or model names do not establish server authorization or real model calls.
### 4.2 HRV and Relative Index — latest HRV specification supersedes “Stress from HRV”
HRV is a shared signal, not a sixth topic or a conversion into psychological stress, energy or productivity. Preserve raw HealthKit SDNN milliseconds, timestamps and source. A web UI must not claim HealthKit connectivity merely because it displays HRV.
The proposed personal baseline uses P5/P95 from the 30 days before the selected day, excluding that day. Minimums of seven days / 20 samples remain proposals. Without a valid baseline, show raw HRV only; do not substitute age-based or fixed reference ranges. The inverse-log formula represents a personal Relative Index, not “Relaxed” or “High stress” psychological labels.
Use seven two-hour intervals from 08:00–22:00. Do not interpolate missing samples or plot future data. Exclude workout samples under the latest specification. Showing a daily index requires at least three valid intervals; aggregation rules require confirmation/versioning. Use “Daily HRV index” as the main summary and “Based on N sampled periods ⓘ” alongside it. Tooltip: “Average of available periods today. It doesn’t represent your whole day or measure perceived stress.” Never call the sampled average whole-day stress.
Exclude HRV Relative Index from Discovery factor comparisons in v1. Label prototype data “Apple Watch · simulated.” Support missing-data, calibration-insufficient, invalid-baseline and workout-exclusion states. For formulas, charts, permissions and boundaries, see [Aura · Daily HRV & Relative Index Tracking — Spec](https://app.notion.com/p/3f3cf214d45e814bbf93fbdc78172ee4). The original PDF lists the 30-day window, inclusion of the selected day, 20 samples, aggregation and timezones as pending. Prototype values here do not establish final decisions.
### Data-processing rules — confirmed October 2
- Reuse Apple's original sleep intervals and types; do not rebuild sleep detection. Assigning main sleep to the local waking date is a candidate policy, not a claim about Apple's official method. Rudy should verify against Ellie's Health display/data. Exclude awake time and avoid counting overlaps twice; initially exclude cross-timezone days from fixed-window comparisons.
- Extract only fields needed for analysis from photos. Users confirm caffeine presence and intake time; do not guess milligrams or sugar. EXIF indicates capture time, not necessarily intake. Upload time may be prefilled if EXIF is absent, but save only a draft until confirmed.
- Deduplicate/update versions by source ID. For the same metric across sources, use a designated primary source and preserve raw records; do not sum or average sources. Mark missing primary-source data; substitution policy is pending.
- Give each demo visitor an isolated case/session. Reset affects only that visitor. Define isolation, retention and call limits.
The engineering deployment uses Google Cloud Run. Verify actual Gemini calls, deployed configuration and spending limits rather than reopening platform selection. Cloud Run/Firebase references do not by themselves require Vertex AI. Real health-platform access remains future validation outside mock-demo acceptance; web pages must not claim phone-health access from simulated records.
## 5. Demo and submission strategy
### Development and deployment
**Use the engineering repository as the integration source:** Work on an isolated branch → test → open/update a PR → review and merge/deploy under the team's process. Repository: [RudyLu/aura-ai](https://github.com/RudyLu/aura-ai); current frontend handoff PR: [#1](https://github.com/RudyLu/aura-ai/pull/1). Gemini performs extraction, contextual explanation and Review; code performs calculations and validation. Do not replace backend functionality with preset conversations.
### Demonstration principles
Compress elapsed time with clearly labelled synthetic historical cases while actually demonstrating new input, analysis and feedback updates. A demo establishes functionality, not long-term health effectiveness.
**Confirmed main storyline:** Evening energy (`evening-energy`) plus Feeling rested on waking (`rested-waking`), with afternoon caffeine and overtime constraints. The goal is to have energy after work for meaningful activities; sleep and caffeine are relevant context, not established causes. Show evidence and uncertainty → choose a feasible next step → capture execution, feelings and barriers → review and continue the user's choices. Open Day 10 directly → add a confirmed record → submit feedback on an existing plan → Gemini reviews the actual updated data → user confirms the update. Do not switch Day 4 → Day 10 while implying new input persisted: changing the day rebuilds the case requires confirmation and disclosure that new case inputs are discarded. Historical data is synthetic; new live input is demo-live and must never enter personal data.
### Evaluation and language
Published weights: Technical Merit & Gen AI Implementation 40%; Problem Alignment & Impact 25%; Innovation & Creativity 25%; User Experience & Solution Design 10%. Submission language: English.
### Video outline — draft, not confirmed
The email specifies 3–4 minutes, while the public page specifies three minutes. The 3:40 outline below is a narrative draft, not an approved final length. It can be shortened to three minutes while preserving actual interaction and feedback updates.
<table header-row="true">
<tr>
<td>Time</td>
<td>Content</td>
</tr>
<tr>
<td>0:00–0:20</td>
<td>User problem and vision</td>
</tr>
<tr>
<td>0:20–0:45</td>
<td>Multiple topics, data sources and synthetic-history labels</td>
</tr>
<tr>
<td>0:45–1:15</td>
<td>Actual photo upload, Gemini extraction, user confirmation and check-in</td>
</tr>
<tr>
<td>1:15–2:00</td>
<td>Executed analysis, Discovery card and evidence</td>
</tr>
<tr>
<td>2:00–2:30</td>
<td>Select or modify one small step</td>
</tr>
<tr>
<td>2:30–3:15</td>
<td>Stay on Day 10, add feedback to an existing plan, perform a real Gemini review and confirm the new version</td>
</tr>
<tr>
<td>3:15–3:40</td>
<td>Technical responsibilities, completed scope, next validation steps and tagline</td>
</tr>
</table>
### Five submission items — according to the official email
1. Pitch deck using the specified template.
2. Demo video showing actual operation, approximately 3–4 minutes, subject to final rule confirmation.
3. Accessible deployed prototype link.
4. GitHub repository accessible to judges, with startup/deployment instructions, architecture, example environment variables, data descriptions and limitations.
5. Short product description.
**Deliverables:** Documentation/presentation PDF, an interactive prototype, a publicly viewable demo and a **public GitHub repository**.
## 6. Timeline and collaboration — historical planning reference
The table preserves original milestones; elapsed dates do not establish completion. The October 7 plan prioritized contracts/analysis configuration, Day 10 real Gemini review, multifactor context and safety blocking, followed by end-to-end acceptance and video production. Both members must confirm effort and ownership.
**Only the October 18 submission date was confirmed in the source plan; the remaining dates were suggested internal milestones.**
<table header-row="true">
<tr>
<td>Date</td>
<td>Milestone</td>
</tr>
<tr>
<td>September 30–October 2</td>
<td>Complete team registration on the official platform; read templates/full rules; choose integration route, demo, stack and ownership; freeze scope.</td>
</tr>
<tr>
<td>October 3–6</td>
<td>Deploy the minimum loop: input → analysis → finding → step → feedback → update.</td>
</tr>
<tr>
<td>October 7–9</td>
<td>Integrate multiple topics, photos, period dates and multiple sources; complete a resettable demo.</td>
</tr>
<tr>
<td>October 10–13</td>
<td>Refine UI, integration and non-ideal states; arrange internal testing after a usable build, originally proposed as 3–5 days, at most seven.</td>
</tr>
<tr>
<td>October 14–16</td>
<td>Finalize the specified deck, video and demonstration refinements.</td>
</tr>
<tr>
<td>October 17</td>
<td>Check links, repository, permissions, video, deployment and submission QA.</td>
</tr>
<tr>
<td>October 18</td>
<td>Submit, confirm success and maintain deployment under official requirements.</td>
</tr>
</table>
### Internal testing
Use clearly labelled mock/synthetic historical cases for the judging flow. New live demo inputs remain demo-live and must go through actual persistence, analysis and review. Test sufficiently populated and insufficient-data cases separately; accumulating real observation days is not a submission prerequisite. The earlier 3–5-day, maximum-7-day trial schedule is testing-planning history, not a Discovery data threshold or a requirement to add real-data import work. Real-data validation is outside this demo's acceptance scope; mock data must not be presented as completed real-device integration. Deliver pass/fail results and known limitations without claiming validated health effectiveness.
### Two-person collaboration: research ownership assigned; implementation ownership to be confirmed
<table header-row="true">
<tr>
<td>Work package</td>
<td>Scope</td>
<td>Owner</td>
</tr>
<tr>
<td>Apple integration research</td>
<td>Data entry, signals, permissions, sync, effort and demo operation</td>
<td>Rudy</td>
</tr>
<tr>
<td>Product and frontend</td>
<td>Topics, recording, timeline, Discovery/review UI, demo story and deck</td>
<td>Ellie / Rudy; coordination pending</td>
</tr>
<tr>
<td>Data and Agent</td>
<td>Source adapters, data model, analysis, Gemini, persistence and deployment</td>
<td>Ellie / Rudy; coordination pending</td>
</tr>
<tr>
<td>Joint acceptance</td>
<td>Scope decisions, API contracts, end-to-end validation, video and submission</td>
<td>Both</td>
</tr>
</table>
**Keep the existing repository contracts synchronized during integration.** Ellie confirms product semantics; Rudy verifies backend feasibility, schema/revision handling and deployed compatibility. Cover Goal, Observation, ContextSummary, AnalysisConfig, Review, SafetyEvent, DemoSession, units, time, source, versions and missing/unsupported examples. The earlier contract-v0.1 and October integration dates are planning history, not instructions to restart implementation or evidence of completion.
## 7. Mock-data demo acceptance checklist
**Scope:** Acceptance applies to the judging demo using labelled synthetic history and demo-live inputs. Real health-data imports, physical-device connectivity, HealthKit authorization, device sync and real-world outcome validation are not acceptance requirements for this submission. Existing import functionality is retained; real-data extensions remain future scope. Actual Gemini calls, demo persistence, analysis correctness, user confirmation, isolation and safety behavior are still required where included in the demonstrated flow.
- [ ] All five topic IDs, questions, scale directions and times are consistent; afternoon sleepiness does not produce an evening-energy plan.
- [ ] Goal/observation/plan relationships are traceable; scores for different feelings are not shared or combined into one success metric.
- [ ] Onboarding retains concerns; Settings edits goals without reopening setup. Automatic suitable matching reuses observations, preserves valid existing links and history, removes only cancelled-goal links, and saves both link directions together. Verify cancellation and disclosure before resuming a stopped observation.
- [ ] Save words only is absent from the check-in UI; Not sure/skip and optional notes remain, and legacy null scores do not enter numeric comparisons. “Allow and continue” updates demo Gemini consent before retry, without duplicate messages or silently enabling period consent.
- [ ] Identical input receives appropriately different responses under different valid contexts. Do not re-ask known facts or invent missing ones. Pass appendix scenarios M01–M14.
- [ ] Stress/productivity do not enable unconfigured comparisons. HRV does not estimate psychological stress or enter Discovery v1.
- [ ] The server validates Summary/Analysis sources, windows, coverage and claim permissions. Period dates are excluded from model context without permission.
- [ ] Save feedback before review. Report real Gemini and mock tests separately; clearly disclose unintegrated functionality.
- [ ] Validate revision/plan/version/session on response receipt and confirmation; stale proposals cannot be applied. Preserve historical versions.
- [ ] Observe/stop do not clear SafetyEvent. New plans, ordinary chat and late responses cannot bypass blocking.
- [ ] Isolate personal/demo data on frontend and backend, distinguish synthetic/demo-live origins, confirm case rebuilds on day changes and support the Day 10 main flow.
- [ ] Report logic tests, browser end-to-end tests and actual Gemini validation separately for the deployed demo version. Record pass/fail evidence and known limitations; historical test counts do not establish acceptance.
- [ ] Track two topics simultaneously using shared lifestyle records.
- [ ] Mock source records are labelled and traceable, merge correctly into the demo timeline, distinguish unknown values from confirmed absence, and do not double-count duplicate records. Real-device import or sync testing is not required.
- [ ] Photo extraction → confirmation/correction → saving → analysis works end to end.
- [ ] Mock period dates are labelled synthetic and displayed alongside records. Exclude them from Agent context without permission. Do not generate period comparisons, cycle-phase inference, predictions, causal claims or period-derived lifestyle recommendations. The proposed 56-day lookback and real-data coverage/sync extensions remain future scope.
- [ ] Insight numbers match evidence, and future records do not enter earlier demo nodes.
- [ ] Discovery follows §3.1: 28 days / 4 valid days / at least 2 paired days per group / mean / 0.5. Retain existing insufficient-data states; do not adopt historical 3/5-day stages. Clearly distinguish 7/14-day charts from the 28-day analysis and unknown caffeine windows from explicit no-caffeine confirmations.
- [ ] Insufficient data, no pattern and no reported improvement all have appropriate outcomes.
- [ ] Step acceptance → feedback → Agent update using existing context works.
- [ ] Gemini, demo photo-upload and demo-data operation failures are understandable and retryable; do not fabricate success. External health-device failure testing is outside this acceptance scope.
- [ ] Isolate user data; keep credentials and private health records out of the repository.
- [ ] The demo is resettable, and unfamiliar visitors can complete its main interactions.
- [ ] Each enabled action has the source, supported rationale, limitations, fixed copy, topic/context eligibility, exclusions and stop conditions recorded. Engineering tests pass for whitelist enforcement, confirmation, refusal, safety warnings, paraphrases, negation, medication requests, worsening and service failure. No named professional content sign-off is required; do not claim clinical validation.
- [ ] Reviewer exploration supports all three configured and engineering-verified lifestyle categories in §3.3.1, plus every recording/observation alternative. Verify fixed eligible IDs, exact copy, user confirmation, no invented/intensified instructions, and continuity after barriers or Review.
- [ ] Synthetic findings, chat and Review explicitly identify the demo scenario. Caffeine groups use confirmed coverage; analysis ranges/counts are visible, and neither comparisons nor Day 10 imply causation or proven action effectiveness. Seven-day plans are product settings; waking check-ins do not require completion within one hour.
- [ ] Concurrent isolated sessions and resets do not affect other visitors.
- [ ] Mapping failure and mock cases with insufficient comparison data still support understandable recording and missing-data flows.
- [ ] Confirm contracts/examples used by the demo and trace synthetic history separately from demo-live inputs; neither may leak into personal records.
- [ ] Complete all five submission items with consistent descriptions and tested access.
## 8. Confirmed decisions and remaining release checks
### Confirmed product decisions
- Main story: energy after work, with `evening-energy` and `rested-waking`, caffeine and overtime context (§5).
- The judging flow uses labelled mock history and actual supported demo-live backend interactions. Real-device import/sync acceptance and 56-day period comparisons remain future scope.
- Discovery: 28 days, 4 valid days, at least 2 paired days per group, mean and 0.5-point cutoff (§3.1). Existing 7/14-day charts must distinguish their range from the analysis range.
- Onboarding retains concerns; Settings edits goals only and automatically matches suitable observations (§2.1).
- All three lifestyle categories, fixed English copy, topic eligibility, user confirmation, alternatives and timing rules are product-confirmed (§3.3.1). They are available for eligible reviewer exploration once each action passes its release checks, not limited to the scripted path.
- Safety blocking and per-action fallback to recording/observation are required. Seven-day plans are demo settings, not effectiveness thresholds. Dynamic RAG remains out of scope.
### Remaining engineering and release verification
1. Verify the deployed version, source/analysis IDs, configVersion and actual Gemini calls. Record pass/fail evidence rather than treating a product decision as implementation completion.
2. Verify each action's source-backed rationale and limitations, fixed copy, topic/context eligibility, exclusions and stop conditions against §3.3.1. Record engineering test results and deployed availability. No named professional reviewer or external content approval is required for this submission; do not represent the product decision as clinical validation.
3. Verify all action routes, including chat, findings and Review, enforce fixed eligible IDs, confirmation, safety blocking and no automatic intensification. Confirm the supported topic mappings, not just action wording.
4. Confirm option B mapping/clarification behavior, topic questions/scales, shared records, Settings goal-link integrity, and handling of unsupported inputs. Engineering estimates and implementation coverage remain separate from the product target.
5. Verify demo isolation, synthetic/demo-live provenance, reset behavior, cutoff handling and the Day 10 Review with new input.
6. Confirm authentication, photo storage/deletion, retention, service credentials and spending limits; keep secrets and private health data out of Git.
7. Confirm API contracts, revisions, versions, timestamps, missingness and grounding against the deployed code, assigning implementation owners where needed.
8. Check official submission requirements, repository/deployment access, deadline timezone, video duration, deliverables and uptime. Earlier timeline dates and estimates are historical planning, not completion evidence.
## 9. Specification appendices and sources
The following four specification appendices define product/AI behavior and engineering requirements; they are not completion claims:
- [Aura · Daily HRV & Relative Index Tracking — Spec](https://app.notion.com/p/3f3cf214d45e814bbf93fbdc78172ee4): Full HRV Relative Index specification; original PDF dated October 6, 2026, incorporated October 8.
- [Aura — Topic Behavior Definitions](https://app.notion.com/p/3f2cf214d45e81fc8c75c85102f8fe21): Product behavior, five topics and data relationships, v1.2.
- [Aura — Gemini Implementation Prompt](https://app.notion.com/p/3f2cf214d45e819781fdf6280dd0de17): Engineering/coding-agent implementation and acceptance instructions, v1.2; not a document to paste wholesale into a runtime system prompt.
- [Aura — Multifactor Understanding and Response Policy](https://app.notion.com/p/3f2cf214d45e81208829c7bbc29813f4): Multifactor responses, evidence levels, context and M01–M14, v1.0.
Do not silently merge conflicting requirements. This PRD's October 17 action, timing, Settings and evidence-backed release decisions override older conflicting approval-gate or workflow wording in historical handoffs and linked behavior/implementation documents for this demo. The latest HRV spec governs HRV details. §3.1 governs Discovery; §3.1.1 is historical only. Professional/clinical validation is not claimed and a named professional reviewer is not an activation requirement.
- Action-content reference: [Aura Mock Demo — Action Categories and Evidence](https://github.com/RudyLu/aura-ai/blob/ellie/aura-v2/web/docs/mock-demo-actions-and-evidence.md). Fixed product content, supporting sources and implementation inventory; activation depends on evidence/configuration completeness and engineering acceptance, not additional named professional sign-off.
- Product discussions: Ellie confirmed the original vision, Agent loop, multiple concurrent concerns, food-photo extraction, multi-device direction and period-date recording.
- Official email supplied by Ellie: Teams of 2–4, submission access after registration, five deliverables and dashboard-specific rules.
- [Official public website](https://aibuildercup.com/), consulted September 30, 2026: Prototype deadline October 18, team registration deadline October 11 and a working Google Cloud prototype. Dashboard rules take precedence for details.
- Supporting clarification document: [Responses to PRD Open Questions v1.3](https://app.notion.com/p/%E5%9B%9E%E8%A6%86%20PRD%20%E5%BE%85%E9%87%90%E6%B8%85%E4%BA%8B%E9%A0%85.md). It includes Apple, NHS and Google sources used for specific explanations, not complete medical triage validation.

[Change log — maintained in Notion](https://app.notion.com/p/3eccf214d45e8050addeccc7157a0ddd)
