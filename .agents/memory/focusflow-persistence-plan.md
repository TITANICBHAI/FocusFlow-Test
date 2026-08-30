---
name: FocusFlow persistence migration authority
description: Authority order for FocusFlow persistence planning and Android data ownership migration.
---

`artifacts/focusflow/PERSISTENCE_MIGRATION_PLAN.md` is the boss/source of truth for the persistence migration. `artifacts/focusflow/PERSISTENCE_RELIABILITY_PLAN.md` and `artifacts/focusflow/PERSISTENCE_RELIABILITY_PLAN_REVIEW.md` are supporting documents: use them for reliability details and risk review, but resolve conflicts in favor of the migration plan.

`artifacts/focusflow/FOCUSFLOW_PERSISTENCE_PLAN_V4_1788058109006.md` is the current captured execution plan for Phases 1–3 reliability work and its long-term Room prerequisites. Its artifact-local checklist is `FOCUSFLOW_PERSISTENCE_PLAN_V4_TRACKING.md`.

**Why:** The migration plan defines the intended execution and ownership changes, while the reliability plan and its review provide supporting analysis rather than competing authority.

**How to apply:** When planning or implementing persistence work, follow `PERSISTENCE_MIGRATION_PLAN.md` first, consult the reliability documents for additional constraints and risks, and resolve any disagreement by treating the migration plan as authoritative.