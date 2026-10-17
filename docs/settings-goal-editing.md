# Settings goal editing

Settings → Your goals → Edit opens the goal editor (`GoalsSheet`), rather than the onboarding review. Onboarding keeps the concern questions, and Settings → Prototype → Full setup review still reopens the full onboarding review.

- Goals are an ordered list of goal catalog IDs (`profile.goals: string[]`); the first is the priority. Today, Settings and the Agent prompt all read this one list.
- Users switch goals on or off and choose the priority. At least one goal stays selected.
- Which check-ins serve a goal is worked out from the topic table, not stored as links. A goal with no suitable check-in offers to add one; editing goals never creates, resumes or pauses a check-in on its own.
- Removing a goal (here or with × on Today) keeps check-ins and past records.
- Settings goal cards read the current goal list. Their artwork and title positions align; longer titles expand the shared card height.

Reconciliation note: the earlier branch-only editor (`domain/goals.ts`, two-way goal ↔ observation links, automatic observation matching) was dropped when rebasing onto `main`, in favour of the goal model in `main`.
