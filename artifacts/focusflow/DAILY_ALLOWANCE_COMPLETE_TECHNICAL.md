# Daily Allowance — Complete Technical Review
> All three parts combined into one document.
> Every claim pinned to file and line.

## Review Tracking

Use the status marker beside each item as work progresses:

- `[ ]` Pending investigation or implementation
- `[x]` Fixed and verified
- `[✗]` Rejected, not applicable, or accepted as a limitation

Keep the file/line reference with every status change so each result remains traceable to the original finding.

### Master Checklist

#### Confirmed bugs

- [x] **1.1** `ACTION_USER_PRESENT` remaining time ignores the date and window reset — `AppBlockerAccessibilityService.kt:767-774` — reset-aware remaining-time calculation added; source-verified
- [x] **1.2** `parseUsage` returns stale interval usage after window expiry — `allowanceUsageCache.ts:37-39`, `SharedPrefsModule.kt:507` — cache now reads the native config and filters expired rolling windows; source-verified
- [x] **1.3** `force=true` joins a stale in-flight request — `allowanceUsageCache.ts:57-60` — forced reads now bypass the existing in-flight request; source-verified
- [x] **1.4** `checkForegroundNow` misses an already-foreground app after restart — `AppBlockerAccessibilityService.kt:562` — one-time 60-second foreground allowance recovery added; source-verified
- [x] **1.5** `timedExpireRunnable` fires after focus or standalone mode ends — `AppBlockerAccessibilityService.kt:2650-2661` — session cleanup and fire-time enforcement guard added; source-verified
- [x] **1.6** Allowance configuration changes leave an active timer and checkpoint loop running — `DailyAllowanceModal.tsx:handleSave`, `AppBlockerAccessibilityService.kt` — config writes broadcast a native session reset; source-verified
- [x] **1.7** `isFallbackBlocked` enforces allowance without an active enforcement session — `ForegroundTaskService.kt:522-530`, `1236-1282` — fallback allowance checks now require active enforcement; source-verified
- [x] **1.8** `goIdle()` does not cancel `allowanceExpiryRunnable` — `ForegroundTaskService.kt:732-753` — idle transition now cancels the pending expiry; source-verified
- [x] **1.9** The block overlay shows the wrong reason when an allowance is exhausted during focus — `AppBlockerAccessibilityService.kt:3295` — quota reason now takes priority in the reason builder; source-verified

#### Practice and maintenance concerns

- [x] **2.1** Interval mode has no `ForegroundTaskService` UsageStats backup — `ForegroundTaskService.kt:272-289, 370-396` — rolling-window UsageStats reconciliation added; source-verified
- [x] **2.2** The two services use an uncoordinated read-modify-write for usage — `AppBlockerAccessibilityService.kt:2456`, `ForegroundTaskService.kt:336, 468`, `SharedPrefsModule.kt:629` — shared in-process lock now covers service sync, expiry promotion, and manual resets; source-verified
- [x] **2.3** Usage progress and checkpoint timestamp are written in separate operations — `AppBlockerAccessibilityService.kt:2538-2577` — timed checkpoint now persists usage, heartbeat, and handoff marker in one editor; source-verified
- [x] **2.4** `todayDateString()` repeatedly allocates `SimpleDateFormat` objects — `AppBlockerAccessibilityService.kt`, `ForegroundTaskService.kt` — formatter instances are cached per service and refreshed if the device timezone changes; source-verified
- [x] **2.5** Deferred enforcement actions do not re-check enforcement state at fire time — `AppBlockerAccessibilityService.kt` — delayed launcher, power-menu, and app-dismissal actions now re-check the current toggle/session state; source-verified
- [x] **2.6** Always-on blocking with an empty list silently becomes allowance-only enforcement — `AppBlockerAccessibilityService.kt`, `block-defense.tsx` — the Defense screen now explains that no apps are blocked 24/7 until the list is populated; source-verified
- [x] **2.7** The modal refresh timer is shorter than the usage-cache TTL — `DailyAllowanceModal.tsx:usageTimer` — refresh cadence now matches the 10-second cache TTL; source-verified
- [x] **2.8** Switching allowance modes preserves old values accidentally — `DailyAllowanceModal.tsx:updateEntry` — non-destructive preservation is now documented as intentional; source-verified
- [x] **2.9** `scheduleAllowanceExpiry` does not check for a fresh active allowance session — `ForegroundTaskService.kt:392-406` — expiry callback now respects the active-session heartbeat; source-verified
- [x] **2.10** `focusMirrorVpnEnabled` is missing from backup — `backupService.ts` — backup export/import already preserves this setting; source-verified

