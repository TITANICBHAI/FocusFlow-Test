import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import type { DailyAllowanceEntry, GreyoutWindow } from '@/data/types';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import Constants from 'expo-constants';
import { dbDeleteAllTasks } from '@/data/database';
import {
  cancelAllReminders,
  requestPermissions,
  scheduleTaskRemindersBatch,
} from '@/services/notificationService';
import { exportBackup, pickAndImportBackup } from '@/services/backupService';
import { formatDuration } from '@/services/taskService';
import { AllowedAppsModal } from '@/components/AllowedAppsModal';
import { StandaloneBlockModal } from '@/components/StandaloneBlockModal';
import { DailyAllowanceModal } from '@/components/DailyAllowanceModal';
import { BlockedWordsModal } from '@/components/BlockedWordsModal';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { PinSetupModal } from '@/components/PinSetupModal';
import { GreyoutScheduleModal } from '@/components/GreyoutScheduleModal';
import { OverlayAppearanceModal } from '@/components/OverlayAppearanceModal';
import DiagnosticsModal from '@/components/DiagnosticsModal';
import ReportIssueModal from '@/components/ReportIssueModal';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { state, updateSettings, setStandaloneBlockAndAllowance, setDailyAllowanceEntries, setBlockedWords, refreshTasks, deleteTask, addTask } = useApp();
  const { settings } = state;
  const { theme } = useTheme();
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [dailyModalVisible, setDailyModalVisible] = useState(false);
  const [wordsModalVisible, setWordsModalVisible] = useState(false);
  const [greyoutModalVisible, setGreyoutModalVisible] = useState(false);
  const [overlayAppearanceVisible, setOverlayAppearanceVisible] = useState(false);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [reportIssueVisible, setReportIssueVisible] = useState(false);
  const [defPinVisible, setDefPinVisible] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const pendingDefAction = useRef<(() => void) | null>(null);
  // Logs are useful in release builds too: WARN/ERROR entries are retained
  // locally and the user can explicitly choose whether to report them.
  const showDiagnostics = true;

  if (!state.isDbReady) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const update = async (partial: Partial<typeof settings>) => {
    await updateSettings({ ...settings, ...partial });
  };

  // ── Standalone block status ───────────────────────────────────────────────

  const standaloneActive = (() => {
    if (!settings.standaloneBlockUntil) return false;
    if ((settings.standaloneBlockPackages ?? []).length === 0) return false;
    return new Date(settings.standaloneBlockUntil).getTime() > Date.now();
  })();

  const blockUntilLabel = standaloneActive && settings.standaloneBlockUntil
    ? dayjs(settings.standaloneBlockUntil).format('MMM D [at] h:mm A')
    : null;

  const focusActive = state.focusSession?.isActive === true;
  const blockProtectionActive = focusActive || standaloneActive;

  const handleSaveStandaloneBlock = async (packages: string[], untilMs: number | null, allowanceEntries: DailyAllowanceEntry[], vpnPackages?: string[]) => {
    await setStandaloneBlockAndAllowance(packages, untilMs, allowanceEntries, vpnPackages);
  };

  const handleSaveBlockPreset = async (preset: import('@/data/types').BlockPreset) => {
    const presets = [...(settings.blockPresets ?? []), preset];
    await update({ blockPresets: presets });
  };

  const handleDeleteBlockPreset = async (id: string) => {
    const presets = (settings.blockPresets ?? []).filter((p) => p.id !== id);
    await update({ blockPresets: presets });
  };

  // ── Other handlers ────────────────────────────────────────────────────────

  const handleRequestNotifications = async () => {
    const granted = await requestPermissions();
    Alert.alert(
      granted ? 'Notifications Enabled' : 'Permission Denied',
      granted
        ? 'You will now receive task reminders.'
        : 'Please enable notifications in your device Settings.',
    );
  };

  // ── Backup & restore ──────────────────────────────────────────────────────

  const [backupBusy, setBackupBusy] = useState(false);

  const handleExportBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const appVersion = Constants.expoConfig?.version ?? '0.0.0';
      const result = await exportBackup(settings, appVersion);
      if (!result.ok) {
        Alert.alert('Export failed', result.error ?? 'Could not create backup file.');
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportBackup = () => {
    Alert.alert(
      'Restore from backup',
      'Pick how to merge the backup into this device:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add tasks',
          onPress: async () => runImport(false),
        },
        {
          text: 'Replace everything',
          style: 'destructive',
          onPress: async () => runImport(true),
        },
      ],
    );
  };

  const runImport = async (replaceTasks: boolean) => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await pickAndImportBackup({
        updateSettings,
        addTask,
        scheduleTasks: scheduleTaskRemindersBatch,
        deleteTask,
        refreshTasks,
        replaceTasks,
        currentTasks: state.tasks,
        currentSettings: settings,
      });
      if ('error' in result) {
        Alert.alert('Import failed', result.error);
        return;
      }
      const lines = [
        `Settings: ${result.settings ? 'restored' : 'not changed'}`,
        `Tasks imported: ${result.tasksImported}`,
        result.tasksSkipped > 0 ? `Skipped (already exist): ${result.tasksSkipped}` : null,
        ...result.warnings.slice(0, 3),
      ].filter(Boolean) as string[];
      Alert.alert('Backup restored', lines.join('\n'));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleClearAllTasks = () => {
    Alert.alert('Clear All Tasks', 'This will delete ALL tasks. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await cancelAllReminders();
          await dbDeleteAllTasks();
          await refreshTasks();
          Alert.alert('Done', 'All tasks cleared.');
        },
      },
    ]);
  };

  const handleSaveAllowedApps = async (packages: string[]) => {
    await update({ allowedInFocus: packages });
    if (state.focusSession?.isActive) {
      await SharedPrefsModule.setAllowedPackages(packages);
    }
  };

  const withDefensePin = (action: () => void) => {
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => {
        if (hash) {
          // PIN is set — always require it regardless of the toggle state.
          pendingDefAction.current = action;
          setDefPinVisible(true);
        } else if (settings.pinProtectionEnabled) {
          // Toggle is ON but no PIN is set yet — check if user said "don't ask again".
          SharedPrefsModule.getString('pin_setup_prompt_dismissed')
            .then((dismissed) => {
              if (dismissed === 'true') {
                // User dismissed the prompt — proceed freely until toggle is cycled.
                action();
              } else {
                Alert.alert(
                  'No Defense Password Set',
                  "PIN Protection is on but you haven't set a defense password yet. Set one now so your changes are protected.",
                  [
                    {
                      text: 'Set Password Now',
                      onPress: () => {
                        pendingDefAction.current = action;
                        setPinSetupVisible(true);
                      },
                    },
                    {
                      text: 'Not Now',
                      style: 'cancel',
                      onPress: () => action(),
                    },
                    {
                      text: "Don't Ask Again",
                      style: 'destructive',
                      onPress: () => {
                        void SharedPrefsModule.putString('pin_setup_prompt_dismissed', 'true');
                        action();
                      },
                    },
                  ],
                );
              }
            })
            .catch(() => action());
        } else {
          // No PIN and toggle is OFF — proceed freely.
          action();
        }
      })
      .catch(() => action());
  };

  const handleSystemGuardToggle = (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'System controls protection cannot be turned off while Focus Mode or an app block is active.');
      return;
    }
    if (!enabled) {
      withDefensePin(() => void update({ systemGuardEnabled: false }));
      return;
    }
    void update({ systemGuardEnabled: true });
  };

  const handleBlockYoutubeShortsToggle = (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'YouTube Shorts protection cannot be turned off while Focus Mode or an app block is active.');
      return;
    }
    if (!enabled) {
      withDefensePin(() => void update({ blockYoutubeShortsEnabled: false }));
      return;
    }
    void update({ blockYoutubeShortsEnabled: true });
  };

  const handleBlockInstagramReelsToggle = (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'Instagram Reels protection cannot be turned off while Focus Mode or an app block is active.');
      return;
    }
    if (!enabled) {
      withDefensePin(() => void update({ blockInstagramReelsEnabled: false }));
      return;
    }
    void update({ blockInstagramReelsEnabled: true });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 20 }]}>

        {/* ── Profile ── */}
        <Section title="Profile">
          <SettingButton
            icon="person-circle-outline"
            label={settings.userProfile?.name ? `${settings.userProfile.name}` : 'Set up your profile'}
            description={
              settings.userProfile
                ? [
                    settings.userProfile.occupation,
                    settings.userProfile.dailyGoalHours ? `${settings.userProfile.dailyGoalHours}h daily goal` : null,
                    settings.userProfile.wakeUpTime ? `Wakes at ${settings.userProfile.wakeUpTime}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Tap to personalise your experience'
                : 'Name, occupation, daily goal and more'
            }
            onPress={() => router.push('/user-profile')}
          />
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <SettingRow label="Enable Reminders" description="Get alerts before & during tasks">
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => update({ notificationsEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.notificationsEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingButton
            icon="notifications-outline"
            label="Request Notification Permission"
            onPress={handleRequestNotifications}
          />
        </Section>

        {/* ── Scheduling ── */}
        <Section title="Scheduling">
          <SettingRow label="Default Task Duration">
            <Text style={styles.valueText}>{formatDuration(settings.defaultDuration)}</Text>
          </SettingRow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.xs }}>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, d === settings.defaultDuration && styles.chipActive]}
                  onPress={() => update({ defaultDuration: d })}
                >
                  <Text style={[styles.chipText, { color: theme.text }, d === settings.defaultDuration && styles.chipTextActive]}>
                    {formatDuration(d)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* ── Focus Mode ── */}
        <Section title="Focus Mode">
          <SettingRow label="Auto-enable Focus Mode" description="Activate when a focus task starts">
            <Switch
              value={settings.focusModeEnabled}
              onValueChange={(v) => update({ focusModeEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.focusModeEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingButton
            icon="apps-outline"
            label="Manage Allowed Apps"
            description={settings.allowedInFocus.length === 0 ? 'All apps will be blocked during Focus Mode' : `${settings.allowedInFocus.length} app${settings.allowedInFocus.length !== 1 ? 's' : ''} allowed during Focus Mode`}
            onPress={() => setAppsModalVisible(true)}
          />
        </Section>

        {/* ── Aversion Deterrents ── */}
        <Section title="Aversion Deterrents">
          <SettingRow label="Screen Dimmer" description="Near-black overlay appears while a blocked app is open">
            <Switch
              value={settings.aversionDimmerEnabled}
              onValueChange={(v) => update({ aversionDimmerEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.aversionDimmerEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingRow label="Vibration Harassment" description="Repeated pulse vibration while blocked app is in foreground">
            <Switch
              value={settings.aversionVibrateEnabled}
              onValueChange={(v) => update({ aversionVibrateEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.aversionVibrateEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingRow label="Sound Alert" description="Startling sound plays the moment a blocked app launches">
            <Switch
              value={settings.aversionSoundEnabled}
              onValueChange={(v) => update({ aversionSoundEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.aversionSoundEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
        </Section>

        {/* ── Daily App Allowance ── */}
        <Section title="Daily App Allowance">
          <SettingButton
            icon="sunny-outline"
            label="Manage Daily Allowance Apps"
            description={
              (settings.dailyAllowanceEntries ?? []).length === 0
                ? 'No apps configured — set count, time budget, or interval per app'
                : `${(settings.dailyAllowanceEntries ?? []).length} app${(settings.dailyAllowanceEntries ?? []).length !== 1 ? 's' : ''} with daily allowance — tap to configure modes`
            }
            onPress={() => setDailyModalVisible(true)}
          />
        </Section>

        {/* ── Word Blocking ── */}
        <Section title="Word Blocking">
          <SettingButton
            icon="text-outline"
            label="Manage Blocked Keywords"
            description={
              (settings.blockedWords ?? []).length === 0
                ? 'No keywords set — blocked in URLs, searches & on-screen text'
                : `${(settings.blockedWords ?? []).length} keyword${(settings.blockedWords ?? []).length !== 1 ? 's' : ''} — blocked in URLs, searches & on-screen text`
            }
            onPress={() => setWordsModalVisible(true)}
          />
        </Section>

        <Section title="PIN Protection">
          <SettingRow
            label="Require password to disable protections"
            description={
              (settings.pinProtectionEnabled ?? false)
                ? 'On — turning off any protection toggle requires your Defense Password'
                : 'Off — protection toggles can be changed freely without a password'
            }
          >
            <Switch
              value={settings.pinProtectionEnabled ?? false}
              onValueChange={(v) => {
                void update({ pinProtectionEnabled: v });
                if (!v) {
                  // Reset "don't ask again" so the prompt shows fresh next time the toggle is enabled.
                  void SharedPrefsModule.putString('pin_setup_prompt_dismissed', '');
                }
              }}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={(settings.pinProtectionEnabled ?? false) ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingButton
            icon="shield-half-outline"
            label="Manage PIN Passwords"
            description="Set or change your focus session and defense passwords"
            onPress={() => router.push('/block-defense')}
          />
        </Section>

        <Section title="System Protection">
          <SettingRow
            label="Protect system controls"
            description={
              blockProtectionActive
                ? 'Locked on until Focus Mode or the active app block ends'
                : 'Blocks power menu, notification shade, Emergency mode, and sensitive Settings pages during active blocks'
            }
          >
            <Switch
              value={settings.systemGuardEnabled ?? false}
              onValueChange={handleSystemGuardToggle}
              disabled={blockProtectionActive && (settings.systemGuardEnabled ?? false)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={(settings.systemGuardEnabled ?? false) ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>

          <SettingRow
            label="Block YouTube Shorts"
            description={
              blockProtectionActive && (settings.blockYoutubeShortsEnabled ?? false)
                ? 'Locked on until Focus Mode or the active app block ends'
                : 'Redirects to home whenever the YouTube Shorts player opens (regular YouTube stays usable)'
            }
          >
            <Switch
              value={settings.blockYoutubeShortsEnabled ?? false}
              onValueChange={handleBlockYoutubeShortsToggle}
              disabled={blockProtectionActive && (settings.blockYoutubeShortsEnabled ?? false)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={(settings.blockYoutubeShortsEnabled ?? false) ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>

          <SettingRow
            label="Block Instagram Reels"
            description={
              blockProtectionActive && (settings.blockInstagramReelsEnabled ?? false)
                ? 'Locked on until Focus Mode or the active app block ends'
                : 'Redirects to home whenever the Instagram Reels viewer opens (the rest of Instagram stays usable)'
            }
          >
            <Switch
              value={settings.blockInstagramReelsEnabled ?? false}
              onValueChange={handleBlockInstagramReelsToggle}
              disabled={blockProtectionActive && (settings.blockInstagramReelsEnabled ?? false)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={(settings.blockInstagramReelsEnabled ?? false) ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
        </Section>

        {/* ── Block Schedules ── */}
        <Section title="Block Schedules">
          <SettingButton
            icon="time-outline"
            label="Manage Time-Window Blocks"
            description={
              (settings.greyoutSchedule ?? []).length === 0
                ? 'No windows set — block apps during specific hours and days'
                : `${(settings.greyoutSchedule ?? []).length} window${(settings.greyoutSchedule ?? []).length !== 1 ? 's' : ''} active — tap to manage`
            }
            onPress={() => setGreyoutModalVisible(true)}
          />
        </Section>

        {/* ── Standalone Block ── */}
        <Section title="Standalone Block">
          {standaloneActive ? (
            <View style={styles.blockActiveCard}>
              <View style={styles.blockActiveRow}>
                <View style={styles.blockDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockActiveTitle}>Block active</Text>
                  <Text style={styles.blockActiveDesc}>
                    {(settings.standaloneBlockPackages ?? []).length} app{(settings.standaloneBlockPackages ?? []).length !== 1 ? 's' : ''} blocked until {blockUntilLabel}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.blockInactiveCard}>
              <Ionicons name="shield-outline" size={18} color={theme.muted} />
              <Text style={[styles.blockInactiveText, { color: theme.muted }]}>No scheduled block active</Text>
            </View>
          )}
          <SettingButton
            icon={standaloneActive ? 'lock-closed-outline' : 'ban-outline'}
            label={standaloneActive ? 'Add More Apps to Block' : 'Set Standalone Block'}
            description={standaloneActive ? 'Block is locked — you can add apps but not remove any until it expires' : 'Block specific apps until a date and time — regardless of tasks. Apps stay retained for always-on enforcement after the timer ends.'}
            onPress={() => setBlockModalVisible(true)}
          />
        </Section>

        {/* ── Block Overlay ── */}
        <Section title="Block Overlay">
          <SettingButton
            icon="phone-portrait-outline"
            label="Overlay Appearance"
            description={
              (settings.overlayQuotes ?? []).length > 0 || (settings.overlayWallpaper ?? '')
                ? [
                    (settings.overlayWallpaper ?? '') ? 'Custom background set' : null,
                    (settings.overlayQuotes ?? []).length > 0
                      ? `${(settings.overlayQuotes ?? []).length} custom quote${(settings.overlayQuotes ?? []).length !== 1 ? 's' : ''}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Customise background image and quotes shown on the block screen'
            }
            onPress={() => setOverlayAppearanceVisible(true)}
          />
        </Section>

        {/* ── Pomodoro ── */}
        <Section title="Pomodoro Mode">
          <SettingRow label="Enable Pomodoro" description="Auto-cycle work and break sessions">
            <Switch
              value={settings.pomodoroEnabled}
              onValueChange={(v) => update({ pomodoroEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.pomodoroEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          {settings.pomodoroEnabled && (
            <>
              <SettingRow label="Work Duration">
                <Text style={styles.valueText}>{settings.pomodoroDuration}m</Text>
              </SettingRow>
              <SettingRow label="Break Duration">
                <Text style={styles.valueText}>{settings.pomodoroBreak}m</Text>
              </SettingRow>
            </>
          )}
        </Section>

        {/* ── Backup & Data ── */}
        {/* Sits above Permissions so users see the safety net BEFORE they
            grant any device-level access. Export builds a portable JSON of
            settings + tasks; Import restores it (Android only). */}
        <Section title="Backup & Data">
          <SettingButton
            icon="cloud-upload-outline"
            label={backupBusy ? 'Working…' : 'Export Backup'}
            description="Save a .focusflow file — share to Drive, Files, or email"
            onPress={handleExportBackup}
          />
          <SettingButton
            icon="cloud-download-outline"
            label="Import Backup"
            description="Restore from a .focusflow backup file"
            onPress={handleImportBackup}
          />
        </Section>

        {/* ── Permissions ── */}
        <Section title="Permissions">
          <SettingButton
            icon="shield-checkmark-outline"
            label="Manage Permissions"
            description="Accessibility, Usage Access, Battery, Notifications"
            onPress={() => router.push('/permissions' as never)}
          />
        </Section>

        {/* ── Diagnostics ── */}
        {showDiagnostics && (
          <Section title="Diagnostics">
            <SettingButton
              icon="terminal-outline"
              label="View Logs"
              description="Review local diagnostics and refresh the error log"
              onPress={() => setDiagnosticsVisible(true)}
            />
            <SettingButton
              icon="paper-plane-outline"
              label="Report an Issue"
              description="Open the same report form used from the log screen"
              onPress={() => setReportIssueVisible(true)}
            />
          </Section>
        )}

        {/* ── Danger Zone ── */}
        <Section title="Data">
          <SettingButton
            icon="trash-outline"
            label="Clear All Tasks"
            description="Permanently delete all scheduled tasks"
            danger
            onPress={handleClearAllTasks}
          />
        </Section>

        <Section title="About">
          <SettingButton
            icon="bar-chart-outline"
            label="Stats"
            description="Yesterday's digest, focus time, completed tasks, blocked apps, streak"
            onPress={() => router.push('/(tabs)/stats')}
          />
          <SettingButton
            icon="rocket-outline"
            label="What's New"
            description="Changelog — features, fixes, and improvements"
            onPress={() => router.push('/changelog')}
          />
          {/* Privacy + Terms are now a single combined screen — the
              privacy-policy screen renders both as tabs. */}
          <SettingButton
            icon="shield-checkmark-outline"
            label="Privacy & Terms"
            description="How FocusFlow handles your data and the rules of use"
            onPress={() => router.push('/privacy-policy')}
          />
          <SettingButton
            icon="mail-outline"
            label="Contact Support"
            description="Email us at tbtechsdev@gmail.com"
            onPress={() =>
              Linking.openURL(
                'mailto:tbtechsdev@gmail.com?subject=FocusFlow%20Support'
              )
            }
          />
        </Section>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.muted }]}>FocusFlow v1.0.8 (build 9)</Text>
          <Text style={[styles.footerText, { color: theme.muted }]}>All data stored locally on device</Text>
        </View>
      </ScrollView>

      <AllowedAppsModal
        visible={appsModalVisible}
        allowedPackages={settings.allowedInFocus}
        onSave={handleSaveAllowedApps}
        onClose={() => setAppsModalVisible(false)}
      />

      <StandaloneBlockModal
        visible={blockModalVisible}
        blockedPackages={settings.standaloneBlockPackages ?? []}
        blockUntil={settings.standaloneBlockUntil}
        locked={standaloneActive}
        dailyAllowanceEntries={settings.dailyAllowanceEntries ?? []}
        vpnPackages={settings.standaloneVpnPackages ?? []}
        blockPresets={settings.blockPresets ?? []}
        onSave={handleSaveStandaloneBlock}
        onSavePreset={handleSaveBlockPreset}
        onDeletePreset={handleDeleteBlockPreset}
        onClose={() => setBlockModalVisible(false)}
      />

      <DailyAllowanceModal
        visible={dailyModalVisible}
        selectedEntries={settings.dailyAllowanceEntries ?? []}
        locked={standaloneActive}
        requireDefensePin={true}
        onSave={async (entries) => { await setDailyAllowanceEntries(entries); }}
        onClose={() => setDailyModalVisible(false)}
      />

      <BlockedWordsModal
        visible={wordsModalVisible}
        words={settings.blockedWords ?? []}
        locked={standaloneActive}
        requireDefensePin={true}
        onSave={async (words) => { await setBlockedWords(words); }}
        onClose={() => setWordsModalVisible(false)}
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

      <GreyoutScheduleModal
        visible={greyoutModalVisible}
        windows={settings.greyoutSchedule ?? []}
        onSave={async (windows: GreyoutWindow[]) => { await update({ greyoutSchedule: windows }); }}
        onClose={() => setGreyoutModalVisible(false)}
      />

      <OverlayAppearanceModal
        visible={overlayAppearanceVisible}
        onClose={() => setOverlayAppearanceVisible(false)}
      />

      <DiagnosticsModal
        visible={diagnosticsVisible}
        onClose={() => setDiagnosticsVisible(false)}
      />

      <ReportIssueModal
        visible={reportIssueVisible}
        onClose={() => setReportIssueVisible(false)}
      />

      <PinSetupModal
        visible={pinSetupVisible}
        pinType="defense"
        onSaved={() => {
          setPinSetupVisible(false);
          pendingDefAction.current?.();
          pendingDefAction.current = null;
        }}
        onCancel={() => {
          setPinSetupVisible(false);
          pendingDefAction.current = null;
        }}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {description && <Text style={[styles.rowDesc, { color: theme.muted }]}>{description}</Text>}
      </View>
      {children}
    </View>
  );
}

