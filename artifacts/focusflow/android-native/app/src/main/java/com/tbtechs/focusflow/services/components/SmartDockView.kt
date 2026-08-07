package com.tbtechs.focusflow.services.components

import android.content.Context
import android.content.pm.PackageManager
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.Chip
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService

/**
 * SmartDockView - Material 3 Smart Dock Component
 *
 * Dynamic dock with:
 * - "All Apps" chip (3x3 dots + label) - opens app drawer
 * - Dynamic focus slot (shows current focus app or "Start Focus")
 * - 3 user-pinned apps
 * - Frosted glass MaterialCardView background
 */
class SmartDockView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : LinearLayout(context, attrs, defStyleAttr) {

    private lateinit var prefs: android.content.SharedPreferences
    private val dockCard: MaterialCardView
    private val allAppsChip: Chip
    private val focusSlotChip: Chip
    private val pinnedChipsContainer: LinearLayout

    private var onAllAppsClick: (() -> Unit)? = null
    private var onFocusSlotClick: (() -> Unit)? = null
    private var onPinnedAppClick: ((String) -> Unit)? = null
    private var onPinnedAppLongClick: ((String, String) -> Unit)? = null

    private val packageManager: PackageManager = context.packageManager
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var updateRunnable: Runnable? = null

    init {
        prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )

        orientation = HORIZONTAL
        gravity = Gravity.CENTER
        LayoutInflater.from(context).inflate(R.layout.component_smart_dock, this, true)

        dockCard = findViewById(R.id.dock_card)
        allAppsChip = findViewById(R.id.all_apps_chip)
        focusSlotChip = findViewById(R.id.focus_slot_chip)
        pinnedChipsContainer = findViewById(R.id.pinned_chips_container)

        // Configure dock card (MaterialCardView with frosted glass)
        dockCard.apply {
            setCardBackgroundColor(ContextCompat.getColor(context, R.color.dock_surface_light))
            strokeWidth = 1.dpToPx()
            strokeColor = ContextCompat.getColor(context, R.color.outline_light)
            radius = 28.dpToPx()
            setContentPadding(4.dpToPx(), 0, 4.dpToPx(), 0)
        }

        // All Apps Chip (3x3 dots + label)
        allAppsChip.apply {
            setOnClickListener { onAllAppsClick?.invoke() }
        }

        // Focus Slot Chip (dynamic - shows current focus app or "Start Focus")
        focusSlotChip.apply {
            setOnClickListener { onFocusSlotClick?.invoke() }
            isClickable = true
        }

        // Initial refresh
        refreshDock()

