export type TaskStatus = 'scheduled' | 'active' | 'completed' | 'skipped' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReminderType = 'pre-start' | 'at-start' | 'post-start';

export type AllowanceMode = 'count' | 'time_budget' | 'interval';

export interface DailyAllowanceEntry {
  packageName: string;
  mode: AllowanceMode;
  countPerDay: number;       // count mode: max opens per day (min 1, default 1)
  budgetMinutes: number;     // time_budget mode: total minutes per day (default 30)
  intervalMinutes: number;   // interval mode: minutes allowed per window (default 5)
  intervalHours: number;     // interval mode: window size in hours (default 1)
}

export interface AllowedAppPreset {
  id: string;
  name: string;
  packages: string[]; // [] = "all apps allowed" sentinel
}

export interface BlockPreset {
  id: string;
  name: string;
  packages: string[];
}

export interface Reminder {
  id: string;
  taskId: string;
  offsetMinutes: number; // negative = before start, positive = after start
  type: ReminderType;
  notifId?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  durationMinutes: number;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  reminders: Reminder[];
  color: string;
  focusMode: boolean;
  focusAllowedPackages?: string[]; // undefined = use global setting, [] = all allowed, [...] = specific list
  createdAt: string;
  updatedAt: string;
}

export interface FocusSession {
  taskId: string;
  startedAt: string;
  isActive: boolean;
  allowedPackages: string[]; // e.g. com.whatsapp, com.android.phone
}

export interface GreyoutWindow {
  /** Primary package name (backward-compat; always equals pkgs[0] when pkgs is set). */
  pkg: string;
  /** All package names covered by this window. Overrides pkg when present. */
  pkgs?: string[];
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  days: number[]; // Calendar.DAY_OF_WEEK: 1=Sun 2=Mon 3=Tue 4=Wed 5=Thu 6=Fri 7=Sat
  scheduleId?: string; // if set, this window was auto-generated from a RecurringBlockSchedule
  /** Optional human-readable name for this window (e.g. "Morning Focus"). */
  name?: string;
  /**
   * Whether this window is currently active. Defaults to true when absent —
   * existing windows without this field are treated as enabled.
   * Toggling this pauses the window without deleting it.
   */
  enabled?: boolean;
}

/**
 * A recurring block schedule that blocks a set of apps on specific days/times.
 * These are stored separately and converted to GreyoutWindows at sync time.
 */
export interface RecurringBlockSchedule {
  id: string;
  name: string;
  packages: string[];
  days: number[];        // Calendar.DAY_OF_WEEK: 1=Sun 2=Mon 3=Tue 4=Wed 5=Thu 6=Fri 7=Sat
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  enabled: boolean;
  /**
   * When true, network blocking (VPN) is also applied to all packages in
   * this schedule during its time window, independently of the overlay block.
   * An app can have VPN blocking enabled here without being in the block list.
   */
  vpnEnabled?: boolean;
  /**
   * Packages to network-block (VPN) during this schedule's window.
   * If empty and vpnEnabled is true, falls back to blocking all `packages`.
   */
  vpnPackages?: string[];
}

export interface UserProfile {
  name?: string;
  occupation?: string;          // 'student' | 'professional' | 'freelancer' | 'creator' | 'other'
  dailyGoalHours?: number;      // target focus hours per day (1–12)
  wakeUpTime?: string;          // "HH:MM" e.g. "07:00"
  focusGoals?: string[];        // e.g. ['deep_work', 'no_social', 'study']

  // ── Deeper profile (added later) ───────────────────────────────────────────
  // All optional so existing profiles keep working unchanged.

  /** "HH:MM" e.g. "23:00" — pairs with wakeUpTime to define the available day. */
  sleepTime?: string;

  /** When the user focuses best — drives task-scheduling suggestions. */
  chronotype?: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'flexible';

  /** Preferred focus block length in minutes; written through to
   *  settings.defaultDuration & settings.pomodoroDuration on save. */
  focusSessionLength?: number;  // 15 | 25 | 45 | 60 | 90

  /** How the user likes to break between focus blocks; written through to
   *  settings.pomodoroBreak on save. */
  breakStyle?: 'short_frequent' | 'balanced' | 'long_infrequent' | 'no_break';

  /** Categories of apps the user finds most distracting — fed into the
   *  suggested-apps-to-block list alongside occupation + focusGoals. */
  distractionTriggers?: string[]; // e.g. ['social','video','news','games','shopping','messaging']

  /** What kinds of motivation work for them — drives which gamification
   *  surfaces (streak chips, charts, milestone toasts, daily quotes). */
  motivationStyle?: string[];     // e.g. ['streaks','stats','milestones','quotes']

  /** Day of the week the user wants a weekly recap notification. */
  weeklyReviewDay?: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
}

