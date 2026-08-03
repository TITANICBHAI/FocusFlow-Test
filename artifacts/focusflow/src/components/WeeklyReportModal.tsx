import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { GreyoutModule, TemptationEntry } from '@/native-modules/GreyoutModule';
import dayjs from 'dayjs';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface AppStat {
  pkg: string;
  appName: string;
  count: number;
}

interface DayStat {
  day: string;
  date: string;
  count: number;
}

export function WeeklyReportModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [appStats, setAppStats] = useState<AppStat[]>([]);
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState(0);
  const [totalAllTime, setTotalAllTime] = useState(0);
  const [cleanStreak, setCleanStreak] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const log = await GreyoutModule.getTemptationLog();
      processData(log);
    } catch {
      processData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  function processData(log: TemptationEntry[]) {
    const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = log.filter((e) => e.timestamp >= weekCutoff);

    setTotalThisWeek(thisWeek.length);
    setTotalAllTime(log.length);

    const appMap = new Map<string, AppStat>();
    for (const e of thisWeek) {
      const existing = appMap.get(e.pkg);
      if (existing) {
        existing.count++;
      } else {
        appMap.set(e.pkg, { pkg: e.pkg, appName: e.appName || e.pkg, count: 1 });
      }
    }
    setAppStats(Array.from(appMap.values()).sort((a, b) => b.count - a.count));

    const days: DayStat[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day');
      const dayStart = d.startOf('day').valueOf();
      const dayEnd = d.endOf('day').valueOf();
      const count = log.filter((e) => e.timestamp >= dayStart && e.timestamp <= dayEnd).length;
      days.push({ day: d.format('ddd'), date: d.format('MMM D'), count });
    }
    setDayStats(days);

    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count === 0) streak++;
      else break;
    }
    setCleanStreak(streak);
  }

  const handleClearLog = () => {
    Alert.alert('Clear Log', 'Permanently delete all temptation log data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await GreyoutModule.clearTemptationLog();
          await load();
        },
      },
    ]);
  };

  const maxDay = Math.max(...dayStats.map((d) => d.count), 1);
  const maxApp = appStats[0]?.count ?? 1;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>

        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Weekly Report</Text>
          <TouchableOpacity onPress={handleClearLog} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={19} color={COLORS.red} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* ── Summary stat cards ── */}
            <View style={styles.row}>
              <StatCard
                theme={theme}
                icon="shield-checkmark"
                color={totalThisWeek === 0 ? COLORS.green : COLORS.orange}
                label="This Week"
                value={String(totalThisWeek)}
                sub="blocked attempts"
              />
              <StatCard
                theme={theme}
                icon="flame"
                color={cleanStreak > 0 ? COLORS.green : COLORS.muted}
                label="Clean Streak"
                value={`${cleanStreak}d`}
                sub={cleanStreak === 0 ? 'no clean days yet' : 'without temptations'}
              />
            </View>
            <View style={styles.row}>
              <StatCard
                theme={theme}
                icon="time-outline"
                color={COLORS.purple}
                label="All Time"
                value={String(totalAllTime)}
                sub="total blocks logged"
              />
              <StatCard
                theme={theme}
                icon="apps-outline"
                color={COLORS.blue}
                label="Apps Tempted"
                value={String(appStats.length)}
                sub="unique apps this week"
              />
            </View>

            {/* ── Daily bar chart ── */}
            <SectionLabel theme={theme} text="Last 7 Days" />
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.barChart}>
                {dayStats.map((d, i) => {
                  const isToday = i === dayStats.length - 1;
                  const barPct = d.count === 0 ? 0 : Math.max(0.06, d.count / maxDay);
                  const barColor = d.count === 0
                    ? COLORS.green
                    : isToday ? COLORS.primary : COLORS.orange;
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <Text style={[styles.barCount, { color: d.count === 0 ? COLORS.green : theme.text }]}>
                        {d.count === 0 ? '✓' : d.count}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${barPct * 100}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barDay, { color: isToday ? COLORS.primary : theme.muted, fontWeight: isToday ? '700' : '500' }]}>
                        {d.day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Per-app breakdown ── */}
            <SectionLabel theme={theme} text="Most Tempting Apps" />
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {appStats.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="shield-checkmark" size={44} color={COLORS.green} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    You resisted everything this week!
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.muted }]}>
                    Data appears here when the app blocker intercepts a blocked app.
                  </Text>
                </View>
              ) : (
                appStats.slice(0, 8).map((a, i) => (
                  <View key={a.pkg} style={[styles.appRow, { borderBottomColor: theme.border }]}>
                    <View style={[
                      styles.rankBadge,
                      { backgroundColor: i === 0 ? COLORS.redLight : theme.surface },
                    ]}>
                      <Text style={[styles.rankText, { color: i === 0 ? COLORS.red : theme.muted }]}>
                        #{i + 1}
                      </Text>
                    </View>
                    <View style={styles.appInfo}>
                      <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
                        {a.appName}
                      </Text>
                      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(a.count / maxApp) * 100}%`,
                              backgroundColor: i === 0 ? COLORS.red : COLORS.orange,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: i === 0 ? COLORS.redLight : theme.surface }]}>
                      <Text style={[styles.countText, { color: i === 0 ? COLORS.red : theme.text }]}>
                        {a.count}×
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function StatCard({ theme, icon, color, label, value, sub }: {
  theme: any; icon: any; color: string; label: string; value: string; sub: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={[styles.statSub, { color: theme.muted }]}>{sub}</Text>
    </View>
  );
}

function SectionLabel({ theme, text }: { theme: any; text: string }) {
  return (
    <Text style={[styles.sectionLabel, { color: theme.muted }]}>{text.toUpperCase()}</Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: FONT.lg, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: FONT.xxl, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: FONT.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statSub: { fontSize: 10, textAlign: 'center' },
  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginTop: SPACING.xs,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    height: 140,
    gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '60%', height: 80, justifyContent: 'flex-end', borderRadius: 3, overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 3 },
  barCount: { fontSize: 10, fontWeight: '700' },
  barDay: { fontSize: 10 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 10, fontWeight: '700' },
  appInfo: { flex: 1, gap: 5 },
  appName: { fontSize: FONT.sm, fontWeight: '600' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    minWidth: 38,
    alignItems: 'center',
  },
  countText: { fontSize: FONT.sm, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { fontSize: FONT.md, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: FONT.sm, textAlign: 'center', lineHeight: 18 },
});