---

## 1. CONFIRMED BUGS

### 1.1 `ACTION_USER_PRESENT` remaining time ignores date and window reset
**File:** `AppBlockerAccessibilityService.kt:767-774`
**Severity:** High

`remainingMs` is computed from raw `usedMs` with no staleness check:

```kotlin
val usedMs   = pkgUsed?.optLong("usedMs", 0L) ?: 0L
val remainingMs = when (entry.mode) {
    "time_budget" -> (entry.budgetMs - usedMs).coerceAtLeast(0L)
    "interval"    -> (entry.intervalMs - usedMs).coerceAtLeast(0L)
    else -> 0L
}
if (remainingMs <= 0L) { kick out }
```

`isAllowanceAvailable` at line 756 correctly checks the date for `time_budget` and the window expiry for `interval` and returns `true` when either has reset. The `remainingMs` block immediately below ignores both checks and produces zero, triggering an immediate kick-out despite `isAllowanceAvailable` returning true.

**Failure — `time_budget`:** Yesterday's full budget stored as `usedMs = budgetMs`. New day: `isAllowanceAvailable` returns `true`. `remainingMs = budgetMs - budgetMs = 0`. Kicked out on a fresh day.

**Failure — `interval`:** Window expired while screen was off. `isAllowanceAvailable` returns `true`. `remainingMs = intervalMs - intervalMs = 0`. Kicked out despite window reset.

**Fix:**
```kotlin
val pkgUsed = loadUsedObject().optJSONObject(pkg)
val remainingMs = when (entry.mode) {
    "time_budget" -> {
        val today    = todayDateString()
        val usedDate = pkgUsed?.optString("date", "") ?: ""
        val usedMs   = if (usedDate == today) pkgUsed?.optLong("usedMs", 0L) ?: 0L else 0L
        (entry.budgetMs - usedMs).coerceAtLeast(0L)
    }
    "interval" -> {
        val windowStartMs = pkgUsed?.optLong("windowStartMs", 0L) ?: 0L
        val windowExpired = now > windowStartMs + entry.windowMs
        if (windowExpired) entry.intervalMs
        else (entry.intervalMs - (pkgUsed?.optLong("usedMs", 0L) ?: 0L)).coerceAtLeast(0L)
    }
    else -> 0L
}
```

---

### 1.2 `parseUsage` returns stale interval usage after window expiry
**Files:** `allowanceUsageCache.ts:37-39`, `SharedPrefsModule.kt:507`
**Severity:** Medium

```typescript
if (value.mode === 'interval') {
  return [pkg, value.windowStartMs ? value : {}];
}
```

Returns the full value including stale `usedMs` from an expired window because `parseUsage` has no access to `windowMs`. `getAllowanceSnapshot` at `SharedPrefsModule.kt:504-510` does not return `configJson`.

**Fix — Step 1:** Add `configJson` to snapshot:
```kotlin
putString("usageJson",  current.getString("daily_allowance_used", null))
putString("configJson", current.getString("daily_allowance_config", null))
putString("activeSessionPackage", current.getString("active_session_pkg", null))
putDouble("activeSessionEndMs",   current.getLong("active_session_end_ms", 0L).toDouble())
```

**Fix — Step 2:** Use config in `parseUsage` to zero out expired windows:
```typescript
function parseUsage(raw, configRaw, today) {
  const config = buildWindowMsMap(configRaw); // pkg → windowMs
  return Object.fromEntries(
    Object.entries(parsed).map(([pkg, value]) => {
      if (value.mode === 'interval') {
        if (!value.windowStartMs) return [pkg, {}];
        const windowMs = config[pkg] ?? 0;
        const expired  = windowMs > 0 && Date.now() > value.windowStartMs + windowMs;
        return [pkg, expired ? {} : value];
      }
      return [pkg, value.date === today ? value : {}];
    })
  );
}
```

