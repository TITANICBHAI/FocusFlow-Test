package com.tbtechs.focusflow.services.strategies

import android.view.accessibility.AccessibilityEvent
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * FocusModeStrategy — Task-based focus blocking.
 *
 * Blocks any app NOT in the allowed_packages list when focus_active=true.
 * Respects task_end_ms expiry.
 */
class FocusModeStrategy : BlockingStrategy {
    override val name = "FocusMode"
    override val priority = 10

    override fun shouldBlock(context: BlockContext): BlockDecision {
        if (!context.focusActive) return BlockDecision.Skip

        val allowedJson = context.prefs.getString("allowed_packages", "[]") ?: "[]"
        val allowedList = parseJsonArray(allowedJson)
        if (allowedList.isNotEmpty() && !allowedList.any { it.equals(context.pkg, ignoreCase = true) }) {
            return BlockDecision.Block(name, context.pkg, "not in focus allowed list")
        }
        return BlockDecision.Allow(name)
    }

    private fun parseJsonArray(json: String): List<String> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) { emptyList() }
    }
}