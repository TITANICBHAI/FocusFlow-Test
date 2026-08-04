# Project Notes

## Recent Fixes (latest session)
- **QUERY_ALL_PACKAGES + REQUEST_DELETE_PACKAGES**: Added both permissions to `install.sh`. `QUERY_ALL_PACKAGES` is required on Android 11+ for the app drawer to list all installed apps. `REQUEST_DELETE_PACKAGES` is required by `NuclearModeModule` to launch the system uninstall dialog.
- **LauncherActivity manifest flags**: `install.sh` now adds `android:clearTaskOnLaunch="true"` and `android:stateNotNeeded="true"` to the LauncherActivity registration, preventing stale task state from persisting across HOME presses.
- **NuclearModeModule.ts**: Created the missing JS bridge for `NuclearModeModule.kt` (`requestUninstallApp`, `requestUninstallApps`, `isAppInstalled`).
- **BlockOverlayModule.ts**: Created the missing JS bridge for `BlockOverlayModule.kt` (`setOverlayQuote`, `setCustomQuotes`, `clearCustomQuote`, `setOverlayWallpaper`, `clearOverlayWallpaper`, `getDefaultQuotes`, `getOverlaySettings`).
- **Analog clock (end-to-end)**: Added `setLauncherClockStyle` to `SharedPrefsModule.ts` + `SharedPrefsModule.kt`. Wired it into `AppContext._syncSystemGuard` so the pref is persisted whenever settings change. In `LauncherActivity.kt`, `updateClockText()` now reads `launcher_clock_style` each tick and either shows the digital TextView row or the new `AnalogClockView` (a Canvas-drawn clock with hour/minute/second hands, hour tick marks, and indigo accent — styled to match the dark launcher aesthetic).
- **NetworkBlockModule wired to focus session**: `AppContext.startFocusMode` now calls `NetworkBlockModule.startNetworkBlock` (with `standaloneVpnPackages`) when `vpnBlockEnabled` is true; `stopFocusMode` calls `NetworkBlockModule.stopNetworkBlock(null)` unconditionally (best-effort).
- **GitHub push 504/502/503 retry**: Both `scripts/github-push.mjs` and `scripts/github-push-pc.mjs` now retry on `502/503/504` server errors with a linear back-off (1–10 s per attempt), in addition to the existing `403/429` rate-limit retry.
- **ForegroundLaunchModule.ts doc cleanup**: Removed the misleading "placeholder for future full-screen overlay" description from `showOverlay()`. The JSDoc now accurately states it calls `bringToFront` and notes that a dedicated `FocusLockActivity` is a planned future feature.

## Earlier Fixes
- **Cross-OEM power menu blocking**: Extended `isSystemUiPkg` and `schedulePowerMenuRetry` in `AppBlockerAccessibilityService.kt` to cover 15+ OEM SystemUI variants (Xiaomi/MIUI, OnePlus/OxygenOS, Oppo/ColorOS, Realme, Huawei/EMUI, Vivo/Funtouch, Motorola, Asus/ZenUI, Nothing OS, Nokia/HMD, Sony Xperia). Retry now fires on `systemGuard` alone — no longer requires an active focus/standalone session.
- **Cross-OEM uninstall blocking**: Expanded `isInstallActionContext` package list in `AppBlockerAccessibilityService.kt` to include OEM package installers (Samsung legacy, Xiaomi, Realme, Vivo, OnePlus, Motorola, Asus, Nokia) and OEM Settings apps (MIUI, ColorOS, Oppo, Realme, Huawei, Vivo, OnePlus, Motorola, Asus, Nokia) so the uninstall intercept fires on non-Samsung devices.
- **Focus tab enforcement panel spacing**: Increased `enforcementRow` padding from `SPACING.sm+2` to `SPACING.md`, switched horizontal padding to `SPACING.lg`, added `lineHeight: 16` to description text — tiles no longer look stuffed into a small space.
- **GitHub push workflows**: Both "Push to GitHub" and "Push FocusFlow-pc to GitHub" are standalone runnable workflows using the `GITHUB_PERSONAL_ACCESS_TOKEN` secret. Requires `GITHUB_PERSONAL_ACCESS_TOKEN` secret in Replit Secrets.
- **Replit migration**: All pnpm packages installed, all 4 workflows configured and running, canvas populated with landing page, gallery, ad video, and 5 phone mockup screens.

## Running Workflows
- **Start application** — Mockup sandbox on port 5000 (main webview). Routes: `/` (landing), `/gallery`, `/preview/Screenshot1Home`, `/preview/Screenshot2Focus`, `/preview/Screenshot3Blocked`, `/preview/Screenshot4Stats`, `/preview/Screenshot5Permissions`.
- **Start FocusFlow Ad** — Ad/video animation sandbox on port 3002.
- **Push to GitHub** — Syncs workspace to `TITANICBHAI/FocusFlow` on GitHub main branch. Requires `GITHUB_PERSONAL_ACCESS_TOKEN`.
- **Push FocusFlow-pc to GitHub** — Syncs `FocusFlow-pc/focusflow-pc` dir to `TITANICBHAI/FocusFlow-pc`. Requires `GITHUB_PERSONAL_ACCESS_TOKEN`.

# Overview
FocusFlow is a comprehensive productivity and focus enhancement suite designed to help users manage screen time, block distractions, and cultivate better digital habits. It includes a mobile application (FocusFlow) for Android and a desktop application (FocusFlow-pc) built with Electron.

