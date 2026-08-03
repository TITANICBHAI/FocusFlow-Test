package com.tbtechs.focusflow.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.tbtechs.focusflow.modules.FocusDayBridgeModule

/**
 * NotificationActionReceiver
 *
 * Handles taps on action buttons in the foreground task notification:
 *   ✓ Done  — completes the current task
 *   +15m    — extends the task by 15 minutes
 *   +30m    — extends the task by 30 minutes
 *   Skip    — skips the current task
 *
 * Flow:
 *   User taps action → PendingIntent fires this receiver → receiver:
 *     1. Writes a "pending_notif_action" entry to SharedPrefs as a fallback
 *        in case the React JS instance is not yet alive.
 *     2. Launches MainActivity so the React instance starts (if not already alive).
 *     3. Sends a local broadcast to FocusDayBridgeModule for immediate handling
 *        when the React instance IS already active.
 *   Bridge emits "FocusDayEvent" of type "NOTIF_ACTION" to JS.
 *   On first onHostResume, the bridge also replays any pending action from SharedPrefs.
 */
class NotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_COMPLETE  = "com.tbtechs.focusflow.notif.COMPLETE"
        const val ACTION_EXTEND    = "com.tbtechs.focusflow.notif.EXTEND"
        const val ACTION_SKIP      = "com.tbtechs.focusflow.notif.SKIP"

        const val EXTRA_TASK_ID    = "taskId"
        const val EXTRA_MINUTES    = "minutes"

        const val PREF_PENDING_ACTION    = "pending_notif_action"
        const val PREF_PENDING_TASK_ID   = "pending_notif_task_id"
        const val PREF_PENDING_MINUTES   = "pending_notif_minutes"
        const val PREF_PENDING_TIME_MS   = "pending_notif_time_ms"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val action = intent.action ?: return
        val minutes = intent.getIntExtra(EXTRA_MINUTES, 15)

        // 1. Persist the action to SharedPrefs so FocusDayBridgeModule can replay it
        //    on the next onHostResume if the React instance was not alive when tapped.
        val prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        prefs.edit()
            .putString(PREF_PENDING_ACTION,  action)
            .putString(PREF_PENDING_TASK_ID, taskId)
            .putInt(PREF_PENDING_MINUTES,    minutes)
            .putLong(PREF_PENDING_TIME_MS,   System.currentTimeMillis())
            .apply()

        // 2. Launch MainActivity to wake up the React instance (no-op if already foreground).
        val launchIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP }
        launchIntent?.let { context.startActivity(it) }

        // 3. Send broadcast for immediate handling if React is already alive.
        val bridgeIntent = Intent(FocusDayBridgeModule.ACTION_NOTIF_ACTION).apply {
            `package` = context.packageName
            putExtra(FocusDayBridgeModule.EXTRA_NOTIF_ACTION_TYPE, action)
            putExtra(EXTRA_TASK_ID, taskId)
            putExtra(EXTRA_MINUTES, minutes)
        }
        context.sendBroadcast(bridgeIntent)
    }
}
