/**
 * startupLogger.ts
 *
 * Timestamped, levelled log queue (INFO / WARN / ERROR).
 *
 * Concurrency contract:
 *   - All callers await `loadPromise` before touching `memoryLog`.
 *     The shared promise ensures the initial AsyncStorage read completes
 *     exactly once, and no entry is appended before history is restored.
 *   - All persist operations are funnelled through `persistChain`, a
 *     tail-chained Promise that serialises AsyncStorage + file writes so
 *     a newer snapshot never races and overwrites a slightly earlier one.
 *
 * Persistence strategy (two layers):
 *   1. AsyncStorage — fast, in-process, cleared on reinstall.
 *   2. File system  — `{documentDirectory}focusflow-boot.log`
 *      Rewrites the complete rotated log on every write (no append/overwrite
 *      ambiguity). Survives reinstalls on most platforms.
 *
 * Capped at MAX_ENTRIES (500) with auto-rotation (oldest entries dropped).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules, Platform } from 'react-native';

const STORAGE_KEY = 'focusflow_startup_log';
const LOG_FILENAME = 'focusflow-boot.log';
const MAX_ENTRIES = 500;

/**
 * Cached "is this a debuggable build?" flag — `__DEV__` alone is only true when
 * running through the Metro bundler. A debug-built APK with prebundled JS
 * reports false, which would silently hide all log output (and the Diagnostics
 * screen). We mirror the native ApplicationInfo.FLAG_DEBUGGABLE so the
 * developer surface stays available in true debug builds.
 */
let cachedDebuggable: boolean = __DEV__;
let debuggableProbed = false;
function probeDebuggable(): void {
  if (debuggableProbed || Platform.OS !== 'android') return;
  debuggableProbed = true;
  try {
    const mod = (NativeModules as Record<string, { isDebuggable?: () => Promise<boolean> }>).SharedPrefs;
    if (mod && typeof mod.isDebuggable === 'function') {
      void mod.isDebuggable().then((v) => { cachedDebuggable = Boolean(v) || __DEV__; }).catch(() => {});
    }
  } catch {
    // Non-fatal — keep the optimistic default.
  }
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: string;
  message: string;
}

let memoryLog: LogEntry[] = [];

/**
 * Shared load promise — all concurrent calls await the same promise so
 * the AsyncStorage read completes exactly once before any entry is appended.
 */
let loadPromise: Promise<void> | null = null;

/**
 * Serialised persist chain — each persist is tail-chained so writes
 * execute in order and a newer snapshot never overwrites a stale one.
 */
let persistChain: Promise<void> = Promise.resolve();

function logFilePath(): string | null {
  if (Platform.OS === 'web') return null;
  return (FileSystem.documentDirectory ?? '') + LOG_FILENAME;
}

function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LogEntry[];
        if (Array.isArray(parsed)) {
          memoryLog = parsed;
        }
      }
    } catch {
      memoryLog = [];
    }
  })();
  return loadPromise;
}

async function runPersist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryLog));
  } catch {
    // Non-fatal
  }
  const path = logFilePath();
  if (!path) return;
  try {
    const content = memoryLog
      .map((e) => `${e.ts} [${e.level}] [${e.tag}] ${e.message}`)
      .join('\n');
    await FileSystem.writeAsStringAsync(path, content);
  } catch {
    // Non-fatal
  }
}

function queuePersist(): void {
  persistChain = persistChain
    .then(() => runPersist())
    .catch(() => {});
}

function rotate(): void {
  if (memoryLog.length > MAX_ENTRIES) {
    memoryLog = memoryLog.slice(memoryLog.length - MAX_ENTRIES);
  }
}

// ─── Error subscriber system ─────────────────────────────────────────────────
// Any part of the app can call subscribeToErrors() to be notified the moment
// a logger.error() call fires — even in release builds. The DiagnosticsModal
// auto-open mechanism is built on top of this.

export type ErrorListener = (entry: LogEntry) => void;

const errorListeners = new Set<ErrorListener>();

