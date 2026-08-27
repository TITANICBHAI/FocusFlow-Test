# FocusFlow Persistence Migration Plan

**Written from:** direct code audit of `focusflow.zip` (August 2026)
**Scope:** Android app only — `src/data/database.ts`, `src/context/AppContext.tsx`,
`src/native-modules/SharedPrefsModule.ts`, `android-native/…/SharedPrefsModule.kt`,
`src/services/setupPersistence.ts`, `src/services/backupService.ts`
**Architecture confirmed:** Expo SDK 54, React Native 0.81, `newArchEnabled: false`,
expo-sqlite ~16.0.10, AsyncStorage ^2.2.0

---

## How to use the existing documents

### `PERSISTENCE_RELIABILITY_PLAN.md` — USE, but only from Phase 5 onward

The long-term Room architecture, repository/command layer, and "non-negotiable
invariants" sections are correct and well-structured. The gated sequence in that
document (Gate 0 → Gate 8) maps to Phase 5 of this plan. Do not use it as your
immediate action guide — it starts with Room from the beginning, skipping fixes
that you can ship in days rather than months.

### `PERSISTENCE_RELIABILITY_PLAN_REVIEW.md` — USE the checklist and gate rules

The "nothing remains behind" checklist (Section 5) and the "no half-cutover"
rule (Finding 2) are genuinely important. Import those directly into your
Phase 5 work. The "revised safest implementation sequence" (Section 4) aligns
with what this plan calls Phase 5.

### `Help.txt` (the native Kotlin audit) — USE as a reference throughout

The findings are accurate: JSON-by-string-interpolation in Kotlin, `apply()`
everywhere, allowance read-modify-write race, duplicate key inconsistencies.
Cross-check this document against every Kotlin change you make in Phase 4.

### `Help2.txt` (ChatGPT analysis) — DO NOT USE as implementation guidance

The architectural direction (Room = right long-term destination) is correct.
But "just go to Room" is the wrong starting point for a React Native Expo app
with `newArchEnabled: false`. Treat it as a sanity check after you have finished
this plan, not as instructions. The rating tables are also useful for tracking
progress.

---

## Root cause summary (what was actually found in the code)

Two root causes. Everything else is a consequence.

**Root cause A — The recovery DB fallback activates on transient failures**
`database.ts` lines 183–275: after two failed open attempts, the code opens
`focusday_recovery.db` — a fresh empty file — and returns it as if it were the
user's database. No repair, no import, no error shown to the user. Transient
failures (dead JSI handle, startup race, temporary lock) trigger this path,
not just genuine corruption. Subsequent writes go to the empty recovery DB
while the primary is still intact. The next app open re-initializes and opens
the primary, making data "magically return." This is the direct cause of the
most reported symptom.

**Root cause B — expo-sqlite JSI layer instability on OEM Android**
Samsung One UI and other aggressive OEMs trim the native C++ `NativeDatabase`
object that expo-sqlite caches per filename. The JS object handle remains
non-null but every call throws `NullPointerException at construct (native)`.
The code correctly detects this (`isJsiConstructorNpe()`) but responds by
jumping directly to the recovery DB fallback — which triggers Root cause A.

Everything else — empty task lists, wiped settings, broken enforcement state,
inconsistent stats — flows from these two.

---

## Non-negotiables

These must be true after every phase. Do not ship a phase that breaks any of them.

1. A DB read failure is never silently converted to an empty array or default settings.
2. The primary database (`focusday.db`) is never replaced by a newly created empty database.
3. A failed write is not treated as a successful command.
4. The app must never simultaneously treat two databases as canonical.
5. The schedule screen must never show "No tasks scheduled" when the actual state is "DB unavailable."
6. Native blocking must not claim a rule is active if its required state was not written successfully.

---

## Phase 0 — Baseline inventory (before any code changes)

**Time estimate:** 2–4 hours. No code changes.

Run the following and save the output before touching anything else.

```bash
# Schema dump
sqlite3 /path/to/focusday.db ".schema"
sqlite3 /path/to/focusday.db "PRAGMA user_version"
sqlite3 /path/to/focusday.db "SELECT * FROM settings WHERE key = 'app_settings'" | python3 -c "import sys,json; d=json.load(sys.stdin)[0][1]; print(list(json.loads(d).keys()))"

# Row counts
sqlite3 /path/to/focusday.db "SELECT 'tasks', COUNT(*) FROM tasks UNION ALL SELECT 'focus_sessions', COUNT(*) FROM focus_sessions UNION ALL SELECT 'focus_overrides', COUNT(*) FROM focus_overrides UNION ALL SELECT 'daily_completions', COUNT(*) FROM daily_completions"
```

