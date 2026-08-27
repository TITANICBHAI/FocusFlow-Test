package com.tbtechs.focusflow.services

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.tbtechs.focusflow.MainActivity
import com.tbtechs.focusflow.R

/**
 * Posts the one user-facing notification used when an active VPN block loses
 * Android consent. The VPN service and its watchdogs can run without a React
 * instance, so this must remain native.
 *
 * The notification is edge-triggered: repeated watchdog polls do not create a
 * new alert until the VPN has been successfully restored.
 */
object VpnRecoveryNotifier {
    private const val CHANNEL_ID = "focusflow_vpn_recovery"
    private const val NOTIFICATION_ID = 1003
    private const val PREFS_NAME = "focusday_prefs"
    private const val PREF_POSTED = "vpn_recovery_notification_posted"
    private const val EXTRA_RECOVERY = "focusflow_vpn_recovery"

    fun postPermissionRequired(context: Context) {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)) return
        val notificationManager =
            appContext.getSystemService(NotificationManager::class.java) ?: return

        // Android 13+ requires runtime notification consent. If it was denied,
        // the foreground AppState check remains the fallback user experience.
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            appContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
            !notificationManager.areNotificationsEnabled()
        ) {
            return
        }

        if (prefs.getBoolean(PREF_POSTED, false)) return

        createChannel(notificationManager)

        val tapIntent = Intent(appContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_RECOVERY, true)
        }
        val tapPendingIntent = PendingIntent.getActivity(
            appContext,
            NOTIFICATION_ID,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(appContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("VPN permission required")
            .setContentText("Tap to restore FocusFlow network blocking.")
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "FocusFlow is still blocking the selected app, but Android VPN consent was revoked. Tap to restore protection."
                )
            )
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .build()

        prefs.edit().putBoolean(PREF_POSTED, true).apply()
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    fun clear(context: Context) {
        val appContext = context.applicationContext
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(PREF_POSTED, false)
            .apply()
        appContext.getSystemService(NotificationManager::class.java)
            ?.cancel(NOTIFICATION_ID)
    }

    private fun createChannel(notificationManager: NotificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) return

        notificationManager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "VPN recovery",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Alerts when FocusFlow loses VPN permission during blocking"
                setShowBadge(true)
            }
        )
    }

}