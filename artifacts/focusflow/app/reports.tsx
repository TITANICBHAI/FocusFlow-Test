/**
 * reports.tsx — The screen the morning digest opens into.
 *
 * Shows a clear narrative of how the user actually spent their last day(s):
 *   • Focus-time hero (today + yesterday + week)
 *   • Task completion breakdown (on-time vs late vs early vs extended vs skipped)
 *   • Distractions — every app FocusFlow intercepted, ranked by attempts
 *   • Streak + all-time totals
 *
 * Reachable from:
 *   • Tap on the morning-digest notification (handled in app/_layout.tsx)
 *   • "Reports" button under Settings → Notifications
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import {
  dbGetTodayFocusMinutes,
  dbGetStreak,
  dbGetBestStreak,
  dbGetAllTimeFocusMinutes,
  dbGetAllTimeFocusSessions,
  dbGetTodayOverrideCount,
  dbGetRecentDayCompletions,
} from '@/data/database';
import { GreyoutModule, type TemptationEntry } from '@/native-modules/GreyoutModule';
import type { Task } from '@/data/types';

type Range = 'yesterday' | 'today' | 'week' | 'alltime';

interface AppRow { pkg: string; appName: string; count: number }
interface TaskBreakdown {
  total: number;
  completed: number;
  skipped: number;
  overdue: number;
  remaining: number;
  onTime: number;
  late: number;
  early: number;
  extended: number;
  scheduledMins: number;
  actualMins: number;
  diffMins: number;       // actualMins - scheduledMins (negative = saved time)
}

function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { state } = useApp();
  const { theme } = useTheme();
  const { tasks } = state;

  const [range, setRange] = useState<Range>('yesterday');

  // ── Data sources ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [focusMinsToday, setFocusMinsToday] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [allTimeFocus, setAllTimeFocus] = useState(0);
  const [allTimeSessions, setAllTimeSessions] = useState(0);
  const [todayOverrides, setTodayOverrides] = useState(0);
  const [temptations, setTemptations] = useState<TemptationEntry[]>([]);
  const [dayCompletions, setDayCompletions] = useState<Array<{ date: string; completed: number; total: number }>>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [fm, s, bs, atm, ats, ov, log, days] = await Promise.all([
        dbGetTodayFocusMinutes().catch(() => 0),
        dbGetStreak().catch(() => 0),
        dbGetBestStreak().catch(() => 0),
        dbGetAllTimeFocusMinutes().catch(() => 0),
        dbGetAllTimeFocusSessions().catch(() => 0),
        dbGetTodayOverrideCount().catch(() => 0),
        GreyoutModule.getTemptationLog().catch(() => [] as TemptationEntry[]),
        dbGetRecentDayCompletions(14).catch(() => [] as Array<{ date: string; completed: number; total: number }>),
      ]);
      setFocusMinsToday(fm);
      setStreak(s);
      setBestStreak(bs);
      setAllTimeFocus(atm);
      setAllTimeSessions(ats);
      setTodayOverrides(ov);
      setTemptations(log);
      setDayCompletions(days);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // ── Time window for the selected range ─────────────────────────────────
  const window = useMemo(() => {
    const now = dayjs();
    if (range === 'today') {
      return { startMs: now.startOf('day').valueOf(), endMs: now.endOf('day').valueOf(), label: now.format('MMMM D, YYYY') };
    }
    if (range === 'yesterday') {
      const y = now.subtract(1, 'day');
      return { startMs: y.startOf('day').valueOf(), endMs: y.endOf('day').valueOf(), label: `Yesterday — ${y.format('MMM D')}` };
    }
    if (range === 'week') {
      const start = now.subtract(6, 'day').startOf('day');
      return { startMs: start.valueOf(), endMs: now.endOf('day').valueOf(), label: `${start.format('MMM D')} – ${now.format('MMM D')}` };
    }
    return { startMs: 0, endMs: now.endOf('day').valueOf(), label: 'All time' };
  }, [range]);

  // ── Task breakdown for the selected window ─────────────────────────────
  const taskBreakdown = useMemo<TaskBreakdown>(() => {
    const inWindow = tasks.filter((t) => {
      const start = new Date(t.startTime).getTime();
      return start >= window.startMs && start <= window.endMs;
    });
    const completed = inWindow.filter((t) => t.status === 'completed');
    const skipped   = inWindow.filter((t) => t.status === 'skipped');
    const overdue   = inWindow.filter((t) => t.status === 'overdue');
    const remaining = inWindow.filter((t) => t.status === 'scheduled' || t.status === 'active');

    let onTime = 0, late = 0, early = 0, extended = 0;
    for (const t of completed) {
      const sched = t.durationMinutes;
      const completedAt = new Date(t.updatedAt).getTime();
      const startAt = new Date(t.startTime).getTime();
      const endAt = new Date(t.endTime).getTime();
      const actualMin = Math.round((completedAt - startAt) / 60000);
      if (completedAt > endAt + 60_000) late++;
      else if (actualMin > 0 && actualMin < sched - 1) early++;
      else onTime++;
      if (sched > (endAt - startAt) / 60000 + 1) extended++;
    }

    const scheduledMins = inWindow.reduce((s, t) => s + t.durationMinutes, 0);
    const actualMins = completed.reduce((s, t) => {
      const diff = Math.round((new Date(t.updatedAt).getTime() - new Date(t.startTime).getTime()) / 60000);
      return s + Math.max(0, Math.min(diff, t.durationMinutes * 4));
    }, 0);

    return {
      total: inWindow.length,
      completed: completed.length,
      skipped: skipped.length,
      overdue: overdue.length,
      remaining: remaining.length,
      onTime, late, early, extended,
      scheduledMins,
      actualMins,
      diffMins: actualMins - scheduledMins,
    };
  }, [tasks, window]);

  // ── Distractions for the selected window ───────────────────────────────
  const distractionRows = useMemo<AppRow[]>(() => {
    const inWindow = temptations.filter((e) => e.timestamp >= window.startMs && e.timestamp <= window.endMs);
    const map = new Map<string, AppRow>();
    for (const e of inWindow) {
      const cur = map.get(e.pkg);
      if (cur) cur.count++;
      else map.set(e.pkg, { pkg: e.pkg, appName: e.appName || e.pkg, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [temptations, window]);

  const totalAttempts = distractionRows.reduce((s, r) => s + r.count, 0);
  const maxAttempts = distractionRows[0]?.count ?? 1;

  // ── Focus minutes for the selected window (DB only has today; rest from tasks) ──
  const focusMinsWindow = useMemo(() => {
    if (range === 'today') return focusMinsToday;
    // Approximate from completed focus tasks in window.
    const inWindow = tasks.filter((t) => {
      const start = new Date(t.startTime).getTime();
      return start >= window.startMs && start <= window.endMs && t.status === 'completed' && t.focusMode;
    });
    return inWindow.reduce((s, t) => s + t.durationMinutes, 0);
  }, [range, focusMinsToday, tasks, window]);

  const completionRate = taskBreakdown.total > 0
    ? Math.round((taskBreakdown.completed / taskBreakdown.total) * 100)
    : 0;

  const focusH = Math.floor(focusMinsWindow / 60);
  const focusM = focusMinsWindow % 60;

  const canGoBack = navigation.canGoBack();

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => (canGoBack ? router.back() : router.replace('/'))}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Reports</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{window.label}</Text>
        </View>
      </View>

      {/* Range pills */}
      <View style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {(['yesterday', 'today', 'week', 'alltime'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.filterPill, range === r && { backgroundColor: COLORS.primary }]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.filterLabel, { color: range === r ? '#fff' : theme.textSecondary }]}>
              {r === 'yesterday' ? 'Yesterday' : r === 'today' ? 'Today' : r === 'week' ? 'Week' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Streak banner */}
          {streak > 0 && (
            <View style={[styles.streakBanner, { borderColor: COLORS.orange + '40' }]}>
              <Text style={styles.streakFire}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.streakTitle, { color: COLORS.orange }]}>{streak}-day streak</Text>
                <Text style={[styles.streakSub, { color: theme.muted }]}>
                  {bestStreak > streak ? `Best: ${bestStreak} days · keep it alive` : 'New record — keep it alive'}
                </Text>
              </View>
            </View>
          )}

          {/* Focus hero */}
          <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: COLORS.primary + '22' }]}>
            <Text style={[styles.heroEyebrow, { color: theme.muted }]}>FOCUSED TIME</Text>
            {focusMinsWindow > 0 ? (
              <Text style={[styles.heroTime, { color: COLORS.primary }]}>
                {focusH > 0 ? `${focusH}h ` : ''}<Text style={styles.heroTimeSmall}>{focusM}m</Text>
              </Text>
            ) : (
              <View style={styles.heroEmpty}>
                <Ionicons name="moon-outline" size={36} color={theme.border} />
                <Text style={[styles.heroEmptyText, { color: theme.muted }]}>
                  No focus time logged for this period
                </Text>
              </View>
            )}
            {range === 'today' && todayOverrides > 0 && (
              <Text style={[styles.heroFooter, { color: COLORS.orange }]}>
                {todayOverrides} override{todayOverrides !== 1 ? 's' : ''} during focus today
              </Text>
            )}
          </View>

          {/* Task summary */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Tasks</Text>
              {taskBreakdown.total > 0 && (
                <Text style={[styles.cardBadge, {
                  color: completionRate >= 80 ? COLORS.green : completionRate >= 50 ? COLORS.orange : COLORS.red,
                  backgroundColor: (completionRate >= 80 ? COLORS.green : completionRate >= 50 ? COLORS.orange : COLORS.red) + '18',
                }]}>{completionRate}% done</Text>
              )}
            </View>

            {taskBreakdown.total === 0 ? (
              <View style={styles.emptyInline}>
                <Ionicons name="calendar-outline" size={36} color={theme.border} />
                <Text style={[styles.emptyInlineText, { color: theme.muted }]}>
                  No tasks scheduled in this period
                </Text>
              </View>
            ) : (
              <>
                {[
                  { label: 'Completed', value: taskBreakdown.completed, color: COLORS.green },
                  { label: 'Skipped',   value: taskBreakdown.skipped,   color: theme.muted as string },
                  { label: 'Overdue',   value: taskBreakdown.overdue,   color: COLORS.red },
                  { label: 'Upcoming',  value: taskBreakdown.remaining, color: COLORS.blue },
                ].filter((r) => r.value > 0).map((r) => (
                  <View key={r.label} style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{r.label}</Text>
                    <View style={[styles.trackFull, { backgroundColor: theme.border }]}>
                      <View style={[styles.trackFill, { backgroundColor: r.color, width: `${Math.round((r.value / taskBreakdown.total) * 100)}%` }]} />
                    </View>
                    <Text style={[styles.statValue, { color: r.color }]}>{r.value}</Text>
                  </View>
                ))}

                {taskBreakdown.completed > 0 && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Text style={[styles.subhead, { color: theme.muted }]}>HOW THE COMPLETED TASKS WENT</Text>
                    <View style={styles.miniGrid}>
                      <MiniStat color={COLORS.green}  label="On time"  value={taskBreakdown.onTime}   theme={theme} />
                      <MiniStat color={COLORS.blue}   label="Early"    value={taskBreakdown.early}    theme={theme} />
                      <MiniStat color={COLORS.orange} label="Late"     value={taskBreakdown.late}     theme={theme} />
                      <MiniStat color={COLORS.primary} label="Extended" value={taskBreakdown.extended} theme={theme} />
                    </View>
                  </>
                )}

                {taskBreakdown.scheduledMins > 0 && (
                  <View style={{ marginTop: SPACING.sm }}>
                    <View style={styles.timeRow}>
                      <Text style={[styles.timeRowLabel, { color: theme.muted }]}>Scheduled</Text>
                      <Text style={[styles.timeRowVal,   { color: theme.text }]}>{fmtMins(taskBreakdown.scheduledMins)}</Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={[styles.timeRowLabel, { color: theme.muted }]}>Actual</Text>
                      <Text style={[styles.timeRowVal,   { color: COLORS.primary }]}>{fmtMins(taskBreakdown.actualMins)}</Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Text style={[styles.timeRowLabel, { color: theme.muted }]}>Difference</Text>
                      <Text style={[styles.timeRowVal,   {
                        color: taskBreakdown.diffMins > 5 ? COLORS.red : taskBreakdown.diffMins < -5 ? COLORS.green : theme.text,
                      }]}>
                        {taskBreakdown.diffMins > 0 ? '+' : ''}{fmtMins(Math.abs(taskBreakdown.diffMins))}
                        {taskBreakdown.diffMins > 5 ? ' over' : taskBreakdown.diffMins < -5 ? ' under' : ' on target'}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Distractions */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Distractions blocked</Text>
              <Text style={[styles.cardBadge, {
                color: totalAttempts === 0 ? COLORS.green : COLORS.orange,
                backgroundColor: (totalAttempts === 0 ? COLORS.green : COLORS.orange) + '18',
              }]}>{totalAttempts}</Text>
            </View>

            {distractionRows.length === 0 ? (
              <View style={styles.emptyInline}>
                <Ionicons name="checkmark-circle-outline" size={36} color={COLORS.green} />
                <Text style={[styles.emptyInlineText, { color: theme.muted }]}>
                  Clean slate — no blocked-app intercepts in this period
                </Text>
              </View>
            ) : (
              distractionRows.slice(0, 8).map((r, i) => (
                <View key={r.pkg} style={[styles.appRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.rankBadge, { backgroundColor: i === 0 ? COLORS.red + '18' : theme.surface }]}>
                    <Text style={[styles.rankText, { color: i === 0 ? COLORS.red : theme.muted }]}>#{i + 1}</Text>
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{r.appName}</Text>
                    <View style={[styles.trackFull, { backgroundColor: theme.border }]}>
                      <View style={[styles.trackFill, {
                        width: `${(r.count / maxAttempts) * 100}%`,
                        backgroundColor: i === 0 ? COLORS.red : COLORS.orange,
                      }]} />
                    </View>
                  </View>
                  <Text style={[styles.appCount, { color: theme.text }]}>{r.count}×</Text>
                </View>
              ))
            )}
          </View>

          {/* All-time tile */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>All-time</Text>
            <View style={styles.miniGrid}>
              <MiniStat color={COLORS.primary} label="Focused"   value={fmtMinsCompact(allTimeFocus)}     theme={theme} stringValue />
              <MiniStat color={COLORS.green}   label="Sessions"  value={String(allTimeSessions)}          theme={theme} stringValue />
              <MiniStat color={COLORS.orange}  label="Best streak" value={`${bestStreak}d`}                theme={theme} stringValue />
              <MiniStat color={COLORS.blue}    label="Days tracked" value={String(dayCompletions.length)} theme={theme} stringValue />
            </View>
          </View>

          {/* CTA back to schedule */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.ctaText}>Plan today</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function MiniStat({
  color,
  label,
  value,
  theme,
  stringValue = false,
}: {
  color: string;
  label: string;
  value: number | string;
  theme: { card: string; muted: string; text: string };
  stringValue?: boolean;
}) {
  return (
    <View style={[styles.miniTile, { borderColor: color + '22', backgroundColor: color + '0E' }]}>
      <Text style={[styles.miniValue, { color }]}>
        {stringValue ? value : String(value)}
      </Text>
      <Text style={[styles.miniLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function fmtMins(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}
function fmtMinsCompact(m: number): string {
  if (m < 60) return `${m}m`;
  return `${(m / 60).toFixed(m >= 600 ? 0 : 1)}h`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  title: { fontSize: FONT.xxl, fontWeight: '800' },
  subtitle: { fontSize: FONT.sm, marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterPill: {
    flex: 1,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  filterLabel: { fontSize: FONT.xs, fontWeight: '700' },

  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  streakFire: { fontSize: 32 },
  streakTitle: { fontSize: FONT.lg, fontWeight: '800' },
  streakSub: { fontSize: FONT.xs, marginTop: 2 },

  heroCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  heroEyebrow: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 0.8 },
  heroTime: { fontSize: 48, fontWeight: '900', marginTop: SPACING.xs },
  heroTimeSmall: { fontSize: 28, fontWeight: '700' },
  heroEmpty: { alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  heroEmptyText: { fontSize: FONT.sm },
  heroFooter: { fontSize: FONT.xs, marginTop: SPACING.xs, fontWeight: '700' },

  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: FONT.md, fontWeight: '800' },
  cardBadge: {
    fontSize: FONT.xs,
    fontWeight: '800',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.xs },
  subhead: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 0.8, marginBottom: SPACING.xs },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 2 },
  statLabel: { width: 78, fontSize: FONT.sm },
  statValue: { width: 28, fontSize: FONT.sm, fontWeight: '800', textAlign: 'right' },
  trackFull: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%' },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  miniTile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  miniValue: { fontSize: FONT.lg, fontWeight: '900' },
  miniLabel: { fontSize: FONT.xs },

  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  timeRowLabel: { fontSize: FONT.sm },
  timeRowVal: { fontSize: FONT.sm, fontWeight: '700' },

  emptyInline: { alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.md },
  emptyInlineText: { fontSize: FONT.sm, textAlign: 'center' },

  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankBadge: {
    minWidth: 30,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  rankText: { fontSize: FONT.xs, fontWeight: '800' },
  appInfo: { flex: 1, gap: 4 },
  appName: { fontSize: FONT.sm, fontWeight: '600' },
  appCount: { fontSize: FONT.sm, fontWeight: '800', minWidth: 36, textAlign: 'right' },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  ctaText: { color: '#fff', fontSize: FONT.md, fontWeight: '800' },
});

export default withScreenErrorBoundary(ReportsScreen, 'Reports');