Record: all column names in `tasks`, all keys in the `app_settings` JSON blob,
all SharedPreferences keys currently written by any Kotlin component (grep for
`putString\|putBoolean\|putLong\|putInt` in `android-native/`), and all
AsyncStorage keys (`grep -r "AsyncStorage\." src/ --include="*.ts"  | grep -E "setItem|getItem"`).

This is your rollback reference. If anything gets worse, you compare against this.

---

## Phase 1 — Kill the recovery DB fallback + fix startup state machine

**Time estimate:** 2–3 days.
**Files changed:** `src/data/database.ts`, `src/context/AppContext.tsx`,
`app/_layout.tsx`, `app/(tabs)/index.tsx`

**Gate criteria:** after this phase, if the DB fails to open, the user sees
an explicit error screen with a retry button — never a fake empty task list.

### 1.1 — Add DB availability state to AppContext

**File:** `src/context/AppContext.tsx`

Replace the single `isDbReady: boolean` field with a proper status enum.

Current `AppState` (line ~82):
```ts
interface AppState {
  // ...
  isDbReady: boolean;
}
```

Replace with:
```ts
type DbStatus = 'loading' | 'ready' | 'unavailable';

interface AppState {
  // ...
  dbStatus: DbStatus;
}
```

Current actions (line ~88):
```ts
| { type: 'SET_DB_READY' }
```

Replace with:
```ts
| { type: 'SET_DB_STATUS'; payload: DbStatus }
```

Current reducer cases (line ~100):
```ts
case 'SET_DB_READY':
  return { ...state, isDbReady: true };
```

Replace with:
```ts
case 'SET_DB_STATUS':
  return { ...state, dbStatus: action.payload };
```

Current initial state (line ~132):
```ts
isDbReady: false,
```

Replace with:
```ts
dbStatus: 'loading' as DbStatus,
```

Update every caller of `state.isDbReady`:
- Change `state.isDbReady` → `state.dbStatus === 'ready'`
- Change every `dispatch({ type: 'SET_DB_READY' })` → `dispatch({ type: 'SET_DB_STATUS', payload: 'ready' })`

### 1.2 — Remove the 12-second watchdog that forces ready

**File:** `src/context/AppContext.tsx`, lines 218–241

The current watchdog forces `SET_DB_READY` after 12 seconds even if the DB never
opened. This is what causes the app to show a fake empty state after a failed
startup.

Delete the entire watchdog effect. Replace it with:
```ts
// If DB never becomes ready after 20 seconds, surface unavailable — never fake ready.
useEffect(() => {
  const watchdog = setTimeout(() => {
    if (stateRef.current.dbStatus === 'loading') {
      void logger.error('AppContext', '[WATCHDOG] DB still loading after 20s — marking unavailable');
      dispatch({ type: 'SET_DB_STATUS', payload: 'unavailable' });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, 20_000);
  return () => clearTimeout(watchdog);
}, []);
```

20 seconds instead of 12 because `unavailable` is the right fallback now — a slow
device should still have a chance to open the DB before hitting the wall.

### 1.3 — Fix the error path in init() to dispatch 'unavailable' not 'ready'

**File:** `src/context/AppContext.tsx`, lines ~565–583 (the `catch` block in `init()`)

Current:
```ts
} catch (e) {
  // ...
  dispatch({ type: 'SET_DB_READY' });
} finally {
  dispatch({ type: 'SET_LOADING', payload: false });
}
```

Replace:
```ts
} catch (e) {
  void logger.error('AppContext', `[STARTUP_ERROR] Unhandled init error: ${String(e)}`);
  // Restore critical first-run state from backups, but do NOT mark DB ready.
  let recoveredSettings = DEFAULT_SETTINGS;
  try {
    const backup = await readSetupBackups();
    recoveredSettings = {
      ...DEFAULT_SETTINGS,
      privacyAccepted: backup.privacyAccepted === true,
      onboardingComplete: backup.onboardingComplete === true,
      protectionMode: backup.protectionMode ?? DEFAULT_SETTINGS.protectionMode,
    };
  } catch { /* keep safe defaults */ }
  dispatch({ type: 'SET_SETTINGS', payload: recoveredSettings });
  dispatch({ type: 'SET_DB_STATUS', payload: 'unavailable' });
} finally {
  dispatch({ type: 'SET_LOADING', payload: false });
}
```

