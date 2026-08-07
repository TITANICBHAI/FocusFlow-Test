package com.tbtechs.focusflow.services.strategies

import android.view.accessibility.AccessibilityEvent
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * StandaloneBlockStrategy — Time-limited standalone app blocking.
 *
 * Blocks apps in standalone_blocked_packages until standalone_block_until_ms.
 * Independent of any task focus.
 */
class StandaloneBlockStrategy : BlockingStrategy {
    override val name = "StandaloneBlock"
    override val priority = 20

    override fun shouldBlock(context: BlockContext): BlockDecision {
        if (!context.saActive) return BlockDecision.Skip

        val saJson = context.prefs.getString("standalone_blocked_packages", "[]") ?: "[]"
        val saList = parseJsonArray(saJson)
        if (saList.any { it.equals(context.pkg, ignoreCase = true) }) {
            return BlockDecision.Block(name, context.pkg, "in standalone block list")
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