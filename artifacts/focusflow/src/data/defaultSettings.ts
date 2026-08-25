import { Appearance } from 'react-native';
import type { AppSettings } from './types';

/**
 * One canonical set of defaults used by both the database layer and the
 * React context while settings are loading or unavailable.
 *
 * These values apply only when a setting has never been saved. Existing
 * saved settings are merged on top and are never overwritten by defaults.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: Appearance.getColorScheme() === 'dark',
  defaultDuration: 60,
  defaultReminderOffsets: [-10, -5, 0],
  focusModeEnabled: true,
  allowedInFocus: [],
  allowedAppPresets: [],
  blockPresets: [],
  pomodoroEnabled: false,
  pomodoroDuration: 25,
  pomodoroBreak: 5,
  notificationsEnabled: true,
  privacyAccepted: false,
  onboardingComplete: false,
  protectionMode: 'standard',
  standaloneBlockPackages: [],
  standaloneBlockUntil: null,
  alwaysOnPackages: [],
  autoCopyToAlwaysOn: false,
  autoCopiedAlwaysOnPackages: [],
  dailyAllowanceEntries: [],
  blockedWords: [],
  aversionDimmerEnabled: false,
  aversionVibrateEnabled: false,
  aversionSoundEnabled: false,
  weeklyReportEnabled: false,
  greyoutSchedule: [],
  systemGuardEnabled: false,
  blockInstallActionsEnabled: false,
  blockYoutubeShortsEnabled: false,
  blockInstagramReelsEnabled: false,
  vpnBlockEnabled: false,
  standaloneVpnPackages: [],
  vpnSelfHealEnabled: false,
  keepFocusActiveUntilTaskEnd: true,
  launcherEnabled: false,
  launcherHiddenPackages: [],
  launcherPinnedPackages: [],
  launcherDockPackages: [],
  launcherWallpaperUri: null,
  launcherClockStyle: 'digital',
  launcherBlockUninstall: false,
  launcherLockDuringStandalone: true,
  overlayWallpaper: '',
  overlayQuotes: [],
  recurringBlockSchedules: [],
  beginnerMode: true,
  tipsCardDismissed: false,
  alwaysOnEnforcementEnabled: false,
  lastShownStreakMilestone: 0,
};