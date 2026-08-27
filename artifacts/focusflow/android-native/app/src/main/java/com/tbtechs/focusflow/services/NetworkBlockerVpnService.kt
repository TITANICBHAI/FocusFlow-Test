package com.tbtechs.focusflow.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.tbtechs.focusflow.MainActivity
import com.tbtechs.focusflow.R
import org.json.JSONArray

/**
 * NetworkBlockerVpnService
 *
 * A null-routing VPN service — establishes a local VPN tunnel and simply never
 * forwards any packets, causing all routed traffic to be silently dropped.
 * This is the most reliable way to cut a blocked app's internet access on any
 * Android version without root or system permissions.
 *
 * How it works:
 *   Android's VpnService API lets an app intercept device traffic by creating a
 *   virtual TUN network interface. Once established, Android routes packets into
 *   the interface. This service holds that interface open but never reads from it
 *   or sends packets back — the OS waits, times out, and the app gets nothing.
 *
 * Two blocking scopes (set via Intent extras on start):
 *
 *   PER_APP  (default)
 *     Uses VpnService.Builder.addAllowedApplication() to route ONLY the specific
 *     blocked app's traffic through the VPN. All other apps continue using the
 *     normal network. This is the least-invasive option and what FocusFlow uses
 *     by default: the internet works fine for everything except the blocked app.
 *
 *   GLOBAL
 *     Routes ALL device traffic through the VPN. Both WiFi and mobile data are
 *     effectively cut. Emergency apps (phone/dialer) are always excluded via
 *     addDisallowedApplication() so calls still work.
 *
 * Activation flow:
 *   1. JS layer calls NetworkBlockModule.requestVpnPermission() — shows the
 *      one-time system "FocusFlow wants to set up a VPN" consent dialog.
 *   2. User grants permission once (persists indefinitely unless revoked).
 *   3. AppBlockerAccessibilityService calls startNetworkBlock(pkg) whenever a
 *      blocked app is detected.
 *   4. This service starts, establishes the VPN, and holds it.
 *   5. ForegroundTaskService calls stopNetworkBlock() when the session ends,
 *      or BlockOverlayActivity calls it when the user navigates back to FocusFlow.
 *
 * SharedPrefs keys consumed (read on start):
 *   net_block_mode          "per_app" | "global"
 *   net_block_packages      JSON array — packages to block (used in per_app mode)
 *
 * Static state:
 *   isRunning               Boolean — checked by AccessibilityService before starting
 */
class NetworkBlockerVpnService : VpnService() {

