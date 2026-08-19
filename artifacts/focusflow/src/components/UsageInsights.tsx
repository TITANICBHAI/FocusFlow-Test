import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import {
  isUsageSummaryAvailable,
  UsageStatsModule,
  type UsageApp,
  type UsageSummary,
} from '@/native-modules/UsageStatsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { isProtectedApp } from '@/services/protectedApps';

interface Props {
  startMs: number;
  endMs: number;
  focusMinutes: number;
  blockedAttempts?: number;
  showWeeklyTrend?: boolean;
  focusByDate?: Record<string, number>;
  standalonePackages?: string[];
  standaloneUntil?: string | null;
  alwaysOnPackages?: string[];
  onAppPress?: (app: UsageApp) => void;
  showQuickBlockButton?: boolean;
  onSummaryChange?: (summary: UsageSummary | null) => void;
}

type LoadState = 'loading' | 'ready' | 'permission' | 'unavailable' | 'error';

interface DailyUsage {
  date: string;
  day: string;
  totalMinutes: number;
  focusMinutes: number;
}

const EMPTY_FOCUS_BY_DATE: Record<string, number> = {};

export function UsageInsights({
  startMs,
  endMs,
  focusMinutes,
  blockedAttempts = 0,
  showWeeklyTrend = false,
  focusByDate,
  standalonePackages = [],
  standaloneUntil = null,
  alwaysOnPackages = [],
  onAppPress,
  showQuickBlockButton = false,
  onSummaryChange,
}: Props) {
  const { theme } = useTheme();
  const focusMap = focusByDate ?? EMPTY_FOCUS_BY_DATE;
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    setSummary(null);
    setDailyUsage([]);
    onSummaryChange?.(null);

    if (Platform.OS !== 'android' || !isUsageSummaryAvailable) {
      setLoadState('unavailable');
      return;
    }

    try {
      const hasPermission = await UsageStatsModule.hasPermission();
      if (!hasPermission) {
        setLoadState('permission');
        return;
      }

      const nextSummary = await UsageStatsModule.getUsageSummary(startMs, endMs);
      if (!nextSummary) {
        setLoadState('unavailable');
        return;
      }

      setSummary(nextSummary);
      onSummaryChange?.(nextSummary);

      if (showWeeklyTrend) {
        const days: DailyUsage[] = [];
        const startDay = dayjs(startMs).startOf('day');
        const endDay = dayjs(endMs).startOf('day');
        let cursor = startDay;
        while (cursor.isBefore(endDay) || cursor.isSame(endDay, 'day')) {
          const dayStart = cursor.startOf('day').valueOf();
          const dayEnd = cursor.endOf('day').valueOf();
          const daySummary = await UsageStatsModule.getUsageSummary(dayStart, dayEnd);
          const date = cursor.format('YYYY-MM-DD');
          days.push({
            date,
            day: cursor.format('ddd'),
            totalMinutes: daySummary?.totalMinutes ?? 0,
            focusMinutes: focusMap[date] ?? 0,
          });
          cursor = cursor.add(1, 'day');
        }
        setDailyUsage(days);
      }

      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [endMs, focusMap, onSummaryChange, showWeeklyTrend, startMs]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loadState === 'loading') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: theme.muted }]}>Reading on-device usage…</Text>
        </View>
      </View>
    );
  }

  if (loadState === 'permission') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: COLORS.orange + '44' }]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Ionicons name="phone-portrait-outline" size={18} color={COLORS.orange} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Device Time</Text>
          </View>
          <Text style={[styles.localBadge, { color: COLORS.green, backgroundColor: COLORS.green + '14' }]}>
            On device
          </Text>
        </View>
        <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
          Allow Usage Access to compare your observed app time with FocusFlow focus time. This data stays on this device.
        </Text>
        <TouchableOpacity
          testID="usage-access-button"
          style={[styles.actionButton, { backgroundColor: COLORS.orange }]}
          onPress={() => {
            void UsageStatsModule.openUsageAccessSettings().catch(() => Linking.openSettings());
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Open Usage Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadState === 'unavailable') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.titleRow}>
          <Ionicons name="phone-portrait-outline" size={18} color={theme.muted} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Device Time</Text>
        </View>
        <Text style={[styles.emptyText, { color: theme.muted }]}>
          Device usage insights are available in the Android FocusFlow build. Your FocusFlow data remains available below.
        </Text>
      </View>
    );
  }

  if (loadState === 'error' || !summary) {
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.titleRow}>
          <Ionicons name="warning-outline" size={18} color={COLORS.orange} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Device Time unavailable</Text>
        </View>
        <Text style={[styles.emptyText, { color: theme.muted }]}>
          Android returned incomplete usage data for this period. Try again when more device history is available.
        </Text>
        <TouchableOpacity
          testID="usage-retry-button"
          style={[styles.retryButton, { borderColor: theme.border }]}
          onPress={() => void load()}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={15} color={COLORS.primary} />
          <Text style={[styles.retryText, { color: COLORS.primary }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ratio = summary.totalMinutes > 0
    ? Math.round((focusMinutes / summary.totalMinutes) * 100)
    : 0;
  const activeTemporaryUntil = standaloneUntil ? new Date(standaloneUntil).getTime() > Date.now() : false;
  const maxDailyMinutes = Math.max(...dailyUsage.map((day) => day.totalMinutes), 1);

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="phone-portrait-outline" size={18} color={COLORS.blue} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Observed Device Time</Text>
        </View>
        <Text style={[styles.localBadge, { color: COLORS.green, backgroundColor: COLORS.green + '14' }]}>
          On device
        </Text>
      </View>

      <Text style={[styles.heroValue, { color: COLORS.blue }]}>{formatMinutes(summary.totalMinutes)}</Text>
      <Text style={[styles.caption, { color: theme.muted }]}>
        Android app foreground time — FocusFlow home-screen time excluded
      </Text>

      <View style={[styles.comparison, { borderTopColor: theme.border }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: COLORS.primary }]}>{formatMinutes(focusMinutes)}</Text>
          <Text style={[styles.metricLabel, { color: theme.muted }]}>Focus time</Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: ratio > 0 ? COLORS.green : theme.muted }]}>
            {summary.totalMinutes > 0 ? `${ratio}%` : '—'}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.muted }]}>Focus / observed</Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: blockedAttempts > 0 ? COLORS.orange : COLORS.green }]}>
            {blockedAttempts}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.muted }]}>Blocked attempts</Text>
        </View>
      </View>

      {showWeeklyTrend && dailyUsage.length > 0 && (
        <View style={[styles.trendSection, { borderTopColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.muted }]}>WEEKLY OBSERVATION</Text>
          <View style={styles.chart}>
            {dailyUsage.map((day) => (
              <View key={day.date} style={styles.chartColumn}>
                <View style={styles.chartBars}>
                  <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(0, (day.totalMinutes / maxDailyMinutes) * 100)}%`,
                          backgroundColor: COLORS.blue,
                        },
                      ]}
                    />
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(0, (day.focusMinutes / maxDailyMinutes) * 100)}%`,
                          backgroundColor: COLORS.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.chartLabel, { color: theme.muted }]}>{day.day}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendRow}>
            <Legend color={COLORS.blue} label="Observed device time" theme={theme} />
            <Legend color={COLORS.primary} label="Focus time" theme={theme} />
          </View>
        </View>
      )}

      <View style={[styles.appsSection, { borderTopColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Top apps by observed time</Text>
          <Text style={[styles.caption, { color: theme.muted }]}>minutes · launches</Text>
        </View>
        {summary.apps.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            No app usage was recorded for this period yet.
          </Text>
        ) : (
          summary.apps.slice(0, 5).map((app, index) => {
            const status = getAppStatus(
              app.packageName,
              standalonePackages,
              activeTemporaryUntil,
              standaloneUntil,
              alwaysOnPackages,
            );
            return (
              <AppUsageRow
                key={app.packageName}
                app={app}
                rank={index + 1}
                status={status}
                maxMinutes={summary.apps[0]?.foregroundMinutes ?? 1}
                theme={theme}
                onPress={onAppPress && !isProtectedApp(app.packageName) ? () => onAppPress(app) : undefined}
                showQuickBlockButton={showQuickBlockButton && !isProtectedApp(app.packageName)}
              />
            );
          })
        )}
      </View>
    </View>
  );
}

