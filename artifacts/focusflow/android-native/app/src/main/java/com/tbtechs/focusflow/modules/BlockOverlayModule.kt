package com.tbtechs.focusflow.modules

import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import org.json.JSONArray

/**
 * BlockOverlayModule
 *
 * JS name: NativeModules.BlockOverlay
 *
 * Exposes configuration for BlockOverlayActivity to the JavaScript layer.
 * All settings are persisted in SharedPreferences ("focusday_prefs") so they
 * are immediately available to the overlay when it launches from the
 * AccessibilityService without needing a JS bridge call at block time.
 *
 * Methods:
 *
 *   setOverlayQuote(quote)
 *     Pin a specific quote that always shows on the overlay. Pass an empty
 *     string to return to random mode.
 *
 *   setCustomQuotes(quotesJson)
 *     Replace the random quote pool with a custom JSON array of strings.
 *     Example: '["Stay strong.","You can do it."]'
 *     Pass an empty string or "[]" to restore the built-in default pool.
 *
 *   clearCustomQuote()
 *     Clears the pinned quote and returns to random selection.
 *
 *   setOverlayWallpaper(absolutePath)
 *     Set an absolute file path to a JPEG/PNG image used as the overlay
 *     background (rendered at 30% opacity behind the quote text).
 *     The file must already exist on device (e.g. copied from the app's
 *     media picker result to the app's internal files dir).
 *
 *   clearOverlayWallpaper()
 *     Removes the custom wallpaper; the overlay reverts to its solid dark background.
 *
 *   getDefaultQuotes()          → Promise<String>  (JSON array)
 *     Returns the built-in default quote pool as a JSON array string so the
 *     JS layer can display them in a picker.
 *
 *   getOverlaySettings()        → Promise<String>  (JSON object)
 *     Returns the current overlay settings as a JSON object:
 *     { quote: string, quotesJson: string, wallpaperPath: string }
 */
class BlockOverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFS_NAME = "focusday_prefs"

        val DEFAULT_QUOTES = listOf(
            "The present moment is the only time over which we have dominion.",
            "Focus is the art of knowing what to ignore.",
            "Deep work is the superpower of the 21st century.",
            "Your future self is watching. Don't let them down.",
            "One task at a time. One step at a time. One breath at a time.",
            "Discipline is choosing between what you want now and what you want most.",
            "The successful warrior is the average person with laser-like focus.",
            "Where attention goes, energy flows.",
            "Distraction is the enemy of vision.",
            "Every time you resist the urge to check, you grow stronger.",
            "You don't need to check your phone. The world can wait.",
            "Protect your attention like you protect your money.",
            "Clarity comes from action, not thought.",
            "Small disciplines repeated with consistency lead to great achievements.",
            "The cost of distraction is the loss of the life you could have built."
        )
    }

    override fun getName(): String = "BlockOverlay"

    private val prefs: SharedPreferences
        get() = reactContext.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)

    // ─── Quote configuration ──────────────────────────────────────────────────

    /**
     * Pin a fixed quote. Pass "" to return to random mode.
     */
    @ReactMethod
    fun setOverlayQuote(quote: String, promise: Promise) {
        prefs.edit().putString("block_overlay_quote", quote.trim()).apply()
        promise.resolve(null)
    }

    /**
     * Replace the random pool with a JSON array of custom quotes.
     * Pass "" or "[]" to restore built-in defaults.
     */
    @ReactMethod
    fun setCustomQuotes(quotesJson: String, promise: Promise) {
        try {
            val trimmed = quotesJson.trim()
            if (trimmed.isEmpty() || trimmed == "[]") {
                prefs.edit().remove("block_overlay_quotes").apply()
                promise.resolve(null)
                return
            }
            // Validate JSON before saving
            val arr = JSONArray(trimmed)
            if (arr.length() == 0) {
                prefs.edit().remove("block_overlay_quotes").apply()
            } else {
                prefs.edit().putString("block_overlay_quotes", trimmed).apply()
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("INVALID_JSON", "quotes must be a valid JSON array: ${e.message}", e)
        }
    }

    /**
     * Clear the pinned quote — overlay returns to random selection.
     */
    @ReactMethod
    fun clearCustomQuote(promise: Promise) {
        prefs.edit().remove("block_overlay_quote").apply()
        promise.resolve(null)
    }

    // ─── Wallpaper configuration ──────────────────────────────────────────────

    /**
     * Set the wallpaper background for the overlay.
     * [absolutePath] must be a readable file path on the device.
     */
    @ReactMethod
    fun setOverlayWallpaper(absolutePath: String, promise: Promise) {
        if (absolutePath.isBlank()) {
            promise.reject("INVALID_PATH", "Path cannot be empty")
            return
        }
        val file = java.io.File(absolutePath)
        if (!file.exists() || !file.canRead()) {
            promise.reject("FILE_NOT_FOUND", "File does not exist or is not readable: $absolutePath")
            return
        }
        prefs.edit().putString("block_overlay_wallpaper", absolutePath).apply()
        promise.resolve(null)
    }

    /**
     * Remove the custom wallpaper; overlay shows its solid dark background.
     */
    @ReactMethod
    fun clearOverlayWallpaper(promise: Promise) {
        prefs.edit().remove("block_overlay_wallpaper").apply()
        promise.resolve(null)
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    /**
     * Returns the built-in default quote pool as a JSON array string.
     */
    @ReactMethod
    fun getDefaultQuotes(promise: Promise) {
        try {
            val arr = JSONArray()
            DEFAULT_QUOTES.forEach { arr.put(it) }
            promise.resolve(arr.toString())
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Returns current overlay settings as a JSON object string.
     * Shape: { quote: string, quotesJson: string, wallpaperPath: string }
     */
    @ReactMethod
    fun getOverlaySettings(promise: Promise) {
        try {
            val obj = org.json.JSONObject().apply {
                put("quote",        prefs.getString("block_overlay_quote",     "") ?: "")
                put("quotesJson",   prefs.getString("block_overlay_quotes",    "") ?: "")
                put("wallpaperPath",prefs.getString("block_overlay_wallpaper", "") ?: "")
            }
            promise.resolve(obj.toString())
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }
}
