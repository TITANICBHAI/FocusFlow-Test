package com.tbtechs.focusflow.services

import android.app.Activity
import android.app.AlertDialog
import android.app.WallpaperManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
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
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * LauncherActivity — FocusFlow's full home-screen replacement.
 *
 * Layout (top → bottom):
 *   ┌─────────────────────────────────┐
 *   │  Date (small, muted)            │
 *   │  Clock (large, bold)            │
 *   │  AM/PM + day-of-week            │
 *   │                                 │
 *   │  ┌── Home screen grid ───────┐  │
 *   │  │  4-column icon grid of    │  │
 *   │  │  home-screen shortcuts    │  │
 *   │  └───────────────────────────┘  │
 *   │                                 │
 *   │  ─── ─── ─── (divider) ─── ─── │
 *   │  [ dock: up to 5 apps ]         │
 *   └─────────────────────────────────┘
 *
 * Swipe UP → opens full-screen app drawer (bottom-sheet style, animated).
 * App drawer has: search bar + alphabetical sections + 5-column grid.
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

        private val ACCENT       = Color.parseColor("#6366f1")
        // Scrim: 20% black — wallpaper shows through naturally.
        // The dock area gets its own darker gradient so icons stay readable.
        private val SCRIM_COLOR  = Color.parseColor("#33000000")
        private val DRAWER_BG    = Color.parseColor("#F0111827")
        private val TEXT_DIM     = Color.parseColor("#EEF0FF")
        private val TEXT_MUTED   = Color.parseColor("#99AABB")
        private val DOCK_SURFACE = Color.parseColor("#28FFFFFF")  // frosted glass tint
    }

    private data class AllowanceCardData(
        val pkg: String,
        val label: String,
        val icon: android.graphics.drawable.Drawable?,
        val used: Long,
        val total: Long,
        val remaining: Long,
        val mode: String,
        val displayText: String,
        val fraction: Float,
    )

    private lateinit var prefs: SharedPreferences
    private val handler = Handler(Looper.getMainLooper())
    private var clockRunnable: Runnable? = null

    private lateinit var rootFrame: FrameLayout
    private var clockView: TextView? = null
    private var ampmView: TextView? = null
    private var dateView: TextView? = null
    private var analogClockView: AnalogClockView? = null
    private var digitalTimeRow: LinearLayout? = null
    private var allowanceStripContainer: LinearLayout? = null
    private var allowanceTickCount = 0
    private var homeGrid: GridLayout? = null
    private var dockRow: LinearLayout? = null
    private var drawerOverlay: FrameLayout? = null
    private var isDrawerOpen = false
    private var swipeTouchStartY = 0f

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER)
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        rootFrame = FrameLayout(this)
        setContentView(rootFrame)

        buildHomeLayout()
        startClock()
    }

    override fun onResume() {
        super.onResume()
        refreshHomeGrid()
        refreshDock()
        refreshAllowanceStrip()
    }

    override fun onDestroy() {
        super.onDestroy()
        clockRunnable?.let { handler.removeCallbacks(it) }
    }

    override fun onBackPressed() {
        if (isDrawerOpen) closeDrawer()
        // Intentionally swallow back — no parent activity on home screen
    }

    // ── Home layout ───────────────────────────────────────────────────────────

    private fun buildHomeLayout() {
        // Wallpaper scrim — light translucent overlay (20% black) so the user's
        // wallpaper stays visible. FLAG_SHOW_WALLPAPER composites it behind the window.
        val scrim = View(this).apply {
            setBackgroundColor(SCRIM_COLOR)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootFrame.addView(scrim)

        // Bottom gradient — transparent → 60% black over the bottom 280dp.
        // This makes the dock and clock text readable without killing the wallpaper.
        val bottomGrad = View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.TRANSPARENT, Color.parseColor("#CC000000"))
            )
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, dp(280)
            ).also { it.gravity = Gravity.BOTTOM }
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

        // ── Clock widget ──────────────────────────────────────────────────────
        val clockWidget = buildClockWidget()
        column.addView(clockWidget)

        // ── Daily allowance strip ─────────────────────────────────────────────
        column.addView(buildAllowanceStrip())

        // ── Home screen grid (scrollable) ─────────────────────────────────────
        val gridScroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
            )
            isVerticalScrollBarEnabled = false
        }

        homeGrid = GridLayout(this).apply {
            columnCount = 4
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(12), dp(16), dp(12), dp(16))
        }
        gridScroll.addView(homeGrid)

        // Long-press on scroll area (empty space) → add apps dialog
        gridScroll.setOnLongClickListener {
            showAddToHomeDialog()
            true
        }

        column.addView(gridScroll)

        // ── Dock area ─────────────────────────────────────────────────────────
        column.addView(buildDockArea())

        rootFrame.addView(column)

        // ── Gestures: swipe-up → drawer, swipe-down → notifications ──────────
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

        refreshHomeGrid()
        refreshDock()
    }

    private fun buildClockWidget(): LinearLayout {
        val wrap = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(48); it.bottomMargin = dp(12) }
        }

        // Day of week + date
        dateView = TextView(this).apply {
            textSize = 13f
            setTextColor(TEXT_DIM)
            gravity = Gravity.CENTER
            letterSpacing = 0.12f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        wrap.addView(dateView)

        // Time row (clock + AM/PM)
        val timeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL or Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(4) }
        }

        clockView = TextView(this).apply {
            textSize = 72f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        ampmView = TextView(this).apply {
            textSize = 20f
            setTextColor(TEXT_DIM)
            gravity = Gravity.BOTTOM
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.bottomMargin = dp(14); it.leftMargin = dp(6) }
        }

        timeRow.addView(clockView)
        timeRow.addView(ampmView)
        digitalTimeRow = timeRow
        wrap.addView(timeRow)

        // Analog clock — shown instead of the digital row when style = "analog"
        analogClockView = AnalogClockView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(200), dp(200)).also {
                it.gravity = Gravity.CENTER_HORIZONTAL
                it.topMargin = dp(4)
            }
            visibility = View.GONE
        }
        wrap.addView(analogClockView)

        updateClockText()
        return wrap
    }

    private fun buildDockArea(): LinearLayout {
        val dockWrapper = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // ── All Apps pill button — tappable, also activates on swipe-up ────────
        // Gives users the familiar "drawer icon" affordance they expect from stock launchers.
        val allAppsBtn = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL or Gravity.CENTER_HORIZONTAL
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(22).toFloat()
                setColor(DOCK_SURFACE)
                setStroke(dp(1), Color.parseColor("#25FFFFFF"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(40)
            ).also {
                it.gravity = Gravity.CENTER_HORIZONTAL
                it.topMargin = dp(12)
                it.bottomMargin = dp(8)
            }
            setPadding(dp(18), 0, dp(20), 0)
        }

        // 3×3 dot grid drawn on a small canvas — the universal "apps" icon
        val dotsView = object : View(this) {
            private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                style = Paint.Style.FILL
            }
            override fun onDraw(canvas: Canvas) {
                val dotR  = dp(2).toFloat()
                val gap   = dp(6).toFloat()
                val cx    = width  / 2f
                val cy    = height / 2f
                val start = -gap
                for (row in 0..2) for (col in 0..2) {
                    canvas.drawCircle(cx + start + col * gap, cy + start + row * gap, dotR, dotPaint)
                }
            }
        }.apply {
            layoutParams = LinearLayout.LayoutParams(dp(26), dp(26))
        }

        val allAppsLabel = TextView(this).apply {
            text = "All Apps"
            textSize = 13f
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.leftMargin = dp(8) }
        }

        allAppsBtn.addView(dotsView)
        allAppsBtn.addView(allAppsLabel)
        allAppsBtn.setOnClickListener { openDrawer() }
        dockWrapper.addView(allAppsBtn)

        // ── Dock icon row ──────────────────────────────────────────────────────
        // Frosted glass pill that holds the user's pinned dock apps.
        val dockCard = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(28).toFloat()
                setColor(DOCK_SURFACE)
                setStroke(dp(1), Color.parseColor("#20FFFFFF"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(90)
            ).also {
                it.setMargins(dp(16), dp(4), dp(16), dp(24))
            }
            setPadding(dp(4), 0, dp(4), 0)
        }

        dockRow = dockCard
        dockWrapper.addView(dockCard)

        return dockWrapper
    }

    // ── Refresh home grid ──────────────────────────────────────────────────────

    private fun refreshHomeGrid() {
        val grid = homeGrid ?: return
        grid.removeAllViews()

        val pinnedJson = prefs.getString(PREF_LAUNCHER_PINNED, "[]") ?: "[]"
        val pinned = parseJsonArray(pinnedJson)
        val blocked = getBlockedPackages()

        for (pkg in pinned) {
            addHomeGridIcon(grid, pkg, blocked.contains(pkg))
        }
    }

    private fun addHomeGridIcon(parent: GridLayout, pkg: String, isBlocked: Boolean) {
        val pm = packageManager
        val appInfo = try { pm.getApplicationInfo(pkg, 0) } catch (_: Exception) { return }
        val label = pm.getApplicationLabel(appInfo).toString()
        val icon  = try { pm.getApplicationIcon(pkg) } catch (_: Exception) { return }

        val colSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
        val item = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val lp = GridLayout.LayoutParams(colSpec, colSpec)
            lp.width = 0
            lp.height = GridLayout.LayoutParams.WRAP_CONTENT
            lp.setMargins(dp(4), dp(10), dp(4), dp(10))
            layoutParams = lp
        }

        // Native adaptive icon — no extra circle background so it looks just
        // like the user's real home screen. Blocked apps get a dim + red dot.
        val iconFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(56), dp(56)).also {
                it.gravity = Gravity.CENTER_HORIZONTAL
            }
        }

        val iconView = ImageView(this).apply {
            setImageDrawable(icon)
            alpha = if (isBlocked) 0.35f else 1f
            layoutParams = FrameLayout.LayoutParams(dp(52), dp(52)).also {
                it.gravity = Gravity.CENTER
            }
        }
        iconFrame.addView(iconView)

        // Blocked badge dot in the top-right corner
        if (isBlocked) {
            val dot = View(this).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#EF4444"))
                    setStroke(dp(1), Color.parseColor("#CC000000"))
                }
                layoutParams = FrameLayout.LayoutParams(dp(10), dp(10)).also {
                    it.gravity = Gravity.TOP or Gravity.END
                    it.topMargin = dp(1); it.rightMargin = dp(1)
                }
            }
            iconFrame.addView(dot)
        }

        val labelView = TextView(this).apply {
            text = label
            textSize = 11f
            setTextColor(if (isBlocked) Color.parseColor("#88FFFFFF") else Color.WHITE)
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setShadowLayer(3f, 0f, 1f, Color.parseColor("#CC000000"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(5) }
        }

        item.addView(iconFrame)
        item.addView(labelView)

        item.setOnClickListener {
            if (isBlocked) launchBlockOverlay(pkg) else launchApp(pkg)
        }

        item.setOnLongClickListener {
            showHomeIconMenu(pkg, label)
            true
        }

        parent.addView(item)
    }

    // ── Refresh dock ──────────────────────────────────────────────────────────

    private fun refreshDock() {
        val row = dockRow ?: return
        row.removeAllViews()

        val dockJson = prefs.getString(PREF_LAUNCHER_DOCK, "[]") ?: "[]"
        val dockPkgs = parseJsonArray(dockJson)
        val blocked  = getBlockedPackages()

        for (pkg in dockPkgs.take(5)) {
            addDockIcon(row, pkg, blocked.contains(pkg))
        }
    }

    private fun addDockIcon(parent: LinearLayout, pkg: String, isBlocked: Boolean) {
        val pm = packageManager
        val appInfo = try { pm.getApplicationInfo(pkg, 0) } catch (_: Exception) { return }
        val label = pm.getApplicationLabel(appInfo).toString()
        val icon  = try { pm.getApplicationIcon(pkg) } catch (_: Exception) { return }

        val item = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setPadding(dp(4), dp(10), dp(4), dp(8))
        }

        // Native icon — no extra oval container so the icon looks just like
        // a stock launcher's dock. Blocked apps dim and get a red corner dot.
        val iconFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(54), dp(54)).also {
                it.gravity = Gravity.CENTER_HORIZONTAL
            }
        }

        val iconView = ImageView(this).apply {
            setImageDrawable(icon)
            alpha = if (isBlocked) 0.35f else 1f
            layoutParams = FrameLayout.LayoutParams(dp(50), dp(50)).also {
                it.gravity = Gravity.CENTER
            }
        }
        iconFrame.addView(iconView)

        if (isBlocked) {
            val dot = View(this).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#EF4444"))
                    setStroke(dp(1), Color.parseColor("#CC000000"))
                }
                layoutParams = FrameLayout.LayoutParams(dp(10), dp(10)).also {
                    it.gravity = Gravity.TOP or Gravity.END
                    it.topMargin = dp(1); it.rightMargin = dp(1)
                }
            }
            iconFrame.addView(dot)
        }

        val labelView = TextView(this).apply {
            text = label
            textSize = 10f
            setTextColor(if (isBlocked) Color.parseColor("#88FFFFFF") else TEXT_DIM)
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setShadowLayer(3f, 0f, 1f, Color.parseColor("#CC000000"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(3) }
        }

        item.addView(iconFrame)
        item.addView(labelView)

        item.setOnClickListener {
            if (isBlocked) launchBlockOverlay(pkg) else launchApp(pkg)
        }

        item.setOnLongClickListener {
            showDockIconMenu(pkg, label)
            true
        }

        parent.addView(item)
    }

    // ── App drawer ────────────────────────────────────────────────────────────

    private fun openDrawer() {
        if (isDrawerOpen) return
        isDrawerOpen = true

        val overlay = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.TRANSPARENT)
            alpha = 0f
        }

        val sheet = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.parseColor("#F01A1F2E"), Color.parseColor("#FF0D1117"))
            ).also { it.cornerRadii = floatArrayOf(dp(28).toFloat(), dp(28).toFloat(), 0f, 0f, 0f, 0f, dp(28).toFloat(), dp(28).toFloat()) }
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                (resources.displayMetrics.heightPixels * 0.92).toInt()
            ).also { it.gravity = Gravity.BOTTOM }
            translationY = resources.displayMetrics.heightPixels.toFloat()
        }

        // Drag handle
        val handle = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(3).toFloat()
                setColor(Color.parseColor("#55AABBDD"))
            }
            layoutParams = LinearLayout.LayoutParams(dp(36), dp(4)).also {
                it.gravity = Gravity.CENTER_HORIZONTAL
                it.topMargin = dp(12); it.bottomMargin = dp(14)
            }
        }
        sheet.addView(handle)

        // Drawer title
        val drawerTitle = TextView(this).apply {
            text = "All Apps"
            textSize = 16f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.bottomMargin = dp(10) }
        }
        sheet.addView(drawerTitle)

        // Search bar
        val searchBar = EditText(this).apply {
            hint = "Search apps…"
            setHintTextColor(Color.parseColor("#556688AA"))
            setTextColor(Color.WHITE)
            textSize = 15f
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(14).toFloat()
                setColor(Color.parseColor("#1AFFFFFF"))
                setStroke(dp(1), Color.parseColor("#22FFFFFF"))
            }
            setPadding(dp(16), dp(12), dp(16), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.setMargins(dp(16), 0, dp(16), dp(12)) }
        }
        sheet.addView(searchBar)

        // App grid in scroll view
        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
            )
            isVerticalScrollBarEnabled = false
        }

        val gridContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(8), 0, dp(8), dp(24))
        }

        val hiddenPkgs = parseJsonArray(prefs.getString(PREF_LAUNCHER_HIDDEN, "[]") ?: "[]").toSet()
        val blocked    = getBlockedPackages()
        val pm         = packageManager
        val intent     = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

        val allApps = pm.queryIntentActivities(intent, 0)
            .filter { it.activityInfo.packageName != OWN_PACKAGE }
            .filter { !hiddenPkgs.contains(it.activityInfo.packageName) }
            .sortedBy { pm.getApplicationLabel(it.activityInfo.applicationInfo).toString().lowercase(Locale.getDefault()) }

        // Group by first letter for section headers
        val sections = allApps.groupBy { info ->
            val first = pm.getApplicationLabel(info.activityInfo.applicationInfo).toString()
                .firstOrNull()?.uppercaseChar() ?: '#'
            if (first.isLetter()) first else '#'
        }.toSortedMap(compareBy { if (it == '#') '\uFFFF' else it })

        // Track all grid views for search filtering
        data class AppEntry(val view: View, val searchKey: String)
        val allEntries = mutableListOf<AppEntry>()

        for ((letter, apps) in sections) {
            // Section letter header
            val sectionHeader = TextView(this).apply {
                text = letter.toString()
                textSize = 12f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                setTextColor(ACCENT)
                setPadding(dp(12), dp(8), dp(12), dp(4))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                tag = "header_$letter"
            }
            gridContainer.addView(sectionHeader)
            allEntries.add(AppEntry(sectionHeader, "header_$letter"))

            // Grid row for this section
            val sectionGrid = GridLayout(this).apply {
                columnCount = 5
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                tag = "grid_$letter"
            }

            for (info in apps) {
                addDrawerIcon(sectionGrid, info, pm, blocked)
            }

            gridContainer.addView(sectionGrid)
            allEntries.add(AppEntry(sectionGrid, "grid_$letter"))
        }

        scroll.addView(gridContainer)
        sheet.addView(scroll)
        overlay.addView(sheet)

        // Search filter
        searchBar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val q = s?.toString()?.lowercase(Locale.getDefault())?.trim() ?: ""
                if (q.isEmpty()) {
                    // Restore all
                    for (entry in allEntries) entry.view.visibility = View.VISIBLE
                } else {
                    // Hide section headers, show only matching apps in a flat way
                    for (entry in allEntries) {
                        if ((entry.view.tag as? String)?.startsWith("header_") == true) {
                            entry.view.visibility = View.GONE
                        }
                    }
                    for (i in 0 until gridContainer.childCount) {
                        val child = gridContainer.getChildAt(i)
                        val tag = child.tag as? String ?: continue
                        if (!tag.startsWith("grid_")) continue
                        val grid = child as? GridLayout ?: continue
                        var hasVisible = false
                        for (j in 0 until grid.childCount) {
                            val iconItem = grid.getChildAt(j)
                            val itemTag = iconItem.tag as? String ?: ""
                            val visible = q.isEmpty() || itemTag.contains(q)
                            iconItem.visibility = if (visible) View.VISIBLE else View.GONE
                            if (visible) hasVisible = true
                        }
                        grid.visibility = if (hasVisible) View.VISIBLE else View.GONE
                    }
                }
            }
        })

        // Swipe-down to close
        var swipeDownY = 0f
        sheet.setOnTouchListener { _, ev ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN -> { swipeDownY = ev.rawY; false }
                MotionEvent.ACTION_UP   -> {
                    if (ev.rawY - swipeDownY > dp(80)) { closeDrawer(); true } else false
                }
                else -> false
            }
        }

        drawerOverlay = overlay
        rootFrame.addView(overlay)

        // Animate in
        overlay.animate().alpha(1f).setDuration(200).setInterpolator(DecelerateInterpolator()).start()
        sheet.animate().translationY(0f).setDuration(280).setInterpolator(DecelerateInterpolator(1.5f)).start()
    }

    private fun addDrawerIcon(grid: GridLayout, info: ResolveInfo, pm: PackageManager, blocked: Set<String>) {
        val pkg       = info.activityInfo.packageName
        val label     = pm.getApplicationLabel(info.activityInfo.applicationInfo).toString()
        val icon      = try { pm.getApplicationIcon(pkg) } catch (_: Exception) { return }
        val isBlocked = blocked.contains(pkg)

        val colSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
        val item = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val lp = GridLayout.LayoutParams(colSpec, colSpec)
            lp.width = 0
            lp.height = GridLayout.LayoutParams.WRAP_CONTENT
            lp.setMargins(dp(4), dp(8), dp(4), dp(2))
            layoutParams = lp
            tag = label.lowercase(Locale.getDefault())
        }

        val iconView = ImageView(this).apply {
            setImageDrawable(icon)
            alpha = if (isBlocked) 0.28f else 1f
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).also {
                it.gravity = Gravity.CENTER_HORIZONTAL
            }
        }

        val labelView = TextView(this).apply {
            text = label
            textSize = 10f
            setTextColor(if (isBlocked) TEXT_MUTED else TEXT_DIM)
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setShadowLayer(2f, 0f, 1f, Color.parseColor("#CC000000"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(3) }
        }

        item.addView(iconView)
        item.addView(labelView)

        item.setOnClickListener {
            if (isBlocked) {
                closeDrawer()
                launchBlockOverlay(pkg)
            } else {
                closeDrawer()
                launchApp(pkg)
            }
        }

        item.setOnLongClickListener {
            showDrawerIconMenu(pkg, label)
            true
        }

        grid.addView(item)
    }

    private fun closeDrawer() {
        val overlay = drawerOverlay ?: return
        val sheet = overlay.getChildAt(0)
        isDrawerOpen = false

        sheet?.animate()
            ?.translationY(resources.displayMetrics.heightPixels.toFloat())
            ?.setDuration(220)
            ?.setInterpolator(AccelerateInterpolator())
            ?.start()

        overlay.animate()
            .alpha(0f)
            .setDuration(220)
            .setInterpolator(AccelerateInterpolator())
            .withEndAction {
                rootFrame.removeView(overlay)
                drawerOverlay = null
            }
            .start()
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
        val pm     = packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps   = pm.queryIntentActivities(intent, 0)
            .filter { it.activityInfo.packageName != OWN_PACKAGE }
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
        val json    = prefs.getString(PREF_LAUNCHER_PINNED, "[]") ?: "[]"
        val current = parseJsonArray(json).toMutableList()
        if (!current.contains(pkg)) {
            current.add(pkg)
            saveJsonArray(PREF_LAUNCHER_PINNED, current)
            refreshHomeGrid()
        }
    }

    private fun removeFromHome(pkg: String) {
        val json    = prefs.getString(PREF_LAUNCHER_PINNED, "[]") ?: "[]"
        val updated = parseJsonArray(json).filter { it != pkg }
        saveJsonArray(PREF_LAUNCHER_PINNED, updated)
        refreshHomeGrid()
    }

    private fun addToDock(pkg: String) {
        val json    = prefs.getString(PREF_LAUNCHER_DOCK, "[]") ?: "[]"
        val current = parseJsonArray(json).toMutableList()
        if (!current.contains(pkg) && current.size < 5) {
            current.add(pkg)
            saveJsonArray(PREF_LAUNCHER_DOCK, current)
            refreshDock()
        } else if (current.size >= 5) {
            AlertDialog.Builder(this)
                .setTitle("Dock is full")
                .setMessage("Remove an existing dock app first (long-press it on the home screen).")
                .setPositiveButton("OK", null)
                .show()
        }
    }

    private fun removeFromDock(pkg: String) {
        val json    = prefs.getString(PREF_LAUNCHER_DOCK, "[]") ?: "[]"
        val updated = parseJsonArray(json).filter { it != pkg }
        saveJsonArray(PREF_LAUNCHER_DOCK, updated)
        refreshDock()
    }

    private fun openAppInfo(pkg: String) {
        val i = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = android.net.Uri.parse("package:$pkg")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try { startActivity(i) } catch (_: Exception) {}
    }

    // ── Launch helpers ────────────────────────────────────────────────────────

    private fun launchApp(pkg: String) {
        val i = packageManager.getLaunchIntentForPackage(pkg) ?: return
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { startActivity(i) } catch (_: Exception) {}
    }

    private fun launchBlockOverlay(pkg: String) {
        val i = Intent(this, BlockOverlayActivity::class.java).apply {
            putExtra("blocked_package", pkg)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        try { startActivity(i) } catch (_: Exception) {}
    }

    // ── Block-state helpers ───────────────────────────────────────────────────

    private fun getBlockedPackages(): Set<String> {
        val now    = System.currentTimeMillis()
        val result = mutableSetOf<String>()

        val saActive = prefs.getBoolean(PREF_SA_ACTIVE, false)
        if (saActive) {
            val until = prefs.getLong(PREF_SA_UNTIL, 0L)
            if (until == 0L || now <= until) {
                result.addAll(parseJsonArray(prefs.getString(PREF_SA_PKGS, "[]") ?: "[]"))
            }
        }

        val alwaysActive = prefs.getBoolean(PREF_ALWAYS_BLOCK, false)
        if (alwaysActive) {
            result.addAll(parseJsonArray(prefs.getString(PREF_ALWAYS_BLOCK_PKGS, "[]") ?: "[]"))
        }

        return result
    }

    // ── Clock ─────────────────────────────────────────────────────────────────

    private fun startClock() {
        clockRunnable = object : Runnable {
            override fun run() {
                updateClockText()
                // Update every second for accurate display
                handler.postDelayed(this, 1_000L)
            }
        }
        handler.post(clockRunnable!!)
    }

    private fun updateClockText() {
        val now = Date()
        val use24h = android.text.format.DateFormat.is24HourFormat(this)
        val isAnalog = prefs.getString("launcher_clock_style", "digital") == "analog"

        if (isAnalog) {
            digitalTimeRow?.visibility = View.GONE
            analogClockView?.visibility = View.VISIBLE
            analogClockView?.invalidate()
        } else {
            digitalTimeRow?.visibility = View.VISIBLE
            analogClockView?.visibility = View.GONE
            if (use24h) {
                clockView?.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now)
                ampmView?.text  = ""
            } else {
                clockView?.text = SimpleDateFormat("h:mm", Locale.getDefault()).format(now)
                ampmView?.text  = SimpleDateFormat("a", Locale.getDefault()).format(now)
            }
        }

        dateView?.text = SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()).format(now)
        allowanceTickCount++
        if (allowanceTickCount >= 60) {
            allowanceTickCount = 0
            refreshAllowanceStrip()
        }
    }

    // ── Notification shade ────────────────────────────────────────────────────

    /**
     * Expands the notification shade panel on swipe-down.
     * Requires android.permission.EXPAND_STATUS_BAR in the manifest.
     */
    @Suppress("UNCHECKED_CAST")
    private fun expandNotificationsPanel() {
        try {
            val sbService = getSystemService("statusbar")
            val sbClass   = Class.forName("android.app.StatusBarManager")
            sbClass.getMethod("expandNotificationsPanel").invoke(sbService)
        } catch (_: Exception) {}
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    private fun parseJsonArray(json: String): List<String> {
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) { emptyList() }
    }

    private fun saveJsonArray(key: String, list: List<String>) {
        val json = "[${list.joinToString(",") { "\"$it\"" }}]"
        prefs.edit().putString(key, json).apply()
    }

    // ── Daily Allowance Strip ─────────────────────────────────────────────────

    private fun buildAllowanceStrip(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            visibility = View.GONE
        }
        allowanceStripContainer = container
        return container
    }

    private fun refreshAllowanceStrip() {
        val container = allowanceStripContainer ?: return
        container.removeAllViews()
        val cards = loadAllowanceCardData()
        if (cards.isEmpty()) {
            container.visibility = View.GONE
            return
        }

        val label = TextView(this).apply {
            text = "TODAY'S LIMITS"
            textSize = 10f
            setTextColor(TEXT_MUTED)
            letterSpacing = 0.08f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.setMargins(dp(16), dp(10), dp(16), dp(4)) }
        }
        container.addView(label)

        val scroll = HorizontalScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            isHorizontalScrollBarEnabled = false
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(12), 0, dp(12), dp(10))
        }
        cards.forEach { card -> row.addView(buildAllowanceCard(card)) }
        scroll.addView(row)
        container.addView(scroll)
        container.visibility = View.VISIBLE
    }

    private fun buildAllowanceCard(card: AllowanceCardData): View {
        val fillColor = when {
            card.fraction > 0.5f  -> Color.parseColor("#4CAF50")
            card.fraction > 0.25f -> Color.parseColor("#FF9800")
            else                  -> Color.parseColor("#F44336")
        }
        val borderColor = when {
            card.fraction > 0.5f  -> Color.parseColor("#334CAF50")
            card.fraction > 0.25f -> Color.parseColor("#33FF9800")
            else                  -> Color.parseColor("#33F44336")
        }

        val cardView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(dp(80), LinearLayout.LayoutParams.WRAP_CONTENT).also {
                it.setMargins(dp(4), 0, dp(4), 0)
            }
            setPadding(dp(6), dp(8), dp(6), dp(8))
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(Color.parseColor("#1A1F2E"))
                setStroke(dp(1), borderColor)
            }
        }

        val iconView = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(30), dp(30))
            scaleType = ImageView.ScaleType.FIT_CENTER
            card.icon?.let { setImageDrawable(it) }
        }
        cardView.addView(iconView)

        val nameView = TextView(this).apply {
            text = card.label
            textSize = 10f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(4) }
        }
        cardView.addView(nameView)

        val fraction = card.fraction.coerceIn(0f, 1f)
        val progressRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(4)
            ).also { it.topMargin = dp(5) }
            background = GradientDrawable().apply {
                cornerRadius = dp(2).toFloat()
                setColor(Color.parseColor("#22FFFFFF"))
            }
        }
        if (fraction > 0f) {
            progressRow.addView(View(this).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, fraction)
                background = GradientDrawable().apply {
                    cornerRadius = dp(2).toFloat()
                    setColor(fillColor)
                }
            })
        }
        if (fraction < 1f) {
            progressRow.addView(View(this).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f - fraction)
            })
        }
        cardView.addView(progressRow)

        val remainingView = TextView(this).apply {
            text = card.displayText
            textSize = 9f
            setTextColor(TEXT_DIM)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.topMargin = dp(3) }
        }
        cardView.addView(remainingView)

        return cardView
    }

    private fun loadAllowanceCardData(): List<AllowanceCardData> {
        val configJson = prefs.getString("daily_allowance_config", null) ?: return emptyList()
        if (configJson.isBlank() || configJson == "null") return emptyList()

        val usedJson = prefs.getString(AppBlockerAccessibilityService.PREF_DAILY_ALLOWANCE_USED, "{}") ?: "{}"
        val allUsed  = try { org.json.JSONObject(usedJson) } catch (_: Exception) { org.json.JSONObject() }
        val today    = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val now      = System.currentTimeMillis()
        val result   = mutableListOf<AllowanceCardData>()

        try {
            val arr = org.json.JSONArray(configJson)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val pkg = obj.optString("packageName", "").takeIf { it.isNotBlank() } ?: continue
                val mode    = obj.optString("mode", "count")
                val pkgUsed = allUsed.optJSONObject(pkg)

                val icon  = try { packageManager.getApplicationIcon(pkg) } catch (_: Exception) { null }
                val label = try {
                    packageManager.getApplicationLabel(
                        packageManager.getApplicationInfo(pkg, 0)
                    ).toString()
                } catch (_: Exception) { pkg.substringAfterLast('.') }

                when (mode) {
                    "count" -> {
                        val countPerDay = obj.optInt("countPerDay", 1).coerceAtLeast(1)
                        val usedDate    = pkgUsed?.optString("date", "") ?: ""
                        val usedCount   = if (usedDate == today) pkgUsed?.optInt("count", 0) ?: 0 else 0
                        val remaining   = (countPerDay - usedCount).coerceAtLeast(0)
                        val fraction    = remaining.toFloat() / countPerDay.toFloat()
                        val display     = if (remaining == 0) "no opens left" else "$remaining/$countPerDay opens"
                        result.add(AllowanceCardData(pkg, label, icon, usedCount.toLong(), countPerDay.toLong(), remaining.toLong(), mode, display, fraction))
                    }
                    "time_budget" -> {
                        val budgetMs    = obj.optLong("budgetMinutes", 30L) * 60_000L
                        val usedDate    = pkgUsed?.optString("date", "") ?: ""
                        val usedMs      = if (usedDate == today) pkgUsed?.optLong("usedMs", 0L) ?: 0L else 0L
                        val remainingMs = (budgetMs - usedMs).coerceAtLeast(0L)
                        val fraction    = if (budgetMs > 0L) remainingMs.toFloat() / budgetMs.toFloat() else 0f
                        result.add(AllowanceCardData(pkg, label, icon, usedMs, budgetMs, remainingMs, mode, formatRemainingMs(remainingMs), fraction))
                    }
                    "interval" -> {
                        val intervalMs    = obj.optLong("intervalMinutes", 5L) * 60_000L
                        val windowMs      = obj.optLong("intervalHours", 1L) * 3_600_000L
                        val windowStartMs = pkgUsed?.optLong("windowStartMs", 0L) ?: 0L
                        val windowExpired = now > windowStartMs + windowMs
                        val usedMs        = if (windowExpired) 0L else pkgUsed?.optLong("usedMs", 0L) ?: 0L
                        val remainingMs   = (intervalMs - usedMs).coerceAtLeast(0L)
                        val fraction      = if (intervalMs > 0L) remainingMs.toFloat() / intervalMs.toFloat() else 0f
                        val display       = if (windowExpired) "reset" else formatRemainingMs(remainingMs)
                        result.add(AllowanceCardData(pkg, label, icon, usedMs, intervalMs, remainingMs, mode, display, fraction))
                    }
                }
            }
        } catch (_: Exception) {}

        return result
    }

    private fun formatRemainingMs(ms: Long): String {
        if (ms <= 0L) return "time's up"
        val totalMin = ms / 60_000L
        val hours    = totalMin / 60
        val mins     = totalMin % 60
        return when {
            hours > 0 -> "${hours}h ${mins}m"
            mins  > 0 -> "${mins}m left"
            else      -> "${ms / 1000}s left"
        }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density + 0.5f).toInt()
}

