/**
 * SharedPrefsModule — Old Architecture (NativeModules bridge)
 *
 * Writes focus-mode and standalone-block state into Android SharedPreferences so:
 *   - AppBlockerAccessibilityService knows which apps to block even when JS is not running
 *   - BootReceiver can restore the foreground service state after device reboot
 *
 * Kotlin: android-native/app/.../modules/SharedPrefsModule.kt
 * Registered via: FocusDayPackage → createNativeModules()
 */

import { NativeModules, Platform } from 'react-native';
import type { DailyAllowanceEntry } from '@/data/types';
import { logger } from '@/services/startupLogger';

const SharedPrefs = Platform.OS === 'android' ? NativeModules.SharedPrefs : null;

if (Platform.OS === 'android' && !SharedPrefs) {
  void logger.error('SharedPrefsModule', 'NativeModules.SharedPrefs not found. Ensure an EAS build is used — Expo Go does not include custom native modules.');
}

/**
 * Wraps a native SharedPrefs call and logs any thrown error via the startup
 * logger so the ErrorAlertBanner auto-surfaces it to the developer.
 */
async function callNative<T>(methodName: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    void logger.error('SharedPrefsModule', `${methodName} threw: ${String(e)}`);
    return undefined;
  }
}

export const isSharedPrefsAvailable = Platform.OS === 'android' && SharedPrefs != null;

function hasSharedPrefsMethod(name: string): boolean {
  return !!SharedPrefs && typeof SharedPrefs[name] === 'function';
}