The core purpose of FocusFlow is to provide robust blocking mechanisms (app blocking, keyword blocking, system protection), flexible scheduling (daily allowances, focus sessions), and insightful analytics to empower users to reclaim their focus. Key capabilities include:
- **Distraction Blocking**: Enforces app, keyword, and system-level blocks.
- **Focus Sessions**: Pomodoro-style timers and structured focus periods.
- **Time Management**: Daily allowances and weekly reporting for app usage.
- **Customization**: User-defined rules, overlay appearance, and aversion deterrents.
- **Cross-Platform Support**: Mobile (Android) and Desktop (Windows/macOS/Linux) applications.

The business vision is to be the leading solution for digital well-being, offering a powerful yet user-friendly experience that significantly reduces digital distractions across devices, thereby improving user productivity and mental well-being.

# User Preferences
I prefer iterative development with clear communication at each stage. Please ask before making major architectural changes or introducing new external dependencies. I appreciate detailed explanations for complex technical decisions.

# System Architecture

## Core Principles
- **Robust Blocking Enforcement**: Utilizes Android Accessibility Services for persistent app and system-level blocking, along with network-level blocking for FocusFlow-pc.
- **User-Centric Design**: Prioritizes clear UI/UX for managing complex blocking rules and schedules.
- **Data-Driven Insights**: Provides analytics and reports to help users understand and improve their digital habits.
- **Extensibility**: Designed to be extended with advanced customization and scheduling rules.

## FocusFlow (Android Mobile App)
- **Technology Stack**: Expo (React Native) for the main application, pure Kotlin/Jetpack Compose for core Android Accessibility Services.
- **Blocking Mechanisms**:
    - `AppBlockerAccessibilityService.kt`: Core service for app, keyword, and system protection.
    - `NetworkBlockModule.ts`/`.kt`: Manages network-level blocking.
    - `PackageInstallReceiver`: Automatically blocks newly installed apps during a session.
- **Rule Management**:
    - **Keyword Blocker**: Blocks predefined or user-defined keywords within apps.
    - **Daily Allowance**: Per-app time budgets with count, time, and interval modes.
- **Security & Resilience**:
    - `SessionPinModule`: SHA-256 PIN protection for critical actions (stopping service, network block).
    - `FLAG_SECURE`: Prevents screenshots of sensitive screens.
    - `TRUSTED_FOCUSFLOW_CLASSES`: Whitelist to prevent self-blocking.
    - Clock tamper defense using `BootReceiver`.
    - Hardened onboarding to prevent crashes from optional native module failures.
- **User Interface**: Features a slide-in side menu for navigation, a dedicated "Active" dashboard for live session monitoring, and a "Block Enforcement" screen. Dark mode is the default.
- **Data Persistence**: Uses `SharedPreferences` for various settings and blocking states.
- **Backup/Restore**: Employs `ACTION_CREATE_DOCUMENT` for reliable file saving and uses a `.focusflow` extension for backups with richer metadata.

## FocusFlow-pc (Electron Desktop App)
- **Technology Stack**: Electron 29, React 18, TypeScript, Tailwind CSS, `better-sqlite3`.
- **UI/UX**: All screens feature a two-column PC layout.
- **Key Screens**: Today, Week, Focus (Pomodoro), Stats, Settings, Profile, Reports, Active, Notes, Onboarding, Block Defense, Keyword Blocker, Always-On, Standalone Block, Import Blocklist, Overlay Appearance, Allowed In Focus, Daily Allowance, Weekly Report.
- **Design Elements**:
    - **Overlay Appearance**: Customizable color themes (Obsidian, Midnight, Forest, Ocean, Dusk), custom quote editor, show-site toggle, aversion sound toggle.
    - **Achievements**: Confetti animation for streak milestones.
    - **Stats Screen**: Focus ring, productivity score, task breakdown, heatmap, tag chart.
- **Navigation**: Sidebar with "More" section for sub-pages.
- **Push to GitHub**: Automated script (`scripts/github-push-pc.mjs`) for syncing the desktop app codebase to a dedicated GitHub repository.

## Data & Analytics
- **Task Management**: Tracks tasks, their completion, and duration.
- **Streaks**: Calculates daily completion streaks using `daily_completions` derived from task history.
- **Logging**: `startupLogger.ts` provides a timestamped log queue for diagnostics, accessible via `DiagnosticsModal`.
- **Reporting**: Weekly score rings, day-by-day charts, and week-over-week comparisons.

# External Dependencies
- **Expo**: For React Native mobile app development.
- **React Native**: Core framework for the mobile application.
- **Kotlin/Jetpack Compose**: For native Android Accessibility Services.
- **Electron**: For the desktop application framework.
- **React**: For UI development in the desktop application.
- **TypeScript**: For type-safe development across both mobile and desktop applications.
- **Tailwind CSS**: For styling the desktop application.
- **better-sqlite3**: For local database management in the Electron desktop application.
- **AsyncStorage**: For persistent key-value storage in the mobile app (e.g., tip states, logs).
- **GitHub Actions**: For CI/CD, particularly for `FocusFlow-pc` repository syncing.
- **Android System APIs**: `AccessibilityService`, `SharedPreferences`, `ACTION_CREATE_DOCUMENT`, `PackageInstallReceiver`, `BootReceiver`.
- **Third-Party Blocker Imports**: Supports importing blocklists from apps like AppBlock, StayFree, ActionDash, Digital Wellbeing, Lock Me Out, and Stay Focused.