### 1.4 — Kill the recovery DB path in database.ts

**File:** `src/data/database.ts`

This is the most important change. The recovery DB fallback must be removed.
It is not recovery — it is data loss.

Current JSI NPE fast-path (lines ~230–248):
```ts
if (isJsiConstructorNpe(firstErr)) {
  // ...
  try {
    db = await openAndInit(RECOVERY_DB_NAME);  // ← this line must be removed
    void logger.error('database', `[DB_CORRUPTION_RECOVERY] ...`);
    return db;
  } catch (recoveryErr) {
    _dbUnrecoverable = true;
    return null;
  }
}
```

Replace:
```ts
if (isJsiConstructorNpe(firstErr)) {
  void logger.error('database', `[DB_JSI_NPE] JSI constructor NPE on primary — marking unrecoverable. User must retry.`);
  _dbUnrecoverable = true;
  return null;  // Caller gets null, surfaces unavailable state.
}
```

Current standard retry path (lines ~255–275), the block that opens `RECOVERY_DB_NAME`:
```ts
try {
  db = await openAndInit(RECOVERY_DB_NAME);  // ← remove this entire try block
  void logger.error('database', `[DB_CORRUPTION_RECOVERY] ...`);
  return db;
} catch (recoveryErr) {
  _dbUnrecoverable = true;
  return null;
}
```

Replace:
```ts
// Do not fall back to an empty recovery DB.
// A real failure must surface as unavailable, not as fake empty data.
void logger.error('database', `[DB_OPEN_FAILED] Both open attempts failed. Marking unrecoverable.`);
_dbUnrecoverable = true;
return null;
```

Keep `RECOVERY_DB_NAME` as a constant only for the existing cleanup line:
```ts
void SQLite.deleteDatabaseAsync(RECOVERY_DB_NAME).catch(() => {}); // still clean up any old recovery DB
```

### 1.5 — Fix refreshTasks to not silently replace valid state with []

**File:** `src/context/AppContext.tsx`, lines 1204–1220

Current:
```ts
const refreshTasks = useCallback(async () => {
  try {
    const todayTasks = await dbGetTasksForDate(new Date().toISOString());
    const recentUnresolved = await dbGetRecentUnresolvedTasks();
    const merged = [...todayTasks, ...recentUnresolved.filter(...)];
    dispatch({ type: 'SET_TASKS', payload: merged });
  } catch (e) {
    void logger.warn('AppContext', `refreshTasks failed: ${String(e)}`);
    // silently does nothing — leaves stale or empty list in place
  }
}, []);
```

Replace:
```ts
const refreshTasks = useCallback(async () => {
  try {
    const todayTasks = await dbGetTasksForDate(new Date().toISOString());
    const recentUnresolved = await dbGetRecentUnresolvedTasks();
    const todayIds = new Set(todayTasks.map((t) => t.id));
    const merged = [...todayTasks, ...recentUnresolved.filter((t) => !todayIds.has(t.id))];
    // Only dispatch if both reads succeeded (both return [] on failure via runWithDbOr).
    // A better check: if the DB is marked available and we got [], that is genuinely empty.
    // If the DB is unavailable, do not overwrite a valid cached list.
    if (stateRef.current.dbStatus === 'ready') {
      dispatch({ type: 'SET_TASKS', payload: merged });
    }
  } catch (e) {
    void logger.warn('AppContext', `refreshTasks failed: ${String(e)}`);
    // Do NOT dispatch [] — keep whatever is currently in state.
  }
}, []);
```

Note: this partial fix relies on `runWithDbOr` still returning `[]` on failure.
Phase 3 will address this more cleanly via a typed result type.

### 1.6 — Add DB unavailable UI to the schedule screen

**File:** `app/(tabs)/index.tsx`

Add a check near the top of the screen component. The schedule screen currently
has no `isDbReady` gate (confirmed in audit):

