package com.tbtechs.focusflow.services

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.media.AudioAttributes
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.core.app.NotificationCompat
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.MainActivity
import com.tbtechs.focusflow.services.NetworkBlockerVpnService
import com.tbtechs.focusflow.services.WakeLockManager
import com.tbtechs.focusflow.widget.FocusFlowWidget
import org.json.JSONArray
import java.util.Calendar

/**
 * ForegroundTaskService
 *
 * Runs persistently at all times — not only during focus sessions.
 * This keeps the process alive so the AccessibilityService is never killed.
 *
 * Two modes:
 *   IDLE   — No active task. Shows a quiet "FocusFlow is monitoring" notification.
 *   ACTIVE — Focus session running. Shows task name + live chronometer countdown
 *            + progress bar + action buttons.
 *
 * Notification action buttons (ACTIVE mode only):
 *   ✓ Done   → NotificationActionReceiver → JS completeTask()
 *   +15m     → NotificationActionReceiver → JS extendTaskTime(15)
 *   +30m     → NotificationActionReceiver → JS extendTaskTime(30)
 *   Skip     → NotificationActionReceiver → JS skipTask()
 *
 * Intent extras for ACTIVE mode:
 *   "taskId"   String  — DB id of the active task (for action buttons)
 *   "taskName" String  — display name of the active task
 *   "endTimeMs" Long   — absolute epoch ms when the task ends
 *   "nextName"  String? — name of the next task (shown as sub-text)
 */
class ForegroundTaskService : Service() {

    companion object {
        const val CHANNEL_ID        = "focusday_foreground"
        const val CHANNEL_NAME      = "FocusFlow Active Task"
        const val NOTIFICATION_ID   = 1001
        const val ACTION_STOP       = "com.tbtechs.focusflow.STOP_SERVICE"
        const val ACTION_SET_IDLE   = "com.tbtechs.focusflow.SET_IDLE"
        const val ACTION_SET_BREAK  = "com.tbtechs.focusflow.SET_BREAK"
        const val ACTION_CLEAR_BREAK = "com.tbtechs.focusflow.CLEAR_BREAK"
        const val ACTION_TASK_ENDED = "com.tbtechs.focusflow.TASK_ENDED"

        const val EXTRA_TASK_ID     = "taskId"
        const val EXTRA_TASK_NAME   = "taskName"
        const val EXTRA_END_MS      = "endTimeMs"
        const val EXTRA_START_MS    = "startTimeMs"
        const val EXTRA_NEXT_NAME   = "nextName"
        const val EXTRA_BREAK_UNTIL_MS = "breakUntilMs"

        private const val PREFS_NAME = "focusday_prefs"

        // PendingIntent request codes (must be unique per action)
        private const val PI_TAP      = 0
        private const val PI_COMPLETE = 2
        private const val PI_EXTEND15 = 3
        private const val PI_EXTEND30 = 4
        private const val PI_SKIP     = 5

        /** How often the fallback poller checks the foreground app (ms). */
        private const val FALLBACK_POLL_MS = 1_000L

        /** Cooldown: don't re-block the same package within this window (ms). */
        private const val FALLBACK_COOLDOWN_MS = 2_000L

        /** How often the in-process VPN health check runs (ms). */
        private const val VPN_HEALTH_CHECK_MS = 60_000L

        /**
         * How often the UsageStats-based allowance sync fires (ms).
         * Every 60 s is accurate enough for a daily time budget and cheap on battery.
         */
        private const val ALLOWANCE_SYNC_MS = 60_000L

        /** Notification channel for full-screen block-overlay intent. */
        private const val BLOCK_ALERT_CHANNEL  = "focusday_block_alert"
        private const val BLOCK_ALERT_NOTIF_ID = 9001

        /**
         * Notification channel for the full-screen task-end alarm.  Must be
         * IMPORTANCE_HIGH with sound + vibration so the heads-up presents and
         * the full-screen intent is honoured even on locked / asleep devices.
         */
        const val TASK_ALARM_CHANNEL   = "task_alarm"
        const val TASK_ALARM_NOTIF_ID  = 9101
        private const val PI_TASK_ALARM = 7

        /**
         * Posts the heads-up + full-screen-intent task-end alarm notification.
         *
         * Exposed as a static helper so [TaskEndAlarmReceiver] (fired by
         * AlarmManager) can post the same alarm UI as the in-process Handler
         * tick. Without this split, only the foreground service could trigger
         * the full-screen alarm — which silently fails the moment Android
         * Doze pauses the service's main looper, which is exactly the bug
         * users hit when alarms "didn't go off" after the screen had been
         * off for a while.
         *
         * Idempotent: the notification ID is fixed ([TASK_ALARM_NOTIF_ID]),
         * so a second post just replaces the first if the service tick races
         * the AlarmManager broadcast.
         */
        fun postTaskEndAlarmNotification(
            context: Context,
            endedTaskId: String,
            endedTaskName: String,
            endedAtMs: Long,
        ) {
            try {
                val app = context.applicationContext
                val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                // Ensure the high-importance alarm channel exists. Channels are
                // sticky once created so this is a cheap idempotent call, but we
                // can't assume the foreground service has run yet (the receiver
                // may fire after a process death where onCreate never executed).
                val existing = nm.getNotificationChannel(TASK_ALARM_CHANNEL)
                if (existing == null) {
                    val attrs = android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    val sound = android.media.RingtoneManager.getDefaultUri(
                        android.media.RingtoneManager.TYPE_ALARM
                    )
                    val channel = android.app.NotificationChannel(
                        TASK_ALARM_CHANNEL,
                        "Task End Alarm",
                        NotificationManager.IMPORTANCE_HIGH,
                    ).apply {
                        description = "Wakes the device when a task ends."
                        enableLights(true)
                        enableVibration(true)
                        setSound(sound, attrs)
                        setBypassDnd(true)
                        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    }
                    nm.createNotificationChannel(channel)
                }

                val activityIntent = Intent(app, TaskAlarmActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_NO_HISTORY
                    putExtra(TaskAlarmActivity.EXTRA_TASK_ID,   endedTaskId)
                    putExtra(TaskAlarmActivity.EXTRA_TASK_NAME, endedTaskName)
                    putExtra(TaskAlarmActivity.EXTRA_END_MS,    endedAtMs)
                }
                val fullScreenPi = PendingIntent.getActivity(
                    app, PI_TASK_ALARM, activityIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )

                val displayName = if (endedTaskName.isNotEmpty()) endedTaskName else "Your task"

                val notif = NotificationCompat.Builder(app, TASK_ALARM_CHANNEL)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("\u23F0 Time's up")
                    .setContentText("$displayName has ended — tap to choose")
                    .setContentIntent(fullScreenPi)
                    .setFullScreenIntent(fullScreenPi, true)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setOngoing(true)
                    .build()
                nm.notify(TASK_ALARM_NOTIF_ID, notif)

                // Belt-and-braces: on some OEM ROMs the full-screen intent is
                // delayed until the user unlocks. Fire startActivity directly
                // too — the system simply ignores it if the activity is
                // already up. From a BroadcastReceiver context this requires
                // FLAG_ACTIVITY_NEW_TASK which we already set above.
                try { app.startActivity(activityIntent) } catch (_: Exception) {}
            } catch (_: Exception) { /* alarm is best-effort */ }
        }
    }

