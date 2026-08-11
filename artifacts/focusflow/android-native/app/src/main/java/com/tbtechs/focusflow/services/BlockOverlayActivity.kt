package com.tbtechs.focusflow.services

import android.app.Activity
import android.app.WallpaperManager
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.tbtechs.focusflow.MainActivity
import org.json.JSONArray

/**
 * BlockOverlayActivity
 *
 * Full-screen blocking overlay launched the instant a blocked package is detected.
 * The overlay covers the entire screen (including status/nav bars), persists while
 * the session is active, and cannot be dismissed by the user until the accessibility
 * service has confirmed the blocked app is gone from the foreground.
 *
 * Dismissal flow:
 *   1. Overlay appears immediately when blocked app opens.
 *   2. AccessibilityService presses HOME — blocked app leaves foreground.
 *   3. On the next window event (launcher/home visible), the service writes
 *      overlay_x_ready = true in SharedPreferences.
 *   4. This activity polls prefs every 300 ms; when overlay_x_ready = true it
 *      fades in the ✕ button in the top-right corner.
 *   5. User taps ✕ → overlay finishes.  No navigation — they're already at home.
 *
 * Back button: intentionally swallowed — overlay cannot be dismissed by back press.
 * onPause re-raise: kept from the original for slow-device protection.
 *
 * SharedPrefs keys read:
 *   block_overlay_quote      — fixed quote string
 *   block_overlay_quotes     — JSON array of custom quotes
 *   block_overlay_wallpaper  — absolute path to background image
 *   overlay_x_ready          — Boolean set by AccessibilityService; cleared here on dismiss
 *   focus_active / standalone_block_active — used by re-raise guard
 */
class BlockOverlayActivity : Activity() {

    companion object {
        const val EXTRA_BLOCKED_PKG  = "blocked_pkg"
        const val EXTRA_BLOCKED_NAME = "blocked_name"

        /** Written by AccessibilityService after HOME press is confirmed. */
        const val PREF_OVERLAY_X_READY = "overlay_x_ready"
        private const val X_POLL_INTERVAL_MS = 300L

        /**
         * Specific FocusFlow activity class name suffixes that are allowed to be in
         * the foreground without triggering an overlay re-raise.
         *
         * Using the full package name as the only guard is a loophole: ANY activity
         * inside com.tbtechs.focusflow (custom tabs, deeplinks, WebViews, etc.) would
         * bypass the overlay. We only allow the real settings/main screen here.
         *
         * Add class name suffixes (not full names) so obfuscation-safe.
         */
        val TRUSTED_FOCUSFLOW_CLASSES: Set<String> = setOf(
            "MainActivity",
            "SettingsActivity",
            "FocusActivity",
            "ScheduleActivity",
            "StatsActivity"
        )


        private val DEFAULT_QUOTES = listOf(
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

    private lateinit var prefs: SharedPreferences
    private val handler = Handler(Looper.getMainLooper())
    private var blockedName: String = ""
    private var intentionalFinish = false

    // ✕ button — hidden until AccessibilityService confirms user is at home
    private lateinit var xButton: TextView
    private var xButtonRevealed = false

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (isFinishing || isDestroyed || xButtonRevealed) return
            if (prefs.getBoolean(PREF_OVERLAY_X_READY, false)) {
                revealXButton()
            } else {
                handler.postDelayed(this, X_POLL_INTERVAL_MS)
            }
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences(AppBlockerAccessibilityService.PREFS_NAME, MODE_PRIVATE)
        blockedName = intent?.getStringExtra(EXTRA_BLOCKED_NAME) ?: ""

        // Clear any stale x_ready flag from a previous session
        prefs.edit().putBoolean(PREF_OVERLAY_X_READY, false).apply()

        applyWindowFlags()
        buildUI()

        // Start polling — ✕ only appears once home is confirmed
        handler.postDelayed(pollRunnable, X_POLL_INTERVAL_MS)
    }

    override fun onNewIntent(intent: android.content.Intent?) {
        super.onNewIntent(intent)
        // singleTask re-use: just update the blocked name label if needed
        intent?.getStringExtra(EXTRA_BLOCKED_NAME)?.let { if (it.isNotEmpty()) blockedName = it }
    }

    // ─── Back button: fully swallowed — only ✕ can dismiss the overlay ─────────

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Intentionally do nothing — back is completely ignored
    }

