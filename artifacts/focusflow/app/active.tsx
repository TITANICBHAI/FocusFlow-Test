/**
 * Live status dashboard for every blocking layer in FocusFlow.
 *
 * Active is intentionally a status surface, not a second Defense settings
 * screen. It always shows the six live protection categories and expands only
 * the lists where the user needs more detail.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';

import { useApp } from '@/context/AppContext';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { dbGetTodayFocusMinutes, dbGetTodayOverrideCount, dbGetRecentDayCompletions } from '@/data/database';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { InstalledAppsModule, type InstalledApp } from '@/native-modules/InstalledAppsModule';
import { NetworkBlockModule, type NetworkBlockStatus } from '@/native-modules/NetworkBlockModule';
import { getAllowanceUsageSnapshot } from '@/services/allowanceUsageCache';
import type { DailyAllowanceEntry, RecurringBlockSchedule } from '@/data/types';

type AllowanceUsage = {
  date?: string;
  count?: number;
  usedMs?: number;
  windowStartMs?: number;
};

function ActiveScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, stopFocusMode, setStandaloneBlockAndAllowance } = useApp();
  const { settings } = state;
  const [expanded, setExpanded] = useState<string | null>('allowance');
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [allowanceUsage, setAllowanceUsage] = useState<Record<string, AllowanceUsage>>({});
  const [activeSessionPackage, setActiveSessionPackage] = useState<string | null>(null);
  const [activeSessionEndMs, setActiveSessionEndMs] = useState(0);
  const [vpnStatus, setVpnStatus] = useState<NetworkBlockStatus | null>(null);
  const [todayStats, setTodayStats] = useState({ completed: 0, total: 0, focusMinutes: 0, blocked: 0 });
  const [defPinVisible, setDefPinVisible] = useState(false);
  const [focusPinVisible, setFocusPinVisible] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const pendingDefAction = useRef<(() => void) | null>(null);
  const livePulse = useRef(new Animated.Value(1)).current;

  const focusActive = state.focusSession?.isActive === true;
  const focusTask = state.focusSession
    ? state.tasks.find((task) => task.id === state.focusSession?.taskId)
    : null;
  const standalonePackages = settings.standaloneBlockPackages ?? [];
  const standaloneUntil = settings.standaloneBlockUntil ? new Date(settings.standaloneBlockUntil) : null;
  const standaloneActive = Boolean(
    standaloneUntil &&
      standalonePackages.length > 0 &&
      standaloneUntil.getTime() > Date.now(),
  );
  const alwaysOnPackages = settings.alwaysOnPackages ?? [];
  const alwaysOnVpnPackages = settings.alwaysOnVpnPackages ?? [];
  const allowanceEntries = settings.dailyAllowanceEntries ?? [];
  const keywords = settings.blockedWords ?? [];
  const vpnPackages = useMemo(
    () => unique([
      ...alwaysOnVpnPackages,
      ...(settings.standaloneVpnPackages ?? []),
    ]),
    [alwaysOnVpnPackages, settings.standaloneVpnPackages],
  );
  const recurringSchedules = settings.recurringBlockSchedules ?? [];
  const activeSchedules = useMemo(
    () => recurringSchedules.filter((schedule) => isScheduleActive(schedule, clock)),
    [clock, recurringSchedules],
  );
  const appNames = useMemo(
    () => new Map(apps.map((app) => [app.packageName, app.appName])),
    [apps],
  );

  const refreshLiveData = useCallback(async (force = false) => {
    const [allowanceSnapshot, status] = await Promise.all([
      getAllowanceUsageSnapshot(force).catch(() => ({
        usage: {},
        activeSessionPackage: null,
        activeSessionEndMs: 0,
      })),
      NetworkBlockModule.getNetworkBlockStatus().catch(() => null),
    ]);
    setAllowanceUsage(allowanceSnapshot.usage);
    setActiveSessionPackage(allowanceSnapshot.activeSessionPackage);
    setActiveSessionEndMs(allowanceSnapshot.activeSessionEndMs);
    setVpnStatus(status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const refresh = (force = false) => {
        void refreshLiveData(force);
        void (async () => {
          try {
            const [rows, focusMinutes, blocked] = await Promise.all([
              dbGetRecentDayCompletions(1),
              dbGetTodayFocusMinutes(),
              dbGetTodayOverrideCount(),
            ]);
            if (!mounted) return;
            const todayKey = dayjs().format('YYYY-MM-DD');
            const today = rows.find((row) => row.date === todayKey);
            const total = state.tasks.filter((task) => dayjs(task.startTime).format('YYYY-MM-DD') === todayKey).length;
            setTodayStats({
              completed: today?.completed ?? 0,
              total: today?.total ?? total,
              focusMinutes,
              blocked,
            });
          } catch {
            if (mounted) setTodayStats({ completed: 0, total: 0, focusMinutes: 0, blocked: 0 });
          }
        })();
      };
      refresh(true);
      const timer = setInterval(refresh, 5_000);
      return () => {
        mounted = false;
        clearInterval(timer);
      };
    }, [refreshLiveData, state.tasks]),
  );

  // Defer the heavy getInstalledApps() call until after the navigation
  // animation completes. On Android this query can take hundreds of ms
  // and blocks the JS thread mid-transition, making the screen appear frozen.
  useEffect(() => {
    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      InstalledAppsModule.getInstalledApps()
        .then((installed) => { if (mounted) setApps(installed); })
        .catch(() => {});
    });
    return () => { mounted = false; task.cancel(); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const withDefensePin = (action: () => void) => {
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => {
        if (hash) {
          pendingDefAction.current = action;
          setDefPinVisible(true);
        } else {
          action();
        }
      })
      .catch(() => action());
  };

  const stopFocus = () => {
    SessionPinModule.isPinSet().then((pinSet) => {
      if (pinSet) {
        setFocusPinVisible(true);
      } else {
        Alert.alert('Stop focus session?', 'This ends app blocking for the current task.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Stop', style: 'destructive', onPress: () => { void stopFocusMode(); } },
        ]);
      }
    }).catch(() => {});
  };

  const clearStandalone = () => {
    if (standaloneActive) {
      Alert.alert('Block Timer Running', 'The standalone block cannot be cleared until its timer expires.');
      return;
    }
    withDefensePin(() => {
      Alert.alert(
        'Clear standalone apps?',
        `Remove ${standalonePackages.length} app${standalonePackages.length === 1 ? '' : 's'} from the timed block list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => { void setStandaloneBlockAndAllowance([], null, allowanceEntries); },
          },
        ],
      );
    });
  };

  const alwaysOnActive = (settings.alwaysOnEnforcementEnabled ?? false) && alwaysOnPackages.length > 0;
  const vpnConfigured = vpnPackages.length > 0 || settings.vpnBlockEnabled === true;
  const vpnRunning = vpnStatus?.running === true;
  const vpnNeedsAttention =
    vpnStatus === null ||
    vpnStatus.failedPackages.length > 0 ||
    ['permission_missing', 'another_vpn_active', 'package_registration_failed', 'startup_failed'].includes(
      vpnStatus.state,
    );
  const vpnStatusLabel = formatVpnStatus(vpnStatus?.state, vpnConfigured);
  const vpnStatusDetail = vpnStatus?.error
    ? `${vpnStatusLabel} · ${vpnStatus.error}`
    : vpnStatusLabel;
  const nothingActive = !focusActive && !standaloneActive && !alwaysOnActive && allowanceEntries.length === 0 &&
    keywords.length === 0 && !vpnRunning;

  useEffect(() => {
    if (nothingActive) {
      livePulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1.35, duration: 700, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [livePulse, nothingActive]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/focus')} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Active</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Live status of your protections</Text>
        </View>
        <Animated.View
          style={[
            styles.liveDot,
            { backgroundColor: nothingActive ? theme.muted : COLORS.green },
            !nothingActive && { transform: [{ scale: livePulse }] },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.summary, { backgroundColor: nothingActive ? theme.card : COLORS.primary + '12', borderColor: nothingActive ? theme.border : COLORS.primary + '35' }]}>
          <Ionicons name={nothingActive ? 'checkmark-circle-outline' : 'pulse-outline'} size={22} color={nothingActive ? COLORS.green : COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>{nothingActive ? 'Nothing blocking right now' : 'Protection is active'}</Text>
            <Text style={[styles.summaryText, { color: theme.muted }]}>
              {nothingActive ? 'Start Focus or configure a protection layer in Defense.' : 'This page updates automatically while it is open.'}
            </Text>
          </View>
        </View>

        <StatusCard icon="hourglass-outline" color={focusActive ? COLORS.primary : theme.muted} title="Focus Session" status={focusActive ? 'Active' : 'Not active'} theme={theme}>
          {focusActive && focusTask ? (
            <>
              <DetailRow label="Task" value={focusTask.title} theme={theme} />
              <DetailRow label="Ends at" value={dayjs(focusTask.endTime).format('HH:mm')} theme={theme} />
              <TouchableOpacity style={[styles.action, { borderColor: COLORS.red + '55', backgroundColor: COLORS.red + '12' }]} onPress={stopFocus}>
                <Ionicons name="stop-circle-outline" size={16} color={COLORS.red} />
                <Text style={[styles.actionText, { color: COLORS.red }]}>Stop Focus</Text>
              </TouchableOpacity>
            </>
          ) : (
            <EmptyText text="No task-based focus session is running." theme={theme} />
          )}
        </StatusCard>

        <StatusCard icon="ban-outline" color={standaloneActive ? COLORS.red : theme.muted} title="Standalone Block" status={standaloneActive ? 'Active' : 'Not active'} theme={theme}>
          <DetailRow label="Apps" value={standalonePackages.length ? `${standalonePackages.length} blocked` : 'None selected'} theme={theme} />
          <DetailRow label="Until" value={standaloneUntil ? formatDateTime(standaloneUntil) : 'No timer running'} theme={theme} />
          {standaloneActive ? (
            <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/focus')}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.actionText, { color: COLORS.primary }]}>Add time or apps</Text>
            </TouchableOpacity>
          ) : standalonePackages.length > 0 ? (
            <TouchableOpacity style={[styles.action, { borderColor: COLORS.red + '55' }]} onPress={clearStandalone}>
              <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              <Text style={[styles.actionText, { color: COLORS.red }]}>Clear saved apps</Text>
            </TouchableOpacity>
          ) : null}
        </StatusCard>

        <StatusCard icon="infinite-outline" color={alwaysOnActive ? COLORS.orange : theme.muted} title="Always-On Apps" status={alwaysOnActive ? 'Active' : 'Not active'} theme={theme} expandable={alwaysOnPackages.length > 0} expanded={expanded === 'alwaysOn'} onToggle={() => setExpanded(expanded === 'alwaysOn' ? null : 'alwaysOn')}>
          <DetailRow label="Apps" value={alwaysOnPackages.length ? `${alwaysOnPackages.length} blocked continuously` : 'No always-on apps'} theme={theme} />
          {expanded === 'alwaysOn' && <PackageList packages={alwaysOnPackages} appNames={appNames} theme={theme} />}
          <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => router.push('/always-on')}>
            <Ionicons name="settings-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Manage Always-On apps</Text>
          </TouchableOpacity>
        </StatusCard>

        <StatusCard icon="sunny-outline" color={allowanceEntries.length ? COLORS.orange : theme.muted} title="Daily Allowance" status={allowanceEntries.length ? `${allowanceEntries.length} app${allowanceEntries.length === 1 ? '' : 's'} configured` : 'Not configured'} theme={theme} expandable={allowanceEntries.length > 0} expanded={expanded === 'allowance'} onToggle={() => setExpanded(expanded === 'allowance' ? null : 'allowance')}>
          {allowanceEntries.length === 0 ? (
            <EmptyText text="No per-app daily limits are configured." theme={theme} />
          ) : expanded === 'allowance' ? (
          allowanceEntries.map((entry) => <AllowanceRow key={entry.packageName} entry={entry} usage={allowanceUsage[entry.packageName]} appName={appNames.get(entry.packageName)} activeSessionEndMs={entry.packageName === activeSessionPackage ? activeSessionEndMs : 0} clock={clock} theme={theme} />)
          ) : (
            <AllowanceSummary entries={allowanceEntries} usage={allowanceUsage} activeSessionPackage={activeSessionPackage} activeSessionEndMs={activeSessionEndMs} clock={clock} theme={theme} />
          )}
          <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/defense')}>
            <Ionicons name="settings-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Manage daily allowance</Text>
          </TouchableOpacity>
        </StatusCard>

        <StatusCard icon="text-outline" color={keywords.length ? COLORS.primary : theme.muted} title="Keyword Blocker" status={keywords.length ? 'Active' : 'Not active'} theme={theme} expandable={keywords.length > 0} expanded={expanded === 'keywords'} onToggle={() => setExpanded(expanded === 'keywords' ? null : 'keywords')}>
          <DetailRow label="Keywords" value={keywords.length ? `${keywords.length} active immediately` : 'No keywords configured'} theme={theme} />
          {expanded === 'keywords' && <View style={styles.chips}>{keywords.map((word) => <View key={word} style={[styles.chip, { backgroundColor: COLORS.primary + '14' }]}><Text style={[styles.chipText, { color: COLORS.primary }]}>{word}</Text></View>)}</View>}
          <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => router.push('/keyword-blocker')}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Manage keywords</Text>
          </TouchableOpacity>
        </StatusCard>

        <StatusCard icon="shield-checkmark-outline" color={vpnRunning && !vpnNeedsAttention ? COLORS.green : vpnNeedsAttention ? COLORS.red : theme.muted} title="VPN Blocking" status={vpnRunning && !vpnNeedsAttention ? 'Active' : vpnStatusLabel} theme={theme} expandable={vpnPackages.length > 0} expanded={expanded === 'vpn'} onToggle={() => setExpanded(expanded === 'vpn' ? null : 'vpn')}>
          <DetailRow label="Status" value={vpnStatusDetail} theme={theme} />
          {vpnPackages.length > 0 && <DetailRow label="Apps" value={`${vpnPackages.length} app${vpnPackages.length === 1 ? '' : 's'} selected`} theme={theme} />}
          {vpnStatus?.failedPackages.length ? (
            <DetailRow
              label="Unavailable"
              value={`${vpnStatus.failedPackages.length} selected app${vpnStatus.failedPackages.length === 1 ? '' : 's'} could not be registered`}
              theme={theme}
            />
          ) : null}
          {settings.vpnBlockEnabled && (
            <DetailRow
              label="Self-healing"
              value={settings.vpnSelfHealEnabled ? 'Enabled' : 'Disabled — manual recovery only'}
              theme={theme}
            />
          )}
          {expanded === 'vpn' && <PackageList packages={vpnPackages} appNames={appNames} theme={theme} />}
          <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => router.push('/vpn-block-list')}>
            <Ionicons name="settings-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Manage VPN blocking</Text>
          </TouchableOpacity>
        </StatusCard>

        {/* UI label only: Scheduled Blocks is the existing Greyout Block
            schedule feature; the underlying data and enforcement stay unchanged. */}
        <StatusCard
          icon="layers-outline"
          color={activeSchedules.length > 0 ? COLORS.purple : theme.muted}
          title="Scheduled Blocks"
          status={
            recurringSchedules.length === 0
              ? 'Not configured'
              : activeSchedules.length > 0
                ? `${activeSchedules.length} active · ${recurringSchedules.length} configured`
                : `${recurringSchedules.length} configured · none active`
          }
          theme={theme}
          expandable={recurringSchedules.length > 0}
          expanded={expanded === 'schedules'}
          onToggle={() => setExpanded(expanded === 'schedules' ? null : 'schedules')}
        >
          {recurringSchedules.length === 0 ? (
            <EmptyText text="No recurring scheduled blocks are configured." theme={theme} />
          ) : expanded === 'schedules' ? (
            recurringSchedules.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                active={activeSchedules.some((item) => item.id === schedule.id)}
                theme={theme}
              />
            ))
          ) : (
            <Text style={[styles.preview, { color: theme.muted }]}>
              {activeSchedules.length > 0
                ? `${activeSchedules.map((schedule) => schedule.name).join(', ')} running now.`
                : 'Tap to see configured days, times, and blocked app groups.'}
            </Text>
          )}
          <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/defense')}>
            <Ionicons name="settings-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Manage scheduled blocks</Text>
          </TouchableOpacity>
        </StatusCard>

        <View style={[styles.today, { borderTopColor: theme.border }]}>
          <Text style={[styles.todayLabel, { color: theme.muted }]}>TODAY</Text>
          <Text style={[styles.todayText, { color: theme.text }]}>
            {todayStats.completed}/{Math.max(todayStats.total, todayStats.completed)} tasks · {todayStats.focusMinutes}m focus · {todayStats.blocked} blocked attempts
          </Text>
        </View>
      </ScrollView>

      <PinVerifyModal visible={defPinVisible} pinType="defense" title="Defense Password Required" description="Enter your defense password to make this change." onVerified={() => { setDefPinVisible(false); pendingDefAction.current?.(); pendingDefAction.current = null; }} onCancel={() => { setDefPinVisible(false); pendingDefAction.current = null; }} />
      <PinVerifyModal visible={focusPinVisible} pinType="focus" title="Stop Focus Session" description="Enter your focus session password to end the session and stop blocking." onVerified={() => { setFocusPinVisible(false); void stopFocusMode(); }} onCancel={() => setFocusPinVisible(false)} />
    </SafeAreaView>
  );
}