/**
 * Register a callback that fires immediately whenever an ERROR entry is logged.
 * Works in both __DEV__ and release builds.
 * Returns an unsubscribe function.
 */
export function subscribeToErrors(fn: ErrorListener): () => void {
  errorListeners.add(fn);
  return () => { errorListeners.delete(fn); };
}

export async function log(level: LogLevel, tag: string, message: string): Promise<void> {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message,
  };

  // ERROR always fires listeners and hits adb logcat regardless of build type.
  if (level === 'ERROR') {
    console.error(`[ERROR][${tag}]`, message);
    for (const fn of errorListeners) {
      try { fn(entry); } catch { /* listener errors must never crash the logger */ }
    }
  }

  // `debuggable` is true for both the Metro bundler (__DEV__) AND for a
  // debug-signed APK with prebundled JS (cachedDebuggable, set via the native
  // SharedPrefs.isDebuggable() probe called eagerly at module init below).
  const debuggable = __DEV__ || cachedDebuggable;

  if (!debuggable) {
    // Production release: store WARN + ERROR in memory so DiagnosticsModal
    // can surface them; no disk / AsyncStorage persistence in this mode.
    if (level === 'ERROR' || level === 'WARN') {
      memoryLog.push(entry);
      rotate();
    }
    return;
  }

  // DEBUG entries: memory + console only — not persisted to disk (too noisy
  // for the rotating log file, but visible in the Diagnostics modal during a
  // live debug session).
  if (level === 'DEBUG') {
    console.log(`[DEBUG][${tag}]`, message);
    memoryLog.push(entry);
    rotate();
    return;
  }

  // Debuggable build (Metro or debug APK): full behaviour — restore history
  // from AsyncStorage, push, persist to AsyncStorage + log file, then console.
  await ensureLoaded();
  memoryLog.push(entry);
  rotate();
  queuePersist();

  const prefix = `[${level}][${tag}]`;
  if (level === 'WARN') console.warn(prefix, message);
  else if (level === 'INFO') console.log(prefix, message);
  // ERROR already logged unconditionally above — skip duplicate.
}

export const logger = {
  debug: (tag: string, message: string) => log('DEBUG', tag, message),
  info: (tag: string, message: string) => log('INFO', tag, message),
  warn: (tag: string, message: string) => log('WARN', tag, message),
  error: (tag: string, message: string) => log('ERROR', tag, message),
};

/**
 * Per-process boot session ID — generated lazily on first call to
 * `logBootMarker`. Subsequent calls within the same process reuse the
 * same ID so a single launch/restart is easy to grep for in the persisted
 * log file.
 */
let bootSessionId: string | null = null;

/**
 * True until the FIRST `logBootMarker()` call in this JS process.
 *
 * React Native's JS runtime is a new process every time the Android process
 * is killed and relaunched. A module-level boolean therefore acts as a
 * reliable process-birth detector:
 *   - true  → this is the first call since the OS created this process
 *             (genuine cold start — app was killed or installed fresh)
 *   - false → `logBootMarker` has already run in this process lifetime
 *             (warm resume — same process, AppContext re-initialised, e.g.
 *             React strict-mode double mount or forced JS reload)
 */
let _isNewProcess = true;

/**
 * Append a clearly-tagged boundary line at the start of every app launch.
 *
 *   - `[COLD_START …]` — first call in a fresh OS process AND no previous
 *     log entries exist. True first-ever launch or post-"Clear logs" cold boot.
 *   - `[NEW_PROCESS …]` — first call in a fresh OS process but previous
 *     log entries DO exist. The app was killed and relaunched; earlier
 *     sessions are preserved above this marker.
 *   - `[WARM_RESUME …]` — same OS process, AppContext re-initialised (e.g.
 *     React strict-mode double mount). The process was never killed.
 *
 * The marker also contains a session ID (e.g. `boot-l1c2k3m4`) that's
 * appended to every other log line in this process's output, making it
 * trivial to slice the log by session when sharing it.
 *
 * Call this once at the very top of AppContext.init(), before any other
 * logger.* call from app code, so the boundary lands above the rest of
 * this session's entries.
 */
