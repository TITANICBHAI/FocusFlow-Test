---
name: Receiver recovery dispatch
description: Reliability rule for Android VPN recovery initiated from BroadcastReceiver lifecycle events.
---

Recovery initiated from a BroadcastReceiver must issue its native service dispatch before `onReceive()` returns; a delayed main-thread callback can be lost when Android reclaims the short-lived process.

**Why:** Boot, unlock, watchdog, and package broadcasts may run in a newly spawned process whose lifetime is not guaranteed after delivery. Persisting policy and posting a delayed callback is not enough to guarantee the VPN service starts.

**How to apply:** Keep normal source synchronization debounced, but use an immediate coordinator dispatch for receiver-driven recovery and preserve a visible failure state if Android rejects the service start.