---

### 1.3 `force=true` in `getAllowanceUsageSnapshot` joins stale in-flight
**File:** `allowanceUsageCache.ts:57-60`
**Severity:** Medium

```typescript
if (!force && cached && cached.date === today && now - cached.fetchedAt < CACHE_TTL_MS) {
  return cached.value;
}
if (inFlight) return inFlight;   // ← no force check
```

`force=true` bypasses the cache but always joins an existing in-flight request. Config changes that need an immediate fresh read silently get stale data if a fetch is already in progress.

**Fix:**
```typescript
if (!force && inFlight) return inFlight;
```

---

### 1.4 `checkForegroundNow` 3-second window misses already-foreground apps
**File:** `AppBlockerAccessibilityService.kt:562`
**Severity:** Medium

```kotlin
val events = usm.queryEvents(now - 3_000L, now)
```

On service restart, if the user is already inside an allowance app with no new foreground transition in the last 3 seconds, this returns nothing. `currentTimedPkg` is never set and the usage timer never starts.

**Fix:** run a one-time wider query (60 seconds) in `onServiceConnected` to seed the current foreground package:
```kotlin
override fun onServiceConnected() {
    // existing init...
    detectCurrentForegroundOnConnect()  // 60s window, one-time
    startForegroundWatchdog()           // continues with 3s window
}
```

---

### 1.5 Ghost kick — `timedExpireRunnable` fires after focus or SA ends
**File:** `AppBlockerAccessibilityService.kt:2650-2661`
**Severity:** High

`timedExpireRunnable` calls `performGlobalAction(GLOBAL_ACTION_HOME)` unconditionally. When focus or SA expires while a timed allowance session is in progress, `focusActive = false` (line 828) and `saActive = false` (line 840) are set with no corresponding `handler.removeCallbacks(timedExpireRunnable)`. The runnable fires at the original session end time and kicks the user home with no active enforcement.

Same trigger when an app is removed from the allowance config while the runnable is pending — `findAllowanceEntry` returns null, accumulation is skipped, but `performGlobalAction(HOME)` still fires.

**Fix:**
```kotlin
val runnable = Runnable {
    timedExpireRunnable = null
    val entry = findAllowanceEntry(pkg)
    if (entry != null && currentTimedPkg == pkg) {
        accumulateTimedUsage(pkg, entry, currentTimedOpenAtMs)
    }
    clearActiveSessionSignal()
    currentTimedPkg = null
    currentTimedOpenAtMs = 0L
    currentTimedSessionEndMs = 0L
    val now2 = System.currentTimeMillis()
    val focusStillActive = prefs.getBoolean(PREF_FOCUS_ON, false).let { on ->
        if (!on) false
        else prefs.getLong("task_end_ms", 0L).let { end -> end <= 0L || now2 < end }
    }
    val saStillActive = prefs.getBoolean(PREF_SA_ACTIVE, false).let { on ->
        if (!on) false
        else prefs.getLong(PREF_SA_UNTIL, 0L).let { until -> until <= 0L || now2 < until }
    }
    val alwaysOn = prefs.getBoolean(PREF_ALWAYS_BLOCK, false)
    if (focusStillActive || saStillActive || alwaysOn) {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }
}
```

Apply the same guard to the `delayMs <= 0L` immediate-expiry branch at line 2638-2648.

---

### 1.6 Config change during active session leaves `timedExpireRunnable` and checkpoint loop running
**Files:** `DailyAllowanceModal.tsx:handleSave`, `AppBlockerAccessibilityService.kt`
**Severity:** Medium

`handleSave` → `onSave` → `setDailyAllowanceConfig` writes new SharedPrefs. The AccessibilityService is not notified. Three consequences:

**A — Mode changed:** Timer from old mode still fires. If mode changed to `count`, `accumulateTimedUsage` is skipped (correct) but `performGlobalAction(HOME)` still fires if enforcement is active.

**B — App removed entirely:** `findAllowanceEntry` returns null. Accumulation skipped. `performGlobalAction(HOME)` still fires (same Bug 1.5 guard fixes this).

