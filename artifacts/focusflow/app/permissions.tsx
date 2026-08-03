import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { NativeImagePickerModule } from '@/native-modules/NativeImagePickerModule';
import { UsageStatsModule, isUsageStatsAvailable } from '@/native-modules/UsageStatsModule';
import { SharedPrefsModule, isSharedPrefsAvailable } from '@/native-modules/SharedPrefsModule';
import { ForegroundLaunchModule } from '@/native-modules/ForegroundLaunchModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { TroubleshootModal } from '@/components/TroubleshootModal';
import { RestrictedSettingsBanner } from '@/components/RestrictedSettingsBanner';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';

type PermStatus = 'granted' | 'denied' | 'unknown';
type PermissionId = 'accessibility' | 'usage' | 'battery' | 'notifications' | 'device_admin' | 'overlay' | 'media_files' | 'launcher';

interface PermissionItem {
  id: PermissionId;
  title: string;
  description: string;
  whyNeeded: string;
  brokenWithout: string[];
  icon: keyof typeof Ionicons.glyphMap;
  check: () => Promise<PermStatus>;
  open: () => void;
  deepLinkLabel: string;
  optional?: boolean;
}

const PERMISSIONS: PermissionItem[] = [
  {
    id: 'accessibility',
    title: 'Accessibility Service',
    description:
      'Reads only the app name — cannot see messages, passwords, or screen content. Nothing leaves your device.',
    whyNeeded:
      'This is how FocusFlow instantly redirects you the moment you open a blocked app.',
    brokenWithout: [
      'App blocking will not work at all',
      'Blocked apps will open freely during focus sessions',
      'You can bypass all blocks with no consequence',
    ],
    icon: 'eye-outline',
    deepLinkLabel: 'Open Accessibility Settings',
    check: async (): Promise<PermStatus> => {
      try {
        const granted = await UsageStatsModule.hasAccessibilityPermission();
        return granted ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      UsageStatsModule.openAccessibilitySettings().catch(() =>
        Linking.openSettings()
      );
    },
  },
  {
    id: 'usage',
    title: 'Usage Access',
    description:
      'Lets FocusFlow see which apps are running so it knows when to block.',
    whyNeeded:
      'Without this, FocusFlow is blind — it cannot detect which app you switched to.',
    brokenWithout: [
      'FocusFlow cannot detect which app you opened',
      'App blocking will silently fail',
      'Stats & focus session tracking may be inaccurate',
    ],
    icon: 'analytics-outline',
    deepLinkLabel: 'Open Usage Access Settings',
    check: async (): Promise<PermStatus> => {
      try {
        const granted = await UsageStatsModule.hasPermission();
        return granted ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      UsageStatsModule.openUsageAccessSettings().catch(() => Linking.openSettings());
    },
  },
  {
    id: 'battery',
    title: 'Battery Optimization',
    description:
      'Exempts FocusFlow from Android battery management so the blocking service stays alive.',
    whyNeeded:
      'Samsung, Xiaomi, Realme, and OnePlus phones aggressively kill background services — this stops that.',
    brokenWithout: [
      'Blocking service gets killed within minutes on most phones',
      'Focus sessions will stop enforcing after the screen turns off',
      'Especially severe on Samsung One UI, MIUI, and ColorOS',
    ],
    icon: 'battery-charging-outline',
    deepLinkLabel: 'Request Exemption',
    check: async (): Promise<PermStatus> => {
      try {
        const ignoring = await UsageStatsModule.isIgnoringBatteryOptimizations();
        return ignoring ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      UsageStatsModule.openBatteryOptimizationSettings().catch(() =>
        Linking.openSettings()
      );
    },
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description:
      'Allows FocusFlow to show task reminders and the persistent focus notification.',
    whyNeeded:
      'Required for all alerts, task reminders, and keeping the foreground service visible.',
    brokenWithout: [
      'No task start/end reminders',
      'The focus session notification disappears',
      'Android may kill the blocking service without the persistent notification',
    ],
    icon: 'notifications-outline',
    deepLinkLabel: 'Open Notification Settings',
    check: async (): Promise<PermStatus> => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') return 'granted';
        if (status === 'denied') return 'denied';
        return 'unknown';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      if (Platform.OS === 'android') {
        Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
          {
            key: 'android.provider.extra.APP_PACKAGE',
            value: 'com.tbtechs.focusflow',
          },
        ]).catch(() => Linking.openSettings());
      } else {
        Linking.openSettings();
      }
    },
  },
  {
    id: 'media_files',
    title: 'Media & Files',
    description:
      'Access your photo library to pick a custom wallpaper for the block screen.',
    whyNeeded:
      'Only required for setting a custom background image on the block overlay. The default wallpaper works fine without it.',
    brokenWithout: [
      'Cannot pick a custom wallpaper for the block screen',
      'The default built-in wallpaper is used instead',
    ],
    icon: 'images-outline',
    deepLinkLabel: 'Allow Media Access',
    optional: true,
    check: async (): Promise<PermStatus> => {
      try {
        const granted = await NativeImagePickerModule.checkMediaPermission();
        return granted ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      NativeImagePickerModule.requestMediaPermission().catch(() =>
        Linking.openSettings()
      );
    },
  },
  {
    id: 'device_admin',
    title: 'Device Admin',
    description:
      'Prevents Samsung One UI, MIUI, and ColorOS from force-stopping FocusFlow.',
    whyNeeded:
      'Some OEM phones let users force-stop apps from recent apps — this blocks that action.',
    brokenWithout: [
      'On Samsung & Xiaomi phones, you can swipe away FocusFlow from recents to stop all blocking',
      'Advanced users can easily bypass focus sessions',
    ],
    icon: 'shield-outline',
    deepLinkLabel: 'Activate Device Admin',
    optional: true,
    check: async (): Promise<PermStatus> => {
      try {
        const active = await UsageStatsModule.isDeviceAdminActive();
        return active ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      UsageStatsModule.openDeviceAdminSettings().catch(() =>
        Linking.openSettings()
      );
    },
  },
  {
    id: 'launcher',
    title: 'Home Launcher',
    description:
      'Sets FocusFlow as your default home screen so every app tap is intercepted before Android even sees it — zero reaction delay, no brief flash of a blocked app.',
    whyNeeded:
      'Without this, FocusFlow relies on the accessibility service to detect and redirect blocked apps after they open. As the home launcher, the interception happens before the app even launches.',
    brokenWithout: [
      'Blocked apps may flash briefly before the block overlay appears',
      'Accessibility service reaction latency still applies',
      'Launcher drawer filtering and pinned-app grid will not be shown',
    ],
    icon: 'home-outline',
    deepLinkLabel: 'Set as Default Home App',
    optional: true,
    check: async (): Promise<PermStatus> => {
      try {
        const isDefault = await SharedPrefsModule.isDefaultLauncher();
        return isDefault ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      Linking.sendIntent('android.settings.HOME_SETTINGS').catch(() =>
        Linking.sendIntent('android.settings.MANAGE_DEFAULT_APPS_SETTINGS').catch(() =>
          Linking.openSettings()
        )
      );
    },
  },
  {
    id: 'overlay',
    title: 'Appear on Top',
    description:
      'Draws the block screen directly over any app, so the blocked app is never visible — not even for a split second.',
    whyNeeded:
      'Without this, FocusFlow must switch tasks to show the block screen, causing a brief flash of the blocked app.',
    brokenWithout: [
      'Block overlay opens inside FocusFlow instead of on top of the blocked app',
      'A brief flash of the blocked app may appear before you are redirected',
    ],
    icon: 'layers-outline',
    deepLinkLabel: 'Enable Appear on Top',
    optional: true,
    check: async (): Promise<PermStatus> => {
      try {
        const granted = await ForegroundLaunchModule.hasOverlayPermission();
        return granted ? 'granted' : 'denied';
      } catch {
        return 'unknown';
      }
    },
    open: () => {
      ForegroundLaunchModule.requestOverlayPermission().catch(() =>
        Linking.openSettings()
      );
    },
  },
];

export default function PermissionsScreen() {
  const { state } = useApp();
  const { theme } = useTheme();
  const isFocusing = state.focusSession !== null && state.focusSession.isActive;
  const standaloneActive =
    (state.settings.standaloneBlockPackages ?? []).length > 0 &&
    state.settings.standaloneBlockUntil !== null &&
    new Date(state.settings.standaloneBlockUntil).getTime() > Date.now();
  const isLocked = isFocusing || standaloneActive;
  const nativeModulesOk = Platform.OS !== 'android' || (isSharedPrefsAvailable && isUsageStatsAvailable);
  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({});
  const [checking, setChecking] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [troubleshootPerm, setTroubleshootPerm] = useState<PermissionId | null>(null);

  const checkAll = useCallback(async () => {
    setChecking(true);
    const result: Record<string, PermStatus> = {};
    await Promise.all(
      PERMISSIONS.map(async (p) => {
        result[p.id] = await p.check();
      })
    );
    setStatuses(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    void checkAll();
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void checkAll();
        if (t1) clearTimeout(t1);
        if (t2) clearTimeout(t2);
        t1 = setTimeout(() => void checkAll(), 2000);
        t2 = setTimeout(() => void checkAll(), 4000);
      }
    });
    return () => {
      sub.remove();
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [checkAll]);

  useEffect(() => {
    if (isLocked) {
      setTroubleshootPerm(null);
      setExpandedId(null);
    }
  }, [isLocked]);

  const grantedCount = PERMISSIONS.filter(
    (p) => !p.optional && statuses[p.id] === 'granted'
  ).length;
  const requiredCount = PERMISSIONS.filter((p) => !p.optional).length;
  const allGranted = grantedCount === requiredCount;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header always visible so back navigation still works */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Permissions</Text>
        {!isLocked && (
          <TouchableOpacity onPress={checkAll} style={styles.refreshBtn} disabled={checking}>
            {checking ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="refresh" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Full-screen lock when a focus or standalone block is running ──────
           No touch events reach the permission list — users cannot open any
           system settings page that could be used to bypass blocking. */}
      {isLocked ? (
        <View style={[styles.lockedScreen, { backgroundColor: theme.background }]}>
          <View style={[styles.lockedCard, { backgroundColor: theme.card, borderColor: COLORS.orange + '55' }]}>
            <View style={styles.lockedIconRing}>
              <Ionicons name="lock-closed" size={32} color={COLORS.orange} />
            </View>
            <Text style={[styles.lockedHeading, { color: theme.text }]}>Settings Locked</Text>
            <Text style={[styles.lockedBody, { color: theme.textSecondary }]}>
              {isFocusing
                ? 'Permission settings are disabled while a focus session is running.'
                : 'Permission settings are disabled while a block schedule is active.'}
              {'\n\n'}
              Changing permissions during an active block could bypass app blocking — stop the block first to make changes.
            </Text>
            <TouchableOpacity style={styles.lockedBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={16} color="#fff" />
              <Text style={styles.lockedBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Native modules health check — only visible when FocusDayPackage is missing */}
        {!nativeModulesOk && (
          <View style={styles.modulesErrorBanner}>
            <Ionicons name="warning" size={22} color="#fff" />
            <View style={styles.modulesErrorTextWrap}>
              <Text style={styles.modulesErrorTitle}>Native modules not loaded</Text>
              <Text style={styles.modulesErrorBody}>
                Blocking is completely non-functional. This means either:{'\n'}
                {'  '}• You are running in Expo Go (use an EAS build instead){'\n'}
                {'  '}• The EAS build failed to register FocusDayPackage{'\n\n'}
                Run: <Text style={styles.modulesErrorCode}>eas build --profile preview</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Restricted-settings unlock banner — only renders on Android 13+ when
            the OS is currently blocking the Accessibility toggle for this
            install. Auto-hides when the user completes the unlock flow. */}
        <RestrictedSettingsBanner />

        {/* Tutorial Banner */}
        <View style={[styles.tutorialBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.tutorialIconWrap}>
            <Ionicons name="shield-checkmark" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.tutorialTextWrap}>
            <Text style={[styles.tutorialTitle, { color: theme.text }]}>Why these permissions?</Text>
            <Text style={[styles.tutorialBody, { color: theme.textSecondary }]}>
              FocusFlow enforces focus at the system level — not just reminders.
              To actually block apps and keep your session running, Android requires
              special access that regular apps don't need.
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Required permissions granted</Text>
            <Text style={[styles.progressCount, { color: theme.text }, allGranted && styles.progressCountDone]}>
              {grantedCount} / {requiredCount}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(grantedCount / requiredCount) * 100}%`,
                  backgroundColor: allGranted ? COLORS.green : COLORS.primary,
                },
              ]}
            />
          </View>
          {allGranted && (
            <Text style={styles.allSetText}>
              All required permissions granted — blocking is fully active.
            </Text>
          )}
        </View>

        {/* Permission cards */}
        {PERMISSIONS.map((perm) => {
          const status = statuses[perm.id] ?? 'unknown';
          const isExpanded = expandedId === perm.id;

          return (
            <View key={perm.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, status === 'granted' && styles.cardGranted]}>
              {/* Main row — tap to expand */}
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => setExpandedId(isExpanded ? null : perm.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconContainer, { backgroundColor: statusColor(status) + '22' }]}>
                  <Ionicons name={perm.icon} size={22} color={statusColor(status)} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{perm.title}</Text>
                    {perm.optional && (
                      <View style={styles.optionalBadge}>
                        <Text style={styles.optionalText}>optional</Text>
                      </View>
                    )}
                    <StatusBadge status={status} />
                  </View>
                  <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                    {perm.description}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.muted}
                />
              </TouchableOpacity>

              {/* Expanded detail */}
              {isExpanded && (
                <View style={[styles.expandedSection, { borderTopColor: theme.border }]}>
                  {/* Why needed */}
                  <View style={[styles.whyBox, { backgroundColor: theme.surface }]}>
                    <Ionicons name="bulb-outline" size={14} color={COLORS.orange} />
                    <Text style={[styles.whyText, { color: theme.textSecondary }]}>{perm.whyNeeded}</Text>
                  </View>

                  {/* What breaks */}
                  {status !== 'granted' && (
                    <View style={[styles.brokenSection, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.brokenTitle, { color: theme.text }]}>Without this permission:</Text>
                      {perm.brokenWithout.map((item, i) => (
                        <View key={i} style={styles.brokenRow}>
                          <Ionicons name="close-circle" size={14} color={COLORS.red} />
                          <Text style={[styles.brokenText, { color: theme.textSecondary }]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.grantBtn}
                      onPress={perm.open}
                    >
                      <Ionicons name="open-outline" size={14} color="#fff" />
                      <Text style={styles.grantBtnText}>{perm.deepLinkLabel}</Text>
                    </TouchableOpacity>

                    {status !== 'granted' && (
                      <TouchableOpacity
                        style={styles.troubleshootBtn}
                        onPress={() => setTroubleshootPerm(perm.id)}
                      >
                        <Ionicons name="construct-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.troubleshootBtnText}>Troubleshoot</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Launcher-specific: quick link to launcher settings when granted */}
                  {perm.id === 'launcher' && status === 'granted' && (
                    <TouchableOpacity
                      style={styles.launcherConfigBtn}
                      onPress={() => router.push('/home-launcher')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="settings-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.launcherConfigBtnText}>Configure Launcher Settings →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.footer}>
          Tap a card to expand and see what breaks without each permission.{'\n'}
          Statuses refresh automatically when you return to this screen.
        </Text>
      </ScrollView>
      )}

      {/* Troubleshoot Modal */}
      {troubleshootPerm && (
        <TroubleshootModal
          visible={troubleshootPerm !== null}
          permissionId={troubleshootPerm}
          onClose={() => setTroubleshootPerm(null)}
        />
      )}
    </SafeAreaView>
  );
}

function statusColor(status: PermStatus): string {
  if (status === 'granted') return COLORS.green;
  if (status === 'denied') return COLORS.red;
  return COLORS.muted;
}

function StatusBadge({ status }: { status: PermStatus }) {
  const label = status === 'granted' ? 'Granted' : status === 'denied' ? 'Denied' : 'Unknown';
  const color = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  refreshBtn: { padding: 4 },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },

  // Tutorial banner
  tutorialBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  tutorialIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tutorialTextWrap: { flex: 1, gap: 4 },
  tutorialTitle: { fontSize: FONT.md, fontWeight: '800', color: COLORS.primary },
  tutorialBody: { fontSize: FONT.xs, color: COLORS.primary + 'cc', lineHeight: 17 },

  // Progress
  progressSection: { gap: SPACING.xs },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { fontSize: FONT.xs, color: COLORS.muted, fontWeight: '600' },
  progressCount: { fontSize: FONT.xs, fontWeight: '800', color: COLORS.primary },
  progressCountDone: { color: COLORS.green },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: RADIUS.full },
  allSetText: {
    fontSize: FONT.xs,
    color: COLORS.green,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardGranted: {
    borderColor: COLORS.green + '44',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  cardTitle: { fontSize: FONT.md, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: FONT.xs, color: COLORS.muted, lineHeight: 17 },

  // Expanded section
  expandedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  whyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.orangeLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  whyText: { flex: 1, fontSize: FONT.xs, color: COLORS.orange, lineHeight: 17, fontWeight: '600' },
  brokenSection: { gap: 6 },
  brokenTitle: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  brokenRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  brokenText: { flex: 1, fontSize: FONT.xs, color: COLORS.textSecondary, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flex: 1,
    justifyContent: 'center',
  },
  grantBtnText: { fontSize: FONT.xs, fontWeight: '700', color: '#fff' },
  troubleshootBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  troubleshootBtnText: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.primary },

  // Badge
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeText: { fontSize: FONT.xs, fontWeight: '700' },
  optionalBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionalText: { fontSize: FONT.xs, color: COLORS.muted, fontWeight: '600' },

  // Footer
  footer: {
    fontSize: FONT.xs,
    color: COLORS.border,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: SPACING.sm,
  },

  // Native modules error banner
  modulesErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  modulesErrorTextWrap: { flex: 1, gap: 4 },
  modulesErrorTitle: { fontSize: FONT.md, fontWeight: '800', color: '#fff' },
  modulesErrorBody: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  modulesErrorCode: { fontFamily: 'monospace', fontWeight: '700', color: '#fff' },

  // Full-screen lock (replaces scroll content entirely during focus)
  lockedScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  lockedCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  lockedIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.orange + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.orange + '55',
    marginBottom: SPACING.xs,
  },
  lockedHeading: {
    fontSize: FONT.xxl ?? 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedBody: {
    fontSize: FONT.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockedBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  lockedBackText: {
    fontSize: FONT.sm,
    fontWeight: '700',
    color: '#fff',
  },

  // Legacy banner styles (kept for safety)
  focusLockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.orange + '18',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.orange + '66',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  focusLockedTitle: {
    fontSize: FONT.sm,
    fontWeight: '800',
    color: COLORS.orange,
    marginBottom: 2,
  },
  focusLockedDesc: {
    fontSize: FONT.xs,
    color: COLORS.orange + 'cc',
    lineHeight: 16,
  },
  focusLockedBack: {
    backgroundColor: COLORS.orange,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignSelf: 'flex-start',
  },
  focusLockedBackText: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: '#fff',
  },

  launcherConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  launcherConfigBtnText: {
    fontSize: FONT.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
