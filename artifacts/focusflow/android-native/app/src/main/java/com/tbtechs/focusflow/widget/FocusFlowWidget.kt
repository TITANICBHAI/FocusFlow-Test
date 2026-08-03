package com.tbtechs.focusflow.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.tbtechs.focusflow.MainActivity
import com.tbtechs.focusflow.R
import org.json.JSONArray
import java.util.Calendar

/**
 * FocusFlowWidget
 *
 * Home screen widget (4 × 1). Four render states:
 *
 *   1. ACTIVE TASK       — task in progress, end time in the future.
 *      Header: task color · "ACTIVE TASK"
 *      Left:   task name
 *      Right:  "Nm remaining" + thin progress bar
 *      Tap → Focus tab
 *
 *   2. AWAITING DECISION — task timer hit zero but user hasn't resolved it.
 *      Header: task color · "TIME'S UP"
 *      Left:   task name
 *      Right:  "Tap to resolve"
 *      Tap → Focus tab
 *
 *   3. NEXT UP           — no running task but one is coming today.
 *      Header: indigo · "NEXT UP"
 *      Left:   upcoming task name
 *      Right:  "Starts in Nm"
 *      Tap → Schedule tab
 *
 *   4. STANDALONE BLOCK  — standalone app block active (no task).
 *      Header: indigo · "BLOCK ACTIVE"
 *      Left:   "Blocking N apps · until HH:MM"
 *      Right:  (hidden)
 *      Tap → Schedule tab
 *
 *   5. IDLE              — nothing scheduled or running.
 *      Header: indigo · "FOCUSFLOW"
 *      Left:   "Nothing scheduled"
 *      Right:  "+ Add Task" pill
 *      Tap → Schedule tab
 *
 * SharedPrefs keys read (namespace: focusday_prefs):
 *   task_name                String  — active / awaiting task display name
 *   task_end_ms              Long    — task end epoch ms
 *   task_start_ms            Long    — task start epoch ms (for progress %)
 *   task_color               String  — task accent hex (e.g. "#6366f1")
 *   task_awaiting_decision   String  — "true" when task ended, user not resolved yet
 *   next_upcoming_name       String  — name of the next upcoming task (idle only)
 *   next_upcoming_start_ms   String  — start epoch ms as a string (idle only)
 *   standalone_block_active  Boolean
 *   standalone_block_until_ms Long
 *   standalone_blocked_packages String JSON array
 *
 * Update triggers:
 *   • System periodic onUpdate() every 30 min (Android minimum)
 *   • ForegroundTaskService.pushWidgetUpdate() during focus sessions (every ~10s)
 *   • SharedPrefsModule.pushWidgetUpdate() called from JS on any state change
 */
