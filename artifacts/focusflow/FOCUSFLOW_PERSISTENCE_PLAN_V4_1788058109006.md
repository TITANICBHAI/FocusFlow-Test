# FocusFlow Persistence Plan — v4

**Source:** code audit of `FocusFlow1.zip` + real device logs (Aug 25–26 2026)
**Stack:** Expo SDK 54.0.27 · RN 0.81.5 · `newArchEnabled: false`
         expo-sqlite ~16.0.10 · AsyncStorage ^2.2.0

---

## What was cut from the previous plan and why

**DbStatus enum refactor — removed.**
The two booleans (`isDbReady` + `isDbUnrecoverable`) already exist and work.
Migrating 40+ references to a new enum prevents an impossible state that has
never actually manifested. The same correctness is achieved by just fixing
where the booleans get set. No refactor needed.

**Settings normalization (was Phase 3) — removed.**
`dbSaveSettings` is a single `INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)`
— one SQL statement. SQLite guarantees atomicity at the statement level.
A partial write of the JSON blob is literally impossible. The only failure
mode is DB unavailable, which Phase 1.3 already handles by throwing instead
of silently returning `DEFAULT_SETTINGS`. Phase 3 solved a problem that
doesn't exist after Phase 1.

**op-sqlite (was Phase 2) — replaced with JSI probe trick.**
10 lines inside the existing retry path. Same JSI reset effect, no library
swap, no Gradle changes, no adapter layer, no clean prebuild required.

**Selective commit() as a separate step — collapsed.**
It is implied by `publishFocusSnapshot` using `commit()`. Not a separate item.

---

## Document guide

| Document | Use it for |
|---|---|
| `PERSISTENCE_RELIABILITY_PLAN.md` | Phase 4 (Room) only — Gates 3–8 |
| `PERSISTENCE_RELIABILITY_PLAN_REVIEW.md` | Phase 4 only — checklist + no-half-cutover rule |
| `Help.txt` | Phase 3 reference — native Kotlin audit |

---

## What FocusFlow1 already did (do not redo)

- `isDbUnrecoverable: boolean` in AppState + `SET_DB_UNRECOVERABLE` action
- `isDbUnrecoverable()` and `isUsingRecoveryDb()` exported from `database.ts`
- `refreshInFlight` ref in `active.tsx` prevents concurrent refreshes
- DB guard in `active.tsx`: `if (!state.isDbReady || state.isDbUnrecoverable) return`
- `setFocusActive(true)` now fires after `setAllowedPackages` in `focusService.ts`
- `VpnPolicyCoordinator.kt` — VPN policy centralized, JSON safety fixed for VPN

---

## What is still broken (verified from code + logs)

| Problem | Evidence |
|---|---|
| Recovery DB opens as live database on transient JSI failure | Logs: `[DB_CORRUPTION_RECOVERY]` 3× in 24h on API 30 device |
| `runWithDbOr` returns `DEFAULT_SETTINGS` / `[]` on failure | Logs: `returning fallback after error` cascade after DB_UNRECOVERABLE |
| 12s watchdog forces `SET_DB_READY` even if DB never opened | AppContext lines 247–260: unchanged |
| `refreshTasks` catch only warns, no state change | AppContext line 1272: `logger.warn` only |
| Schedule screen shows empty list when DB unavailable | `active.tsx` returns early but renders nothing |
| JSON string interpolation in `SharedPrefsModule.kt` | 5 call sites for focus/allowed packages — unsafe |
| Multiple `apply()` calls for focus start/stop | `SharedPrefsModule.kt`: separate calls, no atomic boundary |

---

## Non-negotiables

1. `focusday.db` is never replaced by a newly created empty database as the live DB.
2. A DB read failure never silently returns `[]` or `DEFAULT_SETTINGS`.
3. A failed write is never treated as a successful command.
4. The app never dispatches `SET_DB_READY` unless the primary DB is genuinely open.
5. The schedule screen shows an explicit error when DB is unavailable — not "No tasks."
6. Native enforcement must not claim a rule is active if its state was not fully committed.

---

## Phase 1 — Persistence correctness

**Priority:** Do now.
**Time estimate:** 2–3 days.
**Files:** `src/data/database.ts`, `src/context/AppContext.tsx`, `app/(tabs)/index.tsx`

---

### 1.1 — Fix DB state transitions (no enum refactor)

The two booleans are fine. What is wrong is *where* they get set.
Three places currently dispatch `SET_DB_READY` when they should not:

**Watchdog** (`AppContext.tsx` lines 247–260):
```typescript
// old — fires SET_DB_READY after 12s regardless
dispatch({ type: 'SET_DB_READY' });
dispatch({ type: 'SET_LOADING', payload: false });

// new — fires SET_DB_UNRECOVERABLE after 20s
void logger.error('AppContext', '[WATCHDOG] DB still loading after 20s — marking unavailable');
dispatch({ type: 'SET_DB_UNRECOVERABLE', payload: true });
dispatch({ type: 'SET_LOADING', payload: false });
```

