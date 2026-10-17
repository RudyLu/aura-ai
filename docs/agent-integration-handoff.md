# Aura v2 Agent Integration Handoff — Rudy

Updated 2026-10-09. Start with the [Chinese handoff guide](rudy-handoff-2026-10-09.md) for current status, setup and integration order.

## Ownership and current state

Ellie owns the frontend and presentation contracts. Rudy owns Agent interpretation, prompts, context-building, reasoning, grounding, response generation and safety decisions. The existing Agent/Gemini/safety/preset modules and legacy comparison/step catalogs are preserved byte-for-byte from the starting branch. No new multifactor prompt or review generator ships in this branch.

Frontend state is real and visitor-scoped. Existing chat and photo endpoints remain. Optional v2 message fields are implemented in `src/domain/conversation.ts` and rendered in `src/ui/aura.tsx`; the existing Agent does not emit these fields yet. `/api/review` intentionally returns `not-integrated`; `src/server/review.ts` is a validated snapshot contract stub, not Gemini generation.

Reference authority: supplied v2 ZIP and its `AI_REVIEW_INTEGRATION.md`; the October 7 Topic Behavior, Gemini Implementation Prompt and Multifactor Response Policy documents; Daily HRV PDF. Document instructions describe the desired Agent behavior for Rudy, not authorization to change that backend in Ellie's scope.

## Interaction audit

“Partial” means the old backend has a related feature but does not fulfill the v2 specification. Static starters are user input suggestions, never generated answers.

