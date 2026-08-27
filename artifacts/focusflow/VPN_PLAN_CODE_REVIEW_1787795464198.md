# VPN Background Enforcement Plan — Code-Verified Review

Every claim below is pinned to a specific file and line in the actual source.
No invented facts. Where something is uncertain, it is marked.

**Tracker reconciled:** 2026-08-27

## Review tracker

**Legend:** ✅ confirmed in the current codebase · ❌ unresolved, missing, or
not implemented.

### Confirmed behavior

- ✅ Explicit per-app VPN targets block foreground and background traffic.
- ✅ Focus-blocked packages are mirrored into the VPN list only when the opt-in
  focus-mirroring setting is enabled.
- ✅ Recurring schedule VPN fields are currently unused.
- ✅ Always-on-only watchdog recovery is rearmed after boot when persistent VPN
  protection and self-healing are enabled.
- ✅ `isRunning` is process-local and transient after process death.
- ✅ The old 400 ms focus-stop race workaround is no longer used; coordinator
  dispatch now serializes policy teardown and reconfiguration.
- ✅ Accessibility-triggered enforcement uses the VPN path, not Wi-Fi/mobile-data disabling.
- ✅ FocusFlow already avoids rebuilding an unchanged VPN target set.

### Implementation status

- ✅ Always-on-only watchdog rearm is implemented.
- ✅ The former competing VPN package write paths now feed explicit and
  standalone VPN source slots owned by the coordinator; the coordinator alone
  produces the effective compatibility snapshot.
- ✅ Overlay and VPN sources have explicit separate ownership; intentional
  differences between an overlay list and a VPN list are preserved.
- ✅ Package install/removal broadcasts trigger effective-policy recalculation
  without treating ordinary standalone overlay packages as VPN targets.
- ✅ Native policy coordinator and durable desired-state contract are implemented,
  including source reasons, failed-package metadata, debounce, and generations.
- ✅ Opt-in focus mirroring is implemented with an off default.
- ✅ Unexpected VPN service destruction re-arms self-healing, and the coordinator
  can retry stopped or failed service states without duplicating an in-flight start.
- ✅ Enabling self-healing immediately reconciles an existing durable VPN policy;
  disabling it still cancels the watchdog.
- ❌ Decide and implement recurring schedule VPN support if approved.
- ❌ Complete lifecycle, device, and real network verification.

---

## 1. WHAT THE PLAN GETS RIGHT (confirmed in code)

### 1.1 Per-app VPN already blocks background traffic

**Plan claim:** `addAllowedApplication` routes all traffic for that UID — foreground,
background, background services, downloads. Background enforcement for explicitly
VPN-listed apps is therefore already working.

**Code confirmation:**
`NetworkBlockerVpnService.kt:330-347` — PER_APP mode calls
`builder.addAllowedApplication(pkg)` for each target package. Android routes all
packets for that UID into the null-routing TUN and they are dropped. There is no
read loop, no forwarding. The OS kills the socket. This is correct and already live.

**Conclusion:** The plan's central claim is accurate. If YouTube is in `net_block_packages`,
a background YouTube download is already blocked today. No new mechanism is needed
for that specific behaviour.

---

### 1.2 Opt-in focus mirroring adds focus-blocked apps to the VPN list

**Current behavior:** The VPN list includes `alwaysOnVpnPackages` and active
`standaloneVpnPackages`, plus focus-blocked packages when the opt-in
`focusMirrorVpnEnabled` setting is enabled. With that setting disabled, apps
blocked only by the Accessibility focus rule remain network-allowed.

**Code confirmation:**
`NetworkBlockModule.kt:198-212` persists the explicit VPN list, standalone VPN
source, and focus-mirroring preference. `VpnPolicyCoordinator.kt:244-258`
derives the focus targets from the persisted allow-list when mirroring is on,
and `:305-307` records the `focus_blocked` reason.

**Conclusion:** The original gap is addressed as an opt-in feature. Focus-blocked
apps continue to have background network access when mirroring is off, and are
added to the per-app VPN target set when mirroring is on.

---

### 1.3 Recurring schedule VPN fields are dead code