export default withScreenErrorBoundary(ActiveScreen, 'Active');

function StatusCard({ icon, color, title, status, theme, children, expandable = false, expanded = false, onToggle }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; status: string; theme: ReturnType<typeof useTheme>['theme']; children: React.ReactNode; expandable?: boolean; expanded?: boolean; onToggle?: () => void }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={expandable ? onToggle : undefined} activeOpacity={expandable ? 0.7 : 1}>
        <View style={[styles.icon, { backgroundColor: color + '20' }]}><Ionicons name={icon} size={17} color={color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardStatus, { color: color === theme.muted ? theme.muted : color }]}>{status}</Text>
        </View>
        {expandable && <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={theme.muted} />}
      </TouchableOpacity>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return <View style={[styles.detailRow, { borderBottomColor: theme.border }]}><Text style={[styles.detailLabel, { color: theme.muted }]}>{label}</Text><Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>{value}</Text></View>;
}

function PackageList({ packages, appNames, theme }: { packages: string[]; appNames: Map<string, string>; theme: ReturnType<typeof useTheme>['theme'] }) {
  return <View style={[styles.packageList, { backgroundColor: theme.surface }]}>{packages.map((pkg) => <Text key={pkg} style={[styles.packageName, { color: theme.text }]}>{appNames.get(pkg) ?? shortPackageName(pkg)}</Text>)}</View>;
}

