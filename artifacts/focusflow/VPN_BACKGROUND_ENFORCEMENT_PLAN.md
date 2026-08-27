# FocusFlow — VPN Background Network Enforcement Plan

**Status:** Planning document only  
**Scope:** Android FocusFlow app (`artifacts/focusflow`)  
**Last reviewed:** 2026-08-27

## Implementation tracker

**Legend:** ✅ complete or confirmed in the current codebase · ❌ open, not
implemented, or awaiting a product decision.

### Current baseline

- ✅ Explicit per-app VPN targets already block foreground and background traffic.
- ✅ Focus foreground enforcement remains separate from VPN network enforcement.
- ✅ The supporting code review is stored beside this primary plan.
- ✅ Opt-in focus-to-VPN mirroring setting and basic native target derivation are implemented.
- ❌ Full native ownership and process-death recovery are not implemented.

### Delivery phases

- ❌ **Phase 0 — Confirm product scope:** resolve the open decisions in Section 13.
- ❌ **Phase 1 — Native policy contract:** define the durable versioned desired state.
- ❌ **Phase 2 — Native coordinator and VPN lifecycle:** centralize target calculation and serialized reconfiguration.
- ❌ **Phase 3 — Recovery:** cover process death, boot, unlock, package changes, permission loss, and VPN conflicts.
- ❌ **Phase 4 — React Native and UI:** add the opt-in setting, persistence, status, and explanatory states.
- ❌ **Phase 5 — Verification:** complete contract, Kotlin, device, lifecycle, and network evidence.

### Known implementation gaps

- ✅ Boot watchdog rearm for an always-on-only VPN configuration.
- ✅ Consolidation of competing writes to `net_block_packages`.
- ✅ Package-install updates to the effective VPN target set.
- ✅ Versioned native desired-state record with generation and reason metadata.
- ✅ Installed-package validation and unavailable-package failure metadata.
- ✅ Recovery restart inputs recalculate from persisted policy sources instead of
  trusting the previous `net_block_packages` snapshot.
- ✅ Older queued VPN start/stop commands are rejected by policy generation.
- ✅ VPN recovery gates no longer use ordinary always-on overlay state as a
  substitute for VPN policy.
- ❌ Full native policy coordinator for explicit, standalone, scheduled, and optional focus-derived targets.
- ❌ Recurring schedule VPN enforcement, if included in the approved scope.

## 1. Executive summary

FocusFlow already uses an Android `VpnService` as a per-app null-routing VPN. A
package registered with the VPN is routed into a TUN interface whose packets
FocusFlow does not forward. That means the package's foreground and background
network traffic are already blocked.

The missing capability is different:

> An app that is blocked by the active Focus rule but is not explicitly in the
> VPN list can still perform background network work.

The recommended addition is an **opt-in background network enforcement setting**
that mirrors FocusFlow's focus-blocked package set into the per-app VPN target
set. The VPN must remain per-app, must not inspect packets, and must not block
unrelated foreground applications.

The policy should be owned by native Android code and persisted independently of
React state. React Native remains responsible for settings and presentation,
but the Android execution plane must be able to restore and enforce the desired
VPN state after the JavaScript process is killed.

This document does not authorize implementation by itself. The open product
decisions in Section 17 should be confirmed before code changes begin.

---

## 2. Current architecture

### 2.1 The current VPN mechanism

`NetworkBlockerVpnService` creates a local null-routing tunnel:

- IPv4 and IPv6 default routes are added.
- In `PER_APP` mode, each selected package is registered with
  `addAllowedApplication`.
- The service does not read and forward TUN packets.
- Traffic routed to the tunnel is therefore dropped.
- Packages outside the selected set continue to use the device's ordinary
  network.
- `GLOBAL` mode routes all traffic except hard-coded exclusions and FocusFlow
  itself.

The VPN is a single Android system VPN. It can replace or conflict with another
VPN application. FocusFlow must not automatically fight another VPN that the
user intentionally starts.

### 2.2 Existing native state

The native layer currently persists network state in `focusday_prefs`,
including concepts equivalent to:

