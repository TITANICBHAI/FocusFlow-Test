---
name: FocusFlow database logging plan
description: Durable pointer to the structured database logging plan and its artifact-local tracker.
---

FocusFlow has a captured database-logging plan that extends the persistence reliability work with startup health snapshots, structured failure/retry logs, slow-query and write-queue telemetry, WAL outcomes, and migration logs.

**Why:** Database failures need enough structured, privacy-safe context to distinguish missing data, locking, slow operations, dead JSI handles, and failed writes without logging user content or settings.

**How to apply:** Use `artifacts/focusflow/AGENT_DB_LOGGING_V3_1788058109007.md` as the detailed source and `artifacts/focusflow/AGENT_DB_LOGGING_V3_TRACKING.md` as the progress surface. Keep it scoped to `src/data/database.ts` and preserve the existing logger contract.