        // Start periodic refresh
        startPeriodicRefresh()
    }

    private fun startPeriodicRefresh() {
        val runnable = object : Runnable {
            override fun run() {
                refreshDock()
                handler.postDelayed(this, 5000)
            }
        }
        handler.post(runnable)
        updateRunnable = runnable
    }

    fun setOnAllAppsClick(listener: () -> Unit) {
        onAllAppsClick = listener
    }

    fun setOnFocusSlotClick(listener: () -> Unit) {
        onFocusSlotClick = listener
    }

    fun setOnPinnedAppClick(listener: (String) -> Unit) {
        onPinnedAppClick = listener
    }

    fun setOnPinnedAppLongClick(listener: (String, String) -> Unit) {
        onPinnedAppLongClick = listener
    }

    fun refreshDock() {
        val prefs = context.getSharedPreferences(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREFS_NAME,
            Context.MODE_PRIVATE
        )

        // Update Focus Slot Chip
        updateFocusSlotChip(prefs)

        // Update Pinned Chips
        updatePinnedChips(prefs)
    }

    private fun updateFocusSlotChip(prefs: android.content.SharedPreferences) {
        val focusActive = prefs.getBoolean(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_FOCUS_ON, false
        ) && prefs.getLong(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L
        ) > System.currentTimeMillis()

        val saActive = prefs.getBoolean(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_SA_ACTIVE, false
        ) && prefs.getLong(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L
        ) > System.currentTimeMillis()

        if (focusActive) {
            val taskName = prefs.getString(
                com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_TASK_NAME, ""
            ) ?: ""
            focusSlotChip.text = "🎯 $taskName"
            focusSlotChip.setChipBackgroundColorResource(R.color.focus_indigo)
            focusSlotChip.setTextColor(ContextCompat.getColor(context, R.color.white))
        } else if (saActive) {
            focusSlotChip.text = "🔒 Standalone Block"
            focusSlotChip.setChipBackgroundColorResource(R.color.focus_indigo_light)
            focusSlotChip.setTextColor(ContextCompat.getColor(context, R.color.black))
        } else {
            focusSlotChip.text = "▶ Start Focus"
            focusSlotChip.setChipBackgroundColorResource(R.color.surface_variant_light)
            focusSlotChip.setTextColor(ContextCompat.getColor(context, R.color.on_surface_light))
        }
    }

    private fun updatePinnedChips(prefs: android.content.SharedPreferences) {
        val dockJson = prefs.getString(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_LAUNCHER_DOCK_PACKAGES, "[]"
        ) ?: "[]"

        val dockPackages = try {
            org.json.JSONArray(dockJson).toList()
        } catch (e: Exception) {
            emptyList()
        }

        pinnedChipsContainer.removeAllViews()

        for (pkg in dockPackages.take(3)) {
            addPinnedChip(pkg)
        }
    }

    private fun addPinnedChip(pkg: String) {
        val appInfo = try {
            packageManager.getApplicationInfo(pkg, 0)
        } catch (e: PackageManager.NameNotFoundException) {
            return
        }

        val label = packageManager.getApplicationLabel(appInfo).toString()
        val icon = try {
            packageManager.getApplicationIcon(pkg)
        } catch (e: Exception) {
            return
        }

        val isBlocked = isPackageBlocked(pkg)

        val chip = Chip(context).apply {
            text = label
            chipIcon = icon
            isClickable = true
            setOnClickListener {
                if (isPackageBlocked(pkg)) {
                    // Launch block overlay - handled by parent
                } else {
                    onPinnedAppClick?.invoke(pkg)
                }
            }
            setOnLongClickListener {
                val appLabel = label
                onPinnedAppLongClick?.invoke(pkg, appLabel)
                true
            }
            chipIconTint = if (isPackageBlocked(pkg)) {
                android.content.res.ColorStateList.valueOf(
                    ContextCompat.getColor(context, R.color.text_muted_light)
                )
            } else null
            setChipBackgroundColorResource(if (isPackageBlocked(pkg)) R.color.surface_variant_light else R.color.dock_surface_light)
            setTextColor(ContextCompat.getColor(context, if (isPackageBlocked(pkg)) R.color.text_muted_light else R.color.on_surface_light))
        }

        LinearLayout.LayoutParams(chip.layoutParams).apply {
            width = 0
            weight = 1f
            setMargins(4.dpToPx(), 0, 4.dpToPx(), 0)
        }
        chip.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            setMargins(4.dpToPx(), 0, 4.dpToPx(), 0)
        }

        pinnedChipsContainer.addView(chip)
    }

    private fun isPackageBlocked(pkg: String): Boolean {
        val prefs = context.getSharedPreferences(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREFS_NAME,
            Context.MODE_PRIVATE
        )

        val focusActive = prefs.getBoolean(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_FOCUS_ON, false
        ) && prefs.getLong(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_TASK_END_MS, 0L
        ) > System.currentTimeMillis()

        val saActive = prefs.getBoolean(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_SA_ACTIVE, false
        ) && prefs.getLong(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_SA_UNTIL, 0L
        ) > System.currentTimeMillis()

        val alwaysActive = prefs.getBoolean(
            com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK, false
        )

        if (focusActive) {
            val allowedJson = prefs.getString(
                com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_ALLOWED_PKG, "[]"
            ) ?: "[]"
            val allowed = try { org.json.JSONArray(allowedJson).toSet() } catch (e: Exception) { emptySet() }
            return !allowed.contains(pkg)
        }

        if (saActive) {
            val saJson = prefs.getString(
                com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_SA_PKGS, "[]"
            ) ?: "[]"
            val sa = try { org.json.JSONArray(saJson).toSet() } catch (e: Exception) { emptySet() }
            return sa.contains(pkg)
        }

        if (alwaysActive) {
            val alwaysJson = prefs.getString(
                com.tbtechs.focusflow.services.AppBlockerAccessibilityService.PREF_ALWAYS_BLOCK_PKGS, "[]"
            ) ?: "[]"
            val always = try { org.json.JSONArray(alwaysJson).toSet() } catch (e: Exception) { emptySet() }
            return always.contains(pkg)
        }

        return false
    }

    fun setOnAllAppsClick(listener: () -> Unit) {
        onAllAppsClick = listener
    }

    fun setOnFocusSlotClick(listener: () -> Unit) {
        onFocusSlotClick = listener
    }

    fun setOnPinnedAppClick(listener: (String) -> Unit) {
        onPinnedAppClick = listener
    }

    fun setOnPinnedAppLongClick(listener: (String, String) -> Unit) {
        onPinnedAppLongClick = listener
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        updateRunnable?.let { handler.removeCallbacks(it) }
    }

    private fun Int.dpToPx(): Int = (this * context.resources.displayMetrics.density + 0.5f).toInt()
}