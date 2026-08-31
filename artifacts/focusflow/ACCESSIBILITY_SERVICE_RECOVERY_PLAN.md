# FocusFlow — Accessibility Service Liveness and Recovery Plan

**Status:** Planning document only  
**Scope:** Android FocusFlow app (`artifacts/focusflow`)  
**Last reviewed:** 2026-08-30  
**Implementation rule:** This document describes the agreed direction. It does not
authorize implementation until the product decisions and safety boundaries below
are accepted.

## 1. Executive summary

Android normally does **not** revoke Accessibility access merely because the
AccessibilityService process was killed. The service can remain enabled in
Android Settings while its process is dead or while Android has not yet rebound
it.

Those are separate facts:

```text
Accessibility enabled in Settings  ≠  AccessibilityService currently alive
```

FocusFlow should therefore keep Accessibility as the primary, event-driven
enforcement path, while making the foreground service and an independent
AlarmManager watchdog responsible for detecting a stale primary service and
continuing enforcement through a degraded UsageStats/activity fallback.

The goal is **not** to secretly toggle the user's Accessibility setting or to
pretend that FocusFlow can manually bind an AccessibilityService. Android owns
that lifecycle. The goal is to:

1. detect the difference between enabled and alive,
2. recover foreground blocking when the primary service is unavailable,
3. notify the user when Android has not reconnected the service,
4. resume primary enforcement automatically when Android reconnects it, and
5. preserve clear, honest status in the UI.

## 2. Platform boundary

### 2.1 What a normal process kill means

For an ordinary system/OEM process kill:

- the enabled Accessibility setting will usually remain enabled;
- Android may bind the service again and call `onServiceConnected()`;
- any `TYPE_ACCESSIBILITY_OVERLAY` view owned by the dead service is removed;
- in the interval before reconnection, Accessibility events are unavailable;
- the user can potentially open a blocked app unless another enforcement path
  catches it.

The enabled setting is authorization for Android to bind the service. It is not
a liveness signal and it is not a guarantee that the service process remains
resident.

### 2.2 What Android does not permit FocusFlow to do

The app must not depend on any of these as a guaranteed recovery mechanism:

- calling `startService()` on `AppBlockerAccessibilityService`;
- starting an AccessibilityService directly from `ForegroundTaskService`;
- writing `Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES`;
- silently granting or restoring Accessibility access;
- using `onDestroy()` as the only recovery trigger;
- assuming `START_STICKY` applies to the system-managed Accessibility binding.

The Android AccessibilityService lifecycle is system-managed and is started
through the user enabling it in system Settings. A foreground service can restart
itself and can provide fallback enforcement, but it cannot force Android to
rebind the AccessibilityService through a supported public API.

### 2.3 Situations that are different from a normal kill

The implementation and UI must distinguish these states:

| State | Meaning | Automatic app action |
| --- | --- | --- |
| Enabled and heartbeat fresh | Primary service appears healthy | Use Accessibility enforcement |
| Enabled and heartbeat stale | Android setting remains, service is probably dead/unbound | Use fallback, notify, wait for reconnection |
| Disabled by user | Access was intentionally removed | Use fallback if possible, request user repair |
| Force-stopped | Android may block component restarts; OEM behavior varies | Do not claim automatic recovery |
| App uninstalled/disabled | Components cannot run | No recovery possible |
| Device rebooted/unlocked | Boot lifecycle can run | Restore native state and foreground fallback |

Some OEMs or Android variants may alter the enabled setting after force-stop or
aggressive management. That is not the same case as a routine process death and
must be reported as permission/configuration loss when observed.

## 3. Current FocusFlow baseline

### 3.1 Already present

- ✅ `AppBlockerAccessibilityService` is the primary foreground app enforcement
  authority.
- ✅ `onServiceConnected()` restores service-local state and starts its internal
  foreground-package watchdog.
- ✅ The blocking overlay now uses `TYPE_ACCESSIBILITY_OVERLAY` with
  `FLAG_NOT_FOCUSABLE`, and has an activity fallback when the window cannot be
  added.
- ✅ `ForegroundTaskService` is a foreground service with `START_STICKY`.
- ✅ `ForegroundTaskService` has a roughly one-second UsageStats fallback poll
  and can launch `BlockOverlayActivity`.
- ✅ `BootReceiver` handles boot, user unlock, package replacement, and selected
  OEM quick-boot broadcasts.
- ✅ The VPN has a separate AlarmManager watchdog pattern that can be reused as
  a design reference.
- ✅ FocusFlow already requests battery-optimization-related access and has
  native settings/permission status surfaces.
- ✅ The project has a Device Admin component, but that is an anti-bypass option,
  not an AccessibilityService restart mechanism.

### 3.2 Current gap

The foreground fallback currently uses the enabled-services Settings value as
its primary availability check. If Android still lists FocusFlow as enabled
after killing or disconnecting the service, the fallback can stand down even
though no Accessibility events are being processed.

