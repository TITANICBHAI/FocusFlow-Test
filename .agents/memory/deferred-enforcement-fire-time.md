---
name: Deferred enforcement fire-time checks
description: Native handler callbacks can outlive the session, toggle, or allowance state that scheduled them.
---

Any delayed enforcement callback must validate its own current policy at fire time, not only trust the state observed when it was scheduled. This includes delayed global navigation, app dismissal, retry, and expiry actions.

**Why:** FocusFlow enforcement state can change while a callback waits on Android's main-handler queue. Without a second check, an expired session, edited allowance, or disabled toggle can cause a later unrelated navigation or block.

**How to apply:** Keep checks policy-specific: re-read the relevant toggle for system protections, validate the current session/package/allowance for app dismissal, and verify the foreground package for retries.