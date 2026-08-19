[![Build Debug APK](https://github.com/TITANICBHAI/focusflow-expo/actions/workflows/build-debug.yml/badge.svg)](https://github.com/TITANICBHAI/focusflow-expo/actions/workflows/build-debug.yml) [![pages-build-deployment](https://github.com/TITANICBHAI/focusflow-expo/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/TITANICBHAI/focusflow-expo/actions/workflows/pages/pages-build-deployment)
[![Build Production (APK + AAB)](https://github.com/TITANICBHAI/focusflow-expo/actions/workflows/build-release.yml/badge.svg)](https://github.com/TITANICBHAI/focusflow-expo/actions/workflows/build-release.yml)
# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

---

## FocusFlow — Android Productivity App

`artifacts/focusflow` — Expo (React Native) Android app combining intelligent task scheduling with OS-level app blocking via custom Kotlin native services.

### Architecture

- **JS layer (control plane)** — writes config to SharedPreferences, displays UI, manages app state (AppContext).
- **Kotlin layer (execution plane)** — owns timing, enforcement, and recovery. Never relies on JS being alive.

### Native Services

| Service | Purpose |
|---|---|
| `ForegroundTaskService.kt` | Always-running foreground service. IDLE mode: quiet persistent notification. ACTIVE mode: task countdown + blocking. Never stopped — goes IDLE instead. |
| `AppBlockerAccessibilityService.kt` | Intercepts every window-change event. Enforces both task-based AND standalone block lists independently. Self-heals stale SharedPrefs flags when timestamps pass. |
| `BootReceiver.kt` | Restarts `ForegroundTaskService` on reboot — in ACTIVE mode if a task session was running, IDLE mode otherwise (always-on). |

### Block Overlay Strategy (Two-path)

1. **WindowManager overlay** (preferred when SYSTEM_ALERT_WINDOW / "Appear on Top" is granted):  
   `AppBlockerAccessibilityService.showWindowOverlay()` draws a `TYPE_APPLICATION_OVERLAY` FrameLayout directly over the blocked app via `WindowManager.addView()`. No task switch — the blocked app is never visible. X button is hidden (`alpha=0`) until the accessibility service detects the user has navigated home (`revealWindowXButton()` fades it in via ValueAnimator). X button tap clears `block_cooldown_reset` → cooldown resets so the same app re-triggers immediately if re-opened.

2. **Full-screen notification fallback** (when overlay permission is not granted):  
   A `PendingIntent` wrapped in a full-screen `Notification` (channel `focusday_block_alert`, id 9001) launches `BlockOverlayActivity`. The system (not the app) fires the intent, bypassing Android 10+ background activity launch restrictions. Auto-cancelled after 2 s. `BlockOverlayActivity` polls `overlay_x_ready` SharedPrefs key at 300 ms to reveal its X button once the home signal fires.

### SharedPreferences Schema (`focusday_prefs`)

| Key | Type | Purpose |
|---|---|---|
| `focus_active` | Boolean | Task focus session is active |
| `task_name` | String | Current task display name |
| `task_end_ms` | Long | Task session end epoch ms |
| `next_task_name` | String? | Next task name for notification sub-text |
| `allowed_packages` | String (JSON array) | Apps allowed during task focus (NOT StringSet — reference bug) |
| `standalone_block_active` | Boolean | Standalone (no-task) block is enabled |
| `standalone_blocked_packages` | String (JSON array) | Apps always blocked until expiry |
| `standalone_block_until_ms` | Long | Standalone block expiry epoch ms |
| `daily_allowance_packages` | String (JSON array) | Apps with once-per-day bypass |
| `daily_allowance_config` | String (JSON array) | Rich per-app allowance mode config: count, time budget, interval |
| `daily_allowance_used` | String (JSON object) | Tracks daily allowance usage dates |
| `blocked_words` | String (JSON array) | Words that trigger home redirect when detected on screen |
| `block_overlay_wallpaper` | String | Custom overlay wallpaper path or `content://` URI |
| `pending_notif_action` | String | Notification button action pending replay on app resume |
| `pending_notif_task_id` | String | Task ID for pending notification action |
| `pending_notif_minutes` | Int | Minutes value for pending extend action |
| `pending_notif_time_ms` | Long | Timestamp when the pending action was created |

### Blocking Logic (Collision Handling)

When both task-based focus and standalone block are active simultaneously, enforcement is **additive (union)**:
- Task focus: blocks every app NOT in `allowed_packages`
- Standalone block: blocks every app IN `standalone_blocked_packages`
- Both are checked independently — the more restrictive rule wins for each app

### Key JS Files

| File | Purpose |
|---|---|
| `src/context/AppContext.tsx` | Global state, `setStandaloneBlock()`, starts idle service on init |
| `src/services/focusService.ts` | Starts/stops task focus. Calls `goHome()` after activation. |
| `src/components/AllowedAppsModal.tsx` | Picker for allowed apps (task focus) |
| `src/components/StandaloneBlockModal.tsx` | Picker for blocked apps + date/time expiry (standalone) |
| `app/(tabs)/settings.tsx` | Settings screen including Block Schedule section |
| `app/privacy-policy.tsx` | First-launch privacy notice shown before onboarding |

### Current Behavior Notes

- First launch shows the privacy policy before onboarding; acceptance is stored in local settings as `privacyAccepted`.
- Onboarding includes Appear on Top permission so users can enable the preferred WindowManager overlay path early.
- Custom block overlay wallpapers can be stored as local file paths or Android `content://` URIs; native overlays decode both.
- Dismissing or revealing the block overlay stops active aversion effects so vibration/dim/sound do not continue after the overlay is dismissed.
- Standalone block daily allowances support count, daily time budget, and interval modes from the block modal; native enforcement reads `daily_allowance_config`.

### Deferred Feature: Full-screen Lock Overlay

**Idea:** When "Activate Focus" is tapped, instead of just going to the home screen, a full-screen lock UI appears over the home screen showing the active task name and a live countdown timer. The overlay is non-dismissable during the focus session (Back is intercepted) and auto-dismisses when the session ends.

**Implementation plan (NOT yet implemented):**

1. **New `FocusLockActivity`** — a dedicated Kotlin `Activity` with `Theme.Black.NoTitleBar.Fullscreen`. It reads task name + end time from SharedPreferences and shows a live countdown. Back button is intercepted and no-ops.

2. **Launch mechanism** — two options:
   - `USE_FULL_SCREEN_INTENT` permission on the `ForegroundTaskService` notification (no SYSTEM_ALERT_WINDOW needed, works on API < 34 without user grant). The notification's `setFullScreenIntent()` launches `FocusLockActivity`.
   - OR: `SYSTEM_ALERT_WINDOW` (Draw over other apps) — a `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` view. More powerful but requires explicit user grant on API ≥ 23.

3. **Manifest registration** — add `FocusLockActivity` to `withFocusDayAndroid.js` config plugin (careful: this file is delicate, test after any touch). Add `USE_FULL_SCREEN_INTENT` permission if using option A.

4. **Dismiss trigger** — `ForegroundTaskService` fires a local broadcast (e.g. `com.tbtechs.focusflow.FOCUS_ENDED`) that `FocusLockActivity` listens for and uses to `finish()` itself.

5. **JS stub already exists** — `ForegroundLaunchModule.showOverlay(message)` is a placeholder that currently calls `bringToFront()`. Wire it to launch `FocusLockActivity` instead.

---

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Mobile framework**: Expo (React Native)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── focusflow/          # Expo (React Native) Android app
│   └── mockup-sandbox/     # Vite dev server for canvas UI prototyping
├── lib/
│   └── db/                 # Drizzle ORM schema (unused, retained for future use)
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Packages

### `artifacts/focusflow` (`@workspace/focusflow`)

The main FocusFlow Android app. All persistence is local SQLite via expo-sqlite. No backend server.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`.

## 📜 License
This project is licensed under the CC BY-NC-SA 4.0.

Non-Commercial: You may not use this material for commercial purposes.

ShareAlike: If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

Attribution: You must give appropriate credit to TITANICBHAI (TBTechs).
