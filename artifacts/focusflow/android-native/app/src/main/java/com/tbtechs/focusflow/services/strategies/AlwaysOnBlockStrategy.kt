package com.tbtechs.focusflow.services.strategies

import android.content.SharedPreferences
import org.json.JSONArray

/**
 * AlwaysOnBlockStrategy — Always-on enforcement (session-independent).
 *
 * Enforces always_block_packages and daily allowance rules at all times,
 * without requiring focus_active or standalone_block_active.
 * Does NOT affect UI lock — settings remain editable when no timed session is running.
 */
class AlwaysOnBlockStrategy : BlockingStrategy {
    override val name = "AlwaysOnBlock"
    override val priority = 30

    override fun shouldBlock(context: BlockContext): BlockDecision {
        if (!context.alwaysBlockActive) return BlockDecision.Skip

        val alwaysJson = context.prefs.getString("always_block_packages", "[]") ?: "[]"
        val alwaysList = parseJsonArray(alwaysJson)
        if (alwaysList.any { it.equals(context.pkg, ignoreCase = true) }) {
            return BlockDecision.Block(name, context.pkg, "in always-on block list")
        }
        return BlockDecision.Skip
    }

    private fun parseJsonArray(json: String): List<String> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) { emptyList() }
    }
}