| Interaction / expected experience | Frontend implemented | Agent/backend responsibility | Existing support / missing dependency |
| --- | --- | --- | --- |
| Enter Aura from Today/Explore; close to prior page | Full-screen sky/orb, composer, close/Escape, prior tab | None | Frontend complete |
| First-visit greeting and starter pills | Supplied greeting and editable user prompts | Generate subsequent real response | Basic `/api/aura`; no canned prototype response used |
| Free text / multiline / Enter and IME | Saved user bubble, composer, guarded send | Dynamic answer from confirmed context | Existing chat, live credentials needed |
| Thinking / slow response | Typing dots and neutral wait labels; 30-second abort | Return response or failure | Existing chat; no invented reasoning progress |
| Network/configuration failure | Error outside Agent bubble; retry same saved message without duplication | Error/status, rate limit | Supported transport; no fabricated guide answer |
| Conversation history / reload | Saved bubbles and optional action/insight/choice/draft fields; latest offer restored | Return/persist fields consistently | Existing session messages; optional fields new |
| Select a suggested reply | Backend option label/text rendered; send its ID and message index | Author meaningful options, resolve selected choice | Missing structured-choice handling |
| Ambiguous drained/tired/focus/balance | Clarification question/options presentation and text input | Choose question; ≤2 clarifications, then templates/words-only policy | Missing; frontend does not keyword-infer topics |
| Multiple goals / priority / constraints | Settings, explicit observation links, stored priorities/constraints | Maintain goals and use confirmed priorities/context | Legacy single constraint partial; full context pending |
| Confirm topic or interpretation | Dynamic confirmation options; recording form keeps topic explicit | Resolve topic and return confirmation payload | Missing structured confirmation |
| Five independent feeling scales | Topic-specific form, time, labels, unknown/skip/text-only | Consume independent metrics, avoid cross-topic scores | Records supported; legacy reasoning not v2 topic-aware |
| Hard-day/cocoa/sofa conversation | Dynamic bubble, optional log offer and step preview | Empathic wording, no causal claim, relevant optional offer | Legacy hard-day flow partial; v2 multifactor reasoning pending |
| Cocoa/food/drink offer from response | Open editable food/drink form; explicit save | Return accurate name/note/topic; never silently log | Existing `logOffer` partial |
| Check-in offer from response | Matching existing-topic form | Return confirmed topic; handle absent observation | Existing action partial; absent topic must be added explicitly |
| Plus → food/drink/check-in/photo | Attachment menu, topic chooser, photo picker, forms | None for manual inputs | Existing persistence; all frontend paths present |
| Food photo reading and confirmation | Reading/error/manual-edit states; confirm extracted fields | Existing Gemini vision extraction | Supported `/api/photo`; live test not run |
| Saved record notification / gentle next action | Toast and local next-action card with shuffle; no fake Agent acknowledgement | Optional conversational acknowledgement if desired | Local navigation complete; generated acknowledgement pending |
| Coffee/caffeine exploration | Prompt, log action, preview card; confirmed no-intake windows | Compare confirmed coverage, interpret unknowns, select approved action | Legacy context partial; v2 coverage reasoning pending |
| Exercise / sleep / rested conversations | Relevant record/action/step layouts | Topic-aware timing/evidence, no causal interpretation | Legacy facts/actions partial |
| Cycle/period context | Data controls and stored separate context permission | Enforce permission, do not infer phases/causes | Legacy cycle facts exist; v2 permission policy pending |
| Multifactor insights | Backend insight cards, limitation lines and evidence IDs | Compute/ground all eligible evidence; no largest-gap shortcut | Missing v2 structured context and insights |
| Step suggestion / keep suggestion | Dynamic preview with topic/duration/days and no automatic acceptance | Approved catalog and permissible step | Legacy catalog supported; new intervention approval pending |
| Just observe | Confirmation then explicit matching observation plan | Own allowed-choice policy; no generated intervention | UI recording action; not a new Agent menu |
| Busy week / adjust conversation | Sends user's request, renders returned proposal | Interpret barrier and generate permitted adjustment | Legacy busy-week partial; new context policy pending |
| Day 10 / current plan status/history | Review access, execution/feeling/barriers/notes, retained versions | None for feedback collection | Real command persistence |
| Review with Aura | Save/flush before request, loading/unavailable/error/retry, 25-second abort | Read saved feedback; generate and validate review | Missing generator; stub always `not-integrated` |
| Review result / why / recommendations | Summary, 1–4 reasons, optional proposal, provenance, stale marker | `aura.review.v1` result bound to exact snapshot | Typed validation implemented; backend generation pending |
| Accept adjustment | Proposal → confirmation → command; prior lineage/version preserved | Persist authorized result; authorize chosen adjustment | Transport supports catalog-bound proposals; noncatalog requires Rudy contract |
| Keep / observe / stop | Explicit decision buttons, snapshot checks, decision history | Set allowed choices and enforce server safety policy | Existing plan statuses; v2 review policy pending |
| Worsening/unwell / safety response | Existing feedback pause retained; show backend safety message; restrict paused review options | Classify and own safety rules / durable topic policy | Existing Agent safety unchanged; broader v2 policy pending |
| Demo/personal switching | Separate slots, explicit origins, preserve real records, reset confirmation | Respect mode/origins; prohibit cross-slot context | Transport separation implemented; new context policy pending |
| Demo AI permission | Explicit checkbox; blocked demo chat without permission | Maintain policy in any new endpoint | Chat transport gate present; reviews remain unintegrated |
| HRV and record overlays | Separate raw HRV/relative demo scale, gaps, workouts, event markers/tooltips | Do not convert HRV to feelings/stress or clear safety | No HRV Agent facts added; context inclusion policy pending |

## API contracts

### Existing chat + optional v2 presentation

`POST /api/aura?mode=personal|demo` uses the existing anonymous httpOnly cookie. The frontend sends:

```json
{
  "text": "I mean perceived stress",
  "today": "2026-10-08",
  "inputRevision": 12,
  "selectedTopic": "stress",
  "choice": { "messageIndex": 4, "optionId": "stress", "topicId": "stress" }
}
```

