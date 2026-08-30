# FocusFlow Database Logging v3 — Tracking

Authoritative source: `AGENT_DB_LOGGING_V3_1788058109007.md`

Dependency: apply the persistence plan's Phase 1/2 database behavior first;
logging should describe that behavior rather than preserve removed fallback
paths.

## Logging implementation checklist

- [ ] 1. Add the successful-startup `[DB_READY]` health snapshot.
- [ ] 2. Log `markUnrecoverable()` transitions with structured reasons.
- [ ] 3. Add JSI probe/retry outcome logs.
- [ ] 4. Log `resetDb()` state before clearing it.
- [ ] 5. Add slow-operation timing to `runWithDb` and `runWithDbOr`.
- [ ] 6. Add affected-row logging for the listed critical writes.
- [ ] 7. Log WAL checkpoint outcomes and busy state.
- [ ] 8. Add write-queue depth and wait-time telemetry.
- [ ] 9. Add migration start, success, and failure logs.

## Privacy and logging rules

- [ ] Do not log task titles, descriptions, notes, or settings values.
- [ ] Do not log SQL parameter values or full stack traces.
- [ ] Do not log package names in the JS database logs.
- [ ] Keep the database logger tag as `database`.
- [ ] Do not use `console.log` or modify `startupLogger.ts`.
- [ ] Keep SharedPrefs native logging separate from JS database logging.

## Device verification checklist

- [ ] `[DB_READY]` appears with task/session counts and startup timing.
- [ ] WAL checkpoint outcome is visible, including blocked-lock warnings.
- [ ] Critical writes report affected rows.
- [ ] JSI failures use `[DB_UNAVAILABLE]`, not removed recovery tags.
- [ ] Retry logs show the expected retry/probe/success or failure sequence.
- [ ] Review logs for accidental user-content or sensitive-value leakage.

## Tracking notes

- Status: captured from the attached plan; implementation not started.
- Keep the original logging plan unchanged as the detailed reference.