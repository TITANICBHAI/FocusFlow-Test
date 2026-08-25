import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  definedTasks,
  dbGetTasksForDate,
  dbUpdateTask,
  dbUpdateTasksBatch,
  dbGetSettings,
  cancelTaskReminders,
  scheduleTaskRemindersBatch,
  fireLateStartWarning,
  dismissPersistentNotification,
  scheduleMorningDigest,
  navigateToTask,
  currentState,
  registerNotificationTask,
  registerFetchTask,
} = vi.hoisted(() => ({
  definedTasks: new Map<string, (input?: any) => Promise<any>>(),
  dbGetTasksForDate: vi.fn(),
  dbUpdateTask: vi.fn(),
  dbUpdateTasksBatch: vi.fn(),
  dbGetSettings: vi.fn(),
  cancelTaskReminders: vi.fn(),
  scheduleTaskRemindersBatch: vi.fn(),
  fireLateStartWarning: vi.fn(),
  dismissPersistentNotification: vi.fn(),
  scheduleMorningDigest: vi.fn(),
  navigateToTask: vi.fn(),
  currentState: { value: 'background' as string },
  registerNotificationTask: vi.fn(),
  registerFetchTask: vi.fn(),
}));

vi.mock('expo-task-manager', () => ({
  defineTask: (name: string, handler: (input?: any) => Promise<any>) => {
    definedTasks.set(name, handler);
  },
}));

vi.mock('expo-background-fetch', () => ({
  BackgroundFetchResult: { NewData: 'new-data', NoData: 'no-data', Failed: 'failed' },
  BackgroundFetchStatus: { Restricted: 'restricted', Denied: 'denied' },
  getStatusAsync: vi.fn(),
  registerTaskAsync: registerFetchTask,
}));

vi.mock('expo-notifications', () => ({
  registerTaskAsync: registerNotificationTask,
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return currentState.value;
    },
  },
}));

vi.mock('@/data/database', () => ({
  dbGetTasksForDate,
  dbUpdateTask,
  dbUpdateTasksBatch,
  dbGetSettings,
}));

vi.mock('@/services/notificationService', () => ({
  cancelTaskReminders,
  scheduleTaskRemindersBatch,
  fireLateStartWarning,
  dismissPersistentNotification,
  scheduleMorningDigest,
}));

vi.mock('@/services/taskService', () => ({
  extendTask: (task: any, minutes: number) => ({
    ...task,
    endTime: new Date(new Date(task.endTime).getTime() + minutes * 60_000).toISOString(),
    durationMinutes: task.durationMinutes + minutes,
    updatedAt: new Date().toISOString(),
  }),
}));