```tsx
// Near the top of the schedule screen component:
const { state } = useAppContext();

if (state.dbStatus === 'loading') {
  return <LoadingView message="Opening your data…" />;
}

if (state.dbStatus === 'unavailable') {
  return (
    <DbUnavailableView
      onRetry={() => {
        // resetDb() and re-run init
        resetDb();
        void init(); // or however you trigger re-initialization
      }}
    />
  );
}
```

`DbUnavailableView` should show: "Couldn't reach your data" + a Retry button
+ a link to export/import backup. Never show "No tasks scheduled" when the real
state is "we don't know."

### Phase 1 verification

After implementing:
1. Force a DB failure (disconnect the app in background, then foreground on Samsung). You should see the unavailable screen, not an empty task list.
2. Tap retry. The app should attempt to re-open and succeed.
3. Check logs for `[DB_JSI_NPE]` or `[DB_OPEN_FAILED]` — these should replace any `[DB_CORRUPTION_RECOVERY]` entries.
4. Confirm `focusday_recovery.db` is never created as a live data store (it should be deleted if it exists from a previous version).

---

## Phase 2 — Switch expo-sqlite to op-sqlite

**Time estimate:** 1–2 weeks (mostly testing on real devices).
**Files changed:** `src/data/database.ts`, `package.json`,
`android-native/install.sh` or the config plugin.

**Why:** expo-sqlite's JSI layer has the Samsung One UI NativeDatabase NPE problem. `@op-engineering/op-sqlite` is a drop-in SQLite binding for React Native with a more stable JSI implementation that does not have this bug. It is specifically designed for React Native 0.71+, has been tested on Samsung/Xiaomi/MIUI, and uses SQLiteVFS properly.

**Gate criteria:** zero `[DB_JSI_NPE]` events in logs after 2 weeks of real-device usage on Samsung/OEM Android.

### 2.1 — Install op-sqlite

```bash
pnpm remove expo-sqlite
pnpm add @op-engineering/op-sqlite
```

You will also need to add the Gradle dependency. Because your project copies Kotlin
sources via `android-native/install.sh` and the config plugin, check whether
`expo-sqlite`'s Gradle dependency is listed there or in `plugins/withFocusDayAndroid.js`.
If it is, remove it there too and verify after a clean Expo prebuild.

### 2.2 — Update database.ts import and API

The op-sqlite API is similar but not identical to expo-sqlite's async API.

Current (expo-sqlite):
```ts
import * as SQLite from 'expo-sqlite';
// ...
const opened = await SQLite.openDatabaseAsync(name);
await opened.runAsync(sql, params);
const rows = await opened.getAllAsync<T>(sql, params);
const row = await opened.getFirstAsync<T>(sql, params);
await opened.withTransactionAsync(async () => { ... });
await opened.execAsync(sql);
```

op-sqlite equivalent:
```ts
import { open } from '@op-engineering/op-sqlite';
// openDatabaseAsync is synchronous in op-sqlite:
const opened = open({ name });
// runAsync → execute (returns void)
opened.execute(sql, params);
// getAllAsync → query (returns { rows: { _array: T[] } })
const result = opened.query<T>(sql, params);
const rows = result.rows._array;
// getFirstAsync → query, take first
const first = result.rows._array[0] ?? null;
// withTransactionAsync → transaction
opened.transaction((tx) => { tx.execute(sql, params); });
// execAsync → execute
opened.execute(sql);
```

op-sqlite's `execute` and `query` are synchronous on the JS side (they run on
a background thread internally), so the `async/await` around them can be removed.
The write queue (`_writeTail`, `runSerializedWrite`) can be simplified but keep
it for now — it protects against concurrent mutation from multiple async callers
even if the underlying DB calls are synchronous.

Create a thin adapter in `src/data/database.ts` so the rest of the codebase does
not need to change:

```ts
// Adapter: wraps op-sqlite in an async-compatible interface matching the rest of database.ts
function opSqliteAdapter(db: OPSQLiteConnection): SQLiteCompatAdapter {
  return {
    async runAsync(sql: string, params?: unknown[]): Promise<void> {
      db.execute(sql, params);
    },
    async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return db.query<T>(sql, params).rows._array;
    },
    async getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null> {
      return db.query<T>(sql, params).rows._array[0] ?? null;
    },
    async withTransactionAsync(cb: () => Promise<void>): Promise<void> {
      await db.transaction(async (tx) => { await cb(); });
    },
    async execAsync(sql: string): Promise<void> {
      db.execute(sql);
    },
  };
}
```

