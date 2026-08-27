import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { Task, AppSettings, FocusSession, DailyAllowanceEntry } from './types';
import { logger } from '@/services/startupLogger';
import { DEFAULT_SETTINGS } from './defaultSettings';

let db: SQLite.SQLiteDatabase | null = null;
const PRIMARY_DB_NAME = 'focusday.db';
const RECOVERY_DB_NAME = 'focusday_recovery.db';

/**
 * Single-flight guard: if a getDb() call is already in progress, all
 * concurrent callers await the same promise instead of each racing to
 * open their own copy of the database. Without this, multiple app
 * components initialising simultaneously all see db===null and launch
 * parallel open attempts that all fail and cascade into DB_UNRECOVERABLE.
 */
let _openingPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

/**
 * SQLite reads can safely overlap, but writes against the same Expo SQLite
 * handle must be serialized. Without this queue, a burst of task inserts or
 * schedule updates can race transactions and surface SQLITE_BUSY / "database
 * is locked" errors even though database opening itself is single-flight.
 */
let _writeTail: Promise<void> = Promise.resolve();

/**
 * Latched after all three open attempts (primary × 2 + recovery) have failed.
 * Once true, getDb() returns null immediately instead of re-entering the
 * 3-attempt cycle — preventing the cascade of repeated DB_UNRECOVERABLE
 * log events caused by background tasks and React components each starting
 * their own retry cycle after the first unrecoverable failure.
 *
 * resetDb() clears this flag so that the dead-handle recovery path in
 * runWithDb() can still attempt a fresh open after a previously-working
 * handle is invalidated by the OS.
 */
let _dbUnrecoverable = false;
let _usingRecoveryDb = false;

/**
 * Counts getDb() IIFEs currently in flight (i.e. actively trying to open the
 * database). Logged alongside every open failure so we can distinguish a
 * solo-caller NPE from a thundering-herd scenario where multiple background
 * tasks all race getDb() at the same time.
 */
let _openInFlight = 0;

/**
 * Reset the DB singleton — call after a recoverable open error so the next
 * getDb() call re-opens the database instead of retrying on a null reference.
 * (fixes NEW-018)
 */
export function resetDb(): void {
  db = null;
  _dbUnrecoverable = false;
  _usingRecoveryDb = false;
}

export function isDbUnrecoverable(): boolean {
  return _dbUnrecoverable;
}

export function isUsingRecoveryDb(): boolean {
  return _usingRecoveryDb;
}

async function openAndInit(name: string = PRIMARY_DB_NAME): Promise<SQLite.SQLiteDatabase> {
  const opened = await SQLite.openDatabaseAsync(name);
  await initSchema(opened);
  return opened;
}

// ─── Self-healing DB wrapper ─────────────────────────────────────────────────
//
// expo-sqlite caches the open SQLiteDatabase as a JS object whose underlying
// native pointer can be invalidated out from under us — most commonly when
// the OS trims our process while the app is backgrounded, when a foreground
// service restart races the JS init, or when WAL mode files are wiped from
// /data. After that, the JS handle still looks alive (`db !== null`) but every
// call into it surfaces as
//     "Call to function 'NativeDatabase.prepareAsync' has been rejected.
//      Caused by: java.lang.NullPointerException"
// and never recovers because the singleton stays cached. The user sees task
// edits, settings saves, and focus-session writes all silently failing for
// the rest of the app session.
//
// `runWithDb` detects that error signature, wipes the singleton, reopens the
// database (which also re-runs `initSchema`), and retries the operation once.

type DbOp<T> = (db: SQLite.SQLiteDatabase) => Promise<T>;

type DbWriteOp<T> = () => Promise<T>;

