# FocusFlow — Final Implementation Plan
## UsageStats + Daily Allowance + Fallback Enforcement

All fixes are scoped to your actual codebase. Nothing from the reference packs
is included unless it directly patches a confirmed gap in your code.

---

## PART 1 — CRITICAL: Fallback Enforcement Gaps (ForegroundTaskService.kt)

These three gaps mean that the moment the A11y service is killed (OEM battery
manager on Samsung/Xiaomi/Huawei/Realme — this is routine), three entire
enforcement systems silently stop working.

### Gap 1A — Wrong foreground app detection

```kotlin
// FILE: ForegroundTaskService.kt ~line 1105
// CURRENT: queryUsageStats → returns most-recently-used app TODAY, not NOW
private fun getFallbackForegroundPackage(): String? {
    val stats = usm.queryUsageStats(INTERVAL_DAILY, now - 5_000L, now)
    return stats?.maxByOrNull { it.lastTimeUsed }?.packageName  // stale
}

// FIXED: queryEvents → last ACTIVITY_RESUMED = actually foreground right now
private fun getFallbackForegroundPackage(): String? {
    return try {
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 5_000L, now)
        val event = UsageEvents.Event()
        val fgType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            UsageEvents.Event.ACTIVITY_RESUMED
        else UsageEvents.Event.MOVE_TO_FOREGROUND
        var latest: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == fgType) latest = event.packageName
        }
        latest
    } catch (_: Exception) { null }
}
```

### Gap 1B — Early exit ignores always-on and daily allowance

The fallback poll exits before calling `isFallbackBlocked` when only always-on
or daily allowance is active (no focus session, no standalone, no greyout).

```kotlin
// FILE: ForegroundTaskService.kt ~line 483 — inside fallbackPollRunnable
// CURRENT — exits when only always-on or allowance is active
if (!focusActive && !saActive && !hasGreyout) { return }

// FIXED — read two extra flags
val alwaysBlockActive = blockPrefs.getBoolean("always_block_active", false)
val hasAllowanceConfig = blockPrefs.getString("daily_allowance_config", null)
    .let { !it.isNullOrBlank() && it != "null" && it != "[]" }

if (!focusActive && !saActive && !hasGreyout &&
    !alwaysBlockActive && !hasAllowanceConfig) {
    fallbackLastBlockedPkg = null
    handler.postDelayed(this, FALLBACK_POLL_MS)
    return
}
```

### Gap 1C — `isFallbackBlocked` missing always-on and daily allowance

Add these two blocks at the END of `isFallbackBlocked`, before `return false`.

**Always-on block:**
```kotlin
// ── Always-on enforcement ─────────────────────────────────────────────
val alwaysBlockActive = blockPrefs.getBoolean("always_block_active", false)
if (alwaysBlockActive) {
    val alwaysJson = blockPrefs.getString("always_block_packages", "[]") ?: "[]"
    try {
        val arr = org.json.JSONArray(alwaysJson)
        for (i in 0 until arr.length()) {
            if (pkg.equals(arr.getString(i), ignoreCase = true)) return true
        }
    } catch (_: Exception) { }
}
```

**Daily allowance exhaustion check:**
```kotlin
// ── Daily allowance — read the same SharedPrefs A11y writes ──────────
val configJson = blockPrefs.getString("daily_allowance_config", null)
if (!configJson.isNullOrBlank() && configJson != "null") {
    try {
        val today = java.text.SimpleDateFormat("yyyy-MM-dd",
            java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getDefault()
        }.format(java.util.Date())
        val now2 = System.currentTimeMillis()
        val arr = org.json.JSONArray(configJson)
        for (i in 0 until arr.length()) {
            val entry = arr.optJSONObject(i) ?: continue
            if (!entry.optString("packageName", "").equals(pkg, ignoreCase = true)) continue

            val usedJs = blockPrefs.getString("daily_allowance_used", "{}") ?: "{}"
            val pkgUsed = try { org.json.JSONObject(usedJs).optJSONObject(pkg) }
                          catch (_: Exception) { null } ?: break // no record → not exhausted

            when (entry.optString("mode", "count")) {
                "count" -> {
                    val usedDate = pkgUsed.optString("date", "")
                    val count = if (usedDate == today) pkgUsed.optInt("count", 0) else 0
                    if (count >= entry.optInt("countPerDay", 1).coerceAtLeast(1))
                        return true
                }
                "time_budget" -> {
                    val usedDate = pkgUsed.optString("date", "")
                    val usedMs = if (usedDate == today) pkgUsed.optLong("usedMs", 0L) else 0L
                    val budgetMs = entry.optInt("budgetMinutes", 30).toLong() * 60_000L
                    if (usedMs >= budgetMs) return true
                }
                "interval" -> {
                    val wStart = pkgUsed.optLong("windowStartMs", 0L)
                    val wMs = entry.optInt("intervalHours", 1).toLong() * 3_600_000L
                    if (now2 <= wStart + wMs) {
                        val usedMs = pkgUsed.optLong("usedMs", 0L)
                        val iMs = entry.optInt("intervalMinutes", 5).toLong() * 60_000L
                        if (usedMs >= iMs) return true
                    }
                }
            }
            break
        }
    } catch (_: Exception) { }
}
```

