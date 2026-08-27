# VPN Background Enforcement Plan — Code-Verified Review

Every claim below is pinned to a specific file and line in the actual source.
No invented facts. Where something is uncertain, it is marked.

## Review tracker

**Legend:** ✅ confirmed in the current codebase · ❌ unresolved, missing, or
not implemented.

### Confirmed behavior

- ✅ Explicit per-app VPN targets block foreground and background traffic.
- ✅ Focus-blocked packages are not currently mirrored into the VPN list.
- ✅ Recurring schedule VPN fields are currently unused.
- ✅ Always-on-only watchdog rearm is missing after boot.
- ✅ `isRunning` is process-local and transient after process death.
- ✅ The 400 ms focus-stop delay is only a best-effort race workaround.
- ✅ Accessibility-triggered enforcement uses the VPN path, not Wi-Fi/mobile-data disabling.
- ✅ FocusFlow already avoids rebuilding an unchanged VPN target set.

### Open gaps to track through implementation

- ❌ Fix always-on-only watchdog rearm.
- ❌ Resolve the two competing `net_block_packages` write paths.
- ❌ Keep overlay and VPN state from diverging.
- ❌ Update the VPN target set when packages are installed during standalone blocking.
- ❌ Add the native policy coordinator and durable desired-state contract.
- ❌ Add opt-in focus mirroring.
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

### 1.2 The critical gap: focus-blocked apps are NOT in the VPN list

**Plan claim:** The VPN list comes only from `alwaysOnVpnPackages` and
`standaloneVpnPackages`. Apps blocked only by the Accessibility focus rule do not get
network-blocked.

**Code confirmation:**
`AppContext.tsx:718-720` — the only merge that writes `net_block_packages`:
```typescript
const alwaysOnVpnPkgs = settings.alwaysOnVpnPackages ?? [];
const sessionVpnPkgs  = settings.standaloneVpnPackages ?? [];
const mergedVpnPkgs   = Array.from(new Set([...alwaysOnVpnPkgs, ...sessionVpnPkgs]));
```
`settings.allowedInFocus` (the focus block list) is never merged here or anywhere else.

**Conclusion:** Plan is correct. An app blocked by Accessibility during focus gets the
overlay but its background network keeps working unless it is also explicitly added to
the VPN list by the user.

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

### 1.4 Boot watchdog rearm does NOT cover always-on-only config

**Plan claim:** `BootReceiver` only rearms the VPN watchdog alarm in the focus-session
branch. If the device only has an always-on VPN config and no active focus session,
the watchdog is not rearmed after reboot. The VPN will not restart.

**Code confirmation:**
`BootReceiver.kt:85-97` — The watchdog rearm is inside the `if (sessionValid &&
endTimeMs > 0L)` block:
```kotlin
val netBlockEnabled = prefs.getBoolean("net_block_enabled", false)
val selfHeal        = prefs.getBoolean("net_block_self_heal", false)
if (netBlockEnabled && selfHeal) {
    VpnWatchdogReceiver.schedule(context)
}
```
The `else` branch (lines 98-113) starts the idle foreground service and does not call
`VpnWatchdogReceiver.schedule()` at all. `hasPersistentVpnConfiguration()` is not
checked here.

**Conclusion:** Confirmed real bug. A user with only an always-on VPN list and
`net_block_self_heal=true` will have no VPN enforcement after reboot until they open
the app.

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
and `VpnWatchdogReceiver` (`VpnWatchdogReceiver.kt` line that checks `isRunning`) both
gate on this field. After a process kill, they will see `false` and attempt a restart
even when a tunnel may already be active, causing a redundant TUN rebuild. The early-
return guard in `startVpn()` (lines 285-289) catches the duplicate only if the service
process itself is still alive and `vpnInterface != null`.

**Conclusion:** Confirmed. `vpn_status` in SharedPrefs is the durable signal; `isRunning`
is transient.

---

### 1.6 The 400 ms delay after focus stop is a documented race, not a fix

**Plan claim:** The stop-then-restart sequence in `stopFocusMode` has a race condition
that a 400 ms delay only partially addresses.

**Code confirmation:**
`AppContext.tsx:1620-1635`:
```typescript
await NetworkBlockModule.stopNetworkBlock(pinHash);
// ...
await new Promise<void>((resolve) => setTimeout(resolve, 400));
void NetworkBlockModule.startNetworkBlock(JSON.stringify(mergedVpnPkgs)).catch(...);
```
The comment at line 1626 explicitly calls this out:
> "A short delay is required here: ACTION_STOP is processed asynchronously by
> NetworkBlockerVpnService. Without it, the always-on startNetworkBlock call can race
> with the teardown of the previous TUN interface."

This is a best-effort workaround. On a slow device or under memory pressure, 400 ms
is not guaranteed to be enough. The plan's characterisation is accurate.

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

The string-equality check is slightly fragile (list ordering matters, `["a","b"]` ≠
`["b","a"]`), but the behaviour is already there. The only improvement worth making
is to normalise/sort the JSON before comparison.

---

## 3. GAPS THE PLAN MISSES ENTIRELY

### 3.1 PackageInstallReceiver does not update the VPN list

**What happens today:**
`PackageInstallReceiver.kt:73-80` — when a new app is installed during a standalone
block, the receiver appends it to `PREF_SA_PKGS` (standalone overlay block list).
It does NOT touch `net_block_packages`.

