import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTask,
  extendTask,
  getActiveTask,
  getCurrentTask,
  getOverdueTasks,
  shiftTasksAfter,
  updateTaskStatus,
} from '@/services/taskService';
import { task } from '../helpers/task';

describe('taskService task lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a scheduled task with FocusFlow defaults and a calculated end', () => {
    vi.setSystemTime(new Date('2026-08-24T10:00:00.000Z'));

    const created = createTask({
      title: 'Deep work',
      startTime: '2026-08-24T11:00:00.000Z',
      durationMinutes: 45,
    });

    expect(created.title).toBe('Deep work');
    expect(created.startTime).toBe('2026-08-24T11:00:00.000Z');
    expect(created.endTime).toBe('2026-08-24T11:45:00.000Z');
    expect(created.durationMinutes).toBe(45);
    expect(created.status).toBe('scheduled');
    expect(created.priority).toBe('medium');
    expect(created.color).toBe('#6366f1');
    expect(created.tags).toEqual([]);
    expect(created.reminders).toEqual([]);
    expect(created.focusMode).toBe(false);
    expect(created.id).toEqual(expect.any(String));
    expect(created.createdAt).toBe('2026-08-24T10:00:00.000Z');
  });

  it('updates only status and updatedAt when resolving a task', () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const original = task('task-1', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z', {
      title: 'Keep metadata',
      durationMinutes: 60,
    });

    const updated = updateTaskStatus(original, 'completed');

    expect(updated).toMatchObject({
      ...original,
      status: 'completed',
      updatedAt: '2026-08-24T12:00:00.000Z',
    });
    expect(updated.updatedAt).toBe('2026-08-24T12:00:00.000Z');
    expect(original.status).toBe('scheduled');
  });

  it('extends a task without changing its start', () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const original = task('task-1', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z', {
      durationMinutes: 60,
    });

    const extended = extendTask(original, 20);

    expect(extended.startTime).toBe(original.startTime);
    expect(extended.endTime).toBe('2026-08-24T10:20:00.000Z');
    expect(extended.durationMinutes).toBe(80);
    expect(original.endTime).toBe('2026-08-24T10:00:00.000Z');
  });

  it('selects the active task and ignores completed or skipped tasks', () => {
    vi.setSystemTime(new Date('2026-08-24T10:30:00.000Z'));
    const completed = task('done', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', {
      status: 'completed',
    });
    const active = task('active', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z');
    const skipped = task('skipped', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', {
      status: 'skipped',
    });

    expect(getActiveTask([completed, skipped, active])?.id).toBe('active');
  });

  it('returns the most recently ended unresolved task when no task is active', () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const older = task('older', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z');
    const newer = task('newer', '2026-08-24T10:00:00.000Z', '2026-08-24T11:30:00.000Z');
    const resolved = task('resolved', '2026-08-24T10:30:00.000Z', '2026-08-24T11:45:00.000Z', {
      status: 'completed',
    });

    expect(getCurrentTask([older, newer, resolved])?.id).toBe('newer');
    expect(getOverdueTasks([older, newer, resolved]).map(({ id }) => id)).toEqual(['older', 'newer']);
  });

  it('shifts only later unresolved tasks and preserves earlier task identity', () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const anchor = task('anchor', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z');
    const later = task('later', '2026-08-24T11:00:00.000Z', '2026-08-24T12:00:00.000Z');
    const completed = task('done', '2026-08-24T11:30:00.000Z', '2026-08-24T12:30:00.000Z', {
      status: 'completed',
    });

    const shifted = shiftTasksAfter([anchor, later, completed], anchor, 15);

    expect(shifted[0]).toBe(anchor);
    expect(shifted[1].startTime).toBe('2026-08-24T11:15:00.000Z');
    expect(shifted[1].endTime).toBe('2026-08-24T12:15:00.000Z');
    expect(shifted[2]).toBe(completed);
  });
});