The **existing request validator consumes only `text` and `today`**. Rudy must add validation/ownership/snapshot handling for `selectedTopic`, `choice` and `inputRevision`, then resolve them without changing the user's records implicitly. Current `respond()` remains unchanged.

Existing response: `{ reply: { text, via, action, draft, logOffer, cited?, safety?, stopPlanId? } }`. Existing supported actions: caffeine, data, checkin and feedback. Frontend also understands future `review` (planId) and `context` actions. Optional additive fields:

```json
{
  "interaction": {
    "kind": "clarification",
    "question": "Which feeling would you like to focus on?",
    "options": [
      { "id": "stress", "label": "Perceived stress", "text": "I mean perceived stress", "topicId": "stress" }
    ]
  },
  "insights": [
    { "id": "insight-id", "title": "Backend-authored title", "text": "Backend-authored explanation", "limitations": ["Coverage limitation"], "evidenceIds": ["record-id"] }
  ]
}
```

This is an illustrative contract, not a real Agent response or prompt. `interaction.kind` is `clarification|confirmation|suggestions`; options need stable id, label and text, with an optional supported topic. The frontend does not infer meaning from labels. Old choice buttons become disabled once another turn exists. Invalid replies show an error, not a guide answer. Retry is a new transport request; Rudy should define idempotency/conversation IDs if needed.

### Day 10 review

`POST /api/review?mode=…` currently accepts `{ planId, planVersion, inputRevision, requestId, today }`. Request snapshot is checked against saved state; do not trust frontend-provided feedback or context. Return:

- `{ status: "not-integrated", error: "…" }` when no generator is connected (current behavior).
- Error status with explanatory `error`, preserving saved feedback.
- `{ status: "ok", result: AIReview }` only for a server-authorized saved result.

`AIReview` (runtime validator `ReviewSchema`) requires: `id`, contract=`aura.review.v1`, `requestId`, `planId`, `planVersion`, `inputRevision`, `mode`, `feedbackIds`, `summary`, recommendation=`adjust|continue|observe|stop`, 1–4 `reasons`, `proposal` (null except required for adjust), `safety:{pause,message?}`, `via`, `at`; optional actual `model`, `responseId`, `cited`.

Proposal fields: `topicId`, kind=`step|observe`, `title`, `desc`, `duration`, `days`, `step`, and `stepId` for the current confirmation command. Rudy must decide the approved catalog and authorization for generated custom proposals. Never substitute an unrelated catalog step when a proposal is absent.

Read all actual plan versions and feedback from this visitor/mode; maintain execution versus feeling; include confirmed topic/goal links and origins. The supplied prototype's richer context (`data.stateRev/savedAt/origins`, observation, planVersions, latestFeedbackId, allowed, locale/timeZone/createdAt) must be assembled on the server by Rudy. The frontend currently sends snapshot identity only. No new context builder was added.

Persist the result server-side in `aiReviews`; recheck snapshot after generation and before saving. Generic session saves cannot create server-authorized reviews. Adjustments use `POST /api/command` with action=`accept`, revision and review/request IDs; they must create a same-lineage new version and retain old feedback/history. `decide` stores keep/observe/stop. Review acceptance requires a matching saved server review. A client-only fixture cannot authorize a real adjustment.

### Recording, persistence and health

`GET/PUT/DELETE /api/session?mode=…` is visitor/mode scoped. PUT validates records and expected `inputRevision`; feedback, plans, decisions and reviews are protected and use commands. `/api/command` supports demo rebuild, feedback, accept and decide, returning `{state}`. No new OAuth flow or database replacement.

Health linking, syncing and photo paths use the same mode scope. HRV payloads add `hrvSamples[day]:[{t,ms,timestamp?}]`, `workouts/mindful[day]:[{start,end,startAt?,endAt?}]`. Timestamps retain exact exclusion boundaries. Do not approve real baseline/index calculations from the demo configuration. Native payload requires device testing.

## Rudy acceptance checklist