**Effect:**
A newly installed app during a standalone session gets the overlay block. Its network
traffic is not VPN-blocked unless `net_block_packages` happens to be empty (which
triggers the single-app fallback path in `triggerNetworkBlock`). The plan discusses
package install/uninstall risks but does not identify this specific write omission.

**Fix needed:** When a new package is appended to `PREF_SA_PKGS`, also rebuild and
write `net_block_packages` to include it (using the same merge logic as AppContext).

---

### 3.2 Two separate write paths to `net_block_packages` can clobber each other

**Path A:** `NetworkBlockModule.setNetworkBlockSettings()` — called from
`AppContext.tsx:721-726` during `_syncGuardRails()`. Writes the merged
`alwaysOnVpnPkgs + sessionVpnPkgs` set.

**Path B:** `SharedPrefsModule.setVpnSelectedPackages()` — called from
`AppContext.tsx:1873` inside `setStandaloneBlockAndAllowance()`. Writes
`resolvedVpnPackages` (standalone VPN packages only, without the always-on packages).

Both write to `net_block_packages` as the canonical key. If `setStandaloneBlockAndAllowance`
runs while `_syncGuardRails` has already written a merged list, the second write from
Path B replaces the merged set with a subset. The VPN service and watchdog then
restart with an incomplete package set. The plan does not identify this specific
collision.

---

### 3.3 `always_block_active` / `PREF_ALWAYS_BLOCK_PKGS` vs `net_block_packages` can diverge

The watchdog (`VpnWatchdogReceiver`) checks `always_block_active` to decide it
should restart. It then reads `net_block_packages` to decide what packages to restart
with. These are two separate SharedPrefs keys written by two separate code paths:

- `PREF_ALWAYS_BLOCK_PKGS` is written by `SharedPrefsModule.setAlwaysBlockActive()`
  (lines 297-305) — this is the overlay block list.
- `net_block_packages` is written by `NetworkBlockModule.setNetworkBlockSettings()`
  — this is the VPN block list.

These lists are conceptually related but independently maintained. If the user has
`alwaysOnPackages = [Instagram]` but `alwaysOnVpnPackages = []`, the watchdog will
fire, see `always_block_active = true`, and restart the VPN with
`net_block_packages = []` — which in PER_APP mode aborts immediately
(`NetworkBlockerVpnService.kt:335-341`). No network enforcement happens despite the
watchdog firing. The plan does not flag this specific combination.

---

## 4. LICENSING STATUS

The plan correctly warned about Silent Guardian being GPL-3.0. A full search of the
codebase finds zero references to `silentGuardian`, `weinaike`, `BlackholeVpnService`,
or `MonitorService`. No GPL code was copied. The codebase is clean on this point.

The architectural ideas (null-routing TUN, separate policy engine, safety controls)
are general software engineering patterns, not copyrightable expression. Using them
is fine.

---

## 5. WHAT IS NOT YET BUILT (confirmed absent from codebase)

The following items are recommended by the plan but do not exist in any source file:

| Feature | Plan Section | Status |
|---|---|---|
| Native policy coordinator class | Step 1 / Step 2 | Not present |
| Versioned state contract (`generation`, `updatedAt`, `reason` fields) | Step 3 | Not present |
| Native debounce for rapid VPN rebuilds | Step 5 | Not present |
| Recurring schedule → VPN package consumption | Step 1 | Dead code, not wired |
| Boot rearm for always-on-only config | Gaps section | Bug, not fixed |
| PackageInstallReceiver VPN list update | Gaps section | Not present |

---

## 6. IMPLEMENTATION PRIORITY (based on actual code gaps)

**Must fix before shipping the feature:**

1. **Boot rearm for always-on config** (`BootReceiver.kt:98-113`): Add
   `VpnWatchdogReceiver.schedule(context)` in the `else` branch when
   `hasPersistentVpnConfiguration(prefs)` is true. Without this, always-on VPN
   stops working after every reboot unless the user opens the app.

2. **Resolve the two-write-path collision** (`AppContext.tsx:721` vs `:1873`):
   Consolidate `net_block_packages` writes to one function that always computes the
   full merged set. The `setVpnSelectedPackages` call in `setStandaloneBlockAndAllowance`
   must use the same merge logic as `_syncGuardRails`, not just the standalone subset.

3. **PackageInstallReceiver VPN update** (`PackageInstallReceiver.kt:73-80`):
   When appending to `PREF_SA_PKGS`, also rebuild and write `net_block_packages`.

**Should fix (correctness, not blocking):**

4. **Sort-normalise package JSON before VPN equality check** (`NetworkBlockerVpnService.kt:284`):
   `["a","b"]` and `["b","a"]` are the same effective set but trigger an unnecessary
   VPN rebuild due to string inequality.

5. **`isRunning` post-process-death divergence**: Add a cross-process check using
   the persisted `vpn_status` SharedPref alongside `isRunning` when deciding whether
   a restart is needed.

**Implement as the actual new feature:**

6. **Native policy coordinator**: A single native class that owns the computation of
   `effectiveVpnTargets` from all sources (always-on, standalone, schedules, focus
   mirror if opted in). The JS layer submits policy inputs; the coordinator owns the
   merge and the single write to `net_block_packages`.

7. **Recurring schedule VPN**: Wire `sched.vpnEnabled` and `sched.vpnPackages` into
   the policy coordinator. This requires a native scheduler that recalculates when
   schedule windows open and close, independent of the JS layer.

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