function AppUsageRow({
  app,
  rank,
  status,
  maxMinutes,
  theme,
  onPress,
  showQuickBlockButton,
}: {
  app: UsageApp;
  rank: number;
  status: { label: string; color: string } | null;
  maxMinutes: number;
  theme: { text: string; muted: string; surface: string; border: string };
  onPress?: () => void;
  showQuickBlockButton: boolean;
}) {
  const content = (
    <>
      <View style={[styles.rankBadge, { backgroundColor: rank === 1 ? COLORS.blue + '18' : theme.surface }]}>
        <Text style={[styles.rankText, { color: rank === 1 ? COLORS.blue : theme.muted }]}>#{rank}</Text>
      </View>
      <View style={styles.appInfo}>
        <View style={styles.appNameRow}>
          <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
            {app.appName || app.packageName}
          </Text>
          {status && (
            <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
              {status.label}
            </Text>
          )}
        </View>
        <View style={[styles.trackFull, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.trackFill,
              { width: `${Math.min(100, (app.foregroundMinutes / Math.max(1, maxMinutes)) * 100)}%`, backgroundColor: COLORS.blue },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.appCount, { color: theme.text }]}>
        {app.foregroundMinutes}m · {app.launchCount}
      </Text>
      {showQuickBlockButton && (
        <TouchableOpacity style={[styles.quickButton, { backgroundColor: COLORS.primary + '16' }]} onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="shield-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </>
  );
  if (onPress && !showQuickBlockButton) {
    return (
      <TouchableOpacity testID={`usage-app-${app.packageName}`} style={[styles.appRow, { borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View testID={`usage-app-${app.packageName}`} style={[styles.appRow, { borderBottomColor: theme.border }]}>{content}</View>;
}

function Legend({
  color,
  label,
  theme,
}: {
  color: string;
  label: string;
  theme: { muted: string };
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function getAppStatus(
  packageName: string,
  standalonePackages: string[],
  temporaryActive: boolean,
  standaloneUntil: string | null,
  alwaysOnPackages: string[],
): { label: string; color: string } | null {
  const temporary = temporaryActive && standalonePackages.includes(packageName);
  const alwaysOn = alwaysOnPackages.includes(packageName);
  if (temporary && alwaysOn) return { label: 'Always-On + temporary', color: COLORS.purple };
  if (alwaysOn) return { label: 'Always-On blocked', color: COLORS.red };
  if (temporary) return { label: `Blocked until ${formatExpiry(standaloneUntil)}`, color: COLORS.orange };
  return null;
}

function formatExpiry(value: string | null): string {
  if (!value) return 'expiry';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'expiry';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flex: 1 },
  cardTitle: { fontSize: FONT.md, fontWeight: '800' },
  localBadge: {
    fontSize: FONT.xs,
    fontWeight: '800',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  heroValue: { fontSize: 38, fontWeight: '900', marginTop: SPACING.xs },
  caption: { fontSize: FONT.xs },
  comparison: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth },
  metricValue: { fontSize: FONT.lg, fontWeight: '900' },
  metricLabel: { fontSize: FONT.xs, textAlign: 'center' },
  trendSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 0.8 },
  chart: {
    height: 112,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  chartColumn: { flex: 1, alignItems: 'center', gap: SPACING.xs },
  chartBars: { height: 88, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barTrack: { width: 8, height: '100%', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 2 },
  chartLabel: { fontSize: 9 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: FONT.xs },
  appsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  sectionTitle: { fontSize: FONT.sm, fontWeight: '800' },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
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
  appNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  appName: { flex: 1, fontSize: FONT.sm, fontWeight: '600' },
  statusText: { maxWidth: 120, fontSize: 9, fontWeight: '700' },
  trackFull: { height: 6, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%' },
  appCount: { minWidth: 66, fontSize: FONT.xs, fontWeight: '800', textAlign: 'right' },
  quickButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  loadingText: { fontSize: FONT.sm },
  permissionText: { fontSize: FONT.sm, lineHeight: 20 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
  },
  actionButtonText: { color: '#fff', fontSize: FONT.sm, fontWeight: '800' },
  emptyText: { fontSize: FONT.sm, lineHeight: 20 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  retryText: { fontSize: FONT.sm, fontWeight: '800' },
});