Change the timeout from 12,000 to 20,000.

**init() catch block** (`AppContext.tsx` lines 615–621):
```typescript
// old — dispatches SET_DB_READY on unhandled error
dispatch({ type: 'SET_DB_READY' });

// new
let recovered = DEFAULT_SETTINGS;
try {
  const backup = await readSetupBackups();
  recovered = {
    ...DEFAULT_SETTINGS,
    privacyAccepted: backup.privacyAccepted === true,
    onboardingComplete: backup.onboardingComplete === true,
    protectionMode: backup.protectionMode ?? DEFAULT_SETTINGS.protectionMode,
  };
} catch { /* keep defaults */ }
dispatch({ type: 'SET_SETTINGS', payload: recovered });
dispatch({ type: 'SET_DB_UNRECOVERABLE', payload: true });
```

**refreshTasks catch** (`AppContext.tsx` lines 1268–1276):
```typescript
// old — only warns, no state change
void logger.warn('AppContext', `refreshTasks failed: ${String(e)}`);

// new
void logger.error('AppContext', `refreshTasks failed: ${String(e)}`);
if (String(e).includes('DB unavailable')) {
  dispatch({ type: 'SET_DB_UNRECOVERABLE', payload: true });
}
// Do NOT dispatch SET_TASKS([]) — keep whatever is in state
```

---

### 1.2 — Kill the recovery DB fallback

**File:** `src/data/database.ts`

Add this helper near the module flags:

```typescript
function markUnrecoverable(reason: string, context: string): void {
  if (_dbUnrecoverable) return;
  _dbUnrecoverable = true;
  _usingRecoveryDb = false;
  void logger.error(
    'database',
    `[DB_UNAVAILABLE] reason=${reason} context=${context} api=${Platform.Version}`
  );
}
```

**JSI NPE fast-path** — replace the block that opens `RECOVERY_DB_NAME`:
```typescript
// REMOVE: _usingRecoveryDb = true + openAndInit(RECOVERY_DB_NAME)
// REPLACE WITH:
if (isJsiConstructorNpe(firstErr)) {
  markUnrecoverable('JSI_NPE', 'getDb_fast_path');
  return null;
}
```

**Standard retry exhausted** — replace the block that falls back to recovery DB:
```typescript
// REMOVE: _usingRecoveryDb = true + openAndInit(RECOVERY_DB_NAME)
// REPLACE WITH:
markUnrecoverable('OPEN_FAILED', 'getDb_retry');
return null;
```

Keep the cleanup line that deletes any old recovery DB from previous installs:
```typescript
void SQLite.deleteDatabaseAsync(RECOVERY_DB_NAME).catch(() => {});
```

---

### 1.3 — Fix runWithDbOr to stop masking failures

**File:** `src/data/database.ts`

Add a throwing variant for critical reads:

```typescript
async function runWithDb<T>(opName: string, op: DbOp<T>): Promise<T> {
  const database = await getDb();
  if (!database) throw new Error(`${opName}: DB unavailable`);
  try {
    return await op(database);
  } catch (e) {
    if (isDeadHandleError(e)) {
      resetDb();
      const db2 = await getDb();
      if (!db2) throw new Error(`${opName}: DB unavailable after reset`);
      return await op(db2);
    }
    throw e;
  }
}
```

Switch these from `runWithDbOr` to `runWithDb`:

| Function | Old fallback | Why it's dangerous |
|---|---|---|
| `dbGetSettings` | `DEFAULT_SETTINGS` | Silently wipes all user settings |
| `dbGetAllTasks` | `[]` | Shows empty task list |
| `dbGetTasksForDate` | `[]` | Shows empty schedule |
| `dbGetRecentUnresolvedTasks` | `[]` | Loses carryover tasks |
| `dbGetActiveFocusSession` | `null` | Loses active session |
| `dbGetStreak` | `0` | Wrong stats |
| `dbGetTodayFocusMinutes` | `0` | Wrong stats |

Keep `runWithDbOr` with safe fallbacks only for:
- `dbPruneOldData` — failure is safe to swallow
- `dbGetAllTimeFocusMinutes` / `dbGetAllTimeFocusSessions` — display only, not enforcement

---

### 1.4 — Add DB unavailable UI to the schedule screen

**File:** `app/(tabs)/index.tsx`

Add guards near the top of the screen component:

