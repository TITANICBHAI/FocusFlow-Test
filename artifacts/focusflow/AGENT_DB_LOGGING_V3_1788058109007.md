# Agent Task — Improve Database Logging in FocusFlow

## Read this before touching anything

The app has a working logger in `src/services/startupLogger.ts`.
It exports a `logger` object:

```typescript
logger.debug(tag, message)  // dev builds only, not persisted
logger.info(tag, message)   // persisted to disk
logger.warn(tag, message)   // persisted
logger.error(tag, message)  // persisted, fires subscribeToErrors() listeners
```

All DB logging uses the tag `'database'`.
Do not use `console.log`. Do not modify `startupLogger.ts`.
This task touches **`src/data/database.ts` only.**

SharedPrefs logging (for `publishFocusSnapshot` and `publishStandaloneSnapshot`)
is handled separately in Phase 3 of the persistence plan using `android.util.Log`
directly in `SharedPrefsModule.kt` — it goes to logcat, not the JS startup log.
Do not duplicate it here.

---

## What was removed from the previous logging plan

**Settings domain parse error logging** — removed. Settings normalization
(splitting the JSON blob into domain rows) was cut from the persistence plan
because `dbSaveSettings` is a single SQL statement and SQLite guarantees atomicity
at the statement level. The parse error scenario no longer needs a dedicated log.

---

## What FocusFlow1 already logs (do not duplicate)

```
[DEBUG] getDb: opening (in-flight: 1, API: 31)
[DEBUG] getDb: primary opened OK in 248ms
[INFO]  [DB_DIAG] API=31 Android=12 samsung SM-M315F SQLite=3.50.3
[WARN]  open/init attempt 1 failed (1087ms): NullPointerException at construct
[WARN]  JSI constructor NPE detected — skipping same-name retry
[ERROR] [DB_CORRUPTION_RECOVERY] opened recovery DB in 3666ms
[ERROR] [DB_UNRECOVERABLE] recovery DB failed
[WARN]  dbGetSettings: returning fallback after error
[WARN]  dbCheckpointWal: dead handle — resetting and retrying once
```

After Phase 1 of the persistence plan, `[DB_CORRUPTION_RECOVERY]` and
`returning fallback after error` for critical reads will no longer appear.
`markUnrecoverable()` replaces them. The items below build on top of that.

---

## What to add — in this order

---

### 1. Startup DB health snapshot

Add at the end of a successful `openAndInit()`, after all schema work completes,
before returning the handle. Capture `openStart = Date.now()` at the top of
`openAndInit()`.

```typescript
const [sqliteVer, taskCount, sessionCount, journalMode] = await Promise.all([
  db.getFirstAsync<{ v: string }>('SELECT sqlite_version() AS v'),
  db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks'),
  db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM focus_sessions'),
  db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode'),
]);

void logger.info(
  'database',
  `[DB_READY] tasks=${taskCount?.n ?? '?'} sessions=${sessionCount?.n ?? '?'} ` +
  `wal=${journalMode?.journal_mode ?? '?'} sqlite=${sqliteVer?.v ?? '?'} ` +
  `opened_in=${Date.now() - openStart}ms api=${Platform.Version}`
);
```

This is the most valuable single line in the entire log. When a user reports
"my tasks disappeared," this tells you immediately whether data existed at startup
before any failure occurred.

---

### 2. markUnrecoverable() transition log

The persistence plan (Phase 1.2) adds `markUnrecoverable(reason, context)` to
replace the bare `_dbUnrecoverable = true` assignments. That helper must include
the log at the transition point:

```typescript
function markUnrecoverable(reason: string, context: string): void {
  if (_dbUnrecoverable) return;
  _dbUnrecoverable = true;
  _usingRecoveryDb = false;
  void logger.error(
    'database',
    `[DB_UNAVAILABLE] reason=${reason} context=${context} ` +
    `api=${Platform.Version} in_flight=${_openInFlight}`
  );
}
```

Three call sites, each with a distinct reason:
- `markUnrecoverable('JSI_NPE', 'getDb_fast_path')`
- `markUnrecoverable('OPEN_FAILED', 'getDb_retry')`
- `markUnrecoverable('RECOVERY_ALSO_FAILED', 'getDb_recovery')`

This replaces the old `[DB_CORRUPTION_RECOVERY]` and `[DB_UNRECOVERABLE]` logs
with a single structured tag that clearly states which path was hit.

---

### 3. JSI probe-reset logging (Phase 2)

The persistence plan (Phase 2) adds `retryDb()` which opens a throwaway DB
to reset the dead JSI C++ pointer before retrying the real DB.
Log each step of the probe:

