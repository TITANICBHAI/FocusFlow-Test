# FocusFlow — Additional Recommendations

These are optional product and reliability ideas collected during review. They are
kept separate from the required test plan. Status reflects the current checkout:

- `[x]` already implemented or substantially covered
- `[~]` partially implemented or needs verification
- `[ ]` suggestion not implemented
- `[N/A]` intentionally outside the current FocusFlow product scope

This status was checked against the current TypeScript and Kotlin implementation
on 2026-08-24. A recommendation is not marked complete merely because it is
described in a comment, plan, or test stub.

## 1 — Precise Budget-Expiry Trigger `[x]`

The native ForegroundTaskService schedules a callback for the known remaining
time of the current foreground time-budget app, re-checks the foreground package,
marks the allowance exhausted, and wakes the fallback blocker immediately.

## 2 — Friction Screen on Block Overlay `[x]`

`BlockOverlayActivity` and the WindowManager overlay already use a delayed
escape-control reveal with a countdown and block reason. Keep device-level tests
for the timer, overlay persistence, and dismissal gate.

## 3 — Timed Unlock / Cooldown `[N/A]`

The current product does not expose an in-session “Use for N minutes” bypass.
FocusFlow instead supports configured daily allowances and temporary blocking
sessions, which are different controls. Adding a timed unlock would be a product
decision and is intentionally outside the current enforcement scope.

## 4 — Unified Permission Health Checker `[N/A]`

This is not needed for the current scope. Existing onboarding and settings paths
already provide the required permission checks, so a new shared status layer would
add structure without solving a current user-visible problem.

## 5 — NFC Focus Trigger `[N/A]`

There is no NFC-trigger product requirement or NFC integration in the current
FocusFlow scope. The existing `focusflow://` deep-link handling is used for app
navigation, not NFC-based session toggling. This remains optional and is not
needed for enforcement correctness.

## 6 — Clean Up `daily_allowance_used` on Config Change `[N/A]`

Not needed now. The stored usage object is small and bounded by the configured
allowance list in normal use; this cleanup can remain deferred unless usage data
growth is observed.

## 7 — Fix Default Settings Discrepancy `[x]`

The app now uses one canonical defaults object for both React startup and the
database fallback. Automatic Always-On copying and VPN self-healing default to
off; keeping focus active until the scheduled task end defaults to on. Existing
saved settings still override these defaults.

## 8 — Guard Backup Restore During an Active Focus Session `[x]`

Replacement restore is rejected before settings or tasks are changed when either
the in-memory session snapshot or the database reports an active focus session.
The user receives a clear message telling them to stop the session first.

## 9 — Validate SHA-256 Fallback Vectors `[x]`

The PIN suite now forces the pure-JavaScript fallback path and verifies the
empty-string and `abc` NIST vectors.

## 10 — Close the Standalone VPN Handoff Gap `[ ]`

When standalone VPN protection expires while always-on VPN packages remain,
ensure the always-on protection is established before the standalone tunnel is
stopped, or otherwise prove that no protection gap is observable. Live code
merges always-on and standalone VPN package lists when starting protection, but
the standalone-expiry path still needs Android-level evidence that the handoff
does not expose a gap.

## Priority Order

1. Canonicalize default settings and guard active-session backup restore.
2. Clean allowance usage entries and close the VPN handoff gap.
3. Improve precise budget expiry and permission-state consistency.
4. Keep device-level friction-overlay verification in the Android test backlog.
5. Timed unlock and NFC are intentionally out of scope unless product requirements
   change; the SHA-256 fallback vectors are already complete.

The original unannotated source recommendation is preserved in the attached
workspace asset; this copy is the FocusFlow artifact's tracked status version.