function AllowanceRow({ entry, usage, appName, activeSessionEndMs, clock, theme }: { entry: DailyAllowanceEntry; usage?: AllowanceUsage; appName?: string; activeSessionEndMs?: number; clock: number; theme: ReturnType<typeof useTheme>['theme'] }) {
  // For interval mode the window is rolling (not daily). If the window start
  // time has passed by more than intervalHours, the native service hasn't
  // flushed the stale usedMs yet — treat used as 0.
  const windowExpired = entry.mode === 'interval' && (
    !usage?.windowStartMs ||
    clock >= usage.windowStartMs + entry.intervalHours * 3_600_000
  );
  const used = entry.mode === 'count'
    ? (usage?.count ?? 0)
    : windowExpired
      ? 0
      : Math.floor((usage?.usedMs ?? 0) / 60_000);
  const limit = entry.mode === 'count' ? entry.countPerDay : entry.mode === 'time_budget' ? entry.budgetMinutes : entry.intervalMinutes;
  const remaining = Math.max(0, limit - used);
  const reset = resetLabel(entry, usage);
  const remainingLabel = formatAllowanceRemaining(entry, usage, remaining, windowExpired);
  const liveSession = activeSessionEndMs && activeSessionEndMs > clock
    ? `Live session: ${formatDuration(activeSessionEndMs - clock)} remaining`
    : null;
  return <View style={[styles.allowanceRow, { borderBottomColor: theme.border }]}><Text style={[styles.allowanceName, { color: theme.text }]}>{appName ?? shortPackageName(entry.packageName)}</Text><Text style={[styles.allowanceUsage, { color: remaining === 0 ? COLORS.red : theme.muted }]}>{remainingLabel} remaining · {used} / {limit} used · {reset}</Text>{liveSession && <Text style={[styles.allowanceUsage, { color: COLORS.green }]}>{liveSession}</Text>}</View>;
}

