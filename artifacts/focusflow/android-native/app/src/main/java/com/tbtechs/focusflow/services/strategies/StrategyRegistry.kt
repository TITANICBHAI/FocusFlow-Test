package com.tbtechs.focusflow.services.strategies

import android.content.SharedPreferences
import android.view.accessibility.AccessibilityEvent

/**
 * StrategyRegistry — Manages all blocking strategies and dispatches events.
 *
 * Single entry point for the AccessibilityService. Each strategy is evaluated
 * in priority order until one returns BLOCK or ALLOW.
 */
class StrategyRegistry(private val prefs: SharedPreferences) {

    private val strategies = mutableListOf<BlockingStrategy>().apply {
        add(FocusModeStrategy())
        add(StandaloneBlockStrategy())
        add(AlwaysOnBlockStrategy())
        add(DailyAllowanceStrategy())
        add(SystemGuardStrategy())
        add(ContentGuardStrategy())
        add(GreyoutStrategy())
        add(UninstallGuardStrategy())
    }.sortedBy { it.priority }

    fun evaluate(context: BlockContext): BlockDecision {
        for (strategy in strategies) {
            val decision = strategy.shouldBlock(context)
            when (decision) {
                is BlockDecision.Block -> return decision
                is BlockDecision.Allow -> return decision
                BlockDecision.Skip -> continue
            }
        }
        return BlockDecision.Skip
    }

    /**
     * Creates a BlockContext from the current event and service state.
     * Reads SharedPreferences ONCE per event, avoiding repeated reads.
     */
    fun createContext(
        pkg: String,
        cls: String,
        event: AccessibilityEvent?,
        now: Long,
        focusActive: Boolean,
        saActive: Boolean,
        alwaysBlockActive: Boolean,
        systemGuardEnabled: Boolean,
        blockInstallActions: Boolean,
        blockYoutubeShorts: Boolean,
        blockInstagramReels: Boolean,
        lastBlockedPkg: String?,
        lastBlockedAtMs: Long,
        lastSeenPkg: String?,
        currentTimedPkg: String?,
        currentTimedOpenAtMs: Long,
        currentTimedSessionEndMs: Long,
    ): BlockContext {
        return BlockContext(
            pkg = pkg,
            cls = cls,
            event = event,
            now = now,
            prefs = prefs,
            focusActive = focusActive,
            saActive = saActive,
            alwaysBlockActive = alwaysBlockActive,
            systemGuardEnabled = systemGuardEnabled,
            blockInstallActions = blockInstallActions,
            blockYoutubeShorts = blockYoutubeShorts,
            blockInstagramReels = blockInstagramReels,
            lastBlockedPkg = lastBlockedPkg,
            lastBlockedAtMs = lastBlockedAtMs,
            lastSeenPkg = lastSeenPkg,
            currentTimedPkg = currentTimedPkg,
            currentTimedOpenAtMs = currentTimedOpenAtMs,
            currentTimedSessionEndMs = currentTimedSessionEndMs,
        )
    }
}