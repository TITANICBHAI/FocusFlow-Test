---
name: FocusFlow test-plan review
description: Review-derived gaps that prevent false confidence in fallback enforcement and cross-service timing tests.
---

FocusFlow's test plan must prove the preconditions of fallback enforcement, not only the final blocked outcome. Distinguishing `queryEvents` from `queryUsageStats`, keeping the poller alive for allowance-only and always-on-only modes, and testing raise-only usage updates are especially important.

**Why:** A mocked or happy-path outcome can pass while an early return, stale foreground API, or lower-value overwrite silently disables enforcement on real Android devices.

**How to apply:** Keep these as explicit tracked cases in `FOCUSFLOW_TEST_PLAN.md`; separate JavaScript boundary evidence from Kotlin and device evidence.