export async function logBootMarker(): Promise<string> {
  if (!(__DEV__ || cachedDebuggable)) return '';
  await ensureLoaded();

  const isFirstCallInProcess = _isNewProcess;
  _isNewProcess = false; // all subsequent calls in this process are warm resumes

  const hasPreviousData = memoryLog.length > 0;
  bootSessionId = bootSessionId ?? `boot-${Date.now().toString(36)}`;

  let kind: string;
  if (isFirstCallInProcess && !hasPreviousData) {
    kind = `[COLD_START ${bootSessionId}] First session since install or last log clear`;
  } else if (isFirstCallInProcess && hasPreviousData) {
    kind = `[NEW_PROCESS ${bootSessionId}] App relaunched after kill — previous session(s) preserved above`;
  } else {
    kind = `[WARM_RESUME ${bootSessionId}] AppContext re-initialised within the same process`;
  }

  await log('INFO', 'startupLogger', kind);
  return bootSessionId;
}

/**
 * Returns the boot session ID for the current process, or null if
 * `logBootMarker` hasn't run yet.
 */
export function getBootSessionId(): string | null {
  if (!(__DEV__ || cachedDebuggable)) return null;
  return bootSessionId;
}

/** Return last N entries from the in-memory log (most recent last). */
export async function getRecentLogs(n = 100): Promise<LogEntry[]> {
  if (!(__DEV__ || cachedDebuggable)) {
    return memoryLog.slice(-n);
  }
  await ensureLoaded();
  return memoryLog.slice(-n);
}

/** Return all log entries from the in-memory log. */
export async function getAllLogs(): Promise<LogEntry[]> {
  if (!(__DEV__ || cachedDebuggable)) {
    return [...memoryLog];
  }
  await ensureLoaded();
  return [...memoryLog];
}

/** Clear all logs from memory, AsyncStorage, and the log file. */
export function clearLogs(): Promise<void> {
  if (!(__DEV__ || cachedDebuggable)) {
    memoryLog = [];
    return Promise.resolve();
  }
  persistChain = persistChain
    .then(async () => {
      memoryLog = [];
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      const path = logFilePath();
      if (path) {
        try {
          await FileSystem.deleteAsync(path, { idempotent: true });
        } catch {
          // ignore
        }
      }
    })
    .catch(() => {});
  return persistChain;
}

/** Format all logs as a plain-text string suitable for sharing. */
export async function formatLogsForShare(): Promise<string> {
  const debuggable = __DEV__ || cachedDebuggable;
  if (!debuggable) {
    const header = `FocusFlow Diagnostic Log — ${new Date().toISOString()}\n${'─'.repeat(60)}\n`;
    const body = memoryLog
      .map((e) => `${e.ts} [${e.level}] [${e.tag}] ${e.message}`)
      .join('\n');
    return header + (body || '(no WARN/ERROR entries recorded this session)');
  }
  await ensureLoaded();
  const header = `FocusFlow Startup Log — ${new Date().toISOString()}\n${'─'.repeat(60)}\n`;
  const body = memoryLog
    .map((e) => `${e.ts} [${e.level}] [${e.tag}] ${e.message}`)
    .join('\n');
  return header + body;
}

/** Returns the path to the persistent log file (for sharing via expo-sharing). */
export function getLogFilePath(): string | null {
  if (!(__DEV__ || cachedDebuggable)) return null;
  return logFilePath();
}

// ─── Module init ─────────────────────────────────────────────────────────────
// Probe the native "isDebuggable" flag eagerly so that by the time the first
// DB or service log entry fires, cachedDebuggable is already set for debug
// APKs (where __DEV__ is false but ApplicationInfo.FLAG_DEBUGGABLE is true).
// This ensures debug APK builds get full logging behaviour from the very first
// log entry, not just after the first probeDebuggable() callback resolves.
void probeDebuggable();