**Plan claim:** `RecurringBlockSchedule.vpnEnabled` and `vpnPackages` (types.ts:94-99)
are never consumed. Schedules only produce greyout windows.

**Code confirmation:**
`AppContext.tsx:673-696` — `_recurringSchedulesToGreyoutWindows()` iterates schedules
and produces `GreyoutWindow` entries. It never reads `sched.vpnEnabled` or
`sched.vpnPackages`. No other function in AppContext reads those fields.
Searching the full codebase for `vpnEnabled` returns only the type definition and
`standaloneVpnPackages` setters — nothing that reads from a `RecurringBlockSchedule`.

**Conclusion:** Confirmed. Scheduled network blocking is not implemented. The type
fields exist and do nothing.

---

### 1.4 Boot watchdog rearm covers always-on-only config

**Current behavior:** `BootReceiver` checks the durable VPN policy before its
focus-session branch and rearms the watchdog for persistent always-on-only
configurations when self-healing is enabled.

**Code confirmation:**
`BootReceiver.kt:54-77` obtains
`NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)` and calls
`VpnWatchdogReceiver.schedule(context)` when the persistent VPN policy,
`net_block_enabled`, and self-healing are all enabled:
```kotlin
if (persistentVpn && netBlockEnabled && selfHeal) {
    VpnWatchdogReceiver.schedule(context)
}
```

**Conclusion:** The always-on-only boot-recovery gap is fixed in source. Actual
reboot behavior still requires generated Android/device verification.

---

### 1.5 `isRunning` is process-local — false after process death

**Plan claim:** `NetworkBlockerVpnService.isRunning` is a process-local static. After
the process is killed, it resets to false even if Android still holds an active tunnel.

**Code confirmation:**
`NetworkBlockerVpnService.kt:110`:
```kotlin
@Volatile var isRunning: Boolean = false
```
This is a JVM static field. It is initialised to `false` on class load, which happens
on every fresh process start. `checkAndHealVpn()` (`AppBlockerAccessibilityService.kt:1466`)
and `VpnWatchdogReceiver` (`VpnWatchdogReceiver.kt:144`) still use it as the
in-process fast path. The coordinator also consults the durable `vpn_status` and
the persisted desired policy: when the policy expects a running VPN but
`isRunning` is false while status is `running`, it schedules recovery.

**Conclusion:** Confirmed. `vpn_status` and the desired policy are the durable
recovery signals; `isRunning` remains transient and is not sufficient by itself.

---

### 1.6 Coordinator dispatch replaces the old focus-stop delay workaround

**Previous behavior:** The stop-then-restart sequence used a 400 ms delay as a
best-effort race workaround.

**Code confirmation:**
`AppContext.tsx:1606-1627` now performs focus teardown through the native
service/coordinator path, while `VpnPolicyCoordinator.kt:158-173` debounces
and coalesces native dispatch. The coordinator recalculates after durable
source updates instead of relying on an arbitrary JavaScript delay.
```typescript
await NetworkBlockModule.stopNetworkBlock(pinHash);
```

**Conclusion:** The JavaScript timing workaround has been removed. The native
coordinator provides serialization and debounce; no device-level claim is made
until Android lifecycle and handoff tests are run.

---

### 1.7 WiFi/mobile disable is not triggered from the AccessibilityService path

**Plan claim:** `triggerNetworkBlock()` in the AccessibilityService only fires the VPN
start intent. The WiFi and mobile-data direct-disable calls are never made from
background enforcement.

**Code confirmation:**
`AppBlockerAccessibilityService.kt:2808-2885` — `triggerNetworkBlock()` only calls
`startForegroundService(intent)` with `ACTION_START`. There is no call to
`tryDisableWifiInternal()` or the mobile-data reflection path. The comment at lines
2830-2833 explicitly says this is intentional because those methods require a Context
not available in an AccessibilityService. Those supplementary actions only run from the
JS layer via `NetworkBlockModule`.

**Conclusion:** Confirmed. The VPN is the only background enforcement path.

---

### 1.8 Manual JSON quoting in SharedPrefsModule

