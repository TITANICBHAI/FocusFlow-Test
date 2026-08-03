/**
 * NetworkBlockModule — Old Architecture (NativeModules bridge)
 *
 * Controls the VPN-based network blocking layer that intercepts traffic from
 * blocked apps. When a blocked app is foregrounded the AccessibilityService
 * also disables Wi-Fi and mobile data as a belt-and-suspenders measure.
 *
 * stopNetworkBlock is a session-ending action — it requires a session PIN hash
 * if a PIN has been configured, otherwise native rejects the call silently.
 *
 * Kotlin: android-native/app/.../modules/NetworkBlockModule.kt
 * Registered via: FocusDayPackage → createNativeModules()
 */

import { NativeModules, Platform } from 'react-native';

const NetworkBlock = Platform.OS === 'android' ? NativeModules.NetworkBlock : null;

if (Platform.OS === 'android' && !NetworkBlock) {
  console.warn('[NetworkBlockModule] NativeModules.NetworkBlock not found. Network blocking is unavailable.');
}

function has(name: string): boolean {
  return !!NetworkBlock && typeof NetworkBlock[name] === 'function';
}

export const NetworkBlockModule = {
  async startNetworkBlock(packagesJson: string): Promise<void> {
    if (!has('startNetworkBlock')) return;
    return NetworkBlock.startNetworkBlock(packagesJson);
  },

  /**
   * Tears down the VPN and re-enables Wi-Fi/mobile data.
   * If a session PIN is configured, pinHash must be the SHA-256 hex digest of
   * the PIN — otherwise native silently rejects the call.
   */
  async stopNetworkBlock(pinHash: string | null = null): Promise<void> {
    if (!has('stopNetworkBlock')) return;
    return NetworkBlock.stopNetworkBlock(pinHash);
  },

  async isNetworkBlockActive(): Promise<boolean> {
    if (!has('isNetworkBlockActive')) return false;
    return NetworkBlock.isNetworkBlockActive();
  },

  /**
   * Returns true if the system VPN permission has already been granted.
   * VpnService.prepare() returns null when permission is held.
   */
  async isVpnPermissionGranted(): Promise<boolean> {
    if (!has('isVpnPermissionGranted')) return false;
    return NetworkBlock.isVpnPermissionGranted();
  },

  /**
   * Shows the system "FocusFlow wants to set up a VPN" consent dialog.
   * Must be called from a foregrounded activity — resolves immediately after
   * the dialog Intent is launched. Re-check isVpnPermissionGranted() after
   * the user returns to the app.
   */
  async requestVpnPermission(): Promise<void> {
    if (!has('requestVpnPermission')) return;
    return NetworkBlock.requestVpnPermission();
  },

  /**
   * Returns true if a VPN from a different app is currently active on the device.
   * FocusFlow's own VPN tunnel is excluded — if our service is the active VPN
   * this returns false (no conflict).
   *
   * Use this before enabling VPN blocking to detect a work/privacy VPN that
   * would be replaced and warn the user before Android silently kicks it out.
   */
  async isAnotherVpnActive(): Promise<boolean> {
    if (!has('isAnotherVpnActive')) return false;
    return NetworkBlock.isAnotherVpnActive();
  },

  /**
   * Persists the VPN self-heal preference to SharedPrefs.
   *
   * When enabled, two complementary mechanisms keep the VPN alive mid-session:
   *   1. NetworkBlockerVpnService.onRevoke() schedules a restart (3 s delay).
   *   2. AppBlockerAccessibilityService runs a 10-second health-check loop.
   *
   * Both read the "net_block_self_heal" SharedPrefs key set by this call.
   */
  async setVpnSelfHealEnabled(enabled: boolean): Promise<void> {
    if (!has('setVpnSelfHealEnabled')) return;
    return NetworkBlock.setVpnSelfHealEnabled(enabled);
  },

  /**
   * Returns the full network-block settings as a JSON string.
   * Keys: enabled, vpn, wifi, mobile, global, restore, packages.
   */
  async getNetworkBlockSettings(): Promise<string> {
    if (!has('getNetworkBlockSettings')) return '{}';
    return NetworkBlock.getNetworkBlockSettings();
  },

  /**
   * Persists network-block settings from a partial JSON object string.
   * Only keys present in the object are updated; missing keys are left unchanged.
   * Accepted keys: enabled, vpn, wifi, mobile, global, restore, packages.
   */
  async setNetworkBlockSettings(json: string): Promise<void> {
    if (!has('setNetworkBlockSettings')) return;
    return NetworkBlock.setNetworkBlockSettings(json);
  },

  /**
   * Directly disables Wi-Fi (belt-and-suspenders when VPN is active).
   * No-op on Android 10+ where apps cannot toggle Wi-Fi programmatically.
   */
  async tryDisableWifi(): Promise<void> {
    if (!has('tryDisableWifi')) return;
    return NetworkBlock.tryDisableWifi();
  },

  /**
   * Re-enables Wi-Fi after a block session ends.
   * Only acts if FocusFlow was the last one to disable it.
   */
  async tryRestoreWifi(): Promise<void> {
    if (!has('tryRestoreWifi')) return;
    return NetworkBlock.tryRestoreWifi();
  },
};
