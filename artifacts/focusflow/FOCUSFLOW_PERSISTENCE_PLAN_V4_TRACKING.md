# FocusFlow Persistence Plan v4 — Tracking

Authoritative source: `FOCUSFLOW_PERSISTENCE_PLAN_V4_1788058109006.md`

Related source: `AGENT_DB_LOGGING_V3_1788058109007.md`

This tracker keeps the persistence plan visible in the FocusFlow artifact
without changing the original plan. The existing migration plan remains the
authority for long-term ownership decisions; this v4 document is the current
execution plan for persistence reliability.

## Phase 1 — Persistence correctness

- [ ] 1.1 Fix DB state transitions without introducing a status enum.
- [ ] 1.2 Remove the recovery database as a live fallback.
- [ ] 1.3 Make critical `runWithDb` reads throw instead of masking failures.
- [ ] 1.4 Add explicit DB-unavailable loading/error/retry UI to the schedule screen.
- [ ] Verify Phase 1 on API 30 and API 31 devices.

## Phase 2 — JSI probe-reset

- [ ] Add `retryDb()` with a throwaway probe database.
- [ ] Wire the unavailable-screen retry action to `retryDb()`.
- [ ] Keep JSI/dead-handle diagnostics during the observation window.
- [ ] Verify the probe/retry log sequence on the API 30 device.

## Phase 3 — Native enforcement atomicity

- [ ] 3.1 Replace unsafe JSON string interpolation in `SharedPrefsModule.kt`.
- [ ] 3.2 Add atomic focus and standalone snapshot publishing.
- [ ] Expose the snapshot methods through the TypeScript native module.
- [ ] Replace separate focus-service writes with the atomic snapshot calls.
- [ ] Verify forced-kill/restart behavior never leaves a partial state.

## Phase 4 — Long-term Room migration

- [ ] Start only after Phases 1–3 are stable for the required observation period.
- [ ] Follow the migration plan and reliability review gates.
- [ ] Keep Room code in the prebuild-safe native source and avoid a half-cutover.

## Tracking notes

- Status: captured from the attached plan; implementation not started.
- Do not duplicate or replace the VPN coordinator work; the plan explicitly treats VPN as already handled.
- Update this checklist as implementation lands and device gates are verified.