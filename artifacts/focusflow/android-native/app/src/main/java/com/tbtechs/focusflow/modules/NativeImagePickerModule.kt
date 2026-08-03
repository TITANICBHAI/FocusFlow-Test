package com.tbtechs.focusflow.modules

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * NativeImagePickerModule
 *
 * JS name: NativeModules.NativeImagePicker
 *
 * Replaces expo-image-picker for the single use case of picking a wallpaper
 * image for the block overlay.  Uses Android's built-in photo picker — zero
 * third-party dependencies.
 *
 * Android 13+ (API 33): Uses MediaStore.ACTION_PICK_IMAGES (Photo Picker).
 *   → No READ_MEDIA_IMAGES permission required.  The system UI sandboxes access.
 * Android 8–12 (API 26–32): Falls back to Intent.ACTION_PICK against
 *   MediaStore.Images.Media.EXTERNAL_CONTENT_URI.
 *   → READ_EXTERNAL_STORAGE must be granted before calling pickImage().
 *
 * Methods exposed to JS:
 *   pickImage()             → Promise<String | null>  — file:// or content:// URI
 *   checkMediaPermission()  → Promise<Boolean>        — true if already granted
 */
class NativeImagePickerModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    companion object {
        const val NAME = "NativeImagePicker"
        private const val REQUEST_PICK_IMAGE = 0xF100
    }

    private var pendingPromise: Promise? = null

    private val activityEventListener = object : ActivityEventListener {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != REQUEST_PICK_IMAGE) return
            val promise = pendingPromise ?: return
            pendingPromise = null
            if (resultCode != Activity.RESULT_OK || data == null) {
                promise.resolve(null)
                return
            }
            val uri: Uri? = data.data
            promise.resolve(uri?.toString())
        }

        override fun onNewIntent(intent: Intent) {}
    }

    init {
        ctx.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun pickImage(promise: Promise) {
        val activity: Activity? = ctx.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No foreground activity available")
            return
        }
        if (pendingPromise != null) {
            promise.reject("E_PICKER_BUSY", "Another image pick is already in progress")
            return
        }
        pendingPromise = promise

        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Intent(MediaStore.ACTION_PICK_IMAGES).apply { type = "image/*" }
        } else {
            Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        }

        @Suppress("DEPRECATION")
        activity.startActivityForResult(intent, REQUEST_PICK_IMAGE)
    }

    /**
     * Returns true if the app can access media without showing a permission dialog.
     * On Android 13+ this is always true because the Photo Picker needs no permission.
     */
    @ReactMethod
    fun checkMediaPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(true)
            return
        }
        val perm = android.Manifest.permission.READ_EXTERNAL_STORAGE
        val granted = ctx.checkSelfPermission(perm) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }
}
