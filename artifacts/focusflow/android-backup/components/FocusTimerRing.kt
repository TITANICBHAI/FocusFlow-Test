package com.tbtechs.focusflow.services.components

import android.content.Context
import android.content.SharedPreferences
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.FrameLayout
import android.widget.TextClock
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService

/**
 * FocusTimerRing - Material 3 Focus Timer Ring Component
 *
 * Combines a large CircularProgressIndicator (focus session progress) with a TextClock
 * centered inside. Replaces the traditional digital clock during active focus sessions.
 *
 * When no focus session is active, shows the regular digital clock.
 * When focus session is active, shows the progress ring with time remaining in center.
 */
class FocusTimerRing @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private lateinit var prefs: SharedPreferences
    private val progressIndicator: CircularProgressIndicator
    private val timeClock: TextClock
    private val timeRemainingView: TextView
    private val dateView: TextView
    private val ampmView: TextView

    private var focusActive = false
    private var focusEndMs = 0L
    private var tickRunnable: Runnable? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    init {
        prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )

        // Inflate the layout
        LayoutInflater.from(context).inflate(R.layout.component_focus_timer_ring, this, true)

        progressIndicator = findViewById(R.id.focus_progress_indicator)
        timeClock = findViewById(R.id.focus_time_clock)
        timeRemainingView = findViewById(R.id.focus_time_remaining)
        dateView = findViewById(R.id.focus_date_view)
        ampmView = findViewById(R.id.focus_ampm_view)

        // Configure progress indicator (Material 3 CircularProgressIndicator)
        progressIndicator.apply {
            indicatorSize = 200.dpToPx()
            trackThickness = 8.dpToPx()
            indicatorColor = ContextCompat.getColor(context, R.color.focus_indigo)
            trackColor = ContextCompat.getColor(context, R.color.surface_variant_light)
            progress = 0
            visibility = GONE
        }

        // Configure TextClock for digital time (shown when no focus)
        timeClock.apply {
            format12Hour = "hh:mm"
            setTextColor(android.graphics.Color.WHITE)
            textSize = 72f
            typeface = android.graphics.Typeface.create(
                android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD
            )
            gravity = android.view.Gravity.CENTER
        }

        // Time remaining text (shown during focus)
        timeRemainingView.apply {
            setTextColor(android.graphics.Color.WHITE)
            textSize = 24f
            gravity = android.view.Gravity.CENTER
            visibility = GONE
        }

        // Date view
        dateView.apply {
            setTextColor(android.graphics.Color.parseColor("#EEF0FF"))
            textSize = 13f
            gravity = android.view.Gravity.CENTER
            letterSpacing = 0.12f
        }

        // AM/PM view
        ampmView.apply {
            setTextColor(android.graphics.Color.parseColor("#EEF0FF"))
            textSize = 20f
            gravity = android.view.Gravity.BOTTOM
        }

        // Initial state check
        updateFocusState()

        // Start periodic check for focus state changes
        startTick()
    }

    private fun startTick() {
        tickRunnable = object : Runnable {
            override fun run() {
                updateFocusState()
                handler.postDelayed(this, 1000)
            }
        }
        handler.post(tickRunnable!!)
    }

    private fun updateFocusState() {
        val now = System.currentTimeMillis()
        val newFocusActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false) &&
            prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L) > now

        if (newFocusActive != focusActive) {
            focusActive = newFocusActive
            focusEndMs = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L)
            updateUI()
        } else if (focusActive) {
            focusEndMs = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L)
            updateProgress()
        }
    }

    private fun updateUI() {
        if (focusActive) {
            // Show focus mode UI
            progressIndicator.visibility = VISIBLE
            timeClock.visibility = GONE
            timeRemainingView.visibility = VISIBLE
            updateProgress()
        } else {
            // Show normal clock UI
            progressIndicator.visibility = GONE
            timeClock.visibility = VISIBLE
            timeRemainingView.visibility = GONE
        }
    }

    private fun updateProgress() {
        if (!focusActive) return

        val now = System.currentTimeMillis()
        val totalDuration = focusEndMs - prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_START_MS, now)
        val elapsed = now - prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_START_MS, now)

        val progress = if (totalDuration > 0) {
            (elapsed.toFloat() / totalDuration.toFloat()).coerceIn(0f, 1f)
        } else 0f

        progressIndicator.progress = progress

        val remainingMs = (focusEndMs - now).coerceAtLeast(0L)
        val remainingMinutes = remainingMs / 60000
        val remainingSeconds = (remainingMs % 60000) / 1000
        timeRemainingView.text = String.format("%02d:%02d", remainingMinutes, remainingSeconds)

        // Update date
        val sdf = java.text.SimpleDateFormat("EEEE, MMMM d", java.util.Locale.getDefault())
        dateView.text = sdf.format(java.util.Date())
    }

    private fun Int.dpToPx(): Int = (this * resources.displayMetrics.density + 0.5f).toInt()

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        tickRunnable?.let { handler.removeCallbacks(it) }
    }
}