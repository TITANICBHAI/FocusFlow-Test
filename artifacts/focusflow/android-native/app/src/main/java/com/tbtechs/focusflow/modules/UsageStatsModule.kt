package com.tbtechs.focusflow.modules

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.app.usage.UsageStatsManager
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * UsageStatsModule
 *
 * JS name: NativeModules.UsageStats
 * Methods:
 *   - getForegroundApp()             → Promise<String?>
 *   - hasPermission()                → Promise<Boolean>  — Usage Access (AppOps)
 *   - openUsageAccessSettings()      → Promise<null>
 *   - hasAccessibilityPermission()   → Promise<Boolean>  — Accessibility Service enabled
 *   - isIgnoringBatteryOptimizations() → Promise<Boolean>
 *
 * Permission required: android.permission.PACKAGE_USAGE_STATS
 * Must be granted manually: Settings → Apps → Special app access → Usage access
 */
class UsageStatsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "UsageStats"
        private const val ACCESSIBILITY_SERVICE_ID =
            "com.tbtechs.focusflow/com.tbtechs.focusflow.services.AppBlockerAccessibilityService"
        private const val DEVICE_ADMIN_RECEIVER =
            "com.tbtechs.focusflow/com.tbtechs.focusflow.services.FocusDayDeviceAdminReceiver"
    }

    override fun getName(): String = NAME

    /**
     * Returns the package name of the current foreground app.
     * Queries the last 10 seconds of usage data and picks the most-recently-used entry.
     */
    @ReactMethod
    fun getForegroundApp(promise: Promise) {
        try {
            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 10_000, now)

            if (stats.isNullOrEmpty()) {
                promise.resolve(null)
                return
            }

            val foreground = stats.maxByOrNull { it.lastTimeUsed }?.packageName
            promise.resolve(foreground)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    /**
     * Returns whether the PACKAGE_USAGE_STATS (Usage Access) permission has been granted.
     *
     * Primary check: AppOpsManager.checkOpNoThrow — the standard API.
     * Secondary check: try a live query via UsageStatsManager; if we get results back, the
     * permission is actually granted even if AppOps reports an ambiguous mode (seen on some
     * Samsung One UI builds that return MODE_DEFAULT for granted usage-access permissions).
     */
    @ReactMethod
    fun hasPermission(promise: Promise) {
        try {
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
            if (mode == AppOpsManager.MODE_ALLOWED) {
                promise.resolve(true)
                return
            }
            // MODE_DEFAULT is returned on some Samsung One UI builds when the permission
            // has actually been granted. Verify by attempting a live usage-stats query.
            if (mode == AppOpsManager.MODE_DEFAULT) {
                val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val now = System.currentTimeMillis()
                val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 60_000, now)
                promise.resolve(!stats.isNullOrEmpty())
                return
            }
            // Huawei EMUI uses non-standard AppOps mode values outside the standard range.
            // If the mode is not MODE_IGNORED or MODE_ERRORED, attempt a live query as a
            // final fallback before resolving false.
            if (mode != AppOpsManager.MODE_IGNORED && mode != AppOpsManager.MODE_ERRORED) {
                val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val now = System.currentTimeMillis()
                val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 60_000, now)
                if (!stats.isNullOrEmpty()) {
                    promise.resolve(true)
                    return
                }
            }
            promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Opens the Usage Access settings list.
     *
     * Samsung One UI does NOT reliably handle the package-URI variant of
     * ACTION_USAGE_ACCESS_SETTINGS (the deep-link silently opens an empty screen
     * on many One UI 5/6 builds). We therefore always open the full list and let
     * the user tap FocusFlow manually — this is universally compatible.
     *
     * Uses currentActivity when available for reliable foreground-launch on API 34+.
     */
    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val activity = reactContext.currentActivity
            if (activity != null && !activity.isFinishing) {
                activity.startActivity(intent)
            } else {
                reactContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message, e)
        }
    }

    /**
     * Opens the Accessibility Settings screen with an OEM fallback chain.
     *
     * Mirrors the pattern from openBatteryOptimizationSettings():
     *   1. Try ACTION_ACCESSIBILITY_SETTINGS via currentActivity (reliable on API 34+)
     *   2. Fall back to general Settings.ACTION_SETTINGS
     *
     * This is safer than Linking.sendIntent() from JS which has no fallback chain
     * and silently fails on some MDM-managed company phones.
     */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        val activity = reactContext.currentActivity
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val launched = if (activity != null && !activity.isFinishing) {
            try { activity.startActivity(intent); true } catch (_: Exception) { false }
        } else {
            try { reactContext.startActivity(intent); true } catch (_: Exception) { false }
        }

        if (launched) {
            promise.resolve(null)
            return
        }

        // Fallback: open general settings
        try {
            val fallback = Intent(Settings.ACTION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(fallback)
        } catch (_: Exception) {}
        promise.resolve(null)
    }

    /**
     * Opens the Device Admin activation dialog for FocusDayDeviceAdminReceiver.
     *
     * Tries ACTION_ADD_DEVICE_ADMIN first (shows the system activation dialog).
     * On Samsung One UI the dialog may not appear if startActivity is called from
     * the application context; using currentActivity fixes this.
     * Falls back to the Samsung-specific security/device-admin path, then the
     * generic security settings, so the user always lands somewhere useful.
     */
    @ReactMethod
    fun openDeviceAdminSettings(promise: Promise) {
        val component = ComponentName(
            reactContext.packageName,
            "com.tbtechs.focusflow.services.FocusDayDeviceAdminReceiver"
        )
        val adminIntent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component)
            putExtra(
                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Prevents aggressive battery killers from stopping FocusFlow's blocking service."
            )
            // Do NOT set FLAG_ACTIVITY_NEW_TASK here — it conflicts with
            // startActivityForResult() and can prevent the dialog from appearing.
        }

        // ACTION_ADD_DEVICE_ADMIN requires startActivityForResult() to display the
        // system activation dialog. Plain startActivity() is silently accepted by
        // Android but never shows the dialog — the request code (1001) is arbitrary
        // since we don't need the result callback in this native module.
        val activity = reactContext.currentActivity
        val launched = if (activity != null && !activity.isFinishing) {
            try { activity.startActivityForResult(adminIntent, 1001); true } catch (_: Exception) { false }
        } else {
            try { reactContext.startActivity(adminIntent); true } catch (_: Exception) { false }
        }

        if (launched) {
            promise.resolve(null)
            return
        }

        // Fallback chain — class-name intents for OEMs that block ACTION_ADD_DEVICE_ADMIN
        // Note: class names must be set via setClassName(), NOT passed to the Intent()
        // constructor (which treats them as action strings and fails to resolve on all devices).
        val activity2 = reactContext.currentActivity
        val fallbackIntents = listOf(
            // AOSP / most stock Android: Device Admin list screen
            Intent().apply {
                setClassName("com.android.settings", "com.android.settings.DeviceAdminSettings")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            },
            // Samsung One UI 5+: Biometrics & Security → Device admin apps
            Intent().apply {
                setClassName(
                    "com.samsung.android.settings",
                    "com.samsung.android.settings.deviceadmin.DeviceAdminSettings"
                )
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            },
            // Generic security settings as last resort
            Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        )
        for (fb in fallbackIntents) {
            try {
                if (activity2 != null && !activity2.isFinishing) {
                    activity2.startActivity(fb)
                } else {
                    reactContext.startActivity(fb)
                }
                promise.resolve(null)
                return
            } catch (_: Exception) { /* try next */ }
        }

        promise.reject("DEVICE_ADMIN_ERROR", "Could not open device admin settings")
    }

    /**
     * Returns whether the AppBlockerAccessibilityService is enabled.
     *
     * Uses AccessibilityManager.getEnabledAccessibilityServiceList() rather than
     * reading the raw Settings.Secure string. Samsung One UI (and some other OEMs)
     * store service component names in a shortened dot-relative format that does
     * NOT match a plain string-contains check against the fully-qualified class
     * name — causing false negatives even when the service is enabled.
     *
     * The AccessibilityManager API always returns the resolved package name
     * regardless of how the OEM formats the internal settings string.
     */
    @ReactMethod
    fun hasAccessibilityPermission(promise: Promise) {
        try {
            val am = reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
            val enabled = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            val found = enabled.any { info ->
                info.resolveInfo.serviceInfo.packageName == reactContext.packageName
            }
            promise.resolve(found)
        } catch (e: Exception) {
            // Fallback: scan the raw settings string, checking for both the full
            // class name and the dot-relative shorthand Samsung sometimes uses.
            try {
                val raw = Settings.Secure.getString(
                    reactContext.contentResolver,
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                ) ?: ""
                val found = raw.split(":").any { component ->
                    component.contains(reactContext.packageName, ignoreCase = true) &&
                    component.contains("AppBlockerAccessibilityService", ignoreCase = true)
                }
                promise.resolve(found)
            } catch (e2: Exception) {
                promise.resolve(false)
            }
        }
    }

    /**
     * Opens the battery optimization exemption dialog directly for this app.
     *
     * ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS requires a "package:<name>" data URI —
     * it cannot be opened correctly via Linking.sendIntent() extras from JS.
     *
     * Samsung One UI 5+ blocks this action entirely (treats it as a security risk).
     * Fallback chain: full battery optimization list → general battery settings.
     */
    @ReactMethod
    fun openBatteryOptimizationSettings(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            promise.resolve(null)
            return
        }
        val activity = reactContext.currentActivity
        val launch = { intent: Intent ->
            try {
                if (activity != null && !activity.isFinishing) {
                    activity.startActivity(intent)
                } else {
                    reactContext.startActivity(intent.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK })
                }
                true
            } catch (_: Exception) { false }
        }

        // Best: opens a direct "Ignore optimizations?" dialog for FocusFlow
        val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${reactContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        if (launch(direct)) { promise.resolve(null); return }

        // Samsung One UI blocks ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS —
        // fall back to the full battery optimization list.
        val list = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        if (launch(list)) { promise.resolve(null); return }

        // Last resort
        val settings = Intent(Settings.ACTION_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        launch(settings)
        promise.resolve(null)
    }

    /**
     * Returns whether the app is exempted from battery optimization.
     * On Android M+ this is checked via PowerManager.isIgnoringBatteryOptimizations().
     * On older versions returns true (no battery optimization enforcement).
     */
    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
                promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Returns whether the app has an active Device Admin component registered.
     * Uses DevicePolicyManager.isAdminActive() with our FocusDayDeviceAdminReceiver
     * component. If the receiver class does not exist, returns false gracefully.
     *
     * Note: FocusDayDeviceAdminReceiver is a lightweight optional component.
     * If it is not declared in the manifest, this always returns false.
     */
    @ReactMethod
    fun isDeviceAdminActive(promise: Promise) {
        try {
            val dpm = reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val parts = DEVICE_ADMIN_RECEIVER.split("/")
            if (parts.size == 2) {
                val component = ComponentName(parts[0], parts[1])
                promise.resolve(dpm.isAdminActive(component))
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Returns whether sensitive permissions (Accessibility, Notification Listener,
     * Device Admin) are currently locked behind Android's "Restricted Settings"
     * dialog for this app — the OS-level wall introduced in Android 13 (API 33)
     * and tightened in Android 14/15 that greys out the toggle for sideloaded
     * apps until the user explicitly unblocks via:
     *
     *   App info → ⋮ menu → "Allow restricted settings"
     *
     * Detection strategy:
     *   1. Pre-API 33: always returns false (restricted settings did not exist).
     *   2. API 33+: queries AppOpsManager.OPSTR_ACCESS_RESTRICTED_SETTINGS for
     *      our own package. The op resolves to MODE_ALLOWED ONLY after the
     *      user has tapped "Allow restricted settings". Any other mode
     *      (MODE_IGNORED, MODE_ERRORED, MODE_DEFAULT) means the toggle is
     *      currently locked.
     *   3. As a sanity bypass, also returns false if the app was installed by
     *      Google Play Store (com.android.vending) or a known trusted OEM
     *      store — the OS auto-allows restricted settings for those installs
     *      and the AppOps state may briefly lag behind on first launch.
     *
     * Returns:
     *   true  → the Accessibility / Device Admin toggle will be greyed out;
     *           the user must do the App Info → ⋮ → Allow restricted settings
     *           flow first.
     *   false → toggle works normally (Android < 13, or already unblocked,
     *           or installed via Play Store / trusted OEM store).
     */
    @ReactMethod
    fun isRestrictedSettingsBlocked(promise: Promise) {
        try {
            // Restricted Settings did not exist before API 33.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                promise.resolve(false)
                return
            }

            // Bypass: trusted installer means the OS has already allowed
            // restricted settings for this install.
            val installer = try {
                val pm = reactContext.packageManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    pm.getInstallSourceInfo(reactContext.packageName).installingPackageName
                } else {
                    @Suppress("DEPRECATION")
                    pm.getInstallerPackageName(reactContext.packageName)
                }
            } catch (_: Exception) { null }

            val trustedInstallers = setOf(
                "com.android.vending",                  // Google Play Store
                "com.google.android.feedback",          // Play Store legacy
                "com.sec.android.app.samsungapps",      // Samsung Galaxy Store
                "com.heytap.market",                    // Oppo / Realme / OnePlus App Market
                "com.oppo.market",                      // Older Oppo store
                "com.xiaomi.market",                    // Xiaomi GetApps
                "com.bbk.appstore",                     // Vivo / iQOO App Store
                "com.huawei.appmarket"                  // Huawei AppGallery
            )
            if (installer != null && trustedInstallers.contains(installer)) {
                promise.resolve(false)
                return
            }

            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val uid = Process.myUid()
            val pkg = reactContext.packageName

            // Primary: call checkOpNoThrow(int, int, String) via reflection using
            // op code 111 (OP_ACCESS_RESTRICTED_SETTINGS, added in API 33).
            // This is more reliable than the string-based unsafeCheckOpNoThrow
            // across OEM builds where the string constant may be remapped.
            val mode: Int = try {
                val method = AppOpsManager::class.java.getMethod(
                    "checkOpNoThrow",
                    Int::class.java,
                    Int::class.java,
                    String::class.java
                )
                method.invoke(appOps, 111, uid, pkg) as Int
            } catch (_: Exception) {
                // Fallback: string-based lookup used on devices where reflection
                // fails (heavily customised OEM builds, future API changes).
                try {
                    appOps.unsafeCheckOpNoThrow(
                        "android:access_restricted_settings",
                        uid,
                        pkg
                    )
                } catch (_: Exception) {
                    // Both methods failed — can't determine. Show banner only
                    // when installer is unknown (sideloaded APK) to minimise
                    // false positives on OEM builds that don't support this op.
                    promise.resolve(installer == null)
                    return
                }
            }

            // MODE_ALLOWED means the user has tapped "Allow restricted settings"
            // (or the OS auto-allowed for this install). Anything else means the
            // toggle is currently greyed out.
            promise.resolve(mode != AppOpsManager.MODE_ALLOWED)
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Opens the system App Info screen for FocusFlow. This is where the user
     * finds the ⋮ (three-dot) menu containing "Allow restricted settings" — the
     * one-time unlock required on non-Samsung Android 13+ phones before the
     * Accessibility / Device Admin toggle becomes tappable.
     *
     * Action: Settings.ACTION_APPLICATION_DETAILS_SETTINGS with package URI.
     * This is the official AOSP intent and works on every OEM (Pixel, Oppo,
     * Realme, OnePlus, Xiaomi, Vivo, Motorola, Nothing, Sony, Samsung).
     */
    @ReactMethod
    fun openAppInfoSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val activity = reactContext.currentActivity
            if (activity != null && !activity.isFinishing) {
                activity.startActivity(intent)
            } else {
                reactContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            // Last-resort fallback: drop into the global Settings root.
            try {
                reactContext.startActivity(Intent(Settings.ACTION_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                })
            } catch (_: Exception) {}
            promise.resolve(null)
        }
    }

    /**
     * Returns the package name of the app that installed FocusFlow on this
     * device, or null if unknown. Used by the JS layer to show OEM-specific
     * guidance (e.g. "you installed via Aptoide — Android requires an extra
     * unlock step before Accessibility can be enabled").
     */
    @ReactMethod
    fun getInstallerPackage(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val installer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                pm.getInstallSourceInfo(reactContext.packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                pm.getInstallerPackageName(reactContext.packageName)
            }
            promise.resolve(installer)
        } catch (_: Exception) {
            promise.resolve(null)
        }
    }

    /**
     * Returns the device manufacturer string in lower-case (e.g. "samsung",
     * "xiaomi", "oneplus", "realme", "oppo", "google"). Used by the JS layer
     * to pre-select the correct brand in the Troubleshoot modal so users don't
     * have to pick manually.
     */
    @ReactMethod
    fun getDeviceManufacturer(promise: Promise) {
        promise.resolve(Build.MANUFACTURER.lowercase())
    }
}
