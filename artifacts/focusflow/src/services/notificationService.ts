/**
 * notificationService.ts
 *
 * Manages expo-notifications scheduling for FocusDay (Android).
 *
 * Note: setNotificationHandler and TaskManager.defineTask are NOT here.
 * They live at the top level of App.tsx and backgroundTasks.ts respectively,
 * which is required so the OS can find them on a headless re-launch.
 */

import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import type { Task, UserProfile } from '@/data/types';
import { formatTime, formatDuration, getRemainingMinutes } from './taskService';
import { TaskAlarmModule } from '@/native-modules/TaskAlarmModule';

type AndroidContent = Notifications.NotificationContentInput & {
  channelId?: string;
  ongoing?: boolean;
  autoDismiss?: boolean;
  sticky?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const REMINDER_CHANNEL_ID       = 'task-reminders';
export const MORNING_DIGEST_CHANNEL_ID = 'morning-digest';
export const WEEKLY_REPORT_CHANNEL_ID  = 'weekly-report';

// weeklyReviewDay → expo-notifications weekday number (1=Sun … 7=Sat)
const WEEKDAY_MAP: Record<NonNullable<UserProfile['weeklyReviewDay']>, number> = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Android notification channels ───────────────────────────────────────────

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Task reminder channel — used for pre-start alerts, mid-session check-ins, and end notifications.
  // The persistent focus notification is owned entirely by the native ForegroundTaskService
  // (IMPORTANCE_LOW, setOngoing(true)) — no JS channel is needed for it.
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Task Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366f1',
    sound: 'default',
  });
  // Morning digest channel — low-priority daily summary, no vibration.
  await Notifications.setNotificationChannelAsync(MORNING_DIGEST_CHANNEL_ID, {
    name: 'Morning Digest',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#f59e0b',
    sound: 'default',
  });
  // Weekly report channel — fires once per week on the user's chosen review day.
  await Notifications.setNotificationChannelAsync(WEEKLY_REPORT_CHANNEL_ID, {
    name: 'Weekly Report',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#6366f1',
    sound: 'default',
  });
}

// ─── Schedule reminders for a task ───────────────────────────────────────────

export async function scheduleTaskReminders(task: Task): Promise<void> {
  await cancelTaskReminders(task.id);

  const granted = await requestPermissions();
  if (!granted) return;

  const now     = Date.now();
  const startMs = new Date(task.startTime).getTime();
  const endMs   = new Date(task.endTime).getTime();

  // Pre-start reminders
  const endLabel = formatTime(task.endTime);
  const durLabel = formatDuration(task.durationMinutes);
  const preStart: Array<{ offsetMs: number; body: string; isStart?: boolean }> = [
    { offsetMs: -10 * 60_000, body: `Starting in 10 min · ends at ${endLabel} · ${durLabel} total` },
    { offsetMs: -5  * 60_000, body: `Starting in 5 min · ends at ${endLabel}` },
    { offsetMs: -1  * 60_000, body: `Starting in 1 min — get ready! Ends at ${endLabel}` },
    { offsetMs: 0,            body: `${durLabel} session · ends at ${endLabel} — tap to open`, isStart: true },
  ];

  for (const r of preStart) {
    const fireAt = startMs + r.offsetMs;
    if (fireAt - now < 1000) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `${task.id}-pre${r.offsetMs}`,
      content: {
        title: `🎯 ${task.title}`,
        body:  r.body,
        data:  { taskId: task.id, type: r.isStart ? 'task-start' : 'reminder' },
        sound: 'default',
        // At start time, show active controls (Complete, Extend, View).
        // Pre-start reminders only need View + Done.
        categoryIdentifier: r.isStart ? 'task-active' : 'task-reminder',
        channelId: REMINDER_CHANNEL_ID,
      } as AndroidContent,
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
    });
  }

  // Mid-session check-ins
  // Only schedule when there is enough headroom before the task ends:
  //   - 15 min check-in: only for tasks ≥ 25 min (at least 10 min remaining after it)
  //   - 30 min check-in: only for tasks ≥ 40 min (at least 10 min remaining after it)
  // This prevents noise on short tasks and avoids stacking with the wrap-up notification.
  const MIN_HEADROOM_MS = 10 * 60_000; // 10 min of remaining time after the check-in fires
  const midSession: Array<{ offsetMs: number; body: string }> = [
    { offsetMs: 15 * 60_000, body: `15 minutes in — how's it going?` },
    { offsetMs: 30 * 60_000, body: `Half hour in — keep going!` },
  ];

  for (const r of midSession) {
    const fireAt = startMs + r.offsetMs;
    // Skip if already passed, if it fires after the task ends, or if there's
    // not enough headroom before the end (to avoid stacking with wrap-up notif)
    if (fireAt - now < 1000) continue;
    if (fireAt >= endMs) continue;
    if (endMs - fireAt < MIN_HEADROOM_MS) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${task.id}-mid${r.offsetMs}`,
      content: {
        title: `🟢 ${task.title}`,
        body:  r.body,
        data:  { taskId: task.id, type: 'checkin' },
        sound: 'default',
        categoryIdentifier: 'task-active',
        channelId: REMINDER_CHANNEL_ID,
      } as AndroidContent,
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
    });
  }

  // T-1 minute warning before end
  const almostDone = endMs - 60_000;
  if (almostDone - now > 1000) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${task.id}-almost`,
      content: {
        title: `⏳ ${task.title} — 1 minute left`,
        body:  `Start wrapping up!`,
        data:  { taskId: task.id, type: 'almost-done' },
        sound: 'default',
        categoryIdentifier: 'task-active',
        channelId: REMINDER_CHANNEL_ID,
      } as AndroidContent,
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(almostDone) },
    });
  }

  // End-time notification — also used as the OVERRUN_CHECK trigger by backgroundTasks.ts
  if (endMs - now > 1000) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${task.id}-end`,
      content: {
        title: `⏰ ${task.title} — Time's up!`,
        body:  `Mark as done, or extend your session.`,
        data:  { taskId: task.id, type: 'OVERRUN_CHECK' },
        sound: 'default',
        categoryIdentifier: 'task-active',
        channelId: REMINDER_CHANNEL_ID,
      } as AndroidContent,
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(endMs) },
    });
  }

  // Native AlarmManager backup — the *only* mechanism that survives Doze /
  // app standby / foreground-service kill. expo-notifications schedules above
  // are best-effort and the in-process Handler tick inside ForegroundTaskService
  // is throttled when the screen has been off for ~10 minutes. AlarmManager
  // (via setAlarmClock) is exempt from those restrictions and fires the
  // full-screen TaskAlarmActivity even if the JS context has been torn down.
  //
  // Schedule for endMs (and only when in the future — the native side will
  // post immediately if the trigger is in the past, which can happen if the
  // user reschedules a task after its end time).
  if (Platform.OS === 'android') {
    void TaskAlarmModule.scheduleAlarm(task.id, task.title, endMs);
  }
}

