---
name: Expo flavor application IDs
description: Expo Android prebuild behavior that affects Gradle product-flavor application IDs.
---

When an Expo Android app uses product flavors with different application IDs, define any non-default flavor ID through a local Gradle variable and reference that variable from `applicationId`.

**Why:** Expo's Android package modifier rewrites every literal `applicationId '…'` or `applicationId "…"` line to the configured `android.package`, including lines added by a config plugin. A literal alternate flavor ID silently becomes the default package after clean prebuild.

**How to apply:** Keep the configured package as the stable/default ID, add the alternate ID as a Gradle variable inside `android {}`, and use `applicationId alternateId` in the flavor. Verify the generated `android/app/build.gradle` after `expo prebuild --clean`.