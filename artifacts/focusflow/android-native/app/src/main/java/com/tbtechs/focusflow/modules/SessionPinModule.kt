package com.tbtechs.focusflow.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService
import java.security.MessageDigest

/**
 * SessionPinModule
 *
 * JS name: NativeModules.SessionPin
 *
 * Manages a session PIN that gates all "end session" operations at the native layer.
 * The PIN is stored as a SHA-256 hash — the raw PIN is never persisted.
 *
 * When a PIN is set (pin_hash is present in prefs), the following native methods
 * require a matching PIN hash before executing:
 *   - ForegroundServiceModule.stopService()
 *   - NetworkBlockModule.stopNetworkBlock()
 *   - SharedPrefsModule.setFocusActive(false, ...)
 *
 * Methods:
 *   - setPinHash(sha256hex)       → Promise<null>  — store a new PIN hash
 *   - clearPin(sha256hex)         → Promise<null>  — clear PIN (must supply current hash)
 *   - verifyPin(sha256hex)        → Promise<Boolean>
 *   - isPinSet()                  → Promise<Boolean>
 */
class SessionPinModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "SessionPin"
        const val PREF_PIN_HASH = "session_pin_hash"
    }

    override fun getName(): String = NAME

    private fun prefs() = reactContext.getSharedPreferences(
        AppBlockerAccessibilityService.PREFS_NAME, android.content.Context.MODE_PRIVATE
    )

    /**
     * Stores a new PIN as its SHA-256 hex digest.
     * Call with the hex digest of the user's chosen PIN, not the raw PIN.
     */
    @ReactMethod
    fun setPinHash(sha256hex: String, promise: Promise) {
        if (sha256hex.isBlank()) {
            promise.reject("INVALID_PIN", "PIN hash must not be empty")
            return
        }
        prefs().edit().putString(PREF_PIN_HASH, sha256hex.lowercase()).apply()
        promise.resolve(null)
    }

    /**
     * Clears the stored PIN. Requires the current PIN hash to be supplied so the
     * user must know the PIN before they can remove it — JS bridge compromise
     * alone is insufficient.
     */
    @ReactMethod
    fun clearPin(currentSha256hex: String, promise: Promise) {
        val stored = prefs().getString(PREF_PIN_HASH, null)
        if (stored == null) {
            promise.resolve(null)
            return
        }
        if (!stored.equals(currentSha256hex.lowercase(), ignoreCase = true)) {
            promise.reject("WRONG_PIN", "Incorrect PIN — cannot clear")
            return
        }
        prefs().edit().remove(PREF_PIN_HASH).apply()
        promise.resolve(null)
    }

    /**
     * Returns true if the supplied hash matches the stored PIN hash.
     */
    @ReactMethod
    fun verifyPin(sha256hex: String, promise: Promise) {
        val stored = prefs().getString(PREF_PIN_HASH, null)
        if (stored == null) {
            promise.resolve(true)
            return
        }
        promise.resolve(stored.equals(sha256hex.lowercase(), ignoreCase = true))
    }

    /**
     * Returns true if a PIN has been configured.
     */
    @ReactMethod
    fun isPinSet(promise: Promise) {
        val stored = prefs().getString(PREF_PIN_HASH, null)
        promise.resolve(!stored.isNullOrBlank())
    }
}
