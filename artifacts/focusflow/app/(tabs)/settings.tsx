import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import Constants from 'expo-constants';
import { dbDeleteAllTasks, dbDeleteAllTasksExcept, dbEndFocusSession } from '@/data/database';
import {
  cancelAllReminders,
  cancelAllRemindersExcept,
  requestPermissions,
  scheduleTaskRemindersBatch,
} from '@/services/notificationService';
import { exportBackup, pickAndImportBackup } from '@/services/backupService';
import { formatDuration } from '@/services/taskService';
import { AllowedAppsModal } from '@/components/AllowedAppsModal';
import { OverlayAppearanceModal } from '@/components/OverlayAppearanceModal';
import DiagnosticsModal from '@/components/DiagnosticsModal';
import ReportIssueModal from '@/components/ReportIssueModal';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import DarkModeToggle from '@/components/DarkModeToggle';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { useNavPress } from '@/hooks/useNavPress';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { state, updateSettings, refreshTasks, deleteTask, addTask, stopFocusMode } = useApp();
  const { settings } = state;
  const { theme } = useTheme();
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [overlayAppearanceVisible, setOverlayAppearanceVisible] = useState(false);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [reportIssueVisible, setReportIssueVisible] = useState(false);
  const [focusPinVisible, setFocusPinVisible] = useState(false);
  const pendingClearAllRef = useRef(false);
  const navProfile = useNavPress('/user-profile');
  const navPermissions = useNavPress('/permissions');
  const navStats = useNavPress('/(tabs)/stats');
  const navChangelog = useNavPress('/changelog');
  const navPrivacy = useNavPress('/privacy-policy');
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

  const clearAllTasks = async (focusPinHash: string | null = null) => {
    const activeFocusTaskId = state.focusSession?.isActive ? state.focusSession.taskId : null;
    if (activeFocusTaskId) {
      if (focusPinHash) {
        await stopFocusMode(focusPinHash);
        // stopFocusMode normally closes this row through focusService. Repeat
        // the idempotent update here so a recovered session with no in-memory
        // task reference cannot leave an active focus_sessions row behind.
        await dbEndFocusSession(activeFocusTaskId);
        await cancelAllReminders();
        await dbDeleteAllTasks();
      } else {
        // Without the Focus PIN, preserve the protected task and its live
        // session. Only the other task rows and their reminders are removed.
        await cancelAllRemindersExcept(activeFocusTaskId);
        await dbDeleteAllTasksExcept(activeFocusTaskId);
      }
    } else {
      await cancelAllReminders();
      await dbDeleteAllTasks();
    }
    await refreshTasks();
    Alert.alert(
      'Done',
      activeFocusTaskId && !focusPinHash
        ? 'All other tasks cleared. The active focus task was kept running.'
        : 'All tasks cleared.',
    );
  };

  const handleClearAllTasks = () => {
    Alert.alert('Clear All Tasks', 'This will delete ALL tasks. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          if (state.focusSession?.isActive) {
            const pinSet = await SessionPinModule.isPinSet().catch(() => false);
            if (pinSet) {
              pendingClearAllRef.current = true;
              setFocusPinVisible(true);
              return;
            }
          }
          await clearAllTasks();
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
            onPress={navProfile.onPress}
            loading={navProfile.loading}
          />
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <SettingRow label="Dark Mode" description="Use a darker color palette throughout FocusFlow">
            <DarkModeToggle />
          </SettingRow>
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
            onPress={navPermissions.onPress}
            loading={navPermissions.loading}
          />
        </Section>

        {/* ── Diagnostics ── */}
        {showDiagnostics && (
          <Section title="Diagnostics">
            <SettingButton
              icon="paper-plane-outline"
              label="Report an Issue"
              description="Review and email a bug report, feedback, or app review"
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
            onPress={navStats.onPress}
            loading={navStats.loading}
          />
          <SettingButton
            icon="rocket-outline"
            label="What's New"
            description="Changelog — features, fixes, and improvements"
            onPress={navChangelog.onPress}
            loading={navChangelog.loading}
          />
          {/* Privacy + Terms are now a single combined screen — the
              privacy-policy screen renders both as tabs. */}
          <SettingButton
            icon="shield-checkmark-outline"
            label="Privacy & Terms"
            description="How FocusFlow handles your data and the rules of use"
            onPress={navPrivacy.onPress}
            loading={navPrivacy.loading}
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
          <Text style={[styles.footerText, { color: theme.muted }]}>FocusFlow v1.1.1 (build 12)</Text>
          <Text style={[styles.footerText, { color: theme.muted }]}>All data stored locally on device</Text>
        </View>
      </ScrollView>

      <AllowedAppsModal
        visible={appsModalVisible}
        allowedPackages={settings.allowedInFocus}
        onSave={handleSaveAllowedApps}
        onClose={() => setAppsModalVisible(false)}
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
      <PinVerifyModal
        visible={focusPinVisible}
        pinType="focus"
        title="Focus Session Password Required"
        description="Enter your focus session password before clearing tasks and ending the active focus session."
        onVerified={(hash) => {
          setFocusPinVisible(false);
          if (!pendingClearAllRef.current) return;
          pendingClearAllRef.current = false;
          void clearAllTasks(hash).catch(() => {
            Alert.alert('Clear failed', 'Could not stop the active focus session and clear tasks.');
          });
        }}
        onCancel={() => {
          pendingClearAllRef.current = false;
          setFocusPinVisible(false);
          void clearAllTasks().catch(() => {
            Alert.alert('Clear failed', 'Could not clear the other tasks.');
          });
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
  loading = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  danger?: boolean;
  onPress: () => void;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.settingButton, { borderBottomColor: theme.border }, loading && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading}
    >
      <Ionicons name={icon} size={20} color={danger ? COLORS.red : COLORS.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }, danger && { color: COLORS.red }]}>{label}</Text>
        {description && <Text style={[styles.rowDesc, { color: theme.muted }]}>{description}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.border} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={theme.border} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
