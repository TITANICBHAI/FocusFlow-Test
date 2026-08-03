/**
 * NuclearModeModule — Old Architecture (NativeModules bridge)
 *
 * "Nuclear Mode" lets a committed user permanently uninstall their most
 * addictive apps (Instagram, TikTok, etc.) directly from FocusFlow.
 * Each call launches the system uninstall dialog; the user must confirm
 * in the OS dialog, so there is no risk of accidental deletion.
 *
 * Kotlin: android-native/app/.../modules/NuclearModeModule.kt
 * Registered via: FocusDayPackage → createNativeModules()
 *
 * Permission required: android.permission.REQUEST_DELETE_PACKAGES
 * (patched into AndroidManifest.xml by install.sh)
 *
 * Methods:
 *   requestUninstallApp(packageName)   → Promise<void>
 *     Opens the system "Uninstall <App>?" dialog for a single package.
 *     Resolves immediately after the dialog is shown — resolution does NOT
 *     mean the app was uninstalled; the user still has to confirm in the OS UI.
 *
 *   requestUninstallApps(packages)     → Promise<void>
 *     Opens uninstall dialogs for each package sequentially with a 500 ms gap
 *     so the system has time to process each one.
 *
 *   isAppInstalled(packageName)        → Promise<boolean>
 *     Returns true if the given package is currently installed on the device.
 *     Use this to filter the Nuclear Mode selection list before showing it.
 */

import { NativeModules, Platform } from 'react-native';

const NuclearMode = Platform.OS === 'android' ? NativeModules.NuclearMode : null;

if (Platform.OS === 'android' && !NuclearMode) {
  console.warn(
    '[NuclearModeModule] NativeModules.NuclearMode not found. ' +
    'Ensure an EAS build is used — Expo Go does not include custom native modules.',
  );
}

export const NuclearModeModule = {
  /** True when the native bridge is available (i.e. an EAS/custom build, not Expo Go). */
  get isAvailable(): boolean {
    return !!NuclearMode?.requestUninstallApp;
  },

  /**
   * Opens the system "Uninstall <App>?" dialog for a single package.
   * Resolves immediately after the dialog appears — the user still has to confirm.
   * Throws if the native module is unavailable (not an EAS build).
   */
  async requestUninstallApp(packageName: string): Promise<void> {
    if (!NuclearMode?.requestUninstallApp) {
      throw new Error('NuclearMode native module is not available. An EAS build is required.');
    }
    return NuclearMode.requestUninstallApp(packageName);
  },

  /**
   * Opens uninstall dialogs for multiple packages sequentially (500 ms stagger).
   * The array is serialised to JSON before being passed to the Kotlin layer.
   */
  async requestUninstallApps(packages: string[]): Promise<void> {
    if (!NuclearMode?.requestUninstallApps) return;
    return NuclearMode.requestUninstallApps(JSON.stringify(packages));
  },

  /**
   * Returns true if [packageName] is currently installed on this device.
   */
  async isAppInstalled(packageName: string): Promise<boolean> {
    if (!NuclearMode?.isAppInstalled) return false;
    return NuclearMode.isAppInstalled(packageName);
  },
};
