package com.tbtechs.focusflow.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log

/**
 * TaskEndAlarmReceiver
 *
 * Fired by AlarmManager.setAlarmClock() at a task's end time. This is the
 * *primary* alarm trigger — independent of the foreground service's in-process
 * Handler polling, which the OS aggressively throttles in Doze mode and which
 * stops entirely if the service is killed.
 *
 * On receive:
 *   1. Acquire a partial wakelock so we have CPU time to post the notification
 *      before the device returns to Doze.
 *   2. Read taskId / taskName / endMs from the alarm intent extras.
 *   3. Post the same heads-up + full-screen-intent notification that the
 *      foreground service used to post via its Handler poll. The notification's
 *      full-screen intent launches [TaskAlarmActivity], waking the device,
 *      playing the alarm ringtone, and showing Done / Extend / Skip.
 *   4. Broadcast ACTION_TASK_ENDED so the foreground service (if alive) can
 *      clean up its in-memory session state and switch its persistent
 *      notification back to idle.
 *
 * Wire-up:
 *   - JS schedules via TaskAlarmModule.scheduleAlarm(taskId, taskName, endMs).
 *   - The receiver is declared (exported=false) by withFocusDayAndroid plugin.
 *   - The receiver intent uses an explicit class target so it works without an
 *     intent-filter, but we keep ACTION_FIRE for log-grep convenience.
 */
class TaskEndAlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "TaskEndAlarmReceiver"

        /**
         * Action used by the alarm intent. Receiver is targeted by explicit
         * component, so this string is informational only — it shows up in
         * `adb shell dumpsys alarm` and in our own logging, making it easy to
         * confirm a pending alarm is scheduled for the right task.
         */
        const val ACTION_FIRE     = "com.tbtechs.focusflow.alarm.FIRE_TASK_END"

        const val EXTRA_TASK_ID   = "taskId"
        const val EXTRA_TASK_NAME = "taskName"
        const val EXTRA_END_MS    = "endTimeMs"

        /** Tag attached to the wakelock — visible in `dumpsys power` for triage. */
        private const val WAKELOCK_TAG = "FocusFlow:TaskEndAlarmReceiver"

        /** Max time we hold the wakelock while posting the notification. */
        private const val WAKELOCK_TIMEOUT_MS = 30_000L
    }

    override fun onReceive(context: Context, intent: Intent) {
        val taskId   = intent.getStringExtra(EXTRA_TASK_ID)   ?: ""
        val taskName = intent.getStringExtra(EXTRA_TASK_NAME) ?: ""
        val endMs    = intent.getLongExtra(EXTRA_END_MS, System.currentTimeMillis())

        Log.i(TAG, "Alarm fired for task='$taskName' id='$taskId' endMs=$endMs")

        // Acquire a partial wakelock — without this the device may slip back
        // into Doze before NotificationManager processes our post() call,
        // dropping the heads-up animation and the full-screen-intent launch.
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wl = try {
            pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKELOCK_TAG)?.also {
                it.setReferenceCounted(false)
                it.acquire(WAKELOCK_TIMEOUT_MS)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Wakelock acquire failed: ${e.message}")
            null
        }

        try {
            // Post the full-screen-intent alarm notification. ForegroundTaskService
            // exposes the same code path it has always used internally, now as a
            // public static helper so this receiver can call it without touching
            // service state.
            ForegroundTaskService.postTaskEndAlarmNotification(
                context.applicationContext, taskId, taskName, endMs,
            )

            // Tell the foreground service (if it's still alive) that this session
            // ended so it can clear its in-memory state and revert the persistent
            // notification to idle. If the service is dead the broadcast is a no-op.
            try {
                context.sendBroadcast(
                    Intent(ForegroundTaskService.ACTION_TASK_ENDED).apply {
                        `package` = context.packageName
                    }
                )
            } catch (e: Exception) {
                Log.w(TAG, "ACTION_TASK_ENDED broadcast failed: ${e.message}")
            }
        } catch (e: Exception) {
            // Alarm is best-effort — logging here lets us correlate a missing
            // alarm UI with a Logcat error rather than guessing.
            Log.e(TAG, "Failed to post task-end alarm: ${e.message}", e)
        } finally {
            try { if (wl?.isHeld == true) wl.release() } catch (_: Exception) {}
        }
    }
}
