/**
 * stats.tsx — FocusFlow Stats Screen
 *
 * Four tabs:
 *  Yesterday — morning digest: individual task rows (name, scheduled vs actual,
 *              on-time/early/late/extended), distractions, bitter-truth summary
 *  Today     — focus time hero, session count, task summary, blocked attempts
 *  Week      — task productivity trend, focus time bar chart, app discipline
 *  All Time  — lifetime hero numbers, 12-week calendar heatmap, milestone badges
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  dbGetTodayFocusMinutes,
  dbGetTodayOverrideCount,
  dbGetStreak,
  dbRecordDayCompletion,
  dbGetRecentDayCompletions,
  dbGetAllTimeFocusMinutes,
  dbGetAllTimeFocusSessions,
  dbGetBestStreak,
  dbGetTasksInDateRange,
} from '@/data/database';
import { GreyoutModule, TemptationEntry } from '@/native-modules/GreyoutModule';
import type { Task } from '@/data/types';

type Filter = 'yesterday' | 'today' | 'week' | 'alltime';

interface AppStat  { pkg: string; appName: string; count: number }
interface DayStat  { day: string; date: string; count: number }
interface WeekDay  { day: string; date: string; isToday: boolean; total: number; completed: number; focusMinutes: number }
interface HeatDay  { date: string; rate: number; hasData: boolean }

interface TaskRow {
  id: string;
  title: string;
  scheduledMins: number;
  actualMins: number;
  status: 'completed' | 'skipped' | 'overdue' | 'remaining';
  timing: 'ontime' | 'early' | 'late' | 'extended' | null;
  focusMode: boolean;
}

interface YesterdayBreakdown {
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
  diffMins: number;
  rows: TaskRow[];
}

// ─────────────────────────────────────────────────────────────────────────────

function StatsScreen() {
  const insets          = useSafeAreaInsets();
  const { state }       = useApp();
  const { theme }       = useTheme();
  const { width }       = useWindowDimensions();

  const [filter, setFilter] = useState<Filter>('yesterday');

  // ── TODAY DB data ─────────────────────────────────────────────────────────
  const [focusMinutes,  setFocusMinutes]  = useState(0);
  const [overrideCount, setOverrideCount] = useState(0);
  const [streak,        setStreak]        = useState(0);

  // ── Historical tasks (last 30 days) — `state.tasks` only holds today + a
  //    handful of unresolved items, so Yesterday / Week / All-Time tabs need
  //    their own fetch from the DB. Refreshes whenever today's task list
  //    changes (so a just-completed task is reflected without re-mounting).
  const [historicalTasks, setHistoricalTasks] = useState<Task[]>([]);
  const [historicalError, setHistoricalError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          setHistoricalError(false);
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          const rows = await dbGetTasksInDateRange(start.toISOString(), end.toISOString());
          setHistoricalTasks(rows);
        } catch {
          setHistoricalError(true);
        }
      })();
    }, [])
  );

  // Use the historical set as the canonical source for the breakdown screens.
  // Falls back to state.tasks while the historical fetch is still in-flight.
  const tasks = historicalTasks.length > 0 ? historicalTasks : state.tasks;

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [fm, oc, s] = await Promise.all([
          dbGetTodayFocusMinutes(),
          dbGetTodayOverrideCount(),
          dbGetStreak(),
        ]);
        setFocusMinutes(fm);
        setOverrideCount(oc);
        setStreak(s);
      })();
    }, [])
  );

  // ── YESTERDAY breakdown ───────────────────────────────────────────────────
  const yesterdayBreakdown = useMemo<YesterdayBreakdown>(() => {
    const yd       = dayjs().subtract(1, 'day');
    const ydStr    = yd.format('YYYY-MM-DD');
    const inWindow = tasks.filter((t) => dayjs(t.startTime).format('YYYY-MM-DD') === ydStr);

    const completed = inWindow.filter((t) => t.status === 'completed');
    const skipped   = inWindow.filter((t) => t.status === 'skipped');
    const overdue   = inWindow.filter((t) => t.status === 'overdue');
    const remaining = inWindow.filter((t) => t.status === 'scheduled' || t.status === 'active');

    let onTime = 0, late = 0, early = 0, extended = 0;
    const rows: TaskRow[] = inWindow.map((t) => {
      const startMs      = new Date(t.startTime).getTime();
      const endMs        = new Date(t.endTime).getTime();
      const updatedMs    = new Date(t.updatedAt).getTime();
      const scheduledMin = t.durationMinutes;
      const actualMin    = t.status === 'completed'
        ? Math.max(0, Math.min(Math.round((updatedMs - startMs) / 60000), scheduledMin * 4))
        : 0;

      let timing: TaskRow['timing'] = null;
      if (t.status === 'completed') {
        const isExtended = scheduledMin > Math.round((endMs - startMs) / 60000) + 1;
        if (isExtended)           { timing = 'extended'; extended++; }
        else if (updatedMs > endMs + 60_000) { timing = 'late';     late++; }
        else if (actualMin > 0 && actualMin < scheduledMin - 1) { timing = 'early'; early++; }
        else                      { timing = 'ontime';  onTime++; }
      }

      const status: TaskRow['status'] =
        t.status === 'completed' ? 'completed'
        : t.status === 'skipped' ? 'skipped'
        : t.status === 'overdue' ? 'overdue'
        : 'remaining';

      return {
        id: t.id, title: t.title,
        scheduledMins: scheduledMin,
        actualMins:    actualMin,
        status, timing,
        focusMode: t.focusMode,
      };
    });

    const scheduledMins = inWindow.reduce((s, t) => s + t.durationMinutes, 0);
    const actualMins    = completed.reduce((s, t) => {
      const diff = Math.round((new Date(t.updatedAt).getTime() - new Date(t.startTime).getTime()) / 60000);
      return s + Math.max(0, Math.min(diff, t.durationMinutes * 4));
    }, 0);

    return {
      total: inWindow.length, completed: completed.length,
      skipped: skipped.length, overdue: overdue.length, remaining: remaining.length,
      onTime, late, early, extended, scheduledMins, actualMins,
      diffMins: actualMins - scheduledMins, rows,
    };
  }, [tasks]);

  const yesterdayFocusMins = useMemo(() => {
    const ydStr = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    return tasks
      .filter((t) => dayjs(t.startTime).format('YYYY-MM-DD') === ydStr && t.status === 'completed' && t.focusMode)
      .reduce((s, t) => s + t.durationMinutes, 0);
  }, [tasks]);

  // ── TODAY computed stats ──────────────────────────────────────────────────
  const todayStats = useMemo(() => {
    const todayStr   = dayjs().format('YYYY-MM-DD');
    const todayTasks = tasks.filter((t) => dayjs(t.startTime).format('YYYY-MM-DD') === todayStr);
    const completed  = todayTasks.filter((t) => t.status === 'completed');
    const skipped    = todayTasks.filter((t) => t.status === 'skipped');
    const overdue    = todayTasks.filter((t) => t.status === 'overdue');
    const remaining  = todayTasks.filter((t) => t.status === 'scheduled' || t.status === 'active');
    const total      = todayTasks.length;
    const rate       = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    return {
      total, completed: completed.length, skipped: skipped.length,
      overdue: overdue.length, remaining: remaining.length, rate,
      minsScheduled:  todayTasks.reduce((s, t) => s + t.durationMinutes, 0),
      minsCompleted:  completed.reduce((s, t) => s + t.durationMinutes, 0),
      focusTasks:     todayTasks.filter((t) => t.focusMode).length,
      topTags:        getTopTags(todayTasks),
    };
  }, [tasks]);

  useEffect(() => {
    if (todayStats.total > 0) {
      void dbRecordDayCompletion(todayStats.completed, todayStats.total);
    }
  }, [todayStats.completed, todayStats.total]);

  const focusHero = fmtMinsLong(focusMinutes);
  const rateColor = todayStats.rate >= 80 ? COLORS.green : todayStats.rate >= 50 ? COLORS.orange : COLORS.primary;

  // ── WEEK computed stats (from state.tasks) ─────────────────────────────
  const weeklyDays = useMemo<WeekDay[]>(() => {
    const days: WeekDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d        = dayjs().subtract(i, 'day');
      const dStr     = d.format('YYYY-MM-DD');
      const dayTasks = tasks.filter((t) => dayjs(t.startTime).format('YYYY-MM-DD') === dStr);
      const done     = dayTasks.filter((t) => t.status === 'completed');
      days.push({
        day: d.format('ddd'), date: d.format('MMM D'), isToday: i === 0,
        total: dayTasks.length, completed: done.length,
        focusMinutes: done.filter((t) => t.focusMode).reduce((s, t) => s + t.durationMinutes, 0),
      });
    }
    return days;
  }, [tasks]);

  const weekSummary = useMemo(() => {
    const total     = weeklyDays.reduce((s, d) => s + d.total, 0);
    const completed = weeklyDays.reduce((s, d) => s + d.completed, 0);
    const focusMins = weeklyDays.reduce((s, d) => s + d.focusMinutes, 0);
    return { total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0, focusMins };
  }, [weeklyDays]);

  const maxWeekCompleted = Math.max(...weeklyDays.map((d) => d.completed), 1);
  const maxWeekFocus     = Math.max(...weeklyDays.map((d) => d.focusMinutes), 1);

  // ── TEMPTATION LOG (yesterday + week view + all-time) ─────────────────────────────
  const [weekLoading,    setWeekLoading]    = useState(false);
  const [allTemptations, setAllTemptations] = useState<TemptationEntry[]>([]);
  const [appStats,       setAppStats]       = useState<AppStat[]>([]);
  const [dayStats,       setDayStats]       = useState<DayStat[]>([]);
  const [totalThisWeek,  setTotalThisWeek]  = useState(0);
  const [totalAllTime,   setTotalAllTime]   = useState(0);
  const [cleanStreak,    setCleanStreak]    = useState(0);

  const loadWeekly = useCallback(async () => {
    setWeekLoading(true);
    try { processWeeklyData(await GreyoutModule.getTemptationLog()); }
    catch { processWeeklyData([]); }
    finally { setWeekLoading(false); }
  }, []);

  useEffect(() => {
    if (filter === 'yesterday' || filter === 'week' || filter === 'alltime') void loadWeekly();
  }, [filter, loadWeekly]);

  function processWeeklyData(log: TemptationEntry[]) {
    setAllTemptations(log);
    const cutoff   = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = log.filter((e) => e.timestamp >= cutoff);
    setTotalThisWeek(thisWeek.length);
    setTotalAllTime(log.length);
    const appMap = new Map<string, AppStat>();
    for (const e of thisWeek) {
      const ex = appMap.get(e.pkg);
      if (ex) ex.count++; else appMap.set(e.pkg, { pkg: e.pkg, appName: e.appName || e.pkg, count: 1 });
    }
    setAppStats(Array.from(appMap.values()).sort((a, b) => b.count - a.count));
    const days: DayStat[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day');
      days.push({ day: d.format('ddd'), date: d.format('MMM D'),
        count: log.filter((e) => e.timestamp >= d.startOf('day').valueOf() && e.timestamp <= d.endOf('day').valueOf()).length });
    }
    setDayStats(days);
    let cs = 0;
    for (let i = days.length - 1; i >= 0; i--) { if (days[i].count === 0) cs++; else break; }
    setCleanStreak(cs);
  }

  // Yesterday distractions derived from full temptation log
  const yesterdayDistractions = useMemo<AppStat[]>(() => {
    const yd = dayjs().subtract(1, 'day');
    const inWindow = allTemptations.filter(
      (e) => e.timestamp >= yd.startOf('day').valueOf() && e.timestamp <= yd.endOf('day').valueOf(),
    );
    const map = new Map<string, AppStat>();
    for (const e of inWindow) {
      const cur = map.get(e.pkg);
      if (cur) cur.count++;
      else map.set(e.pkg, { pkg: e.pkg, appName: e.appName || e.pkg, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allTemptations]);

  const handleClearLog = () => {
    Alert.alert('Clear Temptation Log', 'Permanently delete all blocked-app intercept data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { await GreyoutModule.clearTemptationLog(); await loadWeekly(); } },
    ]);
  };

  // ── ALL TIME DB data ──────────────────────────────────────────────────
  const [allTimeLoading, setAllTimeLoading] = useState(false);
  const [allTimeMins,    setAllTimeMins]    = useState(0);
  const [allTimeSess,    setAllTimeSess]    = useState(0);
  const [bestStreak,     setBestStreak]     = useState(0);
  const [heatData,       setHeatData]       = useState<HeatDay[]>([]);

  useEffect(() => {
    if (filter !== 'alltime') return;
    setAllTimeLoading(true);
    void (async () => {
      const [atm, ats, bs, rows] = await Promise.all([
        dbGetAllTimeFocusMinutes(),
        dbGetAllTimeFocusSessions(),
        dbGetBestStreak(),
        dbGetRecentDayCompletions(84),
      ]);
      setAllTimeMins(atm);
      setAllTimeSess(ats);
      setBestStreak(bs);
      const map = new Map(rows.map((r) => [r.date, r]));
      const heat: HeatDay[] = [];
      for (let i = 83; i >= 0; i--) {
        const d   = dayjs().subtract(i, 'day');
        const key = d.format('YYYY-MM-DD');
        const row = map.get(key);
        heat.push({
          date:    key,
          hasData: !!row && row.total > 0,
          rate:    row && row.total > 0 ? row.completed / row.total : 0,
        });
      }
      setHeatData(heat);
      setAllTimeLoading(false);
    })();
  }, [filter]);

  const allTimeTasksCompleted = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks],
  );

  const maxDay = Math.max(...dayStats.map((d) => d.count), 1);
  const maxApp = appStats[0]?.count ?? 1;
  const maxYdApp = yesterdayDistractions[0]?.count ?? 1;

  const ydCompletionRate = yesterdayBreakdown.total > 0
    ? Math.round((yesterdayBreakdown.completed / yesterdayBreakdown.total) * 100)
    : 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Stats</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {filter === 'yesterday' ? dayjs().subtract(1, 'day').format('ddd, MMM D')
           : filter === 'today'    ? dayjs().format('MMMM D, YYYY')
           : filter === 'week'     ? `${dayjs().subtract(6, 'day').format('MMM D')} – ${dayjs().format('MMM D')}`
           :                         'All time'}
          </Text>
        </View>
      </View>

      {/* ── Tab pills (sticky, high-contrast) ────────────────────────── */}
      <View style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {(['yesterday', 'today', 'week', 'alltime'] as const).map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isActive ? COLORS.primary : COLORS.primary + '12',
                  borderColor: isActive ? COLORS.primary : COLORS.primary + '33',
                },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLabel, { color: isActive ? '#fff' : COLORS.primary }]}>
                {f === 'yesterday' ? 'Yesterday' : f === 'today' ? 'Today' : f === 'week' ? 'Week' : 'All Time'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DB error banner — shown when historical data could not be loaded */}
      {historicalError && filter !== 'today' && (
        <View style={[styles.dbErrorBanner, { backgroundColor: COLORS.orange + '18', borderColor: COLORS.orange + '44' }]}>
          <Ionicons name="warning-outline" size={16} color={COLORS.orange} />
          <Text style={[styles.dbErrorText, { color: COLORS.orange }]}>
            History unavailable — could not read task database. Today's data is unaffected.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setHistoricalError(false);
              void (async () => {
                try {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 30);
                  const rows = await dbGetTasksInDateRange(start.toISOString(), end.toISOString());
                  setHistoricalTasks(rows);
                } catch {
                  setHistoricalError(true);
                }
              })();
            }}
            style={styles.retryBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={16} color={COLORS.orange} />
          </TouchableOpacity>
        </View>
      )}

      {/* ════════════════ YESTERDAY ═════════════════════════════════════ */}
      {filter === 'yesterday' && (
        weekLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <ScrollView style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>

            {/* Streak banner */}
            {streak > 0 && (
              <View style={[styles.streakBanner, { borderColor: COLORS.orange + '40' }]}>
                <Text style={styles.streakFire}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streakTitle, { color: COLORS.orange }]}>{streak}-day streak</Text>
                  <Text style={[styles.streakSub, { color: theme.textSecondary }]}>Keep completing tasks daily</Text>
                </View>
              </View>
            )}

            {/* Bitter truth motivational card */}
            {yesterdayBreakdown.total > 0 && (
              <View style={[styles.bitterCard, {
                backgroundColor: ydCompletionRate >= 80 ? COLORS.green + '0E' : ydCompletionRate >= 50 ? COLORS.orange + '0E' : COLORS.red + '0E',
                borderColor:     ydCompletionRate >= 80 ? COLORS.green + '33' : ydCompletionRate >= 50 ? COLORS.orange + '33' : COLORS.red + '33',
              }]}>
                <Text style={[styles.bitterText, {
                  color: ydCompletionRate >= 80 ? COLORS.green : ydCompletionRate >= 50 ? COLORS.orange : COLORS.red,
                }]}>
                  {getBitterTruth(ydCompletionRate, yesterdayBreakdown, yesterdayFocusMins)}
                </Text>
              </View>
            )}

            {/* Focus hero */}
            <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: COLORS.primary + '22' }]}>
              <Text style={[styles.heroEyebrow, { color: theme.muted }]}>FOCUSED TIME YESTERDAY</Text>
              {yesterdayFocusMins > 0 ? (
                <Text style={[styles.heroTime, { color: COLORS.primary }]}>
                  {Math.floor(yesterdayFocusMins / 60) > 0 ? `${Math.floor(yesterdayFocusMins / 60)}h ` : ''}
                  <Text style={styles.heroTimeSmall}>{yesterdayFocusMins % 60}m</Text>
                </Text>
              ) : (
                <View style={styles.heroEmpty}>
                  <Ionicons name="moon-outline" size={36} color={theme.border} />
                  <Text style={[styles.heroEmptyText, { color: theme.muted }]}>No focus sessions yesterday</Text>
                </View>
              )}
            </View>

            {/* Task list */}
            {yesterdayBreakdown.total === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={52} color={theme.border} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No tasks yesterday</Text>
                <Text style={[styles.emptySub, { color: theme.muted }]}>Schedule tasks to start tracking daily performance</Text>
              </View>
            ) : (
              <>
                {/* Summary header */}
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Task Summary</Text>
                    <Text style={[styles.cardBadge, {
                      color: ydCompletionRate >= 80 ? COLORS.green : ydCompletionRate >= 50 ? COLORS.orange : COLORS.red,
                      backgroundColor: (ydCompletionRate >= 80 ? COLORS.green : ydCompletionRate >= 50 ? COLORS.orange : COLORS.red) + '18',
                    }]}>{ydCompletionRate}% done</Text>
                  </View>

                  {/* On time / Early / Late / Extended mini-grid */}
                  {yesterdayBreakdown.completed > 0 && (
                    <View style={styles.miniGrid}>
                      <MiniStat color={COLORS.green}   label="On time"  value={yesterdayBreakdown.onTime}   theme={theme} />
                      <MiniStat color={COLORS.blue}    label="Early"    value={yesterdayBreakdown.early}    theme={theme} />
                      <MiniStat color={COLORS.orange}  label="Late"     value={yesterdayBreakdown.late}     theme={theme} />
                      <MiniStat color={COLORS.primary} label="Extended" value={yesterdayBreakdown.extended} theme={theme} />
                    </View>
                  )}

                  {/* Scheduled vs Actual vs Diff */}
                  {yesterdayBreakdown.scheduledMins > 0 && (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <View style={styles.timeRow}>
                        <Text style={[styles.timeRowLabel, { color: theme.muted }]}>Scheduled</Text>
                        <Text style={[styles.timeRowVal, { color: theme.text }]}>{fmtMins(yesterdayBreakdown.scheduledMins)}</Text>
                      </View>
                      <View style={styles.timeRow}>
                        <Text style={[styles.timeRowLabel, { color: theme.muted }]}>Actual</Text>
                        <Text style={[styles.timeRowVal, { color: COLORS.primary }]}>{fmtMins(yesterdayBreakdown.actualMins)}</Text>
                      </View>
                      <View style={styles.timeRow}>
                        <Text style={[styles.timeRowLabel, { color: theme.muted }]}>Difference</Text>
                        <Text style={[styles.timeRowVal, {
                          color: yesterdayBreakdown.diffMins > 5 ? COLORS.red : yesterdayBreakdown.diffMins < -5 ? COLORS.green : theme.text,
                        }]}>
                          {yesterdayBreakdown.diffMins > 0 ? '+' : ''}{fmtMins(Math.abs(yesterdayBreakdown.diffMins))}
                          {yesterdayBreakdown.diffMins > 5 ? ' over' : yesterdayBreakdown.diffMins < -5 ? ' under' : ' on target'}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Individual task rows */}
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Task Breakdown</Text>
                  {yesterdayBreakdown.rows.map((row, i) => (
                    <YesterdayTaskRow key={row.id} row={row} isLast={i === yesterdayBreakdown.rows.length - 1} theme={theme} />
                  ))}
                </View>
              </>
            )}

            {/* Distractions yesterday */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Distractions blocked</Text>
                <Text style={[styles.cardBadge, {
                  color: yesterdayDistractions.length === 0 ? COLORS.green : COLORS.orange,
                  backgroundColor: (yesterdayDistractions.length === 0 ? COLORS.green : COLORS.orange) + '18',
                }]}>
                  {yesterdayDistractions.reduce((s, r) => s + r.count, 0)}
                </Text>
              </View>
              {yesterdayDistractions.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Ionicons name="checkmark-circle-outline" size={36} color={COLORS.green} />
                  <Text style={[styles.emptyInlineText, { color: theme.muted }]}>Clean slate — no blocked-app intercepts yesterday</Text>
                </View>
              ) : (
                yesterdayDistractions.slice(0, 6).map((r, i) => (
                  <View key={r.pkg} style={[styles.appRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.rankBadge, { backgroundColor: i === 0 ? COLORS.red + '18' : theme.surface }]}>
                      <Text style={[styles.rankText, { color: i === 0 ? COLORS.red : theme.muted }]}>#{i + 1}</Text>
                    </View>
                    <View style={styles.appInfo}>
                      <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{r.appName}</Text>
                      <View style={[styles.trackFull, { backgroundColor: theme.border }]}>
                        <View style={[styles.trackFill, { width: `${(r.count / maxYdApp) * 100}%`, backgroundColor: i === 0 ? COLORS.red : COLORS.orange }]} />
                      </View>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: i === 0 ? COLORS.red + '18' : theme.surface }]}>
                      <Text style={[styles.countText, { color: i === 0 ? COLORS.red : theme.text }]}>{r.count}×</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        )
      )}

      {/* ════════════════ TODAY ═════════════════════════════════════════ */}
      {filter === 'today' && (
        <ScrollView style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}>

          {/* Streak banner */}
          {streak > 0 && (
            <View style={[styles.streakBanner, { borderColor: COLORS.orange + '40' }]}>
              <Text style={styles.streakFire}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.streakTitle, { color: COLORS.orange }]}>{streak}-day streak!</Text>
                <Text style={[styles.streakSub, { color: theme.textSecondary }]}>Keep completing tasks daily</Text>
              </View>
            </View>
          )}

          {/* ── Focus Time Hero ────────────────────────────────────────── */}
          <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: COLORS.primary + '22' }]}>
            <Text style={[styles.heroEyebrow, { color: theme.muted }]}>FOCUS TIME TODAY</Text>
            {focusMinutes > 0 ? (
              <>
                <Text style={[styles.heroTime, { color: COLORS.primary }]}>{focusHero.h > 0 ? `${focusHero.h}h ` : ''}<Text style={styles.heroTimeSmall}>{focusHero.m}m</Text></Text>
                <View style={styles.heroRow}>
                  {focusMinutes > 0 && <Pill icon="timer-outline" color={COLORS.primary} label={`${todayStats.focusTasks} focus task${todayStats.focusTasks !== 1 ? 's' : ''}`} theme={theme} />}
                  {overrideCount > 0 && <Pill icon="warning-outline" color={COLORS.orange} label={`${overrideCount} override${overrideCount !== 1 ? 's' : ''}`} theme={theme} />}
                </View>
              </>
            ) : (
              <View style={styles.heroEmpty}>
                <Ionicons name="timer-outline" size={40} color={theme.border} />
                <Text style={[styles.heroEmptyText, { color: theme.muted }]}>Start a focus session to track time</Text>
              </View>
            )}
          </View>

          {/* ── Task Summary ───────────────────────────────────────────── */}
          {todayStats.total > 0 ? (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Tasks</Text>
                <Text style={[styles.cardBadge, { color: rateColor, backgroundColor: rateColor + '18' }]}>{todayStats.rate}% done</Text>
              </View>
              {[
                { label: 'Completed', value: todayStats.completed, color: COLORS.green },
                { label: 'Remaining', value: todayStats.remaining, color: COLORS.blue },
                { label: 'Skipped',   value: todayStats.skipped,   color: theme.muted as string },
                { label: 'Overdue',   value: todayStats.overdue,   color: COLORS.red },
              ].filter((r) => r.value > 0).map((r) => (
                <View key={r.label} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>{r.label}</Text>
                  <View style={[styles.trackFull, { backgroundColor: theme.border }]}>
                    <View style={[styles.trackFill, { backgroundColor: r.color, width: `${Math.round((r.value / todayStats.total) * 100)}%` }]} />
                  </View>
                  <Text style={[styles.breakdownValue, { color: r.color }]}>{r.value}</Text>
                </View>
              ))}
              {todayStats.minsScheduled > 0 && (
                <View style={{ marginTop: SPACING.xs }}>
                  <View style={styles.progLabels}>
                    <Text style={[styles.progText, { color: theme.muted }]}>{fmtMins(todayStats.minsCompleted)} of {fmtMins(todayStats.minsScheduled)} scheduled time</Text>
                  </View>
                  <View style={[styles.trackFull, { backgroundColor: theme.border, marginTop: 5 }]}>
                    <View style={[styles.trackFill, { backgroundColor: COLORS.green,
                      width: `${Math.min(100, (todayStats.minsCompleted / todayStats.minsScheduled) * 100)}%` }]} />
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={52} color={theme.border} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing scheduled today</Text>
              <Text style={[styles.emptySub, { color: theme.muted }]}>Add tasks to start tracking your productivity</Text>
            </View>
          )}

          {/* ── Top Tags ──────────────────────────────────────────────── */}
          {todayStats.topTags.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Today's Tags</Text>
              <View style={styles.tagsWrap}>
                {todayStats.topTags.map(({ tag, count }) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}>
                    <Text style={[styles.tagText, { color: COLORS.primary }]}>#{tag}</Text>
                    <View style={[styles.tagCount, { backgroundColor: COLORS.primary + '20' }]}>
                      <Text style={[styles.tagCountText, { color: COLORS.primary }]}>{count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Encouragement ─────────────────────────────────────────── */}
          <View style={[styles.encourageCard, { backgroundColor: COLORS.primary + '0E', borderColor: COLORS.primary + '22' }]}>
            <Text style={[styles.encourageText, { color: COLORS.primary }]}>
              {getMotivation(focusMinutes, todayStats.rate, streak)}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ════════════════ WEEK ══════════════════════════════════════════ */}
      {filter === 'week' && (
        weekLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <ScrollView style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>

            <SectionLabel label="TASK PRODUCTIVITY" theme={theme} />

            {/* Week summary chips */}
            <View style={styles.chipRow}>
              <InfoChip icon="list-outline"           label="Tasks"   value={String(weekSummary.total)}   color={COLORS.blue}    theme={theme} />
              <InfoChip icon="checkmark-circle-outline" label="Done"   value={weekSummary.rate > 0 ? `${weekSummary.rate}%` : '—'}
                color={weekSummary.rate >= 80 ? COLORS.green : weekSummary.rate >= 50 ? COLORS.orange : COLORS.red} theme={theme} />
              <InfoChip icon="timer-outline"           label="Focus"   value={weekSummary.focusMins > 0 ? fmtMins(weekSummary.focusMins) : '—'} color={COLORS.primary} theme={theme} />
            </View>

            {/* Tasks completed per day */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Tasks Completed per Day</Text>
              <DualBarChart days={weeklyDays} maxC={maxWeekCompleted} maxF={maxWeekFocus} theme={theme} />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.green }]} /><Text style={[styles.legendLabel, { color: theme.muted }]}>Completed</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.primary + '60' }]} /><Text style={[styles.legendLabel, { color: theme.muted }]}>Focus mins</Text></View>
              </View>
            </View>

            <SectionLabel label="APP DISCIPLINE" theme={theme} />

            {/* App discipline chips */}
            <View style={styles.chipRow}>
              <InfoChip icon="shield-checkmark" label="Blocked"    value={String(totalThisWeek)}    color={totalThisWeek === 0 ? COLORS.green : COLORS.orange} theme={theme} />
              <InfoChip icon="flame"            label="Clean Days" value={`${cleanStreak}d`}         color={cleanStreak > 0 ? COLORS.green : theme.muted as string} theme={theme} />
              <InfoChip icon="apps-outline"     label="Apps"       value={String(appStats.length)}   color={COLORS.blue} theme={theme} />
            </View>

            {/* Daily blocked attempts */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Block Intercepts per Day</Text>
              <View style={styles.barChart}>
                {dayStats.map((d, i) => {
                  const isToday  = i === dayStats.length - 1;
                  const pct      = d.count === 0 ? 0 : Math.max(0.06, d.count / maxDay);
                  const barColor = d.count === 0 ? COLORS.green : isToday ? COLORS.primary : COLORS.orange;
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <Text style={[styles.barCount, { color: d.count === 0 ? COLORS.green : theme.text }]}>{d.count === 0 ? '✓' : d.count}</Text>
                      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
                        <View style={[styles.barFill, { height: `${pct * 100}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[styles.barDay, { color: isToday ? COLORS.primary : theme.muted, fontWeight: isToday ? '700' : '500' }]}>{d.day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Most tempting apps */}
            {appStats.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Most Tempting Apps</Text>
                {appStats.slice(0, 6).map((a, i) => (
                  <View key={a.pkg} style={[styles.appRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.rankBadge, { backgroundColor: i === 0 ? COLORS.red + '18' : theme.surface }]}>
                      <Text style={[styles.rankText, { color: i === 0 ? COLORS.red : theme.muted }]}>#{i + 1}</Text>
                    </View>
                    <View style={styles.appInfo}>
                      <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{a.appName}</Text>
                      <View style={[styles.trackFull, { backgroundColor: theme.border }]}>
                        <View style={[styles.trackFill, { width: `${(a.count / maxApp) * 100}%`, backgroundColor: i === 0 ? COLORS.red : COLORS.orange }]} />
                      </View>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: i === 0 ? COLORS.red + '18' : theme.surface }]}>
                      <Text style={[styles.countText, { color: i === 0 ? COLORS.red : theme.text }]}>{a.count}×</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {appStats.length === 0 && dayStats.length > 0 && dayStats.every((d) => d.count === 0) && (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark" size={52} color={COLORS.green} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Perfect discipline this week!</Text>
                <Text style={[styles.emptySub, { color: theme.muted }]}>No blocked-app intercepts — you resisted every distraction.</Text>
              </View>
            )}
          </ScrollView>
        )
      )}

      {/* ════════════════ ALL TIME ══════════════════════════════════════ */}
      {filter === 'alltime' && (
        allTimeLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <ScrollView style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>

            {/* ── All-time hero ──────────────────────────────────────── */}
            <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: COLORS.primary + '22' }]}>
              <Text style={[styles.heroEyebrow, { color: theme.muted }]}>TOTAL FOCUS TIME</Text>
              {allTimeMins > 0 ? (
                <>
                  <Text style={[styles.heroTime, { color: COLORS.primary }]}>
                    {Math.floor(allTimeMins / 60) > 0 ? `${Math.floor(allTimeMins / 60)}h ` : ''}
                    <Text style={styles.heroTimeSmall}>{allTimeMins % 60}m</Text>
                  </Text>
                  <Text style={[styles.heroSub, { color: theme.muted }]}>{allTimeSess} focus session{allTimeSess !== 1 ? 's' : ''} total</Text>
                </>
              ) : (
                <View style={styles.heroEmpty}>
                  <Ionicons name="hourglass-outline" size={40} color={theme.border} />
                  <Text style={[styles.heroEmptyText, { color: theme.muted }]}>Complete your first focus session to start building your history</Text>
                </View>
              )}
            </View>

            {/* ── Lifetime stats grid ────────────────────────────────── */}
            <View style={styles.lifeGrid}>
              <LifeStat icon="checkmark-done-circle" color={COLORS.green}   label="Tasks Done"    value={String(allTimeTasksCompleted)} theme={theme} />
              <LifeStat icon="flame"                 color={COLORS.orange}  label="Best Streak"   value={`${bestStreak}d`}             theme={theme} />
              <LifeStat icon="shield-checkmark"      color={COLORS.blue}    label="Apps Blocked"  value={String(totalAllTime)}         theme={theme} />
              <LifeStat icon="trophy"                color={COLORS.purple}  label="Days Active"   value={String(heatData.filter((d) => d.hasData).length)} theme={theme} />
            </View>

            {/* ── Calendar heatmap ───────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Activity — Last 12 Weeks</Text>
              <CalendarHeatmap data={heatData} width={width - SPACING.md * 4} theme={theme} />
              <View style={styles.heatLegendRow}>
                <Text style={[styles.heatLegendLabel, { color: theme.muted }]}>Less</Text>
                {[0, 0.3, 0.6, 1].map((v, i) => (
                  <View key={i} style={[styles.heatDot, { backgroundColor: heatColor(v, true) }]} />
                ))}
                <Text style={[styles.heatLegendLabel, { color: theme.muted }]}>More</Text>
              </View>
            </View>

            {/* ── Milestone badges ───────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Milestones</Text>
              <View style={styles.badgeGrid}>
                {getMilestones(allTimeMins, allTimeTasksCompleted, bestStreak, totalAllTime).map((m) => (
                  <View key={m.label} style={[styles.badge, { backgroundColor: m.earned ? m.color + '18' : theme.surface, borderColor: m.earned ? m.color + '44' : theme.border }]}>
                    <Text style={styles.badgeIcon}>{m.icon}</Text>
                    <Text style={[styles.badgeLabel, { color: m.earned ? m.color : theme.muted }]}>{m.label}</Text>
                    <Text style={[styles.badgeSub, { color: theme.muted }]}>{m.sub}</Text>
                  </View>
                ))}
              </View>
            </View>

          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function YesterdayTaskRow({ row, isLast, theme }: { row: TaskRow; isLast: boolean; theme: any }) {
  const timingColor =
    row.timing === 'ontime'  ? COLORS.green  :
    row.timing === 'early'   ? COLORS.blue   :
    row.timing === 'late'    ? COLORS.orange :
    row.timing === 'extended'? COLORS.primary:
    row.status === 'skipped' ? theme.muted   :
    row.status === 'overdue' ? COLORS.red    : theme.muted;

  const timingLabel =
    row.timing === 'ontime'  ? 'On time'  :
    row.timing === 'early'   ? 'Early'    :
    row.timing === 'late'    ? 'Late'     :
    row.timing === 'extended'? 'Extended' :
    row.status === 'skipped' ? 'Skipped'  :
    row.status === 'overdue' ? 'Overdue'  :
    row.status === 'remaining'? 'Upcoming' : '—';

  const icon =
    row.status === 'completed' ? 'checkmark-circle' :
    row.status === 'skipped'   ? 'remove-circle-outline' :
    row.status === 'overdue'   ? 'alert-circle' :
    'ellipse-outline';

  return (
    <View style={[styles.ydTaskRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon as any} size={18} color={timingColor} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.ydTaskTitle, { color: theme.text }]} numberOfLines={1}>{row.title}</Text>
        <Text style={[styles.ydTaskMeta, { color: theme.muted }]}>
          {row.focusMode ? '⚡ ' : ''}{fmtMins(row.scheduledMins)} scheduled
          {row.status === 'completed' && row.actualMins > 0 ? ` · ${fmtMins(row.actualMins)} actual` : ''}
        </Text>
      </View>
      <View style={[styles.ydTimingBadge, { backgroundColor: timingColor + '18' }]}>
        <Text style={[styles.ydTimingLabel, { color: timingColor }]}>{timingLabel}</Text>
      </View>
    </View>
  );
}

function MiniStat({ color, label, value, theme }: {
  color: string; label: string; value: number; theme: { card: string; muted: string; text: string };
}) {
  return (
    <View style={[styles.miniTile, { borderColor: color + '22', backgroundColor: color + '0E' }]}>
      <Text style={[styles.miniValue, { color }]}>{String(value)}</Text>
      <Text style={[styles.miniLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function SectionLabel({ label, theme }: { label: string; theme: any }) {
  return <Text style={[styles.sectionLabel, { color: theme.muted }]}>{label}</Text>;
}

function Pill({ icon, label, color, theme }: { icon: any; label: string; color: string; theme: any }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function InfoChip({ icon, label, value, color, theme }: { icon: any; label: string; value: string; color: string; theme: any }) {
  return (
    <View style={[styles.chip, { backgroundColor: theme.card, borderColor: color + '33' }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function LifeStat({ icon, label, value, color, theme }: { icon: any; label: string; value: string; color: string; theme: any }) {
  return (
    <View style={[styles.lifeStat, { backgroundColor: theme.card, borderColor: color + '22' }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.lifeValue, { color }]}>{value}</Text>
      <Text style={[styles.lifeLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function DualBarChart({ days, maxC, maxF, theme }: { days: WeekDay[]; maxC: number; maxF: number; theme: any }) {
  return (
    <View style={styles.barChart}>
      {days.map((d) => {
        const cPct = d.completed === 0 ? 0 : Math.max(0.04, d.completed / maxC);
        const fPct = d.focusMinutes === 0 ? 0 : Math.max(0.04, d.focusMinutes / maxF);
        return (
          <View key={d.date} style={styles.barCol}>
            <Text style={[styles.barCount, { color: d.completed > 0 ? theme.text : theme.muted }]}>{d.completed > 0 ? d.completed : '·'}</Text>
            <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
              <View style={{ width: '100%', justifyContent: 'flex-end', flex: 1 }}>
                {fPct > 0 && <View style={{ height: `${fPct * 100}%`, backgroundColor: COLORS.primary + '55', borderRadius: 2 }} />}
                {cPct > 0 && <View style={{ height: `${cPct * 100}%`, backgroundColor: COLORS.green, borderRadius: 2 }} />}
              </View>
            </View>
            <Text style={[styles.barDay, { color: d.isToday ? COLORS.primary : theme.muted, fontWeight: d.isToday ? '700' : '500' }]}>{d.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

function heatColor(rate: number, hasData: boolean): string {
  if (!hasData || rate === 0) return COLORS.green + '18';
  if (rate >= 0.8) return COLORS.green;
  if (rate >= 0.5) return COLORS.green + 'AA';
  if (rate > 0)   return COLORS.orange + '88';
  return COLORS.green + '18';
}

function CalendarHeatmap({ data, width, theme }: { data: HeatDay[]; width: number; theme: any }) {
  const cellSize = Math.floor((width - SPACING.sm * 6) / 12);
  const weeks: HeatDay[][] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));

  return (
    <View style={styles.heatGrid}>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.heatWeek}>
          {week.map((day, di) => (
            <View key={di} style={[styles.heatCell, {
              width: cellSize, height: cellSize,
              backgroundColor: heatColor(day.rate, day.hasData),
              borderColor: theme.border,
            }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMins(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtMinsLong(minutes: number): { h: number; m: number } {
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

function getTopTags(tasks: Task[]): { tag: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const t of tasks) for (const tag of t.tags) counts[tag] = (counts[tag] ?? 0) + 1;
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 6).map(([tag, count]) => ({ tag, count }));
}

function getMotivation(focusMins: number, rate: number, streak: number): string {
  if (streak >= 7)      return `🏆 ${streak} days straight — elite consistency.`;
  if (focusMins >= 120) return `🔥 ${Math.floor(focusMins / 60)}h+ of deep work today. That's rare.`;
  if (focusMins >= 60)  return `⚡ An hour of focus done. Keep the momentum going.`;
  if (rate >= 80)       return `✅ ${rate}% completion — productive day. Stay on it.`;
  if (rate >= 50)       return `📈 Good start. Finish the remaining tasks strong.`;
  if (focusMins > 0)    return `🌱 Every session counts. You've started — keep going.`;
  return `🎯 Start a focus session to build your streak.`;
}

function getBitterTruth(rate: number, bd: YesterdayBreakdown, focusMins: number): string {
  if (bd.total === 0) return `No tasks scheduled. Nothing to show for yesterday.`;
  if (rate === 100)   return `💯 Perfect day — every task done. Now do it again.`;
  if (rate >= 80) {
    return focusMins >= 60
      ? `✅ Strong day. ${bd.completed}/${bd.total} done with ${fmtMins(focusMins)} of focused work.`
      : `✅ ${bd.completed}/${bd.total} tasks done. Good, but where was the deep focus?`;
  }
  if (rate >= 50) {
    if (bd.late > 0 && bd.late >= bd.onTime)
      return `⚠️ Half done, but ${bd.late} task${bd.late > 1 ? 's' : ''} ran late. You're dragging.`;
    if (bd.skipped > 0)
      return `📋 ${bd.completed}/${bd.total} done. ${bd.skipped} skipped — avoidance or bad planning?`;
    return `📈 ${bd.completed}/${bd.total} tasks. Decent, but ${bd.total - bd.completed} left unfinished.`;
  }
  if (rate > 0) {
    if (bd.overdue > 1)
      return `🚨 ${bd.overdue} tasks went overdue. Time management needs serious work.`;
    if (bd.skipped >= bd.completed)
      return `💔 More tasks skipped than done. Be honest — was yesterday actually productive?`;
    return `😬 Only ${bd.completed}/${bd.total} done. Yesterday's promises, today's backlog.`;
  }
  return `🛑 Zero tasks completed yesterday. Every unfinished task carries over as debt.`;
}

function getMilestones(mins: number, tasks: number, streak: number, blocked: number) {
  return [
    { icon: '⏱', label: '1 Hour',        sub: 'focus time',    color: COLORS.primary, earned: mins >= 60 },
    { icon: '🕐', label: '10 Hours',      sub: 'focus time',    color: COLORS.primary, earned: mins >= 600 },
    { icon: '🏅', label: '10 Tasks',      sub: 'completed',     color: COLORS.green,   earned: tasks >= 10 },
    { icon: '🥇', label: '100 Tasks',     sub: 'completed',     color: COLORS.green,   earned: tasks >= 100 },
    { icon: '🔥', label: '7-Day Streak',  sub: 'in a row',      color: COLORS.orange,  earned: streak >= 7 },
    { icon: '💪', label: '30-Day Streak', sub: 'in a row',      color: COLORS.orange,  earned: streak >= 30 },
    { icon: '🛡', label: '10 Blocked',    sub: 'distractions',  color: COLORS.blue,    earned: blocked >= 10 },
    { icon: '⚔️', label: '100 Blocked',   sub: 'distractions',  color: COLORS.blue,    earned: blocked >= 100 },
  ];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.md, gap: SPACING.md },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title:    { fontSize: FONT.xxl, fontWeight: '800' },
  subtitle: { fontSize: FONT.sm, marginTop: 2 },
  iconBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  filterRow: {
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    borderWidth: 1,
  },
  filterLabel: { fontSize: FONT.sm, fontWeight: '800', letterSpacing: 0.3 },

  dbErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dbErrorText: { flex: 1, fontSize: FONT.sm, lineHeight: 18 },
  retryBtn: { padding: 4 },

  card: { borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: FONT.md, fontWeight: '700' },
  cardBadge: { fontSize: FONT.xs, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, overflow: 'hidden' },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 0.8, paddingLeft: SPACING.xs },
  divider: { height: StyleSheet.hairlineWidth },

  // Hero card
  heroCard: {
    borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1.5,
  },
  heroEyebrow:   { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1 },
  heroTime:      { fontSize: 64, fontWeight: '900', lineHeight: 70 },
  heroTimeSmall: { fontSize: 36, fontWeight: '700' },
  heroSub:       { fontSize: FONT.sm },
  heroRow:       { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', justifyContent: 'center' },
  heroEmpty:     { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  heroEmptyText: { fontSize: FONT.sm, textAlign: 'center', maxWidth: 240 },

  // Streak
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.orange + '15', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1.5,
  },
  streakFire: { fontSize: 24 }, streakTitle: { fontSize: FONT.md, fontWeight: '700' }, streakSub: { fontSize: FONT.xs, marginTop: 1 },

  // Bitter truth
  bitterCard: { borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1.5, alignItems: 'center' },
  bitterText: { fontSize: FONT.md, fontWeight: '700', textAlign: 'center', lineHeight: 22 },

  // Breakdown bars
  breakdownRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  breakdownLabel: { fontSize: FONT.sm, width: 70 },
  breakdownValue: { fontSize: FONT.md, fontWeight: '700', width: 24, textAlign: 'right' },
  trackFull:      { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  trackFill:      { height: '100%', borderRadius: 4 },
  progLabels:     { flexDirection: 'row', justifyContent: 'space-between' },
  progText:       { fontSize: FONT.xs },

  // Mini stat grid (on-time / early / late / extended)
  miniGrid: { flexDirection: 'row', gap: SPACING.sm },
  miniTile: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1 },
  miniValue: { fontSize: FONT.lg, fontWeight: '800' },
  miniLabel: { fontSize: FONT.xs, fontWeight: '600', textAlign: 'center' },

  // Time rows (scheduled/actual/diff)
  timeRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  timeRowLabel: { fontSize: FONT.sm },
  timeRowVal:   { fontSize: FONT.sm, fontWeight: '700' },

  // Yesterday task rows
  ydTaskRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  ydTaskTitle:   { fontSize: FONT.sm, fontWeight: '600' },
  ydTaskMeta:    { fontSize: FONT.xs, marginTop: 2 },
  ydTimingBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  ydTimingLabel: { fontSize: FONT.xs, fontWeight: '700' },

  // Empty inline (inside cards)
  emptyInline:     { alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.xs },
  emptyInlineText: { fontSize: FONT.sm, textAlign: 'center', maxWidth: 260 },

  // Pill tags
  pill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  pillText: { fontSize: FONT.xs, fontWeight: '600' },

  // Tags
  tagsWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  tag:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1 },
  tagText:      { fontSize: FONT.xs, fontWeight: '600' },
  tagCount:     { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  tagCountText: { fontSize: 10, fontWeight: '700' },

  // Encourage
  encourageCard: { borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1.5, alignItems: 'center' },
  encourageText: { fontSize: FONT.md, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  // Chips
  chipRow: { flexDirection: 'row', gap: SPACING.sm },
  chip: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1.5, gap: 4 },
  chipValue: { fontSize: FONT.lg, fontWeight: '800' },
  chipLabel: { fontSize: FONT.xs, fontWeight: '600' },

  // Bar charts (week)
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: SPACING.xs, paddingTop: SPACING.sm },
  barCol:   { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 },
  barCount: { fontSize: 10, fontWeight: '700' },
  barTrack: { width: '100%', flex: 1, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:  { width: '100%', borderRadius: 3 },
  barDay:   { fontSize: 10 },

  legendRow:  { flexDirection: 'row', gap: SPACING.md, justifyContent: 'center', marginTop: SPACING.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: FONT.xs },

  // App rows
  appRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rankBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankText:  { fontSize: FONT.xs, fontWeight: '700' },
  appInfo:   { flex: 1, gap: 5 },
  appName:   { fontSize: FONT.sm, fontWeight: '600' },
  countBadge:{ paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  countText: { fontSize: FONT.sm, fontWeight: '700' },

  // All-time life stats
  lifeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  lifeStat: {
    width: '48%', alignItems: 'center', paddingVertical: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1.5, gap: 4,
  },
  lifeValue: { fontSize: FONT.xxl, fontWeight: '900' },
  lifeLabel: { fontSize: FONT.xs, fontWeight: '600' },

  // Heatmap
  heatGrid:       { flexDirection: 'row', gap: 3, marginTop: SPACING.sm },
  heatWeek:       { flexDirection: 'column', gap: 3 },
  heatCell:       { borderRadius: 2, borderWidth: 0.5 },
  heatLegendRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: SPACING.xs },
  heatDot:        { width: 10, height: 10, borderRadius: 2 },
  heatLegendLabel:{ fontSize: 9 },

  // Milestones
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  badge: {
    width: '47%', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg, borderWidth: 1.5, gap: 3,
  },
  badgeIcon:  { fontSize: 24 },
  badgeLabel: { fontSize: FONT.sm, fontWeight: '700', textAlign: 'center' },
  badgeSub:   { fontSize: FONT.xs, textAlign: 'center' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyTitle: { fontSize: FONT.lg, fontWeight: '700', textAlign: 'center' },
  emptySub:   { fontSize: FONT.sm, textAlign: 'center', maxWidth: 280 },
});

export default withScreenErrorBoundary(StatsScreen, 'Stats');
