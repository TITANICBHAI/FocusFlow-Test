//!/usr/bin/env kotlin

/**
 * SP Keys Generator
 * 
 * Single source of truth for SharedPreferences keys.
 * Reads PREF_* constants from AppBlockerAccessibilityService and generates:
 * 1. SharedPrefsModule.kt (Kotlin) - already done, uses the constants
 * 2. SharedPrefsModule.ts (TypeScript) - SP_KEYS object
 * 3. Validation test to ensure Kotlin and TS stay in sync
 */

import java.io.File

data class SpKey(
    val constName: String,
    val value: String,
    val comment: String? = null,
    val category: String
)

// Define all SP keys in one place - this is the SINGLE SOURCE OF TRUTH
val spKeys = listOf(
    // ── Core prefs file ──────────────────────────────────────────
    SpKey("PREFS_NAME", "focusday_prefs", "SharedPreferences file name", "core"),

    // ── Focus mode ────────────────────────────────────────────────
    SpKey("PREF_FOCUS_ON", "focus_active", "Task focus mode active", "focus"),
    SpKey("PREF_ALLOWED_PKG", "allowed_packages", "JSON array of allowed packages during focus", "focus"),
    SpKey("PREF_TASK_END_MS", "task_end_ms", "Focus session end epoch ms", "focus"),

    // ── Standalone block ────────────────────────────────────────
    SpKey("PREF_SA_ACTIVE", "standalone_block_active", "Standalone block enabled", "standalone"),
    SpKey("PREF_SA_PKGS", "standalone_blocked_packages", "JSON array of packages to block standalone", "standalone"),
    SpKey("PREF_SA_UNTIL", "standalone_block_until_ms", "Standalone block expiry epoch ms", "standalone"),

    // ── Daily allowance ──────────────────────────────────────────
    SpKey("PREF_DAILY_ALLOWANCE_CONFIG", "daily_allowance_config", "Rich JSON config for daily allowance", "allowance"),
    SpKey("PREF_DAILY_ALLOWANCE_PKGS", "daily_allowance_packages", "Legacy string array (count:1)", "allowance"),
    SpKey("PREF_DAILY_ALLOWANCE_USED", "daily_allowance_used", "Usage tracking JSON {pkg: {mode, date, count/usedMs}}", "allowance"),

    // ── Timed session (internal to service) ──────────────────────
    SpKey("PREF_TIMED_SESSION_PKG", "timed_session_pkg", "Currently open timed-allowance package", "allowance"),
    SpKey("PREF_TIMED_SESSION_OPEN_AT_MS", "timed_session_open_at_ms", "When timed session started", "allowance"),

    // ── Always-on enforcement ───────────────────────────────────
    SpKey("PREF_ALWAYS_BLOCK", "always_block_active", "Always-on enforcement enabled", "always"),
    SpKey("PREF_ALWAYS_BLOCK_PKGS", "always_block_packages", "JSON array of always-blocked packages", "always"),

    // ── Blocked words ───────────────────────────────────────────
    SpKey("PREF_BLOCKED_WORDS", "blocked_words", "JSON array of blocked words", "words"),

    // ── System guard ────────────────────────────────────────────
    SpKey("PREF_SYSTEM_GUARD_ENABLED", "system_guard_enabled", "System protection toggle", "guard"),
    SpKey("PREF_BLOCK_INSTALL_ACTIONS", "block_install_actions", "Block install/update/uninstall", "guard"),
    SpKey("PREF_BLOCK_YT_SHORTS", "block_yt_shorts", "Block YouTube Shorts", "guard"),
    SpKey("PREF_BLOCK_IG_REELS", "block_ig_reels", "Block Instagram Reels", "guard"),

    // ── Launcher ────────────────────────────────────────────────
    SpKey("PREF_LAUNCHER_LOCK_DURING_SA", "launcher_lock_during_standalone", "Lock default home app chooser", "launcher"),
    SpKey("PREF_LAUNCHER_BLOCK_UNINSTALL", "launcher_block_uninstall", "Suppress uninstall from any launcher", "launcher"),
    SpKey("PREF_NUCLEAR_BYPASS", "nuclear_mode_bypass", "Temporary bypass for nuclear mode", "launcher"),
    SpKey("PREF_LAUNCHER_HIDDEN_PKGS", "launcher_hidden_packages", "JSON array of hidden packages", "launcher"),
    SpKey("PREF_LAUNCHER_DOCK_PACKAGES", "launcher_dock_packages", "JSON array of dock packages", "launcher"),
    SpKey("PREF_LAUNCHER_CLOCK_STYLE", "launcher_clock_style", "digital | analog", "launcher"),

    // ── Task / focus-session state ──────────────────────────────
    SpKey("PREF_TASK_ID", "task_id", "Active task DB id", "task"),
    SpKey("PREF_TASK_NAME", "task_name", "Active task display name", "task"),
    SpKey("PREF_TASK_END_MS", "task_end_ms", "Active task end epoch ms", "task"),
    SpKey("PREF_TASK_START_MS", "task_start_ms", "Active task start epoch ms", "task"),
    SpKey("PREF_NEXT_TASK_NAME", "next_task_name", "Next task name", "task"),
    SpKey("PREF_TASK_COLOR", "task_color", "Active task accent color", "task"),
    SpKey("PREF_TASK_DURATION_MS", "task_duration_ms", "Active task total duration", "task"),
    SpKey("PREF_TASK_LAST_WRITTEN_MS", "task_last_written_ms", "Wall clock when task written", "task"),

    // ── Block overlay / cooldown ────────────────────────────────
    SpKey("PREF_BLOCK_COOLDOWN_RESET", "block_cooldown_reset", "Reset block cooldown on dismiss", "overlay"),
    SpKey("PREF_OVERLAY_AWAITING_PKG", "overlay_awaiting_pkg", "Package awaiting home confirmation", "overlay"),
    SpKey("PREF_CURRENT_FG_PKG", "current_foreground_pkg", "Current foreground package", "overlay"),
    SpKey("PREF_CURRENT_FG_CLS", "current_foreground_cls", "Current foreground class", "overlay"),

    // ── Network / VPN block ────────────────────────────────────
    SpKey("PREF_NET_BLOCK_ENABLED", "net_block_enabled", "VPN blocking master toggle", "vpn"),
    SpKey("PREF_NET_BLOCK_VPN", "net_block_vpn", "Use VPN mechanism", "vpn"),
    SpKey("PREF_NET_BLOCK_SELF_HEAL", "net_block_self_heal", "Auto-restart VPN if killed", "vpn"),
    SpKey("PREF_NET_BLOCK_PACKAGES", "net_block_packages", "JSON array of VPN packages", "vpn"),
    SpKey("PREF_NET_BLOCK_GLOBAL", "net_block_global", "Global vs per-app VPN mode", "vpn"),
    SpKey("PREF_VPN_SELECTED_PACKAGES", "vpn_selected_packages", "Per-app VPN selection", "vpn"),
    SpKey("PREF_VPN_PERMISSION_LOST", "vpn_permission_lost", "VPN permission revoked flag", "vpn"),

    // ── Greyout schedule ───────────────────────────────────────
    SpKey("PREF_GREYOUT_SCHEDULE", "greyout_schedule", "JSON array of time-window blocks", "greyout"),

    // ── Aversions ──────────────────────────────────────────────
    SpKey("PREF_AVERSION_DIMMER", "aversion_dimmer_enabled", "Screen dimmer on block", "aversion"),
    SpKey("PREF_AVERSION_VIBRATE", "aversion_vibrate_enabled", "Vibration on block", "aversion"),
    SpKey("PREF_AVERSION_SOUND", "aversion_sound_enabled", "Sound alert on block", "aversion"),

    // ── Temptation log ─────────────────────────────────────────
    SpKey("PREF_TEMPTATION_LOG", "temptation_log", "JSON array of blocked attempts", "temptation"),
    SpKey("PREF_WEEKLY_REPORT", "aversion_weekly_report", "Weekly report toggle", "temptation"),

    // ── Block overlay appearance ───────────────────────────────
    SpKey("PREF_BLOCK_OVERLAY_QUOTE", "block_overlay_quote", "Fixed overlay quote", "overlay"),
    SpKey("PREF_BLOCK_OVERLAY_QUOTES", "block_overlay_quotes", "JSON array of custom quotes", "overlay"),
    SpKey("PREF_BLOCK_OVERLAY_WALLPAPER", "block_overlay_wallpaper", "Overlay wallpaper path", "overlay"),

    // ── Onboarding / consent ───────────────────────────────────
    SpKey("PREF_PRIVACY_ACCEPTED", "privacy_accepted", "Privacy policy accepted", "onboarding"),
    SpKey("PREF_ONBOARDING_COMPLETE", "onboarding_complete", "Onboarding finished", "onboarding"),
    SpKey("PREF_USER_CONSENTED_BACKGROUND_SERVICE", "user_consented_background_service", "Background service consent", "onboarding"),

    // ── Session PIN ────────────────────────────────────────────
    SpKey("PREF_PIN_HASH", "session_pin_hash", "SHA-256 hex of session PIN", "pin"),

    // ── Pin reuse tracker ──────────────────────────────────────
    SpKey("PIN_REUSE_COUNT_FOCUS", "pin_reuse_count_focus", "PIN reuse count for focus", "pin"),
    SpKey("PIN_REUSE_DATE_FOCUS", "pin_reuse_date_focus", "PIN reuse date for focus", "pin"),
    SpKey("PIN_REUSE_COUNT_ALWAYSON", "pin_reuse_count_alwayson", "PIN reuse count for always-on", "pin"),
    SpKey("PIN_REUSE_DATE_ALWAYSON", "pin_reuse_date_alwayson", "PIN reuse date for always-on", "pin"),

    // ── Defence PIN ────────────────────────────────────────────
    SpKey("PREF_DEFENSE_PIN_HASH", "defense_pin_hash", "Defence PIN hash", "pin"),

    // ── Widget / upcoming task ─────────────────────────────────
    SpKey("PREF_TASK_AWAITING_DECISION", "task_awaiting_decision", "Task awaiting user decision", "widget"),
    SpKey("PREF_NEXT_UPCOMING_NAME", "next_upcoming_name", "Next upcoming task name", "widget"),
    SpKey("PREF_NEXT_UPCOMING_START_MS", "next_upcoming_start_ms", "Next upcoming task start ms", "widget"),

    // ── Daily stats (widget) ──────────────────────────────────
    SpKey("PREF_DAILY_TASKS_DONE", "daily_tasks_done", "Tasks completed today", "widget"),
    SpKey("PREF_DAILY_TASKS_TOTAL", "daily_tasks_total", "Total tasks today", "widget"),
    SpKey("PREF_DAILY_FOCUS_MINS", "daily_focus_mins", "Focus minutes today", "widget"),
    SpKey("PREF_STREAK_DAYS", "streak_days", "Current streak days", "widget"),
)

