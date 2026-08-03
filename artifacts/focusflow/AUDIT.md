# FocusFlow — Audit Tracker

> Updated after every individual fix. One tick per resolved issue.

| ID | Severity | Area | File(s) | Issue | Done |
|----|----------|------|---------|-------|------|
| BUG-001 | 🔴 Critical | Build | `artifacts/focusflow/package.json` | `expo` CLI missing — `pnpm install` not run in focusflow workspace | - [ ] |
| BUG-002 | 🔴 Critical | Build | `artifacts/focusflow/package.json` | Expo SDK 54 core with SDK 55 plugin packages (`expo-background-fetch`, `expo-build-properties`, `expo-notifications`, `expo-sqlite`, `expo-task-manager`) | - [ ] |
| BUG-003 | 🔴 Critical | Build | `artifacts/focusflow/app.json` line 10 | `newArchEnabled: true` but all custom Kotlin modules are Old-Arch — crashes the native bridge on launch | - [ ] |
| BUG-004 | 🔴 Critical | Build | `artifacts/focusflow/app.json` · `plugins/withFocusDayAndroid.js` · all Kotlin files | Package name mismatch: `app.json` uses `com.tbtechs.focusflow`, plugin and Kotlin use `com.tbtechs.focusday` | - [ ] |
| BUG-005 | 🔴 Critical | Build | `plugins/withFocusDayAndroid.js` | Plugin hardcodes `com/tbtechs/focusday` path instead of deriving from `config.android.package` | - [ ] |
| BUG-006 | 🔴 Critical | Notifications | `App.tsx` · `app/_layout.tsx` | `shouldShowAlert` removed in SDK 55 — must be replaced with `shouldShowBanner` + `shouldShowList` | - [ ] |
| BUG-007 | 🔴 Critical | Dead Code | `App.tsx` · `src/navigation/AppNavigator.tsx` | Both files superseded by Expo Router but still in the bundle; `AppNavigator` imports `src/screens/` which does not exist — Metro `Module not found` | - [ ] |
| BUG-008 | 🟠 High | Logic | `src/context/AppContext.tsx` lines 316-322 · `src/services/focusService.ts` lines 52-59 | Double DB insert — both `AppContext.startFocusMode` and `focusService._startFocusMode` write to `focus_sessions` on every session start | - [ ] |
| BUG-009 | 🟠 High | Logic | `app/(tabs)/stats.tsx` line 66 | `dbRecordDayCompletion` called inside `useMemo` — side effect in a pure hook, fires multiple times per render cycle | - [ ] |
| BUG-010 | 🟠 High | Logic | `src/services/focusService.ts` line 150 | `com.tbtechs.focusday` hardcoded as self-exclusion package — app blocks itself if package name doesn't match | - [ ] |
| BUG-011 | 🟠 High | Navigation | `src/navigation/navigationRef.ts` · `app/_layout.tsx` line 62 | `createNavigationContainerRef()` never attached to Expo Router's container — `navigateToTask()` silently no-ops, notification taps do nothing | - [x] |
| BUG-012 | 🟠 High | UI | `app/(tabs)/index.tsx` | `TaskDetailModal` defined inline inside the screen file — should be extracted to `src/components/TaskDetailModal.tsx` | - [x] |
| BUG-013 | 🟠 High | Feature | `app/(tabs)/settings.tsx` | `allowedInFocus` list has state and labels but no `TextInput` — list is read-only, user cannot add/remove entries | - [ ] |
| BUG-014 | 🟡 Medium | Logic | `AppBlockerAccessibilityService.kt` · `src/services/focusService.ts` | Both native AccessibilityService and JS polling loop call bring-to-front simultaneously — race condition on app intercept | - [ ] |
| BUG-015 | 🟡 Medium | Native | `AppBlockerAccessibilityService.kt` | Hand-rolled JSON array parser (split by comma, trim quotes) — brittle with unusual package names; replace with `org.json.JSONArray` | - [ ] |
| BUG-016 | 🟡 Medium | Native | `ForegroundTaskService.kt` | `updateNotification` stops and restarts the foreground service instead of updating the notification in-place | - [ ] |
| BUG-017 | 🟡 Medium | Dead Deps | `artifacts/focusflow/package.json` | `@tanstack/react-query`, `@workspace/api-client-react`, `@react-native-async-storage/async-storage` installed but unused in the entire `src/` tree | - [x] |
| BUG-018 | 🟡 Medium | UX | `app/(tabs)/index.tsx` | No "Stop Focus" button on the Schedule screen — focus auto-stops when task ends or timer expires (by design) | - [x] |
| BUG-019 | 🟡 Medium | Performance | `src/context/AppContext.tsx` | `setInterval` inside `useEffect` restarts on every task/settings change — causes scheduler timing jitter | - [x] |
| BUG-020 | 🟡 Medium | UX | `app/(tabs)/settings.tsx` | Settings screen renders `defaultSettings` before DB finishes loading — causes visible flicker on every launch | - [x] |
| BUG-021 | 🟢 Low | Code Quality | `src/services/focusService.ts` | `UsageStatsModule` and `ForegroundLaunchModule` re-imported on every polling tick inside `setInterval` instead of at module level | - [x] |
| BUG-022 | 🟢 Low | Code Quality | `app/(tabs)/focus.tsx` | `pulseAnim` not reset when active task changes while focus is already running | - [x] |
| BUG-023 | 🟢 Low | Kotlin Integration | `modules/FocusDayBridgeModule.kt` · `modules/FocusDayPackage.kt` | `FocusDayBridgeModule` exists but is not registered in `FocusDayPackage` and has no JS bridge counterpart — dead Kotlin code | - [ ] |
| BUG-024 | 🟢 Low | Kotlin Integration | `services/BootReceiver.kt` · `AndroidManifest.xml` | `BootReceiver` handles `BOOT_COMPLETED` to restart the foreground service after reboot but is never declared in the manifest — never fires | - [ ] |
