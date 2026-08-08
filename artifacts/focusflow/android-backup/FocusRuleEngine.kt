package com.tbtechs.focusflow.services

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import org.json.JSONArray

/**
 * FocusRuleEngine - Centralized Focus Blocking Logic
 *
 * Single source of truth for determining which packages are blocked
 * under various focus modes. Used by both LauncherActivity and
 * AppBlockerAccessibilityService to ensure consistent behavior.
 */
class FocusRuleEngine(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val packageManager: PackageManager = context.packageManager

    /**
     * Get all packages currently blocked by any active focus mode
     */
    fun getBlockedPackages(): Set<String> {
        val blocked = mutableSetOf<String>()

        val now = System.currentTimeMillis()

        // 1. Focus mode (task-based)
        val focusActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false)
        if (focusActive) {
            val endMs = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L)
            if (endMs == 0L || now < endMs) {
                val allowedJson = prefs.getString(AppBlockerAccessibilityService.PREF_ALLOWED_PKG, "[]") ?: "[]"
                val allowed = try { JSONArray(allowedJson).toSet() } catch (e: Exception) { emptySet<String>() }

                // All apps NOT in allowed list are blocked
                val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                val allApps = packageManager.queryIntentActivities(intent, 0)
                for (info in allApps) {
                    if (!allowed.contains(info.activityInfo.packageName)) {
                        blocked.add(info.activityInfo.packageName)
                    }
                }
            }
        }

        // 2. Standalone block
        val saActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_SA_ACTIVE, false)
        if (saActive) {
            val untilMs = prefs.getLong(AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L)
            if (untilMs == 0L || now < untilMs) {
                val saJson = prefs.getString(AppBlockerAccessibilityService.PREF_SA_PKGS, "[]") ?: "[]"
                try {
                    val arr = JSONArray(saJson)
                    for (i in 0 until arr.length()) {
                        blocked.add(arr.getString(i))
                    }
                } catch (e: Exception) {}
            }
        }

        // 3. Always-on enforcement
        val alwaysBlockActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK, false)
        if (alwaysBlockActive) {
            val alwaysJson = prefs.getString(AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK_PKGS, "[]") ?: "[]"
            try {
                val arr = JSONArray(alwaysJson)
                for (i in 0 until arr.length()) {
                    blocked.add(arr.getString(i))
                }
            } catch (e: Exception) {}

            // Also include daily allowance packages (they're blocked after allowance exhausted)
            val allowanceJson = prefs.getString(AppBlockerAccessibilityService.PREF_DAILY_ALLOWANCE_CONFIG, null)
            if (!allowanceJson.isNullOrBlank() && allowanceJson != "null") {
                try {
                    val arr = JSONArray(allowanceJson)
                    for (i in 0 until arr.length()) {
                        val pkg = arr.getJSONObject(i).optString("packageName", "")
                        if (pkg.isNotEmpty()) blocked.add(pkg)
                    }
                } catch (e: Exception) {}
            }
        }

        // 4. Greyout schedule (time-window blocking)
        val greyoutJson = prefs.getString(AppBlockerAccessibilityService.PREF_GREYOUT_SCHEDULE, "[]") ?: "[]"
        if (greyoutJson != "[]" && greyoutJson.isNotEmpty()) {
            try {
                val arr = JSONArray(greyoutJson)
                val now = java.util.Calendar.getInstance()
                val currentHour = now.get(java.util.Calendar.HOUR_OF_DAY)
                val currentMin = now.get(java.util.Calendar.MINUTE)
                val currentDay = now.get(java.util.Calendar.DAY_OF_WEEK)
                val dayIndex = if (currentDay == 1) 7 else currentDay - 1

                for (i in 0 until arr.length()) {
                    val w = arr.getJSONObject(i)
                    if (w.optBoolean("enabled", true)) {
                        val pkg = w.optString("pkg", "")
                        if (pkg.isNotEmpty()) {
                            val startH = w.optInt("startHour", 0)
                            val startM = w.optInt("startMin", 0)
                            val endH = w.optInt("endHour", 0)
                            val endM = w.optInt("endMin", 0)
                            val days = w.optJSONArray("days")
                            val daySet = mutableSetOf<Int>()
                            if (days != null) {
                                for (j in 0 until days.length()) {
                                    daySet.add(days.optInt(j, 0))
                                }
                            }
                            if (daySet.isNotEmpty() && dayIndex !in daySet) continue

                            val nowMinutes = currentHour * 60 + currentMin
                            val startMinutes = startH * 60 + startM
                            val endMinutes = endH * 60 + endM
                            val inWindow = if (startMinutes <= endMinutes) {
                                nowMinutes >= startMinutes && nowMinutes < endMinutes
                            } else {
                                nowMinutes >= startMinutes || nowMinutes < endMinutes
                            }
                            if (inWindow) {
                                blocked.add(pkg)
                            }
                        }
                    }
                }
            } catch (e: Exception) {}
        }

        return blocked
    }

    /**
     * Check if a specific package is currently blocked
     */
    fun isPackageBlocked(pkg: String): Boolean {
        return pkg in getBlockedPackages()
    }

    /**
     * Get packages allowed during focus mode
     */
    fun getFocusAllowedPackages(): Set<String> {
        val allowedJson = prefs.getString(AppBlockerAccessibilityService.PREF_ALLOWED_PKG, "[]") ?: "[]"
        return try { JSONArray(allowedJson).toSet() } catch (e: Exception) { emptySet() }
    }

    /**
     * Get packages in standalone block list
     */
    fun getStandaloneBlockPackages(): Set<String> {
        val saJson = prefs.getString(AppBlockerAccessibilityService.PREF_SA_PKGS, "[]") ?: "[]"
        return try { JSONArray(saJson).toSet() } catch (e: Exception) { emptySet() }
    }

    /**
     * Get packages in always-on block list
     */
    fun getAlwaysBlockPackages(): Set<String> {
        val alwaysJson = prefs.getString(AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK_PKGS, "[]") ?: "[]"
        return try { JSONArray(alwaysJson).toSet() } catch (e: Exception) { emptySet() }
    }

    /**
     * Check if focus mode is currently active
     */
    fun isFocusActive(): Boolean {
        val now = System.currentTimeMillis()
        return prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false) &&
            (prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L) == 0L ||
                prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L) > System.currentTimeMillis())
    }

    /**
     * Check if standalone block is active
     */
    fun isStandaloneActive(): Boolean {
        val now = System.currentTimeMillis()
        return prefs.getBoolean(AppBlockerAccessibilityService.PREF_SA_ACTIVE, false) &&
            (prefs.getLong(AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L) == 0L ||
                prefs.getLong(AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L) > System.currentTimeMillis())
    }

    /**
     * Check if always-on enforcement is active
     */
    fun isAlwaysBlockActive(): Boolean {
        return prefs.getBoolean(AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK, false)
    }
}