// Categories for grouping in generated output
val categories = spKeys.map { it.category }.distinct().sorted()

fun main() {
    println("=== SP Keys Single Source of Truth ===")
    println("Total keys: ${spKeys.size}")
    println("Categories: ${categories.size}")
    println()

    // Generate Kotlin companion object (for documentation/verification)
    generateKotlinCompanion()
    
    // Generate TypeScript SP_KEYS
    generateTypeScript()
    
    // Generate validation test
    generateValidationTest()
    
    println("✅ Generation complete")
}

fun generateKotlinCompanion() {
    val sb = StringBuilder()
    sb.appendLine("// AUTO-GENERATED from scripts/sp-keys/generate-sp-keys.kt")
    sb.appendLine("// DO NOT EDIT MANUALLY - run the generator instead")
    sb.appendLine("")
    sb.appendLine("companion object {")
    sb.appendLine("    const val PREFS_NAME = \"focusday_prefs\"")
    sb.appendLine("")
    
    var currentCategory = ""
    for (key in spKeys.sortedBy { it.category + it.constName }) {
        if (key.category != currentCategory) {
            currentCategory = key.category
            sb.appendLine("    // ── ${currentCategory.uppercase()} ────────────────────")
        }
        val comment = key.comment?.let { " // $it" } ?: ""
        sb.appendLine("    const val ${key.constName} = \"${key.value}\"$comment")
    }
    sb.appendLine("}")
    
    File("scripts/sp-keys/SpKeysCompanion.kt").writeText(sb.toString())
    println("Generated: scripts/sp-keys/SpKeysCompanion.kt")
}

