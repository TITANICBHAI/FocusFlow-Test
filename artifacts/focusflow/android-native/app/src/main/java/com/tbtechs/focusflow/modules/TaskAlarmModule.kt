package com.tbtechs.focusflow.modules

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tbtechs.focusflow.services.ForegroundTaskService
import com.tbtechs.focusflow.services.TaskAlarmActivity
import com.tbtechs.focusflow.services.TaskEndAlarmReceiver

/**
 * TaskAlarmModule
 *
 * JS name: NativeModules.TaskAlarm
 *
 * Bridges the React side to the device's native AlarmManager so task end-time
 * alarms fire reliably even when the app is in Doze, the JS context has been
 * unloaded, or the foreground service has been killed by the OS.
 *
 * Responsibilities:
 *
 *   1. **scheduleAlarm** — calls AlarmManager.setAlarmClock() to register a
 *      wake-the-device broadcast at the task's exact end time. AlarmManager
 *      survives process death, Doze, and app standby. setAlarmClock() is the
 *      strictest delivery guarantee Android offers — exempt from Doze
 *      throttling and shown in the lockscreen alarm row on most OEMs.
 *
 *   2. **cancelAlarm** — cancels the AlarmManager registration for a given
 *      taskId. Used when the user reschedules, deletes, or completes a task
 *      before its end time so the alarm doesn't fire spuriously.
 *
 *   3. **dismissAlarm** — finishes the visible TaskAlarmActivity and clears
 *      the heads-up notification when the user resolves the task from inside
 *      the React UI rather than from the alarm itself.
 *
 *   4. **canScheduleExactAlarms / requestExactAlarmPermission** — Android 12+
 *      requires the user to grant "Alarms & reminders" before AlarmManager
 *      will fire on time. The JS layer probes the state on startup and
 *      surfaces a settings link when permission is denied — without that
 *      grant, AlarmManager silently delivers up to 10 minutes late, which
 *      defeats the purpose of an alarm.
 */
class TaskAlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "TaskAlarm"
        private const val TAG = "TaskAlarmModule"

        /**
         * Stable hash → request code so the same taskId always maps to the
         * same PendingIntent. Required for cancel() to find and remove the
         * earlier registration. Math.abs() guards against the
         * Integer.MIN_VALUE edge case where -hashCode() overflows.
         */
        internal fun requestCodeFor(taskId: String): Int {
            val h = taskId.hashCode()
            return if (h == Int.MIN_VALUE) 0 else Math.abs(h)
        }

        /** Build the canonical alarm PendingIntent for a given taskId. */
        internal fun buildAlarmPendingIntent(
            ctx: Context,
            taskId: String,
            taskName: String,
            endMs: Long,
            flags: Int,
        ): PendingIntent {
            val intent = Intent(ctx.applicationContext, TaskEndAlarmReceiver::class.java).apply {
                action = TaskEndAlarmReceiver.ACTION_FIRE
                `package` = ctx.packageName
                putExtra(TaskEndAlarmReceiver.EXTRA_TASK_ID,   taskId)
                putExtra(TaskEndAlarmReceiver.EXTRA_TASK_NAME, taskName)
                putExtra(TaskEndAlarmReceiver.EXTRA_END_MS,    endMs)
            }
            return PendingIntent.getBroadcast(
                ctx.applicationContext,
                requestCodeFor(taskId),
                intent,
                flags,
            )
        }
    }

    override fun getName(): String = NAME

    // ─── 1. Schedule ──────────────────────────────────────────────────────────

    /**
     * Schedules a wake-up alarm at [endMs] that posts the full-screen task-end
     * alarm. Replaces any earlier registration for the same taskId.
     *
     * Returns: true on success, false on failure (e.g. AlarmManager unavailable
     * or exact-alarm permission denied — the JS layer should treat false as a
     * cue to ask the user for the permission and re-call).
     */
    @ReactMethod
    fun scheduleAlarm(taskId: String?, taskName: String?, endMs: Double, promise: Promise) {
        try {
            val id   = taskId   ?: ""
            val name = taskName ?: ""
            val triggerAt = endMs.toLong()

            if (id.isEmpty()) {
                Log.w(TAG, "scheduleAlarm: empty taskId — refusing to schedule")
                promise.resolve(false); return
            }
            if (triggerAt <= System.currentTimeMillis()) {
                // Caller is rescheduling something that has already ended —
                // fire immediately so the user still gets the alarm UI and
                // the task moves to awaiting-decision state.
                Log.i(TAG, "scheduleAlarm: triggerAt is in the past — posting alarm now")
                ForegroundTaskService.postTaskEndAlarmNotification(
                    reactContext.applicationContext, id, name, triggerAt,
                )
                promise.resolve(true); return
            }

            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (am == null) {
                Log.e(TAG, "scheduleAlarm: AlarmManager unavailable")
                promise.resolve(false); return
            }

            val pi = buildAlarmPendingIntent(
                reactContext, id, name, triggerAt,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            // Strategy ladder, strictest first:
            //   1. setAlarmClock — Doze-immune, shown in lockscreen alarm row.
            //      Requires SCHEDULE_EXACT_ALARM (auto-granted with USE_EXACT_ALARM
            //      on API 33+) or USE_EXACT_ALARM on API 31-32.
            //   2. setExactAndAllowWhileIdle — fires within ~10s of trigger
            //      even in Doze. Used when 1 fails (no exact-alarm permission
            //      or OEM rejects setAlarmClock).
            //   3. setAndAllowWhileIdle — coarse fallback for OS versions or
            //      OEM ROMs that reject the exact APIs entirely. May be off
            //      by minutes but at least the alarm eventually fires.
            //
            // Each rung is wrapped in its own try/catch so an OEM-specific
            // SecurityException on one rung doesn't prevent us from trying the
            // next. The failure mode is "less precise alarm", never "no alarm".
            val showIntent = Intent(reactContext, TaskAlarmActivity::class.java)
            val showPi = PendingIntent.getActivity(
                reactContext.applicationContext,
                requestCodeFor(id) xor 0x55AA55AA.toInt(),
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            var scheduled = false
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (am.canScheduleExactAlarms()) {
                        am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showPi), pi)
                        scheduled = true
                    }
                } else {
                    am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showPi), pi)
                    scheduled = true
                }
            } catch (e: SecurityException) {
                Log.w(TAG, "setAlarmClock denied: ${e.message}")
            } catch (e: Exception) {
                Log.w(TAG, "setAlarmClock failed: ${e.message}")
            }

            if (!scheduled) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                    scheduled = true
                } catch (e: SecurityException) {
                    Log.w(TAG, "setExactAndAllowWhileIdle denied: ${e.message}")
                } catch (e: Exception) {
                    Log.w(TAG, "setExactAndAllowWhileIdle failed: ${e.message}")
                }
            }

            if (!scheduled) {
                try {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                    scheduled = true
                } catch (e: Exception) {
                    Log.e(TAG, "setAndAllowWhileIdle failed — alarm will NOT fire: ${e.message}")
                }
            }

            Log.i(TAG, "scheduleAlarm taskId=$id name='$name' endMs=$triggerAt scheduled=$scheduled")
            promise.resolve(scheduled)
        } catch (e: Exception) {
            Log.e(TAG, "scheduleAlarm crashed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    // ─── 2. Cancel ────────────────────────────────────────────────────────────

    /**
     * Cancels any previously-scheduled alarm for this taskId. Safe to call
     * even if no alarm exists — PendingIntent.cancel() is a no-op in that case.
     */
    @ReactMethod
    fun cancelAlarm(taskId: String?, promise: Promise) {
        try {
            val id = taskId ?: ""
            if (id.isEmpty()) { promise.resolve(true); return }

            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            // Recreate the same PendingIntent (using FLAG_NO_CREATE so we can
            // tell whether it actually existed) and cancel it.
            val existing = buildAlarmPendingIntent(
                reactContext, id, "", 0L,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            if (existing != null) {
                am?.cancel(existing)
                existing.cancel()
            }
            Log.i(TAG, "cancelAlarm taskId=$id existed=${existing != null}")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w(TAG, "cancelAlarm failed: ${e.message}")
            promise.resolve(false)
        }
    }

    // ─── 3. Dismiss visible alarm UI ──────────────────────────────────────────

    @ReactMethod
    fun dismissAlarm(taskId: String?, promise: Promise) {
        try {
            val intent = Intent(TaskAlarmActivity.ACTION_DISMISS_ALARM).apply {
                `package` = reactContext.packageName
                if (!taskId.isNullOrEmpty()) {
                    putExtra(TaskAlarmActivity.EXTRA_TASK_ID, taskId)
                }
            }
            reactContext.sendBroadcast(intent)

            val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE)
                as? NotificationManager
            nm?.cancel(ForegroundTaskService.TASK_ALARM_NOTIF_ID)

            promise.resolve(true)
        } catch (e: Exception) {
            // Best-effort — never surface failures to JS.
            promise.resolve(false)
        }
    }

    // ─── 4. Exact-alarm permission probe + grant flow ─────────────────────────

    /**
     * Returns whether the OS will honour exact alarm scheduling. On API < 31
     * this is always true. On API 31+ the user must grant "Alarms & reminders"
     * in app settings (or the app must hold USE_EXACT_ALARM, which we declare,
     * so on API 33+ this typically returns true automatically).
     */
    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                promise.resolve(true); return
            }
            val am = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            promise.resolve(am?.canScheduleExactAlarms() ?: false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Opens the system "Alarms & reminders" settings screen for this app so
     * the user can grant the permission. No-op on API < 31. Resolves true if
     * the settings activity could be launched.
     */
    @ReactMethod
    fun requestExactAlarmPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                promise.resolve(true); return
            }
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w(TAG, "requestExactAlarmPermission failed: ${e.message}")
            promise.resolve(false)
        }
    }
}