### 2.3 — Remove the JSI NPE detection code

Once op-sqlite is in place, `isJsiConstructorNpe()` and `isDeadHandleError()`
should not trigger anymore. Keep them in place for the first month of production
use to verify this in logs, then remove them once you have confirmed zero
occurrences.

### 2.4 — Update the config plugin and install.sh

**File:** `plugins/withFocusDayAndroid.js` and `android-native/install.sh`

Search for any Gradle dependency on `expo-sqlite` and replace with the
`@op-engineering/op-sqlite` native dependency. Run a clean Expo prebuild
and confirm the generated `android/` directory compiles without errors.

The review document (`PERSISTENCE_RELIABILITY_PLAN_REVIEW.md`, Finding 7)
correctly identifies this as a required gate: green tests against a manually
edited `android/` are not sufficient. The clean prebuild must also work.

### Phase 2 verification

1. Run on a physical Samsung device for one week minimum.
2. Check startup logs for any occurrence of `NullPointerException at construct (native)`.
3. Background the app, wait 5 minutes, foreground. Confirm tasks load correctly.
4. Confirm `focusday.db` grows in size as expected (WAL checkpointing still works).

---

## Phase 3 — Normalize settings and add schema versioning

**Time estimate:** 1–2 weeks.
**Files changed:** `src/data/database.ts`, `src/data/types.ts`, `src/data/defaultSettings.ts`.

**Why:** the current `app_settings` row is a single JSON blob. Any parse failure
returns `DEFAULT_SETTINGS` silently. A malformed field wipes everything. There is
no schema version, so future migrations cannot be verified.

**Gate criteria:** a corrupt or missing `app_settings` row must produce an explicit
error/partial-restore state, not DEFAULT_SETTINGS.

### 3.1 — Add a schema version table

At the top of `initSchema()` in `database.ts`, before any `CREATE TABLE`:

```ts
// Schema version table — single row, updated on each migration.
await db.runAsync(`
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL,
    migrated_at TEXT NOT NULL
  )
`);

// Read current version.
const versionRow = await db.getFirstAsync<{ version: number }>(
  'SELECT version FROM schema_version WHERE id = 1'
);
const currentVersion = versionRow?.version ?? 0;
const TARGET_VERSION = 2; // bump this whenever you add a migration below
```

Then run migrations inside `withTransactionAsync`:

```ts
if (currentVersion < 1) {
  // Original schema — all existing tables
  // CREATE TABLE tasks, settings, focus_sessions, etc.
  // These are idempotent IF NOT EXISTS so safe to run on existing databases
}

if (currentVersion < 2) {
  // Phase 3: split app_settings into domain tables
  await db.runAsync('... your new tables ...');
  await db.runAsync(
    'INSERT OR REPLACE INTO schema_version (id, version, migrated_at) VALUES (1, 2, ?)',
    [new Date().toISOString()]
  );
}
```

### 3.2 — Split AppSettings into domain-specific rows

Instead of one `app_settings` JSON blob, break the settings table into
domain-specific rows. The existing `settings` table structure (key + value)
already supports this — just use separate keys.

Proposed split (maps to the natural domains in `AppSettings`):

| Row key | Contents |
|---|---|
| `settings_core` | `darkMode`, `defaultDuration`, `defaultReminderOffsets`, `notificationsEnabled`, `beginnerMode`, `tipsCard*` |
| `settings_focus` | `focusModeEnabled`, `allowedInFocus`, `allowedAppPresets`, `pomodoroEnabled`, `pomodoroBreak`, `pomodoroDuration`, `keepFocusActiveUntilTaskEnd` |
| `settings_blocking` | `standaloneBlockPackages`, `standaloneBlockUntil`, `alwaysOnPackages`, `alwaysOnEnforcementEnabled`, `autoCopyToAlwaysOn`, `autoCopiedAlwaysOnPackages`, `dailyAllowanceEntries`, `blockedWords`, `recurringBlockSchedules`, `greyoutSchedule` |
| `settings_defense` | `blockPresets`, `systemGuardEnabled`, `blockInstallActionsEnabled`, `blockYoutubeShortsEnabled`, `blockInstagramReelsEnabled`, `pinProtectionEnabled`, `protectionMode`, `aversionDimmerEnabled`, `aversionVibrateEnabled`, `aversionSoundEnabled` |
| `settings_vpn` | `vpnBlockEnabled`, `standaloneVpnPackages`, `alwaysOnVpnPackages`, `vpnSelfHealEnabled` |
| `settings_launcher` | `launcherEnabled`, `launcherHiddenPackages`, `launcherPinnedPackages`, `launcherDockPackages`, `launcherWallpaperUri`, `launcherClockStyle`, `launcherBlockUninstall`, `launcherLockDuringStandalone` |
| `settings_appearance` | `overlayWallpaper`, `overlayQuotes` |
| `settings_profile` | `userProfile`, `weeklyReportEnabled` |
| `settings_gamification` | `lastShownStreakMilestone`, `pendingAchievementCelebration` |
| `settings_setup` | `privacyAccepted`, `onboardingComplete` |

