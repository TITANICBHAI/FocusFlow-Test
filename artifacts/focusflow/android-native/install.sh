#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FocusFlow — Android native module installer
#
# Run this AFTER: npx expo prebuild --platform android
#
# Usage:
#   chmod +x android-native/install.sh
#   ./android-native/install.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
PKG_DIR="$ANDROID_DIR/app/src/main/java/com/tbtechs/focusflow"
RES_DIR="$ANDROID_DIR/app/src/main/res"
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"

# ── Cross-platform sed -i ─────────────────────────────────────────────────────
# macOS BSD sed requires a backup extension with -i; GNU sed (Linux) does not.
sedi() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

if [ ! -d "$ANDROID_DIR" ]; then
  echo "❌  android/ directory not found."
  echo "    Run 'npx expo prebuild --platform android' first."
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "❌  AndroidManifest.xml not found at $MANIFEST"
  exit 1
fi

echo "📦  Copying Kotlin source files..."

# Modules
mkdir -p "$PKG_DIR/modules"
# Guard: only copy if source files exist (prevents glob failure with set -e)
if ls "$SCRIPT_DIR/app/src/main/java/com/tbtechs/focusflow/modules/"*.kt 2>/dev/null | grep -q .; then
  cp "$SCRIPT_DIR/app/src/main/java/com/tbtechs/focusflow/modules/"*.kt "$PKG_DIR/modules/"
  echo "   ✓ modules/ Kotlin files copied"
else
  echo "   ⚠ modules/ — no .kt files found, skipping"
fi

# Services
mkdir -p "$PKG_DIR/services"
if ls "$SCRIPT_DIR/app/src/main/java/com/tbtechs/focusflow/services/"*.kt 2>/dev/null | grep -q .; then
  cp "$SCRIPT_DIR/app/src/main/java/com/tbtechs/focusflow/services/"*.kt "$PKG_DIR/services/"
  echo "   ✓ services/ Kotlin files copied"
else
  echo "   ⚠ services/ — no .kt files found, skipping"
fi

# Widget
mkdir -p "$PKG_DIR/widget"
if ls "$SCRIPT_DIR/app/src/main/java/com/tbtechs/focusflow/widget/"*.kt 2>/dev/null | grep -q .; then
  cp "$SCRIPT_DIR/app/src/main/java/com/tbtechs/focusflow/widget/"*.kt "$PKG_DIR/widget/"
  echo "   ✓ widget/ Kotlin files copied"
else
  echo "   ⚠ widget/ — no .kt files found, skipping"
fi

echo "🖼   Copying resource files..."

# XML config files
mkdir -p "$RES_DIR/xml"
for f in accessibility_service_config.xml device_admin.xml widget_info.xml; do
  SRC="$SCRIPT_DIR/app/src/main/res/xml/$f"
  if [ -f "$SRC" ]; then
    cp "$SRC" "$RES_DIR/xml/"
    echo "   ✓ xml/$f copied"
  else
    echo "   ⚠ xml/$f not found, skipping"
  fi
done

# Widget layout
mkdir -p "$RES_DIR/layout"
if [ -f "$SCRIPT_DIR/app/src/main/res/layout/widget_focusflow.xml" ]; then
  cp "$SCRIPT_DIR/app/src/main/res/layout/widget_focusflow.xml" "$RES_DIR/layout/"
  echo "   ✓ layout/widget_focusflow.xml copied"
fi

# Drawable (widget background)
mkdir -p "$RES_DIR/drawable"
if ls "$SCRIPT_DIR/app/src/main/res/drawable/"*.xml 2>/dev/null | grep -q .; then
  cp "$SCRIPT_DIR/app/src/main/res/drawable/"*.xml "$RES_DIR/drawable/"
  echo "   ✓ drawable/ resources copied"
else
  echo "   ⚠ drawable/ — no .xml files found, skipping"
fi

echo "📝  Patching strings.xml..."

STRINGS_FILE="$RES_DIR/values/strings.xml"

if ! grep -q "accessibility_service_description" "$STRINGS_FILE" 2>/dev/null; then
  sedi 's|</resources>|    <string name="accessibility_service_description">FocusFlow uses Accessibility to detect and block distracting apps during your focus sessions. No personal data or messages are read.</string>\n</resources>|' "$STRINGS_FILE"
  echo "   ✓ accessibility_service_description added"
else
  echo "   ✓ accessibility_service_description already present"
fi

