import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { DailyAllowanceModal } from '@/components/DailyAllowanceModal';
import { GreyoutScheduleModal } from '@/components/GreyoutScheduleModal';
import { ActiveHeaderButton } from '@/components/ActiveHeaderButton';
import { PinSetupModal } from '@/components/PinSetupModal';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { PinRotationModal } from '@/components/PinRotationModal';
import { VpnConsentModal } from '@/components/VpnConsentModal';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import { NetworkBlockModule } from '@/native-modules/NetworkBlockModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavPress } from '@/hooks/useNavPress';

type DefenseAction = (defensePinHash?: string) => void;
const DEFENSE_HINT_DISMISSED_KEY = '@focusflow/defenseHintDismissed';
const DEFENSE_HELP_DISMISSED_KEY = '@focusflow/defenseHelpDismissed';

function DefenseScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, updateSettings, setDailyAllowanceEntries } = useApp();
  const { settings } = state;
  const activeBlock = state.focusSession?.isActive === true || isStandaloneActive(settings);

  const [dailyAllowanceVisible, setDailyAllowanceVisible] = useState(false);
  const [greyoutScheduleVisible, setGreyoutScheduleVisible] = useState(false);
  const [pinModal, setPinModal] = useState<
    | { type: 'none' }
    | { type: 'verify'; title: string; description: string; action: DefenseAction }
    | { type: 'setup'; action: DefenseAction }
  >({ type: 'none' });
  const [showDefenseHint, setShowDefenseHint] = useState(false);
  const [showDefenseHelp, setShowDefenseHelp] = useState(false);
  const [alwaysOnPinRotationVisible, setAlwaysOnPinRotationVisible] = useState(false);
  const [vpnConsentVisible, setVpnConsentVisible] = useState(false);
  const [protectionNotice, setProtectionNotice] = useState<string | null>(null);
  const vpnConsentResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const pendingSetupAction = useRef<DefenseAction | null>(null);
  const protectionNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navAlwaysOn = useNavPress('/always-on');
  const navKeyword = useNavPress('/keyword-blocker');
  const navVpn = useNavPress('/vpn-block-list');
  const navPassword = useNavPress('/password-protection');
  const navHowToUse = useNavPress('/how-to-use');
  const navLauncher = useNavPress('/home-launcher');

  React.useEffect(() => {
    void AsyncStorage.getItem(DEFENSE_HINT_DISMISSED_KEY).then((dismissed) => {
      if (!dismissed) setShowDefenseHint(true);
    });
    void AsyncStorage.getItem(DEFENSE_HELP_DISMISSED_KEY).then((dismissed) => {
      if (!dismissed) setShowDefenseHelp(true);
    });
    return () => {
      if (protectionNoticeTimer.current) clearTimeout(protectionNoticeTimer.current);
    };
  }, []);

  const showProtectionNotice = useCallback((message: string) => {
    setProtectionNotice(message);
    if (protectionNoticeTimer.current) clearTimeout(protectionNoticeTimer.current);
    protectionNoticeTimer.current = setTimeout(() => {
      setProtectionNotice(null);
      protectionNoticeTimer.current = null;
    }, 4500);
  }, []);

  const dismissDefenseHint = useCallback(() => {
    setShowDefenseHint(false);
    void AsyncStorage.setItem(DEFENSE_HINT_DISMISSED_KEY, '1');
  }, []);

  const update = useCallback(
    async (partial: Partial<typeof settings>, defensePinHash: string | null = null) => {
      try {
        await updateSettings({ ...settings, ...partial }, { defensePinHash });
      } catch {
        Alert.alert('Save failed', 'Could not save this defense setting. Please try again.');
      }
    },
    [settings, updateSettings],
  );

  const requireDefensePin = useCallback(
    (title: string, description: string, action: DefenseAction) => {
      void SharedPrefsModule.getString('defense_pin_hash')
        .then((hash) => {
          if (hash) {
            setPinModal({ type: 'verify', title, description, action });
            return;
          }
          if (settings.pinProtectionEnabled ?? false) {
            Alert.alert(
              'No Defense Password set',
              'PIN protection is enabled but no Defense Password has been set yet.',
              [
                {
                  text: 'Set Password',
                  onPress: () => {
                    pendingSetupAction.current = action;
                    setPinModal({ type: 'setup', action });
                  },
                },
                { text: 'Proceed anyway', onPress: () => action() },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
            return;
          }
          action();
        })
        .catch(() => action());
    },
    [settings.pinProtectionEnabled],
  );

  const toggleProtectedSetting = (
    key:
      | 'systemGuardEnabled'
      | 'blockYoutubeShortsEnabled'
      | 'blockInstagramReelsEnabled'
      | 'vpnBlockEnabled'
      | 'vpnSelfHealEnabled'
      | 'launcherLockDuringStandalone'
      | 'launcherBlockUninstall'
      | 'aversionDimmerEnabled'
      | 'aversionVibrateEnabled'
      | 'aversionSoundEnabled',
    enabled: boolean,
    label: string,
  ) => {
    if (enabled) {
      void update({ [key]: true });
      return;
    }
    if (state.focusSession?.isActive || isStandaloneActive(settings)) {
      showProtectionNotice(`${label} can't be turned off while a Focus session or Standalone block is running.`);
      return;
    }
    requireDefensePin(`Disable ${label}`, `Enter your defense password to turn off ${label}.`, (hash) => {
      void update({ [key]: false }, hash ?? null);
    });
  };

  const showVpnConsent = (): Promise<boolean> =>
    new Promise((resolve) => {
      vpnConsentResolveRef.current = resolve;
      setVpnConsentVisible(true);
    });

  const handleVpnToggle = async (enabled: boolean) => {
    if (!enabled && activeBlock) {
      showProtectionNotice('Network Protection can\'t be turned off while a Focus session or Standalone block is running.');
      return;
    }
    if (!enabled) {
      requireDefensePin(
        'Disable Network Protection',
        'Enter your Defense Password to turn off VPN blocking.',
        (defensePinHash) => void update({ vpnBlockEnabled: false }, defensePinHash ?? null),
      );
      return;
    }

    const consented = await showVpnConsent();
    if (!consented) return;
    if (Platform.OS === 'android') {
      try {
        const conflicting = await NetworkBlockModule.isAnotherVpnActive();
        if (conflicting) {
          const takeOver = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Another VPN is active',
              'Android only allows one VPN at a time. FocusFlow will temporarily take over while your block runs. You will need to reconnect your other VPN afterwards.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Take over', onPress: () => resolve(true) },
              ],
            );
          });
          if (!takeOver) return;
        }
        if (!(await NetworkBlockModule.isVpnPermissionGranted())) {
          await NetworkBlockModule.requestVpnPermission();
        }
      } catch {}
    }
    void update({ vpnBlockEnabled: true });
  };

  if (!state.isDbReady) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <Header theme={theme} />
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: theme.muted }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const alwaysOnCount = (settings.alwaysOnPackages ?? []).length;
  const allowanceCount = (settings.dailyAllowanceEntries ?? []).length;
  const alwaysOnEnabled = settings.alwaysOnEnforcementEnabled ?? false;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header theme={theme} />
      {showDefenseHint && (
        <View style={[styles.hintBanner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '35' }]}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={[styles.hintText, { color: theme.text }]}>
            Password Protection has its own page below the blocking tools, so your security settings stay easy to find.
          </Text>
          <TouchableOpacity
            onPress={dismissDefenseHint}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Defense hint"
            hitSlop={8}
          >
            <Ionicons name="close" size={19} color={theme.muted} />
          </TouchableOpacity>
        </View>
      )}
      {showDefenseHelp && (
        <View style={[styles.helpBanner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '35' }]}>
          <Ionicons name="help-circle-outline" size={20} color={COLORS.primary} />
          <View style={styles.helpBannerCopy}>
            <Text style={[styles.helpBannerTitle, { color: theme.text }]}>Not sure what to do?</Text>
            <Text style={[styles.helpBannerText, { color: theme.muted }]}>
              Start with Focus to schedule a task, or open How to Use for a quick walkthrough of blocking and protection.
            </Text>
            <TouchableOpacity
              onPress={navHowToUse.onPress}
              disabled={navHowToUse.loading}
              style={[styles.helpBannerAction, navHowToUse.loading && { opacity: 0.6 }]}
              activeOpacity={0.75}
            >
              <Text style={[styles.helpBannerActionText, { color: COLORS.primary }]}>Open How to Use</Text>
              {navHowToUse.loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              setShowDefenseHelp(false);
              void AsyncStorage.setItem(DEFENSE_HELP_DISMISSED_KEY, '1');
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Defense help"
            hitSlop={8}
          >
            <Ionicons name="close" size={19} color={theme.muted} />
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 70 + insets.bottom }]}
      >
        <Section title="Always-On Blocking" theme={theme}>
          <SettingRow
            label="Always-On Enforcement"
            description={
              alwaysOnEnabled
                ? `${alwaysOnCount} app${alwaysOnCount === 1 ? '' : 's'} blocked around the clock`
                : 'Keep selected apps blocked 24/7'
            }
            theme={theme}
          >
            <Switch
              value={alwaysOnEnabled}
              onValueChange={(enabled) => {
                if (enabled) {
                  void update({ alwaysOnEnforcementEnabled: true });
                } else {
                    if (activeBlock) {
                      showProtectionNotice('Always-On Enforcement can\'t be turned off while a Focus session or Standalone block is running.');
                      return;
                    }
                  requireDefensePin(
                    'Disable Always-On Enforcement',
                    'Enter your defense password to turn off always-on protection.',
                    (hash) => {
                      void update({ alwaysOnEnforcementEnabled: false }, hash ?? null);
                      setAlwaysOnPinRotationVisible(true);
                    },
                  );
                }
              }}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={alwaysOnEnabled ? COLORS.primary : theme.muted}
            />
          </SettingRow>
          <SettingButton
            icon="apps-outline"
            label="Manage Always-On App List"
            description={
              alwaysOnCount === 0
                ? 'Choose apps that should stay blocked'
                : `${alwaysOnCount} app${alwaysOnCount === 1 ? '' : 's'} selected`
            }
            onPress={navAlwaysOn.onPress}
            loading={navAlwaysOn.loading}
            theme={theme}
          />
          <SettingButton
            icon="sunny-outline"
            label="Daily Allowance"
            description={
              allowanceCount === 0
                ? 'Set daily count, time, or interval limits per app'
                : `${allowanceCount} app${allowanceCount === 1 ? '' : 's'} configured`
            }
            onPress={() => requestAnimationFrame(() => setDailyAllowanceVisible(true))}
            theme={theme}
          />
        </Section>

        <Section title="Defense Tools" theme={theme}>
          <SettingButton
            icon="text-outline"
            label="Keyword Blocker"
            description="Block keywords in URLs, searches, and on-screen text"
            onPress={navKeyword.onPress}
            loading={navKeyword.loading}
            theme={theme}
          />
          {/* UI label only: this is the existing Greyout Block feature, renamed
              to Scheduled Blocks. Keep greyoutSchedule and its modal unchanged. */}
          <SettingButton
            icon="time-outline"
            label="Scheduled Blocks"
            description="Manage recurring time-window blocks (formerly Greyout Block)"
            onPress={() =>
              requireDefensePin(
                'Manage Scheduled Blocks',
                'Enter your defense password to add, edit, or remove schedule batches.',
                () => requestAnimationFrame(() => setGreyoutScheduleVisible(true)),
              )
            }
            theme={theme}
          />
          <SettingButton
            icon="list-outline"
            label="Manage VPN App List"
            description="Choose which apps should have internet access blocked"
            onPress={navVpn.onPress}
            loading={navVpn.loading}
            theme={theme}
          />
          <SettingButton
            icon="shield-half-outline"
            label="PIN Protection"
            description={
              settings.pinProtectionEnabled
                ? 'Defense password required before disabling protection'
                : 'Require a password before protections can be disabled'
            }
            onPress={navPassword.onPress}
            loading={navPassword.loading}
            theme={theme}
          />
        </Section>

        <Section title="System Guard" theme={theme}>
          <ProtectedToggle
            label="Protect system controls"
            description="Block power menu, notification shade, and sensitive Settings pages"
            value={settings.systemGuardEnabled ?? false}
            onValueChange={(value) => toggleProtectedSetting('systemGuardEnabled', value, 'System Guard')}
            theme={theme}
          />
          <ProtectedToggle
            label="Block YouTube Shorts"
            description="Redirect away from the Shorts player"
            value={settings.blockYoutubeShortsEnabled ?? false}
            onValueChange={(value) => toggleProtectedSetting('blockYoutubeShortsEnabled', value, 'YouTube Shorts protection')}
            theme={theme}
          />
          <ProtectedToggle
            label="Block Instagram Reels"
            description="Redirect away from the Reels viewer"
            value={settings.blockInstagramReelsEnabled ?? false}
            onValueChange={(value) => toggleProtectedSetting('blockInstagramReelsEnabled', value, 'Instagram Reels protection')}
            theme={theme}
          />
        </Section>

        <Section title="Aversion Deterrents" theme={theme}>
          <ProtectedToggle
            label="Screen Dimmer"
            description="Show a near-black overlay when a blocked app is open"
            value={settings.aversionDimmerEnabled}
            onValueChange={(value) => toggleProtectedSetting('aversionDimmerEnabled', value, 'Screen Dimmer')}
            theme={theme}
          />
          <ProtectedToggle
            label="Vibration Harassment"
            description="Pulse vibration while a blocked app is in the foreground"
            value={settings.aversionVibrateEnabled}
            onValueChange={(value) => toggleProtectedSetting('aversionVibrateEnabled', value, 'Vibration Harassment')}
            theme={theme}
          />
          <ProtectedToggle
            label="Sound Alert"
            description="Play an alert when a blocked app launches"
            value={settings.aversionSoundEnabled}
            onValueChange={(value) => toggleProtectedSetting('aversionSoundEnabled', value, 'Sound Alert')}
            theme={theme}
          />
        </Section>

        <Section title="Focus Session Behaviour" theme={theme}>
          <SettingRow
            label="Keep focus active for the full duration"
            description={
              settings.keepFocusActiveUntilTaskEnd
                ? 'On — completing a task early keeps app-blocking running until the original end time'
                : 'Off — completing a task immediately ends the focus session (default)'
            }
            theme={theme}
          >
            <Switch
              value={settings.keepFocusActiveUntilTaskEnd ?? false}
              onValueChange={(value) => void update({ keepFocusActiveUntilTaskEnd: value })}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={settings.keepFocusActiveUntilTaskEnd ? COLORS.primary : theme.muted}
            />
          </SettingRow>
        </Section>

        <Section title="Network Protection" theme={theme}>
          <SettingRow
            label="Network Blocking (VPN)"
            description="Cut internet access for selected apps through FocusFlow’s local VPN"
            theme={theme}
          >
            <Switch
              value={settings.vpnBlockEnabled ?? false}
              onValueChange={(value) => void handleVpnToggle(value)}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={settings.vpnBlockEnabled ? COLORS.primary : theme.muted}
            />
          </SettingRow>
          <SettingRow
            label="VPN Self-Healing"
            description="Restart the VPN if it disconnects during an active block"
            theme={theme}
          >
            <Switch
              value={settings.vpnSelfHealEnabled ?? false}
              onValueChange={(value) => toggleProtectedSetting('vpnSelfHealEnabled', value, 'VPN Self-Healing')}
              disabled={!(settings.vpnBlockEnabled ?? false)}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={settings.vpnSelfHealEnabled ? COLORS.primary : theme.muted}
            />
          </SettingRow>
          <SettingRow
            label="Mirror Focus blocking to VPN"
            description="Also block internet for apps blocked by Focus during an active session"
            theme={theme}
          >
            <Switch
              value={settings.focusMirrorVpnEnabled ?? false}
              onValueChange={(value) => void update({ focusMirrorVpnEnabled: value })}
              disabled={!(settings.vpnBlockEnabled ?? false)}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={settings.focusMirrorVpnEnabled ? COLORS.primary : theme.muted}
            />
          </SettingRow>
        </Section>

        <Section title="Home Launcher" theme={theme}>
          <SettingRow
            label="Lock launcher during standalone block"
            description="Prevent switching away from FocusFlow Launcher during a Standalone block"
            theme={theme}
          >
            <Switch
              value={settings.launcherLockDuringStandalone ?? true}
              onValueChange={(value) => {
                if (!value && isStandaloneActive(settings)) {
                  showProtectionNotice('Home Launcher can\'t be turned off while a Standalone block is running.');
                  return;
                }
                void update({ launcherLockDuringStandalone: value });
              }}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={settings.launcherLockDuringStandalone !== false ? COLORS.primary : theme.muted}
            />
          </SettingRow>
          <SettingRow
            label="Block uninstall from launcher long-press"
            description="Hide Uninstall from the launcher long-press menu"
            theme={theme}
          >
            <Switch
              value={settings.launcherBlockUninstall ?? false}
              onValueChange={(value) => {
                if (!value && activeBlock) {
                  showProtectionNotice('Uninstall protection can\'t be turned off while a Focus session or Standalone block is running.');
                  return;
                }
                void update({ launcherBlockUninstall: value });
              }}
              trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
              thumbColor={settings.launcherBlockUninstall ? COLORS.primary : theme.muted}
            />
          </SettingRow>
          <SettingButton
            icon="home-outline"
            label="Configure Home Launcher"
            description="Choose pinned apps, hidden apps, wallpaper, and clock style"
            onPress={() => {
              if (isStandaloneActive(settings)) {
                showProtectionNotice('Home Launcher settings are unavailable while a Standalone block is running.');
                return;
              }
              navLauncher.onPress();
            }}
            theme={theme}
          />
        </Section>
      </ScrollView>

      <DailyAllowanceModal
        visible={dailyAllowanceVisible}
        selectedEntries={settings.dailyAllowanceEntries ?? []}
        locked={isStandaloneActive(settings)}
        requireDefensePin
        onSave={async (entries) => {
          await setDailyAllowanceEntries(entries);
          setDailyAllowanceVisible(false);
        }}
        onClose={() => setDailyAllowanceVisible(false)}
      />

      <GreyoutScheduleModal
        visible={greyoutScheduleVisible}
        windows={settings.greyoutSchedule ?? []}
        standaloneActive={isStandaloneActive(settings)}
        onSave={async (windows) => {
          await update({ greyoutSchedule: windows });
          setGreyoutScheduleVisible(false);
        }}
        onClose={() => setGreyoutScheduleVisible(false)}
      />

      <PinVerifyModal
        visible={pinModal.type === 'verify'}
        pinType="defense"
        title={pinModal.type === 'verify' ? pinModal.title : undefined}
        description={pinModal.type === 'verify' ? pinModal.description : undefined}
        onVerified={(hash) => {
          if (pinModal.type !== 'verify') return;
          const action = pinModal.action;
          setPinModal({ type: 'none' });
          action(hash);
        }}
        onCancel={() => setPinModal({ type: 'none' })}
      />
      <PinSetupModal
        visible={pinModal.type === 'setup'}
        pinType="defense"
        onSaved={() => {
          const action = pendingSetupAction.current;
          pendingSetupAction.current = null;
          setPinModal({ type: 'none' });
          action?.();
        }}
        onCancel={() => {
          pendingSetupAction.current = null;
          setPinModal({ type: 'none' });
        }}
      />
      <PinRotationModal
        visible={alwaysOnPinRotationVisible}
        pinType="defense"
        reuseTrackerKey="alwayson"
        actionLabel="Update Always-On Password"
        actionDescription="Always-On Enforcement has been paused. Set the password that will be required next time you change this setting."
        onComplete={() => setAlwaysOnPinRotationVisible(false)}
        onCancel={() => setAlwaysOnPinRotationVisible(false)}
      />
      <VpnConsentModal
        visible={vpnConsentVisible}
        onConfirm={() => {
          setVpnConsentVisible(false);
          vpnConsentResolveRef.current?.(true);
          vpnConsentResolveRef.current = null;
        }}
        onCancel={() => {
          setVpnConsentVisible(false);
          vpnConsentResolveRef.current?.(false);
          vpnConsentResolveRef.current = null;
        }}
      />
      {protectionNotice && (
        <View
          style={[styles.protectionNotice, { bottom: insets.bottom + 76 }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Ionicons name="lock-closed-outline" size={17} color="#fff" />
          <Text style={styles.protectionNoticeText}>{protectionNotice}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function isStandaloneActive(settings: { standaloneBlockUntil: string | null; standaloneBlockPackages?: string[] }) {
  return Boolean(
    settings.standaloneBlockUntil &&
      (settings.standaloneBlockPackages ?? []).length > 0 &&
      new Date(settings.standaloneBlockUntil).getTime() > Date.now(),
  );
}

function Header({ theme }: { theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={[styles.headerIcon, { backgroundColor: COLORS.primary + '18' }]}>
        <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
      </View>
      <View style={styles.headerText}>
        <Text style={[styles.title, { color: theme.text }]}>Defense</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Make distractions harder to reach</Text>
      </View>
        <ActiveHeaderButton />
    </View>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>['theme'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function SettingRow({
  label,
  description,
  theme,
  children,
}: {
  label: string;
  description: string;
  theme: ReturnType<typeof useTheme>['theme'];
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

function ProtectedToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  theme,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <SettingRow label={label} description={description} theme={theme}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
        thumbColor={value ? COLORS.primary : theme.muted}
      />
    </SettingRow>
  );
}

function SettingButton({
  icon,
  label,
  description,
  onPress,
  loading = false,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  loading?: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <TouchableOpacity
      style={[styles.button, { borderBottomColor: theme.border }, loading && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.muted} />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={theme.muted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  hintBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  hintText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },
  helpBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  helpBannerCopy: { flex: 1, gap: 3 },
  helpBannerTitle: { fontSize: FONT.sm, fontWeight: '800' },
  helpBannerText: { fontSize: FONT.xs, lineHeight: 17 },
  helpBannerAction: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', marginTop: 2 },
  helpBannerActionText: { fontSize: FONT.xs, fontWeight: '800' },
  protectionNotice: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: '#3f3f46',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  protectionNoticeText: {
    flex: 1,
    color: '#fff',
    fontSize: FONT.xs,
    lineHeight: 17,
    fontWeight: '600',
  },
  header: {
    minHeight: 76,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: FONT.xl, fontWeight: '700' },
  subtitle: { fontSize: FONT.sm, marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: FONT.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  card: { borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  row: {
    minHeight: 70,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: 70,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, marginRight: SPACING.sm },
  label: { fontSize: FONT.md, fontWeight: '600' },
  description: { fontSize: FONT.xs, lineHeight: 17, marginTop: 3 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FONT.md },
});

export default withScreenErrorBoundary(DefenseScreen, 'Defense');