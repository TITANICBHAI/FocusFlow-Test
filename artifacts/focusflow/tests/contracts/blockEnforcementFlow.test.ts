import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const nativeRoot = path.resolve(__dirname, '../../android-native/app/src/main/java/com/tbtechs/focusflow');
const accessibilityService = readFileSync(
  path.join(nativeRoot, 'services/AppBlockerAccessibilityService.kt'),
  'utf8',
);
const overlayActivity = readFileSync(
  path.join(nativeRoot, 'services/BlockOverlayActivity.kt'),
  'utf8',
);

type ProcessState = 'blocked-app' | 'overlay' | 'home' | 'focusflow';
type Action = 'BACK' | 'HOME';

function simulateDismissal(): { state: ProcessState; actions: Action[] } {
  // Mirrors dismissPackage's observable system interaction. The real delays are
  // asserted against the Kotlin source below; this model makes the contract
  // explicit and easy to reason about without claiming to be Android runtime
  // behavior.
  const actions: Action[] = ['BACK', 'HOME'];
  return { state: 'home', actions };
}

describe('blocked-app system interaction contract', () => {
  it('broadcasts the blocked package before overlay and dismissal work', () => {
    const blocked = accessibilityService.indexOf('sendBroadcast(broadcast)');
    const network = accessibilityService.indexOf('triggerNetworkBlock(blockedPackage)');
    const overlay = accessibilityService.indexOf('launchBlockOverlay(blockedPackage, fullReason)');
    const dismissal = accessibilityService.indexOf('dismissPackage(blockedPackage)');

    expect(blocked).toBeGreaterThanOrEqual(0);
    expect(network).toBeGreaterThan(blocked);
    expect(overlay).toBeGreaterThan(network);
    expect(dismissal).toBeGreaterThan(overlay);
    expect(accessibilityService).toContain('putExtra(FocusDayBridgeModule.EXTRA_BLOCKED_PKG, blockedPackage)');
  });

  it('uses BACK first, then HOME for a normal blocked app and preserves installer safety', () => {
    const dismissStart = accessibilityService.indexOf('private fun dismissPackage(blockedPackage: String)');
    const dismissEnd = accessibilityService.indexOf('\n    }', dismissStart);
    const dismissSource = accessibilityService.slice(dismissStart, dismissEnd);
    const policy = readFileSync(
      path.join(nativeRoot, 'services/BlockedAppDismissalPolicy.kt'),
      'utf8',
    );

    expect(dismissSource).toContain('BlockedAppDismissalPolicy.actionsFor(blockedPackage, INSTALLER_PACKAGES)');
    expect(dismissSource).toContain('GlobalAction.BACK');
    expect(dismissSource).toContain('GlobalAction.HOME');
    expect(policy).toContain('GlobalAction.BACK, 0L');
    expect(policy).toContain('GlobalAction.BACK, 30L');
    expect(policy).toContain('GlobalAction.HOME, 80L');
    expect(policy).toContain('GlobalAction.BACK, 100L');
    expect(policy).toContain('equals(blockedPackage, ignoreCase = true)');

    const simulated = simulateDismissal();
    expect(simulated.actions).toEqual(['BACK', 'BACK', 'HOME', 'BACK']);
    expect(simulated.state).toBe('home');
  });

  it('does not let a delayed retry kick an allowed app after the user switches processes', () => {
    const retryStart = accessibilityService.indexOf('private fun scheduleRetryCheck(');
    const retryEnd = accessibilityService.indexOf('\n    }', retryStart);
    const retrySource = accessibilityService.slice(retryStart, retryEnd);
    const policy = readFileSync(
      path.join(nativeRoot, 'services/BlockedAppDismissalPolicy.kt'),
      'utf8',
    );

    expect(retrySource).toContain('val isBlocked = isPackageBlocked(pkg, focusActive, saActive, alwaysBlock)');
    expect(retrySource).toContain('BlockedAppDismissalPolicy.shouldRetry(');
    expect(retrySource).toContain('dismissPackage(pkg)');
    expect(policy).toContain('if (lastSeenPackage != blockedPackage) return false');
    expect(policy).toContain('if (!focusActive && !standaloneActive && !alwaysOnActive) return false');
    expect(policy).toContain('return isBlocked || allowanceExhausted');
  });

  it('keeps watchdog foreground and cooldown state aligned with accessibility events', () => {
    const watchdogStart = accessibilityService.indexOf('private fun checkForegroundNow()');
    const watchdogEnd = accessibilityService.indexOf(
      '\n    private fun startForegroundWatchdog()',
      watchdogStart,
    );
    const watchdogSource = accessibilityService.slice(watchdogStart, watchdogEnd);

    const packageAssignment = watchdogSource.indexOf('lastSeenPkg = pkg');
    expect(packageAssignment).toBeGreaterThanOrEqual(0);
    expect(packageAssignment).toBeLessThan(
      watchdogSource.indexOf('if (pkg == packageName) return'),
    );

    const neverBlockBranch = watchdogSource.indexOf(
      'if (NEVER_BLOCK.any { pkg.equals(it, ignoreCase = true) }) {',
    );
    expect(neverBlockBranch).toBeGreaterThanOrEqual(0);
    const neverBlockReset = watchdogSource.indexOf(
      'lastBlockedPkg = null',
      neverBlockBranch,
    );
    const neverBlockTimestampReset = watchdogSource.indexOf(
      'lastBlockedAtMs = 0L',
      neverBlockBranch,
    );
    expect(neverBlockReset).toBeGreaterThan(neverBlockBranch);
    expect(neverBlockTimestampReset).toBeGreaterThan(neverBlockReset);

    const greyoutCheck = watchdogSource.indexOf('if (isInGreyoutWindow(pkg))');
    const inactiveGate = watchdogSource.indexOf(
      'if (!focusActive && !saActive && !alwaysBlockActive)',
    );
    const explicitCheck = watchdogSource.indexOf(
      'val blocked = isPackageBlocked(pkg, focusActive, saActive, alwaysBlockActive)',
    );
    const allowanceCheck = watchdogSource.indexOf(
      'val allowanceEntry = findAllowanceEntry(pkg)',
    );
    expect(greyoutCheck).toBeGreaterThanOrEqual(0);
    expect(greyoutCheck).toBeLessThan(inactiveGate);
    expect(inactiveGate).toBeLessThan(explicitCheck);
    expect(explicitCheck).toBeLessThan(allowanceCheck);
    expect(watchdogSource).toContain('handleBlockedApp(pkg, "Blocked by your active block schedule")');
    expect(watchdogSource).toContain(
      'handleBlockedApp(pkg, allowanceExhaustedReason(pkg, allowanceEntry))',
    );

    const inactiveReset = watchdogSource.indexOf(
      'lastBlockedPkg = null',
      inactiveGate,
    );
    const inactiveTimestampReset = watchdogSource.indexOf(
      'lastBlockedAtMs = 0L',
      inactiveGate,
    );
    expect(inactiveReset).toBeGreaterThan(inactiveGate);
    expect(inactiveTimestampReset).toBeGreaterThan(inactiveReset);
  });

  it('swallows the overlay Back button without ending enforcement', () => {
    const backStart = overlayActivity.indexOf('override fun onBackPressed()');
    const backEnd = overlayActivity.indexOf('\n    }', backStart);
    const backSource = overlayActivity.slice(backStart, backEnd);
    const launchStart = overlayActivity.indexOf('private fun launchFocusFlow()');
    const launchEnd = overlayActivity.indexOf('\n    }', launchStart);
    const launchSource = overlayActivity.slice(launchStart, launchEnd);

    expect(backSource).toContain('Intentionally do nothing');
    expect(backSource).not.toContain('launchFocusFlow()');
    expect(launchSource).toContain('startActivity(focusFlowIntent)');
    expect(launchSource).toContain('finish()');
    expect(launchSource).toContain('putBoolean("block_cooldown_reset", true)');
    expect(launchSource).not.toContain('putBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false)');
    expect(overlayActivity).toContain('TRUSTED_FOCUSFLOW_CLASSES');
    expect(overlayActivity).toContain('FLAG_ACTIVITY_CLEAR_TOP');
    expect(overlayActivity).toContain('FLAG_ACTIVITY_SINGLE_TOP');
  });

  it('requires a non-self foreground process before revealing the close action', () => {
    const signalStart = accessibilityService.indexOf('val awaitingPkg = prefs.getString("overlay_awaiting_pkg", "")');
    const signalEnd = accessibilityService.indexOf('\n        // Some OEM home-screen', signalStart);
    const signalSource = accessibilityService.slice(signalStart, signalEnd);
    const selfGuard = accessibilityService.indexOf('if (pkg == packageName) return');

    expect(selfGuard).toBeGreaterThanOrEqual(0);
    expect(selfGuard).toBeLessThan(signalStart);
    expect(signalSource).toContain('if (awaitingPkg.isNotEmpty() && !pkg.equals(awaitingPkg, ignoreCase = true))');
    expect(signalSource).toContain('putBoolean(BlockOverlayActivity.PREF_OVERLAY_X_READY, true)');
    expect(signalSource).toContain('putString("overlay_awaiting_pkg", "")');
  });
});