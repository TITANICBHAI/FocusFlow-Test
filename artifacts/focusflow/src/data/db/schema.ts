import * as SQLite from 'expo-sqlite';
import { logger } from '@/services/startupLogger';
import type { Task, AppSettings, DailyAllowanceEntry } from '../types';

const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  darkMode: false, // will be set at runtime
  defaultDuration: 60,
  defaultReminderOffsets: [-10, -5, 0],
  focusModeEnabled: true,
  allowedInFocus: [],
  allowedAppPresets: [],
  blockPresets: [],
  pomodoroEnabled: false,
  pomodoroDuration: 25,
  pomodoroBreak: 5,
  notificationsEnabled: true,
  privacyAccepted: false,
  standaloneBlockPackages: [],
  standaloneBlockUntil: null,
  alwaysOnPackages: [],
  autoCopyToAlwaysOn: false,
  dailyAllowanceEntries: [],
  onboardingComplete: false,
  blockedWords: [],
  aversionDimmerEnabled: false,
  aversionVibrateEnabled: false,
  aversionSoundEnabled: false,
  weeklyReportEnabled: false,
  greyoutSchedule: [],
  systemGuardEnabled: false,
  blockInstallActionsEnabled: false,
  blockYoutubeShortsEnabled: false,
  blockInstagramReelsEnabled: false,
  keepFocusActiveUntilTaskEnd: false,
  recurringBlockSchedules: [],
  beginnerMode: true,
  tipsCardDismissed: false,
  alwaysOnEnforcementEnabled: false,
  lastShownStreakMilestone: 0,
  vpnBlockEnabled: false,
  vpnSelfHealEnabled: true,
  standaloneVpnPackages: [],
  launcherEnabled: false,
  launcherHiddenPackages: [],
  launcherPinnedPackages: [],
  launcherDockPackages: [],
  launcherWallpaperUri: null,
  launcherClockStyle: 'digital',
  launcherBlockUninstall: false,
  launcherLockDuringStandalone: true,
  overlayWallpaper: '',
  overlayQuotes: [],
};

export async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // ── WAL mode ────────────────────────────────────────────────────────────────
  try {
    await db.runAsync('PRAGMA journal_mode = WAL');
  } catch {
    // WAL not supported on this filesystem — continue with DELETE mode.
  }

  // ── Core tables ─────────────────────────────────────────────────────────────
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
      focus_allowed_packages TEXT,
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

  // Migration: add focus_allowed_packages column
  try {
    await db.runAsync('ALTER TABLE tasks ADD COLUMN focus_allowed_packages TEXT');
  } catch {
    // Column already exists — ignore.
  }

  // ── Indexes ──────────────────────────────────────────────────────────────
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_status_end ON tasks(status, end_time)');

  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_focus_sessions_is_active ON focus_sessions(is_active)');
}

/**
 * Applies every pending migration to a raw parsed settings blob.
 * Each `if (version < N)` block is idempotent and runs only once per blob.
 */
export function migrateSettings(
  raw: Partial<AppSettings> & { dailyAllowancePackages?: string[] },
): Partial<AppSettings> {
  let version = raw.schemaVersion ?? 0;

  // ── v0 → v1: dailyAllowancePackages: string[] → dailyAllowanceEntries ──────
  if (version < 1) {
    if (raw.dailyAllowancePackages && !raw.dailyAllowanceEntries) {
      raw.dailyAllowanceEntries = raw.dailyAllowancePackages.map((pkg): DailyAllowanceEntry => ({
        packageName: pkg,
        mode: 'count',
        countPerDay: 1,
        budgetMinutes: 30,
        intervalMinutes: 5,
        intervalHours: 1,
      }));
    }
    delete raw.dailyAllowancePackages;
    version = 1;
  }

  raw.schemaVersion = version;
  return raw;
}

export { DEFAULT_SETTINGS, CURRENT_SCHEMA_VERSION };

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(raw as string) as T;
  } catch {
    return fallback;
  }
}

export function rowToTask(row: Record<string, unknown>): Task {
  const rawFap = row.focus_allowed_packages as string | null | undefined;
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    durationMinutes: row.duration_minutes as number,
    status: (['scheduled', 'active', 'completed', 'skipped', 'overdue'].includes(row.status as string)
      ? row.status as Task['status']
      : 'scheduled'),
    priority: (['low', 'medium', 'high', 'critical'].includes(row.priority as string)
      ? row.priority as Task['priority']
      : 'medium'),
    tags: safeJsonParse<string[]>(row.tags, []),
    reminders: safeJsonParse<Task['reminders']>(row.reminders, []),
    color: row.color as string,
    focusMode: (row.focus_mode as number) === 1,
    focusAllowedPackages: rawFap ? safeJsonParse<string[]>(rawFap, []) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export { localDateString, parseLocalDate };