```typescript
const { state, init } = useAppContext();

if (!state.isDbReady && !state.isDbUnrecoverable) {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator />
      <Text>Opening your data…</Text>
    </View>
  );
}

if (state.isDbUnrecoverable) {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorTitle}>Couldn't reach your data</Text>
      <Text style={styles.errorBody}>
        Your tasks are safe. Tap retry to try again.
      </Text>
      <Pressable onPress={() => { resetDb(); void init(); }}>
        <Text>Retry</Text>
      </Pressable>
    </View>
  );
}
```

Style it however fits the existing design system. The logic is what matters.
`resetDb()` is already exported from `database.ts`.

---

### Phase 1 verification

- [ ] Force JSI NPE on API 30 device. Confirm: error screen, not empty list.
- [ ] Tap retry. Confirm: DB re-opens and tasks load correctly.
- [ ] Search logs for `[DB_CORRUPTION_RECOVERY]`. Must not appear.
- [ ] Search logs for `returning fallback after error` on `dbGetSettings` or `dbGetTasksForDate`. Must not appear.
- [ ] Force watchdog (block init for 20s in debug). Confirm: `SET_DB_UNRECOVERABLE` dispatched, not `SET_DB_READY`.
- [ ] API 31 device still has clean startup with zero regressions.

---

## Phase 2 — JSI probe-reset trick

**Priority:** High. After Phase 1 is verified stable.
**Time estimate:** 1 day + 2 weeks device testing.
**Files:** `src/data/database.ts` only. No library changes, no Gradle, no prebuild.

The root cause of the JSI NPE: expo-sqlite caches a C++ `NativeDatabase` object
per filename. After an OEM memory trim, the cached pointer is dead. Opening the
same filename hits the dead pointer. The recovery DB worked accidentally because
opening a *different* filename forces a fresh C++ object.

Exploit this correctly without substituting a fake database:

In `getDb()`, inside the JSI NPE handling block — after `markUnrecoverable` is
called and before returning null — add a probe attempt on the retry path:

```typescript
// Inside the retry function called after markUnrecoverable is set to false
// (i.e. when the user taps retry and resetDb() has been called):
export async function retryDb(): Promise<boolean> {
  resetDb(); // clears _dbUnrecoverable

  // Force a fresh C++ JSI object by opening a throwaway DB with a different name.
  // This breaks the dead cached pointer without using it as a live database.
  try {
    const probe = await SQLite.openDatabaseAsync('_jsi_probe.db');
    await probe.closeAsync();
    await SQLite.deleteDatabaseAsync('_jsi_probe.db').catch(() => {});
  } catch {
    // probe failure is fine — it just means JSI is still broken
  }

  // Now attempt the real DB — fresh C++ state should be in place
  const db = await getDb();
  return db !== null;
}
```

Wire `retryDb()` to the retry button instead of calling `resetDb(); void init()`:
```typescript
// In the unavailable UI (index.tsx):
<Pressable onPress={async () => {
  const recovered = await retryDb();
  if (recovered) void init();
}}>
```

Keep `isJsiConstructorNpe()` and `isDeadHandleError()` for 4 weeks after this
lands. If they never fire in logs, remove them. They log but no longer trigger
any fallback behavior.

**Gate:** Zero `[DB_UNAVAILABLE] reason=JSI_NPE` events on the API 30 device
after 2 weeks. If it still fires after the probe trick, then op-sqlite becomes
the next step — but try this first.

---

## Phase 3 — Native enforcement atomicity

**Priority:** Medium. Can run alongside or after Phase 2.
**Time estimate:** 1 week.
**Files:** `android-native/…/SharedPrefsModule.kt`, `src/native-modules/SharedPrefsModule.ts`, `src/services/focusService.ts`

VPN is already handled by `VpnPolicyCoordinator.kt`. Do not touch VPN.
Focus on focus session and standalone block only.

---

### 3.1 — Fix JSON string interpolation (do this first)

**File:** `android-native/…/SharedPrefsModule.kt`

The unsafe pattern at 5 call sites (focus/allowed packages):
```kotlin
val list = (0 until packages.size()).map { "\"${packages.getString(it)}\"" }
val json = "[${list.joinToString(",")}]"
```

