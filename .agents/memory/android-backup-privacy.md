---
name: Android backup privacy
description: Privacy invariant for FocusFlow's Android backup behavior.
---

FocusFlow must keep Android automatic cloud and device-transfer backup disabled. User data may be moved only through the explicit, user-controlled `.focusflow` export/import flow.

**Why:** Android automatic backup can copy private app state outside the user's explicit export decision and can restore stale or unwanted state on another install.

**How to apply:** Any future Expo config, AndroidManifest, config-plugin, or native installer change must preserve `android:allowBackup="false"`. Never re-enable automatic backup to support the app's manual export/import feature.