Each row is still JSON internally, but a malformed `settings_launcher` row no
longer wipes your blocking config. Parse failures per row return a domain-specific
default, not `DEFAULT_SETTINGS` for everything.

Write a migration that reads the old `app_settings` row, splits it into domain
rows, and then deletes `app_settings`:

```ts
if (currentVersion < 2) {
  await db.withTransactionAsync(async () => {
    const oldRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'app_settings'"
    );
    if (oldRow) {
      let old: Partial<AppSettings> = {};
      try { old = JSON.parse(oldRow.value); } catch { /* use empty, domains fill in defaults */ }
      // Write domain rows
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_core', ?)",
        [JSON.stringify(extractCore(old))]);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_focus', ?)",
        [JSON.stringify(extractFocus(old))]);
      // ... etc for each domain ...
      await db.runAsync("DELETE FROM settings WHERE key = 'app_settings'");
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO schema_version (id, version, migrated_at) VALUES (1, 2, ?)",
      [new Date().toISOString()]
    );
  });
}
```

### 3.3 — Update dbGetSettings / dbSaveSettings

Read all domain rows in parallel, merge with domain defaults, return the merged
`AppSettings`. If one domain row fails to parse, log it and use that domain's
defaults — do not return `DEFAULT_SETTINGS` for the whole object.

```ts
export async function dbGetSettings(): Promise<{ settings: AppSettings; domainErrors: string[] }> {
  return runWithDb('dbGetSettings', async (db) => {
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key LIKE 'settings_%'"
    );
    const domainErrors: string[] = [];
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    
    const parseDomain = <T>(key: string, defaults: T): T => {
      if (!byKey[key]) return defaults;
      try { return { ...defaults, ...JSON.parse(byKey[key]) }; }
      catch { domainErrors.push(key); return defaults; }
    };
    
    return {
      settings: {
        ...parseDomain('settings_core', DEFAULT_CORE),
        ...parseDomain('settings_focus', DEFAULT_FOCUS),
        // ... etc
      },
      domainErrors,
    };
  });
}
```

If `domainErrors` is non-empty, dispatch a warning banner in the UI — not a silent
fallback.

### Phase 3 verification

1. Manually corrupt one domain row in the DB (`sqlite3 focusday.db "UPDATE settings SET value='bad' WHERE key='settings_launcher'"`).
2. Restart the app. Confirm: launcher settings reset to defaults, all other settings intact, a warning banner visible.
3. Confirm the migration ran exactly once (check `schema_version` table).
4. Export a backup, import it on a fresh install, verify all settings restored correctly.

---

## Phase 4 — Atomic native snapshot (Kotlin)

**Time estimate:** 1–2 weeks.
**Files changed:** `android-native/…/SharedPrefsModule.kt` and all native Kotlin
components that write to `focusday_prefs`.

**Why:** starting focus mode currently makes 4+ separate `SharedPreferences.Editor.apply()`
calls. A crash or OEM process kill between them leaves permanently inconsistent
enforcement state. Also: JSON arrays are built by string interpolation in Kotlin,
meaning a package name containing `"` or `\` produces invalid JSON.

**Gate criteria:** starting and stopping focus mode must be atomic. A process kill
at any point during focus start must leave the system in a consistent state
(either fully active or fully inactive — never partial).

### 4.1 — Fix the JSON string interpolation bug immediately

**File:** `android-native/…/SharedPrefsModule.kt`

Current (every method that builds package lists):
```kotlin
val list = (0 until packages.size()).map { "\"${packages.getString(it)}\"" }
val json = "[${list.joinToString(",")}]"
```

Replace with a proper encoder. Add `org.json:json` (or use Kotlin's built-in
`kotlinx.serialization`) and build JSON properly:

```kotlin
import org.json.JSONArray