The existing active timed-allowance checkpoint is a recovery signal for
allowance accounting. It is not a general AccessibilityService liveness
heartbeat and must not be reused as one without preserving its current
accounting semantics.

### 3.3 Current recovery boundary

The existing VPN watchdog is intentionally separate. It can restart
`NetworkBlockerVpnService`, but it does not and must not claim to restart
`AppBlockerAccessibilityService`.

## 4. Desired runtime behavior

```text
Active blocking policy
        │
        ├─ Accessibility enabled + fresh heartbeat
        │       └─ AccessibilityService is primary
        │
        ├─ Accessibility enabled + stale heartbeat
        │       ├─ ForegroundTaskService fallback becomes active
        │       ├─ independent watchdog restores/starts fallback process
        │       └─ recovery notification asks user to repair if needed
        │
        └─ Accessibility disabled
                ├─ fallback remains active when available
                └─ notification/deep link requests user re-enable access

When Android later reconnects the AccessibilityService:
        ├─ onServiceConnected() restores primary state
        ├─ heartbeat becomes fresh
        ├─ fallback stops acting
        └─ stale-service notification is cleared or downgraded
```

Fallback enforcement is a degraded safety net. It uses UsageStats foreground
signals and an activity rather than the Accessibility event stream, so it must
not be described as behaviorally identical to primary enforcement.

## 5. Implementation tracker

**Legend:** ✅ complete or confirmed · 🚧 in progress · ❌ open · ⏸ deferred

### Phase 0 — Confirm constraints and product behavior

- ✅ Confirm that a normal service/process kill does not inherently mean
  Accessibility access was revoked.
- ✅ Confirm that Android owns AccessibilityService binding and that FocusFlow
  cannot silently re-enable it.
- ✅ Confirm that a foreground service can provide fallback enforcement but
  cannot guarantee a manual Accessibility rebind.
- ✅ Confirm that competitor public materials do not prove a hidden,
  guaranteed Accessibility restart API.
- ❌ Decide whether the independent watchdog runs only while a blocking policy is
  active or also while FocusFlow is idle. Recommended: active policy only.
- ❌ Decide the exact user-facing wording for “enabled but disconnected” versus
  “permission disabled.”

### Phase 1 — Add a real Accessibility liveness signal

- ❌ Define a dedicated durable heartbeat key, separate from allowance
  accounting state.
- ❌ Write a heartbeat after successful `onServiceConnected()`.
- ❌ Refresh the heartbeat from a bounded service-owned loop while the service
  is actually running.
- ❌ Record enough state to distinguish a fresh connection from an old timestamp
  after process death.
- ❌ Ensure heartbeat writes do not become a high-frequency SQLite or bridge
  operation; this belongs in native SharedPreferences or an equivalent native
  state store.
- ❌ Define a conservative stale threshold that tolerates scheduling jitter but
  detects a dead service promptly.
- ❌ Stop relying on the Settings enabled list alone as proof of service health.
- ❌ Keep the existing timed-allowance checkpoint and recovery semantics
  unchanged.

### Phase 2 — Make the foreground fallback heartbeat-aware

- ❌ Update `ForegroundTaskService` to treat the primary service as healthy only
  when both the enabled state and heartbeat are valid.
- ❌ If the enabled state is true but the heartbeat is stale, activate the
  UsageStats fallback instead of standing down.
- ❌ Keep all active-policy and expiry checks at fallback fire time.
- ❌ Preserve the current fallback safety exclusions and cooldown behavior.
- ❌ Prevent duplicate blocking actions when the AccessibilityService reconnects
  while a fallback action is already pending.
- ❌ Make fallback status explicit internally so diagnostics can distinguish
  primary enforcement from degraded enforcement.
- ❌ Ensure fallback stops once a fresh Accessibility heartbeat is observed and
  does not keep launching duplicate overlays.

### Phase 3 — Add an independent app enforcement watchdog

- ❌ Add a native `AlarmManager` receiver for active foreground-enforcement
  recovery, modeled separately from `VpnWatchdogReceiver`.
- ❌ Schedule it when focus, standalone, always-on, or another supported blocking
  policy requires foreground protection.
- ❌ Cancel it immediately when no foreground blocking policy remains.
- ❌ On delivery, validate the current policy, heartbeat age, and permission
  state before starting or restoring `ForegroundTaskService`.
- ❌ Make receiver dispatch immediate; do not rely on a delayed callback after
  `onReceive()` returns.
- ❌ Rearm the watchdog after boot, user unlock, and package replacement when a
  durable blocking policy still requires it.
- ❌ Bound recovery attempts and avoid an infinite restart/notification loop.
- ❌ Keep this watchdog explicitly separate from VPN recovery and from
  Accessibility permission mutation.

### Phase 4 — User notification and repair flow

- ❌ Add a dedicated notification state for:
  - Accessibility disabled,
  - Accessibility enabled but service heartbeat stale,
  - fallback enforcement active,
  - primary service recovered.
- ❌ Provide a notification action that opens Android Accessibility Settings.
- ❌ Keep the notification until the service is either reconnected or the active
  policy ends.