function SettingButton({
  icon,
  label,
  description,
  danger = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={[styles.settingButton, { borderBottomColor: theme.border }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? COLORS.red : COLORS.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }, danger && { color: COLORS.red }]}>{label}</Text>
        {description && <Text style={[styles.rowDesc, { color: theme.muted }]}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.text },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.md },
  section: { gap: SPACING.xs },
  sectionTitle: {
    fontSize: FONT.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.muted,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: FONT.md, fontWeight: '600', color: COLORS.text },
  rowDesc: { fontSize: FONT.xs, color: COLORS.muted, marginTop: 2 },
  valueText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.primary },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  chipRow: { flexDirection: 'row', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT.sm, color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  blockActiveCard: {
    padding: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  blockActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  blockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.red,
  },
  blockActiveTitle: {
    fontSize: FONT.sm,
    fontWeight: '700',
    color: COLORS.red,
  },
  blockActiveDesc: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    marginTop: 2,
  },
  blockInactiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  blockInactiveText: {
    fontSize: FONT.sm,
    color: COLORS.muted,
  },
  footer: { alignItems: 'center', paddingTop: SPACING.xl, gap: SPACING.xs },
  footerText: { fontSize: FONT.xs, color: COLORS.border },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FONT.md, color: COLORS.muted },
});

export default withScreenErrorBoundary(SettingsScreen, 'Settings');
