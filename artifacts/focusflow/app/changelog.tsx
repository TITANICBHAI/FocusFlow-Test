import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, RADIUS, SPACING } from '@/styles/theme';

type Entry = {
  version: string;
  date: string;
  sections: { heading: string; icon: string; items: string[] }[];
};

const CHANGELOG: Entry[] = [
  {
    version: '1.0.8',
    date: 'August 2026',
    sections: [
      {
        heading: 'Block Overlay Cleanup',
        icon: 'ban-outline',
        items: [
          'Removed the duplicate React Native in-app blocked-app banner; native Kotlin overlays, app enforcement, dismissal, and all other blocking features remain unchanged',
        ],
      },
      {
        heading: 'New Two-Mode Onboarding',
        icon: 'git-branch-outline',
        items: [
          'Introduced separate Standard and Iron Mode onboarding paths so new users can choose between essential blocking and stronger system-level protection',
          'Standard Mode keeps first-run setup focused on the essential access required for app blocking',
          'Iron Mode adds layered setup for VPN network restriction, Device Admin resistance, and Defense Password protection',
          'Added a live protection-layer counter and honest permission-based activation feedback',
          'Added subtle checkmark and activation-state transitions with reduced-motion support',
        ],
      },
    ],
  },
  {
    version: '1.0.7',
    date: 'August 2026',
    sections: [
      {
        heading: 'Database Reliability',
        icon: 'server-outline',
        items: [
          'Improved SQLite lifecycle handling so database connections are opened, reused, and closed predictably instead of being recreated unnecessarily',
          'Added safer transaction boundaries for related task and settings updates so a partial write cannot leave the local database in an inconsistent state',
          'Database failures now preserve the previous in-memory state and surface a clear recovery path rather than silently losing changes',
          'Added defensive validation around persisted values and backup data to keep malformed records from breaking normal app startup',
        ],
      },
      {
        heading: 'Maintenance',
        icon: 'construct-outline',
        items: [
          'Hardened local data access with parameterized queries, explicit error handling, and recovery logging that avoids exposing user content',
          'Updated release metadata to FocusFlow v1.0.7 (build 7)',
        ],
      },
    ],
  },
  {
    version: '1.0.6',
    date: 'June 2026',
    sections: [
      {
        heading: 'Daily Allowance Fix',
        icon: 'hourglass-outline',
        items: [
          'Fixed daily allowance not blocking after exhaustion — apps with an active allowance rule (count, time-budget, or interval mode) were silently passing through once the allowance was used up instead of being blocked; the native enforcement layer now correctly transitions to full block once all allowance credits are consumed',
          'All three allowance modes (count, daily time budget, interval cooldown) now enforce correctly at the boundary — tested across reboots and app-kill scenarios to confirm the SharedPreferences state is read and applied consistently by the AccessibilityService',
        ],
      },
      {
        heading: 'VPN Revocation Notification',
        icon: 'wifi-outline',
        items: [
          'New VPN status watcher — when the FocusFlow VPN tunnel is revoked or disconnected by the system (e.g. another VPN app takes over, the user manually disconnects, or the system kills the service), the app immediately shows a high-priority notification alerting the user that network blocking is no longer active',
          'Notification includes a one-tap "Re-enable" action that relaunches the VPN tunnel without opening the full app',
          'VPN revocation is detected via ConnectivityManager NetworkCallback so the alert fires within seconds of the tunnel going down, not only on the next accessibility event',
        ],
      },
    ],
  },
  {
    version: '1.0.5',
    date: 'June 2026',
    sections: [
      {
        heading: 'Version Withdrawn',
        icon: 'warning-outline',
        items: [
          'v1.0.5 was pulled before public release — a critical combination of bugs affecting daily allowance enforcement, VPN session state, and notification delivery were discovered during internal testing',
          'Rather than ship a broken release, the version was skipped entirely; all fixes originally targeted for 1.0.5 were carried forward and resolved in v1.0.6',
        ],
      },
    ],
  },
  {
    version: '1.0.4',
    date: 'May 2026',
    sections: [
      {
        heading: 'Bug Fixes — Settings & Security',
        icon: 'bug-outline',
        items: [
          'Fixed autoCopyToAlwaysOn default in the expiry path — the ?? true fallback was silently auto-enrolling packages into Always-On for users who never enabled the feature; changed to ?? false to match the intended off-by-default behaviour',
          'Fixed PIN protection toggle bypass — the "Require password to disable protections" switch could be turned off without entering the defense PIN, defeating all guards; disabling it now requires passing the defense PIN challenge first',
          'Fixed updateSettings not rolling back on database failure — the UI was optimistically updated and then left in an unsaved state if SQLite threw; the dispatch is now rolled back to the previous settings on any DB error',
          'Removed redundant double-write in handleSaveAllowedApps — the Allowed-in-Focus save path was calling setAllowedPackages a second time after updateSettings already did it, creating a race condition that could briefly overwrite the freshly saved list',
          'Fixed time picker day-overflow in Standalone Block setup — picking a time earlier than the current time of day now auto-advances the date to tomorrow instead of silently creating an already-expired block',
          'Fixed keyword list not syncing on backup restore — _syncBlockedWords was missing from the updateSettings Promise.all; bulk settings updates (including backup restores) now push the full blocked-word list to SharedPrefs so the AccessibilityService enforces it immediately',
        ],
      },
      {
        heading: 'Nuclear Mode Fix',
        icon: 'nuclear-outline',
        items: [
          'Fixed Nuclear Mode uninstall button doing nothing — the AccessibilityService was immediately intercepting and dismissing the system uninstall dialog (across all 4 guard paths: launcher long-press, Settings, OEM package installer, and launcher block) before the user could confirm it',
          'NuclearModeModule now sets a nuclear_mode_bypass flag in SharedPreferences just before launching the system uninstall dialog; all four uninstall-blocking paths in the AccessibilityService check this flag and let the dialog through when it was opened by FocusFlow itself',
          'Bypass flag auto-clears after 8 seconds so normal uninstall protection resumes immediately after the dialog is dismissed or confirmed',
          'Uninstall button now shows a clear "native module unavailable" error on Expo Go builds instead of silently doing nothing',
        ],
      },
      {
        heading: 'Full Feature Audit Fixes',
        icon: 'checkmark-done-outline',
        items: [
          'NetworkBlockModule: added 4 missing JS bridge methods — getNetworkBlockSettings, setNetworkBlockSettings, tryDisableWifi, tryRestoreWifi — now fully accessible from the JS layer to match the complete Kotlin API',
          'Stats screen: DB error banner now has a retry button (refresh icon) that re-fetches the last 30 days of history instead of showing a permanent dead-end error message',
          'Today/Schedule screen: initial app load now shows a spinner instead of "No tasks scheduled for today" while the task database is being read on first launch',
        ],
      },
    ],
  },
  {
    version: '1.0.3',
    date: 'May 2026',
    sections: [
      {
        heading: 'Database Reliability',
        icon: 'shield-checkmark-outline',
        items: [
          'WAL checkpoint on app background — every time FocusFlow moves to the background, a FULL WAL checkpoint is triggered so the on-disk database is always in sync before Android can back it up or trim the process',
          'Android Auto Backup now correctly includes the SQLite database and its WAL/SHM sidecar files — tasks, settings, and streaks are restored from Google Drive after a reinstall instead of resetting to a blank state',
          'Backup rules configured for both Android < 12 (fullBackupContent) and Android 12+ (dataExtractionRules), covering cloud backup and device-to-device transfer',
          'SharedPreferences (privacy accepted, onboarding complete) always included in backups alongside the database, preventing onboarding screens from reappearing after a restore',
        ],
      },
    ],
  },
  {
    version: '1.0.2',
    date: 'May 2026',
    sections: [
      {
        heading: 'PIN Rotation System',
        icon: 'key-outline',
        items: [
          'Every focus session start now offers a password-rotation prompt — choose to keep your existing password (up to 3 times per day), set a new custom one, or auto-generate a cryptographically random 16-character password',
          'Always-On Enforcement toggle-off triggers the same rotation prompt — after pausing enforcement you are invited to set the password for next time, keeping the cycle fresh',
          'Daily reuse counter: three dots in the prompt show exactly how many same-password reuses you have left today; once the limit is hit, a new or auto-generated password is required',
          'Focus session reuse count and Always-On reuse count are tracked independently — using up your focus-session allowance does not affect your Always-On allowance and vice versa',
          'Skip option always available — the PIN system is entirely opt-in; tapping "Skip — proceed without changing password" dismisses the prompt and continues the action immediately with no PIN change',
          'Auto-generate path shows a non-copyable monospace password with a refresh button, a "write it down" warning, and an acknowledgement checkbox before saving',
          'Turning off individual sub-systems (YouTube Shorts block, Instagram Reels block, System Guard) does NOT trigger the rotation — only the Always-On master toggle does',
          'Raw passwords are never stored anywhere on the device — only SHA-256 hashes are persisted in SharedPreferences',
        ],
      },
      {
        heading: 'Analog Clock Launcher',
        icon: 'time-outline',
        items: [
          'New analog clock option for the launcher home screen — canvas-drawn hour, minute, and second hands with hour tick marks and blue-violet accent matching the dark launcher aesthetic',
          'Clock style preference persisted via SharedPrefs and synced on every settings change — switching between digital and analog survives reboots and session restarts',
        ],
      },
      {
        heading: 'Nuclear Mode & Block Overlay Bridges',
        icon: 'nuclear-outline',
        items: [
          'NuclearModeModule JS bridge: requestUninstallApp, requestUninstallApps, isAppInstalled — connects the React Native control plane to the Kotlin uninstall dialog launcher',
          'BlockOverlayModule JS bridge: setOverlayQuote, setCustomQuotes, clearCustomQuote, setOverlayWallpaper, clearOverlayWallpaper, getDefaultQuotes, getOverlaySettings — full overlay customisation now accessible from JS',
        ],
      },
      {
        heading: 'Cross-OEM Power Menu & Uninstall Blocking',
        icon: 'shield-checkmark-outline',
        items: [
          'Power menu intercept now covers 15+ OEM SystemUI variants: Xiaomi/MIUI, OnePlus/OxygenOS, Oppo/ColorOS, Realme, Huawei/EMUI, Vivo/Funtouch, Motorola, Asus/ZenUI, Nothing OS, Nokia/HMD, Sony Xperia',
          'Retry now fires on systemGuard alone — no longer requires an active focus or standalone session to keep the power menu protected',
          'Uninstall blocking expanded to include OEM package installers and OEM Settings apps across Samsung legacy, Xiaomi, Realme, Vivo, OnePlus, Motorola, Asus, and Nokia devices',
        ],
      },
      {
        heading: 'VPN Integration in Focus Sessions',
        icon: 'wifi-outline',
        items: [
          'NetworkBlockModule is now wired directly into startFocusMode — when VPN blocking is enabled, the network block starts automatically at session start without any extra tap',
          'stopFocusMode calls stopNetworkBlock unconditionally on session end, ensuring the VPN tunnel is always released cleanly',
        ],
      },
      {
        heading: 'Privacy & Legal',
        icon: 'document-text-outline',
        items: [
          'Privacy Policy and Terms of Service links updated throughout the app to point to focusflowapp.pages.dev',
          'Terms of Service screen now includes a "Read full Terms online" button matching the privacy screen',
          'GitHub reference removed from Terms contact section — replaced with website URL',
        ],
      },
    ],
  },
  {
    version: '1.0.1',
    date: 'May 2026',
    sections: [
      {
        heading: 'Home Launcher',
        icon: 'home-outline',
        items: [
          'FocusFlow can now be set as your default Android home screen — every app tap routes through FocusFlow first, giving instant enforcement with no accessibility-service reaction delay',
          'Selective app hiding: any blocked app can be individually flagged to disappear from the launcher drawer entirely — only apps you choose to hide are hidden; all other blocked apps remain visible but dimmed',
          'Pinned app grid on the home screen — choose which apps live one tap away; long-press to rearrange',
          'Uninstall intercept: when any blocked app\'s uninstall menu appears (long-press context or Play Store dialog) during an active standalone block, FocusFlow dismisses it immediately',
          'Safe-mode escape closed: System Protection (already locked on during standalone blocks) catches and dismisses the power menu before Safe mode can be tapped',
          'Launcher lock: while a standalone block is active, the "Default home app" chooser in Android Settings is intercepted and closed — you cannot switch away from FocusFlow until the block ends',
          'New "Home Launcher" section in Block Enforcement → dedicated settings page with status card, pinned apps, drawer visibility controls, appearance options (wallpaper, clock style), and launcher protections',
        ],
      },
      {
        heading: 'VPN Network Blocking',
        icon: 'shield-outline',
        items: [
          'New global "Network blocking (VPN)" toggle in Block Enforcement → System Protection — tunnels all blocked apps through a local VPN to cut their internet access entirely',
          'Per-app VPN control: each app in the Standalone Block list now has an independent "Add network block (VPN)" toggle — enable it only for the apps that need network cut, leave others untouched',
          'VPN toggle follows the same lock-during-active-block pattern as all other System Protection toggles',
          'Native: new setNetworkBlockEnabled and setVpnSelectedPackages bridge methods; AccessibilityService filters VPN by selected packages (global mode when list is empty)',
        ],
      },
    ],
  },
  {
    version: 'c1.0.9',
    date: 'April 2026',
    sections: [
      {
        heading: 'Blocklist Import',
        icon: 'download-outline',
        items: [
          'Two paths in one screen: pick an exported file (JSON / CSV / plain text) OR paste / type the app names yourself for blockers like Stay Focused that don\'t expose an export — names are fuzzy-matched against your installed apps so capitalisation and small typos still resolve',
          'Stay Focused is featured first because it has no public export — paste path is the recommended route for it',
          'One-tap "Switching from another blocker?" entry on the onboarding screen so new users land directly in the import flow',
          'Import is purely additive: it merges the apps into your existing Standalone Block list, never starts a focus session, never starts a new timed standalone session, and preserves any timer that is already running',
        ],
      },
      {
        heading: 'Block Enforcement Clarity',
        icon: 'analytics-outline',
        items: [
          'New "What\'s blocking right now" panel at the top of Block Enforcement — three-light status showing whether a Focus session is running, whether a Timed Standalone Block is running, and whether Always-on enforcement is active (and why)',
          'Always-on enforcement explainer: any app left in your Standalone Block list (or any Daily Allowance rule) is enforced 24/7 even with no timer running — the new panel makes this visible at a glance and tells you how to clear it',
          'No behaviour change here — this just surfaces what was already happening so it stops feeling like the app is "stuck on"',
        ],
      },
      {
        heading: 'Focus Session Behaviour Toggle',
        icon: 'hourglass-outline',
        items: [
          'New toggle in Block Enforcement → Focus Session Behaviour: "Keep focus active for the full duration"',
          'Default OFF (existing behaviour) — completing a task immediately ends the focus session',
          'When ON — completing or skipping a task BEFORE its scheduled end time keeps app-blocking and the persistent notification running until the original end time. The task still goes into your stats as completed; only the focus session sticks around',
          'Stop happens automatically once the task\'s end time passes (checked every 30 s; survives app restarts because tasks live in the DB)',
        ],
      },
    ],
  },
  {
    version: 'c1.0.8',
    date: 'April 2026',
    sections: [
      {
        heading: 'Block-list Safety',
        icon: 'shield-checkmark-outline',
        items: [
          'Sensitive system apps (home launcher, dialer, Settings, Google Play Services, package installer, wallets, FocusFlow itself) now show a "Sensitive" badge and a confirmation dialog when you try to block them',
          'Added Truecaller (com.truecaller, com.truecaller.pro) to both the warning list and the native never-block list — caller ID stays active during focus',
          'Added "Education essentials" warning category for PhysicsWallah (PW), Allen Digital, and Gurukripa (GCI) — these were already hard-protected at the native layer; the UI now also surfaces a warning if you try to block them',
          'Home launchers (Pixel, Samsung, MIUI, OnePlus, Huawei, Honor, Oppo, Vivo, Realme, iQOO, Motorola, Nothing, Asus, LG, HTC, Sony, TCL, Nokia, Infinix, Transsion + AOSP) are now in the hard-locked native never-block list — no override possible, since blocking your launcher would leave you with nowhere to land when you press HOME',
          'Native never-block list (passes through unconditionally regardless of UI selection): home launchers, all OEM dialer/in-call UIs, Telecom service, WhatsApp, WhatsApp Business, Truecaller, VLC, system clock/alarm apps, and education essentials (PW / Allen / GCI)',
          'Android Settings stays in the warning-only list — you get a confirmation dialog if you try to block it, but you can still proceed (so power users can lock themselves out of Settings on purpose). Apps in the hard-locked never-block list above cannot be blocked at all.',
          '"Block all" deselect now warns once with a count of sensitive apps that would be blocked',
        ],
      },
      {
        heading: 'Cleaner Profile',
        icon: 'person-circle-outline',
        items: [
          'Removed the "Apps to consider blocking" suggestion section from the profile screen',
          'Distraction triggers are still captured for future insights, but no longer drive a suggestion list',
          'Helper copy on triggers, occupation and goals updated to describe what each field actually does today',
        ],
      },
      {
        heading: 'Onboarding Persistence',
        icon: 'save-outline',
        items: [
          'Fixed: onboarding/profile screen could randomly re-appear after some days if Android wiped the database',
          'Onboarding completion is now mirrored into SharedPreferences (which survives DB-file deletion) and restored on next launch — same fix that previously stopped the privacy-policy screen from re-appearing',
        ],
      },
    ],
  },
  {
    version: 'c1.0.7',
    date: 'April 2026',
    sections: [
      {
        heading: 'Deeper Profile',
        icon: 'person-circle-outline',
        items: [
          'Profile now asks 7 new questions: sleep time, when you focus best (chronotype), your ideal focus-block length, preferred break style, distraction triggers, motivation style, and weekly review day',
          'Picking an ideal focus block (15 / 25 / 45 / 60 / 90 min) instantly becomes your default duration for new tasks AND your Pomodoro length',
          'Picking a break style (short & frequent / balanced / long / none) instantly sets your default Pomodoro break length',
          'Picking distraction triggers (social, video, news, games, shopping, messaging) adds tailored apps — Instagram, TikTok, Roblox, Amazon, WhatsApp and more — to the block-suggestions list',
          'Weekly review day now drives when your existing weekly recap notification fires',
          'New "How your profile is used" callout on the profile screen explains exactly which feature each field powers — no more wondering where preferences end up',
        ],
      },
      {
        heading: 'Your Journey Panel',
        icon: 'trophy-outline',
        items: [
          'Profile screen now shows a personal journey card when editing — current streak, today\'s focus minutes with a progress bar to your daily goal, all-time focus hours, total sessions, and best streak',
          'Hidden during first-run onboarding so new users don\'t see a wall of zeros',
        ],
      },
      {
        heading: 'Home-Screen Widget',
        icon: 'apps-outline',
        items: [
          'Same compact 4×1 size, more useful at a glance: idle and next-up states now show "Done · 3/5 tasks · 45m today"',
          'Active task header now shows a 🔥 streak chip alongside ACTIVE TASK',
          'Idle state header reads "FOCUSFLOW · 🔥 N" so the streak is visible even with no active task',
          'Daily stats sync automatically whenever you complete a task or finish a focus session',
        ],
      },
      {
        heading: 'Diagnostics Gating Fix',
        icon: 'bug-outline',
        items: [
          'Startup log / Diagnostics panel now correctly appears in debug builds (was missing in both debug and release before)',
          'Switched the gating check from JS-only __DEV__ (which is false in prebundled debug APKs) to the native Android FLAG_DEBUGGABLE flag',
          'Console-mirrored logs now also gate on the native debuggable flag, so release builds stay quiet while debug builds get full visibility',
        ],
      },
    ],
  },
  {
    version: 'c1.0.6',
    date: 'April 2026',
    sections: [
      {
        heading: 'Focus Mode Toggle Fixed',
        icon: 'shield-checkmark-outline',
        items: [
          'Auto-enable Focus Mode setting now correctly gates whether focus mode activates when a task starts — toggling it off prevents auto-start even if a task has focus mode enabled',
        ],
      },
      {
        heading: 'Standalone Block Modal',
        icon: 'ban-outline',
        items: [
          'Time addition now adds to the existing end time instead of replacing it — tap +30m, +1h, +2h, or +4h while a block is locked to extend it',
          'Recurring Block Schedules section removed for a cleaner interface',
          'Block by Category section removed',
          'Add by Package Name moved under an Advanced toggle — hidden by default',
        ],
      },
      {
        heading: 'Recents Screen Behaviour',
        icon: 'apps-outline',
        items: [
          'The recents / recent-apps button is no longer blocked during standalone app blocks — it is only redirected during active task focus sessions',
        ],
      },
      {
        heading: 'Splash Screen',
        icon: 'phone-portrait-outline',
        items: [
          'Native splash background changed to match the in-app purple splash — eliminates the black flash on cold start',
          'In-app splash logo now starts at 30% opacity instead of fully invisible, making the entrance feel smoother',
        ],
      },
    ],
  },
  {
    version: 'c1.0.5',
    date: 'April 2026',
    sections: [
      {
        heading: 'Session Security Hardening',
        icon: 'lock-closed-outline',
        items: [
          'Session PIN — SHA-256 PIN gates all native session-ending calls (stop service, stop network block, deactivate focus). Raw PIN is never stored.',
          'FLAG_SECURE on block overlay — prevents screenshots and hides session content from the Android recents thumbnail',
          'Self-package loophole closed — FocusFlow\'s own activity classes are allowlisted so they can never be used to dismiss the block overlay',
          'Recents screen detection — pressing the overview/recent-apps button during a session now sends HOME, preventing escape via app switching',
        ],
      },
      {
        heading: 'Mid-Session Install Blocking',
        icon: 'shield-checkmark-outline',
        items: [
          'Newly installed apps are automatically added to the block list if a standalone block session is active at install time',
          'Every new install during a session triggers an aversion vibration deterrent and flags the app for a JS-side warning banner',
          'Clock-tamper defense — BootReceiver now cross-checks task duration against wall-clock time to detect system-time manipulation',
        ],
      },
      {
        heading: 'IME & Keyboard Detection',
        icon: 'keypad-outline',
        items: [
          'Input Method Engines (keyboards) are now tagged with isIme in the app list — keyboards with built-in browsers or GIF search can be explicitly blocked',
        ],
      },
      {
        heading: 'Home Screen Reminder',
        icon: 'notifications-outline',
        items: [
          'A high-priority peek notification now appears when the user returns to the home screen after being kicked from a blocked app — clear reminder that the session is still running',
        ],
      },
    ],
  },
  {
    version: 'c1.0.4',
    date: 'April 2026',
    sections: [
      {
        heading: 'Alarm Safety',
        icon: 'alarm-outline',
        items: [
          'Native Samsung, Android, and Google clock/alarm apps are now never blocked',
          'SystemUI is no longer dismissed by broad package-level fallback, preventing focus protection from interrupting phone alarms while the screen is off',
        ],
      },
      {
        heading: 'System Screen Matching',
        icon: 'shield-checkmark-outline',
        items: [
          'Notification shade, quick settings, power menu, and Samsung Emergency mode are now detected by accessibility class/text matching only',
          'Blocked keywords now continue working during active Focus Mode or app blocks even when System Protection is turned off',
        ],
      },
    ],
  },
  {
    version: 'c1.0.3',
    date: 'April 2026',
    sections: [
      {
        heading: 'Never Blocked Packages',
        icon: 'call-outline',
        items: [
          'Added Samsung Phone, Phone services, Phone calls, Phone and Messaging Storage, VLC, WhatsApp, Gurukripa, PW, and ALLEN package IDs to the never-blocked safety list',
        ],
      },
      {
        heading: 'System Protection Toggle',
        icon: 'shield-checkmark-outline',
        items: [
          'Settings now includes a system protection toggle for power menu, notification shade, blocked words, and sensitive Settings-page blocking',
          'The toggle can be enabled anytime, but cannot be disabled while Focus Mode or an app block is active',
        ],
      },
    ],
  },
  {
    version: 'c1.0.2',
    date: 'April 2026',
    sections: [
      {
        heading: 'Power Menu & Notification Blocking',
        icon: 'shield-outline',
        items: [
          'Samsung One UI power menu now caught via com.samsung.android.app.powerkey (was entirely missed before)',
          'Android 14 GlobalActionsLayout, Samsung SecGlobalActionsDialog, MIUI MiuiGlobalActionsDialog added to detection',
          'Text-fallback now triggers on any 1 keyword — "Emergency call", "Safe mode" added',
          'Three-layer dismiss: ACTION_CLOSE_SYSTEM_DIALOGS → GLOBAL_ACTION_BACK (80 ms) → GLOBAL_ACTION_HOME (350 ms)',
          'Samsung One UI notification panel class names added (CentralSurfaces, StatusBarWindowView, SamsungQSPanel)',
          'Broad fallback catches unknown OEM class names automatically',
        ],
      },
      {
        heading: 'NLP Task Parser',
        icon: 'text-outline',
        items: [
          '"tomorrow", "tonight" scheduling',
          '"morning" (09:00), "afternoon" (14:00), "evening" (18:00)',
          '"in 30 minutes" / "in 2 hours" relative times',
          'Bare times: "9am", "14:30", "3pm"',
          '"today" keyword support',
        ],
      },
      {
        heading: 'Stats Screen',
        icon: 'bar-chart-outline',
        items: [
          'Overdue tasks shown as a separate line with a red alert icon',
          'Previously overdue tasks were hidden inside the "Remaining" count',
        ],
      },
      {
        heading: 'Permissions & Build',
        icon: 'construct-outline',
        items: [
          'EXPAND_STATUS_BAR permission added to manifest',
          'AAB release build fixed — ABI splits disabled before bundleRelease',
          'CI workflow files corrected (pnpm + Node 20 + Expo Prebuild)',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: 'Initial Release',
    sections: [
      {
        heading: 'Core Focus Engine',
        icon: 'timer-outline',
        items: [
          'Task-based focus sessions with configurable duration',
          'Allowed-apps whitelist during focus',
          'Standalone block mode independent of any session',
          'Daily allowance system (count / time-budget / interval)',
          'Automatic session expiry via native time authority',
        ],
      },
      {
        heading: 'App Blocking',
        icon: 'ban-outline',
        items: [
          'Foreground-app detection via AccessibilityService',
          'Full-screen block overlay with session context',
          'WindowManager overlay path for instant blocking',
          'Retry mechanism — up to 5 re-checks at 300 ms intervals',
          'NEVER_BLOCK list: phone dialers and WhatsApp always accessible',
        ],
      },
      {
        heading: 'Keyword & Network Blocking',
        icon: 'globe-outline',
        items: [
          'URL-bar scanning in Chrome, Firefox, Samsung Internet, Brave, Edge, DuckDuckGo and more',
          'VPN-based null-routing for blocked apps',
          'Greyout schedule — pre-committed time-window blocks',
        ],
      },
      {
        heading: 'Deep Android Enforcement',
        icon: 'lock-closed-outline',
        items: [
          'Settings sub-pages blocked: accessibility, clear data, date/time, usage access, battery optimisation, developer options, reset',
          'BootReceiver — service restarts after reboot',
          'Device Admin prevents uninstallation during active blocks',
          'FocusLauncherActivity for deep focus lockdown',
        ],
      },
      {
        heading: 'Widgets & Reports',
        icon: 'grid-outline',
        items: [
          'Home-screen widget showing session status',
          'Weekly Temptation Report every Sunday — blocked-app attempt summary',
          'Aversion deterrents: screen dimmer, vibration, sound cues',
        ],
      },
    ],
  },
];

function ChangeEntry({ entry }: { entry: Entry }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.versionRow}>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>{entry.version.startsWith('c') ? entry.version : `v${entry.version}`}</Text>
        </View>
        <Text style={[styles.dateText, { color: theme.muted }]}>{entry.date}</Text>
      </View>
      {entry.sections.map((sec) => (
        <View key={sec.heading} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name={sec.icon as any} size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{sec.heading}</Text>
          </View>
          {sec.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={[styles.bullet, { color: COLORS.primary }]}>•</Text>
              <Text style={[styles.itemText, { color: theme.muted }]}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function ChangelogScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.text }]}>What's New</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="rocket-outline" size={32} color="#fff" />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Changelog</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Every improvement, fix, and new feature across all versions.
          </Text>
        </View>

        {CHANGELOG.map((entry) => (
          <ChangeEntry key={entry.version} entry={entry} />
        ))}

        <Text style={[styles.footer, { color: theme.muted }]}>
          Privacy Policy: titanicbhai.github.io/FocusFlow
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  topTitle: { fontSize: 17, fontWeight: '600', letterSpacing: 0.2 },
  content: { padding: SPACING.md, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  versionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  versionBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 10,
  },
  versionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dateText: { fontSize: 13, fontWeight: '400' },
  section: { marginTop: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  itemRow: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
  bullet: { fontSize: 14, marginRight: 6, lineHeight: 20 },
  itemText: { fontSize: 13, fontWeight: '400', lineHeight: 20, flex: 1 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});