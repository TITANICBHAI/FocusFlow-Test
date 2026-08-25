package com.tbtechs.focusflow.modules

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * FocusDayPackage
 *
 * Registers all FocusDay native modules with the React Native bridge.
 *
 * Uses plain ReactPackage (not TurboReactPackage) — the correct pattern for
 * Old Architecture (newArchEnabled=false). TurboReactPackage with isTurboModule=true
 * causes all modules to resolve as null on old arch because the bridge routes them
 * through the TurboModule loading path, which requires New Architecture.
 *
 * All modules use the standard ReactContextBaseJavaModule + @ReactMethod pattern.
 *
 * Wired into MainApplication.kt via the withFocusDayAndroid config plugin automatically
 * during expo prebuild / EAS build.
 *
 * Registered modules:
 *   UsageStats        — usage-access / accessibility / battery / device-admin checks
 *   ForegroundService — start / stop the focus foreground service
 *   ForegroundLaunch  — bring app to foreground from background
 *   FocusDayBridge    — JS↔native event bridge (app-blocked broadcasts)
 *   SharedPrefs       — raw SharedPreferences read/write for the JS layer
 *   InstalledApps     — list of installed packages for whitelist / block selection
 *   BlockOverlay      — configure full-screen overlay quotes and wallpaper
 *   NuclearMode       — request system uninstall dialogs for distracting apps
 *   NetworkBlock      — VPN tunnel + WiFi/data disable when a blocked app opens
 *   Aversions         — screen dimmer / vibration / sound alert toggles
 *   Greyout           — time-window block schedule + temptation log access
 *   NativeImagePicker — system photo picker replacing expo-image-picker (zero deps)
 *   NativeFilePicker  — ACTION_OPEN_DOCUMENT file picker returning name + content
 *   SessionPin        — PIN-based protection for session-ending native methods
 */
class FocusDayPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(
            UsageStatsModule(reactContext),
            ForegroundServiceModule(reactContext),
            ForegroundLaunchModule(reactContext),
            FocusDayBridgeModule(reactContext),
            SharedPrefsModule(reactContext),
            InstalledAppsModule(reactContext),
            BlockOverlayModule(reactContext),
            NuclearModeModule(reactContext),
            NetworkBlockModule(reactContext),
            AversionsModule(reactContext),
            GreyoutModule(reactContext),
            NativeImagePickerModule(reactContext),
            NativeFilePickerModule(reactContext),
            SessionPinModule(reactContext),
            TaskAlarmModule(reactContext),
        )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
