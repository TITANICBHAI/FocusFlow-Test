package com.tbtechs.focusflow.services

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.tbtechs.focusflow.modules.FocusDayBridgeModule

/**
 * TaskAlarmActivity
 *
 * Full-screen alarm shown when a task hits its end time.  Launched via the
 * full-screen-intent of a high-importance heads-up notification posted from
 * [ForegroundTaskService] so it wakes the device and renders over the
 * lockscreen even when the screen is asleep.
 *
 * UI:
 *   • Wakes the screen, shows over keyguard.
 *   • Plays the system alarm ringtone in a loop.
 *   • Vibrates with a repeating pattern.
 *   • Three buttons (Done / Extend +15m / Skip) backed by the same
 *     NotificationActionReceiver flow as the in-app prompt and the persistent
 *     notification action buttons, so all three paths feed identical state into
 *     taskService.completeTask / extendTaskTime / skipTask.
 *
 * Dismissal:
 *   • Tapping Done / Extend / Skip resolves the task via the bridge and
 *     finishes the activity.
 *   • If the user resolves the task from the React UI instead, the JS layer
 *     calls TaskAlarmModule.dismissAlarm() which sends [ACTION_DISMISS_ALARM]
 *     and the activity finishes.
 *   • Back / power keys are swallowed — the user must explicitly pick one of
 *     the three actions, otherwise the task remains in the awaiting-decision
 *     state per task #3 spec.
 */
class TaskAlarmActivity : Activity() {

    companion object {
        const val EXTRA_TASK_ID    = "taskId"
        const val EXTRA_TASK_NAME  = "taskName"
        const val EXTRA_END_MS     = "endTimeMs"

        /** JS-driven dismiss broadcast — fired by TaskAlarmModule.dismissAlarm(). */
        const val ACTION_DISMISS_ALARM = "com.tbtechs.focusflow.alarm.DISMISS"

        /** Default extension when the user taps the alarm Extend button. */
        private const val DEFAULT_EXTEND_MINUTES = 15
    }

    private var taskId: String   = ""
    private var taskName: String = ""

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val handler = Handler(Looper.getMainLooper())

    private val dismissReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            // Only finish if this dismiss is meant for our taskId, or no id
            // was provided (broadcast-to-all).
            val incoming = intent.getStringExtra(EXTRA_TASK_ID)
            if (incoming.isNullOrEmpty() || incoming == taskId) {
                stopAlarmAndFinish()
            }
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        taskId   = intent?.getStringExtra(EXTRA_TASK_ID) ?: ""
        taskName = intent?.getStringExtra(EXTRA_TASK_NAME) ?: ""

        applyAlarmWindowFlags()
        buildUI()
        startRingtone()
        startVibration()
        acquireWakeLock()

