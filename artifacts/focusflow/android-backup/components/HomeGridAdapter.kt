package com.tbtechs.focusflow.services.components

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.tbtechs.focusflow.R
import com.tbtechs.focusflow.services.AppBlockerAccessibilityService
import org.json.JSONArray

/**
 * HomeGridAdapter - Material 3 Home Screen Grid Adapter
 *
 * RecyclerView.Adapter for the home screen app grid (4-column).
 * Supports blocked apps (dimmed + red badge), click/long-click listeners.
 */
class HomeGridAdapter(
    private val context: Context,
    private val pinnedPackages: List<String>,
    private val blockedPackages: Set<String>,
    private val onAppClick: (String) -> Unit,
    private val onAppLongClick: (String, String) -> Unit
) : RecyclerView.Adapter<HomeGridAdapter.AppViewHolder>() {

    private val packageManager: PackageManager = context.packageManager

    class AppViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val iconFrame: FrameLayout = view.findViewById(R.id.app_icon_frame)
        val iconView: ImageView = view.findViewById(R.id.app_icon_view)
        val labelView: TextView = view.findViewById(R.id.app_label_view)
        val allowanceIndicator: CircularProgressIndicator = view.findViewById(R.id.app_allowance_indicator)
        var pkg: String = ""
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AppViewHolder {
        val view = LayoutInflater.from(context).inflate(R.layout.item_home_grid_app, parent, false)
        return AppViewHolder(view)
    }

    override fun onBindViewHolder(holder: AppViewHolder, position: Int) {
        val pkg = pinnedPackages[position]
        holder.pkg = pkg

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

        val isBlocked = blockedPackages.contains(pkg)

        // Set icon
        holder.iconView.setImageDrawable(icon)
        holder.iconView.alpha = if (isBlocked) 0.35f else 1f

        // Set label
        holder.labelView.text = label
        holder.labelView.setTextColor(
            ContextCompat.getColor(
                context,
                if (isBlocked) R.color.text_muted_light else R.color.white
            )
        )

        // Configure blocked badge using Material 3 BadgeDrawable
        if (isBlocked) {
            val badge = com.google.android.material.badge.BadgeDrawable.create(context)
            badge.apply {
                isVisible = true
                number = 0 // Show dot, not number
                backgroundColor = ContextCompat.getColor(context, R.color.error_red)
                badgeTextColor = ContextCompat.getColor(context, R.color.white)
            }
            // Attach badge to icon frame
            com.google.android.material.badge.BadgeUtils.attachBadgeDrawable(badge, holder.iconFrame, holder.iconFrame)
        }

        // Allowance indicator (16dp circular progress)
        holder.allowanceIndicator.apply {
            indicatorSize = 16.dpToPx()
            trackThickness = 2.dpToPx()
            indicatorColor = ContextCompat.getColor(context, R.color.focus_indigo)
            trackColor = ContextCompat.getColor(context, R.color.surface_variant_light)
            progress = 0
            visibility = View.VISIBLE // Show for all apps, update progress based on allowance
        }

        // Click listeners
        holder.itemView.setOnClickListener {
            onAppClick(pkg)
        }
        holder.itemView.setOnLongClickListener {
            val appLabel = packageManager.getApplicationLabel(
                packageManager.getApplicationInfo(pkg, 0)
            ).toString()
            onAppLongClick(pkg, appLabel)
            true
        }
    }

    override fun getItemCount(): Int = pinnedPackages.size

    private fun Int.dpToPx(): Int = (this * context.resources.displayMetrics.density + 0.5f).toInt()
}