function runSerializedWrite<T>(op: DbWriteOp<T>): Promise<T> {
  const next = _writeTail.then(op, op);
  _writeTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function isDeadHandleError(e: unknown): boolean {
  const m = String((e as { message?: string } | null | undefined)?.message ?? e);
  return (
    m.includes('NullPointerException') ||
    m.includes('NativeDatabase') ||
    m.includes('prepareAsync') ||
    m.includes('database is not open') ||
    m.includes('database has been closed')
  );
}

/**
 * Detects a JSI-layer constructor NPE: the expo-sqlite native module caches a
 * C++ NativeDatabase object per filename. When Android (especially Samsung One
 * UI) trims that native object, calling openDatabaseAsync() with the SAME
 * filename tries to re-use the dead cached pointer and fails instantly at the
 * JSI constructor level — "at construct (native) at apply (native)".
 *
 * Retrying with the same filename hits the same dead cached state and always
 * fails (confirmed by both attempts failing in ~35ms with identical stacks).
 * Retrying with a DIFFERENT filename works because it creates a fresh C++
 * object. We use this to skip the futile same-name retry and go straight to
 * the recovery DB, saving ~365ms of wasted recovery time.
 */
function isJsiConstructorNpe(e: unknown): boolean {
  const m = fullErr(e);
  return (
    m.includes('construct (native)') ||
    (m.includes('NullPointerException') && m.includes('apply (native)'))
  );
}

function shortErr(e: unknown): string {
  return String((e as { message?: string } | null | undefined)?.message ?? e).slice(0, 160);
}

/**
 * Run an operation against the open DB. On a "dead handle" failure, the
 * singleton is reset, the DB is reopened, and the operation is retried once.
 * Any other error is rethrown unchanged so callers' existing try/catch
 * branches keep working.
 */
async function runWithDb<T>(opName: string, op: DbOp<T>): Promise<T> {
  const first = await getDb();
  if (!first) throw new Error(`${opName}: DB unavailable`);
  try {
    return await op(first);
  } catch (e) {
    if (!isDeadHandleError(e)) throw e;
    void logger.warn('database', `${opName}: dead handle (${shortErr(e)}) — resetting and retrying once`);
    resetDb();
    const second = await getDb();
    if (!second) throw new Error(`${opName}: DB unavailable after reset`);
    try {
      const out = await op(second);
      void logger.info('database', `${opName}: retry succeeded after handle reset`);
      return out;
    } catch (e2) {
      void logger.error('database', `${opName}: retry also failed: ${shortErr(e2)}`);
      throw e2;
    }
  }
}

/**
 * Run a database mutation after all earlier mutations have settled. Keeping
 * the existing dead-handle retry inside the queue prevents a recovery retry
 * from racing the next write against a freshly reopened handle.
 */
function runWithDbWrite<T>(opName: string, op: DbOp<T>): Promise<T> {
  return runSerializedWrite(() => runWithDb(opName, op));
}

/**
 * Same as `runWithDb` but returns a fallback value instead of throwing —
 * for read-only callers that prefer to render an empty state on failure.
 */
async function runWithDbOr<T>(opName: string, fallback: T, op: DbOp<T>): Promise<T> {
  try {
    return await runWithDb(opName, op);
  } catch (e) {
    void logger.warn('database', `${opName}: returning fallback after error: ${shortErr(e)}`);
    return fallback;
  }
}

/**
 * Returns the open database, opening it if needed.
 * Retry strategy (3 attempts, never throws):
 *   1. Open PRIMARY_DB_NAME; if OK, return.
 *   2. Reset singleton, wait 300ms, retry PRIMARY_DB_NAME; if OK, return.
 *   3. Assume corruption — open RECOVERY_DB_NAME (always a fresh file).
 *      Logs [DB_CORRUPTION_RECOVERY] to the startup logger.
 *      If even this fails, return null.
 */
/** Extracts the most useful error string including cause chain and stack snippet. */
function fullErr(e: unknown): string {
  const err = e as { message?: string; cause?: unknown; stack?: string } | null | undefined;
  const msg = String(err?.message ?? e).slice(0, 200);
  const cause = err?.cause ? ` | cause: ${String((err.cause as { message?: string })?.message ?? err.cause).slice(0, 120)}` : '';
  const stack = err?.stack ? ` | stack: ${err.stack.split('\n').slice(1, 4).join(' ').trim()}` : '';
  return msg + cause + stack;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  // Fast-fail after all three open attempts have been exhausted. Prevents
  // background tasks and React components from each kicking off a fresh
  // 3-attempt cycle and flooding the logs with repeated DB_UNRECOVERABLE
  // events. resetDb() clears this flag so dead-handle recovery still works.
  if (_dbUnrecoverable) return null;
  if (db) return db;

  // Single-flight: if an open is already in progress, join it instead of
  // racing a parallel open that would also fail and log DB_UNRECOVERABLE.
  if (_openingPromise) return _openingPromise;

  _openingPromise = (async () => {
    _openInFlight++;
    const t0 = Date.now();
    void logger.debug('database', `getDb: opening (in-flight: ${_openInFlight}, API: ${Platform.Version})`);
    try {
      db = await openAndInit(PRIMARY_DB_NAME);
      _usingRecoveryDb = false;
      void logger.debug('database', `getDb: primary opened OK in ${Date.now() - t0}ms`);
      void SQLite.deleteDatabaseAsync(RECOVERY_DB_NAME).catch(() => {});
      return db;
    } catch (firstErr) {
      const ms1 = Date.now() - t0;
      console.error('[database] open/init failed (attempt 1):', firstErr);
      void logger.warn('database', `open/init attempt 1 failed (${ms1}ms, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(firstErr)}`);
      resetDb();

      // ── JSI constructor NPE fast-path ────────────────────────────────────────
      // When Android (Samsung One UI in particular) trims the C++ NativeDatabase
      // object that expo-sqlite caches per filename, any attempt to reopen the
      // SAME filename hits the dead cached pointer again and fails in ~35ms with
      // an identical NPE ("at construct (native)"). The 300ms wait + retry is
      // therefore completely futile for this error class.
      //
      // A DIFFERENT filename always works because it creates a fresh C++ object.
      // So we skip straight to the recovery DB, saving ~365ms of downtime.
      if (isJsiConstructorNpe(firstErr)) {
        void logger.warn('database', `open/init: JSI constructor NPE detected — skipping same-name retry, opening recovery DB immediately (saves ~${300 + ms1}ms)`);
        try {
          db = await openAndInit(RECOVERY_DB_NAME);
          _usingRecoveryDb = true;
          void logger.error('database', `[DB_CORRUPTION_RECOVERY] opened recovery DB in ${Date.now() - t0}ms total (JSI fast-path)`);
          return db;
        } catch (recoveryErr) {
          const ms3 = Date.now() - t0;
          console.error('[database] recovery DB also failed (JSI fast-path) — giving up:', recoveryErr);
          void logger.error('database', `[DB_UNRECOVERABLE] recovery DB failed (${ms3}ms total, JSI fast-path, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(recoveryErr)}`);
          _dbUnrecoverable = true;
          return null;
        }
      }

      // ── Standard retry (non-JSI errors: schema migration, file locks, etc.) ──
      await new Promise((r) => setTimeout(r, 300));
      try {
        db = await openAndInit(PRIMARY_DB_NAME);
        _usingRecoveryDb = false;
        void logger.debug('database', `getDb: primary opened OK on attempt 2 in ${Date.now() - t0}ms total`);
        void SQLite.deleteDatabaseAsync(RECOVERY_DB_NAME).catch(() => {});
        return db;
      } catch (secondErr) {
        const ms2 = Date.now() - t0;
        console.error('[database] open/init failed (attempt 2 — trying recovery DB):', secondErr);
        void logger.error('database', `open/init attempt 2 failed (${ms2}ms, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(secondErr)} — switching to recovery DB`);
        try {
          db = await openAndInit(RECOVERY_DB_NAME);
          _usingRecoveryDb = true;
          void logger.error('database', `[DB_CORRUPTION_RECOVERY] opened recovery DB in ${Date.now() - t0}ms total — primary may be corrupted`);
          return db;
        } catch (recoveryErr) {
          const ms3 = Date.now() - t0;
          console.error('[database] recovery DB also failed — giving up:', recoveryErr);
          void logger.error('database', `[DB_UNRECOVERABLE] recovery DB failed (${ms3}ms total, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(recoveryErr)}`);
          // Latch the flag so every subsequent getDb() call fast-fails with null
          // instead of restarting the 3-attempt cycle. This stops the cascade of
          // repeated DB_UNRECOVERABLE events caused by background tasks and React
          // components each triggering their own retry cycle after this point.
          _dbUnrecoverable = true;
          return null;
        }
      }
    } finally {
      _openInFlight--;
      _openingPromise = null;
    }
  })();

  return _openingPromise;
}

// ─── DB health probe ─────────────────────────────────────────────────────────

/**
 * Runs a lightweight `SELECT 1` against the current DB handle to verify it is
 * still alive. Returns `true` if healthy, `false` if dead or not yet open.
 *
 * Use this in FOREGROUND_RESUME before deciding whether to call `resetDb()`.
 * On most resumes the handle is fine — skipping an unnecessary reset avoids
 * the open/close cycle that gives Samsung One UI another opportunity to trim
 * the native C++ NativeDatabase object (the root cause of the JSI NPE).
 */
export async function probeDbHealth(): Promise<boolean> {
  if (!db) return false;
  try {
    await db.getFirstAsync('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// ─── Session device fingerprint ───────────────────────────────────────────────

/**
 * One-shot [DB_DIAG] log entry written at the very start of each session.
 * Captures the Android API level, OS version string, device manufacturer/model,
 * and the SQLite version string reported by the open database so every log
 * share has a permanent device fingerprint at the top — making it trivial to
 * correlate failures across different devices.
 *
 * Safe to call multiple times — only fires on the first call per process.
 */
let _diagLogged = false;

export async function logDbDiagnostics(): Promise<void> {
  if (_diagLogged) return;
  _diagLogged = true;
  try {
    const constants = Platform.constants as Record<string, unknown>;
    const api        = Platform.Version;
    const release    = String(constants.Release    ?? constants.release    ?? '?');
    const mfr        = String(constants.Manufacturer ?? constants.manufacturer ?? '?');
    const model      = String(constants.Model      ?? constants.model      ?? '?');

    let sqliteVer = '?';
    try {
      const handle = await getDb();
      if (handle) {
        const row = await handle.getFirstAsync<{ v: string }>('SELECT sqlite_version() AS v');
        if (row?.v) sqliteVer = row.v;
      }
    } catch {
      // Non-fatal — leave sqliteVer as '?'
    }

    void logger.info(
      'database',
      `[DB_DIAG] API=${api} Android=${release} ${mfr} ${model} SQLite=${sqliteVer}`,
    );
  } catch (e) {
    // Diagnostics must never crash the caller.
    void logger.warn('database', `[DB_DIAG] collection failed: ${String(e)}`);
  }
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // Enable referential-integrity checks for any foreign keys defined by the
  // schema. This is connection-scoped and safe for the existing schema, which
  // currently has no foreign-key constraints.
  await db.runAsync('PRAGMA foreign_keys = ON');

  // Give short-lived native contention time to clear. The JS write queue
  // handles app-level concurrency; this also protects against a brief writer
  // outside the queue, such as an OS/background lifecycle interaction.
  try {
    await db.runAsync('PRAGMA busy_timeout = 5000');
  } catch {
    // Best-effort; the serialized write queue remains the primary safeguard.
  }

  // ── WAL mode ────────────────────────────────────────────────────────────────
  // Best-effort: some Android filesystems (certain OEM /data partitions) reject
  // WAL mode and throw NullPointerException inside execAsync. If it fails we
  // fall back to the default DELETE journal mode — the DB is still fully usable.
  try {
    await db.runAsync('PRAGMA journal_mode = WAL');
  } catch {
    // WAL not supported on this filesystem — continue with DELETE mode.
  }

  // ── Core tables ─────────────────────────────────────────────────────────────
  // One runAsync per statement: expo-sqlite v14 throws NullPointerException
  // when multiple SQL statements are batched into a single execAsync call on
  // Android. Splitting into individual calls avoids the NPE entirely.

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      priority TEXT NOT NULL DEFAULT 'medium',
      tags TEXT NOT NULL DEFAULT '[]',
      reminders TEXT NOT NULL DEFAULT '[]',
      color TEXT NOT NULL DEFAULT '#6366f1',
      focus_mode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      allowed_packages TEXT NOT NULL DEFAULT '[]'
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS focus_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      app_name TEXT NOT NULL,
      overridden_at TEXT NOT NULL,
      reason TEXT
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS daily_completions (
      date TEXT PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0
    )
  `);

  // ── Migration: add focus_allowed_packages column ─────────────────────────
  // ALTER TABLE ADD COLUMN is idempotent via try/catch — safe to run every time.
  try {
    await db.runAsync('ALTER TABLE tasks ADD COLUMN focus_allowed_packages TEXT');
  } catch {
    // Column already exists — ignore.
  }

  // ── Indexes ──────────────────────────────────────────────────────────────
  // CREATE INDEX IF NOT EXISTS is a no-op when the index already exists.
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_status_end ON tasks(status, end_time)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_active ON focus_sessions(task_id, is_active)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_focus_overrides_overridden_at ON focus_overrides(overridden_at)');
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function dbGetAllTasks(): Promise<Task[]> {
  return runWithDbOr('dbGetAllTasks', [], async (database) => {
    const rows = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM tasks ORDER BY start_time ASC');
    return rows.map(rowToTask);
  });
}

/**
 * Returns tasks from the last 24 hours that ended before now but are still
 * unresolved (status is not 'completed' or 'skipped').
 *
 * Used by AppContext.refreshTasks() to keep yesterday's unresolved tasks
 * visible on the Focus tab even after midnight, so the user is prompted to
 * resolve them when a new task or block session starts.
 */
export async function dbGetRecentUnresolvedTasks(): Promise<Task[]> {
  return runWithDbOr('dbGetRecentUnresolvedTasks', [], async (database) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const rows = await database.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM tasks
       WHERE end_time >= ? AND end_time < ?
         AND status NOT IN ('completed', 'skipped')
       ORDER BY end_time DESC`,
      [cutoff, now],
    );
    return rows.map(rowToTask);
  });
}

/**
 * Returns all tasks whose start_time (interpreted in local time) falls within
 * the inclusive [startDateISO, endDateISO] range. Used by the Stats screen so
 * the Yesterday / Week / All-Time tabs aren't limited to the small in-memory
 * `state.tasks` window (which only holds today + recent unresolved).
 */
export async function dbGetTasksInDateRange(startDateISO: string, endDateISO: string): Promise<Task[]> {
  return runWithDbOr('dbGetTasksInDateRange', [], async (database) => {
    const localDate = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const start = localDate(startDateISO);
    const end = localDate(endDateISO);
    const rows = await database.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM tasks
       WHERE date(datetime(start_time, 'localtime')) BETWEEN ? AND ?
       ORDER BY start_time ASC`,
      [start, end],
    );
    return rows.map(rowToTask);
  });
}

export async function dbGetTasksForDate(dateISO: string): Promise<Task[]> {
  return runWithDbOr('dbGetTasksForDate', [], async (database) => {
    // Use the local calendar date — tasks are displayed in local time so queries
    // must match local date, not UTC. We pass a YYYY-MM-DD string derived from
    // a local Date so that users in UTC-X timezones see evening tasks correctly.
    const localDate = new Date(dateISO);
    const day = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    // SQLite datetime() with 'localtime' modifier converts the stored UTC ISO
    // timestamp to the device's local timezone before extracting the date.
    const rows = await database.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM tasks WHERE date(datetime(start_time, 'localtime')) = ? ORDER BY start_time ASC`,
      [day],
    );
    return rows.map(rowToTask);
  });
}

