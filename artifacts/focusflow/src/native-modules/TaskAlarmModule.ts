/**
 * Task Alarm Module — Old Architecture (NativeModules bridge)
 *
 * Wraps the native TaskAlarmModule (Kotlin: modules/TaskAlarmModule.kt).
 *
 * Two layers of responsibility:
 *
 *   1. AlarmManager scheduling — registers a real OS-level alarm at the task's
 *      end time. Survives Doze, app standby, JS context teardown, and even
 *      foreground-service kills. This is the *only* alarm mechanism that fires
 *      reliably hours after the screen has gone to sleep. Falls back through
 *      setAlarmClock → setExactAndAllowWhileIdle → setAndAllowWhileIdle so the
 *      strictest available guarantee is used per device + permission state.
 *
 *   2. Visible alarm UI — the native side launches a full-screen
 *      TaskAlarmActivity (with ringtone, vibration, and Done / Extend / Skip
 *      buttons) when the alarm fires. `dismissAlarm` lets the JS layer close
 *      that UI when the user resolves the task from inside the React app.
 */

import { NativeModules, Platform } from 'react-native';
import { logger } from '@/services/startupLogger';

interface TaskAlarmNative {
  scheduleAlarm: (taskId: string, taskName: string, endMs: number) => Promise<boolean>;
  cancelAlarm: (taskId: string) => Promise<boolean>;
  dismissAlarm: (taskId: string | null) => Promise<boolean>;
  canScheduleExactAlarms: () => Promise<boolean>;
  requestExactAlarmPermission: () => Promise<boolean>;
}

const TaskAlarm: TaskAlarmNative | null =
  Platform.OS === 'android' ? (NativeModules.TaskAlarm as TaskAlarmNative) : null;

export const TaskAlarmModule = {
  /**
   * Schedules an OS-level AlarmManager alarm at `endMs` for the given task.
   * Replaces any earlier registration for the same taskId.
   *
   * Returns true if the alarm was scheduled at any precision tier (exact or
   * coarse). Returns false if all tiers failed — typically because the user
   * has revoked "Alarms & reminders" permission on Android 12+ AND the OEM
   * also blocks the coarse fallback. Callers should treat false as a cue to
   * surface the permission flow via [requestExactAlarmPermission].
   *
   * Always resolves — never throws — so the caller can fire-and-forget after
   * scheduling task notifications.
   */
  async scheduleAlarm(taskId: string, taskName: string, endMs: number): Promise<boolean> {
    if (!TaskAlarm) return false;
    try {
      const ok = await TaskAlarm.scheduleAlarm(taskId, taskName, endMs);
      void logger.info(
        'TaskAlarmModule',
        `scheduleAlarm taskId=${taskId} endMs=${endMs} scheduled=${ok}`,
      );
      return ok;
    } catch (e) {
      void logger.warn('TaskAlarmModule', `scheduleAlarm failed for ${taskId}: ${String(e)}`);
      return false;
    }
  },

  /**
   * Cancels any AlarmManager registration for this taskId. Safe to call even
   * if no alarm exists. Always resolves true unless the bridge call itself
   * throws.
   */
  async cancelAlarm(taskId: string): Promise<void> {
    if (!TaskAlarm) return;
    try {
      await TaskAlarm.cancelAlarm(taskId);
    } catch (e) {
      void logger.warn('TaskAlarmModule', `cancelAlarm failed for ${taskId}: ${String(e)}`);
    }
  },

  /**
   * Stops the ringtone, cancels the heads-up notification, and finishes the
   * full-screen alarm activity if it is currently visible for the given task.
   * Pass `null` (or omit) to dismiss any active alarm regardless of taskId.
   */
  async dismissAlarm(taskId: string | null = null): Promise<void> {
    if (!TaskAlarm) return;
    try {
      await TaskAlarm.dismissAlarm(taskId);
    } catch (e) {
      console.warn('[TaskAlarmModule] dismissAlarm failed', e);
    }
  },

  /**
   * Probes whether the OS will honour exact alarm scheduling. Returns true
   * on iOS / web (no-op platforms) and on Android < 12. On Android 12+ this
   * mirrors AlarmManager.canScheduleExactAlarms() — when false, the user
   * needs to grant "Alarms & reminders" in app settings or all alarms will
   * be silently delayed by up to ~10 minutes by Doze.
   */
  async canScheduleExactAlarms(): Promise<boolean> {
    if (!TaskAlarm) return true;
    try {
      return await TaskAlarm.canScheduleExactAlarms();
    } catch {
      return false;
    }
  },

  /**
   * Opens the system "Alarms & reminders" settings page for this app so the
   * user can grant the exact-alarm permission. No-op on platforms that don't
   * need it.
   */
  async requestExactAlarmPermission(): Promise<void> {
    if (!TaskAlarm) return;
    try {
      await TaskAlarm.requestExactAlarmPermission();
    } catch (e) {
      void logger.warn(
        'TaskAlarmModule',
        `requestExactAlarmPermission failed: ${String(e)}`,
      );
    }
  },
};
