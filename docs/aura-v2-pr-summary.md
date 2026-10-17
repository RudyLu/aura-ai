# Aura v2 Draft PR summary

Suggested title: **Integrate Aura v2 frontend and prepare Agent contracts**

Source branch: `ellie/aura-v2`. Target branch: `main` (review/merge only after approval).

## Summary

Integrates the supplied Aura v2 UI into the existing Next.js app: Today/Explore, full-screen conversation, five independent topic recording flows, Day 10 feedback/review presentation, personal/demo separation and HRV visualization. Conversation options, insights and review proposals are dynamic backend presentation contracts; no prototype conversations are presented as generated AI.

Preserves existing Agent prompts, context/reasoning, Gemini client, safety implementation, authentication and legacy comparison/step logic. Adds transport/persistence adaptations for separate data modes, validated commands, review snapshot contracts and timestamped HRV. Preserves real records and prior plan versions.

## Review focus for Rudy

- [Agent Integration Handoff](agent-integration-handoff.md): interaction-by-interaction support and missing contracts.
- Structured clarification/confirmation/insights need backend emission and choice handling.
- Day 10 generation remains deliberately `not-integrated`; review/adjustment layouts are ready.
- The unchanged legacy Agent does not fulfill all v2 topic, cycle-permission, multifactor and safety requirements.
- HRV real relative-index policy and intervention catalogs require product approval; native payload requires device verification.

## Validation

83 tests across 7 files, TypeScript, production build, Swift syntax parsing and isolated desktop/mobile/browser-fixture flows pass locally. Final results are recorded in the implementation handoff. Live Gemini, deployed Firestore/Cloud Run and physical HealthKit were not verified. Browser fixtures are test-only and do not ship as a runtime AI mode.

## Existing local changes

The original package-lock.json, AGENTS.md and CLAUDE.md changes predated this work and are preserved. Review their inclusion separately before a commit. No dependency/package-lock rewrite was introduced for v2.

Ellie approved commit, push and Draft PR creation on 2026-10-09.

## Latest UI review updates

Refines the glass scoring control, Aura entry/ambient light and add-menu glass with stable positioning and outside dismissal; harmonizes close buttons, score glows and record illustrations; combines health-data preferences and connection options; removes the redundant weekly trend block. Latest TypeScript and 83 tests pass. Latest production build passes (2026-10-09). No live Gemini or installed-PoC compatibility verification is claimed.