**Plan claim:** SharedPrefsModule manually quotes package strings instead of using
`JSONArray`, making malformed bridge input capable of corrupting the JSON.

**Code confirmation:**
`SharedPrefsModule.kt:298-299` (in `setAlwaysBlockActive`):
```kotlin
val list = (0 until packages.size()).map { "\"${packages.getString(it)}\"" }
val json = "[${list.joinToString(",")}]"
```
Same pattern in `setAllowedPackages` (line ~107) and `setDailyAllowancePackages`.
A package name containing a double-quote or backslash (impossible for valid Android
package names per their naming rules, but not validated) would produce broken JSON.
`net_block_packages` written by `NetworkBlockModule.setNetworkBlockSettings` goes
through `JSONObject.getString("packages")` which is properly escaped, so that write
path is safe.

**Conclusion:** The plan's concern is valid but low-risk in practice because Android
package names follow a strict identifier format. Still worth fixing.

---

## 2. WHERE THE PLAN OVERSTATES OR MISREADS THE CODE

### 2.1 "Track the current target set" — already implemented

**Plan recommendation (citing Silent Guardian):** FocusFlow should maintain a
`currentVpnTargets` set and only rebuild the VPN when the set changes, to avoid
tearing down the tunnel on every Accessibility event.

**Reality:**
`NetworkBlockerVpnService.kt:284-289`:
```kotlin
if (vpnInterface != null &&
    activePackagesJson == packagesJson &&
    activeMode == mode
) return   // already established with the same package set
```
FocusFlow **already has this guard**. The VPN is not rebuilt unless the package JSON
string or mode changes. The plan treats this as a missing feature. It is not missing.

The coordinator now sorts the effective target list before serializing it, so source
ordering does not cause unnecessary reconfiguration. The equality guard remains a
service-level no-op for an unchanged healthy tunnel.

---

## 3. GAPS THE PLAN MISSES ENTIRELY

### 3.1 PackageInstallReceiver now recalculates policy on package changes

**Current behavior:**
`PackageInstallReceiver.kt` handles package add, removal, and fully-removed
broadcasts. It commits any standalone overlay-list update before calling
`NetworkBlockerVpnService.requestSync(context)`, and removal events recalculate
even when a persistent explicit VPN selection is the only active source.

**Important separation:**
An app installed during an ordinary standalone overlay block is not automatically
added to the timed standalone VPN source. That is intentional: the current policy
keeps overlay packages and standalone VPN selections independent. A package that
is explicitly selected for VPN protection is revalidated through the same
recalculation path when package availability changes.

**Conclusion:** The package-change recalculation gap is addressed. Automatic
promotion of every standalone overlay package into the VPN target set is not part
of the approved independent-source behavior.

---

### 3.2 VPN package writes are now coordinator-owned

The former collision was between:

- `NetworkBlockModule.setNetworkBlockSettings()`, which writes durable VPN source
  inputs; and
- the legacy `SharedPrefsModule.setVpnSelectedPackages()` bridge, which is now a
  compatibility writer for the explicit source slot and is not called by the
  current React synchronization path.

`VpnPolicyCoordinator.requestSync()` is the native owner that computes and writes
the effective `net_block_packages` snapshot from the durable source slots. Recovery
recalculates from those source slots rather than trusting the snapshot.

---

### 3.3 Overlay and VPN lists are intentionally independent

`always_block_active` / `PREF_ALWAYS_BLOCK_PKGS` remain the Accessibility overlay
source, while `net_block_explicit_packages` and
`net_block_standalone_vpn_packages` are VPN sources. This separation is deliberate:

- an ordinary always-on overlay package need not be VPN-blocked;
- an explicit VPN-only package remains protected when overlay enforcement is
  disabled; and
- the watchdog and all recovery paths use the coordinator's VPN policy gate,
  not the ordinary overlay flag.

The previous watchdog gate mismatch is therefore resolved without collapsing the
two product policies into one.

---

## 4. LICENSING STATUS

The plan correctly warned about Silent Guardian being GPL-3.0. A full search of the
codebase finds zero references to `silentGuardian`, `weinaike`, `BlackholeVpnService`,
or `MonitorService`. No GPL code was copied. The codebase is clean on this point.

