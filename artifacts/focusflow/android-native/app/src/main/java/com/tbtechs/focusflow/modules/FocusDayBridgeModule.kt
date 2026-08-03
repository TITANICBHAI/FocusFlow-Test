package com.tbtechs.focusflow.modules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.tbtechs.focusflow.services.ForegroundTaskService
import com.tbtechs.focusflow.services.NotificationActionReceiver

/**
 * FocusDayBridgeModule
 *
 * JS name: NativeModules.FocusDayBridge  (also used as an event emitter)
 *
 * This module:
 *  1. Forwards "FocusDayEvent" events from Android (broadcasts, service callbacks)
 *     to the React Native JS event bus.
 *  2. Listens for the TASK_ENDED broadcast fired by ForegroundTaskService and
 *     fires a "FocusDayEvent" of type "TASK_ENDED" to JS.
 *  3. Listens for the APP_BLOCKED broadcast fired by AppBlockerAccessibilityService
 *     and fires a "FocusDayEvent" of type "APP_BLOCKED" with the blocked package.
 *
 * JS usage:
 *   import { NativeEventEmitter, NativeModules } from 'react-native';
 *   const emitter = new NativeEventEmitter(NativeModules.FocusDayBridge);
 *   emitter.addListener('FocusDayEvent', (e) => console.log(e.type, e.payload));
 */
class FocusDayBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        const val NAME = "FocusDayBridge"
        const val JS_EVENT_NAME = "FocusDayEvent"
        const val ACTION_APP_BLOCKED  = "com.tbtechs.focusflow.APP_BLOCKED"
        const val EXTRA_BLOCKED_PKG   = "blockedPackage"
        const val ACTION_NOTIF_ACTION = "com.tbtechs.focusflow.NOTIF_ACTION"
        const val EXTRA_NOTIF_ACTION_TYPE = "notifActionType"
    }

    private var listenerCount = 0

    private val taskEndedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            sendEvent("TASK_ENDED", null)
        }
    }

    private val appBlockedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val pkg = intent.getStringExtra(EXTRA_BLOCKED_PKG) ?: return
            sendEvent("APP_BLOCKED", pkg)
        }
    }

    private val notifActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val actionType = intent.getStringExtra(EXTRA_NOTIF_ACTION_TYPE) ?: return
            val taskId     = intent.getStringExtra(NotificationActionReceiver.EXTRA_TASK_ID) ?: return
            val minutes    = intent.getIntExtra(NotificationActionReceiver.EXTRA_MINUTES, 15)

            val notifAction = when (actionType) {
                NotificationActionReceiver.ACTION_COMPLETE -> "COMPLETE"
                NotificationActionReceiver.ACTION_EXTEND   -> "EXTEND"
                NotificationActionReceiver.ACTION_SKIP     -> "SKIP"
                else -> return
            }

            if (!reactContext.hasActiveReactInstance()) return
            val params = Arguments.createMap().apply {
                putString("type",        "NOTIF_ACTION")
                putString("notifAction", notifAction)
                putString("taskId",      taskId)
                putInt("minutes",        minutes)
                putNull("blockedApp")
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(JS_EVENT_NAME, params)
        }
    }

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        reactContext.addLifecycleEventListener(this)
        registerReceivers()
    }

    override fun invalidate() {
        reactContext.removeLifecycleEventListener(this)
        try {
            reactContext.unregisterReceiver(taskEndedReceiver)
            reactContext.unregisterReceiver(appBlockedReceiver)
            reactContext.unregisterReceiver(notifActionReceiver)
        } catch (_: Exception) {}
        super.invalidate()
    }

    // ─── Listener count tracking (required for NativeEventEmitter on Android) ──

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = maxOf(0, listenerCount - count)
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    /**
     * On every resume, replay any pending notification action that was stored in
     * SharedPrefs by NotificationActionReceiver when React was not alive at tap time.
     * The entry is cleared immediately to avoid replaying the same action twice.
     * Actions older than 5 minutes are discarded silently.
     */
    override fun onHostResume() {
        val prefs = reactContext.getSharedPreferences(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREFS_NAME,
            android.content.Context.MODE_PRIVATE
        )
        val pendingAction = prefs.getString(
            com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_ACTION, null
        ) ?: return
        val taskId = prefs.getString(
            com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_TASK_ID, null
        ) ?: run {
            prefs.edit()
                .remove(com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_ACTION)
                .apply()
            return
        }
        val actionTimestampMs = prefs.getLong(
            com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_TIME_MS, 0L
        )
        val minutes = prefs.getInt(
            com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_MINUTES, 15
        )

        prefs.edit()
            .remove(com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_ACTION)
            .remove(com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_TASK_ID)
            .remove(com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_MINUTES)
            .remove(com.tbtechs.focusflow.services.NotificationActionReceiver.PREF_PENDING_TIME_MS)
            .apply()

        if (System.currentTimeMillis() - actionTimestampMs > 5 * 60 * 1000L) return

        val notifAction = when (pendingAction) {
            com.tbtechs.focusflow.services.NotificationActionReceiver.ACTION_COMPLETE -> "COMPLETE"
            com.tbtechs.focusflow.services.NotificationActionReceiver.ACTION_EXTEND   -> "EXTEND"
            com.tbtechs.focusflow.services.NotificationActionReceiver.ACTION_SKIP     -> "SKIP"
            else -> return
        }

        if (!reactContext.hasActiveReactInstance()) return
        val params = Arguments.createMap().apply {
            putString("type",        "NOTIF_ACTION")
            putString("notifAction", notifAction)
            putString("taskId",      taskId)
            putInt("minutes",        minutes)
            putNull("blockedApp")
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(JS_EVENT_NAME, params)
    }

    override fun onHostPause() {}
    override fun onHostDestroy() {}

    // ─── Private ─────────────────────────────────────────────────────────────

    private fun registerReceivers() {
        val taskEndedFilter    = IntentFilter(ForegroundTaskService.ACTION_TASK_ENDED)
        val appBlockedFilter   = IntentFilter(ACTION_APP_BLOCKED)
        val notifActionFilter  = IntentFilter(ACTION_NOTIF_ACTION)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(taskEndedReceiver,   taskEndedFilter,   Context.RECEIVER_NOT_EXPORTED)
            reactContext.registerReceiver(appBlockedReceiver,  appBlockedFilter,  Context.RECEIVER_NOT_EXPORTED)
            reactContext.registerReceiver(notifActionReceiver, notifActionFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(taskEndedReceiver,   taskEndedFilter)
            reactContext.registerReceiver(appBlockedReceiver,  appBlockedFilter)
            reactContext.registerReceiver(notifActionReceiver, notifActionFilter)
        }
    }

    private fun sendEvent(type: String, payload: String?) {
        if (!reactContext.hasActiveReactInstance()) return
        val params = Arguments.createMap().apply {
            putString("type", type)
            if (payload != null) putString("blockedApp", payload) else putNull("blockedApp")
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(JS_EVENT_NAME, params)
    }
}