    companion object {
        const val ACTION_START = "com.tbtechs.focusflow.NET_BLOCK_START"
        const val ACTION_STOP  = "com.tbtechs.focusflow.NET_BLOCK_STOP"

        const val EXTRA_PACKAGES = "net_block_pkgs"   // JSON array of packages to block
        const val EXTRA_MODE     = "net_block_mode"   // "per_app" | "global"
        const val EXTRA_POLICY_GENERATION = "net_block_policy_generation"

        const val MODE_PER_APP = "per_app"
        const val MODE_GLOBAL  = "global"

        private const val CHANNEL_ID      = "focusday_vpn"
        private const val NOTIFICATION_ID = 1002
        private const val PREFS_NAME      = "focusday_prefs"
        private const val PREF_STATUS      = "vpn_status"
        private const val PREF_ERROR       = "vpn_error"
        private const val PREF_FAILED_PKGS = "vpn_failed_packages"
        private const val PREF_EXPLICIT_PKGS = "net_block_explicit_packages"
        private const val PREF_FOCUS_MIRROR = "net_block_focus_mirror"
        private const val PREF_STANDALONE_PKGS = "standalone_blocked_packages"
        private const val PREF_DESIRED_POLICY = "net_block_desired_policy"
        private const val PREF_POLICY_GENERATION = "net_block_policy_generation"
        private const val PREF_APPLIED_GENERATION = "net_block_applied_generation"
        private val policySyncLock = Any()

        const val STATUS_DISABLED = "disabled"
        const val STATUS_STARTING = "starting"
        const val STATUS_RUNNING = "running"
        const val STATUS_STOPPED = "stopped"
        const val STATUS_PERMISSION_MISSING = "permission_missing"
        const val STATUS_ANOTHER_VPN = "another_vpn_active"
        const val STATUS_PACKAGE_FAILURE = "package_registration_failed"
        const val STATUS_STARTUP_FAILED = "startup_failed"

        /**
         * These packages are ALWAYS excluded from VPN routing so that
         * emergency calls, SMS, and the Android OS itself remain reachable.
         */
        private val ALWAYS_EXCLUDED = listOf(
            "android",
            "com.android.phone",
            "com.android.dialer",
            "com.google.android.dialer",
            "com.samsung.android.app.telephonyui",
            "com.android.server.telecom",
            "com.android.mms",
            "com.android.messaging",
            "com.google.android.apps.messaging"
        )

        /** Checked by AccessibilityService before firing a duplicate start. */
        @Volatile var isRunning: Boolean = false

        /**
         * VPN-only selections are independent of overlay/session state. Keep a
         * persisted configuration alive after process/service recreation even
         * when no Focus or Standalone session is active.
         */
        fun hasPersistentVpnConfiguration(prefs: SharedPreferences): Boolean {
            if (!prefs.getBoolean("net_block_enabled", false) ||
                !prefs.getBoolean("net_block_vpn", true)
            ) return false

            if (prefs.getBoolean("net_block_global", false)) return true
            if (prefs.getBoolean(PREF_FOCUS_MIRROR, false) &&
                prefs.getBoolean("focus_active", false)
            ) return true
            if (isStandaloneBlockActive(prefs) &&
                parsePackageJson(prefs.getString(PREF_STANDALONE_PKGS, "[]") ?: "[]").isNotEmpty()
            ) return true

            return try {
                parsePackageJson(
                    prefs.getString(PREF_EXPLICIT_PKGS, null)
                        ?: prefs.getString("net_block_packages", "[]")
                        ?: "[]",
                ).isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        /**
         * Computes the effective per-app target set from persisted policy.
         * Explicit VPN selections remain independent; focus mirroring adds the
         * launchable apps that are not in the current focus allow-list.
         */
        private data class EffectivePolicy(
            val targets: List<String>,
            val explicit: List<String>,
            val standalone: List<String>,
            val focus: List<String>,
            val invalid: List<String>,
        )

        private fun effectivePolicy(context: Context, prefs: SharedPreferences): EffectivePolicy {
            val explicitCandidates = parsePackageJson(
                prefs.getString(PREF_EXPLICIT_PKGS, null)
                    ?: prefs.getString("net_block_packages", "[]")
                    ?: "[]",
            )
            val standaloneCandidates = if (isStandaloneBlockActive(prefs)) {
                parsePackageJson(prefs.getString(PREF_STANDALONE_PKGS, "[]") ?: "[]")
            } else {
                emptyList()
            }
            if (!prefs.getBoolean(PREF_FOCUS_MIRROR, false) ||
                !prefs.getBoolean("focus_active", false)
            ) {
                val sourcePackages = (explicitCandidates + standaloneCandidates)
                    .filterNot { it == context.packageName || it in ALWAYS_EXCLUDED }
                    .distinct()
                    .sorted()
                val invalid = sourcePackages.filterNot { isInstalled(context, it) }
                return EffectivePolicy(
                    targets = sourcePackages.filterNot { it in invalid },
                    explicit = explicitCandidates.distinct().sorted(),
                    standalone = standaloneCandidates.distinct().sorted(),
                    focus = emptyList(),
                    invalid = invalid,
                )
            }

            val allowed = parsePackageJson(prefs.getString("allowed_packages", "[]") ?: "[]").toSet()
            val focusTargets = try {
                val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                context.packageManager.queryIntentActivities(launcherIntent, 0)
                    .map { it.activityInfo.packageName }
                    .filter { it != context.packageName }
                    .filter { it !in ALWAYS_EXCLUDED }
                    .filter { it !in allowed }
            } catch (_: Exception) {
                emptyList()
            }
            val sourcePackages = (explicitCandidates + standaloneCandidates + focusTargets)
                .filterNot { it == context.packageName || it in ALWAYS_EXCLUDED }
                .distinct()
                .sorted()
            val invalid = sourcePackages.filterNot { isInstalled(context, it) }
            return EffectivePolicy(
                targets = sourcePackages.filterNot { it in invalid },
                explicit = explicitCandidates.distinct().sorted(),
                standalone = standaloneCandidates.distinct().sorted(),
                focus = focusTargets.distinct().sorted(),
                invalid = invalid,
            )
        }

        private fun isInstalled(context: Context, packageName: String): Boolean =
            try {
                context.packageManager.getApplicationInfo(packageName, 0)
                true
            } catch (_: Exception) {
                false
            }

        fun effectivePackages(context: Context, prefs: SharedPreferences): List<String> =
            effectivePolicy(context, prefs).targets

        fun effectivePackagesJson(context: Context, prefs: SharedPreferences): String =
            JSONArray(effectivePolicy(context, prefs).targets).toString()

        fun currentPolicyGeneration(prefs: SharedPreferences): Long =
            prefs.getLong(PREF_POLICY_GENERATION, 0L)

        private fun isStandaloneBlockActive(prefs: SharedPreferences): Boolean {
            if (!prefs.getBoolean("standalone_block_active", false)) return false
            val untilMs = prefs.getLong("standalone_block_until_ms", 0L)
            return untilMs <= 0L || untilMs > System.currentTimeMillis()
        }

        private fun persistDesiredPolicy(
            prefs: SharedPreferences,
            enabled: Boolean,
            vpnEnabled: Boolean,
            global: Boolean,
            policy: EffectivePolicy,
        ) {
            val reasons = JSONObject()

            fun addReasons(packages: List<String>, reason: String) {
                packages.forEach { pkg ->
                    val existing = reasons.optJSONArray(pkg) ?: JSONArray()
                    var alreadyPresent = false
                    for (index in 0 until existing.length()) {
                        if (existing.optString(index) == reason) {
                            alreadyPresent = true
                            break
                        }
                    }
                    if (!alreadyPresent) existing.put(reason)
                    reasons.put(pkg, existing)
                }
            }

            addReasons(policy.explicit, "explicit_vpn")
            addReasons(policy.standalone, "standalone_block")
            addReasons(policy.focus, "focus_blocked")
            addReasons(policy.invalid, "invalid_package")

            val generation = prefs.getLong(PREF_POLICY_GENERATION, 0L) + 1L
            val record = JSONObject().apply {
                put("version", 1)
                put("generation", generation)
                put("enabled", enabled)
                put("vpnEnabled", vpnEnabled)
                put("mode", if (global) MODE_GLOBAL else MODE_PER_APP)
                put("targetPackages", JSONArray(policy.targets))
                put("explicitPackages", JSONArray(policy.explicit))
                put("failedPackages", JSONArray(policy.invalid))
                put("focusMirrorEnabled", prefs.getBoolean(PREF_FOCUS_MIRROR, false))
                put("reasons", reasons)
                put("updatedAt", System.currentTimeMillis())
            }
            prefs.edit()
                .putLong(PREF_POLICY_GENERATION, generation)
                .putString(PREF_DESIRED_POLICY, record.toString())
                .apply()
        }

        /**
         * Re-applies the persisted network policy after a focus/allow-list or
         * settings change. This runs in native code so a killed JS process does
         * not leave the VPN using a stale package set.
         */
        fun requestSync(context: Context) {
            synchronized(policySyncLock) {
                requestSyncLocked(context)
            }
        }

        private fun requestSyncLocked(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean("net_block_enabled", false)
            val vpnEnabled = prefs.getBoolean("net_block_vpn", true)
            val global = prefs.getBoolean("net_block_global", false)
            val policy = effectivePolicy(context, prefs)
            val packagesJson = JSONArray(policy.targets).toString()
            persistDesiredPolicy(
                prefs = prefs,
                enabled = enabled,
                vpnEnabled = vpnEnabled,
                global = global,
                policy = policy,
            )

            // Keep the canonical snapshot aligned even when the new effective
            // policy is empty or VPN is disabled. Recovery paths may still run
            // after this call, so leaving the previous target list here would
            // advertise stale protection state.
            prefs.edit()
                .putString("net_block_packages", packagesJson)
                .putString("vpn_failed_packages", JSONArray(policy.invalid).toString())
                .putString(
                    "net_block_mode",
                    if (global) MODE_GLOBAL else MODE_PER_APP,
                )
                .apply()

            if (!enabled || !vpnEnabled) {
                val stopIntent = Intent(context, NetworkBlockerVpnService::class.java).apply {
                    action = ACTION_STOP
                    putExtra(EXTRA_POLICY_GENERATION, currentPolicyGeneration(prefs))
                }
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(stopIntent)
                    } else {
                        context.startService(stopIntent)
                    }
                } catch (_: Exception) {}
                return
            }

            if (!global && parsePackageJson(packagesJson).isEmpty()) {
                val stopIntent = Intent(context, NetworkBlockerVpnService::class.java).apply {
                    action = ACTION_STOP
                    putExtra(EXTRA_POLICY_GENERATION, currentPolicyGeneration(prefs))
                }
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(stopIntent)
                    } else {
                        context.startService(stopIntent)
                    }
                } catch (_: Exception) {}
                return
            }