if ! grep -q "widget_description" "$STRINGS_FILE" 2>/dev/null; then
  sedi 's|</resources>|    <string name="widget_description">Shows your active focus session and time remaining on the home screen.</string>\n</resources>|' "$STRINGS_FILE"
  echo "   ✓ widget_description added"
else
  echo "   ✓ widget_description already present"
fi

echo "📋  Patching AndroidManifest.xml..."

# ── Ensure xmlns:tools namespace is declared in <manifest> ───────────────────
# NOTE: manifest existence is confirmed above — safe to patch here.
if ! grep -q 'xmlns:tools' "$MANIFEST"; then
  sedi 's|<manifest |<manifest xmlns:tools="http://schemas.android.com/tools" |' "$MANIFEST"
  echo "   ✓ xmlns:tools namespace added to manifest root"
else
  echo "   ✓ xmlns:tools already present"
fi

# ── Permissions ──────────────────────────────────────────────────────────────

patch_permission() {
  local PERM="$1"
  local EXTRA="${2:-}"
  if ! grep -q "$PERM" "$MANIFEST"; then
    sedi "s|</manifest>|    <uses-permission android:name=\"$PERM\"$EXTRA />\n</manifest>|" "$MANIFEST"
    echo "   ✓ added $PERM"
  else
    echo "   ✓ $PERM already present"
  fi
}

patch_permission "android.permission.PACKAGE_USAGE_STATS"        ' tools:ignore="ProtectedPermissions"'
patch_permission "android.permission.SYSTEM_ALERT_WINDOW"
patch_permission "android.permission.FOREGROUND_SERVICE"
patch_permission "android.permission.FOREGROUND_SERVICE_SPECIAL_USE"
patch_permission "android.permission.RECEIVE_BOOT_COMPLETED"
patch_permission "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
patch_permission "android.permission.BIND_ACCESSIBILITY_SERVICE"  ' tools:ignore="ProtectedPermissions"'
patch_permission "android.permission.KILL_BACKGROUND_PROCESSES"
patch_permission "android.permission.USE_FULL_SCREEN_INTENT"
patch_permission "android.permission.EXPAND_STATUS_BAR"
# Required on Android 11+ for InstalledAppsModule.queryIntentActivities() to return
# a full app list. Without this the app drawer and installed-apps settings screen
# are empty or show only system/whitelisted apps on API 30+ devices.
patch_permission "android.permission.QUERY_ALL_PACKAGES"          ' tools:ignore="QueryAllPackagesPermission"'
# Required by NuclearModeModule to launch the system uninstall dialog for a package.
patch_permission "android.permission.REQUEST_DELETE_PACKAGES"

# ── ForegroundTaskService ─────────────────────────────────────────────────────

if ! grep -q "ForegroundTaskService" "$MANIFEST"; then
  sedi 's|</application>|        <service\n            android:name="com.tbtechs.focusflow.services.ForegroundTaskService"\n            android:enabled="true"\n            android:exported="false"\n            android:foregroundServiceType="specialUse">\n            <property\n                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"\n                android:value="productivity" />\n        </service>\n    </application>|' "$MANIFEST"
  echo "   ✓ ForegroundTaskService registered"
else
  echo "   ✓ ForegroundTaskService already registered"
fi

# ── AppBlockerAccessibilityService ───────────────────────────────────────────

if ! grep -q "AppBlockerAccessibilityService" "$MANIFEST"; then
  sedi 's|</application>|        <service\n            android:name="com.tbtechs.focusflow.services.AppBlockerAccessibilityService"\n            android:enabled="true"\n            android:exported="true"\n            android:label="FocusFlow Focus Mode"\n            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">\n            <intent-filter>\n                <action android:name="android.accessibilityservice.AccessibilityService" />\n            </intent-filter>\n            <meta-data\n                android:name="android.accessibilityservice"\n                android:resource="@xml/accessibility_service_config" />\n        </service>\n    </application>|' "$MANIFEST"
  echo "   ✓ AppBlockerAccessibilityService registered"
else
  echo "   ✓ AppBlockerAccessibilityService already registered"
fi

# ── NetworkBlockerVpnService ──────────────────────────────────────────────────
# VpnService subclass that intercepts traffic for blocked packages.
# BIND_VPN_SERVICE permission is required on the service declaration.
# The android.net.VpnService intent-filter is what makes Android recognise
# this as the active VPN tunnel when VpnService.prepare() is called.

