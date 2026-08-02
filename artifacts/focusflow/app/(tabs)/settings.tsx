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
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import type { DailyAllowanceEntry, GreyoutWindow } from '@/data/types';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import Constants from 'expo-constants';
import { dbDeleteAllTasks } from '@/data/database';
import { cancelAllReminders, requestPermissions } from '@/services/notificationService';
import { exportBackup, pickAndImportBackup } from '@/services/backupService';
import { mergeIntoBlockPreset } from '@/services/blockListImport';
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
import { ImportFromOtherAppModal } from '@/components/ImportFromOtherAppModal';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { SUPPORTED_LANGUAGES } from '@/i18n';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { state, updateSettings, setStandaloneBlockAndAllowance, setDailyAllowanceEntries, setBlockedWords, refreshTasks, deleteTask, addTask } = useApp();
  const { settings } = state;
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [dailyModalVisible, setDailyModalVisible] = useState(false);
  const [wordsModalVisible, setWordsModalVisible] = useState(false);
  const [greyoutModalVisible, setGreyoutModalVisible] = useState(false);
  const [overlayAppearanceVisible, setOverlayAppearanceVisible] = useState(false);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [importOtherAppVisible, setImportOtherAppVisible] = useState(false);
  const [defPinVisible, setDefPinVisible] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const pendingDefAction = useRef<(() => void) | null>(null);
  // Diagnostics section is development-only — hidden entirely in release builds.
  const showDiagnostics = __DEV__;

  // Current language display label
  const currentLangCode = i18n.language ?? 'en';
  const currentLang = SUPPORTED_LANGUAGES.find((l) => currentLangCode.startsWith(l.code));

  if (!state.isDbReady) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>{t('settings.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('settings.loading')}</Text>
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
      granted ? t('settings.notifications2.granted') : t('settings.notifications2.denied'),
      granted
        ? t('settings.notifications2.grantedMsg')
        : t('settings.notifications2.deniedMsg'),
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
      t('settings.backup.restoreTitle'),
      t('settings.backup.restoreMsg'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.backup.addTasks'),
          onPress: async () => runImport(false),
        },
        {
          text: t('settings.backup.replaceEverything'),
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
        result.tasksSkipped > 0 ? `Tasks skipped: ${result.tasksSkipped}` : null,
        ...result.warnings.slice(0, 3),
      ].filter(Boolean) as string[];
      Alert.alert('Backup restored', lines.join('\n'));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleClearAllTasks = () => {
    Alert.alert(t('settings.danger.clearAllTitle'), t('settings.danger.clearAllMsg'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.danger.clearAll'),
        style: 'destructive',
        onPress: async () => {
          await cancelAllReminders();
          await dbDeleteAllTasks();
          await refreshTasks();
          Alert.alert(t('settings.danger.done'), t('settings.danger.allTasksCleared'));
        },
      },
    ]);
  };

  const handleSaveAllowedApps = async (packages: string[]) => {
    // updateSettings already calls SharedPrefsModule.setAllowedPackages inside
    // its Promise.all when a focus session is active, so the explicit extra call
    // here was a redundant double-write that could cause a race condition.
    // updateSettings handles the full sync path — no extra call needed.
    await update({ allowedInFocus: packages });
  };

  const handleImportFromOtherApp = async (packages: string[]) => {
    const result = mergeIntoBlockPreset(packages, settings);
    if (result.added === 0) {
      Alert.alert('Nothing imported', 'No valid app names were found.');
      return;
    }
    await update({ blockPresets: result.allPresets });
    Alert.alert(
      'Saved as a preset',
      `${result.added} app${result.added !== 1 ? 's' : ''} saved as the preset "${result.preset.name}".\n\nNothing is being blocked yet — open Standalone Block, a Block Schedule batch, or Daily Allowance to use this preset whenever you're ready.`,
    );
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
                  t('settings.pin.noPinSet'),
                  t('settings.pin.noPinSetMsg'),
                  [
                    {
                      text: t('settings.pin.setNow'),
                      onPress: () => {
                        pendingDefAction.current = action;
                        setPinSetupVisible(true);
                      },
                    },
                    {
                      text: t('settings.pin.notNow'),
                      style: 'cancel',
                      onPress: () => action(),
                    },
                    {
                      text: t('settings.pin.dontAskAgain'),
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
      Alert.alert(t('settings.system.protectionActive'), t('settings.system.cannotDisableWhileActive'));
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
      Alert.alert(t('settings.system.protectionActive'), t('settings.system.ytCannotDisable'));
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
      Alert.alert(t('settings.system.protectionActive'), t('settings.system.igCannotDisable'));
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
        <Text style={[styles.title, { color: theme.text }]}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom + 20 }]}>

        {/* ── Language ── */}
        <Section title={t('settings.sections.language')}>
          <SettingButton
            icon="language-outline"
            label={t('settings.language.selectLanguage')}
            description={currentLang ? `${currentLang.nativeLabel} — ${currentLang.label}` : t('settings.language.autoDetected')}
            onPress={() => setLanguagePickerVisible(true)}
          />
        </Section>

        {/* ── Profile ── */}
        <Section title={t('settings.sections.profile')}>
          <SettingButton
            icon="person-circle-outline"
            label={settings.userProfile?.name ? `${settings.userProfile.name}` : t('settings.profile.setupPrompt')}
            description={
              settings.userProfile
                ? [
                    settings.userProfile.occupation,
                    settings.userProfile.dailyGoalHours ? t('settings.profile.dailyGoal', { hours: settings.userProfile.dailyGoalHours }) : null,
                    settings.userProfile.wakeUpTime ? t('settings.profile.wakesAt', { time: settings.userProfile.wakeUpTime }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || t('settings.profile.tapToPersonalise')
                : t('settings.profile.nameOccupationGoal')
            }
            onPress={() => router.push('/user-profile')}
          />
        </Section>

        {/* ── Notifications ── */}
        <Section title={t('settings.sections.notifications')}>
          <SettingRow label={t('settings.notifications.enableReminders')} description={t('settings.notifications.enableRemindersDesc')}>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => update({ notificationsEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.notificationsEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingButton
            icon="notifications-outline"
            label={t('settings.notifications.requestPermission')}
            onPress={handleRequestNotifications}
          />
        </Section>

        {/* ── Scheduling ── */}
        <Section title={t('settings.sections.scheduling')}>
          <SettingRow label={t('settings.scheduling.defaultTaskDuration')}>
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
        <Section title={t('settings.sections.focusMode')}>
          <SettingRow label={t('settings.focusMode.autoEnable')} description={t('settings.focusMode.autoEnableDesc')}>
            <Switch
              value={settings.focusModeEnabled}
              onValueChange={(v) => update({ focusModeEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.focusModeEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingButton
            icon="apps-outline"
            label={t('settings.focusMode.manageAllowedApps')}
            description={
              settings.allowedInFocus.length === 0
                ? t('settings.focusMode.allAppsBlocked')
                : t('settings.focusMode.appsAllowed', { count: settings.allowedInFocus.length })
            }
            onPress={() => setAppsModalVisible(true)}
          />
        </Section>

        {/* ── Aversion Deterrents ── */}
        <Section title={t('settings.sections.aversionDeterrents')}>
          <SettingRow label={t('settings.aversion.screenDimmer')} description={t('settings.aversion.screenDimmerDesc')}>
            <Switch
              value={settings.aversionDimmerEnabled}
              onValueChange={(v) => update({ aversionDimmerEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.aversionDimmerEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingRow label={t('settings.aversion.vibrationHarassment')} description={t('settings.aversion.vibrationHarassmentDesc')}>
            <Switch
              value={settings.aversionVibrateEnabled}
              onValueChange={(v) => update({ aversionVibrateEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.aversionVibrateEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingRow label={t('settings.aversion.soundAlert')} description={t('settings.aversion.soundAlertDesc')}>
            <Switch
              value={settings.aversionSoundEnabled}
              onValueChange={(v) => update({ aversionSoundEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.aversionSoundEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
        </Section>

        {/* ── Daily App Allowance ── */}
        <Section title={t('settings.sections.dailyAppAllowance')}>
          <SettingButton
            icon="sunny-outline"
            label={t('settings.dailyAllowance.manageApps')}
            description={
              (settings.dailyAllowanceEntries ?? []).length === 0
                ? t('settings.dailyAllowance.noApps')
                : t('settings.dailyAllowance.appsConfigured', { count: (settings.dailyAllowanceEntries ?? []).length })
            }
            onPress={() => setDailyModalVisible(true)}
          />
        </Section>

        {/* ── Word Blocking ── */}
        <Section title={t('settings.sections.wordBlocking')}>
          <SettingButton
            icon="text-outline"
            label={t('settings.wordBlocking.manageKeywords')}
            description={
              (settings.blockedWords ?? []).length === 0
                ? t('settings.wordBlocking.noKeywords')
                : t('settings.wordBlocking.keywords', { count: (settings.blockedWords ?? []).length })
            }
            onPress={() => setWordsModalVisible(true)}
          />
        </Section>

        <Section title={t('settings.sections.pinProtection')}>
          <SettingRow
            label={t('settings.pin.requirePassword')}
            description={
              (settings.pinProtectionEnabled ?? false)
                ? t('settings.pin.pinOn')
                : t('settings.pin.pinOff')
            }
          >
            <Switch
              value={settings.pinProtectionEnabled ?? false}
              onValueChange={(v) => {
                if (!v) {
                  withDefensePin(() => {
                    void update({ pinProtectionEnabled: false });
                    void SharedPrefsModule.putString('pin_setup_prompt_dismissed', '');
                  });
                } else {
                  void update({ pinProtectionEnabled: true });
                }
              }}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={(settings.pinProtectionEnabled ?? false) ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          <SettingButton
            icon="shield-half-outline"
            label={t('settings.pin.managePins')}
            description={t('settings.pin.managePinsDesc')}
            onPress={() => router.push('/block-defense')}
          />
        </Section>

        <Section title={t('settings.sections.systemProtection')}>
          <SettingRow
            label={t('settings.system.protectSystemControls')}
            description={
              blockProtectionActive
                ? t('settings.system.protectSystemControlsLocked')
                : t('settings.system.protectSystemControlsDesc')
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
            label={t('settings.system.blockYoutubeShorts')}
            description={
              blockProtectionActive && (settings.blockYoutubeShortsEnabled ?? false)
                ? t('settings.system.blockYoutubeShortsLocked')
                : t('settings.system.blockYoutubeShortsDesc')
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
            label={t('settings.system.blockInstagramReels')}
            description={
              blockProtectionActive && (settings.blockInstagramReelsEnabled ?? false)
                ? t('settings.system.blockInstagramReelsLocked')
                : t('settings.system.blockInstagramReelsDesc')
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
        <Section title={t('settings.sections.blockSchedules')}>
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
        <Section title={t('settings.sections.standaloneBlock')}>
          {standaloneActive ? (
            <View style={styles.blockActiveCard}>
              <View style={styles.blockActiveRow}>
                <View style={styles.blockDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockActiveTitle}>{t('settings.standalone.blockActive')}</Text>
                  <Text style={styles.blockActiveDesc}>
                    {t('settings.standalone.appsBlockedUntil', { count: (settings.standaloneBlockPackages ?? []).length, time: blockUntilLabel })}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.blockInactiveCard}>
              <Ionicons name="shield-outline" size={18} color={theme.muted} />
              <Text style={[styles.blockInactiveText, { color: theme.muted }]}>{t('settings.standalone.noBlockActive')}</Text>
            </View>
          )}
          <SettingButton
            icon={standaloneActive ? 'lock-closed-outline' : 'ban-outline'}
            label={standaloneActive ? t('settings.standalone.addMoreApps') : t('settings.standalone.setStandaloneBlock')}
            description={standaloneActive ? t('settings.standalone.addMoreAppsDesc') : t('settings.standalone.setStandaloneBlockDesc')}
            onPress={() => setBlockModalVisible(true)}
          />
        </Section>

        {/* ── Block Overlay ── */}
        <Section title={t('settings.sections.blockOverlay')}>
          <SettingButton
            icon="phone-portrait-outline"
            label={t('settings.overlay.overlayAppearance')}
            description={
              (settings.overlayQuotes ?? []).length > 0 || (settings.overlayWallpaper ?? '')
                ? [
                    (settings.overlayWallpaper ?? '') ? t('settings.overlay.customBackground') : null,
                    (settings.overlayQuotes ?? []).length > 0
                      ? t('settings.overlay.customQuotes', { count: (settings.overlayQuotes ?? []).length })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t('settings.overlay.customiseDesc')
            }
            onPress={() => setOverlayAppearanceVisible(true)}
          />
        </Section>

        {/* ── Pomodoro ── */}
        <Section title={t('settings.sections.pomodoro')}>
          <SettingRow label={t('settings.pomodoro.enable')} description={t('settings.pomodoro.enableDesc')}>
            <Switch
              value={settings.pomodoroEnabled}
              onValueChange={(v) => update({ pomodoroEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={settings.pomodoroEnabled ? COLORS.primary : COLORS.muted}
            />
          </SettingRow>
          {settings.pomodoroEnabled && (
            <>
              <SettingRow label={t('settings.pomodoro.workDuration')}>
                <Text style={styles.valueText}>{settings.pomodoroDuration}m</Text>
              </SettingRow>
              <SettingRow label={t('settings.pomodoro.breakDuration')}>
                <Text style={styles.valueText}>{settings.pomodoroBreak}m</Text>
              </SettingRow>
            </>
          )}
        </Section>

        {/* ── Backup & Data ── */}
        <Section title={t('settings.sections.backupData')}>
          <SettingButton
            icon="cloud-upload-outline"
            label={backupBusy ? t('settings.backup.exportWorking') : t('settings.backup.exportBackup')}
            description={t('settings.backup.exportDesc')}
            onPress={handleExportBackup}
          />
          <SettingButton
            icon="cloud-download-outline"
            label={t('settings.backup.importBackup')}
            description={t('settings.backup.importDesc')}
            onPress={handleImportBackup}
          />
          <SettingButton
            icon="swap-horizontal-outline"
            label={t('settings.backup.importFromApp')}
            description={t('settings.backup.importFromAppDesc')}
            onPress={() => setImportOtherAppVisible(true)}
          />
        </Section>

        {/* ── Permissions ── */}
        <Section title={t('settings.sections.permissions')}>
          <SettingButton
            icon="shield-checkmark-outline"
            label={t('settings.permissions.managePermissions')}
            description={t('settings.permissions.managePermissionsDesc')}
            onPress={() => router.push('/permissions' as never)}
          />
        </Section>

        {/* ── Diagnostics (debug builds only) ── */}
        {showDiagnostics && (
          <Section title={t('settings.sections.diagnostics')}>
            <SettingButton
              icon="terminal-outline"
              label={t('settings.diagnostics.viewStartupLogs')}
              description={t('settings.diagnostics.viewStartupLogsDesc')}
              onPress={() => setDiagnosticsVisible(true)}
            />
          </Section>
        )}

        {/* ── Danger Zone ── */}
        <Section title={t('settings.sections.data')}>
          <SettingButton
            icon="trash-outline"
            label={t('settings.danger.clearAllTasks')}
            description={t('settings.danger.clearAllTasksDesc')}
            danger
            onPress={handleClearAllTasks}
          />
        </Section>

        <Section title={t('settings.sections.about')}>
          <SettingButton
            icon="bar-chart-outline"
            label={t('settings.about.stats')}
            description={t('settings.about.statsDesc')}
            onPress={() => router.push('/(tabs)/stats')}
          />
          <SettingButton
            icon="rocket-outline"
            label={t('settings.about.whatsNew')}
            description={t('settings.about.whatsNewDesc')}
            onPress={() => router.push('/changelog')}
          />
          <SettingButton
            icon="shield-checkmark-outline"
            label={t('settings.about.privacyTerms')}
            description={t('settings.about.privacyTermsDesc')}
            onPress={() => router.push('/privacy-policy')}
          />
          <SettingButton
            icon="desktop-outline"
            label={t('settings.about.focusflowWindows')}
            description={t('settings.about.focusflowWindowsDesc')}
            onPress={() => Linking.openURL('https://focusflowpc.pages.dev/')}
          />
          <SettingButton
            icon="mail-outline"
            label={t('settings.about.contactSupport')}
            description={t('settings.about.contactSupportDesc')}
            onPress={() =>
              Linking.openURL(
                'mailto:tbtechsdev@gmail.com?subject=FocusFlow%20Support'
              )
            }
          />
        </Section>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.muted }]}>FocusFlow v1.0.4 (build 5)</Text>
          <Text style={[styles.footerText, { color: theme.muted }]}>All data stored locally on device</Text>
        </View>
      </ScrollView>

      <LanguagePickerModal
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
      />

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
        standaloneActive={standaloneActive}
        requireDefensePin={withDefensePin}
      />

      <OverlayAppearanceModal
        visible={overlayAppearanceVisible}
        onClose={() => setOverlayAppearanceVisible(false)}
      />

      <DiagnosticsModal
        visible={diagnosticsVisible}
        onClose={() => setDiagnosticsVisible(false)}
      />

      <ImportFromOtherAppModal
        visible={importOtherAppVisible}
        onClose={() => setImportOtherAppVisible(false)}
        onImport={handleImportFromOtherApp}
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
