import { runWithDb, runWithDbOr } from './connection';
import { localDateString, parseLocalDate } from './schema';

export async function dbRecordDayCompletion(completed: number, total: number): Promise<void> {
  try {
    await runWithDb('dbRecordDayCompletion', (database) => {
      const date = localDateString(new Date());
      return database.runAsync(
        `INSERT OR REPLACE INTO daily_completions (date, completed, total) VALUES (?, ?, ?)`,
        [date, completed, total],
      ).then(() => undefined);
    });
  } catch (e) {
    // void logger.error('database', `dbRecordDayCompletion failed: ${String(e)}`);
  }
}

export async function dbBackfillDayCompletions(daysBack: number = 30): Promise<void> {
  try {
    await runWithDb('dbBackfillDayCompletions', async (database) => {
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
    // void logger.error('database', `dbBackfillDayCompletions failed: ${String(e)}`);
  }
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
      const rowDate = parseLocalDate(row.date);
      const diffDays = Math.round((checkDate.getTime() - rowDate.getTime()) / 86400000);
      if (diffDays > 1) break;
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

export async function dbGetAllTimeFocusSessions(): Promise<number> {
  return runWithDbOr('dbGetAllTimeFocusSessions', 0, async (database) => {
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM focus_sessions WHERE is_active = 0`,
    );
    return row?.count ?? 0;
  });
}

export async function dbGetBestStreak(): Promise<number> {
  return runWithDbOr('dbGetBestStreak', 0, async (database) => {
    const rows = await database.getAllAsync<{ date: string; completed: number; total: number }>(
      `SELECT date, completed, total FROM daily_completions ORDER BY date ASC`,
    );
    let best = 0;
    let current = 0;
    let prevDate: Date | null = null;

    for (const row of rows) {
      const rowDate = parseLocalDate(row.date);
      if (prevDate) {
        const diff = Math.round((rowDate.getTime() - prevDate.getTime()) / 86400000);
        if (diff === 1 && row.total > 0 && row.completed / row.total >= 0.5) {
          current++;
        } else {
          current = 0;
        }
      } else if (row.total > 0 && row.completed / row.total >= 0.5) {
        current = 1;
      }
      best = Math.max(best, current);
      prevDate = rowDate;
    }
    return best;
  });
}

export async function dbPruneOldData(daysToKeep = 90): Promise<void> {
  return runWithDbOr('dbPruneOldData', undefined, async (database) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffIso = cutoff.toISOString();
    const cutoffDate = cutoffIso.slice(0, 10);
    await database.runAsync(
      `DELETE FROM focus_sessions WHERE is_active = 0 AND ended_at IS NOT NULL AND ended_at < ?`,
      [cutoffIso],
    );
    await database.runAsync(
      `DELETE FROM daily_completions WHERE date < ?`,
      [cutoffDate],
    );
    const taskCutoff = new Date();
    taskCutoff.setDate(taskCutoff.getDate() - 365);
    await database.runAsync(
      `DELETE FROM tasks WHERE status IN ('completed', 'skipped') AND end_time < ?`,
      [taskCutoff.toISOString()],
    );
  });
}

export async function dbDeleteAllTasks(): Promise<void> {
  return runWithDb('dbDeleteAllTasks', (database) =>
    database.runAsync('DELETE FROM tasks').then(() => undefined),
  );
}

export async function dbCheckpointWal(): Promise<void> {
  try {
    await runWithDb('dbCheckpointWal', async (database) => {
      await database.execAsync('PRAGMA wal_checkpoint(FULL);');
    });
  } catch (e) {
    // void logger.warn('database', `WAL checkpoint failed (non-fatal): ${String(e)}`);
  }
}