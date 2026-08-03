package com.tbtechs.focusflow.services

import android.content.Context
import android.os.PowerManager

/**
 * WakeLockManager
 *
 * Singleton that manages a single PARTIAL_WAKE_LOCK for the duration of a
 * focus session. Holding a partial wake lock ensures the CPU (and therefore
 * the AccessibilityService and ForegroundTaskService) keep running even when
 * the screen turns off — critical for accurate timer enforcement on OEM skins
 * that aggressively throttle background processes when the display sleeps.
 *
 * FULL_WAKE_LOCK (screen-on) is handled per-component:
 *   • ForegroundTaskService does NOT hold a screen-on lock — the notification
 *     handles its own display lifecycle.
 *   • BlockOverlayActivity uses FLAG_KEEP_SCREEN_ON directly so the lock is
 *     automatically released when the Activity is destroyed.
 *
 * Usage:
 *   WakeLockManager.acquire(context)   — called by ForegroundTaskService on start
 *   WakeLockManager.release()          — called by ForegroundTaskService on idle/stop
 */
object WakeLockManager {

    private const val TAG = "FocusFlow::WakeLock"

    @Volatile
    private var wakeLock: PowerManager.WakeLock? = null

    /**
     * Acquires a PARTIAL_WAKE_LOCK if one is not already held.
     * Safe to call multiple times — only one lock is ever held at a time.
     */
    fun acquire(context: Context) {
        synchronized(this) {
            if (wakeLock?.isHeld == true) return
            val pm = context.applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG).apply {
                setReferenceCounted(false)
                acquire(6 * 60 * 60 * 1_000L)   // cap at 6 hours — safety ceiling
            }
        }
    }

    /**
     * Releases the wake lock if it is currently held.
     * Safe to call even if no lock is held.
     */
    fun release() {
        synchronized(this) {
            try {
                if (wakeLock?.isHeld == true) wakeLock?.release()
            } catch (_: Exception) { /* already released */ }
            wakeLock = null
        }
    }

    /** Returns true if a wake lock is currently held. */
    val isHeld: Boolean get() = wakeLock?.isHeld == true
}