```text
net_block_enabled
net_block_vpn
net_block_global
net_block_packages
net_block_mode
net_block_self_heal
net_block_restore
vpn_status
vpn_error
vpn_failed_packages
vpn_permission_lost
```

The VPN service also reads focus, standalone, and always-on state when it is
restarted. A watchdog alarm can restart the service when self-healing is
enabled.

The explicit always-on VPN package list is an independent network-enforcement
source. It must remain effective without an active focus session, standalone
block, or ordinary always-on overlay policy. The recovery gates now use the
explicit/standalone VPN policy rather than the ordinary overlay flag, while the
remaining coordinator work must keep the separate preference sources aligned.

The current native layer also keeps the explicit package list separate from
the effective list and persists a versioned desired-policy snapshot with a
generation, timestamp, target packages, and per-package source reasons. Recovery
commands carry that generation, and the VPN service rejects older queued start
or stop commands. This is the foundation for the planned coordinator, but a
single dedicated coordinator class and full lifecycle ownership are still open.

### 2.3 Existing React Native sources of VPN packages

The current React layer primarily merges:

```text
alwaysOnVpnPackages
∪ standaloneVpnPackages
```

and writes the result as the canonical native VPN package list.

`recurringBlockSchedules` already has optional `vpnEnabled` and `vpnPackages`
fields in the TypeScript model, but the current synchronization path does not
yet turn those fields into an active native VPN policy.

### 2.4 Existing Accessibility enforcement

The Accessibility service independently calculates whether the currently
visible package is blocked by:

- the active focus allow-list,
- daily allowance state,
- standalone blocking,
- always-on overlay blocking,
- system-control protection,
- recurring greyout rules.

When a package is blocked, it can start the VPN, show the overlay, dismiss the
blocked app, and apply deterrents. Focus, allow-list, standalone, and package
installation state changes now notify native policy recalculation. When focus
mirroring is enabled, that recalculation derives the VPN targets from the
persisted focus allow-list. The Accessibility-triggered path still does not own
the complete policy coordinator, so lifecycle and source synchronization remain
open work.

### 2.5 Current behavior matrix

| Situation | Foreground behavior | Background network behavior |
|---|---|---|
| Package is explicitly in the VPN list | VPN blocks its traffic | VPN blocks its traffic |
| Package is focus-blocked but not in the VPN list | Accessibility blocks it when opened | Network may continue |
| Package is focus-allowed and not in VPN list | Allowed | Allowed |
| Package is focus-allowed but explicitly in VPN list | Screen may be allowed by focus | VPN still blocks network |
| Unrelated package not in VPN list | Unaffected | Unaffected |
| `GLOBAL` VPN mode | All non-excluded traffic is routed | Not suitable for this feature |

The distinction between the foreground policy and the network policy must be
visible in both code and UI.

---

## 3. Desired behavior

### 3.1 Explicit VPN selections

An explicitly selected VPN package must be blocked in both foreground and
background, regardless of whether the user switches to another app.

Example:

```text
VPN target: YouTube
Current foreground app: Chrome

YouTube screen: blocked
YouTube background download: blocked
Chrome: unaffected
```

This is already the intended behavior of Android per-app VPN routing.

### 3.2 Optional focus mirroring

When the new setting is enabled:

```text
Focus-disallowed packages are also added to the VPN target set.
```

When the new setting is disabled:

```text
Focus-disallowed packages remain an Accessibility-only foreground rule
unless they are independently selected for VPN blocking.
```

This must be opt-in. A focus session can disallow many packages, and mirroring
all of them can affect background sync, uploads, notifications, media playback,
and other services that the user may not realize belong to a blocked app.

### 3.3 Precedence

The two policies should remain independent:

```text
Foreground screen access = Accessibility/focus policy
Network access            = explicit + effective VPN policy
```

An explicit VPN selection takes priority for network access even if the package
is allowed by the current focus session.

Explicit VPN protection is persistent and independent from the ordinary
always-on overlay policy. Disabling or ending overlay enforcement must not
remove an explicitly selected VPN target, and an explicit VPN-only
configuration must be able to start, remain monitored, and recover on its own.

Example:

```text
Focus allowed apps: YouTube
Explicit VPN targets: YouTube

YouTube screen: allowed by focus policy
YouTube network: blocked by explicit VPN policy
```

