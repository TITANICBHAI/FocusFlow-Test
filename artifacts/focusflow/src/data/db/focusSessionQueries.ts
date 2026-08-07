import { runWithDb, runWithDbOr } from './connection';
import type { FocusSession, DailyAllowanceEntry } from '../types';
import { safeJsonParse } from './schema';

export async function dbStartFocusSession(session: FocusSession): Promise<void> {
  return runWithDb('dbStartFocusSession', (database) => database.runAsync(
    `INSERT INTO focus_sessions (task_id, started_at, is_active, allowed_packages) VALUES (?, ?, 1, ?)`,
    [session.taskId, session.startedAt, JSON.stringify(session.allowedPackages)],
  ).then(() => undefined));
}

export async function dbEndFocusSession(taskId: string): Promise<void> {
  return runWithDb('dbEndFocusSession', (database) => database.runAsync(
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

export async function dbLogFocusOverride(taskId: string, appName: string, reason?: string): Promise<void> {
  try {
    await runWithDb('dbLogFocusOverride', (database) => database.runAsync(
      `INSERT INTO focus_overrides (task_id, app_name, overridden_at, reason) VALUES (?, ?, ?, ?)`,
      [taskId, appName, new Date().toISOString(), reason ?? null],
    ).then(() => undefined));
  } catch (e) {
    // void logger.error('database', `dbLogFocusOverride failed: ${String(e)}`);
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