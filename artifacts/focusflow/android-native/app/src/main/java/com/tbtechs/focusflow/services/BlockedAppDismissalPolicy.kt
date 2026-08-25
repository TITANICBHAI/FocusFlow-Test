package com.tbtechs.focusflow.services

/**
 * Pure policy for removing a blocked app from the foreground.
 *
 * Keeping the timing and installer exception separate from AccessibilityService
 * makes the safety-critical process handoff testable on the JVM.
 */
object BlockedAppDismissalPolicy {
    enum class GlobalAction { BACK, HOME }

    data class DismissalAction(
        val action: GlobalAction,
        val delayMs: Long,
    )

    fun actionsFor(blockedPackage: String, installerPackages: Set<String>): List<DismissalAction> {
        val isInstaller = installerPackages.any { it.equals(blockedPackage, ignoreCase = true) }
        return if (isInstaller) {
            listOf(DismissalAction(GlobalAction.BACK, 0L))
        } else {
            listOf(
                DismissalAction(GlobalAction.BACK, 0L),
                DismissalAction(GlobalAction.HOME, 80L),
                DismissalAction(GlobalAction.BACK, 100L),
            )
        }
    }

    /**
     * A delayed retry may act only while enforcement remains active and the
     * original blocked package still owns the foreground window.
     */
    fun shouldRetry(
        blockedPackage: String,
        lastSeenPackage: String?,
        focusActive: Boolean,
        standaloneActive: Boolean,
        alwaysOnActive: Boolean,
        isBlocked: Boolean,
        allowanceExhausted: Boolean,
    ): Boolean {
        if (!focusActive && !standaloneActive && !alwaysOnActive) return false
        if (lastSeenPackage != blockedPackage) return false
        return isBlocked || allowanceExhausted
    }
}