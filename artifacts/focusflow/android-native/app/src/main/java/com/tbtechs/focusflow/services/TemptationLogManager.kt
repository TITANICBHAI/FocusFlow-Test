package com.tbtechs.focusflow.services

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * TemptationLogManager
 *
 * Singleton that tracks every blocked-app attempt across the entire lifetime of
 * the app.  Each time the AccessibilityService intercepts a blocked package, it
 * calls [log] — no JS needed.  The log is capped at 500 entries (oldest pruned)
 * to prevent unbounded SharedPrefs growth.
 *
 * Also owns the weekly Temptation Report AlarmManager schedule.  When enabled
 * (aversion_weekly_report = true), a repeating alarm fires every Sunday at 08:00
 * and posts the notification via [TemptationReportReceiver].
 *
 * SharedPrefs keys (file "focusday_prefs"):
 *   temptation_log            String   JSON array of {pkg, appName, timestamp}
 *   aversion_weekly_report    Boolean  weekly report notifications on/off
 */
object TemptationLogManager {

    private const val PREFS_NAME  = "focusday_prefs"
    private const val MAX_ENTRIES = 500
    const val CHANNEL_ID          = "focusflow_temptation"

    // ─── Logging ──────────────────────────────────────────────────────────────

    fun log(context: Context, pkg: String, appName: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json  = prefs.getString("temptation_log", "[]") ?: "[]"
        val arr   = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

        val entry = JSONObject().apply {
            put("pkg",       pkg)
            put("appName",   appName)
            put("timestamp", System.currentTimeMillis())
        }
        arr.put(entry)

        // Prune oldest entries beyond cap
        val pruned = if (arr.length() > MAX_ENTRIES) {
            val excess = arr.length() - MAX_ENTRIES
            val trimmed = JSONArray()
            for (i in excess until arr.length()) trimmed.put(arr.getJSONObject(i))
            trimmed
        } else arr

        prefs.edit().putString("temptation_log", pruned.toString()).apply()
    }

    // ─── Query helpers ────────────────────────────────────────────────────────

    /** Returns all log entries as a raw JSON string (JS can parse and display this). */
    fun getLogJson(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("temptation_log", "[]") ?: "[]"
    }

    /** Clears the entire log. */
    fun clearLog(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString("temptation_log", "[]").apply()
    }

    /**
     * Builds a human-readable weekly summary string for the notification body.
     * Groups entries from the past 7 days by app, sorted descending by attempts.
     */
    fun buildWeeklySummary(context: Context): String {
        val prefs   = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json    = prefs.getString("temptation_log", "[]") ?: "[]"
        val arr     = try { JSONArray(json) } catch (_: Exception) { return "No data yet." }
        val cutoff  = System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000

        val counts  = mutableMapOf<String, Pair<String, Int>>()
        for (i in 0 until arr.length()) {
            val e   = arr.optJSONObject(i) ?: continue
            val ts  = e.optLong("timestamp", 0L)
            if (ts < cutoff) continue
            val pkg = e.optString("pkg")
            val name = e.optString("appName", pkg)
            val cur = counts[pkg]
            counts[pkg] = Pair(name, (cur?.second ?: 0) + 1)
        }

        if (counts.isEmpty()) return "You resisted every blocked app this week. Excellent."

        val total = counts.values.sumOf { it.second }
        val lines = counts.entries
            .sortedByDescending { it.value.second }
            .take(5)
            .joinToString("\n") { (_, v) -> "• ${v.first}: ${v.second}×" }

        return "$total total attempts this week:\n$lines"
    }

    // ─── Weekly alarm scheduling ──────────────────────────────────────────────

    /**
     * Enables or disables the weekly Sunday 08:00 alarm that fires
     * [TemptationReportReceiver] to post the Temptation Report notification.
     */
    fun scheduleWeeklyReport(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean("aversion_weekly_report", enabled).apply()

        val intent = Intent(context, TemptationReportReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            context, 7700, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (!enabled) {
            am.cancel(pi)
            return
        }

        // Next Sunday at 08:00
        val cal = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, Calendar.SUNDAY)
            set(Calendar.HOUR_OF_DAY, 8)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            // If Sunday 08:00 has already passed this week, advance by 7 days
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.WEEK_OF_YEAR, 1)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP, cal.timeInMillis,
                AlarmManager.INTERVAL_DAY * 7, pi)
        } else {
            am.setRepeating(AlarmManager.RTC_WAKEUP, cal.timeInMillis,
                AlarmManager.INTERVAL_DAY * 7, pi)
        }
    }

    // ─── Notification channel ─────────────────────────────────────────────────

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            "Temptation Report",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Weekly summary of blocked app attempts"
        }
        nm.createNotificationChannel(ch)
    }
}
