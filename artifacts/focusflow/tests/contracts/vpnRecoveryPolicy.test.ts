import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const nativeRoot = path.resolve(__dirname, '../../android-native/app/src/main/java/com/tbtechs/focusflow');
const vpnService = readFileSync(
  path.join(nativeRoot, 'services/NetworkBlockerVpnService.kt'),
  'utf8',
);
const coordinator = readFileSync(
  path.join(nativeRoot, 'services/VpnPolicyCoordinator.kt'),
  'utf8',
);
const watchdog = readFileSync(
  path.join(nativeRoot, 'services/VpnWatchdogReceiver.kt'),
  'utf8',
);
const accessibility = readFileSync(
  path.join(nativeRoot, 'services/AppBlockerAccessibilityService.kt'),
  'utf8',
);
const foregroundTask = readFileSync(
  path.join(nativeRoot, 'services/ForegroundTaskService.kt'),
  'utf8',
);
const networkBlockModule = readFileSync(
  path.join(nativeRoot, 'modules/NetworkBlockModule.kt'),
  'utf8',
);
const packageInstallReceiver = readFileSync(
  path.join(nativeRoot, 'services/PackageInstallReceiver.kt'),
  'utf8',
);
const appContext = readFileSync(
  path.resolve(__dirname, '../../src/context/AppContext.tsx'),
  'utf8',
);
const activeScreen = readFileSync(
  path.resolve(__dirname, '../../app/active.tsx'),
  'utf8',
);
const vpnPermissionBanner = readFileSync(
  path.resolve(__dirname, '../../src/components/VpnPermissionLostBanner.tsx'),
  'utf8',
);
const nativeInstallScript = readFileSync(
  path.join(nativeRoot, '../../../../../../../install.sh'),
  'utf8',
);
const manifestAdditions = readFileSync(
  path.join(nativeRoot, '../../../../../../../manifest_additions.xml'),
  'utf8',
);

