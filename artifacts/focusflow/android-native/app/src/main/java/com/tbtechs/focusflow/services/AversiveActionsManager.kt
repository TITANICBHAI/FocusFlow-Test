package com.tbtechs.focusflow.services

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.WindowManager

/**
 * AversiveActionsManager
 *
 * Singleton that applies psychological and physical deterrents the instant
 * a blocked app is detected in the foreground.  Three independent layers,
 * each toggled by a SharedPreferences flag so the user can pick any mix:
 *
 *   Screen Dimmer  — adds a near-black WindowManager overlay (SYSTEM_ALERT_WINDOW).
 *                    The app is technically usable but the screen is so dark it
 *                    provides almost zero dopamine reward.  Touch events pass through.
 *
 *   Vibration      — pulses the vibration motor in a short, annoying repeating pattern
 *                    (100 ms on, 200 ms off) using a Handler loop so it can be stopped
 *                    cleanly.  Uses VibrationEffect on API 26+ and the legacy API below.
 *
 *   Sound Alert    — plays the default notification ringtone once.  Classic aversion
 *                    conditioning — the brain starts associating the sound with the
 *                    "caught" feeling.
 *
 * Prefs keys (file "focusday_prefs"):
 *   aversion_dimmer_enabled   Boolean  (default false)
 *   aversion_vibrate_enabled  Boolean  (default false)
 *   aversion_sound_enabled    Boolean  (default false)
 *
 * All methods are safe to call from the AccessibilityService thread.
 */
object AversiveActionsManager {

    private const val PREFS_NAME = "focusday_prefs"

    private val mainHandler = Handler(Looper.getMainLooper())

    // ── Dim overlay ──────────────────────────────────────────────────────────

    private var dimView: View? = null
    private var windowManager: WindowManager? = null

    // ── Vibration loop ───────────────────────────────────────────────────────

    private var vibrationRunnable: Runnable? = null
    private var vibrating = false

    // ── Active ringtone ──────────────────────────────────────────────────────

    private var activeRingtone: Ringtone? = null

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Called by [AppBlockerAccessibilityService] the instant a blocked app is
     * detected.  Activates whichever aversive layers are enabled.
     */
    fun onBlockedApp(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val dimmer   = prefs.getBoolean("aversion_dimmer_enabled",  false)
        val vibrate  = prefs.getBoolean("aversion_vibrate_enabled", false)
        val sound    = prefs.getBoolean("aversion_sound_enabled",   false)

        if (dimmer)  showDimOverlay(context)
        if (vibrate) startVibration(context)
        if (sound)   playAlertSound(context)
    }

    /**
     * Stops all active aversive layers.  Call from [ForegroundTaskService.goIdle]
     * and whenever a session ends or the overlay is dismissed.
     */
    fun stopAll(context: Context) {
        stopDimOverlay(context)
        stopVibration(context)
        stopRingtone()
    }

    // ─── Screen Dimmer ────────────────────────────────────────────────────────

    private fun showDimOverlay(context: Context) {
        mainHandler.post {
            if (dimView != null) return@post  // already showing
            try {
                val wm = context.applicationContext
                    .getSystemService(Context.WINDOW_SERVICE) as WindowManager
                windowManager = wm

                val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_SYSTEM_OVERLAY

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).also {
                    // Physically reduce the backlight to near-zero — this is actual
                    // brightness dimming, not just a dark overlay on top.
                    // 0.0f = minimum brightness, 1.0f = full brightness.
                    it.screenBrightness = 0.02f
                }

                val view = View(context.applicationContext).apply {
                    setBackgroundColor(Color.argb(180, 0, 0, 0))
                }
                wm.addView(view, params)
                dimView = view
            } catch (_: Exception) {
                // SYSTEM_ALERT_WINDOW not yet granted or other error — degrade gracefully
            }
        }
    }

    private fun stopDimOverlay(context: Context) {
        mainHandler.post {
            val view = dimView ?: return@post
            try {
                val wm = windowManager
                    ?: (context.applicationContext
                        .getSystemService(Context.WINDOW_SERVICE) as WindowManager)
                wm.removeView(view)
            } catch (_: Exception) { }
            dimView = null
            windowManager = null
        }
    }

    // ─── Vibration Harassment ─────────────────────────────────────────────────

    private fun startVibration(context: Context) {
        if (vibrating) return
        vibrating = true

        val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.applicationContext
                .getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.applicationContext
                .getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        val pulsePattern = longArrayOf(0, 120, 220, 120)

        fun schedulePulse() {
            if (!vibrating) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(pulsePattern, -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pulsePattern, -1)
            }
            val r = Runnable { schedulePulse() }
            vibrationRunnable = r
            mainHandler.postDelayed(r, 1_800L)
        }

        mainHandler.post { schedulePulse() }
    }

    private fun stopVibration(context: Context) {
        vibrating = false
        vibrationRunnable?.let { mainHandler.removeCallbacks(it) }
        vibrationRunnable = null
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.applicationContext
                    .getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.cancel()
            } else {
                @Suppress("DEPRECATION")
                val v = context.applicationContext
                    .getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                v.cancel()
            }
        } catch (_: Exception) { }
    }

    // ─── Sound Alert ──────────────────────────────────────────────────────────

    private fun playAlertSound(context: Context) {
        try {
            stopRingtone()  // stop any previous tone still playing
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(context.applicationContext, uri)
            ringtone?.play()
            activeRingtone = ringtone
        } catch (_: Exception) { }
    }

    private fun stopRingtone() {
        try {
            activeRingtone?.stop()
        } catch (_: Exception) { }
        activeRingtone = null
    }
}
