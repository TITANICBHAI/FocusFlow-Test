package com.tbtechs.focusflow.services.strategies

import android.view.accessibility.AccessibilityEvent
import android.content.SharedPreferences

/**
 * BlockingStrategy — Single enforcement concern with one decision method.
 *
 * Each strategy encapsulates one reason why an app might be blocked.
 * onAccessibilityEvent() becomes a simple dispatch loop over registered strategies.
 *
 * Contract:
 *   - shouldBlock() returns a BlockDecision (BLOCK / ALLOW / SKIP)
 *   - BLOCK means: this strategy wants to block the app; stop checking others
 *   - ALLOW means: this strategy explicitly allows the app; stop checking others
 *   - SKIP means: this strategy has no opinion; continue to next strategy
 *
 * Strategies are evaluated in priority order (lower number = higher priority).
 * NEVER_BLOCK and BLOCKABLE_AFTER_WARNING are handled at the dispatch level
 * before strategies run.
 */
sealed class BlockDecision {
    data class Block(
        val strategyName: String,
        val pkg: String,
        val reason: String
    ) : BlockDecision()
    data class Allow(val strategyName: String) : BlockDecision()
    object Skip : BlockDecision()
}

/**
 * Context passed to each strategy — read-only snapshot of current state.
 * Avoids each strategy re-reading SharedPreferences on every event.
 */
data class BlockContext(
    val pkg: String,
    val cls: String,
    val event: AccessibilityEvent?,
    val now: Long,
    val prefs: SharedPreferences,
    val focusActive: Boolean,
    val saActive: Boolean,
    val alwaysBlockActive: Boolean,
    val systemGuardEnabled: Boolean,
    val blockInstallActions: Boolean,
    val blockYoutubeShorts: Boolean,
    val blockInstagramReels: Boolean,
    val lastBlockedPkg: String?,
    val lastBlockedAtMs: Long,
    val lastSeenPkg: String?,
    val currentTimedPkg: String?,
    val currentTimedOpenAtMs: Long,
    val currentTimedSessionEndMs: Long,
)

interface BlockingStrategy {
    /** Unique name for logging/debugging. */
    val name: String

    /** Priority: lower = evaluated first. */
    val priority: Int

    /**
     * Decides whether to block/allow/skip for the given context.
     * Must be fast — called on every accessibility event.
     */
    fun shouldBlock(context: BlockContext): BlockDecision
}