The architectural ideas (null-routing TUN, separate policy engine, safety controls)
are general software engineering patterns, not copyrightable expression. Using them
is fine.

---

## 5. WHAT IS NOW BUILT OR STILL OPEN (confirmed against the current codebase)

The original absence table is retained below as a reconciled status table:

| Feature | Plan Section | Status |
|---|---|---|
| Native policy coordinator class | Step 1 / Step 2 | Implemented |
| Versioned state contract (`generation`, `updatedAt`, `reason` fields) | Step 3 | Implemented |
| Native debounce for rapid VPN rebuilds | Step 5 | Implemented |
| Recurring schedule → VPN package consumption | Step 1 | Dead code, not wired |
| Boot rearm for always-on-only config | Gaps section | Implemented |
| Package availability policy recalculation | Gaps section | Implemented |

---

## 6. IMPLEMENTATION PRIORITY (based on actual code gaps)

**Previously identified blockers — now addressed in the current source:**

1. **Boot rearm for always-on config:** `BootReceiver` now schedules the watchdog
   from the persistent VPN gate before the focus-session branch.

2. **Resolve the two-write-path collision:** React writes durable VPN source
   inputs through `setNetworkBlockSettings`; `VpnPolicyCoordinator` computes the
   single effective snapshot and owns recovery dispatch.

3. **Package-change handling:** package add/removal broadcasts now trigger native
   policy recalculation. Ordinary standalone overlay installs remain separate from
   VPN selection by design.

**Remaining correctness and delivery work:**

4. **Complete lifecycle ownership and process-death proof:** the coordinator and
   durable recovery hooks exist, but Android service lifecycle behavior is not
   device-verified.

5. **Recurring schedule VPN support:** still requires a product decision and a
   native scheduler if approved.

6. **Device and real-network verification:** lifecycle, VPN permission/conflict,
   packet behavior, package removal, handoff, and OEM/Doze scenarios remain open.

---

## 7. WHAT YOU DO NOT NEED TO BUILD

The plan correctly advises against these. Code confirms they are unnecessary:

- **Packet reading / DPI**: The null-routing TUN already drops everything. Reading
  packets would add complexity with no benefit.
- **Separate "background-only" blocking mode**: Android's `addAllowedApplication`
  works at the UID level. There is no API to distinguish foreground vs background
  within the same UID. The plan correctly identifies this and proposes the correct
  workaround (explicit VPN list takes priority; Accessibility handles foreground
  overlay separately). Do not try to implement per-process or per-foreground-state
  network rules.
- **Global mode for this feature**: Confirmed correct. Global mode would break
  unrelated foreground app connectivity. PER_APP only.

---

## 8. SILENT GUARDIAN REFERENCE ACCURACY

The plan references `BlackholeVpnService.kt` and `MonitorService.kt` from
`github.com/weinaike/silentGuardian`. The architectural patterns described
(separate policy engine, `currentVpnTargets` tracking, safety controls) are
accurately described. The licensing warning (GPL-3.0) is correct.

One nuance: the plan presents "track the current target set" as a Silent Guardian
idea FocusFlow should adopt. As noted in Section 2.1, FocusFlow already does this
via `activePackagesJson` comparison. The idea is independently implemented. This is
not a criticism of the plan — it is a useful architectural point — but the reader
should not think this particular item is an open implementation task.

---

*Review based on direct reading of:*
- `android-native/.../services/NetworkBlockerVpnService.kt`
- `android-native/.../services/AppBlockerAccessibilityService.kt` (lines 492–550, 1462–1520, 2710–2890)
- `android-native/.../services/VpnWatchdogReceiver.kt`
- `android-native/.../services/BootReceiver.kt`
- `android-native/.../services/PackageInstallReceiver.kt`
- `android-native/.../modules/NetworkBlockModule.kt`
- `android-native/.../modules/SharedPrefsModule.kt`
- `src/context/AppContext.tsx` (lines 603–753, 1547–1640, 1683–1890)
- `src/data/types.ts`
