/**
 * OnboardingScreen
 *
 * Three-step onboarding flow:
 *   Step 1 — Required permissions (accessibility, usage, overlay, notifications, battery)
 *   Step 2 — Optional permissions  (VPN, device admin, media)
 *   Step 3 — Quick how-to-use guide + PIN protection toggle
 *
 * The "Continue" button is always enabled so users who skip permissions
 * can still reach the app; a tip points them to Settings → Permissions.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PinSetupModal } from '@/components/PinSetupModal';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { NativeImagePickerModule } from '@/native-modules/NativeImagePickerModule';
import { NetworkBlockModule } from '@/native-modules/NetworkBlockModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { Alert } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { requestPermissions } from '@/services/notificationService';
import { ForegroundServiceModule } from '@/native-modules/ForegroundServiceModule';
import { UsageStatsModule } from '@/native-modules/UsageStatsModule';
import { ForegroundLaunchModule } from '@/native-modules/ForegroundLaunchModule';
import { RestrictedSettingsBanner } from '@/components/RestrictedSettingsBanner';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

type PermStatus = 'granted' | 'denied' | 'unknown';

interface PermItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  whyNeeded: string;
  brokenWithout: string[];
  deepLinkLabel: string;
  grantAction: 'auto' | 'manual';
  optional?: boolean;
}

const PERMISSIONS: PermItem[] = [
  {
    id: 'notifications',
    icon: 'notifications-outline',
    title: 'Notifications',
    description: 'Task reminders and live focus session alerts.',
    whyNeeded:
      'Required for all alerts, task reminders, and keeping the foreground service visible to Android.',
    brokenWithout: [
      'No task start or end reminders',
      'The focus session notification disappears',
      'Android may kill the blocking service without the persistent notification',
    ],
    deepLinkLabel: 'Allow Notifications',
    grantAction: 'auto',
  },
  {
    id: 'battery',
    icon: 'battery-charging-outline',
    title: 'Battery Optimization',
    description: 'Keeps FocusFlow alive in the background on all OEM ROMs.',
    whyNeeded:
      'Samsung, Xiaomi, Realme, and OnePlus phones aggressively kill background services — this exemption stops that.',
    brokenWithout: [
      'Blocking service gets killed within minutes on most phones',
      'Focus sessions stop enforcing after the screen turns off',
      'Especially severe on Samsung One UI, MIUI, and ColorOS',
    ],
    deepLinkLabel: 'Request Exemption',
    grantAction: 'auto',
  },
  {
    id: 'overlay',
    icon: 'layers-outline',
    title: 'Appear on Top',
    description: 'Draws the block screen directly over blocked apps.',
    whyNeeded:
      'This lets FocusFlow cover blocked apps instantly without briefly showing the app underneath.',
    brokenWithout: [
      'Block overlay opens inside FocusFlow instead of directly over the blocked app',
      'A brief flash of the blocked app may appear before redirect',
    ],
    deepLinkLabel: 'Enable Appear on Top',
    grantAction: 'manual',
  },
  {
    id: 'usage',
    icon: 'analytics-outline',
    title: 'Usage Access',
    description: 'Lets FocusFlow see which app is in the foreground.',
    whyNeeded:
      'Without this, FocusFlow is blind — it cannot detect which app you switched to.',
    brokenWithout: [
      'FocusFlow cannot detect which app you opened',
      'App blocking will silently fail',
      'Stats and focus session tracking will be inaccurate',
    ],
    deepLinkLabel: 'Open Usage Access Settings',
    grantAction: 'manual',
  },
  {
    id: 'accessibility',
    icon: 'eye-outline',
    title: 'Accessibility Service',
    description: 'Redirects you away from blocked apps the instant you open them.',
    whyNeeded:
      'This is how FocusFlow instantly redirects you the moment you open a blocked app during a focus session.',
    brokenWithout: [
      'App blocking will not work at all',
      'Blocked apps will open freely during focus sessions',
      'You can bypass all blocks with no consequence',
    ],
    deepLinkLabel: 'Open Accessibility Settings',
    grantAction: 'manual',
  },
  {
    id: 'vpn',
    icon: 'shield-half-outline',
    title: 'VPN Permission',
    description: 'Required to cut the network connection of blocked apps when Network Blocking is enabled.',
    whyNeeded:
      'Android requires a one-time consent dialog before any app may create a VPN. Without it the "Network Blocking" toggle in Block Enforcement will have no effect.',
    brokenWithout: [
      'Network Blocking (Block Enforcement → System Protection) will not start',
      'Blocked apps will still have full internet access during a focus session',
    ],
    deepLinkLabel: 'Allow VPN',
    grantAction: 'auto',
    optional: true,
  },
  {
    id: 'device_admin',
    icon: 'shield-outline',
    title: 'Device Admin',
    description: 'Prevents Samsung, Xiaomi, and other OEM phones from force-stopping FocusFlow via the recent-apps menu.',
    whyNeeded:
      'Some OEM ROMs let users swipe away or force-stop apps from the recents screen — activating Device Admin blocks that action so your focus sessions cannot be killed.',
    brokenWithout: [
      'On Samsung One UI, MIUI, and ColorOS you can swipe FocusFlow away to instantly stop all blocking',
      'Advanced users can bypass any focus session by force-stopping the app',
    ],
    deepLinkLabel: 'Activate Device Admin',
    grantAction: 'manual',
    optional: true,
  },
  {
    id: 'media',
    icon: 'images-outline',
    title: 'Media & Files',
    description: 'Access your photo library to set a custom wallpaper on the block screen.',
    whyNeeded:
      'Only needed if you want to pick a custom background image for the block overlay. The default wallpaper works without this.',
    brokenWithout: [
      'You cannot pick a custom wallpaper for the block screen',
      'The default built-in wallpaper will be used instead',
    ],
    deepLinkLabel: 'Allow Media Access',
    grantAction: 'auto',
    optional: true,
  },
];

const HOW_TO_SECTIONS = [
  {
    icon: 'calendar-outline' as const,
    title: 'Schedule Your Focus',
    color: COLORS.primary,
    tip: 'Add tasks on the Schedule tab → tap Focus Mode when one is active to start blocking.',
  },
  {
    icon: 'ban-outline' as const,
    title: 'Block Apps',
    color: COLORS.red,
    tip: 'Side menu → Standalone Block to block any app for a set time — no task needed. Use Daily Allowance for soft limits.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Lock It Down',
    color: COLORS.orange,
    tip: 'Block Enforcement has System Protection, Keyword Blocker, VPN blocking, and Aversion Deterrents. Stack them for maximum resistance.',
  },
  {
    icon: 'time-outline' as const,
    title: 'Block Schedules',
    color: COLORS.purple,
    tip: 'Set time-window batches (e.g. no Instagram 9–17 Mon–Fri). They run forever without needing a focus session.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Track Progress',
    color: COLORS.green,
    tip: 'Stats tab shows daily & weekly focus charts, yesterday\'s task digest, and an all-time heatmap.',
  },
  {
    icon: 'menu-outline' as const,
    title: 'Side Menu',
    color: COLORS.blue,
    tip: 'Swipe right from the left edge (or tap the › tab) to reach every blocking tool without going through Settings.',
  },
];

async function checkStatus(id: string): Promise<PermStatus> {
  try {
    switch (id) {
      case 'media': {
        const granted = await NativeImagePickerModule.checkMediaPermission();
        return granted ? 'granted' : 'denied';
      }
      case 'notifications': {
        const { status } = await Notifications.getPermissionsAsync();
        return status === 'granted' ? 'granted' : 'denied';
      }
      case 'battery': {
        const ok = await UsageStatsModule.isIgnoringBatteryOptimizations();
        return ok ? 'granted' : 'denied';
      }
      case 'usage': {
        const ok = await UsageStatsModule.hasPermission();
        return ok ? 'granted' : 'denied';
      }
      case 'accessibility': {
        const ok = await UsageStatsModule.hasAccessibilityPermission();
        return ok ? 'granted' : 'denied';
      }
      case 'overlay': {
        const ok = await ForegroundLaunchModule.hasOverlayPermission();
        return ok ? 'granted' : 'denied';
      }
      case 'vpn': {
        const ok = await NetworkBlockModule.isVpnPermissionGranted();
        return ok ? 'granted' : 'denied';
      }
      case 'device_admin': {
        const ok = await UsageStatsModule.isDeviceAdminActive();
        return ok ? 'granted' : 'denied';
      }
      default:
        return 'denied';
    }
  } catch {
    return 'denied';
  }
}

export default function OnboardingScreen() {
  const { state, updateSettings } = useApp();
  const { theme } = useTheme();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const scrollRef = useRef<ScrollView>(null);

  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [pinProtectionChoice, setPinProtectionChoice] = useState(false);
  const [defensePinSet, setDefensePinSet] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => setDefensePinSet(!!hash))
      .catch(() => {});
  }, []);

  const checkAll = useCallback(async () => {
    const result: Record<string, PermStatus> = {};
    await Promise.all(
      PERMISSIONS.map(async (p) => {
        result[p.id] = await checkStatus(p.id);
      })
    );
    setStatuses(result);
  }, []);

  useEffect(() => { void checkAll(); }, [checkAll]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        await checkAll();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [checkAll]);

  const handleGrant = async (perm: PermItem) => {
    if (statuses[perm.id] === 'granted') return;
    setActionLoading(perm.id);
    try {
      if (perm.id === 'media') {
        const granted = await NativeImagePickerModule.requestMediaPermission();
        setStatuses((prev) => ({ ...prev, media: granted ? 'granted' : 'denied' }));
      } else if (perm.id === 'notifications') {
        const granted = await requestPermissions();
        setStatuses((prev) => ({ ...prev, notifications: granted ? 'granted' : 'denied' }));
      } else if (perm.id === 'battery') {
        await ForegroundServiceModule.requestBatteryOptimizationExemption();
        setTimeout(async () => {
          const s = await checkStatus('battery');
          setStatuses((prev) => ({ ...prev, battery: s }));
        }, 800);
      } else if (perm.id === 'usage') {
        if (Platform.OS === 'android') {
          await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
        }
      } else if (perm.id === 'accessibility') {
        await UsageStatsModule.openAccessibilitySettings();
      } else if (perm.id === 'overlay') {
        await ForegroundLaunchModule.requestOverlayPermission();
      } else if (perm.id === 'vpn') {
        await NetworkBlockModule.requestVpnPermission();
        setTimeout(async () => {
          const s = await checkStatus('vpn');
          setStatuses((prev) => ({ ...prev, vpn: s }));
        }, 800);
      } else if (perm.id === 'device_admin') {
        await UsageStatsModule.openDeviceAdminSettings();
        setTimeout(async () => {
          const s = await checkStatus('device_admin');
          setStatuses((prev) => ({ ...prev, device_admin: s }));
        }, 800);
      }
    } catch {
      try { await Linking.openSettings(); } catch { /* ignore */ }
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinish = async () => {
    try {
      await updateSettings({ ...state.settings, pinProtectionEnabled: pinProtectionChoice });
    } catch { /* non-blocking */ }
    try {
      await SharedPrefsModule.putString('user_consented_background_service', 'true');
    } catch { /* non-fatal */ }
    router.replace('/user-profile');
  };

  const advanceStep = () => {
    setExpandedId(null);
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const requiredPerms = PERMISSIONS.filter((p) => !p.optional);
  const optionalPerms = PERMISSIONS.filter((p) => p.optional);
  const reqGranted = requiredPerms.filter((p) => statuses[p.id] === 'granted').length;
  const allRequiredGranted = reqGranted === requiredPerms.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>

      {/* ── Step indicator ──────────────────────────────────────────── */}
      <View style={[styles.stepBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {([1, 2, 3] as const).map((n) => (
          <View key={n} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                step === n && { backgroundColor: COLORS.primary },
                step > n && { backgroundColor: COLORS.green },
                step < n && { backgroundColor: theme.border },
              ]}
            >
              {step > n
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[styles.stepDotText, { color: step === n ? '#fff' : theme.muted }]}>{n}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, { color: step === n ? theme.text : theme.muted }]}>
              {n === 1 ? 'Permissions' : n === 2 ? 'Optional' : 'Get Started'}
            </Text>
          </View>
        ))}
        <View style={[styles.stepConnector, { backgroundColor: theme.border, left: '33%' }]} />
        <View style={[styles.stepConnector, { backgroundColor: theme.border, left: '66%' }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══════════════════════════════════════════════════════════════
            STEP 1 — Required permissions
        ══════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <Ionicons name="shield-checkmark" size={38} color="#fff" />
              </View>
              <Text style={[styles.appName, { color: theme.text }]}>FocusFlow</Text>
              <Text style={[styles.tagline, { color: theme.muted }]}>Your discipline operating system</Text>
            </View>

            {/* Restricted-settings banner */}
            <View style={{ marginBottom: SPACING.xs }}>
              <RestrictedSettingsBanner />
            </View>

            {/* Why banner */}
            <View style={[styles.infoBanner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '33' }]}>
              <View style={[styles.bannerIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.bannerText}>
                <Text style={[styles.bannerTitle, { color: COLORS.primary }]}>Why these permissions?</Text>
                <Text style={[styles.bannerBody, { color: COLORS.primary + 'cc' }]}>
                  FocusFlow enforces focus at the system level — not just reminders.
                  To actually block apps and keep your session running, Android requires
                  special access that regular apps don't need.
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: theme.muted }]}>Permissions granted</Text>
                <Text style={[styles.progressCount, allRequiredGranted && styles.progressCountDone]}>
                  {reqGranted} / {requiredPerms.length}
                </Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(reqGranted / requiredPerms.length) * 100}%` as any,
                      backgroundColor: allRequiredGranted ? COLORS.green : COLORS.primary,
                    },
                  ]}
                />
              </View>
              {allRequiredGranted && (
                <Text style={styles.allSetText}>All required permissions granted — blocking is fully active.</Text>
              )}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.muted }]}>REQUIRED — TAP A CARD TO SEE DETAILS</Text>

            {requiredPerms.map((perm) => (
              <PermCard
                key={perm.id}
                perm={perm}
                status={statuses[perm.id] ?? 'unknown'}
                isExpanded={expandedId === perm.id}
                isLoading={actionLoading === perm.id}
                onToggleExpand={() => setExpandedId(expandedId === perm.id ? null : perm.id)}
                onGrant={() => handleGrant(perm)}
                theme={theme}
                showOptionalBadge={false}
              />
            ))}

            {!allRequiredGranted && (
              <View style={[styles.manageTip, { backgroundColor: COLORS.primary + '0E', borderColor: COLORS.primary + '33' }]}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                <Text style={[styles.manageTipText, { color: theme.muted }]}>
                  Missing permissions can be fixed anytime in{' '}
                  <Text style={styles.manageTipHighlight}>Settings → Permissions</Text>
                  {' '}where you'll also find troubleshooting help.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: allRequiredGranted ? COLORS.primary : COLORS.primary + 'AA' }]}
              onPress={advanceStep}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>
                {allRequiredGranted ? 'Continue →' : 'Continue anyway →'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.footerNote, { color: theme.muted }]}>
              All permissions can be managed in Settings at any time.
            </Text>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 2 — Optional permissions
        ══════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: theme.text }]}>Optional Enhancements</Text>
              <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
                These unlock extra features but are not required for core blocking to work.
              </Text>
            </View>

            {optionalPerms.map((perm) => (
              <PermCard
                key={perm.id}
                perm={perm}
                status={statuses[perm.id] ?? 'unknown'}
                isExpanded={expandedId === perm.id}
                isLoading={actionLoading === perm.id}
                onToggleExpand={() => setExpandedId(expandedId === perm.id ? null : perm.id)}
                onGrant={() => handleGrant(perm)}
                theme={theme}
                showOptionalBadge
              />
            ))}

            <View style={[styles.manageTip, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.green} />
              <Text style={[styles.manageTipText, { color: theme.muted }]}>
                You can enable any of these later in{' '}
                <Text style={styles.manageTipHighlight}>Settings → Permissions</Text>.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: COLORS.primary }]}
              onPress={advanceStep}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 3 — How to use + PIN
        ══════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: theme.text }]}>How FocusFlow Works</Text>
              <Text style={[styles.stepSubtitle, { color: theme.muted }]}>
                A quick tour of the tools you now have access to.
              </Text>
            </View>

            {HOW_TO_SECTIONS.map((s) => (
              <View
                key={s.title}
                style={[styles.howToCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={[styles.howToIcon, { backgroundColor: s.color + '18' }]}>
                  <Ionicons name={s.icon} size={20} color={s.color} />
                </View>
                <View style={styles.howToBody}>
                  <Text style={[styles.howToTitle, { color: theme.text }]}>{s.title}</Text>
                  <Text style={[styles.howToTip, { color: theme.muted }]}>{s.tip}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.howToMoreBtn, { borderColor: COLORS.primary + '55' }]}
              onPress={() => router.push('/how-to-use')}
              activeOpacity={0.8}
            >
              <Ionicons name="book-outline" size={15} color={COLORS.primary} />
              <Text style={[styles.howToMoreText, { color: COLORS.primary }]}>Read the full guide</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>

            {/* ── PIN Protection preference ─────────────────────────── */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.muted }]}>SECURITY</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.pinCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.pinCardMain}>
                <View style={[styles.pinCardIcon, { backgroundColor: COLORS.primary + '1A' }]}>
                  <Ionicons name="lock-closed-outline" size={22} color={COLORS.primary} />
                </View>
                <View style={styles.pinCardBody}>
                  <Text style={[styles.pinCardTitle, { color: theme.text }]}>PIN Protection</Text>
                  <Text style={[styles.pinCardDesc, { color: theme.muted }]}>
                    Require a password to disable block enforcement toggles. Prevents impulsive self-sabotage mid-session.
                  </Text>
                </View>
                <Switch
                  value={pinProtectionChoice}
                  onValueChange={setPinProtectionChoice}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
                  thumbColor={pinProtectionChoice ? COLORS.primary : COLORS.muted}
                />
              </View>

              {pinProtectionChoice && defensePinSet && (
                <View style={[styles.pinCardHint, { backgroundColor: COLORS.green + '12', borderTopColor: theme.border }]}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.green} />
                  <Text style={[styles.pinCardHintText, { color: COLORS.green }]}>
                    Defense Password set — your protections are locked.
                  </Text>
                </View>
              )}

              {pinProtectionChoice && !defensePinSet && (
                <View style={[styles.pinCardHint, { backgroundColor: COLORS.primary + '0D', borderTopColor: theme.border }]}>
                  <View style={{ flex: 1, gap: SPACING.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs }}>
                      <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} style={{ marginTop: 1 }} />
                      <Text style={[styles.pinCardHintText, { color: theme.muted, flex: 1 }]}>
                        Set your Defense Password now — or add it later in Block Enforcement.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.setPinBtn}
                      onPress={() => setPinSetupVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="key-outline" size={14} color="#fff" />
                      <Text style={styles.setPinBtnText}>Set Password Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!pinProtectionChoice && (
                <View style={[styles.pinCardHint, { backgroundColor: theme.border + '33', borderTopColor: theme.border }]}>
                  <Ionicons name="information-circle-outline" size={14} color={theme.muted} />
                  <Text style={[styles.pinCardHintText, { color: theme.muted }]}>
                    You can enable this anytime in Settings → PIN Protection or Block Enforcement.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: COLORS.primary }]}
              onPress={handleFinish}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Enter FocusFlow →</Text>
            </TouchableOpacity>

            <Text style={[styles.footerNote, { color: theme.muted }]}>
              All settings can be changed at any time from the app.
            </Text>
          </>
        )}

      </ScrollView>

      <PinSetupModal
        visible={pinSetupVisible}
        pinType="defense"
        onSaved={() => {
          setPinSetupVisible(false);
          setDefensePinSet(true);
        }}
        onCancel={() => setPinSetupVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── PermCard sub-component ─────────────────────────────────────────────────────

function PermCard({
  perm,
  status,
  isExpanded,
  isLoading,
  onToggleExpand,
  onGrant,
  theme,
  showOptionalBadge,
}: {
  perm: PermItem;
  status: PermStatus;
  isExpanded: boolean;
  isLoading: boolean;
  onToggleExpand: () => void;
  onGrant: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  showOptionalBadge: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        status === 'granted' && styles.cardGranted,
      ]}
    >
      <TouchableOpacity style={styles.cardMain} onPress={onToggleExpand} activeOpacity={0.75}>
        <View style={[styles.iconWrap, { backgroundColor: statusColor(status) + '22' }]}>
          <Ionicons name={perm.icon} size={22} color={statusColor(status)} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{perm.title}</Text>
            {showOptionalBadge && (
              <View style={[badge.wrap, { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary + '33', marginRight: 2 }]}>
                <Text style={[badge.text, { color: COLORS.primary }]}>Optional</Text>
              </View>
            )}
            <StatusBadge status={status} />
          </View>
          <Text style={[styles.cardDesc, { color: theme.muted }]} numberOfLines={isExpanded ? undefined : 2}>
            {perm.description}
          </Text>
        </View>

        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.muted} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.expandedSection, { backgroundColor: theme.surface ?? theme.background, borderTopColor: theme.border }]}>
          <View style={styles.whyBox}>
            <Ionicons name="bulb-outline" size={14} color={COLORS.orange} />
            <Text style={styles.whyText}>{perm.whyNeeded}</Text>
          </View>

          {status !== 'granted' && (
            <View style={styles.brokenSection}>
              <Text style={[styles.brokenTitle, { color: theme.text }]}>Without this permission:</Text>
              {perm.brokenWithout.map((item, i) => (
                <View key={i} style={styles.brokenRow}>
                  <Ionicons name="close-circle" size={14} color={COLORS.red} />
                  <Text style={[styles.brokenText, { color: theme.muted }]}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {status !== 'granted' && (
            <TouchableOpacity style={styles.grantBtn} onPress={onGrant} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="open-outline" size={14} color="#fff" />
                  <Text style={styles.grantBtnText}>{perm.deepLinkLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: PermStatus): string {
  if (status === 'granted') return COLORS.green;
  if (status === 'denied') return COLORS.red;
  return COLORS.muted;
}

function StatusBadge({ status }: { status: PermStatus }) {
  const label = status === 'granted' ? 'Granted' : status === 'denied' ? 'Missing' : 'Checking…';
  const color = statusColor(status);
  return (
    <View style={[badge.wrap, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[badge.text, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const badge = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  text: { fontSize: FONT.xs, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: 56, gap: SPACING.md },

  // Step indicator bar
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  stepItem: { alignItems: 'center', gap: 4, zIndex: 1 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { fontSize: FONT.xs, fontWeight: '800' },
  stepLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  stepConnector: {
    position: 'absolute',
    top: '40%',
    width: 1,
    height: 26,
  },

  // Header (step 1)
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  appName: { fontSize: FONT.xxl + 4, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: FONT.sm, textAlign: 'center' },

  // Step header (steps 2 & 3)
  stepHeader: { paddingTop: SPACING.sm, gap: 4 },
  stepTitle: { fontSize: FONT.xl, fontWeight: '900' },
  stepSubtitle: { fontSize: FONT.sm, lineHeight: 20 },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
  },
  bannerIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerText: { flex: 1, gap: 4 },
  bannerTitle: { fontSize: FONT.sm, fontWeight: '800' },
  bannerBody: { fontSize: FONT.xs, lineHeight: 17 },

  // Progress
  progressSection: { gap: SPACING.xs },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: FONT.xs, fontWeight: '600' },
  progressCount: { fontSize: FONT.xs, fontWeight: '800', color: COLORS.primary },
  progressCountDone: { color: COLORS.green },
  progressBar: { height: 6, borderRadius: RADIUS.full, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: RADIUS.full },
  allSetText: { fontSize: FONT.xs, color: COLORS.green, fontWeight: '600', textAlign: 'center', marginTop: 2 },

  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1 },

  // Permission cards
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardGranted: { borderColor: COLORS.green + '55' },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, gap: SPACING.md },
  iconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  cardBody: { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  cardTitle: { fontSize: FONT.md, fontWeight: '700' },
  cardDesc: { fontSize: FONT.xs, lineHeight: 17 },

  expandedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  whyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.orange + '15',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  whyText: { flex: 1, fontSize: FONT.xs, color: COLORS.orange, lineHeight: 17, fontWeight: '600' },
  brokenSection: { gap: 6 },
  brokenTitle: { fontSize: FONT.xs, fontWeight: '700', marginBottom: 2 },
  brokenRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  brokenText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  grantBtnText: { fontSize: FONT.xs, fontWeight: '700', color: '#fff' },

  // Manage tip
  manageTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  manageTipText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },
  manageTipHighlight: { color: COLORS.primary, fontWeight: '700' },

  // How-to cards (step 3)
  howToCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  howToIcon: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  howToBody: { flex: 1, gap: 3 },
  howToTitle: { fontSize: FONT.sm, fontWeight: '700' },
  howToTip: { fontSize: FONT.xs, lineHeight: 17 },

  howToMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  howToMoreText: { fontSize: FONT.sm, fontWeight: '600' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1 },

  // PIN card
  pinCard: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  pinCardMain: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
  pinCardIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pinCardBody: { flex: 1, gap: 3 },
  pinCardTitle: { fontSize: FONT.md, fontWeight: '700' },
  pinCardDesc: { fontSize: FONT.xs, lineHeight: 17 },
  pinCardHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pinCardHintText: { flex: 1, fontSize: FONT.xs, lineHeight: 16 },
  setPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  setPinBtnText: { fontSize: FONT.xs, fontWeight: '700', color: '#fff' },

  // Continue / finish button
  continueBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  continueBtnText: { fontSize: FONT.md, fontWeight: '800', color: '#fff' },

  footerNote: { fontSize: FONT.xs, textAlign: 'center' },
});
