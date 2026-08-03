/**
 * active.tsx
 *
 * "Active" screen — live dashboard of every blocking surface in the app.
 * Replaces the old "What's blocking right now" panel that lived inside
 * Block Enforcement. Reachable from the Side Menu (top entry, above
 * Block Controls).
 *
 * Sections:
 *   1. Focus session card           — running task, time remaining, stop btn
 *   2. Timed standalone block       — countdown, blocked-app count, add-time
 *   3. Always-on enforcement        — list count + one-tap clear
 *   4. Active Block Schedules       — recurring/time-window blocks live now
 *   5. Active enforcement layers    — System Guard, Shorts, Reels, Keywords
 *   6. Today's daily allowance      — per-app remaining count/minutes
 *   7. Today's stats                — focus minutes + distractions blocked
 *   8. Quick actions                — start standalone, edit schedules, etc.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { dbGetRecentDayCompletions, dbGetTodayFocusMinutes, dbGetTodayOverrideCount } from '@/data/database';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { SessionPinModule } from '@/native-modules/SessionPinModule';

export default function ActiveScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, stopFocusMode, setStandaloneBlockAndAllowance } = useApp();
  const { settings } = state;
  const [defPinVisible, setDefPinVisible] = useState(false);
  const [focusPinVisible, setFocusPinVisible] = useState(false);
  const pendingDefAction = useRef<(() => void) | null>(null);

  // ── Derived live state ────────────────────────────────────────────────────
  const focusActive = state.focusSession?.isActive === true;
  const focusTask = state.focusSession
    ? state.tasks.find((t) => t.id === state.focusSession?.taskId)
    : null;

  const standalonePkgs = settings.standaloneBlockPackages ?? [];
  const standaloneUntil = settings.standaloneBlockUntil
    ? new Date(settings.standaloneBlockUntil)
    : null;
  const standaloneTimerActive =
    !!standaloneUntil && standalonePkgs.length > 0 && standaloneUntil.getTime() > Date.now();

  const allowanceEntries = settings.dailyAllowanceEntries ?? [];
  const alwaysOnActive = standalonePkgs.length > 0 || allowanceEntries.length > 0;

  const recurringSchedules = settings.recurringBlockSchedules ?? [];
  const greyoutWindows = settings.greyoutSchedule ?? [];
  const activeWindows = computeActiveWindows(greyoutWindows, recurringSchedules);

  // Each layer row optionally has a `route` so tapping it deep-links to the
  // dedicated management page. Layers without a route stay informational.
  const enforcementLayers: Array<{
    key: string;
    label: string;
    on: boolean;
    icon: 'lock-closed-outline' | 'logo-youtube' | 'logo-instagram' | 'text-outline';
    count?: number;
    route?: string;
  }> = [
    { key: 'systemGuard', label: 'System Protection',     on: settings.systemGuardEnabled ?? false,         icon: 'lock-closed-outline', route: '/block-defense?tab=system' },
    { key: 'shorts',      label: 'YouTube Shorts Block',  on: settings.blockYoutubeShortsEnabled ?? false,  icon: 'logo-youtube',        route: '/block-defense?tab=system' },
    { key: 'reels',       label: 'Instagram Reels Block', on: settings.blockInstagramReelsEnabled ?? false, icon: 'logo-instagram',      route: '/block-defense?tab=system' },
    { key: 'keywords',    label: 'Keyword Blocker',       on: (settings.blockedWords ?? []).length > 0,     icon: 'text-outline', count: (settings.blockedWords ?? []).length, route: '/keyword-blocker' },
  ];
  const enforcementOnCount = enforcementLayers.filter((l) => l.on).length;

  // ── Today's stats from daily_completions + focus_sessions ─────────────────
  const [todayStats, setTodayStats] = useState<{
    completed: number;
    total: number;
    focusMinutes: number;
    distractionsBlocked: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const [rows, focusMinutes, distractions] = await Promise.all([
            dbGetRecentDayCompletions(1),
            dbGetTodayFocusMinutes(),
            dbGetTodayOverrideCount(),
          ]);
          const todayKey = dayjs().format('YYYY-MM-DD');
          const today = rows.find((r) => r.date === todayKey);
          const todayTasks = state.tasks.filter(
            (t) => dayjs(t.startTime).format('YYYY-MM-DD') === todayKey,
          );
          if (mounted) {
            setTodayStats({
              completed: today?.completed ?? 0,
              total: today?.total ?? todayTasks.length,
              focusMinutes,
              distractionsBlocked: distractions,
            });
          }
        } catch {
          if (mounted) setTodayStats({ completed: 0, total: 0, focusMinutes: 0, distractionsBlocked: 0 });
        }
      })();
      return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // ── Pin helpers ───────────────────────────────────────────────────────────
  const withDefensePin = (action: () => void) => {
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => {
        if (hash) {
          // A defense PIN is configured — always require it, regardless of
          // whether the pinProtectionEnabled toggle is on.
          pendingDefAction.current = action;
          setDefPinVisible(true);
        } else {
          action();
        }
      })
      .catch(() => action());
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleClearAlwaysOn = () => {
    if (standaloneTimerActive) {
      Alert.alert(
        'Block Timer Running',
        'A timed block is currently active. Clearing the list will stop always-on enforcement after the timer ends, but cannot remove apps until the timer expires.',
      );
      return;
    }
    withDefensePin(() => {
      Alert.alert(
        'Clear standalone block list?',
        `This removes ${standalonePkgs.length} app${standalonePkgs.length !== 1 ? 's' : ''} from the always-on block list. Daily allowance rules are not affected.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => {
              void setStandaloneBlockAndAllowance([], null, allowanceEntries);
            },
          },
        ],
      );
    });
  };

  const handleStopFocus = () => {
    SessionPinModule.isPinSet()
      .catch(() => false)
      .then((pinSet) => {
        if (pinSet) {
          setFocusPinVisible(true);
        } else {
          Alert.alert('Stop focus session?', 'This ends app blocking for the current task.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Stop', style: 'destructive', onPress: () => { void stopFocusMode(); } },
          ]);
        }
      });
  };

  const standaloneEndsLabel = standaloneUntil
    ? `${standaloneUntil.getHours().toString().padStart(2, '0')}:${standaloneUntil.getMinutes().toString().padStart(2, '0')}`
    : null;

  const nothingActive =
    !focusActive &&
    !standaloneTimerActive &&
    !alwaysOnActive &&
    activeWindows.length === 0 &&
    enforcementOnCount === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={[styles.title, { color: theme.text }]}>Active</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Live status of every block running now</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
      >
        {/* All-clear banner ─────────────────────────────────── */}
        {nothingActive && (
          <View style={[styles.allClearCard, { backgroundColor: COLORS.green + '12', borderColor: COLORS.green + '44' }]}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.green} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.allClearTitle, { color: theme.text }]}>All clear</Text>
              <Text style={[styles.allClearDesc, { color: theme.muted }]}>
                No focus session, no timed block, no always-on enforcement, no schedules running.
              </Text>
            </View>
          </View>
        )}

        {/* 1. Focus session ────────────────────────────────── */}
        <SectionCard
          icon="hourglass-outline"
          iconBg={focusActive ? COLORS.primary : theme.muted}
          title="Focus Session"
          theme={theme}
        >
          {focusActive && focusTask ? (
            <>
              <Row label="Task" value={focusTask.title} theme={theme} />
              <Row
                label="Ends"
                value={dayjs(focusTask.endTime).format('HH:mm')}
                theme={theme}
              />
              <TouchableOpacity
                style={[styles.dangerBtn, { borderColor: COLORS.red + '55', backgroundColor: COLORS.red + '14' }]}
                onPress={handleStopFocus}
              >
                <Ionicons name="stop-circle-outline" size={16} color={COLORS.red} />
                <Text style={[styles.dangerBtnText, { color: COLORS.red }]}>Stop Focus</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.emptyRow, { color: theme.muted }]}>No focus session running.</Text>
          )}
        </SectionCard>

        {/* 2. Timed standalone block ───────────────────────── */}
        <SectionCard
          icon="ban-outline"
          iconBg={standaloneTimerActive ? COLORS.red : theme.muted}
          title="Timed Standalone Block"
          theme={theme}
        >
          {standaloneTimerActive ? (
            <>
              <Row label="Apps blocked" value={`${standalonePkgs.length}`} theme={theme} />
              <Row label="Ends at" value={standaloneEndsLabel ?? '—'} theme={theme} />
              <TouchableOpacity
                style={[styles.linkBtn, { borderColor: theme.border }]}
                onPress={() => router.push('/(tabs)/focus')}
              >
                <Ionicons name="add-circle-outline" size={14} color={COLORS.primary} />
                <Text style={[styles.linkBtnText, { color: COLORS.primary }]}>Add Time / More Apps</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.emptyRow, { color: theme.muted }]}>No timed block running.</Text>
          )}
        </SectionCard>

        {/* 3. Always-on enforcement ────────────────────────── */}
        {(() => {
          const alwaysOnOverlayPkgs = settings.alwaysOnPackages ?? [];
          const alwaysOnVpnPkgs = settings.alwaysOnVpnPackages ?? [];
          const hasOverlay = alwaysOnOverlayPkgs.length > 0;
          const hasVpn = alwaysOnVpnPkgs.length > 0;
          const sectionActive = alwaysOnActive || hasOverlay || hasVpn;
          return (
            <SectionCard
              icon="shield-checkmark-outline"
              iconBg={sectionActive ? COLORS.orange : theme.muted}
              title="Always-on Enforcement"
              theme={theme}
            >
              {sectionActive ? (
                <>
                  <Row
                    label="Overlay block (24/7)"
                    value={
                      hasOverlay
                        ? `${alwaysOnOverlayPkgs.length} app${alwaysOnOverlayPkgs.length !== 1 ? 's' : ''} accessibility-blocked`
                        : 'None'
                    }
                    theme={theme}
                  />
                  <Row
                    label="VPN block (network)"
                    value={
                      hasVpn
                        ? `${alwaysOnVpnPkgs.length} app${alwaysOnVpnPkgs.length !== 1 ? 's' : ''} internet-cut 24/7`
                        : 'None'
                    }
                    theme={theme}
                  />
                  {allowanceEntries.length > 0 && (
                    <Row
                      label="Daily allowance rules"
                      value={`${allowanceEntries.length} rule${allowanceEntries.length !== 1 ? 's' : ''}`}
                      theme={theme}
                    />
                  )}
                  <Text style={[styles.helperLine, { color: theme.muted }]}>
                    These enforcement layers run 24/7 — no timer or session needed.
                  </Text>
                  <View style={styles.actionRow}>
                    {hasOverlay && (
                      <TouchableOpacity
                        style={[styles.linkBtn, { borderColor: theme.border, flex: 1 }]}
                        onPress={() => router.push('/always-on')}
                      >
                        <Ionicons name="infinite-outline" size={14} color={COLORS.orange} />
                        <Text style={[styles.linkBtnText, { color: COLORS.orange }]}>Overlay List</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.linkBtn, { borderColor: theme.border, flex: 1 }]}
                      onPress={() => router.push('/vpn-block-list')}
                    >
                      <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.linkBtnText, { color: COLORS.primary }]}>VPN List</Text>
                    </TouchableOpacity>
                  </View>
                  {standalonePkgs.length > 0 && (
                    <TouchableOpacity
                      style={[styles.dangerBtn, { borderColor: COLORS.red + '55', backgroundColor: COLORS.red + '14' }]}
                      onPress={handleClearAlwaysOn}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                      <Text style={[styles.dangerBtnText, { color: COLORS.red }]}>Clear Standalone Block</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Text style={[styles.emptyRow, { color: theme.muted }]}>
                    Empty block list — nothing enforced outside of timed sessions.
                  </Text>
                  <TouchableOpacity
                    style={[styles.linkBtn, { borderColor: theme.border }]}
                    onPress={() => router.push('/vpn-block-list')}
                  >
                    <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primary} />
                    <Text style={[styles.linkBtnText, { color: COLORS.primary }]}>Set Up VPN Block List</Text>
                  </TouchableOpacity>
                </>
              )}
            </SectionCard>
          );
        })()}

        {/* 4. Active Block Schedules ───────────────────────── */}
        <SectionCard
          icon="time-outline"
          iconBg={activeWindows.length > 0 ? COLORS.primary : theme.muted}
          title="Active Block Schedules"
          theme={theme}
        >
          {activeWindows.length === 0 ? (
            <Text style={[styles.emptyRow, { color: theme.muted }]}>
              No schedule windows are running right now.
            </Text>
          ) : (
            activeWindows.map((w, i) => (
              <Row
                key={i}
                label={w.label}
                value={`${w.startLabel} – ${w.endLabel}`}
                theme={theme}
                isLast={i === activeWindows.length - 1}
              />
            ))
          )}
          <TouchableOpacity
            style={[styles.linkBtn, { borderColor: theme.border }]}
            onPress={() => router.push('/block-defense?tab=greyout')}
          >
            <Ionicons name="settings-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.linkBtnText, { color: COLORS.primary }]}>Manage Schedules</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* 5. Active enforcement layers ────────────────────── */}
        <SectionCard
          icon="layers-outline"
          iconBg={enforcementOnCount > 0 ? COLORS.primary : theme.muted}
          title={`Enforcement Layers (${enforcementOnCount}/${enforcementLayers.length})`}
          theme={theme}
        >
          {enforcementLayers.map((layer, i) => {
            const rowContent = (
              <>
                <Ionicons name={layer.icon} size={14} color={layer.on ? COLORS.primary : theme.muted} />
                <Text style={[styles.layerLabel, { color: theme.text, flex: 1 }]}>{layer.label}</Text>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: layer.on ? COLORS.green + '22' : theme.muted + '22' },
                  ]}
                >
                  <Text style={[styles.pillText, { color: layer.on ? COLORS.green : theme.muted }]}>
                    {layer.on ? (layer.count ? `ON · ${layer.count}` : 'ON') : 'OFF'}
                  </Text>
                </View>
                {layer.route && <Ionicons name="chevron-forward" size={12} color={theme.muted} />}
              </>
            );
            const rowStyle = [
              styles.layerRow,
              i < enforcementLayers.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
            ];
            if (layer.route) {
              return (
                <TouchableOpacity
                  key={layer.key}
                  style={rowStyle}
                  onPress={() => router.push(layer.route as never)}
                  activeOpacity={0.7}
                >
                  {rowContent}
                </TouchableOpacity>
              );
            }
            return <View key={layer.key} style={rowStyle}>{rowContent}</View>;
          })}
        </SectionCard>

        {/* 6. Today's daily allowance ──────────────────────── */}
        {allowanceEntries.length > 0 && (
          <SectionCard
            icon="sunny-outline"
            iconBg={COLORS.orange}
            title="Today's Daily Allowance"
            theme={theme}
          >
            {allowanceEntries.map((e, i) => (
              <Row
                key={`${e.packageName}-${i}`}
                label={shortPkgLabel(e.packageName)}
                value={describeAllowance(e)}
                theme={theme}
                isLast={i === allowanceEntries.length - 1}
              />
            ))}
          </SectionCard>
        )}

        {/* 7. Today's stats ────────────────────────────────── */}
        <SectionCard
          icon="bar-chart-outline"
          iconBg={COLORS.primary}
          title="Today"
          theme={theme}
        >
          <Row
            label="Tasks completed"
            value={todayStats ? `${todayStats.completed} / ${Math.max(todayStats.total, todayStats.completed)}` : '—'}
            theme={theme}
          />
          <Row
            label="Focus minutes"
            value={todayStats ? `${todayStats.focusMinutes} min` : '—'}
            theme={theme}
          />
          <Row
            label="Distractions blocked"
            value={todayStats ? `${todayStats.distractionsBlocked}` : '—'}
            theme={theme}
            isLast
          />
        </SectionCard>

        {/* 8. Quick actions ────────────────────────────────── */}
        <SectionCard
          icon="flash-outline"
          iconBg={COLORS.primary}
          title="Quick Actions"
          theme={theme}
        >
          <QuickAction
            icon="ban-outline"
            label="Start Standalone Block"
            onPress={() => router.push('/(tabs)/focus')}
            theme={theme}
          />
          <QuickAction
            icon="time-outline"
            label="Edit Block Schedules"
            onPress={() => router.push('/block-defense?tab=greyout')}
            theme={theme}
          />
          <QuickAction
            icon="shield-checkmark-outline"
            label="Block Enforcement Settings"
            onPress={() => router.push('/block-defense')}
            theme={theme}
          />
          <QuickAction
            icon="bar-chart-outline"
            label="Open Stats"
            onPress={() => router.push('/(tabs)/stats')}
            theme={theme}
            isLast
          />
        </SectionCard>
      </ScrollView>

      <PinVerifyModal
        visible={defPinVisible}
        pinType="defense"
        title="Defense Password Required"
        description="Enter your defense password to make this change."
        onVerified={() => {
          setDefPinVisible(false);
          pendingDefAction.current?.();
          pendingDefAction.current = null;
        }}
        onCancel={() => {
          setDefPinVisible(false);
          pendingDefAction.current = null;
        }}
      />

      <PinVerifyModal
        visible={focusPinVisible}
        pinType="focus"
        title="Stop Focus Session"
        description="Enter your focus session password to end the session and stop all blocking."
        onVerified={() => {
          setFocusPinVisible(false);
          void stopFocusMode();
        }}
        onCancel={() => setFocusPinVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function shortPkgLabel(pkg: string): string {
  // "com.instagram.android" → "Instagram"
  const parts = pkg.split('.');
  const last = parts[parts.length - 1] === 'android' ? parts[parts.length - 2] : parts[parts.length - 1];
  if (!last) return pkg;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function describeAllowance(e: import('@/data/types').DailyAllowanceEntry): string {
  if (e.mode === 'count') return `${e.countPerDay} opens / day`;
  if (e.mode === 'time_budget') return `${e.budgetMinutes} min / day`;
  if (e.mode === 'interval') return `${e.intervalMinutes} min every ${e.intervalHours}h`;
  return String(e.mode);
}

type ActiveWindow = { label: string; startLabel: string; endLabel: string };

function computeActiveWindows(
  greyoutWindows: import('@/data/types').GreyoutWindow[],
  recurring: import('@/data/types').RecurringBlockSchedule[],
): ActiveWindow[] {
  const now = new Date();
  // Calendar.DAY_OF_WEEK: 1=Sun..7=Sat; JS getDay(): 0=Sun..6=Sat
  const today = now.getDay() + 1;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: ActiveWindow[] = [];

  for (const w of greyoutWindows) {
    if (w.days && w.days.length > 0 && !w.days.includes(today)) continue;
    const startM = w.startHour * 60 + w.startMin;
    const endM = w.endHour * 60 + w.endMin;
    if (isWithinWindow(nowMin, startM, endM)) {
      out.push({
        label: 'Time-window block',
        startLabel: minToLabel(startM),
        endLabel: minToLabel(endM),
      });
    }
  }
  for (const r of recurring) {
    if (r.enabled === false) continue;
    if (r.days && r.days.length > 0 && !r.days.includes(today)) continue;
    const startM = r.startHour * 60 + r.startMin;
    const endM = r.endHour * 60 + r.endMin;
    if (isWithinWindow(nowMin, startM, endM)) {
      out.push({
        label: r.name ?? 'Recurring block',
        startLabel: minToLabel(startM),
        endLabel: minToLabel(endM),
      });
    }
  }
  return out;
}

function isWithinWindow(nowMin: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return nowMin >= start && nowMin < end;
  return nowMin >= start || nowMin < end;
}

function minToLabel(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  icon,
  iconBg,
  title,
  theme,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  theme: ReturnType<typeof useTheme>['theme'];
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBg + '22' }]}>
          <Ionicons name={icon} size={14} color={iconBg} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  theme,
  isLast = false,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  theme,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.quickActionRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={[styles.quickActionLabel, { color: theme.text, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={theme.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: FONT.lg, fontWeight: '800' },
  subtitle: { fontSize: FONT.xs, marginTop: 2 },
  content: { padding: SPACING.lg, gap: SPACING.md },

  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  allClearTitle: { fontSize: FONT.md, fontWeight: '700' },
  allClearDesc: { fontSize: FONT.xs, lineHeight: 17 },

  sectionCard: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: FONT.sm, fontWeight: '700' },
  sectionBody: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  rowLabel: { fontSize: FONT.xs, fontWeight: '600', flex: 0, minWidth: 100 },
  rowValue: { fontSize: FONT.xs, fontWeight: '500', flex: 1, textAlign: 'right' },

  emptyRow: { fontSize: FONT.xs, paddingVertical: SPACING.sm, lineHeight: 17 },
  helperLine: { fontSize: FONT.xs, lineHeight: 17, paddingVertical: SPACING.xs, fontStyle: 'italic' },

  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
  },
  layerLabel: { fontSize: FONT.xs, fontWeight: '500' },
  pill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
  },
  quickActionLabel: { fontSize: FONT.sm, fontWeight: '500' },

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  dangerBtnText: { fontSize: FONT.xs, fontWeight: '700' },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
  },
  linkBtnText: { fontSize: FONT.xs, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
});
