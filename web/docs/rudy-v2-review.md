# Aura v2 PR review — Rudy

Review of [RudyLu/aura-ai#1](https://github.com/RudyLu/aura-ai/pull/1) (`ellie/aura-v2`, commit `7fd7027`). On that commit, typecheck and 83 tests pass. Real Gemini and physical HealthKit were not tested.

## Merge decision

**Do not merge into `main` yet.** The handoff doc expects the Agent/backend work to happen on this branch first. Merging now would make `main` worse than it is today:

- **Day 10 review and step adjustment don't work yet.** `reviewPlan()` always returns `not-integrated`. Before this PR, adjusting a step worked in the browser.
- **Aura chat has no offline fallback.** It returns 503 when Gemini is not configured.
- **`/api/aura` ignores most of what the client sends.** It reads only `text` and `today`, not `choice`, `selectedTopic` or `inputRevision`.
- **Real HRV imports always show "pending".** The HRV rules are still awaiting a product decision.

Merge after the bugs below are fixed, the Agent work is in, and the M01–M14 checks pass.

## Bugs found

| # | Where | Problem | Status |
|---|---|---|---|
| 1 | `web/src/ui/actions.ts` `finishOnboarding` | Edit goals keeps an observation's link to a goal the user removed. The server rejects it ("Observation goal link is not confirmed"), and every save after that fails with 400. | Fixed locally, not committed; checked in the browser (old code fails, new code saves). The final shape depends on the goal model decision below. |
| 2 | `web/src/ui/actions.ts` `done-step` | After a "Save words only" check-in, answering "Did you do your step?" sends `answer: 'text-only'`, which `/api/command` rejects. | Server fix plus test done locally. **To be reverted:** Ellie decided to remove the option instead. |
| 3 | `web/src/domain/health.ts` export parser | export.xml now keeps every HRV sample, workout and mindful session for the file's whole history. Years of Apple Watch data come to about 1 MB, over the 900 KB state limit, so every save fails with 413. | Open. Suggest keeping only the last 60 days, as the iOS app does. |
| 4 | `web/src/ui/store.ts` `refreshLinkedHealth` | Finishing an iOS link raises the server's revision number, but the browser copies the new number only when `adoptLinked` returns true. Otherwise every save fails with 409 until reload. The server also overwrites a newer import. | Open. |
| 5 | `web/src/app/api/session/route.ts` | The old single-slot state is copied to `<sid>-legacy-demo`, and "Delete all records" never deletes that copy. | Open. Privacy clean-up. |

## iOS PoC / HRV compatibility

- **Old app build → new server: OK.** The HRV, workout and mindful fields are optional.
- **New app build → old server (`main`): fails.** `granted: ['hrv']` is rejected and the upload limit is 100 KB. **Deploy the web side before installing a new iOS build.**
- **Swift code looks correct:**
  - It requests read access for HRV, workouts and mindful sessions.
  - `HealthTypeCatalog` includes HRV, so the force-unwrap in `entry(.hrv)` is safe.
  - Timestamps match what the server expects.
  - Intervals that cross midnight are split by day, the same way the export parser does it.
- **Still to test on a real iPhone:**
  - The QR deep link to a LAN or local address.
  - The HealthKit permission prompts.
  - Payload size with 60 days of HRV (expected to be well under 900 KB).
- **Known gap:** data types chosen on the web are not sent to the iOS app.

## Ellie's decisions (product)

**Goals**

- Removing a goal removes only that goal's links. Observations and records stay; observing doesn't stop automatically, and the user isn't asked.
- The system's suggested pairing is used only for the first setup. Links the user edits are never overwritten.
- Settings → Edit goals manages goals directly and no longer asks for concerns again. Changing a goal shows only suitable observations for the user to confirm.

**Save words only**

- The option is removed. Check-ins use the scale, with an optional note.
- Existing `text-only` records are test data and can be cleared; there's no need to keep backend support for them.
- "Did you do your step?" is saved separately. With "Not sure", the score stays empty and is left out of comparisons, but the note is still available to the Agent and Review.

## Open questions for Ellie

**Goals** (most of these go away with the proposal below)

1. "Full setup review" and "Edit setup" still re-run setup, including concern selection. Do we keep that? If so, what happens to goals?
2. Goals are currently created from concerns (goal ID = concern ID). Which goal list does Edit goals offer?
3. "Suitable" is defined only through concern weights, and demo goals use a different ID format. We need a goal → topic table.
4. The observation edit sheet lets the user link any goal. Should it filter by suitability too?
5. What happens when a new goal has no suitable observation? Can a goal have zero observations?
6. Is "change a goal" the same as remove-plus-add, keeping links that suit the new goal? Does the new goal keep the old goal's priority?
7. The goal tags on Today, the goal cards in Settings and the Agent context all read `profile.concerns`, not `profile.goals`.

**Save words only**

1. Where is the test data: local `.data`, Cloud, or both? Should those check-ins be deleted, or converted to "Not sure" with the note kept? Linked feedback records need cleaning too. This must happen before the server drops `text-only`, or those sessions can't save.
2. Does the Agent context actually include notes from "Not sure" check-ins? (Rudy to check.)
3. Chat messages with Aura are not saved as records and don't appear in Explore. Is that intended?

## Proposal: simplify Concern / Goal / Observation

### Today

```
Concern ──(weights)──▶ Goal ◀──(many-to-many, stored both ways)──▶ Observation
"Drained after work"    "Have energy after work"                    "Evening energy" check-in
```

- **Concern and goal are already the same item with two labels.** Each concern carries its goal wording, and the goal's ID is the concern ID.
- **The goal ↔ observation links cause most of the problems.** They're stored on both sides, and the server checks that both sides match. That mismatch is bug #1, and it's behind most of the open questions above.

### Proposed: two concepts, links worked out from a table

```
Goal (what you want)                    Check-in (what you track daily)
"Have energy after work"   ── suits ──▶  Evening energy
"Feel rested on waking"    ── suits ──▶  Rested on waking
```

1. **Goal** (merges concern and goal): what the user wants to improve.
   - Onboarding can still use the problem wording ("Drained after work") to pick it, but it's stored and shown as one goal.
   - Edit goals adds, removes or reorders goals.
2. **Check-in** (renames "observation"): one of the 5 topics the user answers daily. It's added, paused or re-timed on its own.
3. **Links are not stored.** A fixed table says which check-ins suit each goal; the concern weights mostly have this already. A goal shows the suitable check-ins the user is tracking.

### What this solves

- **Removing a goal:** nothing else changes, and check-ins and records stay. That matches Ellie's rule, with no clean-up code.
- **Changing a goal:** the new goal shows any suitable check-ins. If none exist, the app offers to add one.
- **No sync problems:** links can't get out of step, so the server's two link checks go away, and with them the bug #1 class.
- **One source:** Today, Settings and the Agent all read the goal list.
- **Fewer open questions:** goal questions 1, 3, 4, 6 and 7 go away. Only "which goals exist" (Q2) and "which check-ins suit each" remain — one table. Q5 shrinks to "may a goal have no tracked check-in?".

### Trade-off

The user can no longer manually link a goal to an unrelated check-in (Ellie's rule C). That control isn't worth two-way links for v2: the Agent and discovery analysis work per check-in topic, so a link outside the catalog changes nothing. If some control is needed, a one-way "don't show this check-in under this goal" switch is much simpler.

### Naming

Use **Goal / Check-in** (目標／每日記錄) in the UI and docs. "Concern" survives only as the wording of the onboarding question.

**Needs Ellie's approval before the data model changes.**
