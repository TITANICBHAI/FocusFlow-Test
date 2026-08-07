package com.tbtechs.focusflow.services.strategies

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * DailyAllowanceStrategy — Per-app daily allowance enforcement (count / time_budget / interval).
 *
 * Runs continuously regardless of active session. Tracks usage and blocks when exhausted.
 * Modes:
 *   - count: N opens per day
 *   - time_budget: N minutes per day
 *   - interval: N minutes per window (e.g., 5 min every hour)
 */
class DailyAllowanceStrategy : BlockingStrategy {
    override val name = "DailyAllowance"
    override val priority = 40

    override fun shouldBlock(context: BlockContext): BlockDecision {
        val entry = findAllowanceEntry(context.pkg, context.prefs)
        if (entry == null) return BlockDecision.Skip

        val available = isAllowanceAvailable(context.pkg, entry, context.now, context.prefs)
        if (!available) {
            return BlockDecision.Block(name, context.pkg, "daily allowance exhausted (${entry.mode})")
        }
        // Allowance available — record this open if it's a new foreground session
        if (context.currentTimedPkg != context.pkg) {
            recordAllowanceOpen(context.pkg, entry, context.now, context.prefs)
        }
        return BlockDecision.Allow(name)
    }

    private data class AllowanceEntry(
        val pkg: String,
        val mode: String,
        val countPerDay: Int,
        val budgetMs: Long,
        val intervalMs: Long,
        val windowMs: Long,
    )

    private fun findAllowanceEntry(pkg: String, prefs: SharedPreferences): AllowanceEntry? {
        // Try rich config first
        val configJson = prefs.getString("daily_allowance_config", null)
        if (!configJson.isNullOrBlank() && configJson != "null") {
            try {
                val arr = JSONArray(configJson)
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    if (obj.optString("packageName", "").equals(pkg, ignoreCase = true)) {
                        return AllowanceEntry(
                            pkg = pkg,
                            mode = obj.optString("mode", "count"),
                            countPerDay = obj.optInt("countPerDay", 1),
                            budgetMs = obj.optLong("budgetMinutes", 30L) * 60_000L,
                            intervalMs = obj.optLong("intervalMinutes", 5L) * 60_000L,
                            windowMs = obj.optLong("intervalHours", 1L) * 3_600_000L,
                        )
                    }
                }
            } catch (_: Exception) {}
        }
        // Legacy fallback
        val legacyJson = prefs.getString("daily_allowance_packages", "[]") ?: "[]"
        try {
            val arr = JSONArray(legacyJson)
            for (i in 0 until arr.length()) {
                if (arr.getString(i).equals(pkg, ignoreCase = true)) {
                    return AllowanceEntry(pkg, "count", 1, 0, 0, 0)
                }
            }
        } catch (_: Exception) {}
        return null
    }

    private fun isAllowanceAvailable(pkg: String, entry: AllowanceEntry, now: Long, prefs: SharedPreferences): Boolean {
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date(now))
        val usedJson = prefs.getString("daily_allowance_used", "{}") ?: "{}"
        val allUsed = try { JSONObject(usedJson) } catch (_: Exception) { JSONObject() }
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

    private fun recordAllowanceOpen(pkg: String, entry: AllowanceEntry, now: Long, prefs: SharedPreferences) {
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date(now))
        val usedJson = prefs.getString("daily_allowance_used", "{}") ?: "{}"
        val allUsed = try { JSONObject(usedJson) } catch (_: Exception) { JSONObject() }
        val pkgUsed = allUsed.optJSONObject(pkg) ?: JSONObject()

        when (entry.mode) {
            "count" -> {
                val usedDate = pkgUsed.optString("date", "")
                val usedCount = if (usedDate == today) pkgUsed.optInt("count", 0) else 0
                pkgUsed.put("date", today)
                pkgUsed.put("count", usedCount + 1)
            }
            "time_budget" -> {
                val usedDate = pkgUsed.optString("date", "")
                val usedMs = if (usedDate == today) pkgUsed.optLong("usedMs", 0L) else 0L
                pkgUsed.put("date", today)
                pkgUsed.put("usedMs", usedMs)
            }
            "interval" -> {
                val windowStartMs = pkgUsed.optLong("windowStartMs", 0L)
                val windowExpired = now > windowStartMs + entry.windowMs
                val usedMs = if (windowExpired) 0L else pkgUsed.optLong("usedMs", 0L)
                if (windowExpired) {
                    pkgUsed.put("windowStartMs", now)
                }
                pkgUsed.put("usedMs", usedMs)
            }
        }
        allUsed.put(pkg, pkgUsed)
        prefs.edit().putString("daily_allowance_used", allUsed.toString()).apply()
    }
}