// ─── Cancel helpers ───────────────────────────────────────────────────────────

export async function cancelTaskReminders(taskId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(taskId))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  // Cancel the AlarmManager registration too — without this, a task that the
  // user completes early or deletes still fires its full-screen alarm at the
  // original end time, which feels broken.
  if (Platform.OS === 'android') {
    void TaskAlarmModule.cancelAlarm(taskId);
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Persistent "in-progress" notification ───────────────────────────────────
// The persistent notification is owned entirely by the native ForegroundTaskService.
// It uses setOngoing(true) + IMPORTANCE_LOW so Samsung One UI does not flag it.
// JS must NOT post a duplicate ongoing notification — doing so with IMPORTANCE_MAX
// causes Samsung to show a "This app might have a bug — clear cache?" dialog.
//
// dismissPersistentNotification is kept as a no-op shim so callers don't need
// to be updated. The native service manages its own notification lifecycle.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function dismissPersistentNotification(): Promise<void> {
  // No-op: the native ForegroundTaskService owns the persistent notification.
  // It clears automatically when the service goes idle or is stopped.
}

// ─── Standalone block expiry warning ─────────────────────────────────────────
// Fires 5 minutes before the standalone block expires, if applicable.

export async function scheduleStandaloneBlockExpiry(untilMs: number, blockedCount: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('standalone-expiry').catch(() => {});

  const granted = await requestPermissions();
  if (!granted) return;

  const warnAt = untilMs - 5 * 60_000; // 5 min before expiry
  if (warnAt - Date.now() < 1000) return; // already within 5 minutes

  await Notifications.scheduleNotificationAsync({
    identifier: 'standalone-expiry',
    content: {
      title: '🔓 App Block Expiring Soon',
      body:  `Your block on ${blockedCount} app${blockedCount !== 1 ? 's' : ''} expires in 5 minutes.`,
      data:  { type: 'standalone-expiry' },
      sound: 'default',
      channelId: REMINDER_CHANNEL_ID,
    } as AndroidContent,
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(warnAt) },
  });
}

export async function cancelStandaloneBlockExpiry(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('standalone-expiry').catch(() => {});
}

// ─── Morning performance digest ───────────────────────────────────────────────
// Scheduled once per day, fires at the user's wakeUpTime the following morning.
// The content summarises yesterday's task completion and total focused time.
// Uses identifier 'morning-digest' so re-scheduling overwrites the old one.

