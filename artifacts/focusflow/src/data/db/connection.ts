import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { logger } from '@/services/startupLogger';

let db: SQLite.SQLiteDatabase | null = null;
const PRIMARY_DB_NAME = 'focusday.db';
const RECOVERY_DB_NAME = 'focusday_recovery.db';

/**
 * Single-flight guard: if a getDb() call is already in progress, all
 * concurrent callers await the same promise instead of each racing to
 * open their own copy of the database.
 */
let _openingPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

/**
 * Latched after all three open attempts (primary × 2 + recovery) have failed.
 * Once true, getDb() returns null immediately instead of re-entering the
 * 3-attempt cycle. resetDb() clears this flag so dead-handle recovery still works.
 */
let _dbUnrecoverable = false;

let _openInFlight = 0;

/**
 * Reset the DB singleton — call after a recoverable open error so the next
 * getDb() call re-opens the database instead of retrying on a null reference.
 */
export function resetDb(): void {
  db = null;
  _dbUnrecoverable = false;
}

async function openAndInit(name: string = PRIMARY_DB_NAME): Promise<SQLite.SQLiteDatabase> {
  const opened = await SQLite.openDatabaseAsync(name);
  await initSchema(opened);
  return opened;
}

// ─── Self-healing DB wrapper ─────────────────────────────────────────────────

type DbOp<T> = (db: SQLite.SQLiteDatabase) => Promise<T>;

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
 * JSI constructor level.
 *
 * A DIFFERENT filename always works because it creates a fresh C++ object.
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

function fullErr(e: unknown): string {
  const err = e as { message?: string; cause?: unknown; stack?: string } | null | undefined;
  const msg = String(err?.message ?? e).slice(0, 200);
  const cause = err?.cause ? ` | cause: ${String((err.cause as { message?: string })?.message ?? err.cause).slice(0, 120)}` : '';
  const stack = err?.stack ? ` | stack: ${err.stack.split('\n').slice(1, 4).join(' ').trim()}` : '';
  return msg + cause + stack;
}

/**
 * Run an operation against the open DB. On a "dead handle" failure, the
 * singleton is reset, the DB is reopened, and the operation is retried once.
 * Any other error is rethrown unchanged.
 */
export async function runWithDb<T>(opName: string, op: DbOp<T>): Promise<T> {
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
 * Same as `runWithDb` but returns a fallback value instead of throwing.
 */
export async function runWithDbOr<T>(opName: string, fallback: T, op: DbOp<T>): Promise<T> {
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
 *      If even this fails, return null.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (_dbUnrecoverable) return null;
  if (db) return db;

  if (_openingPromise) return _openingPromise;

  _openingPromise = (async () => {
    _openInFlight++;
    const t0 = Date.now();
    void logger.debug('database', `getDb: opening (in-flight: ${_openInFlight}, API: ${Platform.Version})`);
    try {
      db = await openAndInit(PRIMARY_DB_NAME);
      void logger.debug('database', `getDb: primary opened OK in ${Date.now() - t0}ms`);
      return db;
    } catch (firstErr) {
      const ms1 = Date.now() - t0;
      console.error('[database] open/init failed (attempt 1):', firstErr);
      void logger.warn('database', `open/init attempt 1 failed (${ms1}ms, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(firstErr)}`);
      resetDb();

      // JSI constructor NPE fast-path
      if (isJsiConstructorNpe(firstErr)) {
        void logger.warn('database', `open/init: JSI constructor NPE detected — skipping same-name retry, opening recovery DB immediately (saves ~${300 + ms1}ms)`);
        try {
          db = await openAndInit(RECOVERY_DB_NAME);
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

      // Standard retry (non-JSI errors)
      await new Promise((r) => setTimeout(r, 300));
      try {
        db = await openAndInit(PRIMARY_DB_NAME);
        void logger.debug('database', `getDb: primary opened OK on attempt 2 in ${Date.now() - t0}ms total`);
        return db;
      } catch (secondErr) {
        const ms2 = Date.now() - t0;
        console.error('[database] open/init failed (attempt 2 — trying recovery DB):', secondErr);
        void logger.error('database', `open/init attempt 2 failed (${ms2}ms, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(secondErr)} — switching to recovery DB`);
        try {
          db = await openAndInit(RECOVERY_DB_NAME);
          void logger.error('database', `[DB_CORRUPTION_RECOVERY] opened recovery DB in ${Date.now() - t0}ms total — primary may be corrupted`);
          return db;
        } catch (recoveryErr) {
          const ms3 = Date.now() - t0;
          console.error('[database] recovery DB also failed — giving up:', recoveryErr);
          void logger.error('database', `[DB_UNRECOVERABLE] recovery DB failed (${ms3}ms total, in-flight: ${_openInFlight}, API: ${Platform.Version}): ${fullErr(recoveryErr)}`);
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

let _diagLogged = false;

export async function logDbDiagnostics(): Promise<void> {
  if (_diagLogged) return;
  _diagLogged = true;
  try {
    const constants = Platform.constants as Record<string, unknown>;
    const api = Platform.Version;
    const release = String(constants.Release ?? constants.release ?? '?');
    const mfr = String(constants.Manufacturer ?? constants.manufacturer ?? '?');
    const model = String(constants.Model ?? constants.model ?? '?');

    let sqliteVer = '?';
    try {
      const handle = await getDb();
      if (handle) {
        const row = await handle.getFirstAsync<{ v: string }>('SELECT sqlite_version() AS v');
        if (row?.v) sqliteVer = row.v;
      }
    } catch {
      // Non-fatal
    }

    void logger.info(
      'database',
      `[DB_DIAG] API=${api} Android=${release} ${mfr} ${model} SQLite=${sqliteVer}`,
    );
  } catch (e) {
    void logger.warn('database', `[DB_DIAG] collection failed: ${String(e)}`);
  }
}