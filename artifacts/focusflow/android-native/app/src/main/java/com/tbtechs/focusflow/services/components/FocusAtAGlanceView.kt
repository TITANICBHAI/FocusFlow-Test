package com.tbtechs.focusflow.services.components

import android.content.Context
import android.content.SharedPreferences
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.FrameLayout
import android.widget.TextClock
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService

/**
 * FocusAtAGlanceView - Material 3 "At a Glance" Widget
 *
 * Combines a TextClock (digital time) with the FocusTimerRing.
 * When focus session is active, shows the FocusTimerRing overlay.
 * When no focus, shows the regular digital clock with date.
 *
 * This replaces the traditional Pixel "At a Glance" widget with
 * FocusFlow's focus-first design.
 */
class FocusAtAGlanceView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private lateinit var prefs: SharedPreferences
    private val focusTimerRing: FocusTimerRing
    private val dateView: TextView
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var tickRunnable: Runnable? = null

    init {
        prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )

        LayoutInflater.from(context).inflate(R.layout.component_focus_at_a_glance, this, true)

        focusTimerRing = findViewById(R.id.focus_timer_ring)
        dateView = findViewById(R.id.at_glance_date_view)

        // Update date initially
        updateDate()

        // Start periodic updates
        startTick()
    }

    private fun startTick() {
        tickRunnable = object : Runnable {
            override fun run() {
                updateDate()
                handler.postDelayed(this, 60000) // Update date every minute
            }
        }
        handler.post(tickRunnable!!)
    }

    private fun updateDate() {
        val sdf = java.text.SimpleDateFormat("EEEE, MMMM d", java.util.Locale.getDefault())
        dateView.text = sdf.format(java.util.Date())
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        tickRunnable?.let { handler.removeCallbacks(it) }
    }

    private fun Int.dpToPx(): Int = (this * context.resources.displayMetrics.density + 0.5f).toInt()
}