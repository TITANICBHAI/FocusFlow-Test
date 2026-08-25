import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  getAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  scheduleAlarm,
  cancelAlarm,
} = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  scheduleAlarm: vi.fn(),
  cancelAlarm: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  getAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync,
}));

vi.mock('@/native-modules/TaskAlarmModule', () => ({
  TaskAlarmModule: { scheduleAlarm, cancelAlarm },
}));

import {
  cancelTaskReminders,
  scheduleTaskReminders,
  scheduleTaskRemindersBatch,
  setupNotificationChannels,
} from '@/services/notificationService';
import { task } from '../helpers/task';

describe('notificationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));
    vi.clearAllMocks();
    getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    setNotificationChannelAsync.mockResolvedValue(undefined);
    getAllScheduledNotificationsAsync.mockResolvedValue([]);
    cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    scheduleNotificationAsync.mockImplementation(async ({ identifier }: { identifier: string }) => identifier);
    scheduleAlarm.mockResolvedValue(true);
    cancelAlarm.mockResolvedValue(undefined);
  });

  it('configures all Android notification channels', async () => {
    await setupNotificationChannels();

    expect(setNotificationChannelAsync).toHaveBeenCalledTimes(3);
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'task-reminders',
      expect.objectContaining({ name: 'Task Reminders' }),
    );
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'morning-digest',
      expect.objectContaining({ name: 'Morning Digest' }),
    );
    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'weekly-report',
      expect.objectContaining({ name: 'Weekly Report' }),
    );
  });

  it('schedules future reminders and the native end-time alarm', async () => {
    const focusTask = task(
      'task-1',
      '2026-08-24T09:00:00.000Z',
      '2026-08-24T11:00:00.000Z',
      { title: 'Deep work', durationMinutes: 120 },
    );

    await scheduleTaskReminders(focusTask);

    const scheduledIds = scheduleNotificationAsync.mock.calls.map(
      (call: any[]) => call[0].identifier as string,
    );
    expect(scheduledIds).toEqual([
      'task-1-pre-600000',
      'task-1-pre-300000',
      'task-1-pre-60000',
      'task-1-pre0',
      'task-1-mid900000',
      'task-1-mid1800000',
      'task-1-almost',
      'task-1-end',
    ]);
    expect(scheduleAlarm).toHaveBeenCalledWith(
      'task-1',
      'Deep work',
      new Date('2026-08-24T11:00:00.000Z').getTime(),
    );
  });

  it('cancels existing reminders before re-scheduling and uses Android alarm cleanup', async () => {
    getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'task-1-pre-600000', content: { data: { taskId: 'task-1' } } },
      { identifier: 'task-1-end', content: { data: { taskId: 'task-1' } } },
      { identifier: 'other-end', content: { data: { taskId: 'other' } } },
    ]);

    await scheduleTaskReminders(task(
      'task-1',
      '2026-08-24T09:00:00.000Z',
      '2026-08-24T10:00:00.000Z',
    ));

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-1-pre-600000');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-1-end');
    expect(cancelAlarm).toHaveBeenCalledWith('task-1');
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-end');
  });

  it('does not schedule completed tasks but still clears stale reminders', async () => {
    await scheduleTaskReminders(task(
      'done',
      '2026-08-24T09:00:00.000Z',
      '2026-08-24T10:00:00.000Z',
      { status: 'completed' },
    ));

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(scheduleAlarm).not.toHaveBeenCalled();
  });

  it('does not create new notifications or alarms when permission is denied', async () => {
    getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    await scheduleTaskReminders(task(
      'task-2',
      '2026-08-24T09:00:00.000Z',
      '2026-08-24T10:00:00.000Z',
    ));

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(scheduleAlarm).not.toHaveBeenCalled();
  });

  it('cancels every scheduled notification belonging to a task', async () => {
    getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'task-3-pre-600000' },
      { identifier: 'task-3-end' },
      { identifier: 'task-30-end' },
    ]);

    await cancelTaskReminders('task-3');

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-3-pre-600000');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('task-3-end');
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('task-30-end');
    expect(cancelAlarm).toHaveBeenCalledWith('task-3');
  });

  it('caps a large batch at the notification capacity budget', async () => {
    const tasks = Array.from({ length: 60 }, (_, index) =>
      task(
        `bulk-${index}`,
        '2026-08-24T09:00:00.000Z',
        '2026-08-24T11:00:00.000Z',
        { title: `Bulk task ${index}`, durationMinutes: 120 },
      ),
    );

    await scheduleTaskRemindersBatch(tasks);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(450);
    expect(scheduleAlarm).toHaveBeenCalledTimes(60);
  });
});