export interface AppSettings {
  darkMode: boolean;
  defaultDuration: number; // minutes
  defaultReminderOffsets: number[]; // e.g. [-10, -5, 0]
  focusModeEnabled: boolean;
  allowedInFocus: string[]; // Android package names allowed during focus (e.g. com.whatsapp)
  pomodoroEnabled: boolean;
  pomodoroDuration: number; // minutes
  pomodoroBreak: number;    // minutes
  notificationsEnabled: boolean;
  onboardingComplete: boolean;
  privacyAccepted: boolean;
  // Standalone app blocking — independent of any task
  standaloneBlockPackages: string[]; // packages to always block regardless of task state
  standaloneBlockUntil: string | null; // ISO timestamp when the standalone block expires
  /**
   * Master switch for the always-on block list. When false, packages in
   * `standaloneBlockPackages` are preserved but NOT enforced (so the user can
   * temporarily pause enforcement without losing their list). Default true.
   */
  alwaysOnEnforcementEnabled?: boolean;
  /**
   * Dedicated always-on app block list — separate from `standaloneBlockPackages`.
   * These apps are blocked 24/7 regardless of any session state. Never cleared
   * automatically; user manages this list via the Always-On screen.
   */
  alwaysOnPackages?: string[];
  /**
   * Packages that should have network blocking (VPN) applied continuously,
   * matching the always-on block enforcement. Can overlap with or differ from
   * alwaysOnPackages — VPN can be enabled without an overlay block.
   */
  alwaysOnVpnPackages?: string[];
  /**
   * When true, any packages added via standalone block are automatically
   * mirrored into `alwaysOnPackages` so they stay blocked after the timed
   * session expires. Default false.
   */
  autoCopyToAlwaysOn?: boolean;
  /**
   * Highest streak milestone (in days) the user has already been congratulated
   * for. Used to detect new milestones (3, 7, 14, 30, 60, 90, 180, 365) and
   * trigger a one-time celebration modal on the next app open.
   */
  lastShownStreakMilestone?: number;
  /**
   * When set to a milestone day count, the root layout shows a celebration
   * modal once and then clears this field (and bumps lastShownStreakMilestone).
   */
  pendingAchievementCelebration?: number;
  allowedAppPresets: AllowedAppPreset[]; // saved preset allow-lists
  blockPresets: BlockPreset[];           // saved preset block-lists
  // Per-app daily allowance — replaces old dailyAllowancePackages: string[]
  // Each entry configures a specific allowance mode for an app:
  //   count:       allowed N opens per day (resets midnight)
  //   time_budget: allowed N total minutes per day (resets midnight)
  //   interval:    allowed N minutes every X hours (rolling window)
  dailyAllowanceEntries: DailyAllowanceEntry[];
  // Word blocking: if any of these words appear on screen during an active blocking session
  // (task focus or standalone block), the user is immediately redirected to home.
  blockedWords: string[];
  // Aversion deterrents — each applied the instant a blocked app is detected
  aversionDimmerEnabled: boolean;   // near-black WindowManager overlay (dark screen)
  aversionVibrateEnabled: boolean;  // repeated vibration pulse while app is open
  aversionSoundEnabled: boolean;    // alert sound the moment the blocked app opens
  // Temptation report
  weeklyReportEnabled: boolean;     // Sunday notification with blocked-app attempt counts
  // Greyout schedule — time-window blocks independent of any focus session
  greyoutSchedule: GreyoutWindow[];
  systemGuardEnabled: boolean;
  // Content-specific guards — opt-in per category. Behave like systemGuardEnabled:
  //   • Locked on while Focus Mode or an app block is active (toggle disabled).
  //   • Enforced by AppBlockerAccessibilityService during focusActive || saActive.
  blockInstallActionsEnabled: boolean;   // Intercept Play Store / packageinstaller install/update/uninstall confirmation dialogs
  blockYoutubeShortsEnabled: boolean;    // Intercept the YouTube Shorts player (YouTube itself stays usable)
  blockInstagramReelsEnabled: boolean;   // Intercept the Instagram Reels player / clips viewer (Instagram itself stays usable)
  vpnBlockEnabled: boolean;             // Tunnel blocked apps through VPN to cut their network access (requires VPN permission)
  standaloneVpnPackages: string[];      // Per-app VPN: packages selected to receive network blocking in addition to accessibility blocking
  /**
   * When true, the VPN block automatically restarts itself if it gets disconnected
   * mid-session (e.g. user pulls down quick-settings tile and taps disconnect).
   * Implemented by two complementary native mechanisms:
   *   1. NetworkBlockerVpnService.onRevoke() schedules a restart after 3 s.
   *   2. AppBlockerAccessibilityService checks VPN health every 10 s.
   */
  vpnSelfHealEnabled?: boolean;
  /**
   * When true, disabling any block-enforcement toggle (always-on, system guard,
   * VPN block, etc.) requires the Defense Password — if one is set.
   * When false, toggles work freely with no password gate.
   * User chooses this during onboarding; can also be changed in Settings.
   * Defaults to false so first-time users aren't immediately blocked.
   */
  pinProtectionEnabled?: boolean;