**C — Budget lowered below already-used time:** Correct enforcement but surprising UX — app is retroactively blocked immediately. No UI warning about this.

**Fix for A and B:** broadcast a config-change intent from `setDailyAllowanceConfig`. AccessibilityService listens and re-validates `currentTimedPkg` against the new config:
```kotlin
ACTION_ALLOWANCE_CONFIG_CHANGED -> {
    val pkg = currentTimedPkg ?: return
    val newEntry = findAllowanceEntry(pkg)
    if (newEntry == null || (newEntry.mode != "time_budget" && newEntry.mode != "interval")) {
        if (newEntry == null) accumulateTimedUsage(pkg, /* last known entry */, currentTimedOpenAtMs)
        clearActiveSessionSignal()
        timedExpireRunnable?.let { handler.removeCallbacks(it) }
        timedExpireRunnable = null
        currentTimedPkg = null
        currentTimedOpenAtMs = 0L
        currentTimedSessionEndMs = 0L
    }
}
```

---

### 1.7 `isFallbackBlocked` enforces allowance without any active enforcement session
**File:** `ForegroundTaskService.kt:522-530, 1236-1282`
**Severity:** Medium

`fallbackPollRunnable` early-exit at line 522:
```kotlin
if (!focusActive && !saActive && !hasGreyout && !alwaysBlockActive && !hasAllowanceConfig) {
    handler.postDelayed(this, FALLBACK_POLL_MS)
    return
}
```

When `hasAllowanceConfig` is true, the poller continues even with no enforcement session active. `isFallbackBlocked` then returns `true` for exhausted `time_budget` and `count` packages and shows the overlay.

The AccessibilityService does the opposite — it returns early at line 1328 when `!focusActive && !saActive && !alwaysBlockActive`, never reaching the allowance check. Same exhausted budget, different behaviour depending on which service is running.

**Fix:** mirror the AccessibilityService guard:
```kotlin
val allowanceActive = hasAllowanceConfig && (focusActive || saActive || alwaysBlockActive)
if (!focusActive && !saActive && !hasGreyout && !alwaysBlockActive && !allowanceActive) {
    handler.postDelayed(this, FALLBACK_POLL_MS)
    return
}
```
And in `isFallbackBlocked`, wrap the allowance section:
```kotlin
if (focusActive || saActive || alwaysBlockActive) {
    // existing allowance check
}
```

---

### 1.8 `goIdle()` does not cancel `allowanceExpiryRunnable`
**File:** `ForegroundTaskService.kt:732-753`
**Severity:** Medium

```kotlin
private fun goIdle() {
    isActiveMode = false
    handler.removeCallbacks(tickRunnable)
    handler.removeCallbacks(breakTickRunnable)
    // allowanceExpiryRunnable is NOT cancelled here
    ...
}
```

When focus or SA ends and `goIdle()` is called, the budget-exhaustion runnable remains queued. When it fires, it writes `usedMs = budgetMs` and calls `handler.post(fallbackPollRunnable)`. If the AccessibilityService is alive, `fallbackPollRunnable` defers immediately (safe). If it is down, `isFallbackBlocked` may show a block overlay in a free period.

**Fix:**
```kotlin
private fun goIdle() {
    isActiveMode = false
    handler.removeCallbacks(tickRunnable)
    handler.removeCallbacks(breakTickRunnable)
    allowanceExpiryRunnable?.let { handler.removeCallbacks(it) }
    allowanceExpiryRunnable = null
    ...
}
```

---

### 1.9 Wrong block reason shown when allowance exhausted during focus mode
**File:** `AppBlockerAccessibilityService.kt:3295`
**Severity:** Low (display only)

When `focusActive=true`, `allowedList` is empty, and the allowance is exhausted, `isPackageBlocked` returns `false` (app is in the config so it passes). The subsequent allowance check blocks correctly. But `buildBlockReason` evaluates the focus-mode-list branch first, sees the app is in the config (not null), and returns "Not allowed in the current Focus Mode app list" instead of the allowance exhaustion reason.