function AllowanceSummary({ entries, usage, activeSessionPackage, activeSessionEndMs, clock, theme }: { entries: DailyAllowanceEntry[]; usage: Record<string, AllowanceUsage>; activeSessionPackage: string | null; activeSessionEndMs: number; clock: number; theme: ReturnType<typeof useTheme>['theme'] }) {
  const first = entries[0];
  const firstUsage = usage[first.packageName];
  const windowExpired = first.mode === 'interval' && (
    !firstUsage?.windowStartMs ||
    clock >= firstUsage.windowStartMs + first.intervalHours * 3_600_000
  );
  const used = first.mode === 'count'
    ? (firstUsage?.count ?? 0)
    : windowExpired
      ? 0
      : Math.floor((firstUsage?.usedMs ?? 0) / 60_000);
  const limit = first.mode === 'count' ? first.countPerDay : first.mode === 'time_budget' ? first.budgetMinutes : first.intervalMinutes;
  const remaining = Math.max(0, limit - used);
  const remainingLabel = formatAllowanceRemaining(first, firstUsage, remaining, windowExpired);
  const liveSession = activeSessionPackage && activeSessionPackage === first.packageName && activeSessionEndMs > clock
    ? ` · Live session: ${formatDuration(activeSessionEndMs - clock)}`
    : '';
  return <Text style={[styles.preview, { color: theme.muted }]}>{entries.length === 1 ? `${remainingLabel} remaining · ${resetLabel(first, firstUsage)}${liveSession}` : `${entries.length} apps tracked${liveSession} · tap to see remaining allowances and reset times.`}</Text>;
}

