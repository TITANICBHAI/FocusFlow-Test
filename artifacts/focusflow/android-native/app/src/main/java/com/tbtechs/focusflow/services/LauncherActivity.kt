package com.tbtechs.focusflow.services

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.components.*
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * LauncherActivity — FocusFlow's full home-screen replacement (Material 3).
 *
 * Layout (top → bottom):
 *   ┌─────────────────────────────────┐
 *   │  FocusAtAGlanceView             │  ← Digital clock / FocusTimerRing + date
 *   │                                 │
 *   │  HomeGridAdapter (RecyclerView) │  ← 4-col pinned apps grid
 *   │                                 │
 *   │  SmartDockView                  │  ← All Apps + Focus Slot + 3 pinned
 *   └─────────────────────────────────┘
 *
 * Swipe UP → opens AppDrawerFragment (Material 3 bottom sheet).
 * App drawer: search bar + alphabetical sections + 5-col grid.
 * Long-press home icon → Remove / Add to Dock / App Info.
 * Long-press dock icon → Remove from Dock / App Info.
 * Long-press empty space → Add Apps to Home Screen dialog.
 * Long-press drawer icon → Add to Home / Add to Dock / App Info.
 */
class LauncherActivity : Activity() {

    companion object {
        private const val PREFS_NAME            = AppBlockerAccessibilityService.PREFS_NAME
        private const val PREF_LAUNCHER_HIDDEN  = "launcher_hidden_packages"
        private const val PREF_LAUNCHER_PINNED  = "launcher_pinned_packages"
        private const val PREF_LAUNCHER_DOCK    = "launcher_dock_packages"
        private const val PREF_SA_ACTIVE        = AppBlockerAccessibilityService.PREF_SA_ACTIVE
        private const val PREF_SA_PKGS          = AppBlockerAccessibilityService.PREF_SA_PKGS
        private const val PREF_SA_UNTIL         = AppBlockerAccessibilityService.PREF_SA_UNTIL
        private const val PREF_ALWAYS_BLOCK     = AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK
        private const val PREF_ALWAYS_BLOCK_PKGS = AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK_PKGS
        private const val OWN_PACKAGE           = "com.tbtechs.focusflow"
    }

    private lateinit var prefs: SharedPreferences
    private val handler = Handler(Looper.getMainLooper())

    // Material 3 Components
    private lateinit var focusAtAGlanceView: FocusAtAGlanceView
    private lateinit var homeRecyclerView: RecyclerView
    private lateinit var homeGridAdapter: HomeGridAdapter
    private lateinit var smartDockView: SmartDockView
    private var drawerFragment: AppDrawerFragment? = null