vi.mock('@/navigation/navigationRef', () => ({ navigateToTask }));
vi.mock('@/services/startupLogger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

import {
  TASK_BACKGROUND_FETCH,
  TASK_NOTIFICATION_BG,
  TASK_OVERRUN_CHECK,
  registerBackgroundFetch,
  registerOverrunCheckTask,
} from '@/tasks/backgroundTasks';
import { task } from '../helpers/task';

describe('headless background task handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T20:30:00.000Z'));
    vi.clearAllMocks();
    currentState.value = 'background';
    dbGetTasksForDate.mockResolvedValue([]);
    dbUpdateTask.mockResolvedValue(undefined);
    dbUpdateTasksBatch.mockResolvedValue(undefined);
    dbGetSettings.mockResolvedValue({ userProfile: undefined });
    cancelTaskReminders.mockResolvedValue(undefined);
    scheduleTaskRemindersBatch.mockResolvedValue(undefined);
    fireLateStartWarning.mockResolvedValue(undefined);
    dismissPersistentNotification.mockResolvedValue(undefined);
    scheduleMorningDigest.mockResolvedValue(undefined);
  });

  it('ignores malformed or already-resolved overrun deliveries', async () => {
    const handler = definedTasks.get(TASK_OVERRUN_CHECK)!;
    const done = task(
      'done',
      '2026-08-24T18:00:00.000Z',
      '2026-08-24T19:00:00.000Z',
      { status: 'completed' },
    );
    dbGetTasksForDate.mockResolvedValue([done]);

    await handler({ data: { notification: { request: { content: { data: {} } } } } });
    await handler({
      data: {
        notification: {
          request: { content: { data: { type: 'OVERRUN_CHECK', taskId: 'missing' } } },
        },
      },
    });
    await handler({
      data: {
        notification: {
          request: { content: { data: { type: 'OVERRUN_CHECK', taskId: 'done' } } },
        },
      },
    });

    expect(dbUpdateTasksBatch).not.toHaveBeenCalled();
    expect(scheduleTaskRemindersBatch).not.toHaveBeenCalled();
  });

  it('persists an overrun extension and the resulting shifted schedule together', async () => {
    const overrun = task(
      'focus',
      '2026-08-24T18:00:00.000Z',
      '2026-08-24T19:00:00.000Z',
      { title: 'Focus', durationMinutes: 60 },
    );
    const following = task(
      'next',
      '2026-08-24T19:00:00.000Z',
      '2026-08-24T19:30:00.000Z',
      { title: 'Next', durationMinutes: 30, priority: 'high' },
    );
    dbGetTasksForDate.mockResolvedValue([overrun, following]);

    await definedTasks.get(TASK_OVERRUN_CHECK)!({
      data: {
        notification: {
          request: { content: { data: { type: 'OVERRUN_CHECK', taskId: 'focus' } } },
        },
      },
    });

    expect(dbUpdateTasksBatch).toHaveBeenCalledOnce();
    const persisted = dbUpdateTasksBatch.mock.calls[0][0];
    expect(persisted.map((item: any) => item.id)).toEqual(['focus', 'next']);
    expect(persisted[0].endTime).toBe('2026-08-24T19:10:00.000Z');
    expect(persisted[1].startTime).toBe('2026-08-24T19:10:00.000Z');
    expect(persisted[1].endTime).toBe('2026-08-24T19:40:00.000Z');
    expect(scheduleTaskRemindersBatch).toHaveBeenCalledWith(persisted);
  });

  it('re-arms upcoming tasks, warns only for tasks three to fifteen minutes late, and returns new data', async () => {
    const late = task(
      'late',
      '2026-08-24T20:20:00.000Z',
      '2026-08-24T21:00:00.000Z',
    );
    const upcoming = task(
      'upcoming',
      '2026-08-24T21:00:00.000Z',
      '2026-08-24T21:30:00.000Z',
    );
    const overdue = task(
      'overdue',
      '2026-08-24T18:00:00.000Z',
      '2026-08-24T19:00:00.000Z',
    );
    const completed = task(
      'completed',
      '2026-08-24T20:00:00.000Z',
      '2026-08-24T21:00:00.000Z',
      { status: 'completed' },
    );
    dbGetTasksForDate.mockResolvedValue([late, upcoming, overdue, completed]);

    const result = await definedTasks.get(TASK_BACKGROUND_FETCH)!();

    expect(fireLateStartWarning).toHaveBeenCalledWith(late, 10);
    expect(scheduleTaskRemindersBatch).toHaveBeenCalledWith([upcoming]);
    expect(result).toBe('new-data');
  });

  it('does not let the headless notification task compete with the foreground listener', async () => {
    currentState.value = 'active';

    await definedTasks.get(TASK_NOTIFICATION_BG)!({
      data: {
        actionIdentifier: 'COMPLETE',
        notification: { request: { content: { data: { taskId: 'task-1' } } } },
      },
    });

    expect(dbGetTasksForDate).not.toHaveBeenCalled();
    expect(dbUpdateTask).not.toHaveBeenCalled();
  });

  it('completes, cancels, or navigates background notification actions', async () => {
    const current = task(
      'task-1',
      '2026-08-24T19:00:00.000Z',
      '2026-08-24T20:00:00.000Z',
    );
    dbGetTasksForDate.mockResolvedValue([current]);
    const handler = definedTasks.get(TASK_NOTIFICATION_BG)!;

    expect(currentState.value).toBe('background');
    await handler({
      data: {
        actionIdentifier: 'COMPLETE',
        notification: { request: { content: { data: { taskId: 'task-1' } } } },
      },
    });
    expect(dbUpdateTask).toHaveBeenCalledWith({ ...current, status: 'completed' });
    expect(cancelTaskReminders).toHaveBeenCalledWith('task-1');

    vi.clearAllMocks();
    dbGetTasksForDate.mockResolvedValue([current]);
    await handler({
      data: {
        actionIdentifier: 'VIEW',
        notification: { request: { content: { data: { taskId: 'task-1' } } } },
      },
    });
    expect(navigateToTask).toHaveBeenCalledWith('task-1');
    expect(dbUpdateTask).not.toHaveBeenCalled();
  });

  it('registers the OS tasks with the documented identifiers', async () => {
    await registerOverrunCheckTask();
    await registerBackgroundFetch();

    expect(registerNotificationTask).toHaveBeenCalledWith(TASK_OVERRUN_CHECK);
    expect(registerFetchTask).toHaveBeenCalledWith(
      TASK_BACKGROUND_FETCH,
      expect.objectContaining({ minimumInterval: 900 }),
    );
  });
});