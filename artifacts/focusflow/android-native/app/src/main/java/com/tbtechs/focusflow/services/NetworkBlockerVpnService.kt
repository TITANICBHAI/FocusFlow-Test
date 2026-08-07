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
 *   PREF_NET_BLOCK_MODE      "per_app" | "global"
 *   PREF_NET_BLOCK_PACKAGES  JSON array — packages to block (used in per_app mode)
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

        const val MODE_PER_APP = "per_app"
        const val MODE_GLOBAL  = "global"

        private const val CHANNEL_ID      = "focusday_vpn"
        private const val NOTIFICATION_ID = 1002
        private const val PREFS_NAME      = AppBlockerAccessibilityService.PREFS_NAME

        /** Separate high-importance channel for the VPN-revoked alert. */
        private const val ALERT_CHANNEL_ID     = "focusday_vpn_alert"
        private const val VPN_REVOKED_NOTIF_ID = 1003

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
    }

    private var vpnInterface: ParcelFileDescriptor? = null

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopVpn()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                val packagesJson = intent.getStringExtra(EXTRA_PACKAGES) ?: "[]"
                val mode         = intent.getStringExtra(EXTRA_MODE) ?: MODE_PER_APP
                startVpn(packagesJson, mode)
            }
            else -> {
                // Restarted by OS — restore from prefs
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val focusActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false)
                val saActive    = prefs.getBoolean(AppBlockerAccessibilityService.PREF_SA_ACTIVE, false)
                val pkgs        = prefs.getString(AppBlockerAccessibilityService.PREF_NET_BLOCK_PACKAGES, "[]") ?: "[]"
                // Also restore when always-on VPN packages are configured. net_block_packages
                // is persisted by startVpn() on every successful tunnel start, so it survives
                // process kills and device reboots and reflects the last active package list.
                val hasAlwaysOnPkgs = try { JSONArray(pkgs).length() > 0 } catch (_: Exception) { false }
                if (focusActive || saActive || hasAlwaysOnPkgs) {
                    val mode = prefs.getString(AppBlockerAccessibilityService.PREF_NET_BLOCK_MODE, MODE_PER_APP) ?: MODE_PER_APP
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
        val selfHeal  = prefs.getBoolean(AppBlockerAccessibilityService.PREF_NET_BLOCK_SELF_HEAL, false)

        val now = System.currentTimeMillis()
        val focusOn = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false).let { on ->
            if (!on) false
            else {
                val endMs = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L)
                endMs <= 0L || now < endMs
            }
        }
        val saOn = prefs.getBoolean(AppBlockerAccessibilityService.PREF_SA_ACTIVE, false).let { on ->
            if (!on) false
            else {
                val untilMs = prefs.getLong(AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L)
                untilMs <= 0L || now < untilMs
            }
        }

        stopVpn()   // close the TUN fd first

        // Determine whether always-on packages are configured. Computed here so both
        // the permission-lost flag and the self-heal block can use the same value.
        val revokePkgs      = prefs.getString(AppBlockerAccessibilityService.PREF_NET_BLOCK_PACKAGES, "[]") ?: "[]"
        val hasAlwaysOnPkgs = try { JSONArray(revokePkgs).length() > 0 } catch (_: Exception) { false }

        // Signal to the JS layer that VPN permission was lost so the in-app banner
        // can prompt a re-grant. Also fire a system notification so the user is
        // alerted even when the app is backgrounded or the screen is off.
        // The flag is cleared by startVpn() on a successful subsequent restart.
        if (focusOn || saOn || hasAlwaysOnPkgs) {
            prefs.edit().putBoolean(AppBlockerAccessibilityService.PREF_VPN_PERMISSION_LOST, true).apply()
            postVpnRevokedNotification()
        }

        if (selfHeal && (focusOn || saOn || hasAlwaysOnPkgs)) {
            val ctx  = applicationContext
            val pkgs = revokePkgs
            val mode = prefs.getString(AppBlockerAccessibilityService.PREF_NET_BLOCK_MODE, MODE_PER_APP) ?: MODE_PER_APP
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    val restartIntent = Intent(ctx, NetworkBlockerVpnService::class.java).apply {
                        action = ACTION_START
                        putExtra(EXTRA_PACKAGES, pkgs)
                        putExtra(EXTRA_MODE,     mode)
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
        stopVpn()
        super.onDestroy()
    }

    // ─── VPN establishment ─────────────────────────────────────────────────────

    /**
     * Establishes a null-routing VPN tunnel.
     *
     * In PER_APP mode: only [packagesJson] apps have their traffic routed into
     * the tunnel. All other apps use the device's normal network connections.
     *
     * In GLOBAL mode: all apps go through the tunnel except [ALWAYS_EXCLUDED]
     * (emergency apps) and FocusFlow itself.
     */
    private fun startVpn(packagesJson: String, mode: String) {
        if (vpnInterface != null) return   // already established

        try {
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
                    val packages = parseJsonArray(packagesJson)
                    if (packages.isEmpty()) {
                        // No packages specified — abort rather than silently becoming a
                        // global block. Caller must provide at least one package for per-app mode.
                        isRunning = false
                        stopSelf()
                        return
                    }
                    builder.addRoute("0.0.0.0", 0)
                    builder.addRoute("::", 0)
                    packages.forEach { pkg ->
                        runCatching { builder.addAllowedApplication(pkg) }
                    }
                }
            }

            vpnInterface = builder.establish()
            isRunning = vpnInterface != null

            val sp = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (isRunning) {
                // Persist mode and packages so we can restore after an OS restart.
                // Also clear the permission-lost flag — the tunnel is up again.
                sp.edit()
                    .putString(AppBlockerAccessibilityService.PREF_NET_BLOCK_PACKAGES,  packagesJson)
                    .putString(AppBlockerAccessibilityService.PREF_NET_BLOCK_MODE,       mode)
                    .putBoolean(AppBlockerAccessibilityService.PREF_VPN_PERMISSION_LOST, false)
                    .apply()
                // Schedule the AlarmManager watchdog so the VPN is restarted even if
                // Android kills the entire process (battery optimisers, memory pressure).
                VpnWatchdogReceiver.schedule(applicationContext)
            } else {
                // builder.establish() returned null — this usually means VPN permission
                // was revoked between the prepare() check and the actual establish() call
                // (race with the user dismissing the system prompt, another VPN starting, etc.)
                sp.edit()
                    .putBoolean(AppBlockerAccessibilityService.PREF_VPN_PERMISSION_LOST, true)
                    .apply()
                stopSelf()
            }

            // Do NOT start a read loop on the TUN fd — packets that enter the tunnel
            // are never forwarded, so the OS considers them lost. This is the intended
            // behaviour: all routed traffic is silently dropped.

        } catch (e: Exception) {
            isRunning = false
            stopSelf()
        }
    }

    private fun stopVpn() {
        isRunning = false
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface = null
        // Cancel the AlarmManager watchdog — session is intentionally ending
        VpnWatchdogReceiver.cancel(applicationContext)
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    /**
     * Posts a high-priority heads-up notification when Android revokes the VPN
     * permission. This fires even when the app is fully backgrounded or the screen
     * is off, ensuring the user knows network blocking has stopped.
     * Tapping the notification opens MainActivity where [VpnPermissionLostBanner]
     * guides them through the re-grant flow.
     * The notification is auto-cancelled on tap and dismissed automatically if the
     * VPN restarts successfully (startVpn clears the vpn_permission_lost flag and
     * the banner disappears; the stale notification is harmless but unobtrusive).
     */
    private fun postVpnRevokedNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(ALERT_CHANNEL_ID) == null) {
                val ch = NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "VPN Protection Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alerts when Android revokes FocusFlow's VPN permission"
                    enableVibration(true)
                }
                nm.createNotificationChannel(ch)
            }
        }
        val tapPending = PendingIntent.getActivity(
            this,
            VPN_REVOKED_NOTIF_ID,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("VPN protection interrupted")
            .setContentText("Tap to re-grant VPN permission and resume network blocking.")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("Android revoked FocusFlow's VPN permission. Network blocking is paused. Tap to open the app and re-grant access.")
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(tapPending)
            .setAutoCancel(true)
            .build()
        nm.notify(VPN_REVOKED_NOTIF_ID, notification)
    }

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