function ScheduleRow({
  schedule,
  active,
  theme,
}: {
  schedule: RecurringBlockSchedule;
  active: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={[styles.scheduleRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.scheduleStatus, { backgroundColor: active ? COLORS.purple : theme.border }]} />
      <View style={styles.scheduleCopy}>
        <Text style={[styles.scheduleName, { color: theme.text }]} numberOfLines={1}>{schedule.name}</Text>
        <Text style={[styles.scheduleMeta, { color: theme.muted }]}>
          {active ? 'Running now · ' : ''}{formatScheduleTime(schedule)} · {formatScheduleDays(schedule.days)} · {schedule.packages.length} app{schedule.packages.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );
}

function EmptyText({ text, theme }: { text: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return <Text style={[styles.empty, { color: theme.muted }]}>{text}</Text>;
}

function formatDateTime(date: Date): string {
  return `${dayjs(date).format('MMM D')} at ${dayjs(date).format('HH:mm')}`;
}

function isScheduleActive(schedule: RecurringBlockSchedule, timestamp: number): boolean {
  if (!schedule.enabled) return false;
  const date = new Date(timestamp);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const start = schedule.startHour * 60 + schedule.startMin;
  const end = schedule.endHour * 60 + schedule.endMin;
  const overnightAfterMidnight = start > end && currentMinutes < end;
  const day = date.getDay() + 1;
  const scheduleDay = overnightAfterMidnight ? (day === 1 ? 7 : day - 1) : day;
  if (!schedule.days.includes(scheduleDay)) return false;
  return start <= end
    ? currentMinutes >= start && currentMinutes < end
    : currentMinutes >= start || currentMinutes < end;
}

function formatScheduleTime(schedule: RecurringBlockSchedule): string {
  const format = (hour: number, minute: number) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
  };
  return `${format(schedule.startHour, schedule.startMin)}–${format(schedule.endHour, schedule.endMin)}`;
}

function formatScheduleDays(days: number[]): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map((day) => labels[day - 1] ?? '?').join(', ');
}

