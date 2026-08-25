import { nanoid } from 'nanoid/non-secure';
import dayjs from 'dayjs';
import type { Task, TaskPriority, TaskStatus } from '@/data/types';

// ─── Task Factory ────────────────────────────────────────────────────────────

export function createTask(data: {
  title: string;
  description?: string;
  startTime: string;
  durationMinutes: number;
  priority?: TaskPriority;
  tags?: string[];
  color?: string;
  focusMode?: boolean;
  focusAllowedPackages?: string[];
}): Task {
  const start = dayjs(data.startTime);
  const end = start.add(data.durationMinutes, 'minute');

  return {
    id: nanoid(),
    title: data.title,
    description: data.description,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes: data.durationMinutes,
    status: 'scheduled',
    priority: data.priority ?? 'medium',
    tags: data.tags ?? [],
    reminders: [],
    color: data.color ?? '#6366f1',
    focusMode: data.focusMode ?? false,
    focusAllowedPackages: data.focusAllowedPackages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateTaskStatus(task: Task, status: TaskStatus): Task {
  return { ...task, status, updatedAt: new Date().toISOString() };
}

// ─── Extend a task and shift all subsequent tasks forward ────────────────────

export function extendTask(task: Task, extraMinutes: number): Task {
  const newEnd = dayjs(task.endTime).add(extraMinutes, 'minute');
  return {
    ...task,
    endTime: newEnd.toISOString(),
    durationMinutes: task.durationMinutes + extraMinutes,
    updatedAt: new Date().toISOString(),
  };
}

export function shiftTasksAfter(
  tasks: Task[],
  afterTask: Task,
  minutesShift: number,
): Task[] {
  return tasks.map((t) => {
    if (
      t.id !== afterTask.id &&
      t.status !== 'completed' &&
      t.status !== 'skipped' &&
      dayjs(t.startTime).isAfter(dayjs(afterTask.startTime))
    ) {
      return {
        ...t,
        startTime: dayjs(t.startTime).add(minutesShift, 'minute').toISOString(),
        endTime: dayjs(t.endTime).add(minutesShift, 'minute').toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getActiveTask(tasks: Task[]): Task | null {
  const now = dayjs();
  return (
    tasks.find(
      (t) =>
        t.status !== 'completed' &&
        t.status !== 'skipped' &&
        dayjs(t.startTime).isBefore(now) &&
        dayjs(t.endTime).isAfter(now),
    ) ?? null
  );
}

/**
 * Returns the task that has started but the user has NOT yet marked
 * complete/skipped — even if its scheduled end time has passed.
 *
 * This is the source of truth for the focus screen: tasks should not
 * silently disappear when their timer hits zero. Instead, the UI should
 * prompt the user to mark complete, extend, or skip.
 */
export function getCurrentTask(tasks: Task[]): Task | null {
  const now = dayjs();
  // Prefer a still-active (not yet ended) task, then fall back to the most
  // recent started-but-unresolved task whose end time has passed.
  const active = getActiveTask(tasks);
  if (active) return active;
  const ended = tasks
    .filter(
      (t) =>
        t.status !== 'completed' &&
        t.status !== 'skipped' &&
        dayjs(t.startTime).isBefore(now) &&
        dayjs(t.endTime).isBefore(now),
    )
    .sort((a, b) => dayjs(b.endTime).unix() - dayjs(a.endTime).unix());
  return ended[0] ?? null;
}

/**
 * Returns true if this task has run past its scheduled end without being
 * resolved (completed or skipped). The UI uses this to surface a decision prompt.
 */
export function isAwaitingDecision(task: Task): boolean {
  if (task.status === 'completed' || task.status === 'skipped') return false;
  return dayjs(task.endTime).isBefore(dayjs());
}

/**
 * Returns all currently active tasks (started, not yet ended, not resolved).
 * Used by the focus screen to show "+N more active" chip when overlapping
 * tasks exist.
 */
export function getAllActiveTasks(tasks: Task[]): Task[] {
  const now = dayjs();
  return tasks
    .filter(
      (t) =>
        t.status !== 'completed' &&
        t.status !== 'skipped' &&
        dayjs(t.startTime).isBefore(now) &&
        dayjs(t.endTime).isAfter(now),
    )
    .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix());
}

export function getUpcomingTask(tasks: Task[]): Task | null {
  const now = dayjs();
  return (
    [...tasks]
      .filter((t) => t.status === 'scheduled' && dayjs(t.startTime).isAfter(now))
      .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix())[0] ?? null
  );
}

export function getOverdueTasks(tasks: Task[]): Task[] {
  const now = dayjs();
  return tasks.filter(
    (t) =>
      t.status === 'scheduled' &&
      dayjs(t.endTime).isBefore(now),
  );
}

export function getTodayTasks(tasks: Task[]): Task[] {
  const startOfDay = dayjs().startOf('day');
  const endOfDay = dayjs().endOf('day');
  return tasks
    .filter((t) => {
      const s = dayjs(t.startTime);
      return s.valueOf() >= startOfDay.valueOf() && s.valueOf() <= endOfDay.valueOf();
    })
    .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix());
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatTime(isoString: string): string {
  return dayjs(isoString).format('h:mm A');
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getTimeUntilStart(isoString: string): string {
  const diff = dayjs(isoString).diff(dayjs(), 'minute');
  if (diff <= 0) return 'Now';
  if (diff < 60) return `in ${diff}m`;
  const hrs = Math.floor(diff / 60);
  const rem = diff % 60;
  return rem === 0 ? `in ${hrs}h` : `in ${hrs}h ${rem}m`;
}

export function getElapsedMinutes(startIso: string): number {
  return dayjs().diff(dayjs(startIso), 'minute');
}

export function getRemainingMinutes(endIso: string): number {
  return dayjs(endIso).diff(dayjs(), 'minute');
}