    private var taskId: String    = ""
    private var taskName: String  = ""
    private var endTimeMs: Long   = 0L
    private var startTimeMs: Long = 0L
    private var nextName: String? = null
    private var isActiveMode: Boolean = false
    private var breakUntilMs: Long = 0L

    /** Wall-clock ms when this service process first called onCreate(). Used
     *  by the idle notification chronometer so it always counts up from when
     *  monitoring started, not from when the latest goIdle() was called. */
    private var serviceStartMs: Long = 0L

    // ── Fallback blocker state (used only when accessibility is not granted) ──
    private lateinit var blockPrefs: SharedPreferences
    private var fallbackLastBlockedPkg: String? = null
    private var fallbackLastBlockedAtMs: Long   = 0L
    private var allowanceExpiryRunnable: Runnable? = null

    private val handler = Handler(Looper.getMainLooper())

    /**
     * Secondary in-process VPN health check — runs every [VPN_HEALTH_CHECK_MS].
     *
     * The AccessibilityService runs the same check every 10 s, but
     * ForegroundTaskService is typically hardier (it holds a foreground notification
     * Android is reluctant to kill). Having a second, independent watcher here
     * means the VPN is restarted quickly even on devices where the accessibility
     * service is sluggish to recover.
     *
     * The AlarmManager-based [VpnWatchdogReceiver] is the ultimate fallback for
     * full process-death scenarios; this runnable handles in-process silent kills.
     */
    private val vpnHealthRunnable = object : Runnable {
        override fun run() {
            checkAndHealVpn()
            handler.postDelayed(this, VPN_HEALTH_CHECK_MS)
        }
    }

    /**
     * UsageStats-based allowance sync — runs every [ALLOWANCE_SYNC_MS] (60 s).
     *
     * Uses Android's UsageStatsManager (PACKAGE_USAGE_STATS permission) to read the
     * *actual* foreground time each tracked app has accumulated since the start of today.
     * This is the ground-truth source — it is device-managed, cannot be inflated by
     * spurious accessibility events, and persists across service kills/reboots.
     *
     * Only updates `time_budget` entries in daily_allowance_used. The count and interval
     * modes don't map cleanly onto the UsageStats API and keep their own tracking.
     *
     * The sync is additive — it only raises `usedMs` when UsageStats reports more time
     * than the current stored value, so a freshly accumulated event-based write is never
     * overwritten downward by a stale 60-second snapshot.
     */
    private val allowanceSyncRunnable = object : Runnable {
        override fun run() {
            try { syncAllowanceFromUsageStats() } catch (_: Exception) { /* best-effort */ }
            handler.postDelayed(this, ALLOWANCE_SYNC_MS)
        }
    }

    private fun syncAllowanceFromUsageStats() {
        val configJson = blockPrefs.getString("daily_allowance_config", null) ?: return
        if (configJson.isBlank() || configJson == "null") return

        // Parse only time_budget packages — collect pkg → budgetMs
        val timeBudgetPkgs = mutableMapOf<String, Long>()
        try {
            val arr = org.json.JSONArray(configJson)
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                if (obj.optString("mode") != "time_budget") continue
                val pkg      = obj.optString("packageName", "")
                val budgetMs = obj.optInt("budgetMinutes", 30).toLong() * 60_000L
                if (pkg.isNotEmpty()) timeBudgetPkgs[pkg] = budgetMs
            }
        } catch (_: Exception) { return }
        if (timeBudgetPkgs.isEmpty()) return

        // Gate on Usage Access permission — AppOps check (mirrors UsageStatsModule)
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as? android.app.AppOpsManager ?: return
        val mode   = appOps.checkOpNoThrow(
            android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(), packageName
        )
        // MODE_ALLOWED or MODE_DEFAULT (some Samsung OneUI builds) are both acceptable
        if (mode == android.app.AppOpsManager.MODE_IGNORED ||
            mode == android.app.AppOpsManager.MODE_ERRORED) return

        val usm = getSystemService(Context.USAGE_STATS_SERVICE)
            as? android.app.usage.UsageStatsManager ?: return