export async function dbInsertTask(task: Task): Promise<void> {
  return runWithDbWrite('dbInsertTask', (database) => database.runAsync(
    `INSERT OR IGNORE INTO tasks (id, title, description, start_time, end_time, duration_minutes, status, priority, tags, reminders, color, focus_mode, focus_allowed_packages, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.title,
      task.description ?? null,
      task.startTime,
      task.endTime,
      task.durationMinutes,
      task.status,
      task.priority,
      JSON.stringify(task.tags),
      JSON.stringify(task.reminders),
      task.color,
      task.focusMode ? 1 : 0,
      task.focusAllowedPackages !== undefined ? JSON.stringify(task.focusAllowedPackages) : null,
      task.createdAt,
      task.updatedAt,
    ],
  ).then(() => undefined));
}

export async function dbUpdateTask(task: Task): Promise<void> {
  return runWithDbWrite('dbUpdateTask', (database) => database.runAsync(
    `UPDATE tasks SET title=?, description=?, start_time=?, end_time=?, duration_minutes=?, status=?, priority=?, tags=?, reminders=?, color=?, focus_mode=?, focus_allowed_packages=?, updated_at=? WHERE id=?`,
    [
      task.title,
      task.description ?? null,
      task.startTime,
      task.endTime,
      task.durationMinutes,
      task.status,
      task.priority,
      JSON.stringify(task.tags),
      JSON.stringify(task.reminders),
      task.color,
      task.focusMode ? 1 : 0,
      task.focusAllowedPackages !== undefined ? JSON.stringify(task.focusAllowedPackages) : null,
      task.updatedAt,
      task.id,
    ],
  ).then(() => undefined));
}

/**
 * Atomically update multiple tasks inside a single SQLite transaction.
 * If any row update fails the entire batch is rolled back, so the schedule
 * is never left in a half-shifted state (e.g. mid-way through extendTaskTime).
 */
export async function dbUpdateTasksBatch(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return;
  return runWithDbWrite('dbUpdateTasksBatch', async (database) => {
    await database.withTransactionAsync(async () => {
      for (const task of tasks) {
        await database.runAsync(
          `UPDATE tasks SET title=?, description=?, start_time=?, end_time=?, duration_minutes=?, status=?, priority=?, tags=?, reminders=?, color=?, focus_mode=?, focus_allowed_packages=?, updated_at=? WHERE id=?`,
          [
            task.title,
            task.description ?? null,
            task.startTime,
            task.endTime,
            task.durationMinutes,
            task.status,
            task.priority,
            JSON.stringify(task.tags),
            JSON.stringify(task.reminders),
            task.color,
            task.focusMode ? 1 : 0,
            task.focusAllowedPackages !== undefined ? JSON.stringify(task.focusAllowedPackages) : null,
            task.updatedAt,
            task.id,
          ],
        );
      }
    });
  });
}

export async function dbDeleteTask(taskId: string): Promise<void> {
  return runWithDbWrite('dbDeleteTask', (database) =>
    database.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]).then(() => undefined),
  );
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(raw as string) as T;
  } catch {
    return fallback;
  }
}

function rowToTask(row: Record<string, unknown>): Task {
  const rawFap = row.focus_allowed_packages as string | null | undefined;
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    durationMinutes: row.duration_minutes as number,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    // Individual try/catch via safeJsonParse — a single malformed row
    // no longer throws through the whole rows.map() and wipes today's tasks.
    tags: safeJsonParse<string[]>(row.tags, []),
    reminders: safeJsonParse<Task['reminders']>(row.reminders, []),
    color: row.color as string,
    focusMode: (row.focus_mode as number) === 1,
    focusAllowedPackages: rawFap ? safeJsonParse<string[]>(rawFap, []) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function dbGetSettings(): Promise<AppSettings> {
  return runWithDbOr('dbGetSettings', DEFAULT_SETTINGS, async (database) => {
    const row = await database.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'app_settings'`,
    );
    if (!row) return DEFAULT_SETTINGS;
    try {
      const parsed = JSON.parse(row.value) as Partial<AppSettings> & { dailyAllowancePackages?: string[] };
      // Migrate old dailyAllowancePackages: string[] → dailyAllowanceEntries: DailyAllowanceEntry[]
      if (parsed.dailyAllowancePackages && !parsed.dailyAllowanceEntries) {
        parsed.dailyAllowanceEntries = parsed.dailyAllowancePackages.map((pkg): DailyAllowanceEntry => ({
          packageName: pkg,
          mode: 'count',
          countPerDay: 1,
          budgetMinutes: 30,
          intervalMinutes: 5,
          intervalHours: 1,
        }));
        delete parsed.dailyAllowancePackages;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
}

export async function dbSaveSettings(settings: AppSettings): Promise<void> {
  return runWithDbWrite('dbSaveSettings', (database) => database.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)`,
    [JSON.stringify(settings)],
  ).then(() => undefined));
}

// ─── Focus Sessions ──────────────────────────────────────────────────────────

export async function dbStartFocusSession(session: FocusSession): Promise<void> {
  return runWithDbWrite('dbStartFocusSession', (database) => database.runAsync(
    `INSERT INTO focus_sessions (task_id, started_at, is_active, allowed_packages) VALUES (?, ?, 1, ?)`,
    [session.taskId, session.startedAt, JSON.stringify(session.allowedPackages)],
  ).then(() => undefined));
}

export async function dbEndFocusSession(taskId: string): Promise<void> {
  return runWithDbWrite('dbEndFocusSession', (database) => database.runAsync(
    `UPDATE focus_sessions SET is_active = 0, ended_at = ? WHERE task_id = ? AND is_active = 1`,
    [new Date().toISOString(), taskId],
  ).then(() => undefined));
}

export async function dbGetActiveFocusSession(): Promise<FocusSession | null> {
  return runWithDbOr('dbGetActiveFocusSession', null, async (database) => {
    const row = await database.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM focus_sessions WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
    );
    if (!row) return null;
    return {
      taskId: row.task_id as string,
      startedAt: row.started_at as string,
      isActive: true,
      allowedPackages: safeJsonParse<string[]>(row.allowed_packages, []),
    };
  });
}

export async function dbGetTodayFocusMinutes(): Promise<number> {
  return runWithDbOr('dbGetTodayFocusMinutes', 0, async (database) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await database.getAllAsync<{ started_at: string; ended_at: string | null }>(
      `SELECT started_at, ended_at FROM focus_sessions WHERE started_at >= ? ORDER BY id DESC`,
      [startOfDay.toISOString()],
    );
    let totalMs = 0;
    const now = Date.now();
    for (const row of rows) {
      const start = new Date(row.started_at).getTime();
      const end = row.ended_at ? new Date(row.ended_at).getTime() : now;
      totalMs += Math.max(0, end - start);
    }
    return Math.floor(totalMs / 60000);
  });
}

// ─── Override Logging ─────────────────────────────────────────────────────────

export async function dbLogFocusOverride(taskId: string, appName: string, reason?: string): Promise<void> {
  try {
    await runWithDbWrite('dbLogFocusOverride', (database) => database.runAsync(
      `INSERT INTO focus_overrides (task_id, app_name, overridden_at, reason) VALUES (?, ?, ?, ?)`,
      [taskId, appName, new Date().toISOString(), reason ?? null],
    ).then(() => undefined));
  } catch (e) {
    void logger.error('database', `dbLogFocusOverride failed: ${String(e)}`);
  }
}

export async function dbGetTodayOverrideCount(): Promise<number> {
  return runWithDbOr('dbGetTodayOverrideCount', 0, async (database) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM focus_overrides WHERE overridden_at >= ?`,
      [startOfDay.toISOString()],
    );
    return row?.count ?? 0;
  });
}

