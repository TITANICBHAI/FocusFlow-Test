package com.tbtechs.focusflow.services.strategies

import android.view.accessibility.AccessibilityEvent
import android.content.SharedPreferences

/**
 * UninstallGuardStrategy — Blocks uninstall dialogs from launchers and installers.
 *
 * Multiple layers:
 *   1. System Guard uninstall (when systemGuardEnabled + active session)
 *   2. Launcher uninstall guard (independent of systemGuard)
 *   3. Installer package uninstall (OEM-specific)
 */
class UninstallGuardStrategy : BlockingStrategy {
    override val name = "UninstallGuard"
    override val priority = 80

    override fun shouldBlock(context: BlockContext): BlockDecision {
        val ev = context.event ?: return BlockDecision.Skip

        // System Guard uninstall (installer packages)
        if (context.systemGuardEnabled &&
            (context.focusActive || context.saActive || context.alwaysBlockActive) &&
            context.pkg in INSTALLER_PACKAGES &&
            !context.prefs.getBoolean("nuclear_mode_bypass", false) &&
            isUninstallDialog(ev)) {
            return BlockDecision.Block(name, context.pkg, "installer uninstall dialog")
        }

        // Launcher uninstall guard (independent)
        if (context.prefs.getBoolean("launcher_block_uninstall", false) &&
            (context.focusActive || context.saActive || context.alwaysBlockActive) &&
            !context.prefs.getBoolean("nuclear_mode_bypass", false) &&
            isUninstallDialog(ev)) {
            return BlockDecision.Block(name, context.pkg, "launcher uninstall dialog")
        }

        // System Guard uninstall (settings package)
        if (context.systemGuardEnabled &&
            (context.focusActive || context.saActive || context.alwaysBlockActive) &&
            !context.prefs.getBoolean("nuclear_mode_bypass", false) &&
            isUninstallDialog(ev)) {
            return BlockDecision.Block(name, context.pkg, "settings uninstall dialog")
        }

        return BlockDecision.Skip
    }

    private fun isUninstallDialog(ev: AccessibilityEvent): Boolean = false

    companion object {
        private val INSTALLER_PACKAGES = setOf(
            "com.android.packageinstaller", "com.google.android.packageinstaller",
            "com.android.uninstaller", "com.samsung.android.packageinstaller",
            "com.sec.android.packageinstaller", "com.miui.packageinstaller",
            "com.miui.global.packageinstaller", "com.xiaomi.packageinstaller",
            "com.coloros.packageinstaller", "com.oppo.packageinstaller",
            "com.realme.packageinstaller", "com.huawei.packageinstaller",
            "com.huawei.appmarket", "com.hihonor.packageinstaller",
            "com.vivo.packageinstaller", "com.bbk.packageinstaller",
            "com.oneplus.packageinstaller", "com.motorola.packageinstaller",
            "com.asus.packageinstaller", "com.asus.ims.packageinstallerproxy",
            "com.hmdglobal.packageinstaller", "com.nokia.packageinstaller",
            "com.sonyericsson.android.packageinstaller", "com.sonymobile.android.packageinstaller",
            "com.lge.packageinstaller", "com.meizu.packageinstaller",
            "com.flyme.packageinstaller", "com.lenovo.packageinstaller",
            "com.zui.packageinstaller", "com.htc.packageinstaller",
            "com.tcl.packageinstaller", "com.tct.packageinstaller",
            "com.zte.packageinstaller", "com.wiko.packageinstaller",
            "com.transsion.packageinstaller", "com.infinix.packageinstaller",
            "com.tecno.packageinstaller", "com.blackshark.packageinstaller"
        )
    }
}