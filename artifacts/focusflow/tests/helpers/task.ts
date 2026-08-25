import type { Task, TaskPriority, TaskStatus } from '@/data/types';

export function task(
  id: string,
  startTime: string,
  endTime: string,
  options: Partial<Pick<Task, 'durationMinutes' | 'priority' | 'status' | 'title'>> = {},
): Task {
  return {
    id,
    title: options.title ?? id,
    startTime,
    endTime,
    durationMinutes: options.durationMinutes ?? 30,
    status: options.status ?? 'scheduled',
    priority: options.priority ?? 'medium',
    tags: [],
    reminders: [],
    color: '#6366f1',
    focusMode: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function typedTask(
  id: string,
  startTime: string,
  endTime: string,
  priority: TaskPriority,
  status: TaskStatus = 'scheduled',
): Task {
  return task(id, startTime, endTime, { priority, status });
}