/**
 * AnalogClockView — a Canvas-drawn analog clock face styled to match
 * the FocusFlow launcher's dark aesthetic (white hands, indigo accent,
 * subtle tick marks).
 *
 * Renders the current time each time invalidate() is called (driven by
 * LauncherActivity's 1-second clock tick).
 */
class AnalogClockView(context: android.content.Context) : android.view.View(context) {

    private val paintFace = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#1A1F2E")
        style = android.graphics.Paint.Style.FILL
    }
    private val paintRim = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#6366f1")
        style = android.graphics.Paint.Style.STROKE
        strokeWidth = 3f
    }
    private val paintHour = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = android.graphics.Paint.Style.STROKE
        strokeWidth = 8f
        strokeCap = android.graphics.Paint.Cap.ROUND
    }
    private val paintMinute = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = android.graphics.Paint.Style.STROKE
        strokeWidth = 5f
        strokeCap = android.graphics.Paint.Cap.ROUND
    }
    private val paintSecond = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#6366f1")
        style = android.graphics.Paint.Style.STROKE
        strokeWidth = 2f
        strokeCap = android.graphics.Paint.Cap.ROUND
    }
    private val paintTick = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#55667799")
        style = android.graphics.Paint.Style.STROKE
        strokeWidth = 2f
    }
    private val paintCenter = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#6366f1")
        style = android.graphics.Paint.Style.FILL
    }

    override fun onDraw(canvas: android.graphics.Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        val radius = minOf(cx, cy) - 6f

        // Face
        canvas.drawCircle(cx, cy, radius, paintFace)
        canvas.drawCircle(cx, cy, radius, paintRim)

        // Tick marks (12 hour marks, slightly longer)
        for (i in 0 until 60) {
            val angle = Math.toRadians((i * 6 - 90).toDouble())
            val isHour = i % 5 == 0
            val outerR = radius - 4f
            val innerR = if (isHour) radius - 16f else radius - 10f
            paintTick.strokeWidth = if (isHour) 3f else 1.5f
            paintTick.color = if (isHour)
                android.graphics.Color.parseColor("#99AAAACC")
            else
                android.graphics.Color.parseColor("#33667799")
            canvas.drawLine(
                cx + (innerR * Math.cos(angle)).toFloat(),
                cy + (innerR * Math.sin(angle)).toFloat(),
                cx + (outerR * Math.cos(angle)).toFloat(),
                cy + (outerR * Math.sin(angle)).toFloat(),
                paintTick
            )
        }

        // Current time
        val cal = java.util.Calendar.getInstance()
        val hours   = cal.get(java.util.Calendar.HOUR)
        val minutes = cal.get(java.util.Calendar.MINUTE)
        val seconds = cal.get(java.util.Calendar.SECOND)

        // Hour hand (moves smoothly with minutes)
        val hourAngle = Math.toRadians(((hours * 30 + minutes * 0.5f) - 90).toDouble())
        val hourLen = radius * 0.5f
        canvas.drawLine(
            cx, cy,
            cx + (hourLen * Math.cos(hourAngle)).toFloat(),
            cy + (hourLen * Math.sin(hourAngle)).toFloat(),
            paintHour
        )

        // Minute hand
        val minuteAngle = Math.toRadians(((minutes * 6 + seconds * 0.1f) - 90).toDouble())
        val minuteLen = radius * 0.72f
        canvas.drawLine(
            cx, cy,
            cx + (minuteLen * Math.cos(minuteAngle)).toFloat(),
            cy + (minuteLen * Math.sin(minuteAngle)).toFloat(),
            paintMinute
        )

        // Second hand
        val secondAngle = Math.toRadians((seconds * 6 - 90).toDouble())
        val secondLen = radius * 0.80f
        canvas.drawLine(
            cx - (secondLen * 0.15f * Math.cos(secondAngle)).toFloat(),
            cy - (secondLen * 0.15f * Math.sin(secondAngle)).toFloat(),
            cx + (secondLen * Math.cos(secondAngle)).toFloat(),
            cy + (secondLen * Math.sin(secondAngle)).toFloat(),
            paintSecond
        )

        // Center dot
        canvas.drawCircle(cx, cy, 6f, paintCenter)
    }
}
