/**
 * backgroundTasks.ts
 *
 * ALL TaskManager.defineTask() calls MUST live in a module that is imported
 * at the very top of App.tsx (before any component renders).
 *
 * When the OS kills the app and later re-launches it "headlessly" to handle
 * a background event, it looks for these task definitions at module load time.
 * If they are defined inside a component they will not be found.
 *
 * Tasks defined here:
 *
 *   FOCUS_OVERRUN_CHECK   — fired by the scheduled notification at task end time;
 *                           runs the rescheduling engine headlessly
 *
 *   BACKGROUND_FETCH      — periodic OS-triggered fetch (every ~15 min);
 *                           checks for overdue tasks and re-arms any missed alarms
 *
 *   TASK_NOTIFICATION_BG  — handles background notification interactions
 *                           (user pressed "Complete" or "Extend" on the notification)
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';

import { dbGetTasksForDate, dbUpdateTask, dbGetSettings } from '@/data/database';
import { rebalanceAfterOverrun } from '@/services/schedulerEngine';
import {
  cancelTaskReminders,
  scheduleTaskReminders,
  fireLateStartWarning,
  dismissPersistentNotification,
  scheduleMorningDigest,
} from '@/services/notificationService';
import { navigateToTask } from '@/navigation/navigationRef';
import { logger } from '@/services/startupLogger';

// ─── Task name constants (must match wherever they are registered) ────────────

export const TASK_OVERRUN_CHECK  = 'FOCUSDAY_OVERRUN_CHECK';
export const TASK_BACKGROUND_FETCH = 'FOCUSDAY_BACKGROUND_FETCH';
export const TASK_NOTIFICATION_BG  = 'FOCUSDAY_NOTIFICATION_BG';

// ─── 1. Overrun / task-end handler ───────────────────────────────────────────
//
// Triggered by: scheduleNotificationAsync with data: { type: 'OVERRUN_CHECK', taskId }
// The notification fires at the task's scheduled end time. If the user hasn't
// marked it complete, we run the rescheduler headlessly.

TaskManager.defineTask(TASK_OVERRUN_CHECK, async ({ data, error }: any) => {
  if (error) {
    void logger.warn('bgTask', `OVERRUN_CHECK received error from OS: ${String(error)}`);
    return;
  }

  void logger.debug('bgTask', 'OVERRUN_CHECK: handler started');
  try {
    const notifData = data?.notification?.request?.content?.data as {
      type?: string;
      taskId?: string;
    } | undefined;

    // Handle persistent-dismiss: dismiss the persistent notification in background
    if (notifData?.type === 'persistent-dismiss') {
      await dismissPersistentNotification();
      void logger.debug('bgTask', 'OVERRUN_CHECK: handled persistent-dismiss');
      return;
    }

    if (notifData?.type !== 'OVERRUN_CHECK' || !notifData.taskId) {
      void logger.debug('bgTask', `OVERRUN_CHECK: skipped (type=${notifData?.type ?? 'none'}, taskId=${notifData?.taskId ?? 'none'})`);
      return;
    }

    void logger.debug('bgTask', `OVERRUN_CHECK: processing taskId=${notifData.taskId}`);
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await dbGetTasksForDate(today);
    const task  = tasks.find((t) => t.id === notifData.taskId);

    if (!task || task.status === 'completed' || task.status === 'skipped') {
      void logger.debug('bgTask', `OVERRUN_CHECK: task already done or missing (status=${task?.status ?? 'not found'})`);
      return;
    }

    // Task ran over — extend by 10 min as a safe default and rebalance
    const DEFAULT_EXTENSION_MINUTES = 10;
    const { updatedSchedule } = rebalanceAfterOverrun(task, DEFAULT_EXTENSION_MINUTES, tasks);

    for (const t of updatedSchedule) {
      await dbUpdateTask(t);
      await cancelTaskReminders(t.id);
      if (t.status !== 'skipped') await scheduleTaskReminders(t);
    }

    void logger.debug('bgTask', `OVERRUN_CHECK: rebalanced ${updatedSchedule.length} tasks`);
    console.log('[BgTask] OVERRUN_CHECK: rebalanced', updatedSchedule.length, 'tasks');
  } catch (e) {
    void logger.warn('bgTask', `OVERRUN_CHECK: handler threw: ${String(e)}`);
    console.warn('[BgTask] OVERRUN_CHECK handler failed:', e);
  }
});

// ─── 2. Periodic background fetch ────────────────────────────────────────────
//
// Android: expo-background-fetch uses JobScheduler / WorkManager.
// Fires approximately every 15 min (exact interval is OS-controlled).
// Use case: re-arm any notification alarms that were lost (e.g. after OEM battery kill).

TaskManager.defineTask(TASK_BACKGROUND_FETCH, async () => {
  void logger.debug('bgTask', 'BACKGROUND_FETCH: handler started');
  try {
    const today  = new Date().toISOString().slice(0, 10);
    const tasks  = await dbGetTasksForDate(today);
    const nowMs  = Date.now();

    let rearmedCount = 0;

    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'skipped') continue;
      const startMs = new Date(task.startTime).getTime();
      const endMs   = new Date(task.endTime).getTime();

      // Fire late-start warning if 3–15 min past scheduled start with no activity
      const minutesLate = Math.floor((nowMs - startMs) / 60_000);
      if (task.status === 'scheduled' && minutesLate >= 3 && minutesLate <= 15) {
        await fireLateStartWarning(task, minutesLate);
        continue;
      }

      // Skip tasks that have already ended
      if (endMs < nowMs) continue;

      // Re-arm upcoming task reminders (idempotent: cancels first)
      await cancelTaskReminders(task.id);
      await scheduleTaskReminders(task);
      rearmedCount++;
    }

    void logger.debug('bgTask', `BACKGROUND_FETCH: re-armed ${rearmedCount} reminders`);
    console.log('[BgFetch] Re-armed', rearmedCount, 'upcoming task reminders');

    // ── Evening morning-digest scheduling ──────────────────────────────────
    // If it's evening (20:00 – 23:59) and the user has a wakeUpTime set,
    // schedule tomorrow's morning digest with today's task summary.
    // Uses a fixed notification identifier so repeated calls are idempotent.
    const currentHour = new Date().getHours();
    if (currentHour >= 20) {
      try {
        const settings = await dbGetSettings();
        if (settings.userProfile?.wakeUpTime) {
          await scheduleMorningDigest(settings.userProfile, tasks);
          void logger.debug('bgTask', `BACKGROUND_FETCH: scheduled morning digest for ${settings.userProfile.wakeUpTime}`);
          console.log('[BgFetch] Scheduled morning digest for', settings.userProfile.wakeUpTime);
        }
      } catch (e) {
        void logger.warn('bgTask', `BACKGROUND_FETCH: morning digest failed: ${String(e)}`);
        console.warn('[BgFetch] Morning digest scheduling failed:', e);
      }
    }

    void logger.debug('bgTask', `BACKGROUND_FETCH: handler done (rearmed=${rearmedCount})`);
    return rearmedCount > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    void logger.warn('bgTask', `BACKGROUND_FETCH: handler threw: ${String(e)}`);
    console.warn('[BgFetch] handler failed:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── 3. Background notification response handler ──────────────────────────────
//
// Fires when the user presses an action button on a notification while the
// app is in the background or killed.
// Action identifiers are set up in setupNotificationCategories() (called from App.tsx).

TaskManager.defineTask(TASK_NOTIFICATION_BG, async ({ data, error }: any) => {
  if (error) {
    void logger.warn('bgTask', `NOTIFICATION_BG received error from OS: ${String(error)}`);
    return;
  }

  void logger.debug('bgTask', 'NOTIFICATION_BG: handler started');
  try {
    const actionId: string  = data?.actionIdentifier ?? '';
    const notifData = data?.notification?.request?.content?.data as {
      taskId?: string;
    } | undefined;

    const taskId = notifData?.taskId;
    if (!taskId) {
      void logger.debug('bgTask', 'NOTIFICATION_BG: no taskId, skipping');
      return;
    }

    void logger.debug('bgTask', `NOTIFICATION_BG: action=${actionId}, taskId=${taskId}`);
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await dbGetTasksForDate(today);
    const task  = tasks.find((t) => t.id === taskId);
    if (!task) {
      void logger.debug('bgTask', `NOTIFICATION_BG: task ${taskId} not found in today's tasks`);
      return;
    }

    if (actionId === 'COMPLETE') {
      await dbUpdateTask({ ...task, status: 'completed' });
      await cancelTaskReminders(taskId);
      void logger.debug('bgTask', `NOTIFICATION_BG: task ${taskId} marked complete`);
      console.log('[BgTask] Task completed from notification:', taskId);
    } else if (actionId === 'EXTEND') {
      // Extend by 15 min from the background
      const EXTENSION = 15;
      const { updatedSchedule } = rebalanceAfterOverrun(task, EXTENSION, tasks);
      for (const t of updatedSchedule) {
        await dbUpdateTask(t);
        await cancelTaskReminders(t.id);
        if (t.status !== 'skipped') await scheduleTaskReminders(t);
      }
      void logger.debug('bgTask', `NOTIFICATION_BG: task ${taskId} extended by ${EXTENSION}min`);
      console.log('[BgTask] Task extended from notification:', taskId);
    } else if (actionId === 'VIEW') {
      navigateToTask(taskId);
    }

    void logger.debug('bgTask', `NOTIFICATION_BG: handler done (action=${actionId})`);
  } catch (e) {
    void logger.warn('bgTask', `NOTIFICATION_BG: handler threw: ${String(e)}`);
    console.warn('[BgTask] NOTIFICATION_BG handler failed:', e);
  }
});

// ─── Register overrun-check task with expo-notifications ─────────────────────
//
// Without this, TaskManager.defineTask(TASK_OVERRUN_CHECK, …) is never fired —
// expo-notifications requires an explicit link between a notification-triggered
// task and the notifications system.  Call once at startup.

export async function registerOverrunCheckTask(): Promise<void> {
  try {
    await Notifications.registerTaskAsync(TASK_OVERRUN_CHECK);
    console.log('[BgTask] Registered overrun check task with notifications.');
  } catch (e: any) {
    if (!e.message?.includes('already registered')) {
      console.warn('[BgTask] Failed to register overrun check task:', e);
    }
  }
}

// ─── Register background fetch with the OS ───────────────────────────────────
//
// Call this once at startup (from App.tsx). Safe to call multiple times.

export async function registerBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log('[BgFetch] Background fetch is restricted or denied by the OS.');
      return;
    }

    await BackgroundFetch.registerTaskAsync(TASK_BACKGROUND_FETCH, {
      minimumInterval: 15 * 60,  // 15 minutes (OS may fire less often)
      stopOnTerminate: false,    // Continue after app is killed
      startOnBoot:     true,     // Restart after device reboot
    });

    console.log('[BgFetch] Registered background fetch task.');
  } catch (e: any) {
    // "Task already registered" is expected on subsequent launches
    if (!e.message?.includes('already registered')) {
      console.warn('[BgFetch] Registration failed:', e);
    }
  }
}