```typescript
export async function retryDb(): Promise<boolean> {
  void logger.info('database', '[DB_RETRY] retryDb() called — attempting JSI probe reset');
  resetDb();

  try {
    const probe = await SQLite.openDatabaseAsync('_jsi_probe.db');
    await probe.closeAsync();
    await SQLite.deleteDatabaseAsync('_jsi_probe.db').catch(() => {});
    void logger.info('database', '[DB_PROBE_OK] JSI probe succeeded — C++ state refreshed');
  } catch (e) {
    void logger.warn('database', `[DB_PROBE_FAILED] JSI probe failed: ${String(e)} — JSI may still be broken`);
  }

  const db = await getDb();
  if (db) {
    void logger.info('database', '[DB_RETRY_OK] primary DB opened after probe reset');
    return true;
  }
  void logger.error('database', '[DB_RETRY_FAILED] primary DB still unavailable after probe reset');
  return false;
}
```

These logs tell you whether the probe trick is actually working on the API 30
device. If `[DB_PROBE_OK]` appears but `[DB_RETRY_FAILED]` follows, the issue
is not the JSI cache — it's something deeper, and op-sqlite becomes the next step.

---

### 4. resetDb() call log

`resetDb()` clears the handle, the unrecoverable latch, and the in-flight counter.
Log the state at the moment of reset so you know what was cleared:

```typescript
export function resetDb(): void {
  void logger.info(
    'database',
    `[DB_RESET] clearing state ` +
    `(was_unrecoverable=${_dbUnrecoverable} was_recovery=${_usingRecoveryDb} ` +
    `in_flight=${_openInFlight})`
  );
  _db = null;
  _dbUnrecoverable = false;
  _usingRecoveryDb = false;
  _openInFlight = 0;
}
```

---

### 5. Slow query detection

Add a timing wrapper used inside `runWithDb` and `runWithDbOr`.
The threshold of 300ms reflects a DB that is starting to degrade — slow queries
consistently appeared before the dead handle in the Aug 26 failure sequence.

```typescript
const SLOW_QUERY_MS = 300;

async function timedOp<T>(opName: string, op: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await op();
    const ms = Date.now() - start;
    if (ms > SLOW_QUERY_MS) {
      void logger.warn(
        'database',
        `[DB_SLOW] ${opName} took ${ms}ms (threshold: ${SLOW_QUERY_MS}ms)`
      );
    }
    return result;
  } catch (e) {
    void logger.warn(
      'database',
      `[DB_OP_FAILED] ${opName} failed after ${Date.now() - start}ms: ${String(e)}`
    );
    throw e;
  }
}
```

Wrap the `op(database)` call inside both `runWithDb` and `runWithDbOr`:
```typescript
return await timedOp(opName, () => op(database));
```

---

### 6. Affected-row logging on writes

Add a helper that checks whether the SQL actually changed rows.
The existing `dbInsertTask` uses `INSERT OR IGNORE` — a duplicate silently
rejects and nothing is currently logged.

```typescript
async function runAndLogWrite(
  db: DbAdapter,
  opName: string,
  sql: string,
  params?: unknown[]
): Promise<void> {
  await db.runAsync(sql, params);
  const result = await db.getFirstAsync<{ changes: number }>(
    'SELECT changes() AS changes'
  );
  const affected = result?.changes ?? 0;
  if (affected === 0) {
    void logger.warn(
      'database',
      `[DB_WRITE_NOOP] ${opName}: 0 rows affected — duplicate or missing row`
    );
  } else {
    void logger.debug(
      'database',
      `[DB_WRITE_OK] ${opName}: ${affected} row(s) affected`
    );
  }
}
```

Use `runAndLogWrite` inside `runWithDbWrite` for these functions:

| Function | SQL type | Why it matters |
|---|---|---|
| `dbInsertTask` | `INSERT OR IGNORE` | Silent duplicate rejection invisible today |
| `dbUpdateTask` | `UPDATE WHERE id=X` | Can affect 0 rows if ID missing |
| `dbDeleteTask` | `DELETE WHERE id=X` | Can silently no-op |
| `dbSaveSettings` | `INSERT OR REPLACE` | Confirm settings actually wrote |
| `dbStartFocusSession` | `INSERT` | Confirm session created |
| `dbEndFocusSession` | `UPDATE WHERE id=X` | Confirm session closed |
| `dbRecordDayCompletion` | `INSERT OR IGNORE` | Same as task insert |

Do **not** use for: `CREATE TABLE IF NOT EXISTS`, `PRAGMA` statements,
WAL checkpoint, `dbPruneOldData`.

---

### 7. WAL checkpoint outcome

After `PRAGMA wal_checkpoint(FULL)`, read and log the result:

```typescript
const cp = await db.getFirstAsync<{
  busy: number;
  log: number;
  checkpointed: number;
}>('PRAGMA wal_checkpoint(FULL)');

if (cp) {
  void logger.info(
    'database',
    `[DB_WAL_CHECKPOINT] busy=${cp.busy} log=${cp.log} checkpointed=${cp.checkpointed}`
  );
  if (cp.busy === 1) {
    void logger.warn(
      'database',
      `[DB_WAL_CHECKPOINT_BUSY] read lock held by another process — ` +
      `likely AccessibilityService or VPN. WAL pages not checkpointed.`
    );
  }
}
```

