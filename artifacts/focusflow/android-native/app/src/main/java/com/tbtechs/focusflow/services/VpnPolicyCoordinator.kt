package com.tbtechs.focusflow.services

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native owner for the persisted VPN policy and its effective target set.
 *
 * The coordinator deliberately keeps foreground Accessibility policy separate
 * from network policy. Its current sources are explicit VPN selections,
 * active standalone VPN packages, and opt-in focus mirroring. Recurring
 * schedules and allowance mirroring remain separate product slices.
 *
 * The desired policy is persisted before an asynchronous service command is
 * dispatched. Recovery paths can therefore recalculate from durable sources
 * even when the React process is not running.
 */
object VpnPolicyCoordinator {
    private const val PREFS_NAME = "focusday_prefs"
    private const val PREF_EXPLICIT_PKGS = "net_block_explicit_packages"
    private const val PREF_FOCUS_MIRROR = "net_block_focus_mirror"
    private const val PREF_STANDALONE_PKGS = "standalone_blocked_packages"
    private const val PREF_DESIRED_POLICY = "net_block_desired_policy"
    private const val PREF_POLICY_GENERATION = "net_block_policy_generation"
    private const val PREF_FAILED_PKGS = "vpn_failed_packages"
    private const val POLICY_VERSION = 1
    private const val DISPATCH_DEBOUNCE_MS = 150L

    private val syncLock = Any()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pendingDispatch: Runnable? = null

    /**
     * These packages must remain reachable for emergency calls, messaging, and
     * core Android operation. FocusFlow itself is also excluded at dispatch.
     */
    val ALWAYS_EXCLUDED = listOf(
        "android",
        "com.android.phone",
        "com.android.dialer",
        "com.google.android.dialer",
        "com.samsung.android.app.telephonyui",
        "com.android.server.telecom",
        "com.android.mms",
        "com.android.messaging",
        "com.google.android.apps.messaging",
    )

    private data class EffectivePolicy(
        val targets: List<String>,
        val explicit: List<String>,
        val standalone: List<String>,
        val focus: List<String>,
        val invalid: List<String>,
    )

    /**
     * Returns whether a durable VPN policy still requires protection without
     * depending on a live focus or standalone overlay session.
     */
    fun hasPersistentVpnConfiguration(prefs: SharedPreferences): Boolean {
        if (!prefs.getBoolean("net_block_enabled", false) ||
            !prefs.getBoolean("net_block_vpn", true)
        ) return false

        if (prefs.getBoolean("net_block_global", false)) return true
        if (prefs.getBoolean(PREF_FOCUS_MIRROR, false) &&
            isFocusBlockActive(prefs)
        ) return true
        if (isStandaloneBlockActive(prefs) &&
            parsePackageJson(prefs.getString(PREF_STANDALONE_PKGS, "[]") ?: "[]").isNotEmpty()
        ) return true

        return parsePackageJson(
            prefs.getString(PREF_EXPLICIT_PKGS, null)
                ?: prefs.getString("net_block_packages", "[]")
                ?: "[]",
        ).isNotEmpty()
    }

    fun effectivePackages(context: Context, prefs: SharedPreferences): List<String> =
        effectivePolicy(context, prefs).targets

    fun effectivePackagesJson(context: Context, prefs: SharedPreferences): String =
        JSONArray(effectivePolicy(context, prefs).targets).toString()

    fun currentPolicyGeneration(prefs: SharedPreferences): Long =
        prefs.getLong(PREF_POLICY_GENERATION, 0L)

    /**
     * Recalculates, persists, and dispatches the latest desired VPN policy.
     *
     * The lock serializes native writers. The generation on every command
     * prevents a delayed stop/start from applying an older policy.
     */
    fun requestSync(context: Context) {
        synchronized(syncLock) {
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

            // This compatibility snapshot is intentionally kept in sync with
            // the desired policy, but recovery recalculates instead of trusting
            // it as authoritative input.
            prefs.edit()
                .putString("net_block_packages", packagesJson)
                .putString(PREF_FAILED_PKGS, JSONArray(policy.invalid).toString())
                .putString(
                    "net_block_mode",
                    if (global) NetworkBlockerVpnService.MODE_GLOBAL
                    else NetworkBlockerVpnService.MODE_PER_APP,
                )
                .apply()

            scheduleDispatch(context.applicationContext)
        }
    }

