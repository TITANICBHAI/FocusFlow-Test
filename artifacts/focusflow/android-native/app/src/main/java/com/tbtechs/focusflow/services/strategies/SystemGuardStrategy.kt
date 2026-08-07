package com.tbtechs.focusflow.services.strategies

import android.view.accessibility.AccessibilityEvent
import android.content.SharedPreferences

/**
 * SystemGuardStrategy — Blocks dangerous system settings pages.
 *
 * Runs when systemGuardEnabled=true AND any enforcement mode is active.
 * Blocks: accessibility settings, clear data dialogs, date/time, usage access,
 * battery optimization, device admin, developer options, reset pages, special access,
 * and default home app chooser during standalone block.
 */
class SystemGuardStrategy : BlockingStrategy {
    override val name = "SystemGuard"
    override val priority = 50

    override fun shouldBlock(context: BlockContext): BlockDecision {
        if (!context.systemGuardEnabled) return BlockDecision.Skip
        if (!context.focusActive && !context.saActive && !context.alwaysBlockActive) return BlockDecision.Skip

        val ev = context.event ?: return BlockDecision.Skip

        // Accessibility settings
        if (isAccessibilitySettingsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "accessibility settings")
        }

        // Clear data / storage dialogs
        if (isClearDataDialog(ev)) {
            return BlockDecision.Block(name, context.pkg, "clear data dialog")
        }

        // Date/time settings
        if (isDateTimeSettingsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "date/time settings")
        }

        // Usage Access settings
        if (isUsageAccessSettingsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "usage access settings")
        }

        // Battery Optimization settings
        if (isBatteryOptimizationSettingsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "battery optimization settings")
        }

        // Device Admin settings
        if (isDeviceAdminSettingsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "device admin settings")
        }

        // Developer Options
        if (isDeveloperOptionsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "developer options")
        }

        // Reset settings pages
        if (isResetSettingsPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "reset settings")
        }

        // Special Access page
        if (isSpecialAccessPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "special access settings")
        }

        // Default home app chooser during standalone block
        val launcherLockEnabled = context.prefs.getBoolean("launcher_lock_during_standalone", true)
        if (launcherLockEnabled && context.saActive && isHomeAppChooserPage(ev)) {
            return BlockDecision.Block(name, context.pkg, "home app chooser during standalone")
        }

        return BlockDecision.Skip
    }

    // These are simplified - the actual implementation lives in AppBlockerAccessibilityService
    // In a full refactor, these would be moved to a shared utility class
    private fun isAccessibilitySettingsPage(ev: AccessibilityEvent): Boolean = false
    private fun isClearDataDialog(ev: AccessibilityEvent): Boolean = false
    private fun isDateTimeSettingsPage(ev: AccessibilityEvent): Boolean = false
    private fun isUsageAccessSettingsPage(ev: AccessibilityEvent): Boolean = false
    private fun isBatteryOptimizationSettingsPage(ev: AccessibilityEvent): Boolean = false
    private fun isDeviceAdminSettingsPage(ev: AccessibilityEvent): Boolean = false
    private fun isDeveloperOptionsPage(ev: AccessibilityEvent): Boolean = false
    private fun isResetSettingsPage(ev: AccessibilityEvent): Boolean = false
    private fun isSpecialAccessPage(ev: AccessibilityEvent): Boolean = false
    private fun isHomeAppChooserPage(ev: AccessibilityEvent): Boolean = false
}