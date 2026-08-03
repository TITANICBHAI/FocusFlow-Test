package com.tbtechs.focusflow.modules

import android.content.Intent
import android.content.pm.PackageManager
import android.view.inputmethod.InputMethodManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.ByteArrayOutputStream

/**
 * InstalledAppsModule
 *
 * JS name: NativeModules.InstalledApps
 *
 * Exposes a single method to JS:
 *   - getInstalledApps() → Promise<Array<{ packageName, appName, iconBase64? }>>
 *
 * Filter logic: only returns apps that have a launcher icon (i.e. appear in the
 * device's app drawer). This uses getLaunchIntentForPackage() — the same signal
 * the Android launcher uses — instead of the FLAG_SYSTEM flag.
 *
 * Why NOT use FLAG_SYSTEM / FLAG_UPDATED_SYSTEM_APP:
 *   Filtering by FLAG_UPDATED_SYSTEM_APP excludes apps like YouTube, Chrome, Gmail,
 *   Samsung Browser, Instagram (pre-installed on some devices), etc. — exactly the
 *   apps users want to block. The correct signal is "does this app appear in the
 *   app drawer?" which is getLaunchIntentForPackage() != null.
 *
 * Icons are scaled to ICON_SIZE × ICON_SIZE (64 dp equivalent) and PNG-compressed
 * at 80% quality before being base64-encoded, keeping each icon under ~10 KB.
 *
 * AdaptiveIconDrawable (API 26+) is rendered onto a white background so
 * the foreground layer is always visible regardless of the system's icon shape.
 */
class InstalledAppsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "InstalledApps"
        private const val ICON_SIZE = 96  // px — ~1.5× a 64 dp icon, good for hdpi screens
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager

            // Build the set of IME (keyboard) package names so we can flag them.
            // Custom keyboards often have browser-like GIF search and web content built in,
            // making them a potential bypass vector that the general app list doesn't expose.
            val imePackages: Set<String> = try {
                val imm = reactContext.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)
                        as? InputMethodManager
                imm?.inputMethodList?.mapTo(mutableSetOf()) { it.packageName } ?: emptySet()
            } catch (_: Exception) {
                emptySet()
            }

            // Query all installed packages — returns the full list.
            // On Android 11+ (API 30+) this is limited by package visibility unless
            // QUERY_ALL_PACKAGES is granted or a matching <queries> block exists in the manifest.
            @Suppress("DEPRECATION")
            val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)

            val result: WritableArray = Arguments.createArray()

            for (app in apps) {
                // Skip our own package
                if (app.packageName == reactContext.packageName) continue

                // Determine whether this is a keyboard/IME app even if it has no
                // launcher icon — IME apps are relevant for blocking but may not
                // appear in the app drawer under getLaunchIntentForPackage.
                val isIme = imePackages.contains(app.packageName)

                // Only include apps that appear in the app drawer OR are IMEs.
                val launchIntent = pm.getLaunchIntentForPackage(app.packageName)
                if (launchIntent == null && !isIme) continue

                val map: WritableMap = Arguments.createMap()
                map.putString("packageName", app.packageName)
                map.putBoolean("isIme", isIme)

                val label = try {
                    pm.getApplicationLabel(app).toString()
                } catch (_: Exception) {
                    app.packageName
                }
                map.putString("appName", label)

                try {
                    val icon: Drawable = pm.getApplicationIcon(app.packageName)
                    val bitmap = drawableToBitmap(icon)
                    val stream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.PNG, 80, stream)
                    val b64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
                    map.putString("iconBase64", b64)
                } catch (_: Exception) {
                    map.putNull("iconBase64")
                }

                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INSTALLED_APPS_ERROR", e.message, e)
        }
    }

    /**
     * Converts any Drawable (including AdaptiveIconDrawable) to a fixed-size Bitmap.
     *
     * AdaptiveIconDrawable (Android 8+) has a foreground and background layer.
     * We draw it on a white background at ICON_SIZE so the icon is always visible
     * regardless of whether the system would normally apply a shape mask.
     */
    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        val bitmap = Bitmap.createBitmap(ICON_SIZE, ICON_SIZE, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            drawable is AdaptiveIconDrawable) {
            // Fill white background so the foreground layer renders correctly
            canvas.drawColor(android.graphics.Color.WHITE)
            drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
            drawable.draw(canvas)
        } else {
            drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
            drawable.draw(canvas)
        }

        return bitmap
    }
}
