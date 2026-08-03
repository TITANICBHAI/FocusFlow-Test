package com.tbtechs.focusflow.modules

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * ForegroundLaunchModule
 *
 * JS name: NativeModules.ForegroundLaunch
 * Methods:
 *   - goHome()                      → Promise<null>  — send device to home screen
 *   - bringToFront()                → Promise<null>  — re-launch FocusFlow over blocked app
 *   - showOverlay(message)          → Promise<null>  — brings to front (full overlay is deferred)
 *   - hasOverlayPermission()        → Promise<Boolean>
 *   - requestOverlayPermission()    → Promise<null>
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * DEFERRED FEATURE: Full-screen lock overlay
 *
 * The intent is to show a full-screen lock UI (task name + countdown) over the home
 * screen immediately when Activate Focus is tapped. Implementation requires:
 *
 *   1. A dedicated FocusLockActivity declared in AndroidManifest with
 *      android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen"
 *   2. Either USE_FULL_SCREEN_INTENT permission on the foreground notification
 *      (to launch FocusLockActivity as a high-priority full-screen intent)
 *      OR SYSTEM_ALERT_WINDOW permission for a WindowManager TYPE_APPLICATION_OVERLAY view.
 *   3. Config plugin (withFocusDayAndroid.js) addition to register the activity.
 *   4. The overlay must handle the Back button gracefully and dismiss when focus ends.
 *
 * Currently showOverlay() just calls bringToFront() as a placeholder.
 * ──────────────────────────────────────────────────────────────────────────────
 */
class ForegroundLaunchModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ForegroundLaunch"
    }

    override fun getName(): String = NAME

    /**
     * Sends the device to the home screen.
     * Used after Activate Focus is tapped so the user lands on their home screen,
     * while FocusFlow continues enforcing in the background.
     * No special permission required — this is a standard home intent.
     */
    @ReactMethod
    fun goHome(promise: Promise) {
        try {
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val activity = reactContext.currentActivity
            if (activity != null && !activity.isFinishing) {
                activity.startActivity(homeIntent)
            } else {
                reactContext.startActivity(homeIntent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("HOME_ERROR", e.message, e)
        }
    }

    /**
     * Brings FocusFlow back to the foreground.
     * Uses FLAG_ACTIVITY_SINGLE_TOP so the existing Activity is reused rather than stacked.
     */
    @ReactMethod
    fun bringToFront(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val intent = pm.getLaunchIntentForPackage(reactContext.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            intent?.let { reactContext.startActivity(it) }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("LAUNCH_ERROR", e.message, e)
        }
    }

    /**
     * Placeholder for the deferred full-screen overlay.
     * Currently just brings FocusFlow to front.
     */
    @ReactMethod
    fun showOverlay(message: String, promise: Promise) {
        bringToFront(promise)
    }

    /** Returns whether the SYSTEM_ALERT_WINDOW permission is granted. */
    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactContext))
        } else {
            promise.resolve(true)
        }
    }

    /** Opens the system overlay permission screen. */
    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("OVERLAY_ERROR", e.message, e)
        }
    }
}