    /**
     * Coalesces rapid source changes such as focus start ordering, allow-list
     * writes, and package-install broadcasts. Every call persists immediately;
     * only the native service command is delayed and replaced by the latest one.
     */
    private fun scheduleDispatch(context: Context) {
        pendingDispatch?.let(mainHandler::removeCallbacks)
        val next = Runnable {
            synchronized(syncLock) {
                pendingDispatch = null
                dispatchLatest(context)
            }
        }
        pendingDispatch = next
        mainHandler.postDelayed(next, DISPATCH_DEBOUNCE_MS)
    }

    private fun dispatchLatest(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("net_block_enabled", false)
        val vpnEnabled = prefs.getBoolean("net_block_vpn", true)
        val global = prefs.getBoolean("net_block_global", false)
        val packagesJson = effectivePackagesJson(context, prefs)
        val generation = currentPolicyGeneration(prefs)

        if (!enabled || !vpnEnabled || (!global && parsePackageJson(packagesJson).isEmpty())) {
            dispatch(
                context,
                action = NetworkBlockerVpnService.ACTION_STOP,
                generation = generation,
            )
            return
        }

        dispatch(
            context,
            action = NetworkBlockerVpnService.ACTION_START,
            packagesJson = packagesJson,
            mode = if (global) NetworkBlockerVpnService.MODE_GLOBAL
            else NetworkBlockerVpnService.MODE_PER_APP,
            generation = generation,
        )
    }

    private fun dispatch(
        context: Context,
        action: String,
        packagesJson: String = "[]",
        mode: String = NetworkBlockerVpnService.MODE_PER_APP,
        generation: Long,
    ) {
        val intent = Intent(context, NetworkBlockerVpnService::class.java).apply {
            this.action = action
            putExtra(NetworkBlockerVpnService.EXTRA_POLICY_GENERATION, generation)
            if (action == NetworkBlockerVpnService.ACTION_START) {
                putExtra(NetworkBlockerVpnService.EXTRA_PACKAGES, packagesJson)
                putExtra(NetworkBlockerVpnService.EXTRA_MODE, mode)
            }
        }
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Exception) {
            // The service records startup failures when Android accepts the
            // command but cannot establish the tunnel. A background dispatch
            // failure must not crash the caller or React process.
        }
    }

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

        val focusTargets = if (
            prefs.getBoolean(PREF_FOCUS_MIRROR, false) &&
            isFocusBlockActive(prefs)
        ) {
            val allowed = parsePackageJson(
                prefs.getString("allowed_packages", "[]") ?: "[]",
            ).toSet()
            try {
                val launcherIntent = Intent(Intent.ACTION_MAIN)
                    .addCategory(Intent.CATEGORY_LAUNCHER)
                context.packageManager.queryIntentActivities(launcherIntent, 0)
                    .map { it.activityInfo.packageName }
                    .filterNot { isExcludedPackage(it, context.packageName) }
                    .filter { it !in allowed }
                    .distinct()
            } catch (_: Exception) {
                emptyList()
            }
        } else {
            emptyList()
        }

        val sourcePackages = (explicitCandidates + standaloneCandidates + focusTargets)
            .filterNot { isExcludedPackage(it, context.packageName) }
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

        val generation = currentPolicyGeneration(prefs) + 1L
        val record = JSONObject().apply {
            put("version", POLICY_VERSION)
            put("generation", generation)
            put("enabled", enabled)
            put("vpnEnabled", vpnEnabled)
            put("mode", if (global) NetworkBlockerVpnService.MODE_GLOBAL
                else NetworkBlockerVpnService.MODE_PER_APP)
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

    private fun isInstalled(context: Context, packageName: String): Boolean =
        try {
            context.packageManager.getApplicationInfo(packageName, 0)
            true
        } catch (_: Exception) {
            false
        }

    private fun isExcludedPackage(packageName: String, ownPackageName: String): Boolean =
        packageName.equals(ownPackageName, ignoreCase = true) ||
            ALWAYS_EXCLUDED.any { packageName.equals(it, ignoreCase = true) }

    private fun isStandaloneBlockActive(prefs: SharedPreferences): Boolean {
        if (!prefs.getBoolean("standalone_block_active", false)) return false
        val untilMs = prefs.getLong("standalone_block_until_ms", 0L)
        return untilMs <= 0L || untilMs > System.currentTimeMillis()
    }

    private fun isFocusBlockActive(prefs: SharedPreferences): Boolean {
        if (!prefs.getBoolean("focus_active", false)) return false
        val endMs = prefs.getLong("task_end_ms", 0L)
        return endMs <= 0L || endMs > System.currentTimeMillis()
    }

    private fun parsePackageJson(json: String): List<String> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length())
                .map { arr.optString(it).trim() }
                .filter { it.isNotBlank() }
        } catch (_: Exception) {
            emptyList()
        }
    }
}