The UI should explain this intentional difference.

---

## 4. Effective VPN policy

The native policy coordinator should calculate one effective target set:

```text
effectiveVpnTargets =
    explicitAlwaysOnVpnPackages
  ∪ activeStandaloneVpnPackages
  ∪ activeRecurringVpnPackages
  ∪ mirroredFocusBlockedPackages       (only when opt-in is enabled)
  ∪ exhaustedAllowancePackages         (only if separately enabled)
```

Every set operation must:

1. Deduplicate package names.
2. Normalize comparisons consistently.
3. Validate packages against the installed package manager.
4. Record invalid or unavailable packages as failures instead of silently
   claiming that they are protected.
5. Apply emergency and system safety exclusions.
6. Produce `PER_APP` mode for this feature.

An empty effective target set must stop the VPN. It must never be interpreted as
“all packages” and must never silently fall back to `GLOBAL` mode.

### 4.1 Focus-derived package calculation

If focus mirroring is enabled, the policy engine must derive packages from the
same rules that Accessibility uses. It must not create a second, subtly
different definition of “blocked.”

The calculation must account for:

- an explicit per-task allow-list,
- the global focus allow-list fallback,
- an empty allow-list meaning no restriction when no allowance policy applies,
- daily allowance configurations where they change the effective focus policy,
- packages that must never be blocked,
- the FocusFlow package itself,
- emergency calling and essential telephony packages,
- non-launchable system packages that should not be registered casually.

The exact treatment of daily allowance exhaustion should be a separate product
decision. It should not be inferred accidentally from the focus mirror toggle.

### 4.2 Schedule-derived packages

Recurring schedules already model network blocking intent. If schedule VPN
support is included in the implementation, the coordinator must evaluate:

- schedule enabled state,
- current local time,
- weekday selection,
- windows that cross midnight,
- overlapping schedules,
- schedule expiry and device timezone changes,
- `vpnPackages` versus the schedule's ordinary `packages`.

Schedule VPN support is a useful extension, but it increases the lifecycle
surface. It may be safer to implement explicit VPN selections and opt-in focus
mirroring first, then deliver scheduled VPN enforcement as a separate slice.

---

## 5. Native coordinator design

### 5.1 Ownership

The Android execution plane should own:

- the latest desired VPN policy,
- the effective target set,
- the active applied target set,
- start/stop/reconfigure ordering,
- package validation,
- permission and conflict state,
- recovery after process death,
- watchdog scheduling.

React Native should:

- expose the setting,
- edit user-controlled lists,
- request VPN consent while an Activity is available,
- display native status and failures,
- wait for critical native writes rather than treating optimistic UI as
  enforcement success.

### 5.2 Durable desired-state record

Rather than coordinating many independent preference keys, use one versioned
desired-state record for the VPN policy. Conceptually:

```json
{
  "version": 1,
  "generation": 42,
  "enabled": true,
  "vpnEnabled": true,
  "mode": "per_app",
  "targetPackages": [
    "com.google.android.youtube"
  ],
  "explicitPackages": [
    "com.google.android.youtube"
  ],
  "focusMirrorEnabled": true,
  "reasons": {
    "com.google.android.youtube": [
      "explicit_vpn",
      "focus_blocked"
    ]
  },
  "updatedAt": 1787761472000
}
```

The actual schema can differ, but it should have:

- a schema version for migrations,
- a monotonically increasing generation,
- one authoritative target list,
- enough reason metadata for diagnostics,
- explicit enabled/mode state,
- an update timestamp.

The stored record is a desired policy, not proof that Android successfully
established the VPN. Actual status and failed packages must remain separate.

### 5.3 Reconfiguration

Android cannot amend an established `VpnService.Builder` in place. A changed
target set requires a controlled teardown and rebuild.

The coordinator should:

1. Serialize all policy commands.
2. Coalesce rapid updates.
3. Compare the desired set and mode with the applied set.
4. Do nothing when they are equivalent.
5. Rebuild only when the set or mode changes.
6. Ignore stale commands whose generation is older than the latest desired
   state.