function resetLabel(entry: DailyAllowanceEntry, usage?: AllowanceUsage): string {
  if (entry.mode !== 'interval') {
    return `Resets ${dayjs().add(1, 'day').startOf('day').format('MMM D at 00:00')}`;
  }
  if (!usage?.windowStartMs) return 'New window available';
  const resetAt = usage.windowStartMs + entry.intervalHours * 3_600_000;
  const remainingMs = resetAt - Date.now();
  if (remainingMs <= 0) return 'New window available';
  const minutes = Math.ceil(remainingMs / 60_000);
  return `Resets in ${minutes}m (${dayjs(resetAt).format('HH:mm')})`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, durationMs) / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function formatAllowanceRemaining(entry: DailyAllowanceEntry, usage: AllowanceUsage | undefined, fallbackMinutes: number, windowExpired = false): string {
  if (entry.mode === 'count') return `${fallbackMinutes} opens`;
  const allowanceMs = entry.mode === 'time_budget'
    ? (entry.budgetMinutes ?? 30) * 60_000
    : (entry.intervalMinutes ?? 5) * 60_000;
  // When the interval window has expired the native service hasn't flushed
  // usedMs yet — the previous window's value would show 0 remaining.
  // Treat usedMs as 0 so we display the full fresh-window allowance instead.
  const effectiveUsedMs = entry.mode === 'interval' && windowExpired ? 0 : (usage?.usedMs ?? 0);
  const remainingMs = Math.max(0, allowanceMs - effectiveUsedMs);
  return remainingMs < 5 * 60_000
    ? formatDuration(remainingMs)
    : `${Math.ceil(remainingMs / 60_000)} min`;
}