function sliceFunction(source: string, signature: string, nextSignature: string): string {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  expect(start, `missing function: ${signature}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing function boundary: ${nextSignature}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('VPN effective-policy recovery contract', () => {
  it('uses persisted effective-policy recalculation in every native restart path', () => {
    const revoke = sliceFunction(
      vpnService,
      'override fun onRevoke()',
      'override fun onDestroy()',
    );
    const accessibilityHeal = sliceFunction(
      accessibility,
      'private fun checkAndHealVpn()',
      '\n    // ─── Retry mechanism',
    );
    const foregroundHeal = sliceFunction(
      foregroundTask,
      'private fun checkAndHealVpn()',
      '\n    // ─── Notification builders',
    );

    expect(watchdog).toContain('val pkgs   = NetworkBlockerVpnService.effectivePackagesJson(context, prefs)');
    expect(watchdog).toContain('VpnPolicyCoordinator.requestSync(context)');
    expect(revoke).toContain('val pkgs = effectivePackagesJson(ctx, currentPrefs)');
    expect(revoke).toContain('Re-read every policy source after the teardown delay');
    expect(revoke).toContain('VpnPolicyCoordinator.requestSync(ctx)');
    expect(accessibilityHeal).toContain('VpnPolicyCoordinator.requestSync(this)');
    expect(foregroundHeal).toContain('VpnPolicyCoordinator.requestSync(this)');
    expect(vpnService).toContain('VpnPolicyCoordinator.requestSync(this)');
    expect(networkBlockModule).toContain('VpnPolicyCoordinator.requestSync(reactContext)');
    expect(watchdog).not.toContain('val alwaysOn = prefs.getBoolean("always_block_active", false)');
    expect(accessibilityHeal).not.toContain('PREF_ALWAYS_BLOCK');
    expect(foregroundHeal).not.toContain('always_block_active');
    expect(revoke).not.toContain('getString("net_block_packages"');
    expect(accessibilityHeal).not.toContain('getString("net_block_packages"');
    expect(foregroundHeal).not.toContain('getString("net_block_packages"');
    expect(revoke).not.toContain('restartIntent');
    expect(accessibilityHeal).not.toContain('ACTION_START');
    expect(foregroundHeal).not.toContain('ACTION_START');
    expect(networkBlockModule).not.toContain('private fun startVpnService');
  });

  it('shares one effective-policy result with desired-state metadata', () => {
    expect(coordinator).toContain('private data class EffectivePolicy(');
    expect(coordinator).toContain('PREF_STANDALONE_VPN_PKGS');
    expect(coordinator).not.toContain('PREF_STANDALONE_PKGS');
    expect(coordinator).toContain('private const val DISPATCH_DEBOUNCE_MS = 150L');
    expect(coordinator).toContain('pendingDispatch');
    expect(coordinator).toContain('mainHandler.postDelayed');
    expect(vpnService).toContain('EXTRA_POLICY_GENERATION');
    expect(vpnService).toContain('requestedGeneration < currentGeneration');
    expect(coordinator).toContain('val policy = effectivePolicy(context, prefs)');
    expect(coordinator).toContain('policy = policy,');
    expect(coordinator).toContain('put("targetPackages", JSONArray(policy.targets))');
    expect(coordinator).toContain('getApplicationInfo(packageName, 0)');
    expect(coordinator).toContain('put("failedPackages", JSONArray(policy.invalid))');
    expect(coordinator).toContain('addReasons(policy.explicit, "explicit_vpn")');
    expect(coordinator).toContain('addReasons(policy.standalone, "standalone_vpn")');
    expect(coordinator).toContain('addReasons(policy.focus, "focus_blocked")');
    expect(coordinator).toContain('addReasons(policy.invalid, "invalid_package")');
    expect(coordinator).toContain('private fun isFocusBlockActive(prefs: SharedPreferences)');
    expect(coordinator).toContain('.map { arr.optString(it).trim() }');
  });

  it('clears the canonical snapshot before handling an empty effective policy', () => {
    const snapshotWrite = coordinator.indexOf('.putString("net_block_packages", packagesJson)');
    const emptyPolicyCheck = coordinator.indexOf('!global && parsePackageJson(packagesJson).isEmpty()');

    expect(snapshotWrite).toBeGreaterThanOrEqual(0);
    expect(emptyPolicyCheck).toBeGreaterThan(snapshotWrite);
  });

  it('recalculates policy when installed-package availability changes', () => {
    expect(packageInstallReceiver).toContain('Intent.ACTION_PACKAGE_REMOVED');
    expect(packageInstallReceiver).toContain('Intent.ACTION_PACKAGE_FULLY_REMOVED');
    expect(packageInstallReceiver).toContain(
      'val persistentVpn = NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)',
    );
    expect(packageInstallReceiver).toContain(
      'if (action != Intent.ACTION_PACKAGE_ADDED)',
    );
    expect(packageInstallReceiver).toContain(
      'NetworkBlockerVpnService.requestSync(context)',
    );
    expect(nativeInstallScript).toContain(
      '<action android:name="android.intent.action.PACKAGE_REMOVED" />',
    );
    expect(nativeInstallScript).toContain(
      '<action android:name="android.intent.action.PACKAGE_FULLY_REMOVED" />',
    );
    expect(nativeInstallScript).toContain(
      '<action android:name="android.intent.action.USER_UNLOCKED" />',
    );
    expect(nativeInstallScript).toContain(
      '<action android:name="android.intent.action.MY_PACKAGE_REPLACED" />',
    );
    expect(nativeInstallScript).toContain('PACKAGE_REMOVED added to PackageInstallReceiver');
    expect(nativeInstallScript).toContain('PACKAGE_FULLY_REMOVED added to PackageInstallReceiver');
    expect(nativeInstallScript).toContain('USER_UNLOCKED added to BootReceiver');
    expect(nativeInstallScript).toContain('MY_PACKAGE_REPLACED added to BootReceiver');
    expect(manifestAdditions).toContain(
      '<action android:name="android.intent.action.USER_UNLOCKED" />',
    );
    expect(manifestAdditions).toContain(
      '<action android:name="android.intent.action.MY_PACKAGE_REPLACED" />',
    );
  });

  it('preserves task-specific focus policy during settings synchronization', () => {
    expect(appContext).toContain('focusSession?.allowedPackages');
    expect(appContext).toContain('FOCUS_BLOCK_ALL_SENTINEL');
    expect(appContext).toContain(
      'getNativeFocusAllowedPackages(settings, state.focusSession)',
    );
  });

  it('cancels stale watchdog alarms when self-healing is disabled', () => {
    expect(watchdog).toContain('cancel(context)');
    expect(networkBlockModule).toContain('VpnWatchdogReceiver.cancel(reactContext)');
  });

  it('persists source updates without reconfiguring an unchanged healthy service', () => {
    expect(coordinator).toContain('private fun sameServiceState(');
    expect(coordinator).toContain('val serviceStateChanged = !sameServiceState(');
    expect(coordinator).toContain('if (persisted.serviceStateChanged || recoveryNeeded)');
    expect(coordinator).toContain('NetworkBlockerVpnService.isRunning');
    expect(coordinator).toContain('status == NetworkBlockerVpnService.STATUS_RUNNING');
  });

  it('keeps package-removal recovery durable through Expo prebuild', () => {
    expect(nativeInstallScript).toContain('android.intent.action.PACKAGE_REMOVED');
    expect(nativeInstallScript).toContain('android.intent.action.PACKAGE_FULLY_REMOVED');
    expect(manifestAdditions).toContain('android.intent.action.PACKAGE_REMOVED');
    expect(manifestAdditions).toContain('android.intent.action.PACKAGE_FULLY_REMOVED');
    const plugin = readFileSync(
      path.resolve(__dirname, '../../plugins/withFocusDayAndroid.js'),
      'utf8',
    );
    expect(plugin).toContain('packageInstallActions');
    expect(plugin).toContain('android.intent.action.PACKAGE_REMOVED');
    expect(plugin).toContain('android.intent.action.PACKAGE_FULLY_REMOVED');
  });

  it('surfaces VPN permission, conflict, partial-failure, and self-healing states', () => {
    expect(activeScreen).toContain("case 'another_vpn_active':");
    expect(activeScreen).toContain("case 'package_registration_failed':");
    expect(activeScreen).toContain("case 'startup_failed':");
    expect(activeScreen).toContain('Disabled — manual recovery only');
    expect(activeScreen).toContain('vpnStatus.failedPackages.length');
    expect(vpnPermissionBanner).toContain('NetworkBlockModule.isAnotherVpnActive()');
    expect(vpnPermissionBanner).toContain("'Retry VPN'");
    expect(vpnPermissionBanner).toContain('NetworkBlockModule.startNetworkBlock');
  });

  it('does not reintroduce the immutable Kotlin parameter assignment', () => {
    expect(networkBlockModule).not.toContain('packagesJson = effectivePackagesJson');
    expect(accessibility).toContain('private fun checkAndHealVpn()');
    expect(
      accessibility.slice(
        accessibility.indexOf('private fun checkAndHealVpn()'),
        accessibility.indexOf('\n    // ─── Retry mechanism'),
      ),
    ).not.toContain('return false');
  });
});