7. Keep the last valid state available for recovery.
8. Publish an explicit transitional status while rebuilding.

This avoids rebuilding the VPN on every Accessibility window event and reduces
the current stop/start race.

### 5.4 Failure handling

The coordinator must distinguish:

```text
VPN disabled by policy
VPN permission missing
another VPN is active
service start rejected by Android
no target packages
some packages failed registration
all packages failed registration
VPN established
VPN revoked after establishment
```

Partial registration must not be reported as complete success. The status
should include the failed package names and preserve the valid desired policy
for a later retry.

---

## 6. Recovery and lifecycle

The effective policy must not depend on the React process remaining alive. The
current implementation has native effective-target recalculation, serialized
sync entry, a durable desired-policy snapshot, generation checks, and watchdog
hooks. It does not yet have the full lifecycle coordinator described below.

Recalculation or restoration should occur after:

- focus starts,
- focus ends,
- focus allow-list changes,
- standalone blocking starts,
- standalone blocking expires,
- always-on VPN settings change,
- recurring VPN windows start or end,
- allowance state changes if allowance mirroring is enabled,
- package installation,
- package removal,
- VPN service recreation,
- boot,
- user unlock,
- app package replacement,
- VPN permission restoration,
- VPN revocation,
- another VPN taking control.

### 6.1 Boot and user unlock

Boot recovery must use the last valid native desired policy. It should not
require JavaScript, an Accessibility event, or the user reopening FocusFlow.

The implementation must account for:

- file-based encryption before user unlock,
- `BOOT_COMPLETED` arriving before encrypted preferences are available,
- `ACTION_USER_UNLOCKED`,
- package replacement,
- expired focus and standalone timestamps,
- wall-clock changes,
- timezone and daylight-saving transitions.

The watchdog must be rearmed for every supported persistent policy, including
an always-on-only VPN configuration. It must cancel itself when no policy
requires protection.

### 6.2 Permission and VPN conflicts

If VPN consent is missing, native background code cannot show the consent UI.
It must record a visible permission-required state and wait for a foreground UI
path to request consent.

If another VPN is active:

- do not repeatedly fight it,
- do not claim FocusFlow protection is active,
- surface a conflict state,
- retry only after a deliberate user action or a clearly bounded recovery
  policy.

`onRevoke()` must distinguish a user revocation from another VPN taking control
as far as Android makes possible. In either case, recovery must not create an
unbounded restart loop.

### 6.3 Intentional stop and handoff

When a focus or standalone session ends while persistent always-on VPN
packages remain, the handoff must avoid an observable protection gap.

The preferred design is a native reconfiguration from the old target set to
the new target set. If separate stop/start commands remain temporarily, they
must be serialized and tested at the Android level rather than relying only on
an arbitrary JavaScript delay.

---

## 7. UI and product behavior

The setting should be described in plain language, for example:

> Block background internet activity for apps that Focus Mode blocks.

The UI should explain:

- explicit VPN selections already block foreground and background traffic,
- enabling this option adds focus-disallowed apps to the VPN target set,
- unrelated apps remain connected,
- an app can be allowed on screen but still have network blocked if it is in
  the explicit VPN list,
- this requires Android VPN consent,
- another VPN may prevent FocusFlow from operating,
- Android and OEM restrictions can create recovery gaps,
- background network blocking may affect downloads, notifications, uploads, and
  background sync.

The UI should show, rather than hide:

- permission missing,
- another VPN active,
- service starting or rebuilding,
- partial package registration failure,
- complete startup failure,
- last successful policy generation,
- recovery disabled by the user's self-heal setting.

The feature should not silently turn on merely because the user enables
ordinary foreground focus blocking.

---

## 8. Safety and non-goals

### Required safety rules

- Use per-app routing for this feature.
- Keep emergency and essential telephony access excluded.
- Keep FocusFlow's own critical flows reachable.
- Stop when the target set is empty.
- Validate packages before registration.
- Preserve IPv4 and IPv6 coverage.
- Do not fight another VPN automatically.
- Keep desired policy durable outside React state.
- Make permission loss visible.
- Do not represent partial protection as full protection.
- Test package install and uninstall changes.
- Test reboot, user unlock, process death, and service restart.

