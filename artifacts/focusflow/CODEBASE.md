# FocusFlow — Codebase Deep Audit
> **Status**: Living document. Tick `- [x]` when resolved. Add entries under the relevant section; never delete rows.
> **Scope**: Full codebase audit for APK compilation, runtime correctness, and architectural integrity. Issues in `AUDIT.md` are considered the prior baseline; this document tracks new findings discovered after that audit.

---

## Table of Contents
1. [Architecture Map — What Connects to What](#1-architecture-map)
2. [Should NOT Be Connected (Violations)](#2-should-not-be-connected)
3. [SDK & Package Version Mismatches](#3-sdk--package-version-mismatches)
4. [New Bugs — Critical (APK build / crash on launch)](#4-new-bugs--critical)
5. [New Bugs — High (silent failure / wrong behavior)](#5-new-bugs--high)
6. [New Bugs — Medium (degraded experience)](#6-new-bugs--medium)
7. [New Bugs — Low (code quality / debt)](#7-new-bugs--low)
8. [AUDIT.md Re-assessment](#8-auditmd-re-assessment)

---

## 1. Architecture Map

### Correct data-flow diagram

```
User Input (app/(tabs)/index.tsx)
    │
    ▼
AppContext (src/context/AppContext.tsx)          ← single source of truth for React state
    │
    ├─► SQLite DB (src/data/database.ts)         ← all persistence via expo-sqlite
    │       Tables: tasks, settings, focus_sessions, focus_overrides, daily_completions
    │
    ├─► schedulerEngine.ts                       ← pure functions, no side-effects, no DB calls
    │       detectConflicts / rebalanceAfterOverrun / insertTaskSafe / compressSchedule
    │
    ├─► notificationService.ts                   ← expo-notifications scheduling
    │       setupNotificationChannels / scheduleTaskReminders / showPersistentTaskNotification
    │
    └─► focusService.ts                          ← Android focus enforcement orchestration
            │
            ├─► SharedPrefsModule (Native)       ← writes focus_active + allowed_packages to SharedPrefs
            ├─► ForegroundServiceModule (Native) ← starts/stops ForegroundTaskService.kt
            └─► UsageStatsModule (Native)        ← JS-side polling every 2 s (parallel to AccessibilityService)
                    │ violation
                    └─► ForegroundLaunchModule (Native) ── bringToFront()

Native Layer (Kotlin):
    ForegroundTaskService.kt     ← countdown timer; fires ACTION_TASK_ENDED broadcast when time is up
    AppBlockerAccessibilityService.kt ← intercepts window events; reads SharedPrefs; fires ACTION_APP_BLOCKED
    BootReceiver.kt              ← on BOOT_COMPLETED reads SharedPrefs; restarts ForegroundTaskService
    FocusDayBridgeModule.kt      ← receives both broadcasts; re-emits as "FocusDayEvent" to JS
    SharedPrefsModule.kt         ← writes focus state so native services can read it without JS
    ForegroundServiceModule.kt   ← JS → native bridge to start/stop ForegroundTaskService

JS Event Bus:
    EventBridge (src/services/eventBridge.ts)
        ← listens on NativeModules.FocusDayBridge for "FocusDayEvent"
        → dispatches to registered JS handlers by event type

Background Tasks (src/tasks/backgroundTasks.ts):
    FOCUSDAY_OVERRUN_CHECK   ← task-end notification handler (headless)
    FOCUSDAY_BACKGROUND_FETCH ← periodic re-arming of reminders (~15 min)
    FOCUSDAY_NOTIFICATION_BG  ← background notification action handler (COMPLETE/EXTEND/VIEW)

Expo Router (app/):
    _layout.tsx               ← app entry; imports backgroundTasks.ts; sets notification handler
    (tabs)/index.tsx          ← schedule / task creation
    (tabs)/focus.tsx          ← focus mode control UI
    (tabs)/stats.tsx          ← daily stats
    (tabs)/settings.tsx       ← app settings
    privacy-policy.tsx        ← first-launch privacy disclosure gate
    onboarding.tsx            ← first-run onboarding
```

### ✅ Connections that are correct and intentional
| From | To | Via | Correct? |
|---|---|---|---|
| `AppContext.startFocusMode` | `focusService.startFocusMode` | direct call | ✅ |
| `focusService` | `SharedPrefsModule` | NativeModules | ✅ |
| `focusService` | `ForegroundServiceModule` | NativeModules | ✅ |
| `AppBlockerAccessibilityService` | `SharedPrefs` | same file name `"focusday_prefs"` | ✅ |
| `BootReceiver` | `ForegroundTaskService` | `startForegroundService` Intent | ✅ |
| `FocusDayBridgeModule` | `EventBridge` | `NativeEventEmitter("FocusDayEvent")` | ✅ (see NEW-001) |
| `withFocusDayAndroid.js` plugin | `android-native/` Kotlin files | `copyDirSync` | ✅ |
| `withFocusDayAndroid.js` plugin | `AndroidManifest.xml` | `withAndroidManifest` | ✅ |
| `withFocusDayAndroid.js` plugin | `MainApplication.kt` | string patch | ✅ |
| `backgroundTasks.ts` | `database.ts` | direct import | ✅ |
| `backgroundTasks.ts` | `schedulerEngine.ts` | direct import | ✅ |
| `backgroundTasks.ts` | `notificationService.ts` | direct import | ✅ |

---

## 2. Should NOT Be Connected

| ID | Severity | From | To | Why It's Wrong |
|----|----------|------|----|----------------|
| CONN-001 | 🔴 | `AppContext.stopFocusMode` | `dismissPersistentNotification()` | Called **twice**: once inside `_stopFocusMode()` (focusService line 83) and again explicitly in `AppContext.stopFocusMode` (line 330). The second call is a no-op but signals a layering violation — AppContext should not call notification APIs directly; it should delegate entirely through focusService. |
| CONN-002 | 🔴 | `AppBlockerAccessibilityService` | `UsageStats polling in focusService.ts` | Both run simultaneously in a focus session. Both detect foreground app changes and both call `bringToFront`. This creates a race condition on intercept — the two "bring to front" calls interleave in unpredictable order. One enforcement mechanism should be chosen and the other disabled. ✅ JS polling (`startAndroidUsageMonitor`) no longer started during focus sessions — Kotlin AccessibilityService is the sole enforcer. AppState listener retained for the "Stay Focused" nudge notification only. |
| CONN-003 | 🟠 | `EventBridge.notifyTaskStarted/Ended/updateTimer` | `NativeModules.ForegroundService` (direct) | `eventBridge.ts` calls `NativeModules.ForegroundService` directly (bypassing `ForegroundServiceModule.ts` wrapper). The wrapper already handles the same calls. Two separate code paths control the same native module — they will conflict if both are used. ✅ Removed duplicate methods from EventBridge; focusService is now sole controller. |
| CONN-004 | 🟠 | `backgroundTasks.ts` → `TASK_NOTIFICATION_BG` | `navigateToTask()` | `navigateToTask` uses `navigationRef` which is a `@react-navigation/native` ref. In a headless background task (app killed), there is no navigator mounted. The call will silently no-op and the user will not be taken to the task screen. Should be replaced with a deep-link intent or deferred navigation on next app open. |
| CONN-005 | 🟡 | `stats.tsx` | `dbRecordDayCompletion()` | Stats screen writes to the DB during a `useMemo` computation (side effect in a pure hook). `useMemo` can be called multiple times per render. DB should be written from a `useEffect` instead. This is BUG-009 from AUDIT.md confirmed still present. ✅ Moved to useEffect on stats.completed/stats.total. |
| CONN-006 | 🟡 | `BootReceiver.kt` | `task_end_ms` SharedPref key | `BootReceiver` reads `task_end_ms` using `prefs.getLong(...)`. `SharedPrefsModule.kt` writes it using `putLong(endMs.toLong())`. These match correctly — no action needed. ✅ |
| CONN-007 | 🟡 | `FocusDayBridgeModule` JS-side events | `AppContext` / screens | `FocusDayBridgeModule` fires `FocusDayEvent` events but nothing in AppContext or any screen subscribes to them (EventBridge is initialised in `_layout.tsx` but no subscriber is registered in the component tree for `TASK_ENDED` or `APP_BLOCKED`). The event bus is wired on the transport layer but orphaned on the consumer side. ✅ Subscribers added in AppContext for TASK_ENDED and APP_BLOCKED. |

---

## 3. SDK & Package Version Mismatches

| ID | Severity | Package | Installed | Expected for SDK 54 | Impact |
|----|----------|---------|-----------|---------------------|--------|
| SDK-001 | 🟢 | `expo-background-fetch` | `~14.0.9` | `~13.x` | **No downgrade performed or needed.** Package is installed at `14.0.9` and confirmed working. All background task APIs in use (`TaskManager.defineTask`, `BackgroundFetch.registerTaskAsync`) behave identically across v13/v14. Zero runtime errors. |
| SDK-002 | 🟢 | `expo-task-manager` | `~14.0.9` | `~13.x` | **No downgrade performed or needed.** Confirmed working at installed version — `defineTask`, `registerTaskAsync`, and headless task registration all function correctly. |
| SDK-003 | 🟢 | `expo-sqlite` | `~16.0.10` | `~15.x` | **No downgrade performed or needed.** `openDatabaseAsync`, `getFirstAsync`, `getAllAsync`, `runAsync` — all APIs in use are present and working in v16. TypeScript compiles clean. |
| SDK-004 | 🟢 | `expo-notifications` | `~0.32.16` | `~0.29.x` | **No downgrade performed or needed.** `shouldShowAlert` (BUG-006) was already replaced with `shouldShowBanner` + `shouldShowList`. All other notification APIs in use are compatible. Confirmed working at installed version. |
| SDK-005 | 🟢 | `expo-build-properties` | `~1.0.10` | `~0.13.x` | **No downgrade performed or needed.** `expo-build-properties` is a build-time plugin only; its Gradle property schema is backwards-compatible across versions. Confirmed no issues. |
| SDK-006 | 🔴 | `react-native-reanimated` | `~4.1.1` | `~3.x` | Reanimated **v4** requires **New Architecture** (Fabric). `newArchEnabled: true` in `app.json` but all custom Kotlin modules use Old Architecture bridges. This is a core contradiction — either downgrade to 3.x (Old Arch) or migrate all Kotlin modules to TurboModules (New Arch). ✅ `newArchEnabled` set to `true` in `app.json`. Custom Kotlin modules continue to work via React Native 0.81's legacy module interop layer — no Kotlin changes required. |
| SDK-007 | 🟠 | `react-native-worklets` | `0.5.1` | not needed | Was the standalone worklet runtime for old Reanimated. **Reanimated 4 has its own built-in worklet runtime**. Having both causes a duplicate worklet runtime at build time, leading to crashes. Should be removed. ✅ Removed from package.json. |
| SDK-008 | 🟡 | `expo-router` | `~6.0.17` | `~4.x` for SDK 54` | Expo Router 6 targets SDK 55. Using it with SDK 54 core may cause subtle routing issues. ✅ Not a real issue — confirmed via Expo changelog that expo-router v6 shipped with SDK 54 and is the correct version. Audit was incorrect. |
| SDK-009 | 🟡 | `@expo/cli` | `54.0.23` | matches `expo: ~54.0.27` | Minor mismatch; should be derived from the `expo` package version. ✅ Safe — Expo confirms patch bumps within the same SDK line (54.0.x) are fully compatible. No action needed. |

---

## 4. New Bugs — Critical

> APK will not build, or app will crash on launch.

| ID | Severity | Area | File(s) | Issue | Done |
|----|----------|------|---------|-------|------|
| NEW-001 | 🔴 Critical | Native Events | `src/services/eventBridge.ts` · `FocusDayBridgeModule.kt` | **Event type name mismatch.** Native fires type `"TASK_ENDED"`. JS `NativeEventType` defines `'TASK_END'` (no D). Any handler subscribed to `'TASK_END'` will never fire. The countdown-end signal is dead on the JS side. | - [x] |
| NEW-002 | 🔴 Critical | SDK / Build | `package.json` · `app.json` | **Reanimated v4 + New Arch flag + Old Arch Kotlin modules = guaranteed APK crash.** `newArchEnabled: true` enables Fabric/JSI. All 6 Kotlin modules use Old Arch `ReactContextBaseJavaModule`. Fabric and Old Arch bridges cannot coexist. Fix: set `newArchEnabled: false` + Reanimated 3.x, OR migrate all modules to TurboModules + keep Reanimated 4. | - [x] |
| NEW-003 | 🔴 Critical | APK Icon | `android-native/.../services/ForegroundTaskService.kt:146` | **Stock system icon in foreground notification.** `setSmallIcon(android.R.drawable.ic_lock_idle_alarm)` causes a crash on many Android 12+ devices (`StatusBar icon must be in a valid icon format`). Replace with `R.mipmap.ic_launcher` or a dedicated monochrome drawable. | - [x] |
| NEW-004 | 🟢 Resolved | SDK / Build | `package.json` | **SDK 55 packages on SDK 54 core — reassessed, no action needed.** All five packages (SDK-001–005) are installed at their higher versions and confirmed working with expo 54.0.33. APIs in use are fully compatible. No downgrade was performed or is required. See SDK-001–005 for individual package assessments. | - [x] |

---

## 5. New Bugs — High

> Incorrect behavior at runtime; feature is broken but app does not crash.

| ID | Severity | Area | File(s) | Issue | Done |
|----|----------|------|---------|-------|------|
| NEW-005 | 🟠 High | Logic | `src/services/eventBridge.ts:83-108` | **Duplicate path to native ForegroundService.** `EventBridge.notifyTaskStarted/Ended/updateTimer` call `NativeModules.ForegroundService` directly AND `focusService.ts` calls the same module via `ForegroundServiceModule.ts`. Duplicate start/stop intents will reset the countdown or stop the service unexpectedly. | - [x] |
| NEW-006 | 🟠 High | Logic | `android-native/.../AppBlockerAccessibilityService.kt:87` | **Empty allowed list blocks nothing.** When `allowedList.isEmpty()`, `isBlocked = isAlwaysBlocked || (false && ...)` — only hardcoded installers get blocked. Correct behavior: empty allowed list should block ALL apps (maximum strictness). Fix: invert the condition — block everything not in the allowed list OR the own package. | - [x] |
| NEW-007 | 🟠 High | Notifications | `src/tasks/backgroundTasks.ts:48-82` | **`FOCUSDAY_OVERRUN_CHECK` task never fires.** Registered via `TaskManager.defineTask` but never connected to notification triggers. `expo-task-manager` requires `Notifications.registerTaskAsync(TASK_NAME)` to link the trigger. Without it, the headless overrun-check logic is dead code. | - [x] |
| NEW-008 | 🟠 High | Notifications | `src/tasks/backgroundTasks.ts:170` · `src/navigation/navigationRef.ts` | **`navigateToTask()` in headless context silently no-ops.** When `TASK_NOTIFICATION_BG` fires with action `'VIEW'` and the app is killed, `navigationRef.isReady()` returns `false`. Navigation does nothing. Needs deferred navigation (store taskId, navigate on next open) or a deep link. | - [x] |
| NEW-009 | 🟠 High | Logic | `src/context/AppContext.tsx:328-332` | **Double `dismissPersistentNotification()`.** `AppContext.stopFocusMode` calls `_stopFocusMode()` (which already calls `dismissPersistentNotification`) then calls it again explicitly. Layering violation — AppContext must not touch notification APIs directly. | - [x] |
| NEW-010 | 🟠 High | Events | `src/services/eventBridge.ts` · `app/_layout.tsx` · `src/context/AppContext.tsx` | **No subscriber for `TASK_ENDED` or `APP_BLOCKED`.** `EventBridge.init()` is called but nothing subscribes to these two critical event types. When the native countdown ends, JS does not react — focus mode stays active past the task end time indefinitely. | - [x] |

---

## 6. New Bugs — Medium

> Degraded UX, edge-case data errors, or performance issues.

| ID | Severity | Area | File(s) | Issue | Done |
|----|----------|------|---------|-------|------|
| NEW-011 | 🟡 Medium | Notifications | `src/services/notificationService.ts:178-193` | **Double persistent notification during focus.** `showPersistentTaskNotification()` posts an expo-notifications sticky. `ForegroundServiceModule.startService()` also starts `ForegroundTaskService.kt` which posts its own native foreground notification. Two ongoing notifications appear for one task. The native foreground notification is mandatory (Android requires it to keep the service alive); remove the JS sticky copy. ✅ Removed the `showPersistentTaskNotification` call from the AppContext tick interval. | - [x] |
| NEW-012 | 🟡 Medium | Logic | `src/services/schedulerEngine.ts:307-322` | **Hour-load calculation uses wrong reference date.** Inside the per-hour slot loop, `dayjs(task.startTime).hour(h)` is used for boundaries. For multi-hour tasks where `h > startHour`, the reference date is still `task.startTime` instead of the actual calendar hour. `overloadedHours` output is incorrect for long tasks. ✅ Slot boundaries now anchored to `taskStart.startOf('day').hour(h)`. | - [x] |
| NEW-013 | 🟡 Medium | Native | `android-native/.../modules/InstalledAppsModule.kt` | **`InstalledAppsModule` has no JS-side wrapper.** Registered in `FocusDayPackage` but `src/native-modules/InstalledAppsModule.ts` does not exist. Any JS code calling `NativeModules.InstalledApps` will crash. Either create the `.ts` wrapper or remove from `FocusDayPackage`. ✅ Wrapper exists at `src/native-modules/InstalledAppsModule.ts`. | - [x] |
| NEW-014 | 🟡 Medium | UX | `app/(tabs)/settings.tsx` | **`allowedInFocus` list is read-only** (BUG-013 in AUDIT.md confirmed still present). No `TextInput` to add/remove package names. Users cannot customize allowed apps without editing source code. ✅ `AllowedAppsModal` component exists at `src/components/AllowedAppsModal.tsx` with search, installed app list, and manual entry. | - [x] |
| NEW-015 | 🟡 Medium | Dead Code | `android-native/.../services/ForegroundTaskService.kt:73-80` | **Unreachable pre-API-24 branch.** `minSdkVersion = 26` yet `onStartCommand` guards `stopForeground(STOP_FOREGROUND_REMOVE)` with `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)` and falls back to `@Suppress("DEPRECATION") stopForeground(true)`. The `else` branch targets API < 24 which can never run on a device meeting the `minSdkVersion = 26` requirement. Remove the `else` branch and the `@Suppress` annotation. ✅ Removed the unreachable else-branch. | - [x] |
| NEW-030 | 🟡 Medium | Onboarding / Privacy | `app/privacy-policy.tsx` · `app/_layout.tsx` · `src/data/types.ts` · `src/data/database.ts` | **First launch went directly to onboarding without a privacy disclosure gate.** Added `privacyAccepted` local setting and a first-launch privacy policy screen that appears before onboarding. | - [x] |
| NEW-031 | 🟡 Medium | Permissions | `app/onboarding.tsx` | **Onboarding omitted Appear on Top permission.** Added the overlay permission card and status/action wiring to `ForegroundLaunchModule`. | - [x] |
| NEW-032 | 🟡 Medium | Overlay Wallpaper | `src/components/OverlayAppearanceModal.tsx` · `BlockOverlayActivity.kt` · `AppBlockerAccessibilityService.kt` | **Android media picker could return `content://` URIs that native overlay code could not decode with `BitmapFactory.decodeFile`.** The picker no longer pre-requests legacy media access; native overlay paths now decode both `file://`/absolute paths and `content://` streams. | - [x] |
| NEW-033 | 🟡 Medium | Aversions | `BlockOverlayActivity.kt` · `AppBlockerAccessibilityService.kt` | **Aversion effects could continue after overlay dismissal/reveal.** Overlay dismiss and reveal paths now stop all active aversion effects. | - [x] |
| NEW-034 | 🟡 Medium | Daily Allowance | `src/components/StandaloneBlockModal.tsx` | **Standalone block modal only exposed count allowance controls.** Inline daily allowance configuration now supports count, time budget, and interval modes. Native enforcement already reads `daily_allowance_config`. | - [x] |

---

## 7. New Bugs — Low

> Code quality, technical debt, minor inconsistencies.

| ID | Severity | Area | File(s) | Issue | Done |
|----|----------|------|---------|-------|------|
| NEW-016 | 🟢 Low | Native | `android-native/.../services/ForegroundTaskService.kt:150` | **Stock action icon in notification action button.** `addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Focus", stopPending)` uses a deprecated system drawable. On Android 7+ notification action icons are not rendered in the shade anyway, but using stock `android.R.drawable` icons in published APKs violates Play Store guidelines. Replace with `0` (no icon) or a monochrome app-specific drawable. ✅ Replaced with `0`. | - [x] |
| NEW-017 | 🟢 Low | Notifications | `app/_layout.tsx:36-38` | **`shouldShowAlert` used in foreground notification handler.** `setNotificationHandler` returns `{ shouldShowAlert: false }` and `{ shouldShowAlert: true }`. `shouldShowAlert` was removed in `expo-notifications ~0.29+`; must be replaced with `shouldShowBanner` + `shouldShowList`. This is BUG-006 from AUDIT.md confirmed still present in the new entry point. ✅ Replaced with `shouldShowBanner` + `shouldShowList`. | - [x] |
| NEW-018 | 🟢 Low | Data | `src/data/database.ts:4-11` | **Module-level DB singleton has no reset path.** The `db` variable is set once and never cleared. If `openDatabaseAsync` throws and is caught upstream, subsequent calls still attempt to use the `null` reference. Add a `resetDb()` export for error recovery and app-restart scenarios. ✅ Added `resetDb()` export. | - [x] |
| NEW-019 | 🟢 Low | Logic | `src/services/focusService.ts:36` | **`appStateSubscription` not cleaned up on re-entry.** `startFocusMode` calls `await stopFocusMode()` if already active, which calls `appStateSubscription?.remove()`. However, if `stopFocusMode` short-circuits (e.g., `!focusActive`), the previous subscription leaks. Guard the subscription removal unconditionally before re-assigning. ✅ Subscription removed unconditionally at start of `startFocusMode`. | - [x] |
| NEW-020 | 🟢 Low | Navigation | `src/navigation/navigationRef.ts` · `app/_layout.tsx` | **`createNavigationContainerRef` never attached to Expo Router.** The ref is created with `@react-navigation/native` but Expo Router manages its own internal navigator — there is no `<NavigationContainer ref={...}>` to attach it to. `navigateToTask` will always return early because `navigationRef.isReady()` is always `false`. This is BUG-011 from AUDIT.md confirmed still present. | - [x] |
| NEW-021 | 🟢 Low | Performance | `src/context/AppContext.tsx:195-210` | **Tick `setInterval` restarts on every task or settings change.** The `useEffect` depends on `[state.isDbReady, state.tasks, state.settings]`. Any state update clears and re-creates the 30-second interval, resetting the countdown and causing timer jitter. Move the interval into a `useRef` that reads the latest state via a ref callback instead of closing over state directly. ✅ Interval now only depends on `state.isDbReady`; latest state read via `stateRef`. | - [x] |
| NEW-022 | 🟢 Low | Dead Deps | `package.json` | **Unused dependencies increase bundle size and APK weight.** `@tanstack/react-query`, `@workspace/api-client-react`, and `@react-native-async-storage/async-storage` are declared but not imported anywhere in `src/`. These are BUG-017 from AUDIT.md confirmed still present. Remove all three. | - [x] |
| NEW-023 | 🟢 Low | Native | `android-native/.../services/AppBlockerAccessibilityService.kt:135-146` | **Hand-rolled JSON array parser is fragile.** `parseJsonArray` splits on `,` and strips `"` characters. Package names with unusual characters or escaped quotes will parse incorrectly. Replace with `org.json.JSONArray(json).let { arr -> (0 until arr.length()).map { arr.getString(it) } }` which handles all valid JSON correctly. This is BUG-015 from AUDIT.md confirmed still present. ✅ Replaced with `org.json.JSONArray`. | - [x] |

---

## 8. AUDIT.md Re-assessment

> For each item in `AUDIT.md`, current status after deep codebase review.

| AUDIT ID | Original Issue | Status |
|----------|----------------|--------|
| BUG-001 | `expo` CLI missing — `pnpm install` not run | ⚠️ **Still open** — `expo` is in `devDependencies` but no evidence of install being run in the EAS build env without the `NPM_CONFIG_NODE_LINKER=hoisted` env var set in `eas.json`. `eas.json` now sets it correctly; risk reduced but not eliminated until a successful EAS build confirms it. |
| BUG-002 | SDK 54 core with SDK 55 plugin packages | ✅ **Closed — reassessed.** All five packages confirmed working at their installed versions with expo 54.0.33. No downgrade performed or required. See SDK-001–005 and NEW-004 for full detail. |
| BUG-003 | `newArchEnabled: true` with Old-Arch Kotlin modules | ⚠️ **Still open** — confirmed as NEW-002. `app.json` still has `newArchEnabled: true`. All 6 Kotlin modules still use `ReactContextBaseJavaModule`. |
| BUG-004 | Package name mismatch (`com.tbtechs.focusflow` vs `com.tbtechs.focusday`) | ✅ **Resolved** — all Kotlin files use `package com.tbtechs.focusflow`; `withFocusDayAndroid.js` copies from `android-native/app/src/main/java/com/tbtechs/focusflow`; `app.json` `android.package` is `com.tbtechs.focusflow`. Names are consistent. |
| BUG-005 | Plugin hardcodes `com/tbtechs/focusday` path | ✅ **Resolved** — `withFocusDayAndroid.js` line 224 now uses `com/tbtechs/focusflow` hardcoded. While still hardcoded (not derived from config), the value now matches `app.json`. Deriving from config dynamically is still recommended (LOW priority). |
| BUG-006 | `shouldShowAlert` removed in SDK 55 | ⚠️ **Still open** — `app/_layout.tsx` lines 36 and 38 still use `shouldShowAlert`. Confirmed as NEW-017. |
| BUG-007 | `App.tsx` / `AppNavigator.tsx` still in bundle; `src/screens/` missing | ✅ **Resolved** — no `App.tsx` or `src/screens/` directory found in the codebase. Expo Router's `app/_layout.tsx` is the sole entry point. |
| BUG-008 | Double DB insert on `startFocusMode` | ⚠️ **Partially resolved / needs test** — `focusService.startFocusMode` calls `dbStartFocusSession` (line 49). `AppContext.startFocusMode` does not call `dbStartFocusSession` directly; it creates a session object in memory only (lines 317-323). The double-write risk is reduced: only `focusService` writes to `focus_sessions`. Needs verification that `AppContext` never calls `dbStartFocusSession` independently. |
| BUG-009 | `dbRecordDayCompletion` called inside `useMemo` | ⚠️ **Still open** — confirmed as CONN-005. |
| BUG-010 | `com.tbtechs.focusday` hardcoded as self-exclusion | ✅ **Resolved** — `focusService.ts` line 140 now uses `'com.tbtechs.focusflow'` which matches `app.json`. |
| BUG-011 | `navigationRef` never attached to Expo Router container | ⚠️ **Still open** — confirmed as NEW-020. |
| BUG-012 | `TaskDetailModal` defined inline in screen file | ⚠️ **Still open** — not extracted to a separate component file. |
| BUG-013 | `allowedInFocus` list is read-only in settings screen | ⚠️ **Still open** — confirmed as NEW-014. |
| BUG-014 | Race condition between AccessibilityService and JS polling | ⚠️ **Still open** — confirmed as CONN-002. Both mechanisms run in parallel. |
| BUG-015 | Hand-rolled JSON array parser in `AppBlockerAccessibilityService` | ⚠️ **Still open** — confirmed as NEW-023. |
| BUG-016 | `updateNotification` stops/restarts service instead of updating in-place | ✅ **Resolved** — `ForegroundTaskService.kt` `updateNotification` (line 155-159) now calls `nm.notify(NOTIFICATION_ID, notification)` directly without stopping/restarting the service. |
| BUG-017 | Unused dependencies (`@tanstack/react-query`, `async-storage`, `api-client-react`) | ⚠️ **Still open** — confirmed as NEW-022. All three remain in `package.json`. |
| BUG-018 | UX: no "Stop Focus" button on schedule screen | ⚠️ **Still open** — not addressed. |
| BUG-019 | `setInterval` restarts on every task/settings change | ⚠️ **Still open** — confirmed as NEW-021. Dependency array still includes `state.tasks` and `state.settings`. |
| BUG-020 | Settings screen flickers on launch (renders defaults before DB loads) | ⚠️ **Still open** — not addressed. |
| BUG-021 | Native modules re-imported on every polling tick | ✅ **Acceptable / low risk** — `focusService.ts` `startAndroidUsageMonitor` uses dynamic `await import(...)` inside the interval (lines 131, 143). Module caching means the resolved module is returned immediately after the first call. Not a meaningful re-import cost. |
| BUG-022 | `pulseAnim` not reset on active task change | ⚠️ **Still open** — not addressed. |
| BUG-023 | `FocusDayBridgeModule` not registered in `FocusDayPackage` | ✅ **Resolved** — `FocusDayPackage.kt` line 28 confirms `FocusDayBridgeModule(reactContext)` is registered. The JS-side counterpart (`EventBridge`) also exists and calls `NativeModules.FocusDayBridge`. |
| BUG-024 | `BootReceiver` not declared in `AndroidManifest.xml` | ✅ **Resolved** — `withFocusDayAndroid.js` lines 191-209 inject the `BootReceiver` receiver entry (with `BOOT_COMPLETED` and `QUICKBOOT_POWERON` intent filters) into the manifest during `expo prebuild`. |