**Fix:** in `buildBlockReason`, check `isAllowanceAvailable` and prefer the allowance exhaustion reason when `focusActive=true` and the app is in the allowance config but exhausted.

---

## 2. PRACTICES CONCERNS

### 2.1 `interval` mode has limited ForegroundTaskService UsageStats recovery
**File:** `ForegroundTaskService.kt:263-275`

`time_budget` and `interval` entries both receive a UsageStats reconciliation in
`ForegroundTaskService`, alongside the AccessibilityService checkpoints. For
interval mode, reconciliation is limited to the currently stored rolling
window. Android UsageStats reports aggregate foreground time and cannot identify
which historical rolling window owns that time, so exact recovery after an
expired window remains a platform limitation.

---

### 2.2 Read-modify-write on `daily_allowance_used` needs coordination
**Files:** `AppBlockerAccessibilityService.kt:2585, 2626`, `ForegroundTaskService.kt:356`

Both services use the same read-modify-write pattern:
```kotlin
val allUsed = loadUsedObject()
// modify
prefs.edit().putString(PREF_DAILY_ALLOWANCE_USED, allUsed.toString()).apply()
```

The shared `ALLOWANCE_USAGE_LOCK` now surrounds allowance reads, writes, handoff
markers, UsageStats reconciliation, expiry promotion, and manual resets. This
prevents the two in-process services from reading the same snapshot and
overwriting each other's update. UsageStats writes remain raise-only as an
additional safeguard.

---

### 2.3 Progress and checkpoint heartbeat must move together
**File:** `AppBlockerAccessibilityService.kt:2430-2439`

`checkpointActiveTimedSession` now persists usage, the checkpoint heartbeat, and
the handoff marker through one locked update. A restart therefore cannot observe
new usage paired with an old heartbeat and incorrectly abandon recovery.

---

### 2.4 `todayDateString()` should not recreate its formatter on every call
**Files:** `AppBlockerAccessibilityService.kt:2681`, `ForegroundTaskService.kt:299, 398, 1240`

The allowance code calls the local date helper from multiple paths per accessibility event and UsageStats sync. Both services now keep one formatter instance and synchronize access to it. The cached formatter timezone is refreshed if the device timezone changes, so the local date boundary remains correct without repeatedly constructing `SimpleDateFormat`.

---

### 2.5 `timedExpireRunnable` and deferred enforcement actions don't re-check enforcement state at fire time
**File:** `AppBlockerAccessibilityService.kt:1376-1384`

Enforcement state is verified at schedule time, but handler callbacks run later. The delayed launcher lock, power-menu dismissal, and blocked-app dismissal paths now re-check the relevant toggle, session, package, or allowance state immediately before acting. Existing retry callbacks already perform their own foreground and policy checks.

---

### 2.6 `alwaysBlockActive` + empty always-on list = allowance-only enforcement (non-obvious)
**File:** `AppBlockerAccessibilityService.kt:1328, 1362`

When `alwaysBlockActive=true` but `alwaysOnPackages` is empty, `isPackageBlocked` returns false for all apps. Allowance checks run. Apps without an allowance entry are unrestricted. Apps with an allowance entry are enforced by quota. This remains the intended behavior, and the Block Defense screen now explains the empty-list state and directs the user to populate the always-on list.

---

### 2.7 Modal usage refresh timer should match the cache TTL
**File:** `DailyAllowanceModal.tsx:usageTimer`

`refreshUsage` calls `getAllowanceUsageSnapshot(force = false)` and the cache TTL is 10 seconds. The modal timer is now also 10 seconds, so each scheduled refresh is aligned with the cache's freshness window rather than producing an unnecessary cached-only tick.

---

### 2.8 Mode switch in modal preserves previous mode values intentionally
**File:** `DailyAllowanceModal.tsx:updateEntry`

Switching from `time_budget` to `count` keeps `budgetMinutes` in the entry object. Switching back restores it. This is intentional non-destructive mode switching, and the update path now documents that preserving the inactive mode's values is part of the user-facing behavior.

---

### 2.9 `scheduleAllowanceExpiry` runnable must check `hasFreshActiveAllowanceSession`
**File:** `ForegroundTaskService.kt:392-406`