### Explicit non-goals

This feature should not introduce:

- packet inspection,
- DNS interception,
- a proxy server,
- traffic forwarding,
- content classification,
- foreground/background detection inside the VPN,
- global device blocking,
- automatic modification of unrelated VPN applications,
- hidden network controls that claim to be reliable on Android versions where
  the platform disallows them.

The VPN sees traffic at the application UID level. It does not provide a
reliable foreground-only or background-only switch for a package. Foreground
and background traffic from the same package must be treated as one network
identity.

---

## 9. Reference project review: Silent Guardian

Public repository:

<https://github.com/weinaike/silentGuardian>

Relevant reference files:

- `BlackholeVpnService.kt`
- `service/MonitorService.kt`

The reference project confirms these architectural ideas:

1. A policy/monitoring service decides which packages should be blocked.
2. The VPN service receives a package set rather than deciding policy itself.
3. Per-app `addAllowedApplication` routing blocks all traffic from selected
   package UIDs.
4. The applied target set should be tracked and compared before rebuilding.
5. Screen state, phone calls, Doze gaps, service destruction, and day rollover
   deserve explicit safety treatment.

The reference implementation is not a complete implementation plan for
FocusFlow. It is simpler, has different product requirements, and should not be
treated as evidence that FocusFlow's lifecycle, permission, OEM, or recovery
behavior is solved.

### Licensing boundary

Silent Guardian is published under **GPL-3.0**. FocusFlow must not copy its
source code, comments, or implementation structure into the application without
an intentional licensing review.

The safe engineering approach is:

- use public documentation and observable architectural concepts as reference,
- write an independent implementation,
- do not copy code or substantial expressive details,
- retain the public repository URL in planning/research notes,
- ask qualified counsel to review distribution implications before release if
  any code or non-trivial derivative material is considered.

This is engineering guidance, not legal advice. FocusFlow's own repository
license and any distribution license must also be reviewed independently.

---

## 10. Implementation phases

### Phase 0 — Confirm product scope

- Confirm whether the first release includes opt-in focus mirroring.
- Decide whether recurring schedule VPN support is included or deferred.
- Decide whether exhausted daily allowances should mirror into the VPN.
- Confirm the default value is off.
- Confirm that `GLOBAL` mode remains a separate explicit feature.

### Phase 1 — Native policy contract

- Define the versioned desired-state record.
- Define reason/source metadata for each target package.
- Define package validation and failure statuses.
- Define the safety exclusion policy.
- Define generation and stale-command behavior.

### Phase 2 — Native coordinator and VPN lifecycle

- Move effective target calculation into native policy code.
- Add ordered, debounced start/reconfigure/stop commands.
- Reconfigure only when the effective set changes.
- Preserve the current null-routing implementation.
- Keep explicit VPN packages separate from focus-derived packages.

### Phase 3 — Recovery

- Restore desired state after process death.
- Reconcile after boot and user unlock.
- Reconcile after package changes.
- Align watchdog behavior with persistent policy.
- Handle permission loss and VPN conflicts without loops.
- Prove the standalone-to-always-on handoff.

### Phase 4 — React Native and UI

- Add the opt-in setting.
- Persist it through settings and backup/restore.
- Wait for critical native policy persistence.
- Display status, conflicts, permission loss, and partial failures.
- Explain foreground-policy versus network-policy precedence.

### Phase 5 — Verification

- Run JavaScript contract tests.
- Run Kotlin policy/lifecycle tests.
- Run Android instrumentation or emulator tests.
- Test real network behavior on supported Android versions and representative
  OEM devices.
- Review only relevant security findings before release.

---

## 11. Testing plan

### 11.1 Policy tests

Test deterministic set calculations for:

- explicit always-on plus standalone union,
- duplicate packages,
- invalid packages,
- focus mirroring off,
- focus mirroring on,
- focus allow-list with one allowed app,
- empty focus allow-list,
- explicit VPN target that is focus-allowed,
- overlapping schedules,
- overnight schedule windows,
- allowance exhaustion if included,
- emergency and system exclusions,
- empty final target set,
- generation ordering and stale updates.

