package com.tbtechs.focusflow.services

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.UserManager

/**
 * FocusDayDeviceAdminReceiver
 *
 * Device Admin receiver for FocusFlow — enforcement layers:
 *
 *   1. Persistence guard: Device Admin status prevents aggressive OEM battery killers
 *      (MIUI, ColorOS, Samsung One UI) from force-stopping the app, protecting
 *      ForegroundTaskService and AppBlockerAccessibilityService.
 *
 *   2. Install / uninstall restriction: On activation we attempt to set
 *      DISALLOW_INSTALL_APPS and DISALLOW_UNINSTALL_APPS via DevicePolicyManager.
 *      On devices where Device Owner is required these calls are silently ignored —
 *      the AccessibilityService remains the primary enforcement guard.
 *
 *   3. Force-lock during active sessions: The receiver can call lockNow() to
 *      immediately lock the screen if it detects the admin is being deactivated
 *      while a focus session is running, forcing the user to unlock and see the
 *      FocusFlow lock-screen notification before regaining device access.
 *
 *   4. Deactivation guard: onDisableRequested() returns a warning message shown
 *      in the system deactivation dialog — the extra friction dialog text reminds
 *      the user that a session is active before they confirm.
 *
 * Declared in AndroidManifest.xml via withFocusDayAndroid config plugin.
 * Policy file: res/xml/device_admin.xml
 *
 * To activate:   Settings → Security → Device admin apps → FocusFlow → Activate
 * To deactivate: same path → Deactivate  (requires deliberate multi-step confirmation)
 */
class FocusDayDeviceAdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val PREFS_NAME = "focusday_prefs"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        applyRestrictions(context, enable = true)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        applyRestrictions(context, enable = false)
    }

    /**
     * Called by the system just before the deactivation dialog is shown.
     * Returning a non-empty string injects it as the warning text in the dialog —
     * this is the last friction point before the user confirms deactivation.
     * If a focus session is active we return a stern reminder; otherwise silent.
     */
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val focusActive      = prefs.getBoolean("focus_active", false)
        val saActive         = prefs.getBoolean("standalone_block_active", false)
        val alwaysBlockActive = prefs.getBoolean("always_block_active", false)
        return if (focusActive || saActive || alwaysBlockActive) {
            "⚠ A FocusFlow session is currently active. Removing Device Admin will " +
            "weaken enforcement and allow OEM systems to kill the blocking service. " +
            "Are you sure you want to cheat?"
        } else {
            ""
        }
    }

    // ─── Restriction helpers ──────────────────────────────────────────────────

    private fun applyRestrictions(context: Context, enable: Boolean) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, FocusDayDeviceAdminReceiver::class.java)

        // Install / uninstall restrictions — requires Device Owner on API 21+
        // but silently fails on plain Device Admin; catch and continue.
        tryApplyRestriction(dpm, admin, UserManager.DISALLOW_INSTALL_APPS, enable)
        tryApplyRestriction(dpm, admin, UserManager.DISALLOW_UNINSTALL_APPS, enable)

        // Also try to lock the screen immediately when deactivating during a session.
        // This forces the user through the lock screen before they can use the phone,
        // adding one more friction step after a bypass attempt.
        if (!enable) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val sessionActive = prefs.getBoolean("focus_active", false) ||
                                prefs.getBoolean("standalone_block_active", false)
            if (sessionActive) {
                try { dpm.lockNow() } catch (_: Exception) { /* lock requires admin still active */ }
            }
        }
    }

    private fun tryApplyRestriction(
        dpm: DevicePolicyManager,
        admin: ComponentName,
        restriction: String,
        enable: Boolean
    ) {
        try {
            if (enable) dpm.addUserRestriction(admin, restriction)
            else        dpm.clearUserRestriction(admin, restriction)
        } catch (_: SecurityException) {
            // Requires Device Owner / Profile Owner — silently ignored.
        } catch (_: Exception) {
            // Never crash the admin receiver.
        }
    }
}
