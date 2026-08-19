---
name: Android usage launch counts
description: Why FocusFlow derives app launch counts from Android usage events.
---

Android `UsageStats` rows provide aggregated foreground time, but the public API surface available to this project’s build does not provide a usable `appLaunchCount` property. App-entry counts should be derived from the `UsageEvents` stream and exposed through the existing `launchCount` field.

**Why:** The direct `UsageStats.appLaunchCount` reference failed Kotlin compilation even though the device’s usage history contains the needed foreground-transition data.

**How to apply:** When changing usage insights, preserve the event-based fallback and treat the count as foreground entries, de-duplicated for consecutive events from the same package.