- ❌ Avoid claiming that the app has automatically restored Accessibility access.
- ❌ Reuse the existing restricted-settings recovery guidance where the service
  entry is greyed out or Android requires an additional unlock step.
- ❌ Explain that battery restrictions, OEM auto-start controls, and recents
  task-locking can affect reliability.
- ❌ Provide manufacturer-specific instructions only where the app can maintain
  them accurately; do not promise that a device setting is universally
  available.
- ⏸ Treat Device Administrator as a separately reviewed anti-bypass feature,
  not as part of service revival. Do not make this plan depend on it.

### Phase 5 — Diagnostics and lifecycle safety

- ❌ Expose native diagnostics for:
  - enabled setting,
  - last heartbeat time/age,
  - primary/fallback enforcement mode,
  - last recovery attempt,
  - last recovery failure,
  - current blocking policy,
  - notification state.
- ❌ Sanitize diagnostics so package names and timestamps are sufficient without
  collecting screen contents or unrelated app data.
- ❌ Ensure intentional focus teardown cancels the app watchdog and clears
  recovery-only state without changing user block configuration.
- ❌ Ensure a stale heartbeat cannot keep a completed session alive.
- ❌ Ensure the watchdog cannot restart the fallback when all blocking policies
  have expired.

### Phase 6 — Verification

- ❌ Add source-contract tests for heartbeat ownership, stale-enabled fallback,
  watchdog guards, cancellation, notification states, and no-attempt-to-mutate
  `Settings.Secure`.
- ❌ Add Kotlin/JVM tests for heartbeat age, clock edge cases, active-policy
  gates, recovery attempt bounds, and fallback/primary transitions.
- ❌ Verify service reconnect while the app is already in the foreground.
- ❌ Verify Accessibility process/service death while the enabled Settings value
  remains present.
- ❌ Verify whole-app process death while an active blocking policy remains.
- ❌ Verify fallback overlay behavior when the primary service is unavailable.
- ❌ Verify user-disabled Accessibility and repair notification behavior.
- ❌ Verify force-stop behavior without claiming impossible automatic recovery.
- ❌ Verify boot and user-unlock restoration.
- ❌ Test at least one AOSP/emulator path and representative OEM paths,
  especially Samsung, Xiaomi/MIUI or HyperOS, Oppo/ColorOS, and OnePlus.
- ❌ Document which behaviors require real-device evidence; source contracts do
  not prove Android binding, overlay, task, or OEM behavior.

## 6. Acceptance criteria

The implementation is complete only when all of the following are true:

1. A stale enabled setting is not treated as proof that Accessibility is alive.
2. During an active blocking policy, a killed/disconnected AccessibilityService
   causes the foreground fallback to become eligible automatically.
3. An independent system-managed trigger can restore the fallback after the app
   process dies, subject to Android/OEM limits.
4. A fresh `onServiceConnected()` heartbeat returns the app to primary
   enforcement without duplicate fallback overlays.
5. The app never claims to have silently re-enabled Accessibility.
6. The user receives a clear notification when repair is required.
7. Expired or intentionally stopped policies cancel recovery and do not keep
   services or alarms alive.
8. Force-stop and OEM limitations are represented honestly in diagnostics and
   tests.
9. Existing VPN recovery remains independent and all existing enforcement
   safety gates remain intact.
10. Real-device testing records which OEM behaviors were observed rather than
    treating emulator behavior as universal.

## 7. Competitor research notes

This research is limited to public documentation; Stay Focused and Opal are
closed-source products, so public pages cannot prove their internal lifecycle
implementation.

### Stay Focused

Stay Focused publicly advertises Strict Mode and Lock Mode. Its public privacy
documentation says that enabling Device Administrator can help prevent
uninstalling or force-closing the app. These are anti-bypass and persistence
measures, not proof that the app can force Android to rebind an Accessibility
Service.

Relevant public pages:

- https://stayfocused.me/
- https://www.stayfocused.me/privacy.html

### Opal

Opal's public “blocking doesn't seem to be working” help page is primarily
iOS-focused. Its public materials do not establish a guaranteed Android
AccessibilityService restart mechanism.

Relevant public page:

- https://www.opal.so/help/blocking-doesnt-seem-to-be-working

### Android references

- AccessibilityService lifecycle:
  https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- Accessibility service implementation:
  https://developer.android.com/guide/topics/ui/accessibility/service
- Foreground services:
  https://developer.android.com/develop/background-work/services/fgs

## 8. Explicit non-goals

- No silent modification of Android secure Accessibility settings.
- No unsupported direct binding or manual restart claim for
  `AppBlockerAccessibilityService`.
- No guarantee against force-stop, uninstall, disabled packages, or every OEM
  battery manager.
- No replacement of the current VPN watchdog with the foreground-enforcement
  watchdog.
- No change to the meaning of user block settings merely because the primary
  service is temporarily unavailable.
- No use of Device Administrator as a prerequisite for ordinary FocusFlow
  blocking.
