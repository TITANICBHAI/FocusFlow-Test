/**
 * Scheduler Engine — The core brain.
 *
 * Handles:
 *  - Time conflict detection & resolution
 *  - Priority-based task shifting (skip low, ask for critical)
 *  - Task splitting for overruns
 *  - Schedule rebalancing after extend/skip/complete
 *  - Overlap prevention on task creation
 */

import dayjs from 'dayjs';
import type { Task, TaskPriority } from '@/data/types';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{ task: Task; overlapMinutes: number }>;
}

export interface RebalanceResult {
  updatedTasks: Task[];
  skipped: Task[];       // low-priority tasks that got dropped to fit
  shifted: Task[];       // tasks that were moved forward
  needsUserConfirm: Task[]; // critical tasks that couldn't be auto-resolved
}

export interface OverrunResult {
  updatedSchedule: Task[];
  skipped: Task[];
  shifted: Task[];
  needsUserConfirm: Task[];
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

export function detectConflicts(newTask: Task, existingTasks: Task[]): ConflictResult {
  const conflicts: ConflictResult['conflicts'] = [];
  const newStart = dayjs(newTask.startTime);
  const newEnd = dayjs(newTask.endTime);

  for (const task of existingTasks) {
    if (task.id === newTask.id) continue;
    if (task.status === 'completed' || task.status === 'skipped') continue;

    const taskStart = dayjs(task.startTime);
    const taskEnd = dayjs(task.endTime);

    // Overlap: newTask starts before existing ends AND ends after existing starts
    const overlapStart = newStart.isAfter(taskStart) ? newStart : taskStart;
    const overlapEnd = newEnd.isBefore(taskEnd) ? newEnd : taskEnd;
    const overlapMs = overlapEnd.diff(overlapStart, 'minute');

    if (overlapMs > 0) {
      conflicts.push({ task, overlapMinutes: overlapMs });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

// ─── Find next available slot ─────────────────────────────────────────────────

export function findNextAvailableSlot(
  durationMinutes: number,
  afterTime: string,
  tasks: Task[],
  bufferMinutes = 5,
): string {
  let candidate = dayjs(afterTime);
  const candidateEnd = candidate.add(durationMinutes, 'minute');

  const activeTasks = tasks
    .filter((t) => t.status !== 'completed' && t.status !== 'skipped')
    .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix());

  for (let attempt = 0; attempt < 50; attempt++) {
    let conflict = false;

    for (const task of activeTasks) {
      const taskStart = dayjs(task.startTime);
      const taskEnd = dayjs(task.endTime);
      const slotEnd = candidate.add(durationMinutes, 'minute');

      const overlaps =
        candidate.isBefore(taskEnd) && slotEnd.isAfter(taskStart);

      if (overlaps) {
        candidate = taskEnd.add(bufferMinutes, 'minute');
        conflict = true;
        break;
      }
    }

    if (!conflict) break;
  }

  return candidate.toISOString();
}

// ─── Rebalance after overrun ──────────────────────────────────────────────────
//
// Called when a task exceeds its scheduled end time.
// Logic:
//   1. Calculate overrun delta
//   2. For each subsequent task (in order):
//      - If CRITICAL → add to needsUserConfirm (don't auto-skip)
//      - If HIGH → shift forward
//      - If MEDIUM → shift forward if within 30-min buffer, else ask
//      - If LOW → auto-skip if needed to fit critical ones
//   3. Return all changes so the caller can batch-update DB

export function rebalanceAfterOverrun(
  overrunTask: Task,
  overrunMinutes: number,
  allTasks: Task[],
  options: { maxAutoShiftMinutes?: number } = {},
): OverrunResult {
  const { maxAutoShiftMinutes = 60 } = options;

  const updatedSchedule: Task[] = [];
  const skipped: Task[] = [];
  const shifted: Task[] = [];
  const needsUserConfirm: Task[] = [];

  // Sort all tasks after overrunTask by start time
  const subsequent = allTasks
    .filter(
      (t) =>
        t.id !== overrunTask.id &&
        t.status !== 'completed' &&
        t.status !== 'skipped' &&
        dayjs(t.startTime).isAfter(dayjs(overrunTask.startTime)),
    )
    .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix());

  let cumulativeShift = overrunMinutes;

  for (const task of subsequent) {
    const priority = PRIORITY_RANK[task.priority];

    if (cumulativeShift <= 0) {
      // No more shifting needed
      updatedSchedule.push(task);
      continue;
    }

    if (priority === PRIORITY_RANK.critical) {
      // Never auto-skip critical tasks — ask user
      needsUserConfirm.push(task);
      updatedSchedule.push(task); // keep in place for now
      continue;
    }

    if (cumulativeShift > maxAutoShiftMinutes && priority <= PRIORITY_RANK.medium) {
      // Overrun is too large — skip low/medium to protect schedule
      const skippedTask: Task = {
        ...task,
        status: 'skipped',
        updatedAt: new Date().toISOString(),
      };
      skipped.push(skippedTask);
      updatedSchedule.push(skippedTask);
      cumulativeShift -= task.durationMinutes; // freed up time
      continue;
    }

    // Shift task forward
    const newStart = dayjs(task.startTime).add(cumulativeShift, 'minute');
    const newEnd = dayjs(task.endTime).add(cumulativeShift, 'minute');
    const shiftedTask: Task = {
      ...task,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      updatedAt: new Date().toISOString(),
    };
    shifted.push(shiftedTask);
    updatedSchedule.push(shiftedTask);
  }

  return { updatedSchedule, skipped, shifted, needsUserConfirm };
}

// ─── Insert task without conflicts ───────────────────────────────────────────
// Finds a clean slot and shifts lower-priority tasks if needed.

export function insertTaskSafe(
  newTask: Task,
  existingTasks: Task[],
): { task: Task; shifted: Task[] } {
  const { hasConflict, conflicts } = detectConflicts(newTask, existingTasks);

  if (!hasConflict) {
    return { task: newTask, shifted: [] };
  }

  const shifted: Task[] = [];

  // For each conflicting task that has LOWER priority — shift it after newTask
  for (const { task: conflictingTask } of conflicts) {
    if (PRIORITY_RANK[conflictingTask.priority] < PRIORITY_RANK[newTask.priority]) {
      const newStart = dayjs(newTask.endTime).add(5, 'minute');
      const durationMs = dayjs(conflictingTask.endTime).diff(dayjs(conflictingTask.startTime), 'minute');
      shifted.push({
        ...conflictingTask,
        startTime: newStart.toISOString(),
        endTime: newStart.add(durationMs, 'minute').toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    // If conflicting task has SAME or HIGHER priority, the caller must resolve
  }

  return { task: newTask, shifted };
}

// ─── Compress gaps in schedule ────────────────────────────────────────────────
// If a task is skipped/completed early, pull subsequent tasks forward.

export function compressSchedule(
  completedTask: Task,
  completedAt: string,
  allTasks: Task[],
): Task[] {
  const actualEnd = dayjs(completedAt);
  const plannedEnd = dayjs(completedTask.endTime);

  if (!actualEnd.isBefore(plannedEnd)) return allTasks; // no early finish

  const savedMinutes = plannedEnd.diff(actualEnd, 'minute');

  return allTasks.map((t) => {
    if (
      t.id === completedTask.id ||
      t.status === 'completed' ||
      t.status === 'skipped' ||
      !dayjs(t.startTime).isAfter(plannedEnd)
    ) {
      return t;
    }
    return {
      ...t,
      startTime: dayjs(t.startTime).subtract(savedMinutes, 'minute').toISOString(),
      endTime: dayjs(t.endTime).subtract(savedMinutes, 'minute').toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

// ─── Detect tasks left unfinished (for app restart recovery) ─────────────────

export function getUnfinishedOverdueTasks(tasks: Task[]): Task[] {
  const now = dayjs();
  return tasks.filter(
    (t) =>
      t.status === 'scheduled' &&
      dayjs(t.endTime).isBefore(now) &&
      dayjs(t.endTime).isAfter(now.subtract(4, 'hour')), // only last 4 hours
  );
}

// ─── Validate a day's schedule for gaps/overlaps ─────────────────────────────

export interface ScheduleHealth {
  overlaps: Array<{ a: Task; b: Task }>;
  gaps: Array<{ afterTask: Task; gapMinutes: number }>;
  totalScheduledMinutes: number;
  overloadedHours: string[]; // hours with > 60 min scheduled
}

export function analyzeScheduleHealth(tasks: Task[]): ScheduleHealth {
  const sorted = [...tasks]
    .filter((t) => t.status !== 'skipped')
    .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix());

  const overlaps: ScheduleHealth['overlaps'] = [];
  const gaps: ScheduleHealth['gaps'] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];

    const aEnd = dayjs(a.endTime);
    const bStart = dayjs(b.startTime);

    if (bStart.isBefore(aEnd)) {
      overlaps.push({ a, b });
    } else {
      const gapMinutes = bStart.diff(aEnd, 'minute');
      if (gapMinutes > 15) {
        gaps.push({ afterTask: a, gapMinutes });
      }
    }
  }

  const totalScheduledMinutes = tasks.reduce((s, t) => s + t.durationMinutes, 0);

  // Check hour-by-hour overload — distribute only actual minutes per hour
  // Slot boundaries are anchored to the task's calendar-day midnight so that
  // multi-hour tasks spanning several hours compute correct per-hour minutes.
  const hourLoad: Record<number, number> = {};
  for (const task of tasks) {
    const taskStart = dayjs(task.startTime);
    const taskEnd = dayjs(task.endTime);
    const dayBase = taskStart.startOf('day');
    const startHour = taskStart.hour();
    const endHour = taskEnd.hour();
    for (let h = startHour; h <= endHour; h++) {
      const hourStart = dayBase.hour(h).minute(0).second(0);
      const hourEnd = dayBase.hour(h).minute(59).second(59);
      const slotStart = taskStart.isAfter(hourStart) ? taskStart : hourStart;
      const slotEnd = taskEnd.isBefore(hourEnd) ? taskEnd : hourEnd;
      const mins = Math.max(0, slotEnd.diff(slotStart, 'minute'));
      hourLoad[h] = (hourLoad[h] ?? 0) + mins;
    }
  }
  const overloadedHours = Object.entries(hourLoad)
    .filter(([, mins]) => mins > 60)
    .map(([h]) => `${h}:00`);

  return { overlaps, gaps, totalScheduledMinutes, overloadedHours };
}