export async function scheduleMorningDigest(
  profile: UserProfile | undefined,
  tasks: Task[], // tasks from the day being summarised (typically "today" when called in evening)
): Promise<void> {
  if (!profile?.wakeUpTime) return; // no wake-up time configured — nothing to schedule

  const granted = await requestPermissions();
  if (!granted) return;

  // Parse wakeUpTime "HH:MM"
  const [hStr, mStr] = profile.wakeUpTime.split(':');
  const wakeHour   = parseInt(hStr, 10);
  const wakeMinute = parseInt(mStr, 10);
  if (isNaN(wakeHour) || isNaN(wakeMinute)) return;

  // Schedule for tomorrow morning at the user's wake-up time
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(wakeHour, wakeMinute, 0, 0);
  if (tomorrow.getTime() <= Date.now()) return; // sanity check

  // Summarise task completion for the day
  const completed = tasks.filter((t) => t.status === 'completed');
  const skipped   = tasks.filter((t) => t.status === 'skipped');
  const total     = tasks.filter((t) => t.status !== 'skipped'); // user-scheduled (non-skipped)
  const focusMin  = completed.reduce((sum, t) => sum + t.durationMinutes, 0);
  const focusHrs  = Math.floor(focusMin / 60);
  const focusRem  = focusMin % 60;
  const timeStr   = focusHrs > 0
    ? `${focusHrs}h ${focusRem > 0 ? `${focusRem}m` : ''}`.trim()
    : `${focusMin}m`;

  const firstName = profile.name?.split(' ')[0] ?? null;
  const greeting  = firstName ? `Good morning, ${firstName}! ☀️` : 'Good morning! ☀️';

  let body = '';
  if (total.length === 0) {
    body = 'No tasks were scheduled yesterday. Ready to make today count?';
  } else {
    const ratio = `${completed.length}/${total.length} tasks done`;
    const time  = focusMin > 0 ? ` · ${timeStr} focused` : '';
    const names = completed.slice(0, 3).map((t) => t.title).join(', ');
    const namesStr = names ? ` · ✅ ${names}${completed.length > 3 ? ` +${completed.length - 3} more` : ''}` : '';
    const skipStr  = skipped.length > 0 ? ` · ⏭ ${skipped.length} skipped` : '';
    body = `Yesterday: ${ratio}${time}${namesStr}${skipStr}`;
  }

  // Cancel any existing morning digest before scheduling a new one
  await Notifications.cancelScheduledNotificationAsync('morning-digest').catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: 'morning-digest',
    content: {
      title: greeting,
      body,
      data: { type: 'morning-digest' },
      sound: 'default',
      channelId: MORNING_DIGEST_CHANNEL_ID,
    } as AndroidContent,
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: tomorrow },
  });
}

export async function cancelMorningDigest(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('morning-digest').catch(() => {});
}

// ─── Weekly report notification ───────────────────────────────────────────────
// Fires once per week on the day the user chose in their profile (weeklyReviewDay).
// Time matches their wakeUpTime if set, otherwise defaults to 9:00 am.
// Uses a WEEKLY repeating trigger so it re-fires automatically each week.
// Identifier 'weekly-report' means re-scheduling always replaces the old one.

export async function scheduleWeeklyReport(
  profile: UserProfile | undefined,
  weeklyReportEnabled: boolean,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('weekly-report').catch(() => {});

  if (!weeklyReportEnabled) return;
  if (!profile?.weeklyReviewDay) return;

  const granted = await requestPermissions();
  if (!granted) return;

  const weekday = WEEKDAY_MAP[profile.weeklyReviewDay];

  // Fire at the user's configured wake-up time, or 9:00 am as a sensible default.
  let hour   = 9;
  let minute = 0;
  if (profile.wakeUpTime) {
    const [hStr, mStr] = profile.wakeUpTime.split(':');
    const parsedH = parseInt(hStr, 10);
    const parsedM = parseInt(mStr, 10);
    if (!isNaN(parsedH) && !isNaN(parsedM)) {
      hour   = parsedH;
      minute = parsedM;
    }
  }

  const firstName = profile.name?.split(' ')[0] ?? null;
  const title = firstName ? `${firstName}'s weekly review 📊` : 'Weekly review 📊';

  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly-report',
    content: {
      title,
      body: 'Tap to see how your week went — focus time, streaks, and completed tasks.',
      data:  { type: 'weekly-report' },
      sound: 'default',
      channelId: WEEKLY_REPORT_CHANNEL_ID,
    } as AndroidContent,
    trigger: {
      type: SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  });
}

export async function cancelWeeklyReport(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('weekly-report').catch(() => {});
}

// ─── Late-start warning ───────────────────────────────────────────────────────
// Called by the background fetch task when a task is overdue to start.

export async function fireLateStartWarning(task: Task, minutesLate: number): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${task.id}-late`,
    content: {
      title: `⏰ You're late: ${task.title}`,
      body:  `This task was supposed to start ${minutesLate}m ago.`,
      data:  { taskId: task.id, type: 'LATE_START_WARNING' },
      sound: 'default',
      categoryIdentifier: 'task-reminder',
      channelId: REMINDER_CHANNEL_ID,
    } as AndroidContent,
    trigger: null,
  });
}