    // ─── Power button: block power-off menu during session ────────────────────
    //
    // Intercepts the power key short-press so the screen-off / power menu cannot
    // be triggered while the overlay is on screen.
    // Note: The OS long-press power menu is handled at the system level; we also
    // watch for the GlobalActions dialog from the AccessibilityService and dismiss
    // it immediately there (see AppBlockerAccessibilityService.handleSystemUiBlock).

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_POWER) {
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_POWER) {
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    // ─── Notification bar: collapse when overlay loses focus ─────────────────
    //
    // If the user swipes down the notification / quick-settings panel, the
    // Activity momentarily loses window focus.  We immediately collapse the
    // status bar so the panel is never accessible during a blocking session.

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus && !intentionalFinish && !isFinishing) {
            collapseStatusBar()
        }
    }

    private fun collapseStatusBar() {
        try {
            @Suppress("WrongConstant")
            val sbService = getSystemService("statusbar") ?: return
            val sbClass = Class.forName("android.app.StatusBarManager")
            sbClass.getMethod("collapsePanels").invoke(sbService)
        } catch (_: Exception) {
            // Reflection may fail on some ROMs — silently ignore
        }
    }

    // ─── Re-raise guard ───────────────────────────────────────────────────────
    //
    // Home / recents / any system gesture will pause this activity but the
    // overlay must stay on screen until the user explicitly taps ✕.
    // We bring ourselves back to front after a short delay unless the user
    // already dismissed via ✕ (intentionalFinish = true).

    override fun onPause() {
        super.onPause()
        if (intentionalFinish || isFinishing) return

        val focusActive = prefs.getBoolean(AppBlockerAccessibilityService.PREF_FOCUS_ON, false)
        val saActive    = prefs.getBoolean(AppBlockerAccessibilityService.PREF_SA_ACTIVE, false)
        if (!focusActive && !saActive) return   // block session has ended — let it go

        // Do NOT re-raise the overlay if the user navigated to specific trusted
        // FocusFlow screens (e.g., the main Settings activity).  Checking only
        // packageName is too broad — any activity inside com.tbtechs.focusflow
        // (including deeplinks or future custom tabs) would bypass the overlay.
        // We instead check the specific class name of the current foreground window
        // as written by AppBlockerAccessibilityService into "current_foreground_cls".
        val currentFg = prefs.getString("current_foreground_pkg", "") ?: ""
        val currentCls = prefs.getString("current_foreground_cls", "") ?: ""
        val isTrustedFocusFlowScreen = currentFg == packageName &&
            TRUSTED_FOCUSFLOW_CLASSES.any { trusted -> currentCls.endsWith(trusted, ignoreCase = true) }
        if (isTrustedFocusFlowScreen) return

        handler.postDelayed({
            if (!isFinishing && !isDestroyed && !intentionalFinish) {
                // Re-check: still don't re-raise if a trusted FocusFlow screen is foreground.
                val fg  = prefs.getString("current_foreground_pkg", "") ?: ""
                val cls = prefs.getString("current_foreground_cls", "") ?: ""
                val trusted = fg == packageName &&
                    TRUSTED_FOCUSFLOW_CLASSES.any { cls.endsWith(it, ignoreCase = true) }
                if (trusted) return@postDelayed
                try {
                    val reRaise = android.content.Intent(
                        applicationContext, BlockOverlayActivity::class.java
                    ).apply {
                        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                                android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                        putExtra(EXTRA_BLOCKED_NAME, blockedName)
                    }
                    applicationContext.startActivity(reRaise)
                } catch (_: Exception) { }
            }
        }, 550L)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    // ─── Window flags ─────────────────────────────────────────────────────────

    private fun applyWindowFlags() {
        window.apply {
            addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_SECURE
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    // ─── UI construction ──────────────────────────────────────────────────────

    private fun buildUI() {
        // Built-in branded gradient: deep navy → dark indigo (FocusFlow brand)
        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.parseColor("#0C0C1A"),  // deep navy-black
                    Color.parseColor("#1A1245")   // dark indigo
                )
            )
        }

        // Background image layer: prefer user-set custom wallpaper; fall back to
        // the system (home screen) wallpaper so the overlay never shows a bare
        // gradient when the user hasn't picked a custom image.
        val wallpaperPath = prefs.getString("block_overlay_wallpaper", "") ?: ""
        if (wallpaperPath.isNotEmpty()) {
            // User has set a custom overlay image — use it at 82 % opacity so the
            // dark scrim below still keeps text readable.
            try {
                val bmp = if (wallpaperPath.startsWith("content://")) {
                    contentResolver.openInputStream(Uri.parse(wallpaperPath))?.use { BitmapFactory.decodeStream(it) }
                } else {
                    BitmapFactory.decodeFile(wallpaperPath.removePrefix("file://"))
                }
                if (bmp != null) {
                    root.addView(ImageView(this).apply {
                        layoutParams = FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                        )
                        setImageBitmap(bmp)
                        scaleType = ImageView.ScaleType.CENTER_CROP
                        alpha = 0.82f
                    })
                }
            } catch (_: Exception) { }
        } else {
            // No custom image — try to show the system (home screen) wallpaper so
            // the overlay still looks contextual.
            //
            // Android 13+ restricts READ_WALLPAPER_INTERNAL to system apps, so
            // WallpaperManager may return null on newer devices. We try three paths
            // in order: peekDrawable() → drawable → fallback gradient (already set).
            val wallpaperDrawable = resolveSystemWallpaper()
            if (wallpaperDrawable != null) {
                root.addView(ImageView(this).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                    setImageDrawable(wallpaperDrawable)
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    alpha = 0.82f
                })
            }
            // If both methods return null (Android 13+ permission restriction),
            // the branded gradient fallback set on `root` above is already in place.
        }

        // Dark scrim — keeps text legible regardless of background
        root.addView(View(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#AA0A0A1A"))
        })

        // Centered content column
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(80), dp(32), dp(80))
        }
        col.addView(buildLockEmoji())
        col.addView(buildBlockedLabel())
        col.addView(buildQuoteView())
        col.addView(buildSubLabel())
        root.addView(col)

        // ✕ button — top-right corner, starts invisible
        xButton = buildXButton()
        root.addView(xButton)

        setContentView(root)
    }

    private fun buildLockEmoji(): TextView = TextView(this).apply {
        text = "\uD83D\uDD12"
        textSize = 52f
        gravity = Gravity.CENTER
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(20) }
    }

    private fun buildBlockedLabel(): TextView = TextView(this).apply {
        text = if (blockedName.isNotEmpty()) "\u201C$blockedName\u201D is blocked" else "App Blocked"
        textSize = 15f
        setTextColor(Color.parseColor("#FF6B6B"))
        gravity = Gravity.CENTER
        letterSpacing = 0.12f
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(36) }
    }

    private fun buildQuoteView(): TextView = TextView(this).apply {
        text = "\u201C${resolveQuote()}\u201D"
        textSize = 20f
        setTextColor(Color.parseColor("#E8E8F0"))
        gravity = Gravity.CENTER
        setLineSpacing(0f, 1.55f)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(48) }
    }

    private fun buildSubLabel(): TextView = TextView(this).apply {
        text = "Stay focused. You\u2019ve got this."
        textSize = 13f
        setTextColor(Color.parseColor("#55556A"))
        gravity = Gravity.CENTER
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
    }

    /**
     * Corner ✕ button — starts invisible (alpha=0, not clickable).
     * Only revealed via [revealXButton] once the AccessibilityService confirms
     * the user has navigated home (PREF_OVERLAY_X_READY = true).
     */
    private fun buildXButton(): TextView = TextView(this).apply {
        text = "\u2715"    // ✕
        textSize = 20f
        setTextColor(Color.parseColor("#AAAACC"))
        gravity = Gravity.CENTER
        setPadding(dp(16), dp(16), dp(16), dp(16))
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#22222E"))
            setStroke(dp(1), Color.parseColor("#44445A"))
        }
        alpha = 0f
        isClickable = false
        isFocusable = false

        val size = dp(48)
        layoutParams = FrameLayout.LayoutParams(size, size).apply {
            gravity = Gravity.TOP or Gravity.END
            topMargin  = dp(56)
            rightMargin = dp(24)
        }
        setOnClickListener { dismissOverlay() }
    }

    // ─── X button reveal (runs after home confirmed) ──────────────────────────

    private fun revealXButton() {
        if (xButtonRevealed) return
        xButtonRevealed = true
        prefs.edit().putBoolean(PREF_OVERLAY_X_READY, false).apply()
        xButton.isClickable = true
        xButton.isFocusable = true
        android.animation.ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 400L
            addUpdateListener { xButton.alpha = it.animatedValue as Float }
            start()
        }
    }

    // ─── Dismissal ────────────────────────────────────────────────────────────

    private fun dismissOverlay() {
        intentionalFinish = true
        AversiveActionsManager.stopAll(applicationContext)
        prefs.edit()
            .putBoolean(PREF_OVERLAY_X_READY, false)
            // Tell the accessibility service to reset its cooldown so the next
            // open of the same blocked app is caught immediately (no 2 s gap).
            .putBoolean("block_cooldown_reset", true)
            .apply()
        finish()
    }

    // ─── Quote resolution ─────────────────────────────────────────────────────

    private fun resolveQuote(): String {
        val fixed = prefs.getString("block_overlay_quote", "") ?: ""
        if (fixed.isNotEmpty()) return fixed

        val customJson = prefs.getString("block_overlay_quotes", "") ?: ""
        val pool: List<String> = if (customJson.isNotEmpty()) {
            try {
                val arr = JSONArray(customJson)
                (0 until arr.length()).map { arr.getString(it) }.takeIf { it.isNotEmpty() }
                    ?: DEFAULT_QUOTES
            } catch (_: Exception) { DEFAULT_QUOTES }
        } else DEFAULT_QUOTES

        return pool.random()
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Attempts to retrieve the user's current home-screen wallpaper as a Drawable.
     *
     * Android 13+ (API 33) restricts READ_WALLPAPER_INTERNAL to system/privileged apps,
     * so both WallpaperManager methods may return null on those devices.  We try three
     * paths in order and return the first non-null result:
     *
     *   1. peekDrawable()  — returns a cached copy; no I/O, lower permission requirement.
     *   2. drawable        — the standard accessor; works on API ≤ 32 for regular apps.
     *   3. null            — let the caller fall back to the branded gradient.
     *
     * Both calls are wrapped individually so a SecurityException from one doesn't
     * prevent the other from running.
     */
    private fun resolveSystemWallpaper(): android.graphics.drawable.Drawable? {
        val wm = try { WallpaperManager.getInstance(this) } catch (_: Exception) { return null }

        // Path 1: peekDrawable — backed by a cached bitmap, may succeed where
        // getDrawable fails because it avoids the permission check on some ROMs.
        try {
            val peeked = wm.peekDrawable()
            if (peeked != null) return peeked
        } catch (_: Exception) { }

        // Path 2: getDrawable — standard path, works on Android ≤ 12.
        try {
            val drawn = wm.drawable
            if (drawn != null) return drawn
        } catch (_: Exception) { }

        // Path 3: give up — caller will use the branded gradient fallback.
        return null
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()
}