Also update `isFallbackBlocked`'s signature and call site to pass `alwaysBlockActive`:
```kotlin
// Updated signature — no change needed if you read the flag directly inside
// (reading blockPrefs inside is fine since it's the same SharedPrefs object)
```

---

## PART 2 — IMPORTANT: Screen-off Overcounting (AppBlockerAccessibilityService.kt)

When the screen turns off without locking immediately (tablet, smart lock, delayed lock
settings), the 15-second checkpoint loop keeps accumulating budget against `currentTimedPkg`
even though the user is not using the app.

Add `ACTION_SCREEN_OFF` / `ACTION_USER_PRESENT` broadcast handling:

```kotlin
// Add field near other tracking vars (~line 483)
private var screenStateReceiver: BroadcastReceiver? = null

// In onServiceConnected(), after existing setup
screenStateReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SCREEN_OFF -> {
                val pkg = currentTimedPkg ?: return
                val entry = findAllowanceEntry(pkg) ?: return
                if (currentTimedOpenAtMs > 0L) {
                    accumulateTimedUsage(pkg, entry, currentTimedOpenAtMs)
                }
                currentTimedOpenAtMs = 0L                          // pause, keep pkg set
                timedExpireRunnable?.let { handler.removeCallbacks(it) }
                timedExpireRunnable = null
                handler.removeCallbacks(allowanceCheckpointRunnable)
            }
            Intent.ACTION_USER_PRESENT -> {
                val pkg = currentTimedPkg ?: return
                val entry = findAllowanceEntry(pkg) ?: return
                val now = System.currentTimeMillis()
                if (!isAllowanceAvailable(pkg, entry)) {
                    clearActiveSessionSignal()
                    currentTimedPkg = null; currentTimedOpenAtMs = 0L; currentTimedSessionEndMs = 0L
                    performGlobalAction(GLOBAL_ACTION_HOME); return
                }
                val pkgUsed = loadUsedObject().optJSONObject(pkg) ?: return
                val usedMs  = pkgUsed.optLong("usedMs", 0L)
                val remainingMs = when (entry.mode) {
                    "time_budget" -> (entry.budgetMs - usedMs).coerceAtLeast(0L)
                    "interval"    -> (entry.intervalMs - usedMs).coerceAtLeast(0L)
                    else          -> 0L
                }
                if (remainingMs <= 0L) {
                    clearActiveSessionSignal()
                    currentTimedPkg = null; currentTimedOpenAtMs = 0L; currentTimedSessionEndMs = 0L
                    performGlobalAction(GLOBAL_ACTION_HOME); return
                }
                currentTimedOpenAtMs = now
                currentTimedSessionEndMs = now + remainingMs
                persistActiveSessionSignal(pkg, now, currentTimedSessionEndMs)
                startAllowanceCheckpointLoop()
                scheduleTimedExpiry(pkg, currentTimedSessionEndMs)
            }
        }
    }
}.also {
    registerReceiver(it, IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_OFF)
        addAction(Intent.ACTION_USER_PRESENT)
    })
}

// In onDestroy / teardown
try { screenStateReceiver?.let { unregisterReceiver(it) } } catch (_: Exception) {}
screenStateReceiver = null
```

---

## PART 3 — IMPORTANT: UsageStats Stats Display Bugs (UsageStatsModule.kt)

### Fix A — Same-package RESUMED overwrites session start (Samsung undercount)

```kotlin
// Inside getUsageSummary event loop, foregroundType branch
// CURRENT — always overwrites
fgStartMs[pkg] = event.timeStamp

// FIXED — only set start if no session is already open for this package
if (!fgStartMs.containsKey(pkg)) {
    fgStartMs[pkg] = event.timeStamp
    if (pkg != lastFgPkg && event.timeStamp >= start) {
        launchCounts[pkg] = (launchCounts[pkg] ?: 0) + 1
    }
    lastFgPkg = pkg
}
lastUsedAt[pkg] = maxOf(lastUsedAt[pkg] ?: 0L, event.timeStamp)
```

### Fix B — System apps and blips in output

```kotlin
// In getUsageSummary output filter, before .map { }
.filter { (_, ms) -> ms >= 500L }              // remove sub-500ms blips
.filter { (pkg, _) ->
    try { packageManager.getLaunchIntentForPackage(pkg) != null }
    catch (_: Exception) { false }             // remove system/invisible packages
}
```

### Fix C — Reduce pre-query window

```kotlin
// 1-line change in getUsageSummary
val queryStart = start - 6L * 60 * 60 * 1000L  // was 24h, now 6h
```

