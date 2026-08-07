import { runWithDb, runWithDbOr } from './connection';
import type { Task } from '../types';
import { rowToTask } from './schema';

export async function dbGetAllTasks(): Promise<Task[]> {
  return runWithDbOr('dbGetAllTasks', [], async (database) => {
    const rows = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM tasks ORDER BY start_time ASC');
    return rows.map(rowToTask);
  });
}

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
    const localDate = new Date(dateISO);
    const day = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const rows = await database.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM tasks WHERE date(datetime(start_time, 'localtime')) = ? ORDER BY start_time ASC`,
      [day],
    );
    return rows.map(rowToTask);
  });
}

export async function dbInsertTask(task: Task): Promise<void> {
  return runWithDb('dbInsertTask', (database) => database.runAsync(
    `INSERT INTO tasks (id, title, description, start_time, end_time, duration_minutes, status, priority, tags, reminders, color, focus_mode, focus_allowed_packages, created_at, updated_at)
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
  return runWithDb('dbUpdateTask', (database) => database.runAsync(
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

export async function dbUpdateTasksBatch(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return;
  return runWithDb('dbUpdateTasksBatch', async (database) => {
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
  return runWithDb('dbDeleteTask', (database) =>
    database.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]).then(() => undefined),
  );
}