fun ReadableArray.toJsonArray(): JSONArray {
  val arr = JSONArray()
  for (i in 0 until size()) arr.put(getString(i))
  return arr
}

// Then in each method:
val json = packages.toJsonArray().toString()
```

Do this in every affected method before anything else. This is a real bug that
can corrupt `allowed_packages` silently and is completely independent of the
larger architecture work.

### 4.2 — Switch critical writes from apply() to commit()

Identify which writes are "critical" (focus enforcement state changes) vs
"non-critical" (widget appearance, launcher colors):

**Critical — use commit():**
- `focus_active` and associated focus state
- `standalone_block_active`, `standalone_blocked_packages`, `standalone_block_until_ms`
- `always_block_active`, `always_block_packages`
- `allowed_packages`
- `daily_allowance_config`

**Non-critical — apply() is fine:**
- `task_color`, `task_start_ms` (widget display)
- `launcher_clock_style` (appearance)
- `daily_stats_*` (widget counters)

`commit()` blocks briefly but guarantees durability before the caller proceeds.
For focus-critical state transitions, that brief block is worth it.

### 4.3 — Publish focus state as a single atomic snapshot

Instead of calling `setFocusActive()`, `setActiveTask()`, `setAllowedPackages()`
as separate bridge calls from JS, add a single Kotlin method that writes all
focus-start fields in one editor transaction:

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
  if (!active) {
    // PIN check here (same as setFocusActive)
    val storedHash = prefs().getString(SessionPinModule.PREF_PIN_HASH, null)
    if (!storedHash.isNullOrBlank()) {
      if (pinHash.isNullOrBlank() || !storedHash.equals(pinHash?.lowercase(), ignoreCase = true)) {
        promise.reject("PIN_REQUIRED", "Correct PIN hash required to end focus session")
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
      .putString("allowed_packages", allowedPackages?.toJsonArray()?.toString() ?: "[]")
      .putString("next_task_name", nextTaskName?.takeIf { it.isNotBlank() })
      .putLong("task_last_written_ms", System.currentTimeMillis())
  } else {
    editor
      .putBoolean("focus_active", false)
      .remove("task_id")
      .remove("task_name")
      .remove("task_end_ms")
      .remove("task_color")
      .remove("allowed_packages")
      .remove("next_task_name")
  }
  
  val committed = editor.commit() // not apply()
  if (!committed) {
    promise.reject("PREFS_WRITE_FAILED", "SharedPreferences commit failed")
    return
  }
  
  FocusFlowWidget.pushWidgetUpdate(reactContext)
  promise.resolve(null)
}
```

Update `src/native-modules/SharedPrefsModule.ts` to expose
`publishFocusSnapshot` and update `src/services/focusService.ts` to call it
instead of the 4 separate calls.

### 4.4 — Same treatment for standalone block

Do the same for standalone block: replace the separate
`standalone_block_active`, `standalone_blocked_packages`, and
`standalone_block_until_ms` writes with a single
`publishStandaloneSnapshot()` method that commits atomically.

### Phase 4 verification

1. Start a focus session. Immediately force-kill the process (via developer options).
   Restart. Confirm: either focus is active with correct task/packages, or focus
   is fully inactive. Never a half-state.
2. Test with a package name containing a quote character (e.g. `com.test."evil`).
   Confirm the JSON written to SharedPrefs is valid (parse it with `org.json.JSONArray`).
3. Check that `commit()` returns `true` on normal writes. Log a warning if it
   returns `false`.

---

## Phase 5 — Room migration (long-term, when ready)

**Time estimate:** 2–4 months.
**Prerequisite:** Phases 0–4 complete and stable in production for at least 4 weeks.

At this point:
- op-sqlite has eliminated the JSI NPE problem
- The recovery DB fallback is gone
- Settings are normalized across domain rows
- Native enforcement writes are atomic

The case for Room at this point is architectural, not emergency. You are already
migrating the Android app to pure Kotlin/Compose (per your notes). Room is the
right database for that future app. This phase bridges the gap.

