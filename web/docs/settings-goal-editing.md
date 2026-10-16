# Settings goal editing

Settings → Your goals → Edit opens a dedicated goal editor, rather than the onboarding review. Onboarding retains the concern questions. Settings no longer exposes full setup review.

- Show goal names, not concern descriptions.
- Let users select goals and explicitly confirm suitable observation topics for each goal, using the existing catalog mappings.
- Save both goal → observation and observation → goal links together.
- Keep onboarding concerns unchanged.
- Removing a goal removes its links, while retaining observations, records, and unrelated goal links.
- Preserve stopped observations when their existing links are unchanged; selecting a stopped observation for a new link resumes it.
- Closing without saving discards the draft.
- Settings goal cards read the current goal records. Their artwork and title positions align; longer titles expand the shared card height.

Validation: 86 tests and production build pass. Isolated Chromium checks at 390px and 768px cover editing, eligible choices, saving, cancelling, and concern preservation. API writes in visual checks are intercepted in memory.

Integration note: this change is based on the local `ellie/aura-v2` branch. Reconcile with Rudy's current goal-management changes before merging; it does not update the deployed app.