The 60-second sync loop and the `allowanceExpiryRunnable` both guard with
`hasFreshActiveAllowanceSession(pkg, now)` before promoting stored usage:

```kotlin
val runnable = Runnable {
    allowanceExpiryRunnable = null
    if (!pkg.equals(getFallbackForegroundPackage(), ignoreCase = true)) return@Runnable
    val now2 = System.currentTimeMillis()
    if (hasFreshActiveAllowanceSession(pkg, now2)) return@Runnable
    val used = allUsed.optJSONObject(pkg) ?: org.json.JSONObject()
    used.put("usedMs", budgetMs)   // writes unconditionally
    ...
}
```

If AccessibilityService has a fresh session signal when the expiry fires, the
fallback callback exits and leaves the live session as the owner. Otherwise it
promotes the usage under the shared allowance lock.

---

### 2.10 `focusMirrorVpnEnabled` missing from backup
**File:** `backupService.ts`

Every other VPN setting is backed up. `focusMirrorVpnEnabled` (added in the recent VPN coordinator update) is absent. A user who migrates devices or reinstalls silently loses this setting and defaults to `false`. Noted in VPN_V2_REVIEW.md but applies here since the setting is logically coupled with the daily allowance mirror feature.

---

## 3. COMPLETE PRIORITY TABLE

| Priority | Issue | File(s) | Severity | Type |
|---|---|---|---|---|
| 1 | Ghost kick — `timedExpireRunnable` fires after focus/SA ends | `AppBlockerAccessibilityService.kt:2650` | High | Bug |
| 2 | `USER_PRESENT` remaining time ignores date/window reset | `AppBlockerAccessibilityService.kt:767` | High | Bug |
| 3 | `isFallbackBlocked` enforces allowance without enforcement session | `ForegroundTaskService.kt:522, 1236` | Medium | Bug |
| 4 | `checkForegroundNow` 3s window misses already-foreground app | `AppBlockerAccessibilityService.kt:562` | Medium | Bug |
| 5 | `goIdle()` doesn't cancel `allowanceExpiryRunnable` | `ForegroundTaskService.kt:732` | Medium | Bug |
| 6 | Config change during session leaves stale timer and loop | `AppBlockerAccessibilityService.kt`, `DailyAllowanceModal.tsx` | Medium | Bug |
| 7 | `parseUsage` returns stale interval usage + `configJson` missing from snapshot | `allowanceUsageCache.ts:37`, `SharedPrefsModule.kt:507` | Medium | Bug |
| 8 | `force=true` joins stale in-flight instead of starting fresh | `allowanceUsageCache.ts:59` | Medium | Bug |
| 9 | `scheduleAllowanceExpiry` body missing `hasFreshActiveAllowanceSession` guard | `ForegroundTaskService.kt:392` | Low | Bug |
| 10 | Wrong block reason when exhausted allowance app blocked during focus | `AppBlockerAccessibilityService.kt:3295` | Low | Bug |
| 11 | `interval` mode has no ForegroundTaskService UsageStats backup | `ForegroundTaskService.kt:263` | — | Practice |
| 12 | Read-modify-write on `daily_allowance_used` is uncoordinated | `AppBlockerAccessibilityService.kt:2585`, `ForegroundTaskService.kt:356` | — | Practice |
| 13 | Two `.apply()` calls in checkpoint — not atomic | `AppBlockerAccessibilityService.kt:2430` | — | Practice |
| 14 | Modal refresh timer (5s) shorter than cache TTL (10s) | `DailyAllowanceModal.tsx` | — | Practice |
| 15 | Mode switch preserves old values silently — accidental good UX | `DailyAllowanceModal.tsx` | — | Practice |
| 16 | `alwaysBlockActive` + empty list = allowance-only (non-obvious) | `AppBlockerAccessibilityService.kt:1328` | — | Practice |
| 17 | `todayDateString()` / `SimpleDateFormat` allocation in hot paths | Both services | — | Performance |
| 18 | Deferred enforcement actions don't re-check enforcement state at fire time | `AppBlockerAccessibilityService.kt:1376` | — | Practice |
| 19 | `focusMirrorVpnEnabled` missing from backup | `backupService.ts` | — | Practice |
