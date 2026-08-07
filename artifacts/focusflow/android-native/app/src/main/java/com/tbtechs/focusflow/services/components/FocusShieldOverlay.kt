package com.tbtechs.focusflow.services.components

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.badge.BadgeDrawable
import com.google.android.material.badge.BadgeUtils
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService

/**
 * FocusShieldOverlay - Material 3 Focus Shield Component
 *
 * Handles blocked app interception with Material 3 UI:
 * - BadgeDrawable on app icons (red shield dot)
 * - BottomSheetDialogFragment for "App Blocked" dialog
 * - Actions: Request 5 min, Add to allowlist, Cancel
 */
class FocusShieldOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private lateinit var prefs: SharedPreferences
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    init {
        prefs = context.getSharedPreferences(
            AppBlockerAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE
        )
    }

    /**
     * Apply Focus Shield badge to an app icon frame
     * Call this when binding app icons in grids/dock
     */
    fun applyShieldBadge(iconFrame: FrameLayout, pkg: String, isBlocked: Boolean) {
        if (isBlocked) {
            // Create Focus Shield badge
            val badge = BadgeDrawable.create(context)
            badge.apply {
                isVisible = true
                number = 0 // Show dot only
                backgroundColor = ContextCompat.getColor(context, R.color.error_red)
                badgeTextColor = ContextCompat.getColor(context, R.color.white)
                // Custom drawable for focus shield icon
                setCustomBadgeContent(iconFrame)
            }
            BadgeUtils.attachBadgeDrawable(badge, iconFrame, iconFrame)
        } else {
            // Remove badge if exists
            // BadgeUtils.detachBadgeDrawable(iconFrame) - not available, use visibility
        }
    }

    private fun setCustomBadgeContent(iconFrame: FrameLayout) {
        // Add a custom focus shield icon to the badge
        // We'll use a small ImageView overlay instead of BadgeDrawable's limited customization
        val shieldView = ImageView(context).apply {
            setImageResource(R.drawable.ic_focus_shield)
            layoutParams = FrameLayout.LayoutParams(
                16.dpToPx(), 16.dpToPx()
            ).also {
                it.gravity = android.view.Gravity.TOP or android.view.Gravity.END
                it.topMargin = 2.dpToPx()
                it.rightMargin = 2.dpToPx()
            }
            setColorFilter(ContextCompat.getColor(context, R.color.white))
        }
        iconFrame.addView(shieldView)
    }

    /**
     * Show the Focus Shield bottom sheet when a blocked app is tapped
     */
    fun showFocusShieldDialog(
        activity: Activity,
        pkg: String,
        onRequestAllowance: (String) -> Unit,
        onAddToAllowlist: (String) -> Unit
    ) {
        FocusShieldDialogFragment.newInstance(pkg, onRequestAllowance, onAddToAllowlist)
            .show(activity.supportFragmentManager, "focus_shield")
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
    }

    private fun Int.dpToPx(): Int = (this * context.resources.displayMetrics.density + 0.5f).toInt()
}

/**
 * FocusShieldDialogFragment - Material 3 Bottom Sheet Dialog
 *
 * Shows when user taps a blocked app:
 * - Focus Shield icon + "App Blocked" title
 * - "Request 5 min access" button (if allowance permits)
 * - "Add to focus allowlist" button
 * - "Cancel" text button
 */
class FocusShieldDialogFragment : androidx.fragment.app.BottomSheetDialogFragment() {

    companion object {
        fun newInstance(
            pkg: String,
            onRequestAllowance: (String) -> Unit,
            onAddToAllowlist: (String) -> Unit
        ): FocusShieldDialogFragment {
            val fragment = FocusShieldDialogFragment()
            val args = Bundle().apply {
                putString("pkg", pkg)
            }
            fragment.arguments = args
            // Note: callbacks can't be passed via Bundle, use static reference or interface
            FocusShieldDialogFragment.onRequestAllowanceCallback = onRequestAllowance
            FocusShieldDialogFragment.onAddToAllowlistCallback = onAddToAllowlist
            return fragment
        }

        // Callbacks (use with caution - static reference)
        @Suppress("UNUSED_PARAMETER")
        var onRequestAllowanceCallback: ((String) -> Unit)? = null
        @Suppress("UNUSED_PARAMETER")
        var onAddToAllowlistCallback: ((String) -> Unit)? = null
    }

    private lateinit var pkg: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pkg = arguments?.getString("pkg") ?: ""
    }

    override fun onCreateView(
        inflater: android.view.LayoutInflater,
        container: android.view.ViewGroup?,
        savedInstanceState: android.os.Bundle?
    ): android.view.View {
        val view = inflater.inflate(R.layout.fragment_focus_shield, null)

        val iconView = view.findViewById<android.widget.ImageView>(R.id.shield_icon)
        val titleView = view.findViewById<android.widget.TextView>(R.id.shield_title)
        val messageView = view.findViewById<android.widget.TextView>(R.id.shield_message)
        val requestBtn = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btn_request_allowance)
        val allowlistBtn = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btn_add_allowlist)
        val cancelBtn = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btn_cancel)

        // Configure views
        iconView.setImageResource(R.drawable.ic_focus_shield_large)
        titleView.text = "App Blocked"
        messageView.text = "This app is blocked by your focus rules."

        requestBtn.setOnClickListener {
            FocusShieldDialogFragment.onRequestAllowanceCallback?.invoke(pkg)
            dismiss()
        }

        allowlistBtn.setOnClickListener {
            FocusShieldDialogFragment.onAddToAllowlistCallback?.invoke(pkg)
            dismiss()
        }

        cancelBtn.setOnClickListener {
            dismiss()
        }

        return view
    }

    override fun onStart() {
        super.onStart()
        // Ensure bottom sheet expands to fit content
        dialog?.let { dialog ->
            val bottomSheet = dialog.findViewById<com.google.android.material.bottomsheet.BottomSheetBehavior<*>>(com.google.android.material.R.id.design_bottom_sheet)
            bottomSheet?.state = BottomSheetBehavior.STATE_EXPANDED
        }
    }

    companion object {
        @Suppress("UNUSED_PARAMETER")
        @JvmStatic
        var onRequestAllowanceCallback: ((String) -> Unit)? = null
        @Suppress("UNUSED_PARAMETER")
        @JvmStatic
        var onAddToAllowlistCallback: ((String) -> Unit)? = null
    }
}