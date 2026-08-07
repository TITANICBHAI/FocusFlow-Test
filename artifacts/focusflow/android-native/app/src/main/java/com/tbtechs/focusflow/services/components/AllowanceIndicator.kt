package com.tbtechs.focusflow.services.components

import android.content.Context
import android.content.SharedPreferences
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.FrameLayout
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService

/**
 * AllowanceIndicator - Material 3 Daily Allowance Progress Indicator
 *
 * Small 16dp circular progress indicator showing daily allowance remaining
 * for a specific app. Attaches to app icons in grids/dock.
 *
 * Modes supported:
 * - count: N opens per day
 * - time_budget: N minutes per day
 * - interval: N minutes per window
 */
class AllowanceIndicator @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private lateinit var prefs: SharedPreferences
    private val progressIndicator: CircularProgressIndicator
    private var currentPkg: String = ""
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var updateRunnable: Runnable? = null

    init {
        prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )

        LayoutInflater.from(context).inflate(R.layout.component_allowance_indicator, this, true)

        progressIndicator = findViewById(R.id.allowance_progress_indicator)
        progressIndicator.apply {
            indicatorSize = 16.dpToPx()
            trackThickness = 2.dpToPx()
            indicatorColor = ContextCompat.getColor(context, R.color.focus_indigo)
            trackColor = ContextCompat.getColor(context, R.color.surface_variant_light)
            progress = 0f
        }
    }

    /**
     * Bind this indicator to a package and update its progress
     */
    fun bind(pkg: String) {
        currentPkg = pkg
        updateProgress()
        startPeriodicUpdate()
    }

    private fun startPeriodicUpdate() {
        updateRunnable?.let { handler.removeCallbacks(it) }
        val runnable = object : Runnable {
            override fun run() {
                if (currentPkg.isNotEmpty()) {
                    updateProgress()
                }
                handler.postDelayed(this, 30000) // Update every 30s
            }
        }
        handler.post(runnable)
        updateRunnable = runnable
    }

    private fun updateProgress() {
        if (currentPkg.isEmpty()) return

        val entry = findAllowanceEntry(currentPkg)
        if (entry == null) {
            progressIndicator.progress = 0f
            visibility = GONE
            return
        }

        val available = isAllowanceAvailable(currentPkg, entry)
        val progress = calculateProgress(entry)

        progressIndicator.progress = progress
        visibility = if (available) VISIBLE else VISIBLE // Always show, but progress indicates remaining
    }

    private data class AllowanceEntry(
        val pkg: String,
        val mode: String,
        val countPerDay: Int,
        val budgetMs: Long,
        val intervalMs: Long,
        val windowMs: Long
    )

    private fun findAllowanceEntry(pkg: String): AllowanceEntry? {
        // Try rich config first
        val configJson = prefs.getString(AppBlockerAccessibilityService.PREF_DAILY_ALLOWANCE_CONFIG, null)
        if (!configJson.isNullOrBlank() && configJson != "null") {
            try {
                val arr = org.json.JSONArray(configJson)
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    if (obj.optString("packageName", "").equals(currentPkg, ignoreCase = true)) {
                        return AllowanceEntry(
                            pkg = currentPkg,
                            mode = obj.optString("mode", "count"),
                            countPerDay = obj.optInt("countPerDay", 1),
                            budgetMs = obj.optLong("budgetMinutes", 30L) * 60_000L,
                            intervalMs = obj.optLong("intervalMinutes", 5L) * 60_000L,
                            windowMs = obj.optLong("intervalHours", 1L) * 3_600_000L
                        )
                    }
                }
            } catch (e: Exception) {}
        }

        // Legacy fallback
        val legacyJson = prefs.getString(AppBlockerAccessibilityService.PREF_DAILY_ALLOWANCE_PKGS, "[]") ?: "[]"
        try {
            val arr = org.json.JSONArray(legacyJson)
            for (i in 0 until arr.length()) {
                if (arr.getString(i).equals(currentPkg, ignoreCase = true)) {
                    return AllowanceEntry(currentPkg, "count", 1, 0, 0, 0)
                }
            }
        } catch (e: Exception) {}
        return null
    }

    private fun isAllowanceAvailable(pkg: String, entry: AllowanceEntry): Boolean {
        val now = System.currentTimeMillis()
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date(now))
        val usedJson = prefs.getString(AppBlockerAccessibilityService.PREF_DAILY_ALLOWANCE_USED, "{}") ?: "{}"
        val allUsed = try { org.json.JSONObject(usedJson) } catch (e: Exception) { org.json.JSONObject() }
        val pkgUsed = allUsed.optJSONObject(pkg)

        return when (entry.mode) {
            "count" -> {
                val usedDate = pkgUsed?.optString("date", "") ?: ""
                val usedCount = if (usedDate == today) pkgUsed?.optInt("count", 0) ?: 0 else 0
                usedCount < entry.countPerDay
            }
            "time_budget" -> {
                val usedDate = pkgUsed?.optString("date", "") ?: ""
                val usedMs = if (usedDate == today) pkgUsed?.optLong("usedMs", 0L) ?: 0L else 0L
                usedMs < entry.budgetMs
            }
            "interval" -> {
                val windowStartMs = pkgUsed?.optLong("windowStartMs", 0L) ?: 0L
                val windowExpired = now > windowStartMs + entry.windowMs
                val usedMs = if (windowExpired) 0L else pkgUsed?.optLong("usedMs", 0L) ?: 0L
                usedMs < entry.intervalMs
            }
            else -> true
        }
    }

    private fun calculateProgress(entry: AllowanceEntry): Float {
        val now = System.currentTimeMillis()
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date(now))
        val usedJson = prefs.getString(AppBlockerAccessibilityService.PREF_DAILY_ALLOWANCE_USED, "{}") ?: "{}"
        val allUsed = try { org.json.JSONObject(usedJson) } catch (e: Exception) { org.json.JSONObject() }
        val pkgUsed = allUsed.optJSONObject(entry.pkg)

        return when (entry.mode) {
            "count" -> {
                val usedDate = pkgUsed?.optString("date", "") ?: ""
                val usedCount = if (usedDate == today) pkgUsed?.optInt("count", 0) ?: 0 else 0
                (usedCount.toFloat() / entry.countPerDay.toFloat()).coerceIn(0f, 1f)
            }
            "time_budget" -> {
                val usedDate = pkgUsed?.optString("date", "") ?: ""
                val usedMs = if (usedDate == today) pkgUsed?.optLong("usedMs", 0L) ?: 0L else 0L
                (usedMs.toFloat() / entry.budgetMs.toFloat()).coerceIn(0f, 1f)
            }
            "interval" -> {
                val windowStartMs = pkgUsed?.optLong("windowStartMs", 0L) ?: 0L
                val windowExpired = System.currentTimeMillis() > windowStartMs + entry.windowMs
                val usedMs = if (windowExpired) 0L else pkgUsed?.optLong("usedMs", 0L) ?: 0L
                (usedMs.toFloat() / entry.intervalMs.toFloat()).coerceIn(0f, 1f)
            }
            else -> 0f
        }
    }

    fun unbind() {
        updateRunnable?.let { handler.removeCallbacks(it) }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        unbind()
    }

    private fun Int.dpToPx(): Int = (this * context.resources.displayMetrics.density + 0.5f).toInt()
}