A package name with `"` or `\` silently corrupts the enforcement list.

Add the extension once near the top of the file:
```kotlin
private fun ReadableArray.toJsonArrayString(): String {
    val arr = org.json.JSONArray()
    for (i in 0 until size()) arr.put(getString(i))
    return arr.toString()
}
```

Replace every unsafe construction:
```kotlin
val json = packages.toJsonArrayString()
```

After: `grep -n '"\\${' SharedPrefsModule.kt` must return zero results.

---

### 3.2 — publishFocusSnapshot and publishStandaloneSnapshot

**File:** `android-native/…/SharedPrefsModule.kt`

Replace the sequence of separate focus-state calls with one atomic method.
One `editor`, all fields, one `commit()`:

```kotlin
@ReactMethod
fun publishFocusSnapshot(
  active: Boolean,
  taskId: String?,
  taskName: String?,
  taskEndMs: Double,
  taskColor: String?,
  allowedPackages: ReadableArray?,
  nextTaskName: String?,
  pinHash: String?,
  promise: Promise
) {
  try {
    if (!active) {
      val storedHash = prefs().getString(SessionPinModule.PREF_PIN_HASH, null)
      if (!storedHash.isNullOrBlank()) {
        if (pinHash.isNullOrBlank() ||
            !storedHash.equals(pinHash.lowercase(), ignoreCase = true)) {
          promise.reject("PIN_REQUIRED", "Correct PIN required to end focus")
          return
        }
      }
    }

    val editor = prefs().edit()
    if (active && taskId != null) {
      editor
        .putBoolean("focus_active", true)
        .putString("task_id", taskId)
        .putString("task_name", taskName ?: "")
        .putLong("task_end_ms", taskEndMs.toLong())
        .putString("task_color", taskColor ?: "")
        .putString("allowed_packages", allowedPackages?.toJsonArrayString() ?: "[]")
        .putString("next_task_name", nextTaskName?.takeIf { it.isNotBlank() })
        .putLong("task_last_written_ms", System.currentTimeMillis())
    } else {
      editor
        .putBoolean("focus_active", false)
        .remove("task_id").remove("task_name").remove("task_end_ms")
        .remove("task_color").remove("allowed_packages").remove("next_task_name")
    }

    if (!editor.commit()) {
      android.util.Log.e("FocusFlow",
        "[NATIVE_PREFS_COMMIT_FAILED] publishFocusSnapshot: commit returned false")
      promise.reject("PREFS_WRITE_FAILED", "commit() returned false")
      return
    }

    android.util.Log.d("FocusFlow",
      "[NATIVE_PREFS_OK] publishFocusSnapshot active=${active}")
    FocusFlowWidget.pushWidgetUpdate(reactContext)
    promise.resolve(null)
  } catch (e: Exception) {
    promise.reject("PREFS_ERROR", e.message, e)
  }
}
```

Add `publishStandaloneSnapshot()` on the same pattern for:
`standalone_block_active`, `standalone_blocked_packages`, `standalone_block_until_ms`.

**File:** `src/native-modules/SharedPrefsModule.ts`
Expose both new methods.

**File:** `src/services/focusService.ts`
Replace the separate calls with `publishFocusSnapshot()`.
The ordering fix (allowed packages before active flag) is already done — the
atomic method makes ordering irrelevant since all fields commit together.

Non-critical SharedPrefs writes (widget appearance, launcher cosmetics, stats
display) stay on `apply()`. Only state-transition writes that must be atomic
get `commit()`.

**Gate:** Start focus, force-kill process, restart. Confirm: either fully active
with correct task + packages, or fully inactive. Never a partial state.

---

## Phase 4 — Room (long-term)

**Priority:** Architectural. After Phases 1–3 stable for 4+ weeks.
**Time estimate:** 2–4 months.

Use `PERSISTENCE_RELIABILITY_PLAN.md` Gates 3–8 and
`PERSISTENCE_RELIABILITY_PLAN_REVIEW.md` checklist directly.

Constraints:
- `newArchEnabled: false` — every Room query needs `@ReactMethod` / `Promise<>` bridge
- Room code must live in `android-native/` and register in the config plugin —
  not generated `android/` — or it gets deleted on `expo prebuild --clean`
- No half-cutover: one backend owns each domain at a time

---

## Note on tasks from previous days

Not a bug. `dbGetRecentUnresolvedTasks()` intentionally returns tasks from the
past 24 hours that are not completed or skipped. The DB query is correct.

Fix at UI layer only: tag tasks with `_source: 'today' | 'carryover'` in
`refreshTasks()` before dispatching, render carryover tasks in a separate
"From yesterday" section. No DB changes needed.

---

## File change index

| Phase | Files |
|---|---|
| 1 | `src/data/database.ts`, `src/context/AppContext.tsx`, `app/(tabs)/index.tsx` |
| 2 | `src/data/database.ts` only |
| 3 | `android-native/…/SharedPrefsModule.kt`, `src/native-modules/SharedPrefsModule.ts`, `src/services/focusService.ts` |
| 4 | Gradual — new Room entities, DAOs, bridge module |

**Do not touch in Phases 1–3:**
- `VpnPolicyCoordinator.kt` — already correct
- `NetworkBlockerVpnService.kt` — delegating to coordinator correctly
- `src/services/backupService.ts` — correct, add only a DB-status guard before export
- `src/services/setupPersistence.ts` — correct, leave it
- AsyncStorage usage in screens — UI hints only, working correctly, leave it
