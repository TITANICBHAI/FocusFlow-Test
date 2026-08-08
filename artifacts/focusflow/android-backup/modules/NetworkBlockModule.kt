package com.tbtechs.focusflow.modules

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tbtechs.focusflow.services.NetworkBlockerVpnService
import org.json.JSONObject

/**
 * NetworkBlockModule
 *
 * JS name: NativeModules.NetworkBlock
 *
 * Exposes network-blocking configuration and control to the JavaScript settings layer.
 * The actual blocking is performed by [NetworkBlockerVpnService] (VPN tunnel) and
 * supplemented by direct WiFi API calls on older Android versions.
 *
 * ── What each mechanism does ──────────────────────────────────────────────────
 *
 *   VPN (net_block_vpn = true)
 *     A local null-routing VPN tunnel that drops all packets. Works on Android 5+,
 *     blocks BOTH WiFi and mobile data simultaneously without root. Requires a
 *     one-time user consent dialog. This is the primary and most reliable mechanism.
 *
 *   WiFi direct disable (net_block_wifi = true)
 *     Calls WifiManager.setWifiEnabled(false). Only works on Android 9 and below —
 *     on Android 10+ it silently fails (API was removed for non-system apps).
 *     Falls back to WifiManager.disconnect() on newer Android.
 *
 *   Mobile data direct disable (net_block_mobile = true)
 *     Attempts to disable mobile data via a hidden ConnectivityManager method
 *     (reflection). Works on some OEM skins (older MIUI, Samsung); fails silently
 *     elsewhere. VPN is always the reliable fallback for mobile data.
 *
 * ── Settings stored in SharedPrefs ("focusday_prefs") ────────────────────────
 *
 *   net_block_enabled   Boolean — master toggle (default false)
 *   net_block_vpn       Boolean — use VPN tunnel (recommended, default true)
 *   net_block_wifi      Boolean — also try direct WiFi disable (default true)
 *   net_block_mobile    Boolean — also try mobile data disable (default false)
 *   net_block_global    Boolean — block ALL traffic vs only blocked app traffic (default false)
 *   net_block_restore   Boolean — restore connectivity when session ends (default true)
 *   net_block_packages  String  — JSON array of packages that trigger network block;
 *                                  empty array = applies to ALL blocked apps
 *
 * ── JS-callable methods ───────────────────────────────────────────────────────
 *
 *   isVpnPermissionGranted()          → Promise<Boolean>
 *   requestVpnPermission()            → Promise<null>   — shows system VPN dialog
 *   getNetworkBlockSettings()         → Promise<String>  — full settings JSON
 *   setNetworkBlockSettings(json)     → Promise<null>
 *   startNetworkBlock(packagesJson)   → Promise<null>   — activate VPN + WiFi block
 *   stopNetworkBlock()                → Promise<null>   — deactivate + restore
 *   isNetworkBlockActive()            → Promise<Boolean>
 *   tryDisableWifi()                  → Promise<null>   — direct WiFi action
 *   tryRestoreWifi()                  → Promise<null>   — re-enable WiFi
 */
class NetworkBlockModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFS_NAME = "focusday_prefs"
    }

    override fun getName(): String = "NetworkBlock"

    private val prefs: SharedPreferences
        get() = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ─── VPN permission ───────────────────────────────────────────────────────

    /**
     * Returns true if the VPN permission has already been granted by the user.
     * VpnService.prepare() returns null when the permission is already held.
     */
    @ReactMethod
    fun isVpnPermissionGranted(promise: Promise) {
        try {
            val intent = VpnService.prepare(reactContext)
            promise.resolve(intent == null)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Shows the system "FocusFlow wants to set up a VPN" consent dialog.
     * Must be called from an Activity context. The dialog is shown once and
     * the permission persists until the user manually revokes it.
     *
     * Resolves immediately after the dialog Intent is launched.
     * The caller should re-check isVpnPermissionGranted() after a short delay.
     */
    @ReactMethod
    fun requestVpnPermission(promise: Promise) {
        try {
            val vpnIntent = VpnService.prepare(reactContext) ?: run {
                promise.resolve(null)   // already granted
                return
            }
            val activity = reactContext.currentActivity
            if (activity != null && !activity.isFinishing) {
                activity.startActivityForResult(vpnIntent, 2001)
                promise.resolve(null)
            } else {
                promise.reject("NO_ACTIVITY", "No foreground activity to show VPN dialog")
            }
        } catch (e: Exception) {
            promise.reject("VPN_PERM_ERROR", e.message, e)
        }
    }

    // ─── Settings ─────────────────────────────────────────────────────────────

    /**
     * Returns all network-block settings as a JSON object string.
     */
    @ReactMethod
    fun getNetworkBlockSettings(promise: Promise) {
        try {
            val obj = JSONObject().apply {
                put("enabled",  prefs.getBoolean("net_block_enabled", false))
                put("vpn",      prefs.getBoolean("net_block_vpn",     false))
                put("wifi",     prefs.getBoolean("net_block_wifi",    true))
                put("mobile",   prefs.getBoolean("net_block_mobile",  false))
                put("global",   prefs.getBoolean("net_block_global",  false))
                put("restore",  prefs.getBoolean("net_block_restore", true))
                put("packages", prefs.getString("net_block_packages", "[]") ?: "[]")
            }
            promise.resolve(obj.toString())
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Persists network-block settings from a JSON object string.
     * Only keys present in [settingsJson] are updated; missing keys are left unchanged.
     *
     * Accepted keys: enabled, vpn, wifi, mobile, global, restore, packages
     */
    @ReactMethod
    fun setNetworkBlockSettings(settingsJson: String, promise: Promise) {
        try {
            val obj = JSONObject(settingsJson)
            val editor = prefs.edit()
            if (obj.has("enabled"))  editor.putBoolean("net_block_enabled", obj.getBoolean("enabled"))
            if (obj.has("vpn"))      editor.putBoolean("net_block_vpn",     obj.getBoolean("vpn"))
            if (obj.has("wifi"))     editor.putBoolean("net_block_wifi",    obj.getBoolean("wifi"))
            if (obj.has("mobile"))   editor.putBoolean("net_block_mobile",  obj.getBoolean("mobile"))
            if (obj.has("global"))   editor.putBoolean("net_block_global",  obj.getBoolean("global"))
            if (obj.has("restore"))  editor.putBoolean("net_block_restore", obj.getBoolean("restore"))
            if (obj.has("packages")) editor.putString("net_block_packages", obj.getString("packages"))
            editor.apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("INVALID_JSON", e.message, e)
        }
    }

    // ─── Active control ───────────────────────────────────────────────────────

    /**
     * Activates network blocking for [packagesJson] (JSON array of package names).
     * Combines all enabled mechanisms: VPN tunnel + direct WiFi disable.
     *
     * If the master toggle (net_block_enabled) is false, this is a no-op.
     * If VPN permission has not been granted, VPN block is skipped but WiFi
     * actions are still attempted.
     */
    @ReactMethod
    fun startNetworkBlock(packagesJson: String, promise: Promise) {
        try {
            if (!prefs.getBoolean("net_block_enabled", false)) {
                promise.resolve(null)
                return
            }

            val useVpn    = prefs.getBoolean("net_block_vpn",    false)
            val useWifi   = prefs.getBoolean("net_block_wifi",   true)
            val useMobile = prefs.getBoolean("net_block_mobile", false)
            val global    = prefs.getBoolean("net_block_global", false)

            // 1 — VPN tunnel (primary, most reliable)
            if (useVpn && !NetworkBlockerVpnService.isRunning) {
                val vpnPermission = VpnService.prepare(reactContext)
                if (vpnPermission == null) {   // permission already granted
                    val mode = if (global) NetworkBlockerVpnService.MODE_GLOBAL
                               else        NetworkBlockerVpnService.MODE_PER_APP
                    val intent = Intent(reactContext, NetworkBlockerVpnService::class.java).apply {
                        action = NetworkBlockerVpnService.ACTION_START
                        putExtra(NetworkBlockerVpnService.EXTRA_PACKAGES, packagesJson)
                        putExtra(NetworkBlockerVpnService.EXTRA_MODE, mode)
                    }
                    reactContext.startService(intent)
                }
                // If permission is not granted, skip VPN — WiFi/data actions may still fire
            }

            // 2 — Direct WiFi disable (supplementary; works on Android 9-)
            if (useWifi) {
                tryDisableWifiInternal()
            }

            // 3 — Mobile data disable via reflection (best-effort)
            if (useMobile) {
                tryDisableMobileDataInternal()
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("NET_BLOCK_ERROR", e.message, e)
        }
    }

    /**
     * Deactivates all network-blocking mechanisms and restores connectivity
     * if the net_block_restore setting is true.
     *
     * When a session PIN is configured, [pinHash] must be the correct SHA-256 hex
     * digest of the PIN. A bare JS bridge call without the correct PIN will be
     * rejected regardless of focus state.
     *
     * @param pinHash SHA-256 hex of the PIN, or null/empty if no PIN is configured
     */
    @ReactMethod
    fun stopNetworkBlock(pinHash: String?, promise: Promise) {
        val storedHash = prefs.getString(
            com.tbtechs.focusflow.modules.SessionPinModule.PREF_PIN_HASH, null
        )
        if (!storedHash.isNullOrBlank()) {
            if (pinHash.isNullOrBlank() ||
                !storedHash.equals(pinHash.lowercase(), ignoreCase = true)) {
                promise.reject("PIN_REQUIRED", "A session PIN is set — supply the correct PIN hash to stop network block")
                return
            }
        }
        try {
            val intent = Intent(reactContext, NetworkBlockerVpnService::class.java).apply {
                action = NetworkBlockerVpnService.ACTION_STOP
            }
            try { reactContext.startService(intent) } catch (_: Exception) {}

            val restore = prefs.getBoolean("net_block_restore", true)
            if (restore) {
                if (prefs.getBoolean("net_block_wifi", true)) {
                    tryRestoreWifiInternal()
                }
                if (prefs.getBoolean("net_block_mobile", false)) {
                    tryRestoreMobileDataInternal()
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("NET_RESTORE_ERROR", e.message, e)
        }
    }

    /**
     * Returns true if the VPN tunnel is currently active.
     */
    @ReactMethod
    fun isNetworkBlockActive(promise: Promise) {
        promise.resolve(NetworkBlockerVpnService.isRunning)
    }

    // ─── VPN conflict detection ───────────────────────────────────────────────

    /**
     * Returns true if a VPN from another app is currently active on the device.
     * FocusFlow's own VPN is excluded — if [NetworkBlockerVpnService.isRunning]
     * is true the conflict check is skipped (we ARE the active VPN).
     *
     * Iterates ConnectivityManager.allNetworks() and checks each network's
     * capabilities for TRANSPORT_VPN. Requires no additional permissions.
     * Falls back to false on any error so it never blocks enabling VPN.
     */
    @ReactMethod
    fun isAnotherVpnActive(promise: Promise) {
        try {
            if (NetworkBlockerVpnService.isRunning) {
                // Our own VPN is running — not a conflict
                promise.resolve(false)
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE)
                    as? ConnectivityManager
                if (cm != null) {
                    for (network in cm.allNetworks) {
                        val caps = cm.getNetworkCapabilities(network) ?: continue
                        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                            promise.resolve(true)
                            return
                        }
                    }
                }
            }
            promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ─── VPN self-heal ────────────────────────────────────────────────────────

    /**
     * Persists the "net_block_self_heal" flag to SharedPrefs (key: net_block_self_heal).
     *
     * When [enabled] is true, two complementary native mechanisms keep the VPN alive:
     *   1. [NetworkBlockerVpnService.onRevoke] — schedules a single restart 3 s after
     *      the tunnel is revoked, if a blocking session is still active.
     *   2. [AppBlockerAccessibilityService] — runs a 10-second health-check loop and
     *      re-fires the VPN start intent whenever the tunnel is found to be down.
     */
    @ReactMethod
    fun setVpnSelfHealEnabled(enabled: Boolean, promise: Promise) {
        try {
            prefs.edit().putBoolean("net_block_self_heal", enabled).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SELF_HEAL_ERROR", e.message, e)
        }
    }

    // ─── Direct WiFi control (JS-callable, for manual use in settings UI) ─────

    @ReactMethod
    fun tryDisableWifi(promise: Promise) {
        try {
            tryDisableWifiInternal()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIFI_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun tryRestoreWifi(promise: Promise) {
        try {
            tryRestoreWifiInternal()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIFI_ERROR", e.message, e)
        }
    }

    // ─── Internal WiFi helpers ────────────────────────────────────────────────

    /**
     * Attempts to disable WiFi.
     *
     * Android 9 and below: calls WifiManager.setWifiEnabled(false) — turns WiFi off
     * completely. Requires CHANGE_WIFI_STATE permission.
     *
     * Android 10+: setWifiEnabled() is a no-op for third-party apps (API restriction).
     * We fall back to WifiManager.disconnect() which drops the current association
     * while leaving WiFi enabled. The user can reconnect manually, but many lazy
     * bypass attempts are stopped by the friction of having to re-authenticate.
     */
    private fun tryDisableWifiInternal() {
        val wm = reactContext.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            @Suppress("DEPRECATION")
            wm.isWifiEnabled = false
        } else {
            wm.disconnect()   // best we can do on API 29+ without system privileges
        }
    }

    /**
     * Attempts to re-enable WiFi.
     * Only functional on Android 9 and below for the same reason as above.
     */
    private fun tryRestoreWifiInternal() {
        val wm = reactContext.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            @Suppress("DEPRECATION")
            wm.isWifiEnabled = true
        }
        // On Android 10+ WiFi was only disconnected (not disabled), no action needed
    }

    // ─── Internal mobile data helpers ─────────────────────────────────────────

    /**
     * Attempts to disable mobile data via a hidden reflection API.
     *
     * This method was removed from the public SDK but remains present in the
     * framework on many OEM builds (older Samsung, MIUI 12-, ColorOS).
     * On Android 10+ and stock AOSP it typically throws a SecurityException
     * or NoSuchMethodException — both are caught and silently ignored.
     * The VPN tunnel is the reliable enforcer on those devices.
     */
    private fun tryDisableMobileDataInternal() {
        try {
            val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            val method = cm?.javaClass?.getDeclaredMethod("setMobileDataEnabled", Boolean::class.java)
            method?.isAccessible = true
            method?.invoke(cm, false)
        } catch (_: Exception) {
            // Not available on this device — VPN handles mobile data blocking.
        }
    }

    private fun tryRestoreMobileDataInternal() {
        try {
            val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            val method = cm?.javaClass?.getDeclaredMethod("setMobileDataEnabled", Boolean::class.java)
            method?.isAccessible = true
            method?.invoke(cm, true)
        } catch (_: Exception) { /* no-op */ }
    }
}