    private var isDrawerOpen = false

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER)

        prefs = getSharedPreferences(AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)

        // Apply Material 3 theme
        setTheme(R.style.Theme_FocusFlow_Launcher)

        buildHomeLayout()
    }

    override fun onResume() {
        super.onResume()
        refreshHomeGrid()
        smartDockView.refreshDock()
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (drawerFragment?.isAdded == true) {
            drawerFragment?.dismiss()
        }
        // Intentionally swallow back — no parent activity on home screen
    }

    // ── Home layout ───────────────────────────────────────────────────────────

    private fun buildHomeLayout() {
        window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER)

        val rootFrame = FrameLayout(this)
        setContentView(rootFrame)

        // ── Wallpaper scrim (20% black) ──
        val scrim = View(this).apply {
            setBackgroundColor(ContextCompat.getColor(this, R.color.scrim_light))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootFrame.addView(scrim)

        // ── Bottom gradient for dock readability ──
        val bottomGrad = View(this).apply {
            background = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.TRANSPARENT, Color.parseColor("#CC000000"))
            )
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, dp(280)
            ).also { gravity = Gravity.BOTTOM }
        }
        rootFrame.addView(bottomGrad)

        // Root column
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        // ── FocusAtAGlanceView (Digital clock + FocusTimerRing + Date) ──
        focusAtAGlanceView = FocusAtAGlanceView(this)
        val focusParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).also {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(48)
        }
        column.addView(focusAtAGlanceView, focusParams)

        // ── Home screen grid (RecyclerView with GridLayoutManager) ──
        val gridScroll = android.widget.ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
            )
            isVerticalScrollBarEnabled = false
        }

        homeRecyclerView = RecyclerView(this).apply {
            layoutManager = GridLayoutManager(this, 4)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(12), dp(16), dp(12), dp(16))
            isNestedScrollingEnabled = false
        }
        gridScroll.addView(homeRecyclerView)

        // Long-press on scroll area (empty space) → add apps dialog
        gridScroll.setOnLongClickListener {
            showAddToHomeDialog()
            true
        }

        column.addView(gridScroll)

        // SmartDockView (All Apps + Focus Slot + 3 Pinned)
        smartDockView = SmartDockView(this)
        smartDockView.setOnAllAppsClick { openDrawer() }
        smartDockView.setOnFocusSlotClick { /* Focus slot click - could open focus settings */ }
        smartDockView.setOnPinnedAppClick { pkg ->
            if (isPackageBlocked(pkg)) {
                launchBlockOverlay(pkg)
            } else {
                launchApp(pkg)
            }
        }
        smartDockView.setOnPinnedAppLongClick { pkg, label ->
            showDockIconMenu(pkg, label)
        }

        column.addView(smartDockView)

        // Add column to rootFrame
        rootFrame.addView(column)

        // Gestures: swipe-up → drawer, swipe-down → notifications
        rootFrame.setOnTouchListener { _, ev ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN -> {
                    swipeTouchStartY = ev.rawY
                    false
                }
                MotionEvent.ACTION_UP -> {
                    val dy = swipeTouchStartY - ev.rawY
                    when {
                        dy > dp(60) && !isDrawerOpen -> { openDrawer(); true }
                        dy < -dp(80) -> { expandNotificationsPanel(); true }
                        else -> false
                    }
                }
                else -> false
            }
        }
    }

    // ── Refresh home grid ──────────────────────────────────────────────────────

    private fun refreshHomeGrid() {
        val pinnedJson = prefs.getString("launcher_pinned_packages", "[]") ?: "[]"
        val pinned = parseJsonArray(pinnedJson)
        val blocked = FocusRuleEngine(this).getBlockedPackages()

        homeGridAdapter = HomeGridAdapter(
            context = this,
            pinnedPackages = pinned,
            blockedPackages = blocked,
            onAppClick = { pkg ->
                if (isPackageBlocked(pkg)) {
                    launchBlockOverlay(pkg)
                } else {
                    launchApp(pkg)
                }
            },
            onAppLongClick = { pkg, label ->
                showHomeIconMenu(pkg, label)
            }
        )
        homeRecyclerView.adapter = homeGridAdapter
    }

    // ── SmartDockView is self-contained, just call refresh ─────────────────────

    private fun refreshDock() {
        smartDockView.refreshDock()
    }

    // ── App Drawer (Material 3 BottomSheetDialogFragment) ──────────────────────

    private fun openDrawer() {
        if (drawerFragment?.isAdded == true) return

        drawerFragment = AppDrawerFragment.newInstance()
        drawerFragment.setOnAppClickListener { pkg ->
            if (isPackageBlocked(pkg)) {
                launchBlockOverlay(pkg)
            } else {
                launchApp(pkg)
            }
            drawerFragment?.dismiss()
        }
        drawerFragment.setOnAppLongClickListener { pkg, label ->
            showDrawerIconMenu(pkg, label)
        }

        drawerFragment?.show(supportFragmentManager, "app_drawer")
    }

    private fun Int.dpToPx(): Int = (this * resources.displayMetrics.density + 0.5f).toInt()

    // ── Blocked package check (delegates to FocusRuleEngine) ──────────────────

    private fun isPackageBlocked(pkg: String): Boolean {
        return FocusRuleEngine(this).isPackageBlocked(pkg)
    }

    // ── Launch helpers ────────────────────────────────────────────────────────

    private fun launchApp(pkg: String) {
        val intent = packageManager.getLaunchIntentForPackage(pkg)
        intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        intent?.let { startActivity(it) }
    }

    private fun launchBlockOverlay(pkg: String) {
        val intent = Intent(this, BlockOverlayActivity::class.java).apply {
            putExtra(BlockOverlayActivity.EXTRA_BLOCKED_PKG, pkg)
            val pm = packageManager
            val label = try {
                pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
            } catch (e: Exception) {
                pkg
            }
            putExtra(BlockOverlayActivity.EXTRA_BLOCKED_NAME, label)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(intent)
    }

    private fun expandNotificationsPanel() {
        try {
            val sbService = getSystemService("statusbar")
            val sbClass = Class.forName("android.app.StatusBarManager")
            sbClass.getMethod("collapsePanels").invoke(sbService)
        } catch (_: Exception) {}
    }

    // ── Long-press context menus ───────────────────────────────────────────────

    private fun showHomeIconMenu(pkg: String, label: String) {
        AlertDialog.Builder(this)
            .setTitle(label)
            .setItems(arrayOf("Remove from Home", "Add to Dock", "App Info")) { _, which ->
                when (which) {
                    0 -> removeFromHome(pkg)
                    1 -> addToDock(pkg)
                    2 -> openAppInfo(pkg)
                }
            }
            .create()
            .show()
    }

    private fun showDockIconMenu(pkg: String, label: String) {
        AlertDialog.Builder(this)
            .setTitle(label)
            .setItems(arrayOf("Remove from Dock", "App Info")) { _, which ->
                when (which) {
                    0 -> removeFromDock(pkg)
                    1 -> openAppInfo(pkg)
                }
            }
            .create()
            .show()
    }

    private fun showDrawerIconMenu(pkg: String, label: String) {
        AlertDialog.Builder(this)
            .setTitle(label)
            .setItems(arrayOf("Add to Home Screen", "Add to Dock", "App Info")) { _, which ->
                when (which) {
                    0 -> addToHome(pkg)
                    1 -> addToDock(pkg)
                    2 -> openAppInfo(pkg)
                }
            }
            .create()
            .show()
    }

    private fun showAddToHomeDialog() {
        val pm = packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(intent, 0)
            .filter { it.activityInfo.packageName != "com.tbtechs.focusflow" }
            .sortedBy { pm.getApplicationLabel(it.activityInfo.applicationInfo).toString() }

        val names = apps.map {
            pm.getApplicationLabel(it.activityInfo.applicationInfo).toString()
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Add to Home Screen")
            .setItems(names) { _, idx ->
                addToHome(apps[idx].activityInfo.packageName)
            }
            .create()
            .show()
    }

    // ── Home / Dock management ─────────────────────────────────────────────────

    private fun addToHome(pkg: String) {
        val json = prefs.getString("launcher_pinned_packages", "[]") ?: "[]"
        val current = parseJsonArray(json).toMutableList()
        if (!current.contains(pkg)) {
            current.add(pkg)
            saveJsonArray("launcher_pinned_packages", current)
            refreshHomeGrid()
        }
    }

    private fun removeFromHome(pkg: String) {
        val json = prefs.getString("launcher_pinned_packages", "[]") ?: "[]"
        val updated = parseJsonArray(json).filter { it != pkg }
        saveJsonArray("launcher_pinned_packages", updated)
        refreshHomeGrid()
    }

    private fun addToDock(pkg: String) {
        val json = prefs.getString("launcher_dock_packages", "[]") ?: "[]"
        val current = parseJsonArray(json).toMutableList()
        if (!current.contains(pkg) && current.size < 3) {
            current.add(pkg)
            saveJsonArray("launcher_dock_packages", current)
            smartDockView.refreshDock()
        } else if (current.size >= 3) {
            AlertDialog.Builder(this)
                .setTitle("Dock is full")
                .setMessage("Remove an existing dock app first (long-press it on the home screen).")
                .setPositiveButton("OK", null)
                .show()
        }
    }

    private fun removeFromDock(pkg: String) {
        val json = prefs.getString("launcher_dock_packages", "[]") ?: "[]"
        val updated = parseJsonArray(json).filter { it != pkg }
        saveJsonArray("launcher_dock_packages", updated)
        smartDockView.refreshDock()
    }

    private fun openAppInfo(pkg: String) {
        val i = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = android.net.Uri.parse("package:$pkg")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try { startActivity(i) } catch (_: Exception) {}
    }

    // ── JSON helpers ──────────────────────────────────────────────────────────

    private fun parseJsonArray(json: String): List<String> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (e: Exception) { emptyList() }
    }

    private fun saveJsonArray(key: String, list: List<String>) {
        val arr = JSONArray(list)
        prefs.edit().putString(key, arr.toString()).apply()
    }

    // ── Allowance strip removed (integrated into app icons) ────────────────────

    // ── Analog clock (kept for backward compatibility) ────────────────────────
    // Note: FocusAtAGlanceView handles clock display. AnalogClockView kept for backward compat.
    private inner class AnalogClockView(context: Context) : View(context) {
        private val hourPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = 4f
            strokeCap = Paint.Cap.ROUND
        }
        private val minutePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = 3f
            strokeCap = Paint.Cap.ROUND
        }
        private val secondPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#FF6B6B")
            strokeWidth = 2f
            strokeCap = Paint.Cap.ROUND
        }
        private val tickPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#88FFFFFF")
            strokeWidth = 1.5f
        }
        private val centerDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
        }

        override fun onDraw(canvas: Canvas) {
            val w = width.toFloat()
            val h = height.toFloat()
            val cx = w / 2f
            val cy = h / 2f
            val radius = (w.min(h) / 2f) * 0.88f

            val now = Date()
            val cal = java.util.Calendar.getInstance()
            cal.time = now

            val hours = (cal.get(java.util.Calendar.HOUR) + cal.get(java.util.Calendar.MINUTE) / 60f) * 30f
            val minutes = (cal.get(java.util.Calendar.MINUTE) + cal.get(java.util.Calendar.SECOND) / 60f) * 6f
            val seconds = (cal.get(java.util.Calendar.SECOND) + cal.get(java.util.Calendar.MILLISECOND) / 1000f) * 6f

            // Ticks
            for (i in 0..11) {
                val angle = i * 30f - 90f
                val inner = radius - 12.dpToPx()
                val outer = radius
                val x1 = cx + inner * kotlin.math.cos(Math.toRadians(angle))
                val y1 = cy + inner * kotlin.math.sin(Math.toRadians(angle))
                val x2 = cx + outer * kotlin.math.cos(Math.toRadians(angle))
                val y2 = cy + outer * kotlin.math.sin(Math.toRadians(angle))
                canvas.drawLine(x1, y1, x2, y2, tickPaint)
            }

            // Hour hand
            val hx = cx + (radius * 0.5f) * kotlin.math.cos(Math.toRadians(hours - 90f))
            val hy = cy + (radius * 0.5f) * kotlin.math.sin(Math.toRadians(hours - 90f))
            canvas.drawLine(cx, cy, hx, hy, hourPaint)

            // Minute hand
            val mx = cx + (radius * 0.75f) * kotlin.math.cos(Math.toRadians(minutes - 90f))
            val my = cy + (radius * 0.75f) * kotlin.math.sin(Math.toRadians(minutes - 90f))
            canvas.drawLine(cx, cy, mx, my, minutePaint)

            // Second hand
            val sx = cx + (radius * 0.88f) * kotlin.math.cos(Math.toRadians(seconds - 90f))
            val sy = cy + (radius * 0.88f) * kotlin.math.sin(Math.toRadians(seconds - 90f))
            canvas.drawLine(cx, cy, sx, sy, secondPaint)

            // Center dot
            canvas.drawCircle(cx, cy, 6.dpToPx(), centerDotPaint)
        }

        private fun Int.dpToPx(): Int = (this * resources.displayMetrics.density + 0.5f).toInt()
    }
}