1. Define endpoint ownership and additive contracts; preserve backward compatibility and cookie/mode isolation.
2. Implement specified topic resolution/clarification and full multifactor policy using confirmed saved records, evidence, timing, coverage, provenance and constraints.
3. Enforce cycle/demo permissions and five independent scales in context. Define approved factor/trend/action catalogs rather than inheriting the old first-topic fallback.
4. Implement Day 10 generation, runtime verification, persistence, stale-result rejection and authoritative adjustment acceptance.
5. Decide safety policy using the supplied behavioral documents. Ellie has not implemented a new durable topic-wide Agent safety rule.
6. Run the specifications' M01–M14 acceptance scenarios against real Gemini, changed feedback/barriers and limited/conflicting data. UI fixtures establish presentation only.
7. Confirm product decisions for HRV baseline minimums, aggregation/bin/timezone rules, new trend thresholds and lifestyle actions. Validate native HealthKit on-device.

### Health preferences UI clarification

Web health-data preferences and connection/import controls are now combined. Web healthTypes control Aura usage; iOS HealthKit permissions still belong to the PoC. Passing web-selected types into the installed PoC is not currently supported by its token/origin URL contract; Rudy must define and validate that contract before enabling it. No permission is implied by web checkboxes.

## Frontend handoff checkpoint — 2026-10-08

Latest user-reviewed refinements: movable glass 1–5 scoring control with keyboard support, left unanswered position and no face/preset buttons; subdued Aura light in scores and illustrations; unified close controls; restored initial Aura orb and breathing, coordinated entry, foreground glass on the add menu, outside-click dismissal and stable composer position; quiet error styling; no duplicate Week by week chart. Health preferences and real connection/import entries are combined.

Current local checks: TypeScript and 83 tests across 7 files pass. The earlier production build passed before the latest visual refinements; a new production build is still required before publishing. Latest isolated browser checks cover restored hero, stable entry/composer, outside dismissal, scoring drag/keyboard/save. Real Gemini and physical iPhone animation/HealthKit remain unverified.

Rudy’s installed iOS PoC version has not been verified against this branch. Local HTTP numeric-IP links do not match the repository’s existing associated HTTPS domain or HTTP origin allowlist. Confirm the installed app’s deep-link and server-origin support, signed build version, and HRV payload before attempting a real sync. Do not redirect a local session token to the cloud backend: tokens and imports belong to the server/session that created them.

Suggested integration order: verify live chat and photo credentials; emit dynamic interaction/insight fields and consume choice IDs; implement topic/multifactor behavior from the three specifications; implement Day 10 review generation with validated snapshots and confirmed plan changes; verify real HealthKit/HRV device transport and resolve the pending real relative-index policy. Frontend backend-unavailable states must remain truthful until these are supported.

No commit, push, PR or deployment is authorized yet. Ellie’s branch is ellie/aura-v2; original uncommitted changes must be reviewed separately when preparing commits.


## Latest UI checkpoint — 2026-10-09

Onboarding concerns now use the v2 grouped icon cards and independent check rows. Health setup uses paired Aura/Health tiles and actual imported counts; the browser preferences are not a mock iOS authorization sheet. The real installed PoC owns HealthKit permission. Initial chat failures keep the composer visible with compact recovery and temporarily hide starter suggestions. The orb handover is restored using measured hero-to-left movement (700 ms; reduced-motion respected). Finishing onboarding resets Today’s entrance flag; the current background is layered above the sky and behind content.

Typecheck and 83 tests pass; isolated browser checks verified the Health setup, failed-chat composer, orb handover and onboarding-to-Today entrance. Latest production build and real Gemini/device validation remain outstanding.


## Publishing checkpoint — 2026-10-09

Ellie explicitly approved commit, push and Draft PR creation. Latest TypeScript, 83 tests and production build pass. Real Gemini and physical HealthKit remain unverified. Original package-lock and local agent configuration changes are preserved outside this feature commit.