  // ── Home Launcher ──────────────────────────────────────────────────────────
  // FocusFlow can act as the device's home screen. When set as default launcher,
  // every app tap routes through FocusFlow first — instant enforcement with no
  // accessibility-service reaction delay.
  launcherEnabled?: boolean;              // User has enabled the launcher feature
  launcherHiddenPackages?: string[];      // Apps completely hidden from the app drawer (only blocked apps can be hidden)
  launcherPinnedPackages?: string[];      // Ordered list of packages on the home screen grid
  launcherDockPackages?: string[];        // Up to 5 apps pinned in the persistent bottom dock
  launcherWallpaperUri?: string | null;   // Path to custom wallpaper image (null = use system wallpaper)
  launcherClockStyle?: 'digital' | 'analog'; // Clock widget style on the home screen
  launcherBlockUninstall?: boolean;       // Intercept long-press "Uninstall" option in any launcher during active blocks
  launcherLockDuringStandalone?: boolean; // Prevent changing the default home app while a standalone block is active
  // Focus session behaviour
  // When true, finishing a task before its scheduled end time keeps the focus session
  // running until the original end time (the task is marked done in your stats, but
  // app-blocking and the persistent notification stay active). Default false: completing
  // a task stops focus immediately (the existing behaviour).
  keepFocusActiveUntilTaskEnd: boolean;
  // Block overlay appearance
  overlayWallpaper?: string;        // Absolute path to custom background image (empty = use gradient)
  overlayQuotes?: string[];         // Custom quote pool (empty = use built-in quotes)
  // Recurring block schedules — blocks a group of apps on a repeating daily/weekly timetable
  recurringBlockSchedules: RecurringBlockSchedule[];
  userProfile?: UserProfile;

  /**
   * User-selected UI language. When null/undefined, the device locale is used.
   * Stored as an i18n language code: 'en' | 'zh' | 'fr' | 'de' | 'ja' | 'ko' | 'es'
   */
  language?: string;

  /**
   * Beginner mode hides advanced surfaces (Custom Node Rules, Recurring
   * Schedules, Aversion Deterrents, Custom Wallpaper). Default true so new
   * users land in the friendlier UI.
   */
  beginnerMode?: boolean;

  /**
   * Tips card on the idle Focus tab — auto-fades after 7 days from
   * `tipsCardFirstShownAt` (ISO). User can also dismiss manually.
   */
  tipsCardDismissed?: boolean;
  tipsCardFirstShownAt?: string;

  /**
   * `.focusflow` imports land here as TEMPORARY presets — never overwrites
   * live settings. Each affected screen surfaces an "Apply / Dismiss" banner
   * to commit or drop the preset. Cleared per-category once applied/dismissed.
   */
  pendingPresets?: PendingPresets;
}

/**
 * A custom node-blocking rule derived from NodeSpy captures or compatible
 * JSON exports. The AccessibilityService uses these to detect and intercept
 * specific UI nodes (e.g. addictive feed elements) inside a target app.
 */
export interface CustomNodeRule {
  id: string;
  label: string;
  pkg: string;
  matchResId?: string;
  matchText?: string;
  matchCls?: string;
  /** 'overlay' = show block overlay, 'home' = go home immediately */
  action: 'overlay' | 'home';
  enabled: boolean;
  importedAt: string;
  confidence?: number;
  qualityTier?: 'strong' | 'medium' | 'weak';
  selectorType?: string;
  stability?: number;
  warnings?: string[];
  captureTimestamp?: number;
  sourceName?: string;
}

/** Preset payload from a `.focusflow` import that has not been applied yet. */
export interface PendingPresets {
  blockApps?: { packages: string[]; sourceName?: string; importedAt: string };
  dailyAllowance?: { entries: DailyAllowanceEntry[]; sourceName?: string; importedAt: string };
  deterrents?: {
    aversionDimmerEnabled?: boolean;
    aversionVibrateEnabled?: boolean;
    aversionSoundEnabled?: boolean;
    sourceName?: string;
    importedAt: string;
  };
  enforcement?: {
    systemGuardEnabled?: boolean;
    blockInstallActionsEnabled?: boolean;
    blockYoutubeShortsEnabled?: boolean;
    blockInstagramReelsEnabled?: boolean;
    vpnBlockEnabled?: boolean;
    blockedWords?: string[];
    sourceName?: string;
    importedAt: string;
  };
  profile?: { profile: Partial<UserProfile>; sourceName?: string; importedAt: string };
}