### 11.2 Native lifecycle tests

Test:

- initial VPN establishment,
- unchanged policy no-op,
- target-set reconfiguration,
- stop with no targets,
- partial package registration failure,
- all package registration failure,
- missing VPN consent,
- `Builder.establish()` returning null,
- service destruction cleanup,
- watchdog restart,
- watchdog cancellation,
- permission revoke,
- another VPN becoming active,
- process death and restoration,
- boot before user unlock,
- user unlock recovery,
- package uninstall while protected,
- concurrent start/stop/reconfigure commands.

### 11.3 Device scenarios

1. Put YouTube in the explicit VPN list.
2. Open YouTube and verify network failure.
3. Start a YouTube download, switch to Chrome, and verify the download stops
   or fails.
4. Verify Chrome continues loading pages.
5. Focus-block Instagram with focus mirroring off and verify its background
   traffic is not newly affected by the focus rule.
6. Repeat with focus mirroring on and verify Instagram's background traffic is
   blocked.
7. Allow YouTube in the focus session while explicitly VPN-blocking it.
8. Verify the screen policy and network policy differ as documented.
9. Use two or more VPN targets simultaneously.
10. Kill the React process while the VPN is active.
11. Kill or recreate the VPN service.
12. Reboot and unlock the device.
13. Revoke VPN permission.
14. Start another VPN application.
15. End focus while persistent always-on VPN protection remains.
16. Let standalone VPN protection expire.
17. Install and uninstall a selected app.
18. Test IPv4, IPv6, QUIC-like traffic, foreground services, uploads, and
    notifications.
19. Test phone calls and emergency access.
20. Repeat critical tests under Doze and on representative OEM battery
    management settings.

A successful mocked start is not evidence that packets are actually blocked.
Real Android device evidence is required for the network and lifecycle claims.

---

## 12. Files and integration boundaries

The expected implementation boundary is the existing FocusFlow artifact:

- Native VPN service and network module.
- Native Accessibility policy integration.
- Watchdog, boot, user-unlock, and package-change recovery.
- React Native network bridge.
- App context synchronization.
- Settings types, defaults, backup/restore.
- VPN and defense UI.
- FocusFlow contract, Kotlin, and device tests.
- Expo config plugin, manifest declarations, and the durable native install
  path.

Any release-critical native change must be kept in the durable native source
and mirrored through the established Expo/config-plugin installation path.
Generated Android output alone is not a durable implementation location.

---

## 13. Open decisions

1. **First-release behavior:** Should the first implementation add the opt-in
   focus-mirroring setting, or only harden the existing explicit VPN list?
2. **Default:** Confirm that focus mirroring defaults to off.
3. **Recurring schedules:** Include schedule VPN enforcement now or defer it?
4. **Daily allowances:** Should an exhausted allowance automatically become a
   VPN target, or remain an Accessibility-only rule?
5. **Always-on semantics:** The existing VPN-only always-on list is independent
   from ordinary always-on overlay enforcement and must continue to operate
   when overlay enforcement is disabled. Confirm whether any product behavior
   should intentionally override this separation.
6. **Global mode:** Keep it available only as a separate explicit feature and
   never use it for focus mirroring?
7. **Recovery preference:** Should self-healing remain user-controlled, or
   should persistent protection always attempt bounded recovery?
8. **Distribution review:** Before shipping any implementation influenced by
   GPL-licensed reference code, should the code and licensing boundary receive
   a formal review?

### Recommended answers

For the lowest-risk first slice:

```text
Include opt-in focus mirroring.
Default it off.
Use PER_APP only.
Keep explicit VPN selections independent.
Defer schedule VPN and allowance mirroring unless separately approved.
Keep GLOBAL as a separate explicit feature.
Use bounded, visible recovery rather than fighting another VPN.
Implement independently from Silent Guardian's source.
```

---

## 14. Bottom line

FocusFlow does not need a packet-reading VPN to block background downloads. The
existing per-app null-routing design already blocks foreground and background
traffic for every package in the active VPN target set.

The work is to make the target set complete, native-owned, durable, and
correctly synchronized with the product's foreground rules—while preserving the
important guarantee that an unrelated foreground app continues to work.