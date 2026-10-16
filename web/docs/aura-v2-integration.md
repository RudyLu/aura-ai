# Aura v2 frontend integration and local preview

Work is on `ellie/aura-v2`. The ZIP is the UI/UX reference; the three October 7 behavioral documents and HRV PDF define the intended product behavior. The latest scope assigns Agent reasoning, prompts, context-building, safety policy and review generation to Rudy. No commit, push, PR or deployment has been made.

## Implemented

- Supplied v2 dark sky, illustrations, animated faces, welcome video, logo and font; Today cards; Explore feeling/body charts and dates; full-screen Aura with close/return navigation, composer and attachments.
- All five independent recording topics: evening energy, rested waking, afternoon sleepiness, perceived stress and productivity. Numerical, unknown, skipped and words-only entries retain their own topic and scale.
- Dynamic conversation layouts, action buttons, structured selectable replies, clarification/confirmation options, insight cards, typing/loading, errors, retry and persisted history. The UI does not generate clarification content or infer a topic from prose.
- Day 10 execution/feeling/barrier feedback; loading, unavailable and error/retry states; response validation, review summary/reasons/proposal presentation, stale-review checks and adjustment confirmation. A confirmed adjustment retains plan lineage and prior versions. Generation is intentionally unconnected.
- Personal/demo separation using separate visitor-scoped server slots, photos and health links. Existing single-slot demos are preserved in an archive. Synthetic history and additions during a demo have distinct labels.
- HRV XML/bridge/iOS payload support for timestamped SDNN, workouts and mindful intervals. Real data shows raw samples while baseline/bin policy is pending. Labeled demos exercise the proposed index visualization. No missing values are filled and HRV is not used as a stress score.
- Goals, priorities, practical constraints and confirmed observation links are stored for Rudy's future context integration.

## Preserved backend

The existing `server/agent.ts`, `gemini.ts`, `safety.ts`, `preset.ts`, `domain/discovery.ts` and `domain/steps.ts` are unchanged from the feature branch baseline. Original Agent tests are retained. V2 display comparisons live separately in `domain/uiDiscovery.ts`; they are not substituted into the existing Agent context builder.

Transport and persistence adaptations support mode isolation, validated feedback/plan commands and HRV payloads. The anonymous cookie, Firestore/file repositories, photo extraction and HealthKit link flow remain. These adaptations require review alongside the frontend; they are not a new Agent reasoning implementation. The chat transport reports missing Gemini configuration instead of presenting the existing canned offline replies as live AI. Demo AI requests require explicit permission. `/api/review` is a contract stub that returns `not-integrated`, even if chat Gemini is configured.

## Preview locally

1. Use Node 22 or newer. On this machine, the bundled Node 24 runtime works:
   ```bash
   export PATH="/Users/chenyian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
   cd /Users/chenyian/Documents/GitHub/aura-ai/web
   ```
2. Install existing locked dependencies if needed: `npm ci`.
3. Start the preview:
   ```bash
   STORAGE=file GEMINI_DISABLED=1 npm run dev
   ```
4. Open [localhost:3000](http://localhost:3000). Choose **See a demo timeline → Day 10**, then tap again to confirm.
5. Visit Today, Explore and Aura. Try adding perceived stress, a words-only entry, food/drink recording and step feedback. **Review with Aura** honestly reports the pending backend integration. Return through **Demo → Return to my records**.

Stop the development server before `npm run build`, then restart it; both use the shared `.next` directory. Keep `GEMINI_DISABLED=1` for offline preview. Existing live chat/photo configuration still uses Vertex application-default credentials; configuring credentials does not implement the new Day 10 review backend.

## Remaining dependencies

See [Agent Integration Handoff](agent-integration-handoff.md) for the full interaction audit and contracts. Rudy owns topic resolution, two-question clarification policy, multifactor context/evidence, optional cycle context, safety decisions, generated reviews and approved adjustment catalogs. The unchanged legacy Agent does not yet honor the proposed structured-choice/selected-topic contract or the complete v2 context policy.

Product decisions remain open for real HRV baseline minimums, mean/median and timezone/travel handling, stress/productivity factors, new trend thresholds and lifestyle intervention approval. No real relative index is enabled while those rules are pending.

The iOS payload is updated and Swift syntax is verified. Full iOS build/device HealthKit verification needs Xcode and an iPhone. No background resync was invented; relink/import updates the snapshot. Live Gemini, photo inference, deployed Firestore/Cloud Run and physical HealthKit were not tested on this machine.

## Validation

Run `npm run typecheck`, `npm test`, and `npm run build`. Tests include original Agent checks, five-topic recording, frontend comparison coverage, dynamic reply/review contracts, HRV boundary/exclusion rules, file-backed session/command isolation, stale revisions and linked-health persistence. Local validation: 83 tests across 7 files, TypeScript and production build pass. Isolated desktop/mobile capture flows have no page errors. Isolated browser tests verify typing, error/retry without duplicate turns, dynamic clarification/confirmation options, insight cards, history reload and Day 10 loading/error/retry/result/adjustment confirmation. Swift syntax parsing passes; a full native build remains unverified. Browser fixtures are restricted to isolated tests; they are never enabled in the application preview.

UI files: `src/ui/`; appearance: `src/styles/` and `public/assets/`; recording/visualization: `src/domain/{topics,state,uiDiscovery,uiSteps,conversation,hrv,health}.ts`; transport: session, aura, command and review API routes; HealthKit: `HealthConnectorPoC/HealthConnectorPoC/AuraLink.swift`.

About follows the supplied three-fact/settings-row layout while showing actual AI/data/storage status. Motion is wired to the supplied lifecycle: Today entrance then resting light, each Explore chart at viewport entry, Aura intro/entry/first-message handover/new-bubble/close. Normal and reduced-motion browser checks pass; computed activation and lifecycle were verified, not pixel-level video trajectories. Feeling-face bodies use the user-approved 72% fill opacity.