if ! grep -q "NetworkBlockerVpnService" "$MANIFEST"; then
  sedi 's|</application>|        <service\n            android:name="com.tbtechs.focusflow.services.NetworkBlockerVpnService"\n            android:enabled="true"\n            android:exported="false"\n            android:permission="android.permission.BIND_VPN_SERVICE">\n            <intent-filter>\n                <action android:name="android.net.VpnService" />\n            </intent-filter>\n        </service>\n    </application>|' "$MANIFEST"
  echo "   ✓ NetworkBlockerVpnService registered"
else
  echo "   ✓ NetworkBlockerVpnService already registered"
fi

# ── PackageInstallReceiver ────────────────────────────────────────────────────
# Listens for ACTION_PACKAGE_ADDED so newly installed apps are automatically
# blocked during an active focus or standalone session.
# <data android:scheme="package"> is mandatory — without it the broadcast is
# never delivered (system only sends it with a package: URI).

if ! grep -q "PackageInstallReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.PackageInstallReceiver"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.PACKAGE_ADDED" />\n                <data android:scheme="package" />\n            </intent-filter>\n        </receiver>\n    </application>|' "$MANIFEST"
  echo "   ✓ PackageInstallReceiver registered"
else
  echo "   ✓ PackageInstallReceiver already registered"
fi

# ── BlockOverlayActivity ──────────────────────────────────────────────────────
# Full-screen overlay shown when a blocked app is launched.
# singleTask: prevents stacking multiple overlay instances.
# showWhenLocked + turnScreenOn: renders over lockscreen if needed.
# excludeFromRecents + noHistory: disappears cleanly after dismissal.

if ! grep -q "BlockOverlayActivity" "$MANIFEST"; then
  sedi 's|</application>|        <activity\n            android:name="com.tbtechs.focusflow.services.BlockOverlayActivity"\n            android:exported="false"\n            android:launchMode="singleTask"\n            android:showWhenLocked="true"\n            android:turnScreenOn="true"\n            android:excludeFromRecents="true"\n            android:noHistory="true"\n            android:taskAffinity=""\n            android:theme="@android:style/Theme.NoTitleBar.Fullscreen" />\n    </application>|' "$MANIFEST"
  echo "   ✓ BlockOverlayActivity registered"
else
  echo "   ✓ BlockOverlayActivity already registered"
fi

# ── TaskEndAlarmReceiver ──────────────────────────────────────────────────────
# Receives AlarmManager PendingIntents fired when a task's scheduled end time
# arrives. Not exported — only our own process sends these intents.

if ! grep -q "TaskEndAlarmReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.TaskEndAlarmReceiver"\n            android:exported="false" />\n    </application>|' "$MANIFEST"
  echo "   ✓ TaskEndAlarmReceiver registered"
else
  echo "   ✓ TaskEndAlarmReceiver already registered"
fi

# ── TemptationReportReceiver ──────────────────────────────────────────────────
# Receives internal broadcasts for temptation / aversion event logging.
# Not exported — only fired by our own process.

if ! grep -q "TemptationReportReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.TemptationReportReceiver"\n            android:exported="false" />\n    </application>|' "$MANIFEST"
  echo "   ✓ TemptationReportReceiver registered"
else
  echo "   ✓ TemptationReportReceiver already registered"
fi

# ── BootReceiver ─────────────────────────────────────────────────────────────

if ! grep -q "BootReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.BootReceiver"\n            android:enabled="true"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.BOOT_COMPLETED" />\n                <action android:name="android.intent.action.QUICKBOOT_POWERON" />\n            </intent-filter>\n        </receiver>\n    </application>|' "$MANIFEST"
  echo "   ✓ BootReceiver registered"
else
  echo "   ✓ BootReceiver already registered"
fi

# ── FocusFlowWidget ──────────────────────────────────────────────────────────

if ! grep -q "FocusFlowWidget" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.widget.FocusFlowWidget"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />\n            </intent-filter>\n            <meta-data\n                android:name="android.appwidget.provider"\n                android:resource="@xml/widget_info" />\n        </receiver>\n    </application>|' "$MANIFEST"
  echo "   ✓ FocusFlowWidget registered"
else
  echo "   ✓ FocusFlowWidget already registered"
fi

# ── FocusDayDeviceAdminReceiver ───────────────────────────────────────────────

if ! grep -q "FocusDayDeviceAdminReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.FocusDayDeviceAdminReceiver"\n            android:description="@string/accessibility_service_description"\n            android:exported="true"\n            android:label="FocusFlow"\n            android:permission="android.permission.BIND_DEVICE_ADMIN">\n            <intent-filter>\n                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />\n            </intent-filter>\n            <meta-data\n                android:name="android.app.device_admin"\n                android:resource="@xml/device_admin" />\n        </receiver>\n    </application>|' "$MANIFEST"
  echo "   ✓ FocusDayDeviceAdminReceiver registered"
