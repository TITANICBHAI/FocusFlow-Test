package com.tbtechs.focusflow.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * PackageInstallReceiver
 *
 * Listens for package add/remove broadcasts so the effective VPN policy can be
 * recalculated when installed-package availability changes.
 *
 * Behaviour during an active session:
 *   1. Reads the current focus/standalone block state from SharedPreferences.
 *   2. If task-based focus is active, adds the new package to the BLOCKED set
 *      (i.e. removes it from allowed_packages if it was somehow there, or — for
 *      an allowlist-based session — the app was never in the allowed list so it
 *      will be blocked automatically by the AccessibilityService's "not in
 *      allowed_packages" logic without any extra work).
 *      Additionally, the new package is appended to a "runtime_install_flagged"
 *      list so the JS layer can surface a warning banner on next app open.
 *   3. If standalone-block is active, appends the new package to
 *      standalone_blocked_packages so it is immediately covered by the block.
 *   4. Starts a brief aversive deterrent (vibration) to alert the user that
 *      the install was noticed.
 *   5. On package removal, recalculates the policy so the removed package is
 *      no longer treated as an active VPN target.
 *
 * Declared in AndroidManifest.xml with:
 *   <action android:name="android.intent.action.PACKAGE_ADDED" />
 *   <action android:name="android.intent.action.PACKAGE_REMOVED" />
 *   <action android:name="android.intent.action.PACKAGE_FULLY_REMOVED" />
 *   <data android:scheme="package" />
 */
class PackageInstallReceiver : BroadcastReceiver() {

    companion object {
        /**
         * SharedPrefs key: JSON array of package names installed during a session.
         * Reset by JS when the session ends so the warning banner clears.
         */
        const val PREF_RUNTIME_INSTALLS = "runtime_install_flagged"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_PACKAGE_ADDED &&
            action != Intent.ACTION_PACKAGE_REMOVED &&
            action != Intent.ACTION_PACKAGE_FULLY_REMOVED
        ) return

        val isReplacing = intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)
        if (isReplacing) return

        val newPkg = intent.data?.schemeSpecificPart ?: return
        if (newPkg.isBlank()) return

        val prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )

        val now = System.currentTimeMillis()

        val focusActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false).let { on ->
            if (on) {
                val endMs = prefs.getLong("task_end_ms", 0L)
                endMs == 0L || now < endMs
            } else false
        }

        val saActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_SA_ACTIVE, false).let { on ->
            if (on) {
                val untilMs = prefs.getLong(AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L)
                untilMs == 0L || now < untilMs
            } else false
        }

        val persistentVpn = NetworkBlockerVpnService.hasPersistentVpnConfiguration(prefs)
        if (!focusActive && !saActive && !persistentVpn) {
            return
        }

        // A removal must recalculate even when no focus/standalone session is
        // active: a persistent explicit selection may be the only source.
        if (action != Intent.ACTION_PACKAGE_ADDED) {
            NetworkBlockerVpnService.requestSync(context)
            return
        }

        val editor = prefs.edit()

        flagNewInstall(newPkg, prefs, editor)

        if (saActive) {
            appendToSaBlockedPackages(newPkg, prefs, editor)
        }

        // This receiver can run while the JS process is dead. Commit the
        // standalone package update before asking the native VPN policy to
        // recalculate, otherwise requestSync could read the previous list.
        editor.commit()
        NetworkBlockerVpnService.requestSync(context)

        AversiveActionsManager.onBlockedApp(context)
    }

    private fun flagNewInstall(
        pkg: String,
        prefs: SharedPreferences,
        editor: SharedPreferences.Editor
    ) {
        val existing = prefs.getString(PREF_RUNTIME_INSTALLS, "[]") ?: "[]"
        val arr = try { JSONArray(existing) } catch (_: Exception) { JSONArray() }
        for (i in 0 until arr.length()) {
            if (arr.getString(i) == pkg) return
        }
        arr.put(pkg)
        editor.putString(PREF_RUNTIME_INSTALLS, arr.toString())
    }

    private fun appendToSaBlockedPackages(
        pkg: String,
        prefs: SharedPreferences,
        editor: SharedPreferences.Editor
    ) {
        val existing = prefs.getString(AppBlockerAccessibilityService.PREF_SA_PKGS, "[]") ?: "[]"
        val arr = try { JSONArray(existing) } catch (_: Exception) { JSONArray() }
        for (i in 0 until arr.length()) {
            if (arr.getString(i) == pkg) return
        }
        arr.put(pkg)
        editor.putString(AppBlockerAccessibilityService.PREF_SA_PKGS, arr.toString())
    }
}