        val filter = IntentFilter(ACTION_DISMISS_ALARM)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(dismissReceiver, filter)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.getStringExtra(EXTRA_TASK_ID)?.let { if (it.isNotEmpty()) taskId = it }
        intent?.getStringExtra(EXTRA_TASK_NAME)?.let { if (it.isNotEmpty()) taskName = it }
    }

    override fun onDestroy() {
        try { unregisterReceiver(dismissReceiver) } catch (_: Exception) {}
        stopRingtone()
        stopVibration()
        releaseWakeLock()
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Swallow — the user must pick Done / Extend / Skip
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_POWER) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_POWER) return true
        return super.onKeyUp(keyCode, event)
    }

    // ─── Window flags: wake screen, show over lockscreen ──────────────────────

    private fun applyAlarmWindowFlags() {
        window.apply {
            addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            // Ask the system to dismiss a non-secure keyguard so the alarm UI
            // is fully interactive.  No-op if the device has a secure lock.
            val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            km?.requestDismissKeyguard(this, null)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────

    private fun buildUI() {
        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.parseColor("#0C0C1A"),
                    Color.parseColor("#1A1245")
                )
            )
        }

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(80), dp(32), dp(40))
        }

        col.addView(TextView(this).apply {
            text = "\u23F0"   // ⏰
            textSize = 64f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(28) }
        })

        col.addView(TextView(this).apply {
            text = "Time's up"
            textSize = 14f
            setTextColor(Color.parseColor("#FFB169"))
            gravity = Gravity.CENTER
            letterSpacing = 0.16f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        })

        col.addView(TextView(this).apply {
            text = if (taskName.isNotEmpty()) taskName else "Your task has ended"
            textSize = 26f
            setTextColor(Color.parseColor("#FFFFFF"))
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.3f)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(48) }
        })

        col.addView(buildButton("\u2713  Done",      "#22C55E") { onDoneTapped() })
        col.addView(buildButton("+15m  Extend",     "#6366F1") { onExtendTapped() })
        col.addView(buildButton("Skip",              "#444466") { onSkipTapped() })

        root.addView(col)
        setContentView(root)
    }

    private fun buildButton(label: String, bgHex: String, onTap: () -> Unit): TextView =
        TextView(this).apply {
            text = label
            textSize = 17f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(Color.parseColor(bgHex))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(14) }
            isClickable = true
            isFocusable = true
            setOnClickListener { onTap() }
        }

    // ─── Action handlers — reuse NotificationActionReceiver flow ──────────────

    private fun onDoneTapped() {
        fireNotifAction(NotificationActionReceiver.ACTION_COMPLETE, 0)
        stopAlarmAndFinish()
    }

    private fun onExtendTapped() {
        fireNotifAction(NotificationActionReceiver.ACTION_EXTEND, DEFAULT_EXTEND_MINUTES)
        stopAlarmAndFinish()
    }

    private fun onSkipTapped() {
        fireNotifAction(NotificationActionReceiver.ACTION_SKIP, 0)
        stopAlarmAndFinish()
    }

    /**
     * Sends the same broadcast the persistent notification action buttons do.
     * NotificationActionReceiver persists a fallback entry to SharedPrefs and
     * fires the bridge broadcast, so the JS taskService methods are invoked
     * even if the React instance is not currently alive.
     */
    private fun fireNotifAction(action: String, minutes: Int) {
        if (taskId.isEmpty()) return
        val intent = Intent(action).apply {
            `package` = packageName
            setClass(applicationContext, NotificationActionReceiver::class.java)
            putExtra(NotificationActionReceiver.EXTRA_TASK_ID, taskId)
            putExtra(NotificationActionReceiver.EXTRA_MINUTES, minutes)
        }
        sendBroadcast(intent)
    }

    // ─── Ringtone / Vibration / Wakelock ──────────────────────────────────────

    private fun startRingtone() {
        try {
            val uri: Uri = RingtoneManager.getActualDefaultRingtoneUri(
                this, RingtoneManager.TYPE_ALARM
            ) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION) ?: return
            val rt = RingtoneManager.getRingtone(applicationContext, uri) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                rt.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                rt.isLooping = true
            }
            rt.play()
            ringtone = rt
        } catch (_: Exception) { /* best-effort */ }
    }

    private fun stopRingtone() {
        try { ringtone?.stop() } catch (_: Exception) {}
        ringtone = null
    }

    private fun startVibration() {
        try {
            val v: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (v == null || !v.hasVibrator()) return
            // Pattern: wait 0, vibrate 600, pause 600, vibrate 600, pause 1200 — repeat
            val pattern = longArrayOf(0L, 600L, 600L, 600L, 1200L)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(pattern, 0)
            }
            vibrator = v
        } catch (_: Exception) { /* best-effort */ }
    }

    private fun stopVibration() {
        try { vibrator?.cancel() } catch (_: Exception) {}
        vibrator = null
    }

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            @Suppress("DEPRECATION")
            val wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "FocusFlow:TaskAlarm"
            )
            wl.setReferenceCounted(false)
            wl.acquire(5 * 60 * 1000L)
            wakeLock = wl
        } catch (_: Exception) {}
    }

    private fun releaseWakeLock() {
        try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
        wakeLock = null
    }

    // ─── Dismissal ────────────────────────────────────────────────────────────

    private fun stopAlarmAndFinish() {
        stopRingtone()
        stopVibration()
        // Cancel the heads-up notification posted alongside the full-screen intent.
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE)
                as? android.app.NotificationManager
            nm?.cancel(ForegroundTaskService.TASK_ALARM_NOTIF_ID)
        } catch (_: Exception) {}
        finish()
    }

    /** Suppress unused-field warning — referenced via JS/native bridge symmetry. */
    @Suppress("unused")
    private val bridgeName = FocusDayBridgeModule.NAME

    private fun dp(v: Int): Int =
        (v * resources.displayMetrics.density + 0.5f).toInt()
}