class FocusFlowWidget : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME     = "focusday_prefs"
        private const val DEFAULT_ACCENT = "#6366f1"

        // PendingIntent request codes — must be unique per target
        private const val PI_TAP_ROOT = 100
        private const val PI_TAP_CTA  = 101

        fun pushWidgetUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, FocusFlowWidget::class.java)
            )
            if (ids.isEmpty()) return
            val views = buildViews(context)
            manager.updateAppWidget(ids, views)
        }

        // ─── Helpers ──────────────────────────────────────────────────────────

        private fun parseColor(hex: String?): Int = try {
            Color.parseColor(if (hex.isNullOrBlank()) DEFAULT_ACCENT else hex)
        } catch (_: Exception) {
            Color.parseColor(DEFAULT_ACCENT)
        }

        private fun pendingDeepLink(context: Context, requestCode: Int, path: String): PendingIntent {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("focusflow://$path")).apply {
                setClass(context, MainActivity::class.java)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        private fun formatHmm(epochMs: Long): String {
            val cal = Calendar.getInstance().apply { timeInMillis = epochMs }
            return String.format("%02d:%02d", cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
        }

        private fun minsUntilStr(startMs: Long): String {
            val now = System.currentTimeMillis()
            val minsUntil = ((startMs - now) / 60_000L).coerceAtLeast(0L)
            return when {
                minsUntil < 1L  -> "Starting now"
                minsUntil == 1L -> "Starts in 1m"
                minsUntil < 60L -> "Starts in ${minsUntil}m"
                else -> {
                    val h = minsUntil / 60; val m = minsUntil % 60
                    if (m == 0L) "Starts in ${h}h" else "Starts in ${h}h ${m}m"
                }
            }
        }

        private fun standaloneBlockedCount(json: String?): Int {
            if (json.isNullOrBlank() || json == "[]") return 0
            return try { JSONArray(json).length() } catch (_: Exception) { 0 }
        }

        /**
         * Builds the "Done · 3/5 tasks · 45m today" subtitle shown on the widget
         * in idle / next-up states. Falls back to focus-only or task-only forms
         * when one half is missing, and returns null when there's nothing to say
         * (so callers can hide the row entirely).
         */
        private fun buildStatsSubtitle(tasksDone: Int, tasksTotal: Int, focusMins: Int): String? {
            val parts = mutableListOf<String>()
            if (tasksTotal > 0) {
                val prefix = if (tasksDone >= tasksTotal && tasksTotal > 0) "Done · " else ""
                parts += "${prefix}${tasksDone}/${tasksTotal} tasks"
            }
            if (focusMins > 0) {
                val mins = if (focusMins >= 60) "${focusMins / 60}h ${focusMins % 60}m" else "${focusMins}m"
                parts += "${mins} today"
            }
            if (parts.isEmpty()) return null
            return parts.joinToString(" · ")
        }

        /** Sets the stats subtitle row (or hides it if there's nothing to show). */
        private fun applyStatsSubtitle(views: RemoteViews, text: String?) {
            if (text.isNullOrBlank()) {
                views.setViewVisibility(R.id.widget_stats_line, View.GONE)
            } else {
                views.setTextViewText(R.id.widget_stats_line, text)
                views.setViewVisibility(R.id.widget_stats_line, View.VISIBLE)
            }
        }

        // ─── State builder ────────────────────────────────────────────────────

        private fun buildViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val now   = System.currentTimeMillis()
            val views = RemoteViews(context.packageName, R.layout.widget_focusflow)

            // ── Active / awaiting-decision task signals ──────────────────────
            val taskName        = prefs.getString("task_name",  "") ?: ""
            val endTimeMs       = prefs.getLong("task_end_ms", 0L)
            val startMs         = prefs.getLong("task_start_ms", 0L)
            val taskColor       = prefs.getString("task_color", DEFAULT_ACCENT)
            val awaitingDecision= prefs.getString("task_awaiting_decision", "") == "true"

            // ── Next upcoming task (shown in idle when nothing is running) ───
            val nextUpName      = prefs.getString("next_upcoming_name", "") ?: ""
            val nextUpStartMs   = prefs.getString("next_upcoming_start_ms", "0")
                                       ?.toLongOrNull() ?: 0L

            // ── Standalone block signals ─────────────────────────────────────
            val saActive        = prefs.getBoolean("standalone_block_active", false)
            val saUntil         = prefs.getLong("standalone_block_until_ms", 0L)
            val saPkgJson       = prefs.getString("standalone_blocked_packages", "[]")

            // ── Daily progress stats (shown in idle / next-up subtitle) ──────
            val tasksDone       = prefs.getInt("daily_tasks_done", 0)
            val tasksTotal      = prefs.getInt("daily_tasks_total", 0)
            val focusMins       = prefs.getInt("daily_focus_mins", 0)
            val streakDays      = prefs.getInt("streak_days", 0)

            val isTaskRunning   = taskName.isNotBlank() && endTimeMs > now
            val isAwaiting      = !isTaskRunning && awaitingDecision && taskName.isNotBlank()
            val isStandalone    = saActive && saUntil > now && standaloneBlockedCount(saPkgJson) > 0
            val hasUpcoming     = nextUpName.isNotBlank() && nextUpStartMs > now

            when {
                isTaskRunning -> renderActiveTask(context, views, taskName, taskColor, startMs, endTimeMs, streakDays)
                isAwaiting    -> renderAwaitingDecision(context, views, taskName, taskColor)
                isStandalone  -> renderStandaloneBlock(context, views, standaloneBlockedCount(saPkgJson), saUntil)
                hasUpcoming   -> renderNextUp(context, views, nextUpName, nextUpStartMs, tasksDone, tasksTotal, focusMins)
                else          -> renderIdle(context, views, tasksDone, tasksTotal, focusMins, streakDays)
            }

            return views
        }

        // ─── Render modes ─────────────────────────────────────────────────────

        /** State 1: task is in progress (endTime still in the future). */
        private fun renderActiveTask(
            context: Context,
            views: RemoteViews,
            taskName: String,
            taskColorHex: String?,
            startMs: Long,
            endTimeMs: Long,
            streakDays: Int,
        ) {
            val now          = System.currentTimeMillis()
            val remainingMs  = (endTimeMs - now).coerceAtLeast(0L)
            val totalMs      = if (startMs > 0L) endTimeMs - startMs else remainingMs
            val progressPct  = if (totalMs > 0L)
                ((totalMs - remainingMs) * 100L / totalMs).toInt().coerceIn(0, 100)
            else 0

            val remainingMins = remainingMs / 60_000
            val timeStr = when {
                remainingMins < 1L  -> "< 1m left"
                remainingMins == 1L -> "1m left"
                else                -> "${remainingMins}m left"
            }

            val accent = parseColor(taskColorHex)
            // Append a streak suffix to the header so the user sees momentum
            // even mid-task — costs no vertical space, fits within 4×1.
            val headerText = if (streakDays >= 2) "ACTIVE TASK · 🔥 ${streakDays}" else "ACTIVE TASK"
            views.setTextViewText(R.id.widget_header_label, headerText)
            views.setTextColor(R.id.widget_header_label, accent)
            views.setTextViewText(R.id.widget_task_name, taskName)
            views.setTextViewText(R.id.widget_time_remaining, timeStr)
            views.setTextColor(R.id.widget_time_remaining, accent)
            views.setViewVisibility(R.id.widget_time_remaining, View.VISIBLE)
            views.setProgressBar(R.id.widget_progress, 100, progressPct, false)
            views.setViewVisibility(R.id.widget_progress, View.VISIBLE)
            views.setViewVisibility(R.id.widget_add_task_btn, View.GONE)
            // Active task takes the full focus — hide the stats subtitle so the
            // task name sits centred and the progress bar reads cleanly.
            applyStatsSubtitle(views, null)

            val tap = pendingDeepLink(context, PI_TAP_ROOT, "/focus")
            views.setOnClickPendingIntent(R.id.widget_root, tap)
        }

        /**
         * State 2: task timer hit zero, user hasn't resolved it yet.
         * The JS side sets task_awaiting_decision="true" and keeps task_name
         * in SharedPrefs so this state can be shown without the app running.
         */
        private fun renderAwaitingDecision(
            context: Context,
            views: RemoteViews,
            taskName: String,
            taskColorHex: String?,
        ) {
            val accent = parseColor(taskColorHex)
            views.setTextViewText(R.id.widget_header_label, "TIME'S UP")
            views.setTextColor(R.id.widget_header_label, accent)
            views.setTextViewText(R.id.widget_task_name, taskName)
            views.setTextViewText(R.id.widget_time_remaining, "Tap to resolve →")
            views.setTextColor(R.id.widget_time_remaining, accent)
            views.setViewVisibility(R.id.widget_time_remaining, View.VISIBLE)
            views.setViewVisibility(R.id.widget_progress, View.GONE)
            views.setViewVisibility(R.id.widget_add_task_btn, View.GONE)
            applyStatsSubtitle(views, null)

            val tap = pendingDeepLink(context, PI_TAP_ROOT, "/focus")
            views.setOnClickPendingIntent(R.id.widget_root, tap)
        }

        /** State 3 (when no task is active but a block session is running). */
        private fun renderStandaloneBlock(
            context: Context,
            views: RemoteViews,
            blockedCount: Int,
            untilMs: Long,
        ) {
            val accent = parseColor(DEFAULT_ACCENT)
            val plural = if (blockedCount == 1) "app" else "apps"
            views.setTextViewText(R.id.widget_header_label, "BLOCK ACTIVE")
            views.setTextColor(R.id.widget_header_label, accent)
            views.setTextViewText(
                R.id.widget_task_name,
                "Blocking $blockedCount $plural · until ${formatHmm(untilMs)}",
            )
            views.setTextViewText(R.id.widget_time_remaining, "")
            views.setViewVisibility(R.id.widget_time_remaining, View.GONE)
            views.setViewVisibility(R.id.widget_progress, View.GONE)
            views.setViewVisibility(R.id.widget_add_task_btn, View.GONE)
            applyStatsSubtitle(views, null)

            val tap = pendingDeepLink(context, PI_TAP_ROOT, "/")
            views.setOnClickPendingIntent(R.id.widget_root, tap)
        }

        /**
         * State 4: nothing running right now but a task is coming up today.
         * Shows the task name and a countdown to its start time, plus today's
         * progress so the user sees momentum even before the next task starts.
         */
        private fun renderNextUp(
            context: Context,
            views: RemoteViews,
            taskName: String,
            startMs: Long,
            tasksDone: Int,
            tasksTotal: Int,
            focusMins: Int,
        ) {
            val accent = parseColor(DEFAULT_ACCENT)
            views.setTextViewText(R.id.widget_header_label, "NEXT UP")
            views.setTextColor(R.id.widget_header_label, accent)
            views.setTextViewText(R.id.widget_task_name, taskName)
            views.setTextViewText(R.id.widget_time_remaining, minsUntilStr(startMs))
            views.setTextColor(R.id.widget_time_remaining, accent)
            views.setViewVisibility(R.id.widget_time_remaining, View.VISIBLE)
            views.setViewVisibility(R.id.widget_progress, View.GONE)
            views.setViewVisibility(R.id.widget_add_task_btn, View.GONE)
            applyStatsSubtitle(views, buildStatsSubtitle(tasksDone, tasksTotal, focusMins))

            val tap = pendingDeepLink(context, PI_TAP_ROOT, "/")
            views.setOnClickPendingIntent(R.id.widget_root, tap)
        }

        /**
         * State 5: truly idle — no active task, no upcoming task, no block.
         * Header shows brand + streak; subtitle shows today's stats so the
         * widget is never just empty space.
         */
        private fun renderIdle(
            context: Context,
            views: RemoteViews,
            tasksDone: Int,
            tasksTotal: Int,
            focusMins: Int,
            streakDays: Int,
        ) {
            val accent = parseColor(DEFAULT_ACCENT)
            val headerText = if (streakDays >= 2) "FOCUSFLOW · 🔥 ${streakDays}" else "FOCUSFLOW"
            views.setTextViewText(R.id.widget_header_label, headerText)
            views.setTextColor(R.id.widget_header_label, accent)
            // Friendlier idle message when the day's done.
            val title = when {
                tasksTotal > 0 && tasksDone >= tasksTotal -> "All done for today \uD83C\uDF89"
                tasksTotal > 0                           -> "Nothing scheduled now"
                else                                     -> "Nothing scheduled"
            }
            views.setTextViewText(R.id.widget_task_name, title)
            // Hide the time-remaining slot — the add-task pill fills the right column
            views.setTextViewText(R.id.widget_time_remaining, "")
            views.setViewVisibility(R.id.widget_time_remaining, View.GONE)
            views.setViewVisibility(R.id.widget_progress, View.GONE)
            views.setViewVisibility(R.id.widget_add_task_btn, View.VISIBLE)
            applyStatsSubtitle(views, buildStatsSubtitle(tasksDone, tasksTotal, focusMins))

            val tap    = pendingDeepLink(context, PI_TAP_ROOT, "/")
            val tapCta = pendingDeepLink(context, PI_TAP_CTA,  "/")
            views.setOnClickPendingIntent(R.id.widget_root, tap)
            views.setOnClickPendingIntent(R.id.widget_add_task_btn, tapCta)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val views = buildViews(context)
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