export async function dbGetOverrideCountInRange(startISO: string, endISO: string): Promise<number> {
  return runWithDbOr('dbGetOverrideCountInRange', 0, async (database) => {
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM focus_overrides
       WHERE overridden_at >= ? AND overridden_at <= ?`,
      [startISO, endISO],
    );
    return row?.count ?? 0;
  });
}

// ─── Daily Streak ─────────────────────────────────────────────────────────────

export async function dbRecordDayCompletion(completed: number, total: number): Promise<void> {
  try {
    await runWithDbWrite('dbRecordDayCompletion', (database) => {
      const date = localDateString(new Date());
      return database.runAsync(
        `INSERT OR REPLACE INTO daily_completions (date, completed, total) VALUES (?, ?, ?)`,
        [date, completed, total],
      ).then(() => undefined);
    });
  } catch (e) {
    void logger.error('database', `dbRecordDayCompletion failed: ${String(e)}`);
  }
}

/**
 * Backfill the `daily_completions` table from the actual `tasks` table for the
 * last `daysBack` days. Useful on app start so the streak isn't broken just
 * because the user never opened the Stats screen on a given day. Only writes
 * rows for days that have at least one task. Existing rows are overwritten so
 * the derived value always reflects the current task statuses.
 */
export async function dbBackfillDayCompletions(daysBack: number = 30): Promise<void> {
  try {
    await runWithDbWrite('dbBackfillDayCompletions', async (database) => {
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - daysBack + 1);
      const cutoffIso = cutoff.toISOString();
      const rows = await database.getAllAsync<{ start_time: string; status: string }>(
        `SELECT start_time, status FROM tasks WHERE start_time >= ?`,
        [cutoffIso],
      );
      const buckets = new Map<string, { completed: number; total: number }>();
      for (const r of rows) {
        const d = localDateString(new Date(r.start_time));
        const b = buckets.get(d) ?? { completed: 0, total: 0 };
        b.total += 1;
        if (r.status === 'completed') b.completed += 1;
        buckets.set(d, b);
      }
      await database.withTransactionAsync(async () => {
        for (const [date, b] of buckets) {
          await database.runAsync(
            `INSERT OR REPLACE INTO daily_completions (date, completed, total) VALUES (?, ?, ?)`,
            [date, b.completed, b.total],
          );
        }
      });
    });
  } catch (e) {
    void logger.error('database', `dbBackfillDayCompletions failed: ${String(e)}`);
  }
}

function localDateString(d: Date): string {
  // Local YYYY-MM-DD — must match what dbGetStreak expects so streak math
  // doesn't break across UTC midnight for users in non-UTC timezones.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string as a **local** midnight Date, not UTC midnight.
 * Using `new Date('YYYY-MM-DD')` parses as UTC and shifts the day by the
 * user's UTC offset, breaking streak math in any UTC-negative timezone.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export async function dbGetStreak(): Promise<number> {
  return runWithDbOr('dbGetStreak', 0, async (database) => {
    const rows = await database.getAllAsync<{ date: string; completed: number; total: number }>(
      `SELECT date, completed, total FROM daily_completions ORDER BY date DESC LIMIT 60`,
    );
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (const row of rows) {
      const rowDate = parseLocalDate(row.date); // local midnight, not UTC
      const diffDays = Math.round((checkDate.getTime() - rowDate.getTime()) / 86400000);
      if (diffDays > 1) break; // gap in streak
      // Count day as "active" if at least 50% completion
      if (row.total > 0 && row.completed / row.total >= 0.5) {
        streak++;
        checkDate = rowDate;
      } else {
        break;
      }
    }
    return streak;
  });
}

// ─── WAL checkpoint ───────────────────────────────────────────────────────────
//
// SQLite WAL mode keeps recent writes in a separate -wal sidecar file.
// When Android's Auto Backup agent copies the database it grabs the .db file
// as-is. If the -wal file has uncommitted pages that haven't been folded back
// into the main .db yet, the backup will be missing those writes.
//
// `dbCheckpointWal` runs a FULL checkpoint that:
//  1. Ensures all WAL frames are written back to the main .db file.
//  2. Makes the -wal file safe to truncate (Android does this on its own).
//
// Call this whenever the app goes to background and periodically during idle
// so the on-disk database is always in sync with what the user expects.

export async function dbCheckpointWal(): Promise<void> {
  try {
    await runWithDbWrite('dbCheckpointWal', async (database) => {
      await database.execAsync('PRAGMA wal_checkpoint(FULL);');
    });
  } catch (e) {
    void logger.warn('database', `WAL checkpoint failed (non-fatal): ${String(e)}`);
  }
}

// ─── All-time / heatmap stats ─────────────────────────────────────────────────

/** Returns all daily_completions rows for the last `days` days, sorted oldest-first. */
export async function dbGetRecentDayCompletions(days: number): Promise<
  { date: string; completed: number; total: number }[]
> {
  return runWithDbOr('dbGetRecentDayCompletions', [], async (database) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return await database.getAllAsync<{ date: string; completed: number; total: number }>(
      `SELECT date, completed, total FROM daily_completions WHERE date >= ? ORDER BY date ASC`,
      [cutoffStr],
    );
  });
}

/** Total focus minutes across all recorded sessions. */
export async function dbGetAllTimeFocusMinutes(): Promise<number> {
  return runWithDbOr('dbGetAllTimeFocusMinutes', 0, async (database) => {
    const rows = await database.getAllAsync<{ started_at: string; ended_at: string | null }>(
      `SELECT started_at, ended_at FROM focus_sessions WHERE is_active = 0`,
    );
    let total = 0;
    for (const r of rows) {
      if (!r.ended_at) continue;
      const ms = new Date(r.ended_at).getTime() - new Date(r.started_at).getTime();
      if (ms > 0) total += ms / 60_000;
    }
    return Math.round(total);
  });
}

/** Total count of completed focus sessions across all time. */
export async function dbGetAllTimeFocusSessions(): Promise<number> {
  return runWithDbOr('dbGetAllTimeFocusSessions', 0, async (database) => {
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM focus_sessions WHERE is_active = 0`,
    );
    return row?.count ?? 0;
  });
}

