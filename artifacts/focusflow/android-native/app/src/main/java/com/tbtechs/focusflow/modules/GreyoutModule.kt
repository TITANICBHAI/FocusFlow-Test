package com.tbtechs.focusflow.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tbtechs.focusflow.services.TemptationLogManager

/**
 * GreyoutModule
 *
 * React Native bridge for two features:
 *
 *  1. Scheduled Greyout Windows — time-based app blocks independent of any
 *     focus session.  The user defines windows like "Instagram: blocked
 *     Mon–Fri 09:00–18:00".  Stored as a JSON array in SharedPreferences;
 *     the AccessibilityService reads this natively with zero JS involvement.
 *
 *  2. Temptation Log access — lets the settings screen display the log and
 *     offer a "Clear log" button.
 *
 * JS name: NativeModules.Greyout
 *
 * Greyout window JSON schema (array of objects):
 *   pkg        String  — package name, e.g. "com.instagram.android"
 *   startHour  Int     — 0–23
 *   startMin   Int     — 0–59
 *   endHour    Int     — 0–23
 *   endMin     Int     — 0–59
 *   days       Array   — Calendar.DAY_OF_WEEK values: 1=Sun, 2=Mon, … 7=Sat
 *
 * SharedPrefs key: greyout_schedule (String, JSON array)
 */
class GreyoutModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    private val prefsName = "focusday_prefs"

    override fun getName(): String = "Greyout"

    // ─── Greyout schedule ─────────────────────────────────────────────────────

    @ReactMethod
    fun getSchedule(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            promise.resolve(prefs.getString("greyout_schedule", "[]") ?: "[]")
        } catch (e: Exception) {
            promise.reject("GREYOUT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setSchedule(json: String, promise: Promise) {
        try {
            reactContext.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
                .edit().putString("greyout_schedule", json).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("GREYOUT_ERROR", e.message)
        }
    }

    // ─── Temptation log ───────────────────────────────────────────────────────

    @ReactMethod
    fun getTemptationLog(promise: Promise) {
        try {
            promise.resolve(TemptationLogManager.getLogJson(reactContext))
        } catch (e: Exception) {
            promise.reject("GREYOUT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearTemptationLog(promise: Promise) {
        try {
            TemptationLogManager.clearLog(reactContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("GREYOUT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getWeeklySummary(promise: Promise) {
        try {
            promise.resolve(TemptationLogManager.buildWeeklySummary(reactContext))
        } catch (e: Exception) {
            promise.reject("GREYOUT_ERROR", e.message)
        }
    }
}
