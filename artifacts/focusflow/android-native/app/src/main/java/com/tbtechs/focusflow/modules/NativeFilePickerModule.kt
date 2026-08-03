package com.tbtechs.focusflow.modules

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * NativeFilePickerModule
 *
 * JS name: NativeModules.NativeFilePicker
 *
 * Opens Android's system file picker (ACTION_OPEN_DOCUMENT) and reads the
 * selected file's content + display name back to JS.  No third-party
 * dependencies — uses only the Android Storage Access Framework.
 *
 * Methods exposed to JS:
 *   pickFile(mimeType: String)
 *       → Promise<{ name: String, content: String } | null>
 *         null if the user cancelled or reading failed.
 *
 *   saveFile(content: String, fileName: String, mimeType: String)
 *       → Promise<String | null>
 *         Resolves with the content URI string on success, null if cancelled.
 *         Opens ACTION_CREATE_DOCUMENT so the user picks where to save.
 *
 * Usage:
 *   pickFile("application/json")  — shows only JSON files
 *   pickFile(allFilesMimeType)    — shows all files
 *   saveFile(json, "backup.focusflow", "application/octet-stream")
 */
class NativeFilePickerModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    companion object {
        const val NAME = "NativeFilePicker"
        private const val REQUEST_PICK_FILE = 0xF200
        private const val REQUEST_SAVE_FILE = 0xF201
    }

    private var pendingPromise: Promise? = null
    private var pendingOperation: String = ""
    private var pendingSaveContent: String = ""

    private val activityEventListener = object : ActivityEventListener {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            when (requestCode) {
                REQUEST_PICK_FILE -> handlePickResult(resultCode, data)
                REQUEST_SAVE_FILE -> handleSaveResult(resultCode, data)
            }
        }

        override fun onNewIntent(intent: Intent) {}
    }

    init {
        ctx.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun pickFile(mimeType: String, promise: Promise) {
        val activity: Activity? = ctx.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No foreground activity available")
            return
        }
        if (pendingPromise != null) {
            promise.reject("E_PICKER_BUSY", "A file pick is already in progress")
            return
        }
        pendingPromise = promise
        pendingOperation = "pick"

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType.ifBlank { "*".plus("/").plus("*") }
        }

        @Suppress("DEPRECATION")
        activity.startActivityForResult(intent, REQUEST_PICK_FILE)
    }

    /**
     * Opens the system "Save to" dialog (ACTION_CREATE_DOCUMENT) so the user can
     * choose where to write the backup file — Downloads, Google Drive, etc.
     *
     * @param content   UTF-8 text to write (the serialised JSON backup)
     * @param fileName  Suggested file name shown in the save dialog
     * @param mimeType  MIME type of the file (e.g. "application/octet-stream")
     */
    @ReactMethod
    fun saveFile(content: String, fileName: String, mimeType: String, promise: Promise) {
        val activity: Activity? = ctx.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No foreground activity available")
            return
        }
        if (pendingPromise != null) {
            promise.reject("E_PICKER_BUSY", "Another file operation is already in progress")
            return
        }
        pendingPromise = promise
        pendingOperation = "save"
        pendingSaveContent = content

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType.ifBlank { "application/octet-stream" }
            putExtra(Intent.EXTRA_TITLE, fileName)
        }

        @Suppress("DEPRECATION")
        activity.startActivityForResult(intent, REQUEST_SAVE_FILE)
    }

    private fun handlePickResult(resultCode: Int, data: Intent?) {
        val promise = pendingPromise ?: return
        pendingPromise = null
        pendingOperation = ""

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            promise.resolve(null)
            return
        }

        val uri: Uri = data.data!!
        try {
            val name = resolveDisplayName(uri)
            val content = ctx.contentResolver.openInputStream(uri)
                ?.bufferedReader()
                ?.readText()
                ?: run { promise.resolve(null); return }

            val map = Arguments.createMap().apply {
                putString("name", name)
                putString("content", content)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("E_READ_FAILED", "Could not read file: ${e.message}")
        }
    }

    private fun handleSaveResult(resultCode: Int, data: Intent?) {
        val promise = pendingPromise ?: return
        val content = pendingSaveContent
        pendingPromise = null
        pendingOperation = ""
        pendingSaveContent = ""

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            promise.resolve(null)
            return
        }

        val uri: Uri = data.data!!
        try {
            ctx.contentResolver.openOutputStream(uri)?.use { stream ->
                stream.write(content.toByteArray(Charsets.UTF_8))
                stream.flush()
            }
            promise.resolve(uri.toString())
        } catch (e: Exception) {
            promise.reject("E_WRITE_FAILED", "Could not write backup file: ${e.message}")
        }
    }

    private fun resolveDisplayName(uri: Uri): String {
        ctx.contentResolver.query(
            uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) return cursor.getString(idx) ?: uri.lastPathSegment ?: "file"
            }
        }
        return uri.lastPathSegment ?: "file"
    }
}