/**
 * Deletes old records to keep the database lean.
 * Removes completed focus sessions and daily completion records older than
 * `daysToKeep` days. Called once per app session after the DB is ready.
 * Non-fatal — errors are silently swallowed by the caller.
 */
export async function dbPruneOldData(daysToKeep = 90): Promise<void> {
  return runSerializedWrite(() =>
    runWithDbOr('dbPruneOldData', undefined, async (database) => {
      // Focus sessions and daily completion rows are compact — keep 90 days.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      const cutoffIso  = cutoff.toISOString();
      const cutoffDate = cutoffIso.slice(0, 10);
      await database.runAsync(
        `DELETE FROM focus_sessions WHERE is_active = 0 AND ended_at IS NOT NULL AND ended_at < ?`,
        [cutoffIso],
      );
      await database.runAsync(
        `DELETE FROM daily_completions WHERE date < ?`,
        [cutoffDate],
      );
      // Tasks are kept for a full year so the "All Time" task log stays meaningful.
      // Each row is small (~500 bytes), so 365 days of tasks is well under 10 MB.
      const taskCutoff = new Date();
      taskCutoff.setDate(taskCutoff.getDate() - 365);
      await database.runAsync(
        `DELETE FROM tasks WHERE status IN ('completed', 'skipped') AND end_time < ?`,
        [taskCutoff.toISOString()],
      );
    }),
  );
}

