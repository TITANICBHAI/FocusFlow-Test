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
      return s.isAfter(startOfDay) && s.isBefore(endOfDay);
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

// ─── NLP-style quick input parser ────────────────────────────────────────────
// Parses strings like:
//   "Call Bob at 3pm for 30m"
//   "Meeting tomorrow 14:00 1h"
//   "Gym tonight for 45m"
//   "Review docs this morning"
//   "Stand-up in 15 minutes"
//   "Lunch 12:30 1h"

export interface ParsedTask {
  title: string;
  startTime?: string;
  durationMinutes: number;
}

export function parseQuickInput(input: string): ParsedTask {
  const now = dayjs();
  let title = input.trim();
  let startTime: string | undefined;
  let durationMinutes = 60;

  // ── Day offset keywords ─────────────────────────────────────────────────────
  // "tomorrow", "today" — shifts the base day for time parsing
  let dayOffset = 0;
  if (/\btomorrow\b/i.test(title)) {
    dayOffset = 1;
    title = title.replace(/\btomorrow\b/gi, '').trim();
  } else if (/\btoday\b/i.test(title)) {
    title = title.replace(/\btoday\b/gi, '').trim();
  }
  const baseDay = now.add(dayOffset, 'day');

  // ── "in X minutes/hours" ───────────────────────────────────────────────────
  // e.g. "in 30 minutes", "in 2 hours", "in 1h"
  const inRegex = /\bin\s+(\d+(?:\.\d+)?)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?)\b/i;
  const inMatch = title.match(inRegex);
  if (inMatch) {
    const val = parseFloat(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const addMins = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
    startTime = now.add(addMins, 'minute').second(0).millisecond(0).toISOString();
    title = title.replace(inMatch[0], '').trim();
  }

  // ── Named time-of-day keywords ─────────────────────────────────────────────
  // Only applied if no explicit time found yet
  if (!startTime) {
    const timeOfDayMap: Record<string, number> = {
      'morning':    8,
      'this morning': 8,
      'noon':       12,
      'lunch':      12,
      'afternoon':  14,
      'this afternoon': 14,
      'evening':    18,
      'this evening': 18,
      'tonight':    20,
      'night':      21,
      'midnight':   0,
    };
    for (const [keyword, hour] of Object.entries(timeOfDayMap)) {
      const re = new RegExp(`\\b${keyword}\\b`, 'i');
      if (re.test(title)) {
        startTime = baseDay.hour(hour).minute(0).second(0).millisecond(0).toISOString();
        title = title.replace(re, '').trim();
        break;
      }
    }
  }

  // ── Duration: "for 30m", "30min", "1h30m", "1.5h" ─────────────────────────
  // Must run before the bare-number time check to avoid ambiguity
  const durRegex = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?)\b/i;
  const durMatch = title.match(durRegex);
  if (durMatch) {
    const val = parseFloat(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    durationMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
    title = title.replace(durMatch[0], '').trim();
  }

  // ── Explicit time: "at 3pm", "at 14:00", "3:30pm", "9am", "14:30" ─────────
  if (!startTime) {
    // With "at" keyword
    const atTimeRegex = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const atMatch = title.match(atTimeRegex);
    if (atMatch) {
      let hour = parseInt(atMatch[1], 10);
      const min = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
      const meridiem = atMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      startTime = baseDay.hour(hour).minute(min).second(0).millisecond(0).toISOString();
      title = title.replace(atMatch[0], '').trim();
    } else {
      // Bare time: "9am", "3:30pm", "14:00" (must have am/pm OR colon for 24h)
      const bareTimeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/i;
      const bareMatch = title.match(bareTimeRegex);
      if (bareMatch) {
        let hour: number;
        let min = 0;
        if (bareMatch[3]) {
          // 12-hour format with am/pm
          hour = parseInt(bareMatch[1], 10);
          min = bareMatch[2] ? parseInt(bareMatch[2], 10) : 0;
          const meridiem = bareMatch[3].toLowerCase();
          if (meridiem === 'pm' && hour < 12) hour += 12;
          if (meridiem === 'am' && hour === 12) hour = 0;
        } else {
          // 24-hour format with colon
          hour = parseInt(bareMatch[4], 10);
          min = parseInt(bareMatch[5], 10);
        }
        startTime = baseDay.hour(hour).minute(min).second(0).millisecond(0).toISOString();
        title = title.replace(bareMatch[0], '').trim();
      }
    }
  }

  // ── Clean up leftover noise ─────────────────────────────────────────────────
  title = title
    .replace(/\bat\b/gi, '')
    .replace(/\bfor\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { title: title || 'New Task', startTime, durationMinutes };
}
