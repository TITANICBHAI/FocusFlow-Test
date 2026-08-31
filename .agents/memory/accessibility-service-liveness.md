---
name: Accessibility service liveness
description: Android Accessibility enabled state is authorization, not proof that the service is bound and alive.
---

Android normally preserves an enabled Accessibility setting across an ordinary
process kill, and the system may reconnect the service. However, a stale enabled
setting can remain while no Accessibility events are being delivered. A
heartbeat with a bounded TTL is therefore needed to decide whether primary
enforcement is live; the foreground fallback should not rely on the enabled list
alone.

**Why:** FocusFlow's blocking overlay and event-driven enforcement disappear with
the AccessibilityService process, while Android does not expose a supported
public API for the app to silently re-enable or manually bind that service.

**How to apply:** Keep Accessibility as primary, use a native heartbeat to detect
staleness, switch to UsageStats/foreground-service fallback during the gap, and
notify the user when Android needs a manual repair. Keep force-stop and OEM
process-management behavior explicitly best-effort.