function shortPackageName(pkg: string): string {
  const parts = pkg.split('.');
  const last = parts[parts.length - 1] === 'android' ? parts[parts.length - 2] : parts[parts.length - 1];
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : pkg;
}

function formatVpnStatus(state: string | undefined, configured: boolean): string {
  switch (state) {
    case 'starting':
      return 'Starting';
    case 'running':
      return 'Running normally';
    case 'permission_missing':
      return 'Permission required';
    case 'another_vpn_active':
      return 'Another VPN is active';
    case 'package_registration_failed':
      return 'Some apps could not be registered';
    case 'startup_failed':
      return 'Startup failed';
    case 'disabled':
      return 'Disabled';
    case 'stopped':
      return configured ? 'Configured but stopped' : 'No VPN apps configured';
    default:
      return configured ? 'VPN status unavailable' : 'No VPN apps configured';
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCopy: { flex: 1, marginLeft: SPACING.sm },
  title: { fontSize: FONT.lg, fontWeight: '800' },
  subtitle: { fontSize: FONT.xs, marginTop: 2 },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  content: { padding: SPACING.md, gap: SPACING.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1 },
  summaryTitle: { fontSize: FONT.md, fontWeight: '700' },
  summaryText: { fontSize: FONT.xs, marginTop: 3 },
  card: { borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FONT.md, fontWeight: '700' },
  cardStatus: { fontSize: FONT.xs, fontWeight: '600', marginTop: 2 },
  cardBody: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: FONT.xs, minWidth: 70 },
  detailValue: { flex: 1, textAlign: 'right', fontSize: FONT.xs, fontWeight: '600' },
  empty: { fontSize: FONT.xs, lineHeight: 18, paddingVertical: SPACING.xs },
  preview: { fontSize: FONT.xs, paddingVertical: SPACING.xs },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, marginTop: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1 },
  actionText: { fontSize: FONT.xs, fontWeight: '700' },
  packageList: { borderRadius: RADIUS.sm, marginTop: SPACING.sm, paddingHorizontal: SPACING.sm },
  packageName: { fontSize: FONT.xs, paddingVertical: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.18)' },
  allowanceRow: { paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  allowanceName: { fontSize: FONT.sm, fontWeight: '700' },
  allowanceUsage: { fontSize: FONT.xs, marginTop: 3 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  scheduleStatus: { width: 8, height: 8, borderRadius: 4 },
  scheduleCopy: { flex: 1 },
  scheduleName: { fontSize: FONT.sm, fontWeight: '700' },
  scheduleMeta: { fontSize: FONT.xs, lineHeight: 17, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, paddingVertical: SPACING.xs },
  chip: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  chipText: { fontSize: FONT.xs, fontWeight: '600' },
  today: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.md, marginTop: SPACING.xs },
  todayLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  todayText: { fontSize: FONT.xs, marginTop: 4 },
});