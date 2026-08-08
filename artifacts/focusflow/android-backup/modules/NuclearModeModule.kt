package com.tbtechs.focusflow.modules

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService
import org.json.JSONArray

/**
 * NuclearModeModule
 *
 * JS name: NativeModules.NuclearMode
 *
 * "Nuclear Mode" — lets a committed user permanently uninstall their most
 * addictive apps (Instagram, TikTok, etc.) directly from FocusFlow. Each call
 * launches the system uninstall dialog for the target package; the user must
 * confirm in the system dialog, so there is no risk of accidental deletion.
 *
 * Methods:
 *   requestUninstallApp(packageName)   → Promise<null>
 *     Opens the system "Uninstall <App>?" dialog for a single package.
 *     Resolves immediately after the dialog is shown; resolution does NOT mean
 *     the app was uninstalled — the user still has to confirm.
 *
 *   requestUninstallApps(packagesJson) → Promise<null>
 *     Accepts a JSON array of package names and opens each dialog sequentially
 *     with a 500 ms gap so the system has time to process each one.
 *     Example: '["com.instagram.android","com.zhiliaoapp.musically"]'
 *
 *   isAppInstalled(packageName)        → Promise<Boolean>
 *     Returns true if the given package is currently installed on the device.
 *     Useful for the JS layer to filter the Nuclear Mode selection list.
 *
 * Permission required: android.permission.REQUEST_DELETE_PACKAGES
 * (declared in manifest_additions.xml)
 */
class NuclearModeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NuclearMode"

    /**
     * Opens the system uninstall confirmation dialog for [packageName].
     */
    @ReactMethod
    fun requestUninstallApp(packageName: String, promise: Promise) {
        try {
            launchUninstallDialog(packageName)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("UNINSTALL_ERROR", "Could not open uninstall dialog: ${e.message}", e)
        }
    }

    /**
     * Opens uninstall dialogs for each package in [packagesJson] (JSON array string).
     * Each dialog is opened with a 500 ms stagger so the system can process them.
     */
    @ReactMethod
    fun requestUninstallApps(packagesJson: String, promise: Promise) {
        try {
            val arr = JSONArray(packagesJson)
            val packages = (0 until arr.length()).map { arr.getString(it) }

            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            packages.forEachIndexed { index, pkg ->
                handler.postDelayed({
                    try { launchUninstallDialog(pkg) } catch (_: Exception) {}
                }, index * 500L)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("UNINSTALL_ERROR", "Could not parse package list: ${e.message}", e)
        }
    }

    /**
     * Returns whether [packageName] is currently installed.
     */
    @ReactMethod
    fun isAppInstalled(packageName: String, promise: Promise) {
        try {
            reactContext.packageManager.getPackageInfo(packageName, 0)
            promise.resolve(true)
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Temporarily sets the nuclear_mode_bypass flag in SharedPreferences so
     * AppBlockerAccessibilityService allows the system uninstall dialog through
     * instead of immediately dismissing it. The flag auto-clears after 8 s.
     */
    private fun setNuclearBypass(active: Boolean) {
        reactContext
            .getSharedPreferences(AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(AppBlockerAccessibilityService.PREF_NUCLEAR_BYPASS, active)
            .apply()
    }

    private fun launchUninstallDialog(packageName: String) {
        // Tell the AccessibilityService to let this dialog through.
        setNuclearBypass(true)
        // Auto-clear the bypass after 8 s (covers slow devices and user hesitation).
        android.os.Handler(android.os.Looper.getMainLooper())
            .postDelayed({ setNuclearBypass(false) }, 8_000L)

        val intent = Intent(Intent.ACTION_DELETE).apply {
            data = Uri.parse("package:$packageName")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val activity = reactContext.currentActivity
        if (activity != null && !activity.isFinishing) {
            activity.startActivity(intent)
        } else {
            reactContext.startActivity(intent)
        }
    }
}
