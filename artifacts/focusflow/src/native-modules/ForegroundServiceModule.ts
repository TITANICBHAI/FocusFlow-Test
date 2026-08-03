/**
 * Android Foreground Service Module — Old Architecture (NativeModules bridge)
 *
 * The ForegroundTaskService runs PERSISTENTLY at all times — not only during focus.
 * This keeps the process alive so Android cannot kill the AccessibilityService.
 *
 * Modes:
 *   IDLE   — Quiet "FocusFlow is monitoring" notification shown at all times.
 *   ACTIVE — Focus session running: shows task name + live countdown.
 *
 * Kotlin: android-native/app/.../services/ForegroundTaskService.kt
 * Registered via: FocusDayPackage → createNativeModules()
 */

import { NativeModules, Platform } from 'react-native';

const ForegroundService = Platform.OS === 'android' ? NativeModules.ForegroundService : null;

if (Platform.OS === 'android' && !ForegroundService) {
  console.error('[ForegroundServiceModule] NativeModules.ForegroundService not found. Ensure an EAS build is used — Expo Go does not include custom native modules.');
}

export const ForegroundServiceModule = {
  async startIdleService(): Promise<void> {
    if (!ForegroundService) return;
    try {
      return await ForegroundService.startIdleService();
    } catch (e) {
      console.warn('[ForegroundServiceModule] startIdleService failed', e);
    }
  },

  async startService(taskId: string, taskName: string, startTimeMs: number, endTimeMs: number, nextTaskName: string | null): Promise<void> {
    if (!ForegroundService) return;
    return ForegroundService.startService(taskId, taskName, startTimeMs, endTimeMs, nextTaskName);
  },

  /**
   * Switches the service to idle mode (session ends).
   * If a session PIN is configured, pinHash must be the SHA-256 hex digest of
   * the PIN — otherwise the native layer will reject the call.
   */
  async stopService(pinHash: string | null = null): Promise<void> {
    if (!ForegroundService) return;
    return ForegroundService.stopService(pinHash);
  },

  async updateNotification(taskId: string, taskName: string, endTimeMs: number, nextTaskName: string | null): Promise<void> {
    if (!ForegroundService) return;
    return ForegroundService.updateNotification(taskId, taskName, endTimeMs, nextTaskName);
  },

  async requestBatteryOptimizationExemption(): Promise<void> {
    if (!ForegroundService) return;
    try {
      return await ForegroundService.requestBatteryOptimizationExemption();
    } catch (e) {
      console.warn('[ForegroundServiceModule] requestBatteryOptimizationExemption failed', e);
    }
  },
};
