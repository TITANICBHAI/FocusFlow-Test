package com.tbtechs.focusflow.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap

/**
 * AversionsModule
 *
 * React Native bridge for the three aversive deterrent layers and the weekly
 * Temptation Report toggle.  The JS settings screen reads/writes these flags
 * so the user can enable exactly the deterrents they want.
 *
 * JS name: NativeModules.Aversions
 *
 * SharedPrefs keys (file "focusday_prefs"):
 *   aversion_dimmer_enabled   Boolean  — screen dim overlay when blocked app opens
 *   aversion_vibrate_enabled  Boolean  — vibration pulse harassment
 *   aversion_sound_enabled    Boolean  — alert sound on blocked app launch
 *   aversion_weekly_report    Boolean  — weekly temptation report notification
 */
class AversionsModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    private val prefsName = "focusday_prefs"

    override fun getName(): String = "Aversions"

    // ─── Read ─────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getSettings(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            val map = WritableNativeMap().apply {
                putBoolean("dimmerEnabled",      prefs.getBoolean("aversion_dimmer_enabled",  false))
                putBoolean("vibrateEnabled",     prefs.getBoolean("aversion_vibrate_enabled", false))
                putBoolean("soundEnabled",       prefs.getBoolean("aversion_sound_enabled",   false))
                putBoolean("weeklyReportEnabled",prefs.getBoolean("aversion_weekly_report",   false))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("AVERSIONS_ERROR", e.message)
        }
    }

    // ─── Write ────────────────────────────────────────────────────────────────

    @ReactMethod
    fun setSettings(settings: ReadableMap, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            val edit  = prefs.edit()

            if (settings.hasKey("dimmerEnabled"))
                edit.putBoolean("aversion_dimmer_enabled",  settings.getBoolean("dimmerEnabled"))
            if (settings.hasKey("vibrateEnabled"))
                edit.putBoolean("aversion_vibrate_enabled", settings.getBoolean("vibrateEnabled"))
            if (settings.hasKey("soundEnabled"))
                edit.putBoolean("aversion_sound_enabled",   settings.getBoolean("soundEnabled"))
            if (settings.hasKey("weeklyReportEnabled")) {
                val enabled = settings.getBoolean("weeklyReportEnabled")
                edit.putBoolean("aversion_weekly_report", enabled)
                edit.apply()
                // Schedule or cancel the AlarmManager alarm
                com.tbtechs.focusflow.services.TemptationLogManager
                    .scheduleWeeklyReport(reactContext, enabled)
                promise.resolve(null)
                return
            }

            edit.apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("AVERSIONS_ERROR", e.message)
        }
    }
}
