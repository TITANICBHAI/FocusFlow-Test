import React, { useEffect, useState, useRef } from 'react';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Linking,
  Platform,
  AppState,
  ScrollView,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import { useTaskTimer } from '@/hooks/useTimer';
import { usePomodoro } from '@/hooks/usePomodoro';
import { formatTime, isAwaitingDecision } from '@/services/taskService';
import { dbLogFocusOverride } from '@/data/database';
import { UsageStatsModule } from '@/native-modules/UsageStatsModule';
import { StandaloneBlockModal } from '@/components/StandaloneBlockModal';
import { DailyAllowanceModal } from '@/components/DailyAllowanceModal';
import ExtendModal from '@/components/ExtendModal';
import { PinRotationModal } from '@/components/PinRotationModal';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

function FocusScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const ringSize = Math.min(Math.floor(windowWidth * 0.65), 260);
  const { state, currentTask, activeTasks, startFocusMode, stopFocusMode, completeTask, skipTask, extendTaskTime, setStandaloneBlockAndAllowance, updateSettings, setRecurringBlockSchedules } = useApp();
  const isFocusing = state.focusSession !== null && state.focusSession.isActive;
  const [hasAccessibilityPermission, setHasAccessibilityPermission] = useState<boolean | null>(null);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [dailyAllowanceModalVisible, setDailyAllowanceModalVisible] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [pinRotationVisible, setPinRotationVisible] = useState(false);
  const [pendingStartTaskId, setPendingStartTaskId] = useState<string | null>(null);
  const [defPinVisible, setDefPinVisible] = useState(false);
  const pendingDefAction = useRef<(() => void) | null>(null);
  const [focusStopPinVisible, setFocusStopPinVisible] = useState(false);

  const handleActivateFocus = async (taskId: string) => {
    const pinSet = await SessionPinModule.isPinSet().catch(() => false);
    if (pinSet) {
      setPendingStartTaskId(taskId);
      setPinRotationVisible(true);
    } else {
      startFocusMode(taskId);
    }
  };

  const { settings } = state;
  const standaloneActive = (() => {
    if (!settings.standaloneBlockUntil) return false;
    if ((settings.standaloneBlockPackages ?? []).length === 0) return false;
    return new Date(settings.standaloneBlockUntil).getTime() > Date.now();
  })();

  const task = currentTask;
  const awaitingDecision = task ? isAwaitingDecision(task) : false;
  const otherActiveCount = Math.max(0, activeTasks.filter((t) => t.id !== task?.id).length);
  const blockPresets = settings.blockPresets ?? [];

  const pomodoro = usePomodoro(
    isFocusing && (settings.pomodoroEnabled ?? false),
    state.focusSession?.startedAt ?? null,
    settings.pomodoroDuration ?? 25,
    settings.pomodoroBreak ?? 5,
  );

  const handleSaveBlockPreset = async (preset: import('@/data/types').BlockPreset) => {
    const presets = [...blockPresets, preset];
    await updateSettings({ ...settings, blockPresets: presets });
  };

  const handleDeleteBlockPreset = async (id: string) => {
    const presets = blockPresets.filter((p) => p.id !== id);
    await updateSettings({ ...settings, blockPresets: presets });
  };

  const handleAddTime = async (minutes: number) => {
    const baseMs = settings.standaloneBlockUntil
      ? Math.max(new Date(settings.standaloneBlockUntil).getTime(), Date.now())
      : Date.now();
    const untilMs = baseMs + minutes * 60 * 1000;
    await setStandaloneBlockAndAllowance(
      settings.standaloneBlockPackages ?? [],
      untilMs,
      settings.dailyAllowanceEntries ?? [],
    );
  };

  const handleQuickBlock = async (preset: import('@/data/types').BlockPreset, hours: number) => {
    if (Platform.OS === 'android') {
      const hasA11y = await UsageStatsModule.hasAccessibilityPermission().catch(() => false);
      const hasUsage = await UsageStatsModule.hasPermission().catch(() => false);
      if (!hasA11y || !hasUsage) {
        Alert.alert(
          'Permissions Required',
          'FocusFlow needs Accessibility and Usage Access to block apps.\n\nGo to Settings → Permissions to grant them.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Permissions',
              onPress: async () => {
                if (!hasA11y) await UsageStatsModule.openAccessibilitySettings().catch(() => {});
                else await UsageStatsModule.openUsageAccessSettings().catch(() => {});
              },
            },
          ]
        );
        return;
      }
    }
    // Additive merge: union the preset's packages with whatever is already
    // blocked. This way tapping a preset NEVER drops apps the user already
    // had blocked. Time is extended from the later of "now" and the existing
    // expiry, so adding to a running block always lengthens it.
    const existing = settings.standaloneBlockPackages ?? [];
    const mergedPackages = Array.from(new Set([...existing, ...preset.packages]));
    const baseMs = settings.standaloneBlockUntil
      ? Math.max(new Date(settings.standaloneBlockUntil).getTime(), Date.now())
      : Date.now();
    const untilMs = baseMs + hours * 60 * 60 * 1000;
    await setStandaloneBlockAndAllowance(
      mergedPackages,
      untilMs,
      settings.dailyAllowanceEntries ?? [],
    );
  };

  // ── Animation refs ──────────────────────────────────────────────────────
  const pulseAnim      = React.useRef(new Animated.Value(1)).current;
  const rotateAnim     = React.useRef(new Animated.Value(0)).current;
  const ripple1Scale   = React.useRef(new Animated.Value(1)).current;
  const ripple1Opacity = React.useRef(new Animated.Value(0)).current;
  const ripple2Scale   = React.useRef(new Animated.Value(1)).current;
  const ripple2Opacity = React.useRef(new Animated.Value(0)).current;
  const ripple3Scale   = React.useRef(new Animated.Value(1)).current;
  const ripple3Opacity = React.useRef(new Animated.Value(0)).current;
  const innerGlow      = React.useRef(new Animated.Value(0.7)).current;
  const rotateInterp   = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const granted = await UsageStatsModule.hasAccessibilityPermission();
        setHasAccessibilityPermission(granted);
      } catch {
        setHasAccessibilityPermission(false);
      }
    };
    void checkPermission();

    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        // Check immediately then retry — Samsung One UI and low-end devices may
        // not have flushed the updated permission state to AccessibilityManager
        // by the time the app regains focus. Galaxy A-series can take 2–3 seconds.
        void checkPermission();
        if (t1) clearTimeout(t1);
        if (t2) clearTimeout(t2);
        t1 = setTimeout(() => void checkPermission(), 2000);
        t2 = setTimeout(() => void checkPermission(), 4000);
      }
    });
    return () => {
      sub.remove();
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);
    [ripple1Scale, ripple2Scale, ripple3Scale].forEach(v => v.setValue(1));
    [ripple1Opacity, ripple2Opacity, ripple3Opacity].forEach(v => v.setValue(0));

    if (!isFocusing) {
      // Idle — gentle breathe only
      const idle = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
        ]),
      );
      idle.start();
      return () => idle.stop();
    }

    // Active focus: full suite
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.10, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1600, useNativeDriver: true }),
      ]),
    );
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 12000, useNativeDriver: true }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(innerGlow, { toValue: 1,    duration: 900, useNativeDriver: true }),
        Animated.timing(innerGlow, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      ]),
    );
    const makeRipple = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1.65, duration: 2200, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 0.45, duration: 200,  useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0,    duration: 2000, useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ]),
      );
    const r1 = makeRipple(ripple1Scale, ripple1Opacity, 0);
    const r2 = makeRipple(ripple2Scale, ripple2Opacity, 800);
    const r3 = makeRipple(ripple3Scale, ripple3Opacity, 1600);

    breathe.start(); rotate.start(); glow.start();
    r1.start(); r2.start(); r3.start();
    return () => {
      breathe.stop(); rotate.stop(); glow.stop();
      r1.stop(); r2.stop(); r3.stop();
    };
  }, [isFocusing, task?.id]);

  if (!task) {
    // ── State 1: Standalone block is active, no task ──────────────────────────
    if (standaloneActive) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
          <ScrollView
            contentContainerStyle={[styles.emptyContainer, { paddingBottom: 60 + insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Big shield icon with red tint */}
            <View style={[styles.standaloneIconWrap, { backgroundColor: COLORS.red + '15' }]}>
              <Ionicons name="ban" size={42} color={COLORS.red} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Apps Blocked</Text>
            <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
              Standalone block is running. You can add more apps but cannot stop the block early.
            </Text>

            {/* Countdown timer to expiry */}
            {settings.standaloneBlockUntil && (
              <StandaloneCountdown
                untilIso={settings.standaloneBlockUntil}
                blockedCount={(settings.standaloneBlockPackages ?? []).length}
              />
            )}

            {/* Add more apps button */}
            <TouchableOpacity
              style={[styles.addMoreAppsBtn, { backgroundColor: theme.card, borderColor: COLORS.red + '44' }]}
              onPress={() => setBlockModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.red} />
              <Text style={[styles.addMoreAppsBtnText, { color: COLORS.red }]}>Add More Apps to Block</Text>
            </TouchableOpacity>

            {/* Add time to current block */}
            <View style={styles.quickBlockSection}>
              <Text style={[styles.quickBlockLabel, { color: theme.muted }]}>ADD TIME</Text>
              <View style={[styles.addTimeRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {[
                  { label: '+30m', minutes: 30 },
                  { label: '+1h', minutes: 60 },
                  { label: '+2h', minutes: 120 },
                  { label: '+4h', minutes: 240 },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.addTimeBtn, { backgroundColor: COLORS.primary + '14', borderColor: COLORS.primary + '44' }]}
                    onPress={() => { void handleAddTime(opt.minutes); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addTimeBtnText, { color: COLORS.primary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <StandaloneBlockModal
            visible={blockModalVisible}
            blockedPackages={settings.standaloneBlockPackages ?? []}
            blockUntil={settings.standaloneBlockUntil}
            locked={standaloneActive}
            dailyAllowanceEntries={settings.dailyAllowanceEntries ?? []}
            vpnPackages={settings.standaloneVpnPackages ?? []}
            blockPresets={blockPresets}
            recurringBlockSchedules={settings.recurringBlockSchedules ?? []}
            onSave={async (packages, untilMs, allowanceEntries, vpnPackages) => {
              await setStandaloneBlockAndAllowance(packages, untilMs, allowanceEntries, vpnPackages);
            }}
            onSavePreset={handleSaveBlockPreset}
            onDeletePreset={handleDeleteBlockPreset}
            onSaveRecurringSchedules={async (schedules) => { await setRecurringBlockSchedules(schedules); }}
            onClose={() => setBlockModalVisible(false)}
          />
        </SafeAreaView>
      );
    }

    // ── State 2: Nothing active — prompt to create a task ─────────────────────
    const alwaysOnPkgs = settings.alwaysOnPackages ?? [];
    const alwaysOnHasList = alwaysOnPkgs.length > 0;
    // Master enforcement switch — defaults to ON when undefined.
    const enforcementOn = settings.alwaysOnEnforcementEnabled !== false;
    // "Active" = list has packages AND enforcement is on (drives icon colour).
    const alwaysOnActive = alwaysOnHasList && enforcementOn;
    const autoCopyOn = settings.autoCopyToAlwaysOn ?? false;
    const withDefensePin = (action: () => void) => {
      if (!settings.pinProtectionEnabled) {
        action();
        return;
      }
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
    const handleToggleEnforcement = (next: boolean) => {
      if (!next) {
        withDefensePin(() => void updateSettings({ ...settings, alwaysOnEnforcementEnabled: false }));
        return;
      }
      void updateSettings({ ...settings, alwaysOnEnforcementEnabled: true });
    };
    // Slim hint counts shown below the card — quick at-a-glance status.
    const allowanceCount = (settings.dailyAllowanceEntries ?? []).length;
    const scheduleCount  = (settings.recurringBlockSchedules ?? []).filter((s) => s.enabled).length;
    const blockedWords   = settings.blockedWords ?? [];
    const keywordCount   = blockedWords.length;
    const handleClearAlwaysOn = () => {
      withDefensePin(() => {
        Alert.alert(
          'Clear always-on block list?',
          `This removes ${alwaysOnPkgs.length} app${alwaysOnPkgs.length !== 1 ? 's' : ''} from the permanent block list. They will no longer be blocked 24/7.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: () => {
                void updateSettings({ ...settings, alwaysOnPackages: [] });
              },
            },
          ],
        );
      });
    };
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { paddingBottom: 60 + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Ionicons name="calendar-outline" size={64} color={theme.border} />
          <Text style={[styles.emptyTitle, { color: theme.muted }]}>No Tasks Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
            Create a task in the Schedule tab to start using Focus Mode
          </Text>

          <TouchableOpacity
            style={[styles.createTaskBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => router.push('/')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.createTaskBtnText}>Create a Task</Text>
          </TouchableOpacity>

          {/* ── Unified Enforcement Panel ───────────────────────────────
               The always-on toggle is the master switch for all 24/7 enforcement.
               The four rows below it are dimmed (but still tappable) when off,
               so the user can still configure each tool even while paused. */}
          <View style={[styles.enforcementPanel, { backgroundColor: theme.card, borderColor: enforcementOn ? COLORS.orange + '55' : theme.border }]}>

            {/* Header row — master toggle */}
            <View style={styles.enforcementHeader}>
              <Ionicons
                name={alwaysOnActive ? 'shield-checkmark' : 'shield-outline'}
                size={15}
                color={alwaysOnActive ? COLORS.orange : theme.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.enforcementTitle, { color: theme.text }]}>Always-On Enforcement</Text>
                <Text style={[styles.enforcementSubtitle, { color: theme.muted }]}>
                  {enforcementOn ? 'Active — blocking 24/7 regardless of sessions' : 'Paused — list kept, nothing enforced'}
                </Text>
              </View>
              <Switch
                value={enforcementOn}
                onValueChange={handleToggleEnforcement}
                trackColor={{ false: theme.border, true: COLORS.orange + '99' }}
                thumbColor={enforcementOn ? COLORS.orange : theme.muted}
              />
            </View>

            <View style={[styles.enforcementDivider, { backgroundColor: theme.border }]} />

            {/* Row 1 — Always-On App List */}
            <TouchableOpacity
              style={[styles.enforcementRow, !enforcementOn && { opacity: 0.45 }]}
              onPress={() => router.push('/always-on')}
              activeOpacity={0.7}
            >
              <Ionicons name="infinite-outline" size={13} color={alwaysOnHasList ? COLORS.orange : theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.enforcementRowLabel, { color: theme.text }]}>App List</Text>
                <Text style={[styles.enforcementRowDesc, { color: theme.muted }]}>
                  {alwaysOnHasList
                    ? `${alwaysOnPkgs.length} app${alwaysOnPkgs.length !== 1 ? 's' : ''} blocked around the clock`
                    : 'No apps — tap to add apps to block permanently'}
                </Text>
              </View>
              {autoCopyOn && (
                <View style={[styles.autoCopyBadge, { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary + '33' }]}>
                  <Ionicons name="copy-outline" size={10} color={COLORS.primary} />
                  <Text style={[styles.autoCopyText, { color: COLORS.primary }]}>auto-copy</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={12} color={theme.border} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={[styles.enforcementDivider, { backgroundColor: theme.border }]} />

            {/* Row 2 — VPN Block List */}
            {(() => {
              const vpnPkgs = settings.alwaysOnVpnPackages ?? [];
              const vpnCount = vpnPkgs.length;
              return (
                <TouchableOpacity
                  style={[styles.enforcementRow, !enforcementOn && { opacity: 0.45 }]}
                  onPress={() => router.push('/vpn-block-list')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shield-checkmark-outline" size={13} color={vpnCount > 0 ? COLORS.primary : theme.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.enforcementRowLabel, { color: theme.text }]}>VPN Block List</Text>
                    <Text style={[styles.enforcementRowDesc, { color: theme.muted }]}>
                      {vpnCount > 0
                        ? `${vpnCount} app${vpnCount !== 1 ? 's' : ''} network-blocked via local VPN`
                        : 'No apps — tap to cut internet access 24/7'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={12} color={theme.border} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              );
            })()}

            <View style={[styles.enforcementDivider, { backgroundColor: theme.border }]} />

            {/* Row 3 — Daily Allowance */}
            <TouchableOpacity
              style={[styles.enforcementRow, !enforcementOn && { opacity: 0.45 }]}
              onPress={() => setDailyAllowanceModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={13} color={allowanceCount > 0 ? COLORS.orange : theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.enforcementRowLabel, { color: theme.text }]}>Daily Allowance</Text>
                <Text style={[styles.enforcementRowDesc, { color: theme.muted }]}>
                  {allowanceCount > 0
                    ? `${allowanceCount} app${allowanceCount !== 1 ? 's' : ''} with a daily time budget`
                    : 'No limits set — tap to cap per-app daily usage'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={theme.border} />
            </TouchableOpacity>

            <View style={[styles.enforcementDivider, { backgroundColor: theme.border }]} />

            {/* Row 3 — Block Schedules */}
            <TouchableOpacity
              style={[styles.enforcementRow, !enforcementOn && { opacity: 0.45 }]}
              onPress={() => router.push('/block-defense?tab=greyout')}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={13} color={scheduleCount > 0 ? COLORS.orange : theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.enforcementRowLabel, { color: theme.text }]}>Block Schedules</Text>
                <Text style={[styles.enforcementRowDesc, { color: theme.muted }]}>
                  {scheduleCount > 0
                    ? `${scheduleCount} active schedule${scheduleCount !== 1 ? 's' : ''} — recurring time windows`
                    : 'No schedules — tap to block apps on a timetable'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={theme.border} />
            </TouchableOpacity>

            <View style={[styles.enforcementDivider, { backgroundColor: theme.border }]} />

            {/* Row 4 — Keyword Blocker */}
            <TouchableOpacity
              style={[styles.enforcementRow, !enforcementOn && { opacity: 0.45 }]}
              onPress={() => router.push('/keyword-blocker')}
              activeOpacity={0.7}
            >
              <Ionicons name="text-outline" size={13} color={keywordCount > 0 ? COLORS.primary : theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.enforcementRowLabel, { color: theme.text }]}>Keyword Blocker</Text>
                <Text style={[styles.enforcementRowDesc, { color: theme.muted }]}>
                  {keywordCount > 0
                    ? `${keywordCount} keyword${keywordCount !== 1 ? 's' : ''} — home screen on match`
                    : 'No keywords — tap to block by on-screen text'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={theme.border} />
            </TouchableOpacity>

          </View>

          {/* Tips card — auto-fades after 7 days, can also be dismissed */}
          <TipsCard
            theme={theme}
            settings={settings}
            updateSettings={updateSettings}
          />

          {/* Quick-Block preset shortcuts */}
          {blockPresets.length > 0 && (
            <View style={styles.quickBlockSection}>
              <Text style={[styles.quickBlockLabel, { color: theme.muted }]}>QUICK BLOCK</Text>
              {blockPresets.map((preset) => (
                <View key={preset.id} style={[styles.quickBlockCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.quickBlockCardTop}>
                    <Ionicons name="ban-outline" size={16} color={COLORS.red} />
                    <Text style={[styles.quickBlockCardName, { color: theme.text }]} numberOfLines={1}>{preset.name}</Text>
                    <Text style={[styles.quickBlockCardCount, { color: theme.muted }]}>{preset.packages.length} app{preset.packages.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.quickBlockDurations}>
                    {[1, 2, 4, 8].map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.quickBlockDurationBtn, { backgroundColor: COLORS.red + '14', borderColor: COLORS.red + '33' }]}
                        onPress={() => { void handleQuickBlock(preset, h); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.quickBlockDurationText, { color: COLORS.red }]}>{h}h</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.blockScheduleBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setBlockModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="ban-outline" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.blockScheduleBtnText, { color: theme.text }]}>
                Block Apps Without a Task
              </Text>
              <Text style={[styles.blockScheduleBtnDesc, { color: theme.textSecondary }]}>
                Start a standalone block or recurring schedule
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.activeLink, { borderColor: theme.border }]}
            onPress={() => router.push('/active')}
            activeOpacity={0.7}
          >
            <Ionicons name="pulse-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.activeLinkText, { color: COLORS.primary }]}>
              See live status on the Active page
            </Text>
            <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
          </TouchableOpacity>
        </ScrollView>

        <StandaloneBlockModal
          visible={blockModalVisible}
          blockedPackages={settings.standaloneBlockPackages ?? []}
          blockUntil={settings.standaloneBlockUntil}
          locked={false}
          dailyAllowanceEntries={settings.dailyAllowanceEntries ?? []}
          vpnPackages={settings.standaloneVpnPackages ?? []}
          blockPresets={blockPresets}
          recurringBlockSchedules={settings.recurringBlockSchedules ?? []}
          onSave={async (packages, untilMs, allowanceEntries, vpnPackages) => {
            await setStandaloneBlockAndAllowance(packages, untilMs, allowanceEntries, vpnPackages);
          }}
          onSavePreset={handleSaveBlockPreset}
          onDeletePreset={handleDeleteBlockPreset}
          onSaveRecurringSchedules={async (schedules) => { await setRecurringBlockSchedules(schedules); }}
          onClose={() => setBlockModalVisible(false)}
        />

        {/* Inline Daily Allowance modal — opened from the slim hint pill. */}
        <DailyAllowanceModal
          visible={dailyAllowanceModalVisible}
          selectedEntries={settings.dailyAllowanceEntries ?? []}
          locked={false}
          requireDefensePin={true}
          onSave={async (entries) => {
            await setStandaloneBlockAndAllowance(
              settings.standaloneBlockPackages ?? [],
              settings.standaloneBlockUntil ? new Date(settings.standaloneBlockUntil).getTime() : null,
              entries,
            );
          }}
          onClose={() => setDailyAllowanceModalVisible(false)}
        />

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
      </SafeAreaView>
    );
  }

  const innerSize = Math.round(ringSize * 0.846);
  const coreSize = Math.round(ringSize * 0.731);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: task.color + '18' }]}>
      {/* Accessibility permission warning banner — pinned above scroll.
          Suppressed during active focus to avoid false "permission revoked" flashes
          on Samsung One UI and other OEMs that delay AccessibilityManager updates. */}
      {hasAccessibilityPermission === false && !isFocusing && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={async () => {
            try {
              if (Platform.OS === 'android') {
                await UsageStatsModule.openAccessibilitySettings();
              } else {
                await Linking.openSettings();
              }
            } catch {
              await Linking.openSettings().catch(() => {});
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={18} color={COLORS.orange} />
          <View style={styles.permissionBannerText}>
            <Text style={styles.permissionBannerTitle}>Accessibility permission needed</Text>
            <Text style={styles.permissionBannerDesc}>
              Focus Mode can't block apps without Accessibility access. Tap to open Settings.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.orange} />
        </TouchableOpacity>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 + insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Focus status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isFocusing ? COLORS.green : COLORS.muted }]} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            {isFocusing
              ? (settings.pomodoroEnabled ?? false)
                ? `Focus Mode Active · ${pomodoro.phase === 'work' ? '🎯 Work' : '☕ Break'} Phase`
                : 'Focus Mode Active'
              : 'Task In Progress'}
          </Text>
        </View>

      {/* Central ring + timer */}
      <View style={styles.centerContent}>
        {/* Sonar ripple rings */}
        {([
          [ripple1Scale, ripple1Opacity],
          [ripple2Scale, ripple2Opacity],
          [ripple3Scale, ripple3Opacity],
        ] as [Animated.Value, Animated.Value][]).map(([scale, opacity], idx) => (
          <Animated.View
            key={idx}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: 1.5,
              borderColor: task.color,
              transform: [{ scale }],
              opacity,
            }}
          />
        ))}

        {/* Outer ring — slow rotation + breathe */}
        <Animated.View
          style={[
            styles.ringOuter,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: task.color + (isFocusing ? '55' : '28'),
              borderStyle: isFocusing ? 'dashed' : 'solid',
              transform: [{ scale: pulseAnim }, { rotate: rotateInterp }],
            },
          ]}
        >
          {/* Inner ring — opacity glow pulse */}
          <Animated.View
            style={[
              styles.ringInner,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
                borderColor: task.color + 'cc',
                opacity: innerGlow,
              },
            ]}
          >
            <View
              style={[
                styles.ringCore,
                {
                  width: coreSize,
                  height: coreSize,
                  borderRadius: coreSize / 2,
                  backgroundColor: task.color,
                  shadowColor: task.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isFocusing ? 0.65 : 0.25,
                  shadowRadius: isFocusing ? 22 : 8,
                  elevation: isFocusing ? 16 : 5,
                },
              ]}
            >
              <TimerDisplay startTime={task.startTime} endTime={task.endTime} color={task.color} ringSize={ringSize} />
            </View>
          </Animated.View>
        </Animated.View>

        {/* Task title */}
        <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={2}>{task.title}</Text>
        <Text style={[styles.taskTime, { color: theme.textSecondary }]}>
          {formatTime(task.startTime)} – {formatTime(task.endTime)}
        </Text>

        {/* Pomodoro strip — shown only when focus mode is active and Pomodoro is enabled */}
        {isFocusing && (settings.pomodoroEnabled ?? false) && (
          <PomodoroStrip
            pomodoro={pomodoro}
            workMinutes={settings.pomodoroDuration ?? 25}
            breakMinutes={settings.pomodoroBreak ?? 5}
          />
        )}

        {/* "+N more active" chip when overlapping tasks exist */}
        {otherActiveCount > 0 && (
          <TouchableOpacity
            style={[styles.moreActiveChip, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
          >
            <Ionicons name="layers-outline" size={12} color={COLORS.primary} />
            <Text style={[styles.moreActiveChipText, { color: COLORS.primary }]}>
              +{otherActiveCount} more active
            </Text>
          </TouchableOpacity>
        )}

        {/* "Time's up" decision prompt — shown when the task ended but the user
            has not yet marked it complete, extended, or skipped. Replaces the
            silent disappearance behaviour from before. */}
        {awaitingDecision && (
          <View style={[styles.endedPrompt, { backgroundColor: COLORS.orange + '15', borderColor: COLORS.orange + '55' }]}>
            <View style={styles.endedPromptHeader}>
              <Ionicons name="alarm" size={18} color={COLORS.orange} />
              <Text style={[styles.endedPromptTitle, { color: COLORS.orange }]}>Time's up — what next?</Text>
            </View>
            <Text style={[styles.endedPromptDesc, { color: theme.textSecondary }]}>
              This task ran past its scheduled end. Pick one to clear it.
            </Text>
            <View style={styles.endedPromptRow}>
              <TouchableOpacity
                style={[styles.endedPromptBtn, { backgroundColor: COLORS.green }]}
                onPress={() => completeTask(task.id)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.endedPromptBtnText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.endedPromptBtn, { backgroundColor: COLORS.orange }]}
                onPress={() => setShowExtendModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.endedPromptBtnText}>Extend</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.endedPromptBtn, { backgroundColor: COLORS.muted }]}
                onPress={() => {
                  Alert.alert('Skip Task', 'Skip this task?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Skip', style: 'destructive', onPress: () => skipTask(task.id) },
                  ]);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={styles.endedPromptBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {task.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: task.color + '22' }]}>
                <Text style={[styles.tagText, { color: task.color }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {!isFocusing ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: task.color }]}
            onPress={async () => {
              if (Platform.OS === 'android') {
                const hasA11y = await UsageStatsModule.hasAccessibilityPermission().catch(() => false);
                const hasUsage = await UsageStatsModule.hasPermission().catch(() => false);
                if (!hasA11y || !hasUsage) {
                  Alert.alert(
                    'Permissions Required',
                    'Focus Mode needs Accessibility and Usage Access to block apps.\n\nGo to Settings → Permissions to grant them.',
                    [
                      { text: 'Not Now', style: 'cancel' },
                      {
                        text: 'Open Permissions',
                        onPress: async () => {
                          if (!hasA11y) await UsageStatsModule.openAccessibilitySettings().catch(() => {});
                          else await UsageStatsModule.openUsageAccessSettings().catch(() => {});
                        },
                      },
                    ]
                  );
                  return;
                }
              }
              void handleActivateFocus(task.id);
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Activate Focus</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.muted }]}
            onPress={async () => {
              const pinSet = await SessionPinModule.isPinSet().catch(() => false);
              if (pinSet) {
                setFocusStopPinVisible(true);
              } else {
                Alert.alert('Stop Focus', 'End focus mode for this task?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Stop', style: 'destructive', onPress: () => stopFocusMode() },
                ]);
              }
            }}
          >
            <Ionicons name="stop-circle-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Stop Focus</Text>
          </TouchableOpacity>
        )}

        <View style={styles.secondaryActions}>
          <SecondaryBtn
            icon="checkmark-circle-outline"
            label="Done"
            color={COLORS.green}
            onPress={() => {
              Alert.alert('Complete Task', 'Mark this task as done?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Done', onPress: () => completeTask(task.id) },
              ]);
            }}
          />
          <SecondaryBtn
            icon="alarm-outline"
            label="Extend"
            color={COLORS.orange}
            onPress={() => setShowExtendModal(true)}
          />
        </View>

        {/* Emergency override — logs the break and stops focus */}
        {isFocusing && (
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => {
              Alert.alert(
                '🚨 Emergency Override',
                'This will stop focus mode and be logged. Only use in a genuine emergency.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Override',
                    style: 'destructive',
                    onPress: async () => {
                      await dbLogFocusOverride(task.id, 'manual-override', 'User triggered emergency override');
                      await stopFocusMode();
                    },
                  },
                ],
              );
            }}
          >
            <Ionicons name="warning-outline" size={16} color={COLORS.red} />
            <Text style={styles.emergencyBtnText}>Emergency Override</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Allowed apps list */}
      {isFocusing && (
        <View style={styles.allowedRow}>
          <Text style={[styles.allowedLabel, { color: theme.textSecondary }]}>Allowed: </Text>
          <Text style={[styles.allowedApps, { color: theme.muted }]}>
            {state.settings.allowedInFocus.join(', ')}
          </Text>
        </View>
      )}

        <View style={{ height: 60 + insets.bottom + 20 }} />
      </ScrollView>

      {/* Standalone block status chip (shown while task is active too) */}
      {standaloneActive && settings.standaloneBlockUntil && (
        <TouchableOpacity
          style={styles.standaloneChip}
          onPress={() => setBlockModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="ban" size={13} color={COLORS.red} />
          <Text style={styles.standaloneChipText}>
            +{(settings.standaloneBlockPackages ?? []).length} extra apps blocked
          </Text>
          <Ionicons name="add-outline" size={13} color={COLORS.red} />
        </TouchableOpacity>
      )}

      <StandaloneBlockModal
        visible={blockModalVisible}
        blockedPackages={settings.standaloneBlockPackages ?? []}
        blockUntil={settings.standaloneBlockUntil}
        locked={standaloneActive}
        dailyAllowanceEntries={settings.dailyAllowanceEntries ?? []}
        vpnPackages={settings.standaloneVpnPackages ?? []}
        blockPresets={blockPresets}
        recurringBlockSchedules={settings.recurringBlockSchedules ?? []}
        onSave={async (packages, untilMs, allowanceEntries, vpnPackages) => {
          await setStandaloneBlockAndAllowance(packages, untilMs, allowanceEntries, vpnPackages);
        }}
        onSavePreset={handleSaveBlockPreset}
        onDeletePreset={handleDeleteBlockPreset}
        onSaveRecurringSchedules={async (schedules) => { await setRecurringBlockSchedules(schedules); }}
        onClose={() => setBlockModalVisible(false)}
      />

      {task && (
        <ExtendModal
          visible={showExtendModal}
          taskId={task.id}
          onClose={() => setShowExtendModal(false)}
          onExtend={async (id, mins) => {
            await extendTaskTime(id, mins);
            setShowExtendModal(false);
          }}
        />
      )}

      <PinRotationModal
        visible={pinRotationVisible}
        pinType="focus"
        reuseTrackerKey="focus"
        actionLabel="Start Focus Session"
        actionDescription="Set the password required to end this focus session. You can keep your existing password or create a new one."
        onComplete={() => {
          setPinRotationVisible(false);
          if (pendingStartTaskId) {
            startFocusMode(pendingStartTaskId);
            setPendingStartTaskId(null);
          }
        }}
        onCancel={() => {
          setPinRotationVisible(false);
          setPendingStartTaskId(null);
        }}
      />

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
        visible={focusStopPinVisible}
        pinType="focus"
        title="Stop Focus Session"
        description="Enter your focus session password to end the session and stop all blocking."
        onVerified={() => {
          setFocusStopPinVisible(false);
          stopFocusMode();
        }}
        onCancel={() => setFocusStopPinVisible(false)}
      />
    </SafeAreaView>
  );
}

function StandaloneCountdown({
  untilIso,
  blockedCount,
}: {
  untilIso: string;
  blockedCount: number;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, new Date(untilIso).getTime() - Date.now());
      setRemaining(ms);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [untilIso]);

  const totalHours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  const timeStr = totalHours > 0
    ? `${totalHours}h ${mins}m`
    : `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <View style={[countdownStyles.container, { backgroundColor: COLORS.red + '12', borderColor: COLORS.red + '30' }]}>
      <Text style={[countdownStyles.label, { color: COLORS.red }]}>BLOCK EXPIRES IN</Text>
      <Text style={[countdownStyles.time, { color: COLORS.red }]}>{timeStr}</Text>
      <Text style={[countdownStyles.apps, { color: COLORS.red }]}>
        {blockedCount} app{blockedCount !== 1 ? 's' : ''} blocked · cannot stop early
      </Text>
    </View>
  );
}

const countdownStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    gap: SPACING.xs,
    width: '100%',
  },
  label: {
    fontSize: FONT.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  time: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  apps: {
    fontSize: FONT.xs,
    fontWeight: '600',
    opacity: 0.8,
  },
});

function TimerDisplay({
  startTime,
  endTime,
  color,
  ringSize,
}: {
  startTime: string;
  endTime: string;
  color: string;
  ringSize: number;
}) {
  const timer = useTaskTimer(startTime, endTime);
  const mins = Math.floor(timer.remaining / 60);
  const secs = timer.remaining % 60;
  const timeFontSize = Math.round(ringSize * 0.138);

  return (
    <View style={timerStyles.container}>
      <Text style={[timerStyles.time, { fontSize: timeFontSize }]}>
        {timer.isOverdue ? `+${Math.floor(-timer.remaining / 60)}m` : `${mins}:${secs.toString().padStart(2, '0')}`}
      </Text>
      <Text style={timerStyles.label}>{timer.isOverdue ? 'overdue' : 'remaining'}</Text>
      <Text style={timerStyles.progress}>{Math.round(timer.progress * 100)}%</Text>
    </View>
  );
}

function PomodoroStrip({
  pomodoro,
  workMinutes,
  breakMinutes,
}: {
  pomodoro: import('@/hooks/usePomodoro').PomodoroState;
  workMinutes: number;
  breakMinutes: number;
}) {
  const isWork = pomodoro.phase === 'work';
  const accentColor = isWork ? COLORS.primary : COLORS.green;
  const mins = Math.floor(pomodoro.secondsLeft / 60);
  const secs = pomodoro.secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const progressPct = Math.min(100, Math.round(pomodoro.phaseProgress * 100));

  return (
    <View style={[pomStyles.card, { backgroundColor: accentColor + '12', borderColor: accentColor + '40' }]}>
      <View style={pomStyles.topRow}>
        <View style={[pomStyles.phaseBadge, { backgroundColor: accentColor + '22' }]}>
          <Text style={[pomStyles.phaseLabel, { color: accentColor }]}>
            {isWork ? '🎯 WORK' : '☕ BREAK'}
          </Text>
        </View>
        <Text style={[pomStyles.countdown, { color: accentColor }]}>{timeStr}</Text>
        <View style={[pomStyles.cycleBadge, { borderColor: accentColor + '40' }]}>
          <Text style={[pomStyles.cycleText, { color: accentColor }]}>
            Cycle {pomodoro.cycleCount + 1}
          </Text>
        </View>
      </View>
      <View style={[pomStyles.progressTrack, { backgroundColor: accentColor + '20' }]}>
        <View
          style={[
            pomStyles.progressFill,
            {
              backgroundColor: accentColor,
              width: `${progressPct}%` as any,
            },
          ]}
        />
      </View>
      <Text style={[pomStyles.hint, { color: accentColor + 'bb' }]}>
        {isWork
          ? `${mins}m left → ${breakMinutes}m break`
          : `${mins}m rest left → back to ${workMinutes}m work`}
      </Text>
    </View>
  );
}

function SecondaryBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.secondaryBtn, { borderColor: color + '44' }]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.secondaryBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const TIPS = [
  'Use the side menu (›) to reach Active, Stats, Block Schedules and more.',
  'Standalone Block keeps apps blocked 24/7 even after the timer ends — clear the list to stop.',
  'Set a Block Schedule to silence distractions during recurring time windows automatically.',
  'Daily Allowance lets you cap a single app at N opens or N minutes per day.',
  'Long-press the focus tab to extend a running session if you need more time.',
];

function TipsCard({
  theme,
  settings,
  updateSettings,
}: {
  theme: ReturnType<typeof useTheme>['theme'];
  settings: import('@/data/types').AppSettings;
  updateSettings: (s: import('@/data/types').AppSettings) => Promise<void>;
}) {
  const dismissed = settings.tipsCardDismissed === true;
  const firstShown = settings.tipsCardFirstShownAt;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fadedOut = !!firstShown && new Date(firstShown).getTime() < sevenDaysAgo;

  React.useEffect(() => {
    if (!firstShown && !dismissed) {
      void updateSettings({ ...settings, tipsCardFirstShownAt: new Date().toISOString() });
    }
    // Only run once on mount when no first-shown timestamp exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (dismissed || fadedOut) return null;

  // Rotate tips by day-of-year so it changes once per day.
  const dayIdx = Math.floor(Date.now() / 86400000) % TIPS.length;
  const tip = TIPS[dayIdx];

  const handleDismiss = () => {
    void updateSettings({ ...settings, tipsCardDismissed: true });
  };

  return (
    <View style={[styles.tipsCard, { backgroundColor: COLORS.primary + '0E', borderColor: COLORS.primary + '33' }]}>
      <View style={styles.tipsHeader}>
        <Ionicons name="bulb-outline" size={14} color={COLORS.primary} />
        <Text style={[styles.tipsTitle, { color: COLORS.primary }]}>TIP</Text>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.tipsDismissText, { color: theme.muted }]}>Dismiss</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.tipsBody, { color: theme.text }]}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  quickBlockSection: { width: '100%', gap: SPACING.sm },
  quickBlockLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 0.6, marginBottom: SPACING.xs },
  quickBlockCard: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
    width: '100%',
  },
  quickBlockCardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  quickBlockCardName: { fontSize: FONT.sm, fontWeight: '700', flex: 1 },
  quickBlockCardCount: { fontSize: FONT.xs },
  quickBlockDurations: { flexDirection: 'row', gap: SPACING.sm },
  quickBlockDurationBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  quickBlockDurationText: { fontSize: FONT.sm, fontWeight: '700' },
  addTimeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  addTimeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  addTimeBtnText: { fontSize: FONT.md, fontWeight: '700' },
  emptyTitle: { fontSize: FONT.xl, fontWeight: '700', color: COLORS.muted },
  emptySubtitle: { fontSize: FONT.md, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  blockScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
    width: '100%',
  },
  blockScheduleBtnActive: {
    borderColor: COLORS.red + '44',
    backgroundColor: COLORS.red + '08',
  },
  standaloneIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreAppsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    width: '100%',
  },
  addMoreAppsBtnText: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  createTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    width: '100%',
  },
  enforcementPanel: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    width: '100%',
  },
  enforcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  enforcementTitle: { fontSize: 11, fontWeight: '800' },
  enforcementSubtitle: { fontSize: 10, marginTop: 1, lineHeight: 13 },
  enforcementDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: SPACING.md },
  enforcementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  enforcementRowLabel: { fontSize: 11, fontWeight: '700' },
  enforcementRowDesc: { fontSize: 10, marginTop: 1, lineHeight: 13 },
  alwaysOnCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  alwaysOnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  alwaysOnTitle: { fontSize: FONT.sm, fontWeight: '700' },
  alwaysOnDesc: { fontSize: FONT.xs, lineHeight: 17 },
  slimHintsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    width: '100%',
  },
  slimHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  slimHintText: { fontSize: FONT.xs, flexShrink: 1 },
  autoCopyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  autoCopyText: { fontSize: 10, fontWeight: '600' },
  alwaysOnActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  alwaysOnBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  alwaysOnBtnText: { fontSize: FONT.xs, fontWeight: '700' },
  tipsCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  tipsTitle: { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 0.6, flex: 1 },
  tipsBody: { fontSize: FONT.sm, lineHeight: 20 },
  tipsDismissText: { fontSize: 11, fontWeight: '600' },
  activeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
  },
  activeLinkText: { fontSize: FONT.xs, fontWeight: '600' },
  createTaskBtnText: {
    fontSize: FONT.md,
    fontWeight: '700',
    color: '#fff',
  },
  standaloneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    backgroundColor: COLORS.red + '12',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.red + '30',
  },
  standaloneChipText: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.red,
  },
  blockScheduleBtnText: {
    fontSize: FONT.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  blockScheduleBtnDesc: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },
  scrollContent: { flexGrow: 1 },
  centerContent: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md, paddingVertical: SPACING.xl },
  rippleRing: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    borderWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center', paddingHorizontal: SPACING.xl },
  taskTime: { fontSize: FONT.md, color: COLORS.muted },
  tagsRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', justifyContent: 'center' },
  tag: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  tagText: { fontSize: FONT.xs, fontWeight: '600' },
  actions: { padding: SPACING.lg, gap: SPACING.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  primaryBtnText: { color: '#fff', fontSize: FONT.md, fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', gap: SPACING.sm },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: FONT.sm, fontWeight: '600' },
  allowedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  allowedLabel: { fontSize: FONT.xs, color: COLORS.muted, fontWeight: '600' },
  allowedApps: { fontSize: FONT.xs, color: COLORS.muted },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.red + '44',
    backgroundColor: COLORS.red + '08',
  },
  emergencyBtnText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.red },
  moreActiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  moreActiveChipText: { fontSize: FONT.xs, fontWeight: '700' },
  endedPrompt: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    gap: SPACING.sm,
    width: '90%',
  },
  endedPromptHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  endedPromptTitle: { fontSize: FONT.md, fontWeight: '800' },
  endedPromptDesc: { fontSize: FONT.xs, lineHeight: 16 },
  endedPromptRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs },
  endedPromptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  endedPromptBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.orange + '18',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.orange + '44',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  permissionBannerText: {
    flex: 1,
    gap: 2,
  },
  permissionBannerTitle: {
    fontSize: FONT.sm,
    fontWeight: '700',
    color: COLORS.orange,
  },
  permissionBannerDesc: {
    fontSize: FONT.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});

const pomStyles = StyleSheet.create({
  card: {
    width: '90%',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.md,
    gap: SPACING.xs,
    marginTop: SPACING.md,
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  phaseBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  phaseLabel: {
    fontSize: FONT.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  countdown: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    flex: 1,
    textAlign: 'center',
  },
  cycleBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  cycleText: {
    fontSize: FONT.xs,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  hint: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});

const timerStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  time: { fontWeight: '800', color: '#fff' },
  label: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  progress: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginTop: 2 },
});

export default withScreenErrorBoundary(FocusScreen, 'Focus');