            val startIntent = Intent(context, NetworkBlockerVpnService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_PACKAGES, packagesJson)
                putExtra(EXTRA_MODE, if (global) MODE_GLOBAL else MODE_PER_APP)
                putExtra(EXTRA_POLICY_GENERATION, currentPolicyGeneration(prefs))
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(startIntent)
                } else {
                    context.startService(startIntent)
                }
            } catch (_: Exception) {}
        }

        private fun parsePackageJson(json: String): List<String> {
            return try {
                val arr = JSONArray(json)
                (0 until arr.length())
                    .map { arr.optString(it) }
                    .filter { it.isNotBlank() }
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var activePackagesJson: String? = null
    private var activeMode: String? = null

    private fun writeStatus(
        state: String,
        error: String? = null,
        failedPackages: List<String> = emptyList(),
    ) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(PREF_STATUS, state)
            .putString(PREF_ERROR, error)
            .putString(PREF_FAILED_PKGS, JSONArray(failedPackages).toString())
            .apply()
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                if (isStalePolicyCommand(intent)) return START_STICKY
                VpnRecoveryNotifier.clear(this)
                stopVpn()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                val packagesJson = intent.getStringExtra(EXTRA_PACKAGES) ?: "[]"
                val mode         = intent.getStringExtra(EXTRA_MODE) ?: MODE_PER_APP
                val generation = intent.getLongExtra(EXTRA_POLICY_GENERATION, 0L)
                startVpn(packagesJson, mode, generation)
            }
            else -> {
                // Restarted by OS — restore from prefs
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val focusActive = prefs.getBoolean("focus_active", false)
                val saActive    = prefs.getBoolean("standalone_block_active", false)
                if (focusActive || saActive || hasPersistentVpnConfiguration(prefs)) {
                    val pkgs = effectivePackagesJson(this, prefs)
                    val mode = prefs.getString("net_block_mode", MODE_PER_APP) ?: MODE_PER_APP
                    startVpn(pkgs, mode)
                } else {
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
        }
        return START_STICKY
    }

    /**
     * Called by Android when our VPN is revoked — either by the user tapping the
     * quick-settings tile, or because another VPN app started and kicked us out.
     *
     * If "net_block_self_heal" is enabled AND a blocking session is still active,
     * a single restart attempt is scheduled 3 seconds later. The delay lets the
     * OS finish tearing down the existing tunnel before we try to re-establish it.
     *
     * If the user deliberately switched to a different VPN, FocusFlow's restart
     * intent will fail silently because VpnService.prepare() will return a non-null
     * Intent (the other app's VPN is now the active one). This is safe — we do not
     * fight another VPN; we just try once and give up gracefully.
     */
    override fun onRevoke() {
        val prefs     = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val selfHeal  = prefs.getBoolean("net_block_self_heal", false)

        val now = System.currentTimeMillis()
        val focusOn = prefs.getBoolean("focus_active", false).let { on ->
            if (!on) false
            else {
                val endMs = prefs.getLong("task_end_ms", 0L)
                endMs <= 0L || now < endMs
            }
        }
        val saOn = prefs.getBoolean("standalone_block_active", false).let { on ->
            if (!on) false
            else {
                val untilMs = prefs.getLong("standalone_block_until_ms", 0L)
                untilMs <= 0L || now < untilMs
            }
        }
        stopVpn()   // close the TUN fd first

        // Signal to the JS layer that VPN permission was lost.
        // This flag is read by NetworkBlockModule.isVpnPermissionGranted() and
        // used to surface the re-grant prompt in the UI. The flag is cleared
        // by startVpn() if a subsequent restart succeeds.
        val persistentVpn = hasPersistentVpnConfiguration(prefs)
        if (focusOn || saOn || persistentVpn) {
            prefs.edit()
                .putBoolean("vpn_permission_lost", true)
                .apply()
            writeStatus(STATUS_PERMISSION_MISSING, "VPN permission was revoked or another VPN took over")
            VpnRecoveryNotifier.postPermissionRequired(this)
        }

        if (selfHeal && (focusOn || saOn || persistentVpn)) {
            val ctx  = applicationContext
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    // Re-read every policy source after the teardown delay.
                    // The policy may have changed, expired, or been cleared
                    // while the old tunnel was being released.
                    val currentPrefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    if (!currentPrefs.getBoolean("net_block_self_heal", false)) {
                        return@postDelayed
                    }
                    val currentNow = System.currentTimeMillis()
                    val currentFocus = currentPrefs.getBoolean("focus_active", false) &&
                        (currentPrefs.getLong("task_end_ms", 0L) <= 0L ||
                            currentNow < currentPrefs.getLong("task_end_ms", 0L))
                    val currentStandalone = currentPrefs.getBoolean("standalone_block_active", false) &&
                        (currentPrefs.getLong("standalone_block_until_ms", 0L) <= 0L ||
                            currentNow < currentPrefs.getLong("standalone_block_until_ms", 0L))
                    val currentPersistent = hasPersistentVpnConfiguration(currentPrefs)
                    if (!currentFocus && !currentStandalone &&
                        !currentPersistent
                    ) return@postDelayed
                    if (VpnService.prepare(ctx) != null) return@postDelayed

                    val pkgs = effectivePackagesJson(ctx, currentPrefs)
                    val global = currentPrefs.getBoolean("net_block_global", false)
                    if (!global && parseJsonArray(pkgs).isEmpty()) return@postDelayed
                    val mode = if (global) MODE_GLOBAL else MODE_PER_APP
                    val restartIntent = Intent(ctx, NetworkBlockerVpnService::class.java).apply {
                        action = ACTION_START
                        putExtra(EXTRA_PACKAGES, pkgs)
                        putExtra(EXTRA_MODE, mode)
                        putExtra(EXTRA_POLICY_GENERATION, currentPolicyGeneration(currentPrefs))
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        ctx.startForegroundService(restartIntent)
                    } else {
                        ctx.startService(restartIntent)
                    }
                } catch (_: Exception) {
                    // Session ended or another VPN took over — give up gracefully.
                    // vpn_permission_lost stays true so the UI can show the re-grant prompt.
                }
            }, 3_000L)
        }

        super.onRevoke()
    }

    override fun onDestroy() {
        val status = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PREF_STATUS, STATUS_STOPPED)
        // Preserve a useful startup failure while the service shuts itself
        // down. Normal running/starting teardown is recorded as stopped.
        stopVpn(updateStatus = status == STATUS_RUNNING || status == STATUS_STARTING)
        super.onDestroy()
    }

    // ─── VPN establishment ────────────────────────────────────────────────────

    /**
     * Establishes a null-routing VPN tunnel.
     *
     * In PER_APP mode: only [packagesJson] apps have their traffic routed into
     * the tunnel. All other apps use the device's normal network connections.
     *
     * In GLOBAL mode: all apps go through the tunnel except [ALWAYS_EXCLUDED]
     * (emergency apps) and FocusFlow itself.
     */
    private fun startVpn(packagesJson: String, mode: String, requestedGeneration: Long = 0L) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val currentGeneration = currentPolicyGeneration(prefs)
        if (requestedGeneration > 0L && requestedGeneration < currentGeneration) {
            // A delayed recovery or reordered service command must not apply a
            // policy older than the latest persisted desired state.
            return
        }
        val effectiveJson = if (mode == MODE_GLOBAL) packagesJson
            else effectivePackagesJson(this, prefs)
        if (mode != MODE_GLOBAL && parseJsonArray(effectiveJson).isEmpty()) {
            stopVpn(updateStatus = true)
            writeStatus(STATUS_STOPPED)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }
        if (vpnInterface != null &&
            activePackagesJson == effectiveJson &&
            activeMode == mode
        ) return   // already established with the same package set
        if (vpnInterface != null) {
            // A changed package list must rebuild the TUN configuration; an
            // existing VpnService.Builder cannot be amended in place.
            stopVpn(updateStatus = false)
        }

        writeStatus(STATUS_STARTING)
        try {
            // Close the race between the JS preflight and service startup.
            if (VpnService.prepare(this) != null) {
                stopVpn(updateStatus = false)
                writeStatus(STATUS_PERMISSION_MISSING, "VPN permission is not granted")
                sp.edit().putBoolean("vpn_permission_lost", true).apply()
                VpnRecoveryNotifier.postPermissionRequired(this)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }

            val builder = Builder()
                .setSession("FocusFlow Network Block")
                .addAddress("10.0.0.1", 32)          // IPv4 virtual address
                .addAddress("fd00::1", 128)           // IPv6 virtual address
                .setMtu(1500)
                .setBlocking(false)                  // non-blocking I/O on TUN fd

            when (mode) {
                MODE_GLOBAL -> {
                    // Route ALL traffic through VPN
                    builder.addRoute("0.0.0.0", 0)   // all IPv4
                    builder.addRoute("::", 0)         // all IPv6
                    // Exclude emergency and system packages from the VPN
                    ALWAYS_EXCLUDED.forEach { pkg ->
                        runCatching { builder.addDisallowedApplication(pkg) }
                    }
                    // Exclude FocusFlow itself so our own activity/service stays online
                    runCatching { builder.addDisallowedApplication(packageName) }
                }
                else -> {
                    // PER_APP: route ONLY the blocked app(s) through the VPN
                    // addAllowedApplication() means: ONLY those packages go through the VPN;
                    // all others bypass it completely.
                    val packages = parseJsonArray(effectiveJson)
                    if (packages.isEmpty()) {
                        // No packages specified — abort rather than silently becoming a
                        // global block. Caller must provide at least one package for per-app mode.
                        stopVpn(updateStatus = false)
                        writeStatus(STATUS_STARTUP_FAILED, "Per-app VPN requires at least one package")
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                        return
                    }
                    builder.addRoute("0.0.0.0", 0)
                    builder.addRoute("::", 0)
                    val failedPackages = packages.filter { pkg ->
                        try {
                            builder.addAllowedApplication(pkg)
                            false
                        } catch (e: Exception) {
                            Log.e("FocusFlowVPN", "Unable to register package $pkg", e)
                            true
                        }
                    }
                    if (failedPackages.isNotEmpty()) {
                        writeStatus(
                            STATUS_PACKAGE_FAILURE,
                            "Some selected apps could not be registered with the VPN",
                            failedPackages,
                        )
                    }
                    if (failedPackages.size == packages.size) {
                        stopVpn(updateStatus = false)
                        writeStatus(
                            STATUS_PACKAGE_FAILURE,
                            "No selected apps could be registered with the VPN",
                            failedPackages,
                        )
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                        return
                    }
                }
            }

            vpnInterface = builder.establish()
            isRunning = vpnInterface != null

            if (isRunning) {
                activePackagesJson = effectiveJson
                activeMode = mode
                // Persist mode and packages so we can restore after an OS restart.
                // Also clear the permission-lost flag — the tunnel is up again.
                sp.edit()
                    .putString("net_block_packages",  effectiveJson)
                    .putString("net_block_mode",       mode)
                    .putLong(PREF_APPLIED_GENERATION, currentGeneration)
                    .putBoolean("vpn_permission_lost", false)
                    .apply()
                VpnRecoveryNotifier.clear(this)
                if (sp.getString(PREF_STATUS, null) != STATUS_PACKAGE_FAILURE) {
                    writeStatus(STATUS_RUNNING)
                }
                // Schedule the AlarmManager watchdog so the VPN is restarted even if
                // Android kills the entire process (battery optimisers, memory pressure).
                VpnWatchdogReceiver.schedule(applicationContext)
            } else {
                // builder.establish() returned null — this usually means VPN permission
                // was revoked between the prepare() check and the actual establish() call
                // (race with the user dismissing the system prompt, another VPN starting, etc.)
                sp.edit().putBoolean("vpn_permission_lost", true).apply()
                VpnRecoveryNotifier.postPermissionRequired(this)
                stopVpn(updateStatus = false)
                writeStatus(STATUS_STARTUP_FAILED, "Android did not establish the VPN interface")
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }

            // Do NOT start a read loop on the TUN fd — packets that enter the tunnel
            // are never forwarded, so the OS considers them lost. This is the intended
            // behaviour: all routed traffic is silently dropped.

        } catch (e: Exception) {
            isRunning = false
            stopVpn(updateStatus = false)
            writeStatus(STATUS_STARTUP_FAILED, e.message ?: "VPN service failed to start")
            Log.e("FocusFlowVPN", "VPN startup failed", e)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun stopVpn(updateStatus: Boolean = true) {
        isRunning = false
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface = null
        activePackagesJson = null
        activeMode = null
        // Cancel the AlarmManager watchdog — session is intentionally ending
        VpnWatchdogReceiver.cancel(applicationContext)
        if (updateStatus) writeStatus(STATUS_STOPPED)
    }

    private fun isStalePolicyCommand(intent: Intent?): Boolean {
        val requestedGeneration = intent?.getLongExtra(EXTRA_POLICY_GENERATION, 0L) ?: 0L
        return requestedGeneration > 0L &&
            requestedGeneration < currentPolicyGeneration(
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE),
            )
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "FocusFlow Network Block",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Active while FocusFlow is blocking app network access"
                setShowBadge(false)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPending = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Network blocked")
            .setContentText("FocusFlow is blocking internet access")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tapPending)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    // ─── JSON helper ──────────────────────────────────────────────────────────

    private fun parseJsonArray(json: String): List<String> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) { emptyList() }
    }
}