/** Deletes every task row in one shot. Used by "Clear All Tasks" in Settings. */
export async function dbDeleteAllTasks(): Promise<void> {
  return runWithDbWrite('dbDeleteAllTasks', (database) =>
    database.runAsync('DELETE FROM tasks').then(() => undefined),
  );
}

/** Deletes every task except the task currently running in focus mode. */
export async function dbDeleteAllTasksExcept(taskId: string): Promise<void> {
  return runWithDbWrite('dbDeleteAllTasksExcept', (database) =>
    database.runAsync('DELETE FROM tasks WHERE id != ?', [taskId]).then(() => undefined),
  );
}

/** Best consecutive-day streak ever recorded (50% completion threshold). */
export async function dbGetBestStreak(): Promise<number> {
  return runWithDbOr('dbGetBestStreak', 0, async (database) => {
    const rows = await database.getAllAsync<{ date: string; completed: number; total: number }>(
      `SELECT date, completed, total FROM daily_completions ORDER BY date ASC`,
    );
    let best = 0;
    let current = 0;
    let prevDate: Date | null = null;
    for (const r of rows) {
      const d = parseLocalDate(r.date); // local midnight, not UTC
      const isGood = r.total > 0 && r.completed / r.total >= 0.5;
      if (!isGood) { best = Math.max(best, current); current = 0; prevDate = null; continue; }
      if (!prevDate) { current = 1; }
      else {
        const diff = Math.round((d.getTime() - prevDate.getTime()) / 86400000);
        if (diff === 1) current++;
        else { best = Math.max(best, current); current = 1; }
      }
      prevDate = d;
    }
    return Math.max(best, current);
  });
}
