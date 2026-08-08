package com.tbtechs.focusflow.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build

/**
 * BootReceiver
 *
 * Listens for BOOT_COMPLETED and QUICKBOOT_POWERON (some OEMs) broadcasts.
 *
 * Behaviour:
 *   1. If a focus session was active when the phone shut down → restart service in ACTIVE mode
 *      (restores countdown notification and app blocking).
 *   2. If no focus session was active → start service in IDLE mode so the persistent
 *      notification is always present and the process is kept alive by Android.
 *
 * SharedPreferences keys:
 *   PREF_FOCUS_ON            Boolean — true if a task focus was running at shutdown
 *   PREF_TASK_NAME           String  — last task name
 *   PREF_TASK_END_MS         Long    — last task end epoch ms
 *   PREF_NEXT_TASK_NAME      String? — next task name (may be null)
 *   PREF_SA_ACTIVE           Boolean — standalone (no-task) blocking active
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        // Handle all relevant boot/restart broadcasts:
        //   BOOT_COMPLETED          — normal boot (user-encrypted storage available)
        //   QUICKBOOT_POWERON       — some OEM fast-boot variants (Huawei, HTC)
        //   ACTION_MY_PACKAGE_REPLACED — app was updated; restart service with fresh binary
        //   ACTION_USER_UNLOCKED    — Android 7+ direct-boot: user unlocked device after boot
        //                            Required on devices with file-based encryption (most modern phones)
        //                            where BOOT_COMPLETED fires before user data is decrypted.
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != Intent.ACTION_USER_UNLOCKED) return

        val prefs: SharedPreferences = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )

        val focusActive   = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false)
        val endTimeMs     = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L)
        val startTimeMs   = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_START_MS, 0L)
        val durationMs    = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_DURATION_MS, 0L)
        val lastWrittenMs = prefs.getLong(AppBlockerAccessibilityService.PREF_TASK_LAST_WRITTEN_MS, 0L)

        val now = System.currentTimeMillis()

        // Primary clock-based check
        val primaryValid = endTimeMs > 0L && endTimeMs > now

        // Secondary duration-based check: guards against clock being advanced forward
        // before reboot to make the session appear expired.
        // If the wall clock was set forward by X ms, (now - lastWrittenMs) > durationMs
        // even though real elapsed time is < durationMs — mismatch reveals tampering.
        val secondaryValid = durationMs > 0L && lastWrittenMs > 0L &&
                             (now - lastWrittenMs) < durationMs + 60_000L

        val sessionValid = focusActive && (primaryValid || secondaryValid)

        if (sessionValid && endTimeMs > 0L) {
            // ── Restart in ACTIVE focus mode ──────────────────────────────────
            val taskId   = prefs.getString(AppBlockerAccessibilityService.PREF_TASK_ID, "") ?: ""
            val taskName = prefs.getString(AppBlockerAccessibilityService.PREF_TASK_NAME, "Focus Task") ?: "Focus Task"
            val nextName = prefs.getString(AppBlockerAccessibilityService.PREF_NEXT_TASK_NAME, null)

            val serviceIntent = Intent(context, ForegroundTaskService::class.java).apply {
                putExtra(ForegroundTaskService.EXTRA_TASK_ID,   taskId)
                putExtra(ForegroundTaskService.EXTRA_TASK_NAME, taskName)
                putExtra(ForegroundTaskService.EXTRA_END_MS, endTimeMs)
                nextName?.let { putExtra(ForegroundTaskService.EXTRA_NEXT_NAME, it) }
            }
            startService(context, serviceIntent)

            // Rearm the VPN watchdog alarm — it was cancelled when the process
            // was killed. If network blocking was active it will restart the VPN
            // within one watchdog interval without the user noticing.
            val netBlockEnabled = prefs.getBoolean(AppBlockerAccessibilityService.PREF_NET_BLOCK_ENABLED, false)
            val selfHeal        = prefs.getBoolean(AppBlockerAccessibilityService.PREF_NET_BLOCK_SELF_HEAL, false)
            if (netBlockEnabled && selfHeal) {
                VpnWatchdogReceiver.schedule(context)
            }
        } else {
            // ── Clear any stale focus flag, then start IDLE to keep process alive ──
            if (focusActive) {
                prefs.edit().putBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false).apply()
            }
            // Huawei AppGallery rule 2.19: only auto-start the idle foreground
            // service if the user has completed onboarding and explicitly
            // authorised background operation. The flag is written by the JS
            // onboarding screen on first-run completion via SharedPrefsModule.
            val consented = prefs.getString("user_consented_background_service", null) == "true"
            if (!consented) return
            val idleIntent = Intent(context, ForegroundTaskService::class.java).apply {
                this.action = ForegroundTaskService.ACTION_SET_IDLE
            }
            startService(context, idleIntent)
        }
    }

    private fun startService(context: Context, intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
}