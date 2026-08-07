package com.tbtechs.focusflow.services.strategies

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * GreyoutStrategy — Time-window blocking (session-independent).
 *
 * Blocks apps during configured time windows on specific days.
 * Works even when no focus session or standalone block is active.
 */
class GreyoutStrategy : BlockingStrategy {
    override val name = "GreyoutSchedule"
    override val priority = 70

    override fun shouldBlock(context: BlockContext): BlockDecision {
        val json = context.prefs.getString("greyout_schedule", "[]") ?: "[]"
        if (json == "[]" || json.isEmpty()) return BlockDecision.Skip

        val now = java.util.Calendar.getInstance()
        val currentHour = now.get(java.util.Calendar.HOUR_OF_DAY)
        val currentMin = now.get(java.util.Calendar.MINUTE)
        val currentDay = now.get(java.util.Calendar.DAY_OF_WEEK) // 1=Sun .. 7=Sat
        val dayIndex = if (currentDay == 1) 7 else currentDay - 1 // 1=Mon .. 7=Sun

        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val w = arr.getJSONObject(i)
                if (w.optBoolean("enabled", true)) {
                    val pkg = w.optString("pkg", "")
                    if (!pkg.equals(context.pkg, ignoreCase = true)) continue

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
                        return BlockDecision.Block(name, context.pkg, "greyout window active")
                    }
                }
            }
        } catch (_: Exception) {}

        return BlockDecision.Skip
    }
}