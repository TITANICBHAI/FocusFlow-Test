# FocusFlow — Full React Native → Pure Kotlin/Jetpack Compose Migration Guide

> **Purpose:** Complete, self-contained reference for migrating FocusFlow from React Native (Expo 54 / RN 0.81) to a fully native Android app in Kotlin + Jetpack Compose. Any agent or developer reading this document has everything needed to execute the migration without any other context.
>
> **Track progress:** Each section has checkboxes. Check them off as work is completed.

---

## Table of Contents
1. [What the App Does](#1-what-the-app-does)
2. [Current Architecture Overview](#2-current-architecture-overview)
3. [What Already Exists in Kotlin](#3-what-already-exists-in-kotlin)
4. [Design System & Tokens](#4-design-system--tokens)
5. [Screens & Navigation Map](#5-screens--navigation-map)
6. [UI Components Catalogue](#6-ui-components-catalogue)
7. [State Management & Data Flow](#7-state-management--data-flow)
8. [Database Schema](#8-database-schema)
9. [Native Modules → Kotlin Equivalents](#9-native-modules--kotlin-equivalents)
10. [JS Dependency → Kotlin/Android Equivalent Map](#10-js-dependency--kotlinandroid-equivalent-map)
11. [Android Permissions (All Required)](#11-android-permissions-all-required)
12. [Migration Task Checklist](#12-migration-task-checklist)
13. [New Project Structure](#13-new-project-structure)
14. [Build & CI Configuration](#14-build--ci-configuration)
15. [Key Risks & Gotchas](#15-key-risks--gotchas)

---

## 1. What the App Does

FocusFlow is a **deep-work enforcement app** for Android. It schedules tasks, enforces focus sessions, and physically blocks distracting apps using Android system-level APIs. Key points:

- Users schedule tasks with titles, durations, priorities, and tags
- During a "Focus Session", distracting apps are blocked at the system level
- An Accessibility Service monitors foreground app and redirects to Home if a blocked app is opened
- A null-routing VPN optionally cuts network access for blocked apps
- A persistent Foreground Service shows a countdown notification with Done/Extend/Skip buttons
- A Home Screen Widget shows active session status
- Detailed statistics track "temptation" events (how many times user tried to open blocked apps)
- Aversive deterrents (screen dimmer, vibration, sound) punish attempts to open blocked apps

**Package name:** `com.tbtechs.focusflow`
**Min SDK:** 26 (Android 8) | **Target SDK:** 35 | **Compile SDK:** 35
**Primary color:** `#6366f1` (Indigo)
**Font:** Inter (Google Fonts)

---

## 2. Current Architecture Overview

```
React Native (JS/TSX)          Kotlin (Native Android)
─────────────────────          ───────────────────────
Expo Router (navigation)       AppBlockerAccessibilityService
AppContext (useReducer)    ←→  ForegroundTaskService
SQLite via expo-sqlite         NetworkBlockerVpnService
focusService.ts                BlockOverlayActivity
schedulerEngine.ts             FocusFlowWidget
eventBridge.ts                 BootReceiver / NotificationActionReceiver
NativeModules bridge           SharedPreferences (source of truth for native)
UI in React components         AversiveActionsManager / WakeLockManager
```

**Key insight:** The enforcement layer (Accessibility, VPN, Widget, Overlay) is **already in Kotlin**. The migration is primarily about replacing the React Native UI layer and data layer (expo-sqlite, AppContext) with Jetpack Compose + ViewModel + Room.

---

## 3. What Already Exists in Kotlin

These files are in `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/` and need to be **kept as-is** or adapted to remove the React Native bridge:

### Services (keep, remove RN bridge calls)
| File | Purpose | Migration Action |
|---|---|---|
| `AppBlockerAccessibilityService.kt` | Core blocker — monitors window events, enforces allow/block lists | Keep; reads SharedPrefs directly, no change needed |
| `ForegroundTaskService.kt` | Persistent countdown notification, fallback UsageStats poller | Keep; replace JS event emissions with direct ViewModel calls |
| `NetworkBlockerVpnService.kt` | Null-routing VPN for network blocking | Keep entirely |
| `BootReceiver.kt` | Restarts services after reboot | Keep entirely |
| `NotificationActionReceiver.kt` | Handles Done/Extend/Skip taps from notification | Keep; replace JS bridge event with direct Room DB update |
| `FocusDayDeviceAdminReceiver.kt` | Prevents force-stop during sessions | Keep entirely |
| `WakeLockManager.kt` | Holds CPU wake lock during focus | Keep entirely |
| `AversiveActionsManager.kt` | Dimmer, vibration, sound deterrents | Keep entirely |
| `TemptationLogManager.kt` | Logs blocked-app attempts, weekly report | Keep; write directly to Room DB instead of SharedPrefs JSON |
| `TemptationReportReceiver.kt` | Weekly Sunday 08:00 alarm receiver | Keep entirely |

### UI (keep, minor changes)
| File | Purpose | Migration Action |
|---|---|---|
| `BlockOverlayActivity.kt` | Full-screen un-dismissible blocked app overlay | Keep; wire quote/wallpaper from Room DB instead of SharedPrefs |
| `FocusFlowWidget.kt` | Home screen widget | Keep; update data source to Room DB |

### Modules (DELETE — no longer needed after migration)
All files in `modules/` and `FocusDayPackage.kt` are React Native bridge modules. After migration, delete:
- `FocusDayBridgeModule.kt`, `AversionsModule.kt`, `ForegroundServiceModule.kt`
- `NetworkBlockModule.kt`, `UsageStatsModule.kt`, `SharedPrefsModule.kt`
- `InstalledAppsModule.kt`, `BlockOverlayModule.kt`, `NuclearModeModule.kt`
- `ForegroundLaunchModule.kt`, `NativeImagePickerModule.kt`, `GreyoutModule.kt`
- `FocusDayPackage.kt`

---

## 4. Design System & Tokens

Replicate these exactly in Compose using `MaterialTheme` and a custom `AppTheme`.

### Colors
```kotlin
// Light theme
val Primary = Color(0xFF6366F1)       // Indigo — main brand color
val PrimaryLight = Color(0xFFE0E7FF)  // Light indigo — backgrounds, chips
val Orange = Color(0xFFF59E0B)        // Warning / medium priority
val Green = Color(0xFF10B981)         // Success / complete
val Red = Color(0xFFEF4444)           // Error / high priority / blocked
val Blue = Color(0xFF3B82F6)          // Info / low priority
val Purple = Color(0xFF8B5CF6)        // Critical priority / accent

// Light text/surfaces
val TextPrimary = Color(0xFF1E1B4B)
val TextSecondary = Color(0xFF6B7280)
val TextMuted = Color(0xFF9CA3AF)
val CardBg = Color(0xFFFFFFFF)
val Surface = Color(0xFFF5F5F5)
val Background = Color(0xFFF0F2FF)
val Border = Color(0xFFE5E7EB)

// Dark theme
val DarkText = Color(0xFFF3F4F6)
val DarkCard = Color(0xFF1F2937)
val DarkSurface = Color(0xFF374151)
val DarkBackground = Color(0xFF111827)
val DarkBorder = Color(0xFF374151)
```

### Typography — Inter Font
Load Inter from `res/font/`. Scale in sp:
```
xs=11sp, sm=13sp, md=15sp, lg=18sp, xl=22sp, xxl=28sp
```

### Shape / Radius
```
sm=6dp, md=10dp, lg=16dp, xl=24dp, full=999dp (pill)
```

### Spacing
```
xs=4dp, sm=8dp, md=12dp, lg=16dp, xl=24dp, xxl=32dp
```

### Priority → Color mapping
| Priority | Color |
|---|---|
| `critical` | Purple `#8B5CF6` |
| `high` | Red `#EF4444` |
| `medium` | Orange `#F59E0B` |
| `low` | Blue `#3B82F6` |

---

## 5. Screens & Navigation Map

### Navigation Graph (Jetpack Navigation Component)
```
NavHost
├── privacyPolicy          (shown first launch, before onboarding)
├── onboarding             (permission walkthrough)
├── main (BottomNav)
│   ├── schedule           (Tab 1 — Home)
│   ├── focus              (Tab 2)
│   ├── stats              (Tab 3)
│   └── settings           (Tab 4)
└── permissions            (accessible from Settings)
```

### Tab Bar
4 tabs with icons (use Material Icons):
- Schedule → `Icons.Default.DateRange`
- Focus → `Icons.Default.Timer`
- Stats → `Icons.Default.BarChart`
- Settings → `Icons.Default.Settings`

Dark mode toggle floats in the top-right on all 4 tab screens (custom animated sun/moon switch).

---

### Screen 1: Privacy Policy (`privacyPolicy`)
- **File to create:** `ui/screen/PrivacyPolicyScreen.kt`
- **Shows:** Scrollable text explaining local-first storage, accessibility permission usage, no personal data collection
- **Action:** Single "Accept & Continue" button → navigates to `onboarding`

---

### Screen 2: Onboarding (`onboarding`)
- **File to create:** `ui/screen/OnboardingScreen.kt`
- **Shows:** 6 expandable permission cards. Each card has icon, title, description of why needed, and a button to grant:

| Card | Permission | Android API |
|---|---|---|
| Media | `READ_MEDIA_IMAGES` | `ActivityResultContracts.RequestPermission` |
| Notifications | `POST_NOTIFICATIONS` | `ActivityResultContracts.RequestPermission` |
| Battery | `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | `Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)` |
| Appear on Top | `SYSTEM_ALERT_WINDOW` | `Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)` |
| Usage Access | `PACKAGE_USAGE_STATS` | `Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)` |
| Accessibility | `BIND_ACCESSIBILITY_SERVICE` | `Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)` |

- **Navigation:** "All Done" button → `main` graph (schedule tab)
- **State:** Check permission status on resume with `onResume` / `LaunchedEffect(lifecycleOwner)`

---

### Screen 3: Schedule Tab (`schedule`) — HOME
- **File to create:** `ui/screen/ScheduleScreen.kt`
- **Shows:**
  - Toggle between List View and Timeline View (segmented control at top)
  - **Active Task Banner** (if a task is currently running): task name, progress bar, quick-action buttons (Complete, Extend, Start Focus)
  - **List View:** `LazyColumn` of `TaskCard` composables grouped by time
  - **Timeline View:** Custom `Canvas`-drawn vertical timeline 6 AM–11 PM, task blocks sized proportional to duration
  - **FAB** (bottom-right, indigo, `+` icon): opens `QuickAddModal` bottom sheet
- **Long press on task:** opens `EditTaskModal`
- **Tap on task:** opens `TaskDetailModal` bottom sheet
- **Empty state:** Illustration + "No tasks today. Tap + to add one."

---

### Screen 4: Focus Tab (`focus`)
- **File to create:** `ui/screen/FocusScreen.kt`
- **Shows (active session):**
  - Large animated pulsing rings (3 concentric, opacity-animated at different speeds)
  - Countdown timer in center (HH:MM:SS), turns red when overdue
  - Task name and priority badge below timer
  - Allowed apps row (small icons)
  - Button row: "Stop Focus", "Extend +15m", "Emergency Override"
  - "Emergency Override" opens a confirmation dialog then logs a `focus_override` record
- **Shows (no active session):**
  - "No Active Task" illustration
  - "Start Standalone Block" button → `StandaloneBlockModal` bottom sheet

---

### Screen 5: Stats Tab (`stats`)
- **File to create:** `ui/screen/StatsScreen.kt`
- **Toggle:** Today / This Week (segmented control)
- **Today view:**
  - Ring chart: completion rate (completed tasks / total tasks)
  - Stat cards: Focus Minutes, Tasks Completed, Tasks Skipped
  - Priority breakdown: count per priority level
  - Top tags (most used tags in completed tasks)
- **This Week view:**
  - "Clean Streak" counter (consecutive days with 0 blocked-app attempts)
  - Temptation Log: list of apps user tried to open while blocked (package name + icon + count)
  - 7-day bar chart (Mon–Sun): blocked attempt count per day
  - "Weekly Report" button → `WeeklyReportModal`

---

### Screen 6: Settings Tab (`settings`)
- **File to create:** `ui/screen/SettingsScreen.kt`
- **Grouped sections:**

| Section | Controls |
|---|---|
| Notifications | Toggle: focus start/end alerts, daily summary |
| Scheduling | Default task duration (chip selector: 30m / 1h / 2h), auto-skip low-priority on overrun |
| Focus Mode | Toggle: auto-enable focus when task starts; "Allowed Apps" → `AllowedAppsModal` |
| Aversion Deterrents | Toggle: Dimmer, Vibration, Sound; intensity sliders |
| Daily App Allowances | Open `DailyAllowanceModal` |
| Word Blocking | Open `BlockedWordsModal` |
| Greyout Schedules | Open `GreyoutScheduleModal` |
| Overlay Appearance | Open `OverlayAppearanceModal` |
| Permissions | Button → `permissions` screen |
| Danger Zone | "Clear All Tasks" button (confirmation dialog) |

---

### Screen 7: Permissions Manager (`permissions`)
- **File to create:** `ui/screen/PermissionsScreen.kt`
- Same permission cards as Onboarding, but:
  - **Locked state:** If a focus session or standalone block is active, show a lock banner and disable all "Revoke" actions. This prevents bypassing blocks by turning off Accessibility.
  - Has a "Troubleshoot" button for OEM-specific issues (Samsung/Xiaomi) → `TroubleshootModal`

---

## 6. UI Components Catalogue

Each composable listed here is a 1:1 replacement for its React Native counterpart.

### [ ] TaskCard Composable
**File:** `ui/component/TaskCard.kt`
- Surface with `RoundedCornerShape(md=10dp)`
- Left colored border (4dp) using priority color
- Row: priority badge (colored chip) + task title (lg, bold) + time range
- If active: animated linear progress bar (Indigo), live countdown via `ViewModel`
- Tags: horizontal `FlowRow` of small chips
- Action icons: ✓ Complete, ⏭ Skip, ⏱ Extend, 🎯 Start Focus (shown on swipe or expand)
- **Data:** `Task` entity from Room DB

### [ ] TaskDetailModal (Bottom Sheet)
**File:** `ui/component/TaskDetailSheet.kt`
- `ModalBottomSheet` with full task details
- Sections: title (xl), time range, priority badge, description (if any), tags
- Action buttons at bottom: Complete, Skip, Extend, Start Focus, Edit

### [ ] QuickAddModal (Bottom Sheet)
**File:** `ui/component/QuickAddSheet.kt`
- `ModalBottomSheet`
- Text field with "Quick Parse" (NLP: "Gym at 3pm for 1h" → parses title/time/duration)
- Time picker (`TimePickerDialog`)
- Duration chips: 15m / 30m / 45m / 1h / 2h / Custom
- Priority selector: 4 colored chips (Low / Medium / High / Critical)
- Toggle: "Enable Focus Mode for this task"
- Save / Cancel buttons

### [ ] EditTaskModal
**File:** `ui/component/EditTaskSheet.kt`
- Same fields as QuickAddModal but pre-populated
- Additional: tag input field (chips with ×), notes/description textarea

### [ ] TimelineView
**File:** `ui/component/TimelineView.kt`
- Custom `Canvas` composable
- Vertical axis: 6 AM to 11 PM (hour labels every 60min)
- Task blocks: absolute-positioned `Box` composables, height = duration in minutes, color = priority
- Current time indicator: red horizontal line with dot
- Scrollable via `LazyColumn` or `Column` in `verticalScroll`

### [ ] BlockedAppOverlay (Activity, already Kotlin)
- Keep `BlockOverlayActivity.kt`
- Update: reads quote and wallpaper from Room DB instead of SharedPrefs

### [ ] AppPickerSheet (Bottom Sheet)
**File:** `ui/component/AppPickerSheet.kt`
- Full-screen `ModalBottomSheet`
- Search bar at top
- `LazyColumn` of installed apps (icon + name + package)
- Multi-select with checkboxes
- "Select All / None" row
- Preset management: save current selection as a named preset, load/delete presets
- Done button returns selected package names
- **Data source:** `InstalledAppsRepository` wrapping `PackageManager` (replaces `InstalledAppsModule`)

### [ ] AllowedAppsModal
**File:** `ui/component/AllowedAppsSheet.kt`
- Wrapper around `AppPickerSheet` for allowed apps during focus sessions

### [ ] DailyAllowanceModal
**File:** `ui/component/DailyAllowanceSheet.kt`
- List of apps with per-app limit config
- For each app: expandable row with 3 limit types:
  - **Count** (X opens per day)
  - **Time Budget** (X minutes per day)
  - **Interval** (X minutes must pass between opens)

### [ ] BlockedWordsModal
**File:** `ui/component/BlockedWordsSheet.kt`
- `ModalBottomSheet`
- Text input + "Add" button
- `LazyColumn` of added keywords, each with a × delete button

### [ ] GreyoutScheduleModal
**File:** `ui/component/GreyoutScheduleSheet.kt`
- List of scheduled block windows
- Each window: days of week (checkboxes Mon–Sun), start time, end time
- Add/edit/delete windows
- Uses `TimePickerDialog` for time selection

### [ ] StandaloneBlockModal
**File:** `ui/component/StandaloneBlockSheet.kt`
- App picker (using `AppPickerSheet`)
- Date/time picker for "block until" expiry
- Manual package name input option
- Activate / Cancel buttons

### [ ] WeeklyReportModal
**File:** `ui/component/WeeklyReportSheet.kt`
- Summary cards: total focus minutes, completion rate, clean streak
- 7-day bar chart (Compose `Canvas` — draw bars proportional to blocked-attempt counts)
- "Most Tempting Apps" list (app icon + name + attempt count)

### [ ] OverlayAppearanceModal
**File:** `ui/component/OverlayAppearanceSheet.kt`
- Image picker to set custom wallpaper (use `ActivityResultContracts.PickVisualMedia`)
- Quotes list: add/edit/delete custom blocking quotes
- Preview of the overlay

### [ ] DarkModeToggle
**File:** `ui/component/DarkModeToggle.kt`
- Custom `Box` composable with animated knob
- Animated track color: Indigo (dark) ↔ Yellow (light)
- Sun icon (light), Moon + stars icons (dark)
- Controlled by `SettingsViewModel` → persisted in Room `settings` table

### [ ] TroubleshootModal
**File:** `ui/component/TroubleshootSheet.kt`
- OEM-specific deep-link cards:
  - Samsung: "AutoStart" in Device Care settings
  - Xiaomi: MIUI "Autostart" permission
  - OnePlus: "Battery Optimization" whitelist
- Each card: description + "Open Settings" button (deep-link Intent)

---

## 7. State Management & Data Flow

### Replace: `AppContext` (useReducer) → ViewModels per screen

| React Native | Kotlin/Compose equivalent |
|---|---|
| `AppContext` + `useReducer` | `AppViewModel` (shared, `hiltViewModel()`) |
| `focusService.ts` | `FocusRepository` + `FocusManager.kt` |
| `schedulerEngine.ts` | `SchedulerEngine.kt` (pure Kotlin, same logic) |
| `eventBridge.ts` | `SharedFlow` / `StateFlow` in `AppViewModel` |
| `SharedPrefsModule` (bridge) | Direct `SharedPreferences` writes in repositories |
| `expo-sqlite` | Room Persistence Library |

### ViewModels to create
```
AppViewModel          — shared across all screens, holds focus session state
ScheduleViewModel     — task list, today's tasks, CRUD operations
FocusViewModel        — active session timer, overrides, stop/extend
StatsViewModel        — stats queries from Room, temptation log
SettingsViewModel     — settings CRUD, dark mode
OnboardingViewModel   — permission check states
```

### EventBridge replacement
The `eventBridge.ts` listens for Kotlin events (`APP_BLOCKED`, `TASK_ENDED`, `NOTIF_ACTION`). In pure Kotlin, replace with:
- `NotificationActionReceiver` → calls `FocusRepository.completeTask()` / `extendTask()` directly
- `AppBlockerAccessibilityService` → posts to `AppViewModel` via a `SharedFlow` (use a singleton `EventBus` object in the app module)
- `ForegroundTaskService` → updates Room DB directly for tick events

---

## 8. Database Schema

**Migrate from expo-sqlite → Room Database**
Database name: `focusflow.db`

### Table: `tasks`
```kotlin
@Entity
data class Task(
    @PrimaryKey val id: String,          // nanoid → UUID.randomUUID().toString()
    val title: String,
    val description: String?,
    val startTime: Long,                 // epoch millis
    val endTime: Long,                   // epoch millis
    val duration: Int,                   // minutes
    val priority: String,               // "low" | "medium" | "high" | "critical"
    val tags: String,                    // JSON array string → use TypeConverter
    val status: String,                 // "pending" | "active" | "completed" | "skipped"
    val focusModeEnabled: Boolean,
    val allowedPackages: String,         // JSON array string
    val date: String,                    // "YYYY-MM-DD"
    val createdAt: Long,
    val completedAt: Long?
)
```

### Table: `settings`
```kotlin
@Entity
data class Settings(
    @PrimaryKey val key: String,
    val value: String                    // JSON-encoded values
)
// Keys: "notifications", "scheduling", "focusMode", "aversions",
//       "dailyAllowances", "blockedWords", "greyoutWindows",
//       "overlayAppearance", "darkMode"
```

### Table: `focus_sessions`
```kotlin
@Entity
data class FocusSession(
    @PrimaryKey val id: String,
    val taskId: String?,
    val startedAt: Long,
    val endedAt: Long?,
    val plannedEndAt: Long,
    val type: String                     // "task" | "standalone"
)
```

### Table: `focus_overrides`
```kotlin
@Entity
data class FocusOverride(
    @PrimaryKey val id: String,
    val sessionId: String,
    val triggeredAt: Long,
    val reason: String?
)
```

### Table: `temptation_log`
```kotlin
@Entity
data class TemptationEntry(
    @PrimaryKey val id: String,
    val packageName: String,
    val blockedAt: Long,
    val sessionId: String?
)
// Capped at 500 entries — enforce in DAO with delete oldest when count > 500
```

---

## 9. Native Modules → Kotlin Equivalents

These replace the React Native bridge modules entirely.

| Old Module | New Kotlin Implementation |
|---|---|
| `InstalledAppsModule` | `InstalledAppsRepository.kt` — calls `packageManager.getInstalledApplications(PackageManager.GET_META_DATA)`, loads icons with `Coil` |
| `UsageStatsModule` | `PermissionRepository.kt` — wraps `UsageStatsManager`, `AccessibilityManager`, `PowerManager` with direct API calls |
| `SharedPrefsModule` | Removed — all repos write SharedPrefs directly where native services read them |
| `ForegroundServiceModule` | `FocusRepository.kt` — calls `startForegroundService(Intent(...ForegroundTaskService))` |
| `NetworkBlockModule` | `NetworkBlockRepository.kt` — wraps `VpnService.prepare()` and starts `NetworkBlockerVpnService` |
| `AversionsModule` | `AversionsRepository.kt` — reads/writes aversion settings in Room `settings` table |
| `BlockOverlayModule` | `OverlayRepository.kt` — writes quote/wallpaper to Room `settings` table |
| `NuclearModeModule` | `NuclearModeRepository.kt` — calls `Intent(Intent.ACTION_DELETE)` with package URI |
| `ForegroundLaunchModule` | `ForegroundLaunchRepository.kt` — calls `Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)` |
| `NativeImagePickerModule` | Use `ActivityResultContracts.PickVisualMedia()` directly in Compose |
| `GreyoutModule` | `GreyoutRepository.kt` — reads/writes greyout windows in Room `settings` table; reads temptation log from Room `temptation_log` table |
| `FocusDayBridgeModule` | Removed — replaced by `EventBus` singleton with `SharedFlow` |

---

## 10. JS Dependency → Kotlin/Android Equivalent Map

| JS Dependency | Kotlin/Android Replacement |
|---|---|
| `react-native` | Android SDK + Jetpack Compose |
| `expo` + `expo-router` | Jetpack Navigation Component |
| `@react-navigation/bottom-tabs` | `NavigationBar` + `Scaffold` in Compose |
| `expo-sqlite` | **Room Persistence Library** (`androidx.room:room-ktx`) |
| `dayjs` | `java.time.LocalDateTime`, `java.time.Duration` (API 26+) |
| `nanoid` | `java.util.UUID.randomUUID().toString()` |
| `zod` | Kotlin data class validation + sealed class error types |
| `expo-notifications` | `NotificationManagerCompat` + `NotificationChannel` |
| `expo-background-fetch` + `expo-task-manager` | **WorkManager** (`androidx.work:work-runtime-ktx`) |
| `expo-haptics` | `Vibrator` / `VibratorManager` (API 31+) |
| `expo-web-browser` | `androidx.browser:browser` (Custom Tabs) |
| `@react-native-community/datetimepicker` | `DatePickerDialog` / `TimePickerDialog` |
| `react-native-safe-area-context` | `WindowInsetsCompat` + `imePadding()` in Compose |
| `react-native-gesture-handler` | Compose gesture APIs (`detectDragGestures`, `pointerInput`) |
| `react-native-svg` | `VectorDrawable` XML or Compose `Canvas` |
| `expo-image` | **Coil** (`io.coil-kt:coil-compose`) |
| `expo-linear-gradient` | `Brush.linearGradient()` in Compose |
| `expo-blur` | `RenderEffect.createBlurEffect()` (API 31+) or `BlurMaskFilter` |
| `react-native-size-matters` | `sp` / `dp` units + `LocalDensity` in Compose |
| `expo-font` + `@expo-google-fonts/inter` | Inter font in `res/font/`, loaded via `FontFamily` |
| `expo-splash-screen` | `androidx.core:core-splashscreen` |
| `expo-status-bar` | `WindowInsetsControllerCompat.isAppearanceLightStatusBars` |
| `expo-constants` | `BuildConfig` fields |
| `expo-location` | `com.google.android.gms:play-services-location` |
| TypeScript | Kotlin (built-in static typing) |

---

## 11. Android Permissions (All Required)

Keep all of these in `AndroidManifest.xml`:

```xml
<!-- Core blocking -->
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"
    tools:ignore="ProtectedPermissions"/>
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE"/>
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.QUERY_ALL_PACKAGES"/>

<!-- Background persistence -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>

<!-- Notifications & scheduling -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>

<!-- VPN network blocking -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.BIND_VPN_SERVICE"/>

<!-- Aversions -->
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.KILL_BACKGROUND_PROCESSES"/>

<!-- Nuclear mode -->
<uses-permission android:name="android.permission.REQUEST_DELETE_PACKAGES"/>

<!-- Device admin (prevents force-stop) -->
<uses-permission android:name="android.permission.BIND_DEVICE_ADMIN"/>

<!-- Media (overlay wallpaper) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32"/>

<!-- Explicitly blocked (privacy reassurance) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove"/>
<uses-permission android:name="android.permission.CAMERA" tools:node="remove"/>
<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>
```

---

## 12. Migration Task Checklist

### Phase 1 — Project Setup
- [ ] Create new Android project: `com.tbtechs.focusflow`, min SDK 26, Kotlin, Jetpack Compose
- [ ] Add all Gradle dependencies (Room, Hilt, Navigation, Coil, WorkManager, Core Splashscreen)
- [ ] Set up `AppTheme` with light/dark `ColorScheme` using tokens from Section 4
- [ ] Add Inter font to `res/font/`
- [ ] Configure `AndroidManifest.xml` with all permissions from Section 11
- [ ] Set up Hilt (`@HiltAndroidApp` on Application class)
- [ ] Create `FocusFlowDatabase` (Room) with all 5 entities from Section 8
- [ ] Create DAOs: `TaskDao`, `SettingsDao`, `FocusSessionDao`, `TemptationLogDao`
- [ ] Migrate all existing Kotlin services/receivers from `android-native/` into new project

### Phase 2 — Repositories & Business Logic
- [ ] `TaskRepository.kt` — CRUD for tasks, UPSERT settings
- [ ] `FocusRepository.kt` — start/stop/extend session, write SharedPrefs for native layer
- [ ] `SchedulerEngine.kt` — port `schedulerEngine.ts` logic (conflict detection, rebalance after overrun)
- [ ] `SchedulerEngine.parseQuickInput()` — port the NLP quick-add parser
- [ ] `InstalledAppsRepository.kt` — `PackageManager` + Coil icon loading
- [ ] `PermissionRepository.kt` — all permission status checks
- [ ] `StatsRepository.kt` — aggregation queries (completion rate, temptation log summary)
- [ ] `NetworkBlockRepository.kt` — VPN service control
- [ ] `AversionsRepository.kt` — deterrent settings
- [ ] `GreyoutRepository.kt` — schedule windows CRUD
- [ ] `OverlayRepository.kt` — quote and wallpaper settings
- [ ] `EventBus.kt` — singleton `MutableSharedFlow` for cross-layer events

### Phase 3 — ViewModels
- [ ] `AppViewModel.kt` — focus session state, event bus subscriptions, dark mode
- [ ] `ScheduleViewModel.kt` — today's tasks, list/timeline toggle, quick-add
- [ ] `FocusViewModel.kt` — countdown timer (coroutine `ticker`), override handling
- [ ] `StatsViewModel.kt` — today stats, weekly stats, temptation log
- [ ] `SettingsViewModel.kt` — all settings sections
- [ ] `OnboardingViewModel.kt` — permission status per card

### Phase 4 — Navigation
- [ ] Set up `NavHost` with routes from Section 5
- [ ] `MainActivity.kt` — check first launch flag → route to `privacyPolicy` or `main`
- [ ] `BottomNavBar` composable — 4 tabs with icons and labels

### Phase 5 — Screens
- [ ] `PrivacyPolicyScreen.kt`
- [ ] `OnboardingScreen.kt` — 6 permission cards, expandable
- [ ] `PermissionsScreen.kt` — same cards + lock logic + troubleshoot modal
- [ ] `ScheduleScreen.kt` — list/timeline toggle, active banner, FAB
- [ ] `FocusScreen.kt` — animated rings, countdown, controls
- [ ] `StatsScreen.kt` — today/week toggle, ring chart, bar chart
- [ ] `SettingsScreen.kt` — all grouped sections

### Phase 6 — Components
- [ ] `TaskCard.kt`
- [ ] `TaskDetailSheet.kt`
- [ ] `QuickAddSheet.kt` (with NLP quick parse)
- [ ] `EditTaskSheet.kt`
- [ ] `TimelineView.kt` (Canvas-based)
- [ ] `AppPickerSheet.kt` (multi-select with search + presets)
- [ ] `AllowedAppsSheet.kt`
- [ ] `DailyAllowanceSheet.kt`
- [ ] `BlockedWordsSheet.kt`
- [ ] `GreyoutScheduleSheet.kt`
- [ ] `StandaloneBlockSheet.kt`
- [ ] `WeeklyReportSheet.kt` (with bar chart)
- [ ] `OverlayAppearanceSheet.kt`
- [ ] `DarkModeToggle.kt` (animated custom toggle)
- [ ] `TroubleshootSheet.kt`

### Phase 7 — Native Layer Wiring
- [ ] Update `ForegroundTaskService` — remove RN bridge events, post to `EventBus` directly
- [ ] Update `NotificationActionReceiver` — call `FocusRepository` directly
- [ ] Update `BlockOverlayActivity` — read quote/wallpaper from Room instead of SharedPrefs
- [ ] Update `FocusFlowWidget` — read from Room DB via `WorkManager`/`GlanceAppWidget`
- [ ] Update `TemptationLogManager` — write to Room `temptation_log` table
- [ ] Update `AppBlockerAccessibilityService` — post `APP_BLOCKED` event to `EventBus`
- [ ] Delete all `modules/` files and `FocusDayPackage.kt`

### Phase 8 — Polish & Edge Cases
- [ ] Splash screen via `core-splashscreen` (indigo background, FocusFlow logo)
- [ ] `BlockedAppOverlay` animations (spring scale-in, shake on attempt)
- [ ] Focus pulsing ring animation (3 concentric rings, different speeds)
- [ ] Dark mode persistence and system-theme following
- [ ] ABI splits in `build.gradle` (arm64-v8a, armeabi-v7a, universalApk)
- [ ] R8 full mode + `shrinkResources` for release builds
- [ ] ProGuard rules: `-keep class com.tbtechs.focusflow.** { *; }`
- [ ] Test on Android 8 (API 26) — minimum supported version

---

## 13. New Project Structure

```
app/
├── src/main/
│   ├── java/com/tbtechs/focusflow/
│   │   ├── FocusFlowApp.kt              (@HiltAndroidApp)
│   │   ├── MainActivity.kt
│   │   │
│   │   ├── data/
│   │   │   ├── db/
│   │   │   │   ├── FocusFlowDatabase.kt
│   │   │   │   ├── entity/              (Task, Settings, FocusSession, FocusOverride, TemptationEntry)
│   │   │   │   ├── dao/                 (TaskDao, SettingsDao, FocusSessionDao, TemptationLogDao)
│   │   │   │   └── converter/           (TypeConverters for List<String>, etc.)
│   │   │   └── repository/
│   │   │       ├── TaskRepository.kt
│   │   │       ├── FocusRepository.kt
│   │   │       ├── StatsRepository.kt
│   │   │       ├── SettingsRepository.kt
│   │   │       ├── InstalledAppsRepository.kt
│   │   │       ├── PermissionRepository.kt
│   │   │       ├── NetworkBlockRepository.kt
│   │   │       ├── GreyoutRepository.kt
│   │   │       ├── AversionsRepository.kt
│   │   │       └── OverlayRepository.kt
│   │   │
│   │   ├── domain/
│   │   │   ├── SchedulerEngine.kt       (port of schedulerEngine.ts)
│   │   │   ├── FocusManager.kt          (port of focusService.ts)
│   │   │   └── EventBus.kt              (SharedFlow singleton)
│   │   │
│   │   ├── services/                    (migrated from android-native)
│   │   │   ├── AppBlockerAccessibilityService.kt
│   │   │   ├── ForegroundTaskService.kt
│   │   │   ├── NetworkBlockerVpnService.kt
│   │   │   ├── BootReceiver.kt
│   │   │   ├── NotificationActionReceiver.kt
│   │   │   ├── FocusDayDeviceAdminReceiver.kt
│   │   │   ├── TemptationReportReceiver.kt
│   │   │   └── WakeLockManager.kt
│   │   │
│   │   ├── ui/
│   │   │   ├── theme/
│   │   │   │   ├── Color.kt             (all tokens from Section 4)
│   │   │   │   ├── Type.kt              (Inter font, scale)
│   │   │   │   ├── Shape.kt             (radius values)
│   │   │   │   └── Theme.kt             (AppTheme, light/dark)
│   │   │   │
│   │   │   ├── screen/
│   │   │   │   ├── PrivacyPolicyScreen.kt
│   │   │   │   ├── OnboardingScreen.kt
│   │   │   │   ├── PermissionsScreen.kt
│   │   │   │   ├── ScheduleScreen.kt
│   │   │   │   ├── FocusScreen.kt
│   │   │   │   ├── StatsScreen.kt
│   │   │   │   └── SettingsScreen.kt
│   │   │   │
│   │   │   ├── component/               (all composables from Section 6)
│   │   │   │
│   │   │   └── nav/
│   │   │       ├── AppNavHost.kt
│   │   │       └── BottomNavBar.kt
│   │   │
│   │   ├── viewmodel/
│   │   │   ├── AppViewModel.kt
│   │   │   ├── ScheduleViewModel.kt
│   │   │   ├── FocusViewModel.kt
│   │   │   ├── StatsViewModel.kt
│   │   │   ├── SettingsViewModel.kt
│   │   │   └── OnboardingViewModel.kt
│   │   │
│   │   ├── widget/
│   │   │   └── FocusFlowWidget.kt       (migrated from android-native)
│   │   │
│   │   └── util/
│   │       ├── AversiveActionsManager.kt
│   │       ├── TemptationLogManager.kt
│   │       └── Extensions.kt            (dp, sp, timeFormatting helpers)
│   │
│   └── res/
│       ├── font/                        (inter_regular.ttf, inter_bold.ttf, inter_medium.ttf)
│       ├── xml/
│       │   ├── accessibility_service_config.xml
│       │   ├── device_admin.xml
│       │   ├── widget_info.xml
│       │   └── widget_focusflow.xml
│       └── drawable/                    (app icon, splash, notification icon)
│
├── build.gradle.kts
└── proguard-rules.pro
```

---

## 14. Build & CI Configuration

### `build.gradle.kts` (app module) key settings
```kotlin
android {
    compileSdk = 35
    defaultConfig {
        applicationId = "com.tbtechs.focusflow"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "1.0.1"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a")
            isUniversalApk = true
        }
    }
}

dependencies {
    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.navigation:navigation-compose:2.8.0")

    // Hilt DI
    implementation("com.google.dagger:hilt-android:2.51")
    kapt("com.google.dagger:hilt-compiler:2.51")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // Lifecycle / ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.0")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Coil (image loading + installed app icons)
    implementation("io.coil-kt:coil-compose:2.6.0")

    // Splash screen
    implementation("androidx.core:core-splashscreen:1.0.1")

    // Custom tabs (web browser)
    implementation("androidx.browser:browser:1.8.0")

    // Kotlin coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Kotlinx serialization (replaces zod + JSON.parse)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.0")
}
```

### `proguard-rules.pro`
```
-keep class com.tbtechs.focusflow.** { *; }
-keepclassmembers class com.tbtechs.focusflow.** { *; }
```

### GitHub Actions CI (keep same structure)
- Debug: trigger on push → `./gradlew assembleDebug`
- Release: manual trigger → `./gradlew assembleRelease bundleRelease` with keystore secrets

---

## 15. Key Risks & Gotchas

| Risk | Detail | Mitigation |
|---|---|---|
| **SharedPreferences sync** | `AppBlockerAccessibilityService` reads SharedPrefs directly. Must ensure all repos writing SharedPrefs use the exact same keys as the service reads. | Keep a `SharedPrefsKeys.kt` constants file with all key strings |
| **Room on background thread** | Room queries must not run on the main thread. | Always use `suspend` functions in DAOs + coroutine scope in ViewModels |
| **Widget + Room** | `AppWidgetProvider` can't use coroutines directly. | Use `Glance` (Jetpack Compose for Widgets) or a `WorkManager` job to update widget data |
| **Accessibility Service restart** | When the app is updated, the Accessibility Service is disabled and must be re-enabled by the user. | Show a notification after update prompting re-enable |
| **VPN permission** | `VpnService.prepare()` shows a system dialog on first use. Must handle `ActivityResult` callback. | Use `rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult())` |
| **`SYSTEM_ALERT_WINDOW` on API 29+** | Overlay permission requires explicit user grant and checking `Settings.canDrawOverlays(context)`. | Already handled in existing `ForegroundLaunchModule` — port the check |
| **Min SDK 26** | `java.time` API available from API 26. No need for ThreeTen backport. | Use `java.time.*` directly |
| **Device Admin protection** | During a focus session, the app is registered as Device Admin. Unregistering requires navigating to Settings. Do NOT auto-deregister on session end (user can choose). | |
| **Temptation log cap** | Keep at 500 entries max. | `TemptationLogDao`: after insert, `DELETE FROM temptation_log WHERE id NOT IN (SELECT id FROM temptation_log ORDER BY blockedAt DESC LIMIT 500)` |
| **NLP parser (parseQuickInput)** | The JS version uses regex to parse "Gym at 3pm for 1h". Port exactly or it breaks the quick-add feature. | Port regex patterns from `taskService.ts` to Kotlin Regex |
| **Dark mode** | System dark mode + manual toggle must both work. | `AppViewModel` exposes `isDarkMode: StateFlow<Boolean>`. Pass to `AppTheme(darkTheme = isDarkMode)`. Persist in Room `settings` table with key `"darkMode"`. |

---

*Last updated: April 2026. Generated from full codebase analysis.*
*FocusFlow version: 1.0.1 (versionCode 5)*