### Fix D — Fix getForegroundApp (dead code, fix before it gets used)

Replace body of `getForegroundApp()` in `UsageStatsModule.kt` with the
`queryEvents` implementation — identical to the `getFallbackForegroundPackage`
fix in Part 1, Gap 1A above.

---

## PART 4 — MINOR: Greyout Overnight Crossing (AppBlockerAccessibilityService.kt)

Confirmed bug: greyout windows from e.g. `22:00–06:00` never activate because the
window check in the A11y service compares `startHour..endHour` without handling
the midnight wrap. Only the FTS fallback (`isFallbackBlocked`) already handles
it correctly with an `else` branch.

```kotlin
// Find the greyout window check in AppBlockerAccessibilityService (~line 2010 area)
// The check that reads startHour/startMin/endHour/endMin from the greyout JSON

// CURRENT (wrong for overnight)
val startMins = startHour * 60 + startMin
val endMins   = endHour * 60 + endMin
val inWindow  = nowMins in startMins until endMins  // fails when startMins > endMins

// FIXED (matches the correct logic already in isFallbackBlocked)
val startMins = startHour * 60 + startMin
val endMins   = endHour * 60 + endMin
val inWindow  = if (startMins <= endMins)
    nowMins in startMins until endMins
else
    nowMins >= startMins || nowMins < endMins   // overnight: matches Fri 22:00 AND Sat 05:00
```

Also add the weekday carry-over: an overnight window on day D applies `D` for the
before-midnight portion and `D-1` (previous day) for the after-midnight portion.
Adopt Flint's `previousWeekday(weekday)` helper for the `dayAllowed` check.

---

## PART 5 — WHERE USAGESTATS IS USED (complete map after all fixes)

| Call site | File | API used | Purpose | Primary or Fallback |
|-----------|------|----------|---------|---------------------|
| `getFallbackForegroundPackage` | FTS.kt | `queryEvents` (fixed) | Detect foreground app when A11y dead | **Fallback** |
| `syncAllowanceFromUsageStats` | FTS.kt | `queryUsageStats + totalTimeInForeground` | time_budget daily backup | **Fallback for A11y kill** |
| `reconcileCountAllowances` | A11y.kt | `queryEvents` from midnight | count mode catch-up on A11y reconnect | **Fallback/Catchup** |
| `isFallbackBlocked` allowance | FTS.kt | reads SharedPrefs (A11y writes) | enforce exhausted budgets without A11y | **Fallback** |
| `isFallbackBlocked` always-on | FTS.kt | reads SharedPrefs | enforce always-on without A11y | **Fallback** |
| `getUsageSummary` | UsageStatsModule.kt | `queryEvents` (6h window, fixed) | Stats screen: app usage display | **Primary** |
| `getForegroundApp` | UsageStatsModule.kt | `queryEvents` (fixed) | Exposed to JS, currently unused | **Unused/Standby** |
| `hasUsageAccess` | UsageStatsModule.kt | AppOps check | Permission gate | **Primary** |
| screen-off receiver (new) | A11y.kt | none (wall clock) | pause timed sessions when screen off | **Primary** |

---

## EXECUTION ORDER

Apply in this order — each group is independent but within a group order matters.

### Group 1 — Fallback enforcement (highest impact, apply first)
1. `getFallbackForegroundPackage` → `queryEvents` ← **do this first, others depend on it**
2. `fallbackPollRunnable` early-exit → add alwaysBlock + allowanceConfig
3. `isFallbackBlocked` → add always-on check
4. `isFallbackBlocked` → add daily allowance check

### Group 2 — Allowance accuracy
5. Screen-off broadcast receiver in A11y service

### Group 3 — Stats display
6. `getUsageSummary` same-package RESUMED fix
7. `getUsageSummary` system app + 500ms filter
8. `getUsageSummary` pre-query window 6h
9. `getForegroundApp` → `queryEvents`

### Group 4 — Schedule correctness
10. Greyout overnight window fix in A11y service

### Group 5 — Deferred (no urgency)
11. 30-second launch debounce in `getUsageSummary`
12. Hourly usage bucketing (Curbox pattern) — only when Stats screen adds the view
13. `reconcileCountAllowances` before-midnight probe — minor, count is only off by 1

---

## What is NOT Changing

- `syncAllowanceFromUsageStats` in FTS → correct as-is
- `isAllowanceAvailable` in A11y → correct as-is
- `recordAllowanceOpen` in A11y → correct as-is
- `accumulateTimedUsage` midnight handling → correct as-is
- `restoreAllowanceSession` → correct as-is
- `checkpointActiveTimedSession` + handoff via `PREF_USAGE_STATS_SYNC` → correct as-is
- `reconcileCountAllowances` Samsung dedup → already correct (`eventPkg != lastForegroundPackage`)
- `hasUsageAccess` Samsung MODE_DEFAULT fallback → already correct
- All permission-opening methods → correct as-is