The Aug 26 logs showed `database table is locked` before every JSI NPE.
`busy=1` makes the lock visible and names the likely holder immediately
instead of surfacing later as a cryptic dead handle.

---

### 8. Write queue telemetry

The existing `runSerializedWrite` chains onto `_writeTail`. If writes are
backing up, there is currently no signal. Add counters at the module level:

```typescript
let _writeQueueDepth = 0;
const WRITE_QUEUE_WARN_DEPTH = 3;
const WRITE_QUEUE_WARN_WAIT_MS = 2000;
```

Wrap inside `runSerializedWrite`:

```typescript
function runSerializedWrite<T>(op: DbWriteOp<T>): Promise<T> {
  _writeQueueDepth++;
  if (_writeQueueDepth >= WRITE_QUEUE_WARN_DEPTH) {
    void logger.warn(
      'database',
      `[DB_WRITE_QUEUE_DEEP] depth=${_writeQueueDepth} — writes backing up`
    );
  }
  const enqueuedAt = Date.now();

  const next = _writeTail.then(async () => {
    const waited = Date.now() - enqueuedAt;
    if (waited > WRITE_QUEUE_WARN_WAIT_MS) {
      void logger.warn(
        'database',
        `[DB_WRITE_QUEUE_STALL] waited ${waited}ms before executing write`
      );
    }
    try {
      return await op();
    } finally {
      _writeQueueDepth--;
    }
  }, async () => {
    _writeQueueDepth--;
    return op();
  });

  _writeTail = next.then(() => undefined, () => undefined);
  return next;
}
```

---

### 9. Schema migration logs

Inside any migration block, log start and outcome:

```typescript
const migrationStart = Date.now();
void logger.info('database', `[DB_MIGRATION_START] v${currentVersion} → v${TARGET_VERSION}`);

// ... migration SQL ...

void logger.info(
  'database',
  `[DB_MIGRATION_DONE] v${TARGET_VERSION} in ${Date.now() - migrationStart}ms`
);
```

On failure:
```typescript
void logger.error(
  'database',
  `[DB_MIGRATION_FAILED] v${currentVersion} → v${TARGET_VERSION}: ${String(e)}`
);
```

---

## Hard rules — never log these

1. **Task titles, descriptions, notes** — user content
2. **Settings values** — can contain PIN hashes, personal config
3. **SQL with parameter values** — log query shape only:
   ```
   OK:    '[DB_SLOW] dbGetTasksForDate took 420ms'
   WRONG: 'SELECT * FROM tasks WHERE date = "2026-08-26" took 420ms'
   ```
4. **Full stack traces** — `String(e)` gives the message, `e.stack` fills rotation fast
5. **Package names in DB logs** — belongs in SharedPrefs/logcat, not here

---

## Verification

After implementing, run on the API 30 device and confirm in logs:

- [ ] `[DB_READY]` appears within 300ms of startup with task count
- [ ] WAL checkpoint shows `[DB_WAL_CHECKPOINT] busy=0 log=X checkpointed=Y`
- [ ] If WAL is blocked: `[DB_WAL_CHECKPOINT_BUSY]` appears before any dead handle warning
- [ ] Task insert shows `[DB_WRITE_OK] dbInsertTask: 1 row(s) affected`
- [ ] If JSI NPE fires: `[DB_UNAVAILABLE] reason=JSI_NPE` — not `[DB_CORRUPTION_RECOVERY]`
- [ ] Retry path shows `[DB_RETRY]` → `[DB_PROBE_OK]` → `[DB_RETRY_OK]` in sequence
- [ ] No task content, no settings values visible anywhere

---

## What this gives you in practice

**Before — user reports "tasks disappeared":**
```
[WARN] dbGetTasksForDate: returning fallback after error
```
No idea how many tasks existed. No idea what caused it.

**After:**
```
[INFO]  [DB_READY] tasks=47 sessions=312 wal=wal opened_in=241ms api=30
[WARN]  [DB_WAL_CHECKPOINT_BUSY] read lock held — likely AccessibilityService
[WARN]  [DB_SLOW] dbGetTasksForDate took 1240ms
[WARN]  [DB_WRITE_QUEUE_STALL] waited 2400ms before executing write
[ERROR] [DB_UNAVAILABLE] reason=JSI_NPE context=getDb_fast_path api=30
[INFO]  [DB_RETRY] retryDb() called — attempting JSI probe reset
[INFO]  [DB_PROBE_OK] JSI probe succeeded — C++ state refreshed
[INFO]  [DB_RETRY_OK] primary DB opened after probe reset
```

47 tasks existed. The AccessibilityService held a read lock that blocked WAL.
Queries slowed before the NPE. The write queue stalled. The probe reset worked.
Complete picture without the user having to describe anything.
