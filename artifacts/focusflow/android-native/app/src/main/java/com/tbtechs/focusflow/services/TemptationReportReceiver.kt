package com.tbtechs.focusflow.services

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.tbtechs.focusflow.MainActivity
import com.tbtechs.focusflow.R

/**
 * TemptationReportReceiver
 *
 * BroadcastReceiver fired by the weekly AlarmManager alarm (every Sunday 08:00).
 * Reads the temptation log from SharedPreferences, builds a "Temptation Report"
 * summary notification, and posts it.
 *
 * Registered in AndroidManifest as an exported="false" receiver with a custom
 * action so only the system AlarmManager can trigger it.
 */
class TemptationReportReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        TemptationLogManager.ensureChannel(context)

        val summary = TemptationLogManager.buildWeeklySummary(context)

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPending = PendingIntent.getActivity(
            context, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, TemptationLogManager.CHANNEL_ID)
            .setContentTitle("📊 Your Weekly Temptation Report")
            .setContentText("See how many times you tried to open blocked apps")
            .setStyle(NotificationCompat.BigTextStyle().bigText(summary))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(tapPending)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(8800, notification)
    }
}