        // Query from midnight today → now so we only count today's foreground time
        val cal = java.util.Calendar.getInstance(java.util.TimeZone.getDefault()).apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        val startOfDay = cal.timeInMillis
        val now        = System.currentTimeMillis()
        val today      = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getDefault()
        }.format(java.util.Date())

        val statsMap = try {
            usm.queryUsageStats(android.app.usage.UsageStatsManager.INTERVAL_DAILY, startOfDay, now)
                ?.associateBy { it.packageName } ?: return
        } catch (_: Exception) { return }

        val usedJson = blockPrefs.getString("daily_allowance_used", "{}") ?: "{}"
        val allUsed  = try { org.json.JSONObject(usedJson) } catch (_: Exception) { return }
        var changed  = false

        val activeSessionPkg = blockPrefs.getString(
            AppBlockerAccessibilityService.PREF_ACTIVE_SESSION_PKG,
            null,
        )
        val usageStatsSync = try {
            org.json.JSONObject(
                blockPrefs.getString(
                    AppBlockerAccessibilityService.PREF_USAGE_STATS_SYNC,
                    "{}",
                ) ?: "{}",
            )
        } catch (_: Exception) {
            org.json.JSONObject()
        }

        var foregroundBudgetExpiry: Pair<String, Long>? = null
        val foregroundPkg = getFallbackForegroundPackage()
        for ((pkg, budgetMs) in timeBudgetPkgs) {
            // AccessibilityService owns the live session while this signal is
            // fresh. Its checkpoint is already an absolute accumulated total;
            // writing UsageStats on top of it would double-count the session.
            if (hasFreshActiveAllowanceSession(pkg, now)) continue
            // If the package signal exists but is stale, UsageStats is allowed
            // to recover it. Record the handoff timestamp so the
            // AccessibilityService can continue from the absolute total rather
            // than adding the same stale-heartbeat interval again.
            val staleActiveSession = activeSessionPkg?.equals(pkg, ignoreCase = true) == true

            val actualMs = (statsMap[pkg]?.totalTimeInForeground ?: 0L)
                .coerceAtMost(budgetMs)

            val pkgUsed    = allUsed.optJSONObject(pkg) ?: org.json.JSONObject()
            val storedDate = pkgUsed.optString("date", "")
            val storedMs   = if (storedDate == today) pkgUsed.optLong("usedMs", 0L) else 0L
            val effectiveMs = maxOf(actualMs, storedMs)
            if (pkg.equals(foregroundPkg, ignoreCase = true) && effectiveMs < budgetMs) {
                foregroundBudgetExpiry = pkg to (now + budgetMs - effectiveMs)
            }

            // Only raise — never lower — so an event-based write that is more recent
            // than the last 60-second snapshot is never clobbered.
            if (actualMs > storedMs) {
                pkgUsed.put("mode",   "time_budget")
                pkgUsed.put("date",   today)
                pkgUsed.put("usedMs", actualMs)
                allUsed.put(pkg, pkgUsed)
                if (staleActiveSession) {
                    usageStatsSync.put(pkg, now)
                }
                changed = true
            }
        }

        if (changed) {
            blockPrefs.edit()
                .putString("daily_allowance_used", allUsed.toString())
                .putString(
                    AppBlockerAccessibilityService.PREF_USAGE_STATS_SYNC,
                    usageStatsSync.toString(),
                )
                .apply()
        }
        foregroundBudgetExpiry?.let { (pkg, expiryMs) ->
            scheduleAllowanceExpiry(pkg, expiryMs, timeBudgetPkgs[pkg] ?: return@let)
        } ?: run {
            allowanceExpiryRunnable?.let { handler.removeCallbacks(it) }
            allowanceExpiryRunnable = null
        }
    }

    /**
     * UsageStats is refreshed periodically, but a foreground app should not wait
     * for the next minute-long refresh once its already-known budget is due.
     * The callback only promotes the allowance to exhausted after re-checking
     * that the same app is still foreground, then wakes the normal blocker.
     */
    private fun scheduleAllowanceExpiry(pkg: String, expiryMs: Long, budgetMs: Long) {
        allowanceExpiryRunnable?.let { handler.removeCallbacks(it) }
        val delayMs = (expiryMs - System.currentTimeMillis()).coerceAtLeast(0L)
        val runnable = Runnable {
            allowanceExpiryRunnable = null
            if (!pkg.equals(getFallbackForegroundPackage(), ignoreCase = true)) return@Runnable
            val usedJson = blockPrefs.getString("daily_allowance_used", "{}") ?: "{}"
            val allUsed = try { org.json.JSONObject(usedJson) } catch (_: Exception) { return@Runnable }
            val used = allUsed.optJSONObject(pkg) ?: org.json.JSONObject()
            used.put("mode", "time_budget")
            used.put("date", java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getDefault()
            }.format(java.util.Date()))
            used.put("usedMs", budgetMs)
            allUsed.put(pkg, used)
            blockPrefs.edit().putString("daily_allowance_used", allUsed.toString()).apply()
            handler.post(fallbackPollRunnable)
        }
        allowanceExpiryRunnable = runnable
        handler.postDelayed(runnable, delayMs)
    }

    private fun hasFreshActiveAllowanceSession(pkg: String, nowMs: Long): Boolean {
        val activePkg = blockPrefs.getString(
            AppBlockerAccessibilityService.PREF_ACTIVE_SESSION_PKG,
            null,
        ) ?: return false
        if (!activePkg.equals(pkg, ignoreCase = true)) return false

        val lastCheckpointMs = blockPrefs.getLong(
            AppBlockerAccessibilityService.PREF_ACTIVE_SESSION_LAST_CHECKPOINT_MS,
            0L,
        )
        val checkpointAgeMs = nowMs - lastCheckpointMs
        return lastCheckpointMs > 0L &&
            checkpointAgeMs in 0L..AppBlockerAccessibilityService.ACTIVE_SESSION_SIGNAL_TTL_MS
    }

    private val tickRunnable = object : Runnable {
        override fun run() {
            val remaining = endTimeMs - System.currentTimeMillis()
            if (remaining <= 0) {
                // Capture identity BEFORE clearing — goIdle() resets these fields.
                val endedTaskId   = taskId
                val endedTaskName = taskName
                clearFocusActive()
                sendBroadcast(Intent(ACTION_TASK_ENDED).apply {
                    `package` = applicationContext.packageName
                    putExtra("taskId", endedTaskId)
                })
                // Wake the device with a full-screen alarm so the user doesn't
                // miss the end of their task.  The task itself stays in the
                // awaiting-decision state until the user picks Done / Extend / Skip.
                triggerTaskAlarm(endedTaskId, endedTaskName, endTimeMs)
                goIdle()
                return
            }
            // Update the progress bar portion of the notification
            updateNotification(remaining)
            // Push fresh data to any home screen widgets
            FocusFlowWidget.pushWidgetUpdate(applicationContext)
            // Tick every 30 s — smooth enough for the progress bar, easy on battery
            handler.postDelayed(this, 30_000)
        }
    }

    private val breakTickRunnable = object : Runnable {
        override fun run() {
            // A break must never suppress the task-end event. This can happen
            // when the final Pomodoro break runs into the task's scheduled end.
            if (endTimeMs > 0L && System.currentTimeMillis() >= endTimeMs) {
                val endedTaskId = taskId
                val endedTaskName = taskName
                clearFocusActive()
                sendBroadcast(Intent(ACTION_TASK_ENDED).apply {
                    `package` = applicationContext.packageName
                    putExtra("taskId", endedTaskId)
                })
                triggerTaskAlarm(endedTaskId, endedTaskName, endTimeMs)
                goIdle()
                return
            }
            if (breakUntilMs <= 0L || System.currentTimeMillis() >= breakUntilMs) {
                resumeFromBreak()
                return
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, buildBreakNotification())
            handler.postDelayed(this, 1_000L)
        }
    }

    /**
     * Fallback blocker poll runnable — runs every [FALLBACK_POLL_MS] ms.
     *
     * Immediately bails out if the accessibility service is enabled (that path
     * is faster and more reliable — no need to duplicate work).  When
     * accessibility is absent this is the only enforcement mechanism, so it
     * uses UsageStatsManager to detect the foreground package, mirrors the
     * same SharedPreferences block-check logic, and if a blocked app is found
     * it launches the overlay (which pushes the app to the background) then
     * fires killBackgroundProcesses 400 ms later.
     */
    private val fallbackPollRunnable = object : Runnable {
        override fun run() {
            // ── 1. Defer to accessibility if it is active ─────────────────
            if (isAccessibilityServiceEnabled()) {
                handler.postDelayed(this, FALLBACK_POLL_MS)
                return
            }

            // ── 2. Only act when at least one blocking mode is active ──────
            val now = System.currentTimeMillis()
            val focusActive = blockPrefs.getBoolean("focus_active", false).let { on ->
                if (on) {
                    val endMs = blockPrefs.getLong("task_end_ms", 0L)
                    if (endMs > 0L && now > endMs) {
                        blockPrefs.edit().putBoolean("focus_active", false).apply()
                        false
                    } else on
                } else false
            }
            val saActive = blockPrefs.getBoolean("standalone_block_active", false).let { on ->
                if (on) {
                    val untilMs = blockPrefs.getLong("standalone_block_until_ms", 0L)
                    if (untilMs > 0L && now > untilMs) {
                        blockPrefs.edit().putBoolean("standalone_block_active", false).apply()
                        false
                    } else on
                } else false
            }
            val greyoutJson = blockPrefs.getString("greyout_schedule", "[]") ?: "[]"
            val hasGreyout = greyoutJson != "[]" && greyoutJson.isNotEmpty()
            val alwaysBlockActive = blockPrefs.getBoolean("always_block_active", false)
            val hasAllowanceConfig = blockPrefs.getString("daily_allowance_config", null)
                ?.let { it.isNotBlank() && it != "null" && it != "[]" } == true

            if (!focusActive && !saActive && !hasGreyout &&
                !alwaysBlockActive && !hasAllowanceConfig) {
                // Nothing to enforce — reset cooldown and poll lightly
                fallbackLastBlockedPkg = null
                handler.postDelayed(this, FALLBACK_POLL_MS)
                return
            }

            // ── 3. Detect foreground package ──────────────────────────────
            val pkg = getFallbackForegroundPackage()
            if (pkg.isNullOrEmpty() || pkg == packageName) {
                handler.postDelayed(this, FALLBACK_POLL_MS)
                return
            }

            // ── 4. Skip BLOCKABLE_AFTER_WARNING packages ──────────────────
            // These are launcher / dialer / Settings etc. — bypassed by
            // default so the user is never trapped. They can still be
            // blocked if the user explicitly opts in via the picker (after
            // a confirmation warning), but the AccessibilityService handles
            // that opt-in path; the fallback poller skips them outright.
            if (AppBlockerAccessibilityService.BLOCKABLE_AFTER_WARNING.any {
                    pkg.equals(it, ignoreCase = true)
                }) {
                handler.postDelayed(this, FALLBACK_POLL_MS)
                return
            }

            // ── 5. Check if the package should be blocked ─────────────────
            if (!isFallbackBlocked(pkg, focusActive, saActive, greyoutJson)) {
                fallbackLastBlockedPkg = null
                handler.postDelayed(this, FALLBACK_POLL_MS)
                return
            }

            // ── 6. Cooldown guard — don't hammer the same package ─────────
            val samePackage     = pkg == fallbackLastBlockedPkg
            val cooldownExpired = (now - fallbackLastBlockedAtMs) > FALLBACK_COOLDOWN_MS
            if (!samePackage || cooldownExpired) {
                fallbackLastBlockedPkg = pkg
                fallbackLastBlockedAtMs = now
                handleFallbackBlock(pkg)
            }

            handler.postDelayed(this, FALLBACK_POLL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        serviceStartMs = System.currentTimeMillis()
        blockPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildIdleNotification())
        // Start the fallback blocker poll — it self-disables instantly when
        // accessibility is active, so there is zero overhead in the normal path.
        handler.postDelayed(fallbackPollRunnable, FALLBACK_POLL_MS)
        // Start the in-process VPN health check. First tick is staggered by
        // half the interval so it doesn't race the AccessibilityService check.
        handler.postDelayed(vpnHealthRunnable, VPN_HEALTH_CHECK_MS / 2)
        // Start the UsageStats allowance sync. Staggered 10 s to let other
        // startup work settle first. Runs every 60 s while the service is alive.
        handler.postDelayed(allowanceSyncRunnable, 10_000L)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                handler.removeCallbacks(tickRunnable)
                clearFocusActive()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SET_IDLE -> {
                handler.removeCallbacks(tickRunnable)
                handler.removeCallbacks(breakTickRunnable)
                clearFocusActive()
                goIdle()
                return START_STICKY
            }
            ACTION_SET_BREAK -> {
                enterBreak(intent?.getLongExtra(EXTRA_BREAK_UNTIL_MS, 0L) ?: 0L)
                return START_STICKY
            }
            ACTION_CLEAR_BREAK -> {
                resumeFromBreak()
                return START_STICKY
            }
            else -> {
                val id      = intent?.getStringExtra(EXTRA_TASK_ID)
                val name    = intent?.getStringExtra(EXTRA_TASK_NAME)
                val endMs   = intent?.getLongExtra(EXTRA_END_MS, 0L) ?: 0L
                val startMs = intent?.getLongExtra(EXTRA_START_MS, 0L) ?: 0L
                val next    = intent?.getStringExtra(EXTRA_NEXT_NAME)

                if (name != null && endMs > 0L) {
                    taskId    = id ?: ""
                    taskName  = name
                    endTimeMs = endMs
                    nextName  = next
                    breakUntilMs = 0L
                    handler.removeCallbacks(breakTickRunnable)

                    // Only reset the start time on the first launch of a session.
                    // If isActiveMode is already true this is an update call (e.g. after
                    // a +15m / +30m extend) — preserve the original startTimeMs so the
                    // notification progress bar continues from where it was, not from 0%.
                    if (!isActiveMode) {
                        // Prefer the actual task startTime from the JS layer (EXTRA_START_MS).
                        // Fall back to System.currentTimeMillis() only when not provided.
                        startTimeMs  = if (startMs > 0L) startMs else System.currentTimeMillis()
                        isActiveMode = true
                        // Persist start time so the widget can compute progress correctly
                        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .edit()
                            .putLong("task_start_ms", startTimeMs)
                            .apply()
                    } else {
                        // Update persisted end time so the widget reflects the extension
                        isActiveMode = true
                    }

                    val notification = buildActiveNotification(endMs - System.currentTimeMillis())
                    startForeground(NOTIFICATION_ID, notification)

                    // Acquire wake lock so the CPU stays alive during the session even
                    // when the screen turns off — prevents OEM schedulers from throttling
                    // the AccessibilityService on MIUI, ColorOS, and Samsung One UI.
                    WakeLockManager.acquire(this)

                    handler.removeCallbacks(tickRunnable)
                    handler.post(tickRunnable)

                    // Push widget update immediately — don't wait for the 30s tick
                    FocusFlowWidget.pushWidgetUpdate(applicationContext)
                } else if (intent == null) {
                    // Android OS restarted this service after it was killed (START_STICKY).
                    // All member variables are reset — restore session state from SharedPreferences.
                    val prefs        = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val focusActive  = prefs.getBoolean("focus_active", false)
                    val restoredBreakUntil = prefs.getLong("focus_break_until_ms", 0L)
                    if (restoredBreakUntil > System.currentTimeMillis()) {
                        taskId      = prefs.getString("task_id", "") ?: ""
                        taskName    = prefs.getString("task_name", "Focus session") ?: "Focus session"
                        endTimeMs   = prefs.getLong("task_end_ms", 0L)
                        nextName    = prefs.getString("next_task_name", null)
                        startTimeMs = prefs.getLong("task_start_ms", System.currentTimeMillis())
                        isActiveMode = true
                        breakUntilMs = restoredBreakUntil
                        startForeground(NOTIFICATION_ID, buildBreakNotification())
                        WakeLockManager.acquire(this)
                        handler.removeCallbacks(breakTickRunnable)
                        handler.post(breakTickRunnable)
                    } else if (focusActive) {
                        val restoredName  = prefs.getString("task_name", null)
                        val restoredEndMs = prefs.getLong("task_end_ms", 0L)
                        if (restoredName != null && restoredEndMs > System.currentTimeMillis()) {
                            // Session still running — restore it fully
                            taskId      = prefs.getString("task_id", "") ?: ""
                            taskName    = restoredName
                            endTimeMs   = restoredEndMs
                            nextName    = prefs.getString("next_task_name", null)
                            startTimeMs = prefs.getLong("task_start_ms", System.currentTimeMillis())
                            isActiveMode = true

                            val notification = buildActiveNotification(restoredEndMs - System.currentTimeMillis())
                            startForeground(NOTIFICATION_ID, notification)
                            WakeLockManager.acquire(this)
                            handler.removeCallbacks(tickRunnable)
                            handler.post(tickRunnable)
                            FocusFlowWidget.pushWidgetUpdate(applicationContext)
                        } else {
                            // Session expired while the service was dead — clean up
                            clearFocusActive()
                            goIdle()
                        }
                    }
                    // If focus_active == false, onCreate already started idle notification — nothing to do.
                } else {
                    // Intent with no task data — normal idle start from JS layer.
                    // Only go idle if we are not already running an active focus session.
                    // Without this guard, calling startIdleService() while focus is active
                    // (e.g. on app open) would destroy the active notification and block state.
                    if (!isActiveMode) {
                        goIdle()
                    }
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(tickRunnable)
        handler.removeCallbacks(fallbackPollRunnable)
        handler.removeCallbacks(vpnHealthRunnable)
        handler.removeCallbacks(allowanceSyncRunnable)
        allowanceExpiryRunnable?.let { handler.removeCallbacks(it) }
        WakeLockManager.release()
        super.onDestroy()
    }

    // ─── Mode helpers ──────────────────────────────────────────────────────────

    private fun goIdle() {
        isActiveMode = false
        breakUntilMs = 0L
        taskId       = ""
        taskName     = ""
        endTimeMs    = 0L
        startTimeMs  = 0L
        nextName     = null
        handler.removeCallbacks(tickRunnable)
        handler.removeCallbacks(breakTickRunnable)
        blockPrefs.edit().remove("focus_break_until_ms").apply()
        // Release the wake lock — CPU throttling is fine again when no session is active
        WakeLockManager.release()
        // Stop all aversive deterrents (dim overlay, vibration) if they were running
        AversiveActionsManager.stopAll(this)
        // Stop network blocking and restore connectivity if the restore flag is set
        stopNetworkBlock()
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildIdleNotification())
        // Update widget to idle state
        FocusFlowWidget.pushWidgetUpdate(applicationContext)
    }

    private fun enterBreak(untilMs: Long) {
        if (untilMs <= System.currentTimeMillis()) {
            resumeFromBreak()
            return
        }
        breakUntilMs = untilMs
        blockPrefs.edit()
            .putBoolean("focus_active", false)
            .putLong("focus_break_until_ms", untilMs)
            .apply()
        handler.removeCallbacks(tickRunnable)
        handler.removeCallbacks(breakTickRunnable)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildBreakNotification())
        handler.postDelayed(breakTickRunnable, 1_000L)
        FocusFlowWidget.pushWidgetUpdate(applicationContext)
    }

    private fun resumeFromBreak() {
        breakUntilMs = 0L
        blockPrefs.edit()
            .putBoolean("focus_active", true)
            .remove("focus_break_until_ms")
            .apply()
        handler.removeCallbacks(breakTickRunnable)
        if (isActiveMode && endTimeMs > System.currentTimeMillis()) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIFICATION_ID, buildActiveNotification(endTimeMs - System.currentTimeMillis()))
            handler.removeCallbacks(tickRunnable)
            handler.post(tickRunnable)
        } else if (isActiveMode) {
            goIdle()
        }
        FocusFlowWidget.pushWidgetUpdate(applicationContext)
    }

    /**
     * Stops the VPN network blocker when a focus session ends.
     * Only acts if net_block_enabled is true. Does NOT stop the VPN if a
     * standalone block session is still active — the VPN must keep running
     * for the standalone block even after the focus session ends.
     */
    private fun stopNetworkBlock() {
        val prefs = getSharedPreferences(AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("net_block_enabled", false)) return
        // Guard: if a standalone block or persistent VPN-only list is active,
        // leave the VPN running after the focus task ends.
        val saActive = prefs.getBoolean("standalone_block_active", false)
        if (saActive) {
            val untilMs = prefs.getLong("standalone_block_until_ms", 0L)
            if (untilMs <= 0L || System.currentTimeMillis() < untilMs) return
        }
        if (NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)) return
        try {
            // Focus teardown is a policy update. Let the coordinator serialize
            // the stop with any queued start or reconfiguration command.
            VpnPolicyCoordinator.requestSync(this)
        } catch (e: Exception) {
            prefs.edit()
                .putString("vpn_status", NetworkBlockerVpnService.STATUS_STARTUP_FAILED)
                .putString("vpn_error", e.message ?: "ForegroundTaskService could not stop VPN service")
                .apply()
        }
    }

    // ─── VPN health check ──────────────────────────────────────────────────────

    /**
     * Checks whether the VPN tunnel should be running and restarts it if not.
     * Mirrors the same logic in AppBlockerAccessibilityService but runs inside
     * ForegroundTaskService, which is typically more resilient to OEM killers.
     *
     * Guards:
     *   • net_block_self_heal must be true  (user opted in)
     *   • net_block_vpn must be true        (VPN mechanism selected)
     *   • VPN is not already running
     *   • A blocking session is currently active
     *   • VPN permission is still held
     */
    private fun checkAndHealVpn() {
        val prefs = blockPrefs
        if (!prefs.getBoolean("net_block_self_heal", false)) return
        if (!prefs.getBoolean("net_block_vpn", true)) return
        if (NetworkBlockerVpnService.isRunning) return

        val now = System.currentTimeMillis()
        val focusActive = prefs.getBoolean("focus_active", false).let { on ->
            if (!on) false
            else {
                val endMs = prefs.getLong("task_end_ms", 0L)
                endMs <= 0L || now < endMs
            }
        }
        val saActive = prefs.getBoolean("standalone_block_active", false).let { on ->
            if (!on) false
            else {
                val untilMs = prefs.getLong("standalone_block_until_ms", 0L)
                untilMs <= 0L || now < untilMs
            }
        }
        if (!focusActive && !saActive &&
            !NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)
        ) return

        // Cannot restart without VPN permission.
        // Write the permission-lost flag so the JS layer can surface a re-grant prompt.
        try {
            if (android.net.VpnService.prepare(this) != null) {
                prefs.edit().putBoolean("vpn_permission_lost", true).apply()
                VpnRecoveryNotifier.postPermissionRequired(this)
                return
            }
        } catch (_: Exception) { return }

        try {
            // The coordinator owns recovery dispatch and generation ordering.
            VpnPolicyCoordinator.requestRecoverySync(this)
        } catch (e: Exception) {
            blockPrefs.edit()
                .putString("vpn_status", NetworkBlockerVpnService.STATUS_STARTUP_FAILED)
                .putString("vpn_error", e.message ?: "ForegroundTaskService could not start VPN service")
                .apply()
        }
    }

    // ─── Notification builders ─────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps FocusFlow running and shows your active task"
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
            // Also create the high-importance task-alarm channel up front so the
            // first task end is not delayed waiting for channel creation.
            createTaskAlarmChannel(nm)
        }
    }

    /**
     * High-importance task-alarm channel.  Must include sound + vibration so
     * the heads-up notification presents and the full-screen-intent is honoured
     * even when the screen is off.
     */
    private fun createTaskAlarmChannel(nm: NotificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val existing = nm.getNotificationChannel(TASK_ALARM_CHANNEL)
        if (existing != null) return
        val alarmUri = android.media.RingtoneManager.getDefaultUri(
            android.media.RingtoneManager.TYPE_ALARM
        )
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            TASK_ALARM_CHANNEL,
            "Task Alarm",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Wakes the screen with a full-screen alarm when a task ends"
            enableVibration(true)
            vibrationPattern = longArrayOf(0L, 600L, 600L, 600L)
            enableLights(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setBypassDnd(true)
            setShowBadge(true)
            if (alarmUri != null) setSound(alarmUri, attrs)
        }
        nm.createNotificationChannel(channel)
    }

    /**
     * Instance-level wrapper kept for the in-process tick path. Delegates to
     * the static [postTaskEndAlarmNotification] helper so the AlarmManager
     * receiver and the Handler tick share one canonical implementation.
     */
    private fun triggerTaskAlarm(endedTaskId: String, endedTaskName: String, endedAtMs: Long) {
        postTaskEndAlarmNotification(applicationContext, endedTaskId, endedTaskName, endedAtMs)
    }

    private fun buildIdleNotification(): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPending = PendingIntent.getActivity(
            this, PI_TAP, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // Chronometer base: convert the wall-clock serviceStartMs to an
        // elapsedRealtime value so the chronometer counts UP from that point.
        // This shows the true "monitoring active since X" elapsed time rather
        // than resetting to zero every time goIdle() rebuilds the notification.
        val idleChronometerBase = SystemClock.elapsedRealtime() -
                (System.currentTimeMillis() - serviceStartMs)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FocusFlow")
            .setContentText("Monitoring active — tap to open")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tapPending)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setWhen(idleChronometerBase)
            .setUsesChronometer(true)
            .setChronometerCountDown(false)
            .setShowWhen(true)
            .build()
    }

    private fun buildActiveNotification(remainingMs: Long): Notification {
        // ── End time label — "ends at 2:30 PM" ──
        val cal = Calendar.getInstance().apply { timeInMillis = endTimeMs }
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val min  = cal.get(Calendar.MINUTE)
        val amPm = if (hour < 12) "AM" else "PM"
        val hour12 = when {
            hour == 0  -> 12
            hour > 12  -> hour - 12
            else       -> hour
        }
        val endLabel = String.format("%d:%02d %s", hour12, min, amPm)

        // ── Progress bar: 0..100 based on elapsed vs total ──
        val totalMs   = if (startTimeMs > 0L) endTimeMs - startTimeMs else remainingMs
        val elapsedMs = (totalMs - remainingMs).coerceAtLeast(0L)
        val progressPct = if (totalMs > 0L) {
            ((elapsedMs * 100L) / totalMs).toInt().coerceIn(0, 100)
        } else 0

        // ── Chronometer base: counts down to endTimeMs ──
        // setWhen(endTimeMs) + setUsesChronometer(true) + setChronometerCountDown(true)
        // gives a native live ticking countdown in the notification — no polling needed.
        val chronometerBase = endTimeMs - System.currentTimeMillis() + SystemClock.elapsedRealtime()

        // ── Tap: open app ──
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPending = PendingIntent.getActivity(
            this, PI_TAP, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ── Action: ✓ Done ──
        val completeIntent = Intent(NotificationActionReceiver.ACTION_COMPLETE).apply {
            `package` = packageName
            putExtra(NotificationActionReceiver.EXTRA_TASK_ID, taskId)
        }
        val completePending = PendingIntent.getBroadcast(
            this, PI_COMPLETE, completeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ── Action: +15m ──
        val extend15Intent = Intent(NotificationActionReceiver.ACTION_EXTEND).apply {
            `package` = packageName
            putExtra(NotificationActionReceiver.EXTRA_TASK_ID, taskId)
            putExtra(NotificationActionReceiver.EXTRA_MINUTES, 15)
        }
        val extend15Pending = PendingIntent.getBroadcast(
            this, PI_EXTEND15, extend15Intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ── Action: +30m ──
        val extend30Intent = Intent(NotificationActionReceiver.ACTION_EXTEND).apply {
            `package` = packageName
            putExtra(NotificationActionReceiver.EXTRA_TASK_ID, taskId)
            putExtra(NotificationActionReceiver.EXTRA_MINUTES, 30)
        }
        val extend30Pending = PendingIntent.getBroadcast(
            this, PI_EXTEND30, extend30Intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ── Action: Skip ──
        val skipIntent = Intent(NotificationActionReceiver.ACTION_SKIP).apply {
            `package` = packageName
            putExtra(NotificationActionReceiver.EXTRA_TASK_ID, taskId)
        }
        val skipPending = PendingIntent.getBroadcast(
            this, PI_SKIP, skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🎯 $taskName")
            .setContentText("ends $endLabel")
            .setSubText(nextName?.let { "Next: $it" })
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tapPending)
            // Live ticking countdown — Android handles this natively, no polling for display
            .setWhen(chronometerBase)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setShowWhen(true)
            // Progress bar showing session completion
            .setProgress(100, progressPct, false)
            .addAction(0, "✓ Done",  completePending)
            .addAction(0, "+15m",    extend15Pending)
            .addAction(0, "+30m",    extend30Pending)
            .addAction(0, "Skip",    skipPending)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(remainingMs: Long) {
        val notification = buildActiveNotification(remainingMs)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }

    private fun buildBreakNotification(): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPending = PendingIntent.getActivity(
            this, PI_TAP, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val chronometerBase = breakUntilMs - System.currentTimeMillis() + SystemClock.elapsedRealtime()
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("☕ Break · $taskName")
            .setContentText("Apps temporarily unlocked")
            .setSubText("Back to work when the break ends")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tapPending)
            .setWhen(chronometerBase)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setShowWhen(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun clearFocusActive() {
        getSharedPreferences(AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("focus_active", false)
            .apply()
    }

    // ─── Fallback blocker helpers ───────────────────────────────────────────────

    /**
     * Returns true if our AppBlockerAccessibilityService is currently active.
     * When true the fallback poller defers entirely — accessibility is faster
     * and event-driven so there is no value in running the polling path too.
     */
    private fun isAccessibilityServiceEnabled(): Boolean {
        return try {
            val enabled = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            enabled.contains(packageName, ignoreCase = true)
        } catch (_: Exception) { false }
    }

    /**
     * Returns the package name of the currently visible foreground app using
     * UsageStatsManager.  Returns null if the permission is not granted or the
     * query returns no results.
     *
     * A 5-second look-back window is used to find the latest foreground event,
     * rather than treating the most-recently-used app for the day as current.
     */
    private fun getFallbackForegroundPackage(): String? {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(now - 5_000L, now)
            val event = UsageEvents.Event()
            val foregroundType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                UsageEvents.Event.ACTIVITY_RESUMED
            } else {
                UsageEvents.Event.MOVE_TO_FOREGROUND
            }
            var latest: String? = null
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == foregroundType) {
                    latest = event.packageName
                }
            }
            latest
        } catch (_: Exception) { null }
    }

    /**
     * Mirrors the core blocking logic from AppBlockerAccessibilityService using
     * the same SharedPreferences. The AccessibilityService owns allowance
     * accounting; this service only reads the persisted result and enforces it
     * when the primary service is unavailable.
     */
    private fun isFallbackBlocked(
        pkg: String,
        focusActive: Boolean,
        saActive: Boolean,
        greyoutJson: String
    ): Boolean {
        // ── Task focus: block anything NOT in the allowed list ────────────
        if (focusActive) {
            val allowedJson = blockPrefs.getString("allowed_packages", "[]") ?: "[]"
            val allowed = try {
                val arr = JSONArray(allowedJson)
                (0 until arr.length()).map { arr.getString(it) }.toSet()
            } catch (_: Exception) { emptySet() }
            if (!allowed.any { pkg.equals(it, ignoreCase = true) }) return true
        }

        // ── Standalone block: block anything IN the blocked list ──────────
        if (saActive) {
            val blockedJson = blockPrefs.getString("standalone_blocked_packages", "[]") ?: "[]"
            try {
                val arr = JSONArray(blockedJson)
                for (i in 0 until arr.length()) {
                    if (pkg.equals(arr.getString(i), ignoreCase = true)) return true
                }
            } catch (_: Exception) { }
        }

        // ── Greyout schedule ──────────────────────────────────────────────
        if (greyoutJson != "[]" && greyoutJson.isNotEmpty()) {
            try {
                val arr = org.json.JSONArray(greyoutJson)
                val cal = java.util.Calendar.getInstance()
                val currentDay  = cal.get(java.util.Calendar.DAY_OF_WEEK)
                val currentMins = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 +
                                  cal.get(java.util.Calendar.MINUTE)
                for (i in 0 until arr.length()) {
                    val entry = arr.optJSONObject(i) ?: continue
                    if (!entry.optString("pkg").equals(pkg, ignoreCase = true)) continue
                    val days = entry.optJSONArray("days") ?: continue
                    val startMins = entry.optInt("startHour") * 60 + entry.optInt("startMin")
                    val endMins   = entry.optInt("endHour")   * 60 + entry.optInt("endMin")
                    val overnight = startMins > endMins
                    val afterMidnight = overnight && currentMins < endMins
                    val dayForWindow = if (afterMidnight) {
                        if (currentDay == java.util.Calendar.SUNDAY) {
                            java.util.Calendar.SATURDAY
                        } else {
                            currentDay - 1
                        }
                    } else {
                        currentDay
                    }
                    val dayMatch = (0 until days.length()).any { days.optInt(it) == dayForWindow }
                    if (!dayMatch) continue
                    val inWindow  = if (startMins <= endMins)
                        currentMins in startMins until endMins
                    else
                        currentMins >= startMins || currentMins < endMins
                    if (inWindow) return true
                }
            } catch (_: Exception) { }
        }

        // ── Always-on enforcement ─────────────────────────────────────────
        val alwaysBlockActive = blockPrefs.getBoolean("always_block_active", false)
        if (alwaysBlockActive) {
            val alwaysJson = blockPrefs.getString("always_block_packages", "[]") ?: "[]"
            try {
                val arr = JSONArray(alwaysJson)
                for (i in 0 until arr.length()) {
                    if (pkg.equals(arr.getString(i), ignoreCase = true)) return true
                }
            } catch (_: Exception) { }
        }

        // ── Daily allowance exhaustion (read-only mirror of A11y state) ────
        val configJson = blockPrefs.getString("daily_allowance_config", null)
        if (!configJson.isNullOrBlank() && configJson != "null") {
            try {
                val today = java.text.SimpleDateFormat(
                    "yyyy-MM-dd",
                    java.util.Locale.US,
                ).apply {
                    timeZone = java.util.TimeZone.getDefault()
                }.format(java.util.Date())
                val now = System.currentTimeMillis()
                val arr = JSONArray(configJson)
                for (i in 0 until arr.length()) {
                    val entry = arr.optJSONObject(i) ?: continue
                    if (!entry.optString("packageName", "")
                            .equals(pkg, ignoreCase = true)) continue

                    val usedJson = blockPrefs.getString("daily_allowance_used", "{}") ?: "{}"
                    val pkgUsed = try {
                        org.json.JSONObject(usedJson).optJSONObject(pkg)
                    } catch (_: Exception) {
                        null
                    } ?: break

                    when (entry.optString("mode", "count")) {
                        "count" -> {
                            val usedDate = pkgUsed.optString("date", "")
                            val count = if (usedDate == today) {
                                pkgUsed.optInt("count", 0)
                            } else {
                                0
                            }
                            if (count >= entry.optInt("countPerDay", 1).coerceAtLeast(1)) {
                                return true
                            }
                        }
                        "time_budget" -> {
                            val usedDate = pkgUsed.optString("date", "")
                            val usedMs = if (usedDate == today) {
                                pkgUsed.optLong("usedMs", 0L)
                            } else {
                                0L
                            }
                            val budgetMs = entry.optInt("budgetMinutes", 30)
                                .toLong() * 60_000L
                            if (usedMs >= budgetMs) return true
                        }
                        "interval" -> {
                            val windowStartMs = pkgUsed.optLong("windowStartMs", 0L)
                            val windowMs = entry.optInt("intervalHours", 1)
                                .toLong() * 3_600_000L
                            if (now <= windowStartMs + windowMs) {
                                val usedMs = pkgUsed.optLong("usedMs", 0L)
                                val intervalMs = entry.optInt("intervalMinutes", 5)
                                    .toLong() * 60_000L
                                if (usedMs >= intervalMs) return true
                            }
                        }
                    }
                    break
                }
            } catch (_: Exception) { }
        }

        return false
    }

    /**
     * Fallback enforcement action: launches [BlockOverlayActivity] via a
     * full-screen notification PendingIntent.
     *
     * Using a full-screen intent (rather than startActivity) bypasses the
     * Android 10+ restriction that prevents foreground services from starting
     * activities directly — the system launches the activity on our behalf so
     * SYSTEM_ALERT_WINDOW is not required.
     *
     * overlay_x_ready is written after a short delay so the X button only
     * appears once the overlay is visually in front (no accessibility events
     * are available in this no-accessibility path).
     */
    private fun handleFallbackBlock(blockedPackage: String) {
        // Signal overlay to await the blocked package leaving foreground
        blockPrefs.edit().putString("overlay_awaiting_pkg", blockedPackage).apply()

        // Resolve display name
        val appName = try {
            val pm   = applicationContext.packageManager
            val info = pm.getApplicationInfo(blockedPackage, 0)
            pm.getApplicationLabel(info).toString()
        } catch (_: Exception) { blockedPackage }

        // Build the PendingIntent pointing at BlockOverlayActivity
        val activityIntent = Intent(applicationContext, BlockOverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(BlockOverlayActivity.EXTRA_BLOCKED_PKG, blockedPackage)
            putExtra(BlockOverlayActivity.EXTRA_BLOCKED_NAME, appName)
        }
        val pi = PendingIntent.getActivity(
            applicationContext, 0, activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Ensure the block-alert channel exists
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                BLOCK_ALERT_CHANNEL, "Block Alert", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }
            nm?.createNotificationChannel(ch)
        }

        // Post the full-screen intent notification — system launches the activity
        val notif = android.app.Notification.Builder(
            applicationContext,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) BLOCK_ALERT_CHANNEL else CHANNEL_ID
        ).apply {
            setSmallIcon(android.R.drawable.ic_lock_lock)
            setContentTitle("App Blocked")
            setContentText("\u201C$appName\u201D is blocked during this session.")
            setFullScreenIntent(pi, true)
            setAutoCancel(true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
            }
        }.build()
        nm?.notify(BLOCK_ALERT_NOTIF_ID, notif)

        // Auto-cancel the alert notification after 2 s (activity already showing)
        // and write overlay_x_ready so the X button fades in.
        handler.postDelayed({
            nm?.cancel(BLOCK_ALERT_NOTIF_ID)
            blockPrefs.edit()
                .putBoolean(BlockOverlayActivity.PREF_OVERLAY_X_READY, true)
                .putString("overlay_awaiting_pkg", "")
                .apply()
        }, 2_000L)
    }
}