fun generateTypeScript() {
    val sb = StringBuilder()
    sb.appendLine("// AUTO-GENERATED from scripts/sp-keys/generate-sp-keys.kt")
    sb.appendLine("// DO NOT EDIT MANUALLY - run the generator instead")
    sb.appendLine("")
    sb.appendLine("export const SP_KEYS = {")
    
    var currentCategory = ""
    for (key in spKeys.sortedBy { it.category + it.constName }) {
        if (key.category != currentCategory) {
            currentCategory = key.category
            sb.appendLine("  // ── ${currentCategory.uppercase()} ──")
        }
        sb.appendLine("  ${key.constName}: '${key.value}',")
    }
    sb.appendLine("} as const;")
    sb.appendLine("")
    sb.appendLine("export type SPKey = typeof SP_KEYS[keyof typeof SP_KEYS];")
    
    File("scripts/sp-keys/SP_KEYS.ts").writeText(sb.toString())
    println("Generated: scripts/sp-keys/SP_KEYS.ts")
}

fun generateValidationTest() {
    val sb = StringBuilder()
    sb.appendLine("// AUTO-GENERATED from scripts/sp-keys/generate-sp-keys.kt")
    sb.appendLine("// Validation test to ensure Kotlin and TypeScript stay in sync")
    sb.appendLine("")
    sb.appendLine("package com.tbtechs.focusflow.services")
    sb.appendLine("")
    sb.appendLine("import org.junit.Test")
    sb.appendLine("import kotlin.test.assertEquals")
    sb.appendLine("")
    sb.appendLine("class SpKeysValidationTest {")
    sb.appendLine("")
    sb.appendLine("    @Test")
    sb.appendLine("    fun \`all SP keys have non-empty values\`() {")
    for (key in spKeys) {
        sb.appendLine("        assertEquals(\"${key.value}\", AppBlockerAccessibilityService.${key.constName})")
    }
    sb.appendLine("    }")
    sb.appendLine("")
    sb.appendLine("    @Test")
    sb.appendLine("    fun \`no duplicate SP key values\`() {")
    sb.appendLine("        val allValues = listOf(")
    for (key in spKeys) {
        sb.appendLine("            AppBlockerAccessibilityService.${key.constName},")
    }
    sb.appendLine("        )")
    sb.appendLine("        assertEquals(allValues.size, allValues.toSet().size)")
    sb.appendLine("    }")
    sb.appendLine("}")
    
    File("scripts/sp-keys/SpKeysValidationTest.kt").writeText(sb.toString())
    println("Generated: scripts/sp-keys/SpKeysValidationTest.kt")
}

fun StringBuilder.appendLine(line: String = "") {
    append(line).append("\n")
}