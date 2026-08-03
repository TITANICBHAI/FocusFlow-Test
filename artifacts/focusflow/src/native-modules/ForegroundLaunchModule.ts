/**
 * Android Foreground Launch Module — Old Architecture (NativeModules bridge)
 *
 * App-switching utilities used during focus mode.
 *
 * Kotlin: android-native/app/.../modules/ForegroundLaunchModule.kt
 * Registered via: FocusDayPackage → createNativeModules()
 *
 * Methods:
 *   - goHome()                      — send device to home screen (no permission needed)
 *   - bringToFront()                — re-launch FocusFlow over blocked app
 *   - showOverlay(message: string)  — re-launches FocusFlow to the front (alias of bringToFront).
 *                                     A dedicated full-screen lock overlay (FocusLockActivity) is
 *                                     a planned future feature; see ForegroundLaunchModule.kt for
 *                                     implementation requirements.
 *   - hasOverlayPermission()        — returns true if SYSTEM_ALERT_WINDOW is granted
 *   - requestOverlayPermission()    — opens system settings for SYSTEM_ALERT_WINDOW
 */

import { NativeModules, Platform } from 'react-native';

const ForegroundLaunch = Platform.OS === 'android' ? NativeModules.ForegroundLaunch : null;

if (Platform.OS === 'android' && !ForegroundLaunch) {
  console.error('[ForegroundLaunchModule] NativeModules.ForegroundLaunch not found. Ensure an EAS build is used — Expo Go does not include custom native modules.');
}

export const ForegroundLaunchModule = {
  async goHome(): Promise<void> {
    if (!ForegroundLaunch) return;
    return ForegroundLaunch.goHome();
  },

  async bringToFront(): Promise<void> {
    if (!ForegroundLaunch) return;
    return ForegroundLaunch.bringToFront();
  },

  async showOverlay(message: string): Promise<void> {
    if (!ForegroundLaunch) return;
    return ForegroundLaunch.showOverlay(message);
  },

  async hasOverlayPermission(): Promise<boolean> {
    if (!ForegroundLaunch) return false;
    return ForegroundLaunch.hasOverlayPermission();
  },

  async requestOverlayPermission(): Promise<void> {
    if (!ForegroundLaunch) return;
    return ForegroundLaunch.requestOverlayPermission();
  },
};