**For Phase 5, use these existing documents as your primary references:**
- `PERSISTENCE_RELIABILITY_PLAN.md` — follow its Gates 3–8 (repository contract,
  Room introduction, migration fixtures, controlled read comparison, cutover, cleanup)
- `PERSISTENCE_RELIABILITY_PLAN_REVIEW.md` — follow the "nothing remains behind"
  checklist verbatim and Finding 4 (outbox model for unfinished side effects)

**Key constraints for Phase 5 specific to your project setup:**

The config plugin (`plugins/withFocusDayAndroid.js`) and
`android-native/install.sh` are your durable source for Kotlin changes. Room
entities, DAOs, the database class, and Gradle dependencies must be added to
`android-native/` and the plugin — not to generated `android/` output. Verify
with a clean Expo prebuild after every change.

`newArchEnabled: false` means the React Native bridge still uses the old
architecture. Room calls from JS go through `ReactMethod` / `Promise` in Kotlin,
same as current modules. This is manageable but means every new repository method
needs a bridge method. Build the repository interface behind a bridge module
(`FocusFlowRepositoryModule.kt`) and add methods there, not scattered across
existing modules.

The "no half-cutover" rule from the PLAN_REVIEW is critical: during migration,
one backend owns each domain. A mode switch (`LEGACY_ONLY` → `ROOM_ONLY`) is
controlled by a migration coordinator, not by individual screens.

---

## Appendix A — Files to change by phase

| Phase | JS/TS files | Kotlin files |
|-------|-------------|--------------|
| 1 | `src/data/database.ts`, `src/context/AppContext.tsx`, `app/_layout.tsx`, `app/(tabs)/index.tsx` | none |
| 2 | `src/data/database.ts`, `package.json` | `android-native/install.sh` or config plugin (Gradle deps only) |
| 3 | `src/data/database.ts`, `src/data/types.ts`, `src/data/defaultSettings.ts` | none |
| 4 | `src/native-modules/SharedPrefsModule.ts`, `src/services/focusService.ts` | `android-native/…/SharedPrefsModule.kt` |
| 5 | Most of `src/` gradually | New: `FocusFlowRepository.kt`, `RoomDatabase.kt`, entity/DAO files |

---

## Appendix B — Do not do these

- Do not delete `focusday.db` or the WAL files manually. The current data is good.
- Do not run Phases 2 and 3 simultaneously. Do Phase 2 (op-sqlite) first, confirm
  it is stable, then do Phase 3 (schema normalization).
- Do not add Room before Phase 5. Adding it earlier without the repository contract
  creates the "some callers use Room, some use Expo SQLite" state that the
  PLAN_REVIEW explicitly identifies as the most dangerous migration state.
- Do not re-introduce a recovery DB fallback under any other name.
- Do not use `DEFAULT_SETTINGS` as the return value for a failed settings read
  after Phase 3. Fail explicitly.
- Do not ship a backup/export while the DB is in `unavailable` state. The current
  `backupService.ts` catches `dbGetAllTasks()` failure and returns `[]` — add a
  guard that throws if the DB is not ready.

---

## Appendix C — Quick reference: what each file currently owns

| File | What it stores | Problem |
|------|---------------|---------|
| `src/data/database.ts` | Tasks, settings (one JSON blob), focus sessions, overrides, streaks | Recovery DB fallback; no schema version; settings JSON blob; INSERT OR IGNORE without affected-row check |
| `src/context/AppContext.tsx` | In-memory UI cache; orchestrates all DB writes | Watchdog forces ready; refreshTasks silently empties on failure; settings writes non-fatal |
| `src/services/setupPersistence.ts` | Mirrors 3 critical keys to AsyncStorage + SharedPrefs | Redundant with SharedPrefs; correct as a backup mechanism |
| `src/services/backupService.ts` | Export/import as `.focusflow` JSON | Exports `[]` if DB unavailable; import not transactional |
| `src/native-modules/SharedPrefsModule.ts` | JS bridge to native SharedPrefs | Silent no-ops on missing methods; no confirmation that writes landed |
| `android-native/…/SharedPrefsModule.kt` | Enforcement state, task snapshot, widget data | JSON by string interpolation; `apply()` everywhere; 4+ separate calls per focus state change |