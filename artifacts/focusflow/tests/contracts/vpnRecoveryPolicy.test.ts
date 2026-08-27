import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const nativeRoot = path.resolve(__dirname, '../../android-native/app/src/main/java/com/tbtechs/focusflow');
const vpnService = readFileSync(
  path.join(nativeRoot, 'services/NetworkBlockerVpnService.kt'),
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
    expect(watchdog).toContain('NetworkBlockerVpnService.EXTRA_POLICY_GENERATION');
    expect(revoke).toContain('val pkgs = effectivePackagesJson(ctx, currentPrefs)');
    expect(revoke).toContain('Re-read every policy source after the teardown delay');
    expect(revoke).toContain('currentPolicyGeneration(currentPrefs)');
    expect(accessibilityHeal).toContain('NetworkBlockerVpnService.effectivePackagesJson(this, prefs)');
    expect(accessibilityHeal).toContain('EXTRA_POLICY_GENERATION');
    expect(foregroundHeal).toContain('NetworkBlockerVpnService.effectivePackagesJson(this, prefs)');
    expect(foregroundHeal).toContain('EXTRA_POLICY_GENERATION');
    expect(watchdog).not.toContain('val alwaysOn = prefs.getBoolean("always_block_active", false)');
    expect(accessibilityHeal).not.toContain('PREF_ALWAYS_BLOCK');
    expect(foregroundHeal).not.toContain('always_block_active');
    expect(revoke).not.toContain('getString("net_block_packages"');
    expect(accessibilityHeal).not.toContain('getString("net_block_packages"');
    expect(foregroundHeal).not.toContain('getString("net_block_packages"');
  });

  it('shares one effective-policy result with desired-state metadata', () => {
    expect(vpnService).toContain('private data class EffectivePolicy(');
    expect(vpnService).toContain('EXTRA_POLICY_GENERATION');
    expect(vpnService).toContain('requestedGeneration < currentGeneration');
    expect(vpnService).toContain('val policy = effectivePolicy(context, prefs)');
    expect(vpnService).toContain('policy = policy,');
    expect(vpnService).toContain('put("targetPackages", JSONArray(policy.targets))');
    expect(vpnService).toContain('getApplicationInfo(packageName, 0)');
    expect(vpnService).toContain('put("failedPackages", JSONArray(policy.invalid))');
    expect(vpnService).toContain('addReasons(policy.explicit, "explicit_vpn")');
    expect(vpnService).toContain('addReasons(policy.standalone, "standalone_block")');
    expect(vpnService).toContain('addReasons(policy.focus, "focus_blocked")');
    expect(vpnService).toContain('addReasons(policy.invalid, "invalid_package")');
  });

  it('clears the canonical snapshot before handling an empty effective policy', () => {
    const sync = sliceFunction(
      vpnService,
      'private fun requestSyncLocked(context: Context)',
      '\n        private fun parsePackageJson',
    );
    const snapshotWrite = sync.indexOf('.putString("net_block_packages", packagesJson)');
    const emptyPolicyCheck = sync.indexOf('if (!global && parsePackageJson(packagesJson).isEmpty())');

    expect(snapshotWrite).toBeGreaterThanOrEqual(0);
    expect(emptyPolicyCheck).toBeGreaterThan(snapshotWrite);
  });
});