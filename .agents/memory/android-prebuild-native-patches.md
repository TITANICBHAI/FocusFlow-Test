---
name: Android prebuild native patches
description: Where FocusFlow Android native build fixes must live when Expo regenerates android/
---

For Android code copied from `android-native/`, any dependency or Gradle patch needed by a release build must be applied by the Expo config plugin, not only by the manual install script.

**Why:** Clean Expo prebuild regenerates `android/` and does not reliably run the repository's `android-native/install.sh`, so script-only patches can be absent from release builds.

**How to apply:** Keep the install script useful for manual workflows, but mirror required generated-project changes in the relevant config-plugin dangerous mod and make the patch idempotent.