else
  echo "   ✓ FocusDayDeviceAdminReceiver already registered"
fi

# ── VpnWatchdogReceiver ───────────────────────────────────────────────────────
# AlarmManager-based watchdog that survives process death and restarts the VPN
# tunnel if Android's battery optimiser killed it during an active session.

if ! grep -q "VpnWatchdogReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.VpnWatchdogReceiver"\n            android:exported="false" />\n    </application>|' "$MANIFEST"
  echo "   ✓ VpnWatchdogReceiver registered"
else
  echo "   ✓ VpnWatchdogReceiver already registered"
fi

# ── NotificationActionReceiver ────────────────────────────────────────────────
# Handles taps on ✓ Done / +15m / +30m / Skip action buttons in the foreground
# notification. All PendingIntents are package-restricted (setPackage = ours),
# so exported=false is correct and prevents external apps from triggering actions.

if ! grep -q "NotificationActionReceiver" "$MANIFEST"; then
  sedi 's|</application>|        <receiver\n            android:name="com.tbtechs.focusflow.services.NotificationActionReceiver"\n            android:exported="false">\n            <intent-filter>\n                <action android:name="com.tbtechs.focusflow.notif.COMPLETE" />\n                <action android:name="com.tbtechs.focusflow.notif.EXTEND" />\n                <action android:name="com.tbtechs.focusflow.notif.SKIP" />\n            </intent-filter>\n        </receiver>\n    </application>|' "$MANIFEST"
  echo "   ✓ NotificationActionReceiver registered"
else
  echo "   ✓ NotificationActionReceiver already registered"
fi

# ── TaskAlarmActivity ─────────────────────────────────────────────────────────
# Full-screen alarm activity launched via setFullScreenIntent when a task ends.
# showWhenLocked + turnScreenOn so it wakes the device and renders over the
# lockscreen.  excludeFromRecents so the alarm UI never appears in the recents
# list after dismissal.  noHistory so it is auto-removed once finished.
# launchMode singleInstance so a re-trigger never stacks duplicate alarm screens.

if ! grep -q "TaskAlarmActivity" "$MANIFEST"; then
  sedi 's|</application>|        <activity\n            android:name="com.tbtechs.focusflow.services.TaskAlarmActivity"\n            android:excludeFromRecents="true"\n            android:showWhenLocked="true"\n            android:turnScreenOn="true"\n            android:noHistory="true"\n            android:launchMode="singleInstance"\n            android:taskAffinity=""\n            android:theme="@android:style/Theme.NoTitleBar.Fullscreen"\n            android:exported="false" />\n    </application>|' "$MANIFEST"
  echo "   ✓ TaskAlarmActivity registered"
else
  echo "   ✓ TaskAlarmActivity already registered"
fi

# ── LauncherActivity ──────────────────────────────────────────────────────────
# Home-screen replacement launcher with HOME + DEFAULT intent-filter.
# Set FocusFlow as the default home app in Android Settings to enable
# zero-delay, pre-launch app interception and a filtered app drawer.
# taskAffinity="" ensures HOME press creates its own task root.

if ! grep -q "LauncherActivity" "$MANIFEST"; then
  sedi 's|</application>|        <activity\n            android:name="com.tbtechs.focusflow.services.LauncherActivity"\n            android:launchMode="singleTask"\n            android:excludeFromRecents="true"\n            android:exported="true"\n            android:taskAffinity=""\n            android:clearTaskOnLaunch="true"\n            android:stateNotNeeded="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.HOME" />\n                <category android:name="android.intent.category.DEFAULT" />\n            </intent-filter>\n        </activity>\n    </application>|' "$MANIFEST"
  echo "   ✓ LauncherActivity registered (with clearTaskOnLaunch + stateNotNeeded)"
else
  echo "   ✓ LauncherActivity already registered"
fi

echo ""
echo "✅  All native files installed and manifest patched."
echo ""
echo "────────────────────────────────────────────────────────────"
echo "  ONE MANUAL STEP STILL REQUIRED:"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  Register FocusDayPackage in:"
echo "    android/app/src/main/java/com/tbtechs/focusflow/MainApplication.kt"
echo ""
echo "  Add import:"
echo "    import com.tbtechs.focusflow.modules.FocusDayPackage"
echo ""
echo "  In getPackages():"
echo "    packages.add(FocusDayPackage())"
echo ""
echo "  Then build:"
echo "    eas build --platform android --profile preview"
echo ""
