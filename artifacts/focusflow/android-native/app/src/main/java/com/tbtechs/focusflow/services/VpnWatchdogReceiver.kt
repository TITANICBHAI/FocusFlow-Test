package com.tbtechs.focusflow.services

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.SystemClock

/**
 * VpnWatchdogReceiver
 *
 * A system-level watchdog for the VPN network blocker.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * NetworkBlockerVpnService returns START_STICKY so Android should restart it
 * after a kill. In practice, aggressive OEM battery optimisers (Samsung One UI,
 * MIUI, ColorOS, Realme UI) suppress or indefinitely delay that restart — the
 * service simply never comes back until the user opens the app.
 *
 * AlarmManager alarms are stored in the *system_server* process, which is never
 * killed. When this receiver fires, Android spawns a fresh app process to
 * deliver the broadcast — giving us a reliable wakeup window to restart the VPN
 * regardless of what killed the original process.
 *
 * ── Activation lifecycle ─────────────────────────────────────────────────────
 *
 *   schedule()  — called by NetworkBlockerVpnService.startVpn() whenever the
 *                 tunnel is established. Uses setInexactRepeating() (no special
 *                 permission needed, battery-friendly) at a 60-second interval.
 *
 *   cancel()    — called by NetworkBlockerVpnService.stopVpn() when the session
 *                 ends intentionally, so the alarm does not keep firing.
 *
 * ── Safety guards ────────────────────────────────────────────────────────────
 *
 *   • net_block_self_heal must be true   (user opted in to auto-restart)
 *   • net_block_enabled must be true     (VPN blocking is on)
 *   • net_block_vpn must be true         (VPN mechanism is selected)
 *   • A focus/standalone session or persistent VPN configuration must remain active
 *   • VPN permission must still be held  (VpnService.prepare() == null)
 *
 * If no active policy is found the alarm cancels itself to avoid firing forever.
 */
class VpnWatchdogReceiver : BroadcastReceiver() {

    companion object {
        private const val PREFS_NAME      = "focusday_prefs"
        private const val ACTION_WATCHDOG = "com.tbtechs.focusflow.VPN_WATCHDOG"
        private const val REQUEST_CODE    = 8801

        /**
         * Watchdog poll interval (inexact — Android may batch within ~7 % of this).
         * 60 seconds is a good balance: fast enough to recover before the user
         * notices, cheap enough not to upset battery benchmarks.
         */
        private const val INTERVAL_MS = 60_000L

        /**
         * Schedule (or reschedule) the repeating watchdog alarm.
         * Safe to call multiple times — FLAG_UPDATE_CURRENT replaces any existing alarm.
         */
        fun schedule(context: Context) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val pi = buildIntent(context) ?: return
            am.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + INTERVAL_MS,
                INTERVAL_MS,
                pi,
            )
        }

        /**
         * Cancel the watchdog alarm.
         * Call this when the VPN is intentionally stopped so the alarm does not
         * keep firing pointlessly after a session ends.
         */
        fun cancel(context: Context) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val pi = buildIntent(context) ?: return
            am.cancel(pi)
            pi.cancel()
        }

        private fun buildIntent(context: Context): PendingIntent? = try {
            val i = Intent(context, VpnWatchdogReceiver::class.java).apply {
                action = ACTION_WATCHDOG
            }
            PendingIntent.getBroadcast(
                context, REQUEST_CODE, i,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        } catch (_: Exception) { null }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_WATCHDOG) return

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // ── Gate checks — bail early if we should not be restarting ────────────

        if (!prefs.getBoolean("net_block_enabled", false) ||
            !prefs.getBoolean("net_block_vpn", true) ||
            !prefs.getBoolean("net_block_self_heal", false)
        ) {
            // A user turning off the gate must not leave the old repeating
            // alarm behind until its next delivery.
            cancel(context)
            return
        }

        // ── Session validity ────────────────────────────────────────────────────

        val now = System.currentTimeMillis()

        val focusActive = prefs.getBoolean("focus_active", false).let { on ->
            if (!on) false
            else {
                val endMs = prefs.getLong("task_end_ms", 0L)
                endMs <= 0L || now < endMs
            }
        }
        val saActive = prefs.getBoolean("standalone_block_active", false).let { on ->
            if (!on) false
            else {
                val untilMs = prefs.getLong("standalone_block_until_ms", 0L)
                untilMs <= 0L || now < untilMs
            }
        }
        if (!focusActive && !saActive &&
            !NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)
        ) {
            // Session has ended — cancel the alarm so it stops firing
            cancel(context)
            return
        }

        // ── Already running — nothing to do ────────────────────────────────────

        if (NetworkBlockerVpnService.isRunning) return

        // ── VPN permission check — cannot restart silently without it ───────────
        // Write the permission-lost flag so the JS layer can surface a re-grant prompt
        // the next time the user opens the app.

        try {
            if (VpnService.prepare(context) != null) {
                val anotherVpn = NetworkBlockerVpnService.isAnotherVpnActive(context)
                prefs.edit()
                    .putBoolean("vpn_permission_lost", !anotherVpn)
                    .putString(
                        "vpn_status",
                        if (anotherVpn) NetworkBlockerVpnService.STATUS_ANOTHER_VPN
                        else NetworkBlockerVpnService.STATUS_PERMISSION_MISSING,
                    )
                    .putString(
                        "vpn_error",
                        if (anotherVpn) "Another VPN is currently active"
                        else "VPN permission is not granted",
                    )
                    .apply()
                if (anotherVpn) {
                    // A competing VPN owns the single system VPN slot. Stop
                    // polling until the user deliberately retries after
                    // releasing that VPN.
                    cancel(context)
                } else {
                    VpnRecoveryNotifier.postPermissionRequired(context)
                }
                return
            }
        } catch (_: Exception) { return }

        // ── Restart the VPN tunnel ──────────────────────────────────────────────

        val pkgs   = NetworkBlockerVpnService.effectivePackagesJson(context, prefs)
        val global = prefs.getBoolean("net_block_global", false)
        if (!global && pkgs == "[]") {
            cancel(context)
            return
        }

        try {
            // Recovery must use the coordinator's durable-source calculation
            // and serialized, generation-bearing dispatch.
            VpnPolicyCoordinator.requestRecoverySync(context)
        } catch (e: Exception) {
            prefs.edit()
                .putString("vpn_status", NetworkBlockerVpnService.STATUS_STARTUP_FAILED)
                .putString("vpn_error", e.message ?: "Watchdog could not start VPN service")
                .apply()
        }
    }
}