export const SharedPrefsModule = {
  /**
   * Tells native whether task focus is active.
   * When deactivating (active=false) and a session PIN is configured, pinHash
   * must be the SHA-256 hex digest of the PIN — otherwise the call is rejected.
   */
  async setFocusActive(active: boolean, pinHash: string | null = null): Promise<void> {
    if (!hasSharedPrefsMethod('setFocusActive')) return;
    await callNative('setFocusActive', () => SharedPrefs.setFocusActive(active, pinHash));
  },

  async setAllowedPackages(packages: string[]): Promise<void> {
    if (!hasSharedPrefsMethod('setAllowedPackages')) return;
    await callNative('setAllowedPackages', () => SharedPrefs.setAllowedPackages(packages));
  },

  async setActiveTask(taskId: string, name: string, endMs: number, nextName: string | null): Promise<void> {
    if (!hasSharedPrefsMethod('setActiveTask')) return;
    await callNative('setActiveTask', () => SharedPrefs.setActiveTask(taskId, name, endMs, nextName ?? null));
  },

  /**
   * Writes the active task's accent color (hex string, e.g. "#6366f1") so the
   * widget can tint its header / sub-line. Pass an empty string to clear.
   * Triggers a widget redraw on the native side.
   */
  async setActiveTaskColor(colorHex: string): Promise<void> {
    if (!hasSharedPrefsMethod('setActiveTaskColor')) return;
    await callNative('setActiveTaskColor', () => SharedPrefs.setActiveTaskColor(colorHex ?? ''));
  },

  /**
   * Persists the wall-clock start time of the active task so the widget can
   * draw a progress bar even when the session was not started by the focus
   * service. Idempotent — only writes when task identity changes.
   * Pass 0 / negative to clear.
   */
  async setActiveTaskStartMs(taskId: string, startMs: number): Promise<void> {
    if (!hasSharedPrefsMethod('setActiveTaskStartMs')) return;
    await callNative('setActiveTaskStartMs', () => SharedPrefs.setActiveTaskStartMs(taskId, startMs));
  },

  /**
   * Clears the active-task fields in SharedPreferences (without touching focus
   * or block state) and pushes a widget redraw.
   */
  async clearActiveTask(): Promise<void> {
    if (!hasSharedPrefsMethod('clearActiveTask')) return;
    await callNative('clearActiveTask', () => SharedPrefs.clearActiveTask());
  },

  /**
   * Forces a redraw of any home-screen widgets using whatever is currently in
   * SharedPreferences. Use after standalone-block / task state changes that
   * happen outside a focus session (where ForegroundTaskService would have
   * pushed automatically).
   */
  async pushWidgetUpdate(): Promise<void> {
    if (!hasSharedPrefsMethod('pushWidgetUpdate')) return;
    await callNative('pushWidgetUpdate', () => SharedPrefs.pushWidgetUpdate());
  },

  /**
   * Controls standalone app blocking.
   *
   * When cancelling an active (not-yet-expired) session (active=false while the
   * stored until timestamp is still in the future), [pinHash] must be the
   * SHA-256 hex of the session PIN — otherwise the native call is rejected.
   * Natural expiry and starting a new block never require a PIN.
   */
  async setStandaloneBlock(active: boolean, packages: string[], untilMs: number, pinHash: string | null = null): Promise<void> {
    if (!hasSharedPrefsMethod('setStandaloneBlock')) return;
    await callNative('setStandaloneBlock', () => SharedPrefs.setStandaloneBlock(active, packages, untilMs, pinHash));
  },

  /**
   * Enables or disables always-on block enforcement, independent of any timed session.
   *
   * When active=true, the AccessibilityService enforces the provided package list
   * and all configured daily allowance rules even when no focus task or standalone
   * block timer is running.  The UI "locked" state is NOT affected — settings can
   * still be changed when no timed session is active.
   *
   * @param active    Whether always-on enforcement is enabled
   * @param packages  Package names to always block (empty list = only allowance enforced)
   */
  async setAlwaysBlockActive(active: boolean, packages: string[]): Promise<void> {
    if (!hasSharedPrefsMethod('setAlwaysBlockActive')) return;
    await callNative('setAlwaysBlockActive', () => SharedPrefs.setAlwaysBlockActive(active, packages));
  },

  /**
   * Writes the rich daily allowance config (DailyAllowanceEntry[]) to SharedPreferences
   * as a JSON string. The AccessibilityService reads this to enforce per-app allowance modes.
   *
   * Replaces the old setDailyAllowancePackages (string[]) method.
   */
  async setDailyAllowanceConfig(entries: DailyAllowanceEntry[]): Promise<void> {
    if (!hasSharedPrefsMethod('setDailyAllowanceConfig')) return;
    await callNative('setDailyAllowanceConfig', () => SharedPrefs.setDailyAllowanceConfig(JSON.stringify(entries)));
  },

  async resetDailyAllowanceUsage(packageName: string | null): Promise<void> {
    if (!hasSharedPrefsMethod('resetDailyAllowanceUsage')) return;
    await callNative('resetDailyAllowanceUsage', () => SharedPrefs.resetDailyAllowanceUsage(packageName ?? null));
  },

  async setBlockedWords(words: string[]): Promise<void> {
    if (!hasSharedPrefsMethod('setBlockedWords')) return;
    await callNative('setBlockedWords', () => SharedPrefs.setBlockedWords(words));
  },

  async setSystemGuardEnabled(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setSystemGuardEnabled')) return;
    await callNative('setSystemGuardEnabled', () => SharedPrefs.setSystemGuardEnabled(enabled));
  },

  async setBlockInstallActionsEnabled(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setBlockInstallActionsEnabled')) return;
    await callNative('setBlockInstallActionsEnabled', () => SharedPrefs.setBlockInstallActionsEnabled(enabled));
  },

  async setBlockYoutubeShortsEnabled(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setBlockYoutubeShortsEnabled')) return;
    await callNative('setBlockYoutubeShortsEnabled', () => SharedPrefs.setBlockYoutubeShortsEnabled(enabled));
  },

  async setBlockInstagramReelsEnabled(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setBlockInstagramReelsEnabled')) return;
    await callNative('setBlockInstagramReelsEnabled', () => SharedPrefs.setBlockInstagramReelsEnabled(enabled));
  },

  /**
   * Enables or disables the VPN network-blocking layer.
   * Writes the "net_block_enabled" boolean read by AppBlockerAccessibilityService
   * before it attempts to start NetworkBlockerVpnService for a blocked package.
   */
  async setNetworkBlockEnabled(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setNetworkBlockEnabled')) return;
    await callNative('setNetworkBlockEnabled', () => SharedPrefs.setNetworkBlockEnabled(enabled));
  },

  /**
   * Writes the per-app VPN package list (JSON array string) to SharedPreferences.
   * When non-empty, only listed packages trigger network blocking.
   * When empty, all blocked packages trigger network blocking (if vpnBlockEnabled).
   */
  async setVpnSelectedPackages(packages: string[]): Promise<void> {
    if (!hasSharedPrefsMethod('setVpnSelectedPackages')) return;
    await callNative('setVpnSelectedPackages', () => SharedPrefs.setVpnSelectedPackages(JSON.stringify(packages)));
  },

  /**
   * Writes the list of packages that are hidden from FocusFlow's home launcher
   * app drawer. Only blocked packages should be hidden — enforced by UI, not native.
   */
  async setLauncherHiddenPackages(packages: string[]): Promise<void> {
    if (!hasSharedPrefsMethod('setLauncherHiddenPackages')) return;
    await callNative('setLauncherHiddenPackages', () => SharedPrefs.setLauncherHiddenPackages(JSON.stringify(packages)));
  },

  /**
   * Writes the ordered list of packages for the home launcher's persistent
   * bottom dock (max 5). Stored as a JSON array string in SharedPreferences.
   */
  async setLauncherDockPackages(packages: string[]): Promise<void> {
    if (!hasSharedPrefsMethod('setLauncherDockPackages')) return;
    await callNative('setLauncherDockPackages', () => SharedPrefs.setLauncherDockPackages(JSON.stringify(packages)));
  },

  /**
   * Controls whether the default-home-app chooser in Android Settings is
   * intercepted and redirected HOME when a standalone block is active.
   * Defaults to true — prevents swapping away from the FocusFlow launcher
   * during a block session.
   */
  async setLauncherLockDuringStandalone(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setLauncherLockDuringStandalone')) return;
    await callNative('setLauncherLockDuringStandalone', () => SharedPrefs.setLauncherLockDuringStandalone(enabled));
  },

  /**
   * When true, any long-press "Uninstall" option shown by a launcher package
   * is suppressed via the accessibility service even if System Protection is
   * off — gives the FocusFlow launcher its own independent uninstall guard.
   */
  async setLauncherBlockUninstall(enabled: boolean): Promise<void> {
    if (!hasSharedPrefsMethod('setLauncherBlockUninstall')) return;
    await callNative('setLauncherBlockUninstall', () => SharedPrefs.setLauncherBlockUninstall(enabled));
  },

  /**
   * Checks whether FocusFlow is the currently configured default home app.
   * Returns false on non-Android or when the native bridge is unavailable.
   */
  async isDefaultLauncher(): Promise<boolean> {
    if (!hasSharedPrefsMethod('isDefaultLauncher')) return false;
    const result = await callNative('isDefaultLauncher', () => SharedPrefs.isDefaultLauncher() as Promise<boolean>);
    return Boolean(result ?? false);
  },

  async putString(key: string, value: string): Promise<void> {
    if (!hasSharedPrefsMethod('putString')) return;
    await callNative('putString', () => SharedPrefs.putString(key, value));
  },

  /**
   * Reads a string value from SharedPreferences by key.
   * Returns null if the key is absent or the native module is unavailable.
   * Used by AppContext to cross-check critical flags (e.g. privacy_accepted)
   * that are backed up in SharedPreferences in case the SQLite DB is wiped.
   */
  async getString(key: string): Promise<string | null> {
    if (!hasSharedPrefsMethod('getString')) return null;
    const result = await callNative('getString', () => SharedPrefs.getString(key) as Promise<string | null>);
    return result ?? null;
  },

  /**
   * Returns true when the installed APK was built debuggable (debug variant).
   * Falls back to JS `__DEV__` when the native bridge is unavailable (Expo Go,
   * iOS, web). Use this to gate developer-only UI like the Diagnostics screen
   * — `__DEV__` alone is false in debug-built APKs that run their prebundled
   * JS, which would hide the screen exactly when it's needed.
   */
  async isDebuggableBuild(): Promise<boolean> {
    if (!hasSharedPrefsMethod('isDebuggable')) return __DEV__;
    const result = await callNative('isDebuggable', () => SharedPrefs.isDebuggable() as Promise<boolean>);
    return Boolean(result ?? __DEV__);
  },

  /**
   * Writes the preferred clock style for FocusFlow's home launcher.
   * LauncherActivity reads "launcher_clock_style" on every clock tick and
   * renders either a large digital TextView or an analog canvas clock.
   *
   * @param style  'digital' (default) | 'analog'
   */
  async setLauncherClockStyle(style: 'digital' | 'analog'): Promise<void> {
    if (!hasSharedPrefsMethod('setLauncherClockStyle')) return;
    await callNative('setLauncherClockStyle', () => SharedPrefs.setLauncherClockStyle(style));
  },

  /**
   * Pushes today's progress snapshot (tasks done/total, focus minutes, streak)
   * into SharedPreferences so the home-screen widget can show motivational
   * context (e.g. "3/5 tasks · 45m today" with a streak chip) when no task
   * is active. Triggers a widget redraw on the native side.
   */
  async setDailyStats(
    tasksDone: number,
    tasksTotal: number,
    focusMins: number,
    streakDays: number,
  ): Promise<void> {
    if (!hasSharedPrefsMethod('setDailyStats')) return;
    await callNative('setDailyStats', () => SharedPrefs.setDailyStats(
      Math.max(0, Math.floor(tasksDone)),
      Math.max(0, Math.floor(tasksTotal)),
      Math.max(0, Math.floor(focusMins)),
      Math.max(0, Math.floor(streakDays)),
    ));
  },
};
