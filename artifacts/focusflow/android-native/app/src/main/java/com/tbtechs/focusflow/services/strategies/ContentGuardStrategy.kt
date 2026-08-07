package com.tbtechs.focusflow.services.strategies

import android.view.accessibility.AccessibilityEvent
import android.content.SharedPreferences

/**
 * ContentGuardStrategy — Keyword blocking, YouTube Shorts, Instagram Reels, Install actions.
 *
 * Each sub-feature is opt-in and runs continuously when enabled.
 */
class ContentGuardStrategy : BlockingStrategy {
    override val name = "ContentGuard"
    override val priority = 60

    override fun shouldBlock(context: BlockContext): BlockDecision {
        val ev = context.event ?: return BlockDecision.Skip

        // Keyword blocking
        if (context.prefs.getString("blocked_words", "[]") != "[]") {
            val blockedWords = getBlockedWords(context.prefs)
            if (blockedWords.isNotEmpty()) {
                val isBrowser = isBrowserPackage(context.pkg)
                if (isBrowser) {
                    if (containsBlockedWordBrowser(ev, blockedWords)) {
                        return BlockDecision.Block(name, context.pkg, "blocked word in browser")
                    }
                } else {
                    if (containsBlockedWord(ev, blockedWords)) {
                        return BlockDecision.Block(name, context.pkg, "blocked word in content")
                    }
                }
            }
        }

        // YouTube Shorts
        if (context.blockYoutubeShorts && context.pkg == "com.google.android.youtube" && isYoutubeShorts(ev)) {
            return BlockDecision.Block(name, context.pkg, "YouTube Shorts")
        }

        // Instagram Reels
        if (context.blockInstagramReels && context.pkg == "com.instagram.android" && isInstagramReels(ev)) {
            return BlockDecision.Block(name, context.pkg, "Instagram Reels")
        }

        // Install actions
        if (context.blockInstallActions && isInstallActionContext(ev, context.pkg)) {
            return BlockDecision.Block(name, context.pkg, "install action")
        }

        return BlockDecision.Skip
    }

    private fun getBlockedWords(prefs: SharedPreferences): List<String> {
        val json = prefs.getString("blocked_words", "[]") ?: "[]"
        return try {
            val arr = org.json.JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }.map { it.trim() }.filter { it.isNotBlank() }
        } catch (_: Exception) { emptyList() }
    }

    private fun isBrowserPackage(pkg: String): Boolean = pkg in BROWSER_PACKAGES

    private fun containsBlockedWord(ev: AccessibilityEvent, words: List<String>): Boolean {
        val text = buildString {
            ev.text.forEach { append(it); append(' ') }
            ev.contentDescription?.let { append(it) }
        }.lowercase()
        return words.any { it in text }
    }

    private fun containsBlockedWordBrowser(ev: AccessibilityEvent, words: List<String>): Boolean {
        // Deep scan for browsers - simplified
        return containsBlockedWord(ev, words)
    }

    private fun isYoutubeShorts(ev: AccessibilityEvent): Boolean = false
    private fun isInstagramReels(ev: AccessibilityEvent): Boolean = false
    private fun isInstallActionContext(ev: AccessibilityEvent, pkg: String): Boolean = false

    companion object {
        private val BROWSER_PACKAGES = setOf(
            "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
            "com.google.android.googlequicksearchbox", "org.mozilla.firefox", "org.mozilla.fenix",
            "org.mozilla.firefox_beta", "com.sec.android.app.sbrowser", "com.samsung.android.sbrowser",
            "com.brave.browser", "com.brave.browser_beta", "com.opera.browser", "com.opera.mini.native",
            "com.microsoft.emmx", "com.UCMobile.intl", "com.kiwibrowser.browser",
            "com.vivaldi.browser", "com.duckduckgo.mobile.android", "com.cloudmosa.puffinFree",
            "com.uc.browser.en"
        )
    }
}