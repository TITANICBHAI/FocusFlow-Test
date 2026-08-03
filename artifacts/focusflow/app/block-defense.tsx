/**
 * block-defense.tsx
 *
 * "Block Enforcement" screen — groups the tools that make blocks impossible to bypass.
 * Accessible from the Side Menu. Opens with an optional `tab` query param:
 *   /block-defense?tab=keywords   → scroll to Keyword Blocker
 *   /block-defense?tab=system     → scroll to System Protection
 *   /block-defense?tab=aversion   → scroll to Aversion Deterrents
 *   /block-defense?tab=greyout    → scroll to Greyout Schedule
 *
 * PIN Protection section manages both passwords:
 *   Focus Session password — gates ending any focus session (native SessionPinModule)
 *   Defense password       — gates disabling any protection toggle below (JS layer, SharedPrefs)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { NetworkBlockModule } from '@/native-modules/NetworkBlockModule';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { GreyoutScheduleModal } from '@/components/GreyoutScheduleModal';
import { NuclearModeModal } from '@/components/NuclearModeModal';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { PinSetupModal } from '@/components/PinSetupModal';
import { PinRotationModal } from '@/components/PinRotationModal';
import { VpnConsentModal } from '@/components/VpnConsentModal';
import type { GreyoutWindow } from '@/data/types';

type PinModalState =
  | { type: 'none' }
  | {
      type: 'verify';
      pinType: 'focus' | 'defense';
      title: string;
      description: string;
      onVerified: (hash: string) => void;
    }
  | { type: 'setup'; pinType: 'focus' | 'defense' };

export default function BlockDefenseScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { state, updateSettings } = useApp();
  const { settings } = state;
  const params = useLocalSearchParams<{ tab?: string }>();

  const [greyoutModalVisible, setGreyoutModalVisible] = useState(false);
  const [nuclearModeVisible, setNuclearModeVisible] = useState(false);
  const [pinModal, setPinModal] = useState<PinModalState>({ type: 'none' });
  const [focusPinSet, setFocusPinSet] = useState(false);
  const [defensePinSet, setDefensePinSet] = useState(false);
  const [alwaysOnPinRotationVisible, setAlwaysOnPinRotationVisible] = useState(false);
  const [vpnConsentVisible, setVpnConsentVisible] = useState(false);
  // Holds the resolve callback for the VPN consent modal promise
  const vpnConsentResolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const sectionRefs = {
    system: useRef<View>(null),
    aversion: useRef<View>(null),
    greyout: useRef<View>(null),
  };

  const focusActive = state.focusSession?.isActive === true;
  const standaloneActive = (() => {
    if (!settings.standaloneBlockUntil) return false;
    if ((settings.standaloneBlockPackages ?? []).length === 0) return false;
    return new Date(settings.standaloneBlockUntil).getTime() > Date.now();
  })();
  const blockProtectionActive = focusActive || standaloneActive;

  const standalonePkgCount = (settings.standaloneBlockPackages ?? []).length;
  const allowanceEntryCount = (settings.dailyAllowanceEntries ?? []).length;
  const alwaysOnActive = standalonePkgCount > 0 || allowanceEntryCount > 0;

  // Load PIN status on mount and after any PIN change
  const loadPinStatus = useCallback(async () => {
    try {
      const [focusSet, defenseHash] = await Promise.all([
        SessionPinModule.isPinSet(),
        SharedPrefsModule.getString('defense_pin_hash'),
      ]);
      setFocusPinSet(focusSet);
      setDefensePinSet(!!defenseHash);
    } catch {}
  }, []);

  useEffect(() => {
    void loadPinStatus();
  }, [loadPinStatus]);

  useEffect(() => {
    const tab = params.tab;
    if (!tab) return;
    if (tab === 'keywords') {
      router.replace('/keyword-blocker');
      return;
    }
    const timeout = setTimeout(() => {
      const ref = sectionRefs[tab as keyof typeof sectionRefs];
      if (ref?.current) {
        ref.current.measureLayout(
          scrollRef.current as unknown as never,
          (_x: number, y: number) => {
            scrollRef.current?.scrollTo({ y: y - 16, animated: true });
          },
          () => {},
        );
      }
      if (tab === 'greyout') setGreyoutModalVisible(true);
    }, 400);
    return () => clearTimeout(timeout);
  }, [params.tab]);

  const update = async (partial: Partial<typeof settings>) => {
    try {
      await updateSettings({ ...settings, ...partial });
    } catch {
      Alert.alert('Error', 'Failed to save this setting. Please try again.');
    }
  };

  const pendingActionAfterDefenseSetup = useRef<(() => void) | null>(null);

  /**
   * Requires the defense PIN before running `action`.
   *
   * Behaviour matrix:
   *   PIN hash stored                       → always show PinVerifyModal (regardless of pinProtectionEnabled toggle)
   *   pinProtectionEnabled=true, no PIN set → prompt to set a PIN first (or proceed anyway)
   *   pinProtectionEnabled=false, no PIN set → run action immediately
   */
  const requireDefensePin = useCallback(
    (title: string, description: string, action: () => void) => {
      SharedPrefsModule.getString('defense_pin_hash')
        .then((hash) => {
          if (hash) {
            // A defense PIN is configured — always require it, regardless of
            // whether the pinProtectionEnabled toggle is on. If you set a PIN
            // it should always be enforced.
            setPinModal({
              type: 'verify',
              pinType: 'defense',
              title,
              description,
              onVerified: () => action(),
            });
          } else if (settings.pinProtectionEnabled ?? false) {
            // PIN protection is on but no PIN has been set yet — offer to set one.
            Alert.alert(
              'No Defense Password set',
              'PIN protection is enabled but no Defense Password has been set yet. Set one now to protect this toggle, or proceed without a password.',
              [
                {
                  text: 'Set Password',
                  onPress: () => {
                    pendingActionAfterDefenseSetup.current = action;
                    setPinModal({ type: 'setup', pinType: 'defense' });
                  },
                },
                { text: 'Proceed anyway', onPress: () => action() },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          } else {
            // No PIN set and protection toggle is off — run freely.
            action();
          }
        })
        .catch(() => action());
    },
    [settings.pinProtectionEnabled],
  );

  const handleSystemGuardToggle = (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'Cannot disable while Focus Mode or a block is active.');
      return;
    }
    if (!enabled) {
      requireDefensePin(
        'Disable System Protection',
        'Enter your defense password to turn off system protection.',
        () => void update({ systemGuardEnabled: false }),
      );
      return;
    }
    void update({ systemGuardEnabled: true });
  };

  const handleYoutubeToggle = (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'Cannot disable while a block is active.');
      return;
    }
    if (!enabled) {
      requireDefensePin(
        'Disable YouTube Shorts Block',
        'Enter your defense password to turn this off.',
        () => void update({ blockYoutubeShortsEnabled: false }),
      );
      return;
    }
    void update({ blockYoutubeShortsEnabled: true });
  };

  const handleReelsToggle = (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'Cannot disable while a block is active.');
      return;
    }
    if (!enabled) {
      requireDefensePin(
        'Disable Instagram Reels Block',
        'Enter your defense password to turn this off.',
        () => void update({ blockInstagramReelsEnabled: false }),
      );
      return;
    }
    void update({ blockInstagramReelsEnabled: true });
  };

  /** Returns a Promise that resolves true/false from the VPN consent modal. */
  const showVpnConsent = (): Promise<boolean> =>
    new Promise((resolve) => {
      vpnConsentResolveRef.current = resolve;
      setVpnConsentVisible(true);
    });

  const handleVpnToggle = async (enabled: boolean) => {
    if (!enabled && blockProtectionActive) {
      Alert.alert('Protection is active', 'Cannot disable while a block is active.');
      return;
    }
    if (!enabled) {
      requireDefensePin(
        'Disable Network Blocking (VPN)',
        'Enter your defense password to turn off VPN blocking.',
        () => void update({ vpnBlockEnabled: false }),
      );
      return;
    }

    // ── Step 1: plain-language pre-prompt ────────────────────────────────────
    // Show our friendly explanation BEFORE Android's scary "monitor all traffic" dialog.
    const consented = await showVpnConsent();
    if (!consented) return;

    if (Platform.OS === 'android') {
      // ── Step 2: conflict detection ──────────────────────────────────────────
      // Android only allows one active VPN. Warn the user if another VPN is
      // already running so the handover is intentional rather than silent.
      try {
        const conflicting = await NetworkBlockModule.isAnotherVpnActive();
        if (conflicting) {
          const takeOver = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Another VPN is active',
              'Android only allows one VPN at a time. FocusFlow will temporarily take over ' +
                'while your session runs. You will need to reconnect your other VPN afterwards.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Take over', onPress: () => resolve(true) },
              ],
            );
          });
          if (!takeOver) return;
        }
      } catch { /* safe default — proceed */ }

      // ── Step 3: VPN permission ──────────────────────────────────────────────
      // Now launch the system dialog — the user is already informed about what it means.
      try {
        const granted = await NetworkBlockModule.isVpnPermissionGranted();
        if (!granted) await NetworkBlockModule.requestVpnPermission();
      } catch {}
    }

    void update({ vpnBlockEnabled: true });
  };

  const handleAlwaysOnEnforcementToggle = (enabled: boolean) => {
    if (!enabled) {
      requireDefensePin(
        'Disable Always-On Enforcement',
        'Enter your defense password to pause the always-on block list.',
        () => {
          void update({ alwaysOnEnforcementEnabled: false });
          setAlwaysOnPinRotationVisible(true);
        },
      );
      return;
    }
    void update({ alwaysOnEnforcementEnabled: true });

    // After enabling, offer to set a Defense Password if none is set yet.
    // Respects a "Don't ask again" preference stored in SharedPrefs.
    void Promise.all([
      SharedPrefsModule.getString('defense_pin_hash'),
      SharedPrefsModule.getString('always_on_pin_prompt_dismissed'),
    ]).then(([hash, dismissed]) => {
      if (hash || dismissed) return; // already set or user opted out
      Alert.alert(
        'Add a Defense Password?',
        'A Defense Password stops you from disabling protections on impulse. You can set one now or add it anytime in the PIN Protection section below.',
        [
          {
            text: 'Set Password Now',
            onPress: () => setPinModal({ type: 'setup', pinType: 'defense' }),
          },
          { text: 'Not now', style: 'cancel' },
          {
            text: "Don't ask again",
            onPress: () => {
              void SharedPrefsModule.putString('always_on_pin_prompt_dismissed', '1').catch(() => {});
            },
          },
        ],
      );
    }).catch(() => {});
  };

  const handlePinSaved = () => {
    setPinModal({ type: 'none' });
    void loadPinStatus();
    const pending = pendingActionAfterDefenseSetup.current;
    if (pending) {
      pendingActionAfterDefenseSetup.current = null;
      pending();
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={[styles.title, { color: theme.text }]}>Block Enforcement</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            The layers that make your blocks impossible to bypass
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setNuclearModeVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.nuclearBtn, { backgroundColor: COLORS.red + '18' }]}
        >
          <Ionicons name="nuclear-outline" size={16} color={COLORS.red} />
          <Text style={[styles.nuclearBtnText, { color: COLORS.red }]}>Nuclear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
      >
        {/* Nothing blocking hint */}
        {!blockProtectionActive && !alwaysOnActive && (
          <TouchableOpacity
            style={[styles.hintBanner, { backgroundColor: COLORS.primary + '0E', borderColor: COLORS.primary + '33' }]}
            onPress={() => router.push('/active')}
            activeOpacity={0.8}
          >
            <Ionicons name="pulse-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.hintBannerText, { color: theme.text }]}>
              Nothing is blocking right now. See live status on the Active page.
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Intro banner */}
        <View style={[styles.introBanner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '33' }]}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
          <Text style={[styles.introText, { color: theme.text }]}>
            These tools run continuously in the background whenever they are switched on — they do not
            need a Focus session or standalone block to be active. While a block IS running, the toggles
            below stay locked on so they can&apos;t be disabled mid-session.
          </Text>
        </View>

        {/* ── Password Protection ──────────────────────────────────── */}
        <View collapsable={false}>
          <SectionHeader
            icon="key-outline"
            title="Password Protection"
            description="Add a password that must be entered before ending a focus session or disabling any protection. The raw password is never stored — only its SHA-256 hash."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <PinRow
              icon="hourglass-outline"
              label="Focus Session Password"
              description={
                focusPinSet
                  ? 'Set — required to end any active focus session'
                  : 'Not set — focus sessions can be ended freely'
              }
              isSet={focusPinSet}
              onSet={() => setPinModal({ type: 'setup', pinType: 'focus' })}
              onChange={() =>
                setPinModal({
                  type: 'verify',
                  pinType: 'focus',
                  title: 'Verify Current Password',
                  description: 'Enter your current focus session password to change it.',
                  onVerified: async (hash: string) => {
                    try { await SessionPinModule.clearPin(hash); } catch {}
                    setFocusPinSet(false);
                    setPinModal({ type: 'setup', pinType: 'focus' });
                  },
                })
              }
              onRemove={() =>
                setPinModal({
                  type: 'verify',
                  pinType: 'focus',
                  title: 'Remove Focus Session Password',
                  description: 'Enter your current password to remove it.',
                  onVerified: async (hash: string) => {
                    try { await SessionPinModule.clearPin(hash); } catch {}
                    setFocusPinSet(false);
                    setPinModal({ type: 'none' });
                    void loadPinStatus();
                  },
                })
              }
              theme={theme}
            />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />
            <PinRow
              icon="shield-half-outline"
              label="Defense Password"
              description={
                defensePinSet
                  ? 'Set — gates disabling protections and removing restrictions'
                  : 'Not set — protections can be changed without a password'
              }
              isSet={defensePinSet}
              isLast
              onSet={() => setPinModal({ type: 'setup', pinType: 'defense' })}
              onChange={() =>
                setPinModal({
                  type: 'verify',
                  pinType: 'defense',
                  title: 'Verify Current Password',
                  description: 'Enter your current defense password to change it.',
                  onVerified: async () => {
                    await SharedPrefsModule.putString('defense_pin_hash', '');
                    setDefensePinSet(false);
                    setPinModal({ type: 'setup', pinType: 'defense' });
                  },
                })
              }
              onRemove={() =>
                setPinModal({
                  type: 'verify',
                  pinType: 'defense',
                  title: 'Remove Defense Password',
                  description: 'Enter your current defense password to remove it.',
                  onVerified: async () => {
                    await SharedPrefsModule.putString('defense_pin_hash', '');
                    setDefensePinSet(false);
                    setPinModal({ type: 'none' });
                    void loadPinStatus();
                  },
                })
              }
              theme={theme}
            />
          </View>
        </View>

        {/* ── Focus Session Behaviour ──────────────────────────────── */}
        <View collapsable={false}>
          <SectionHeader
            icon="hourglass-outline"
            title="Focus Session Behaviour"
            description="Controls what happens to a running focus session when you finish or skip a task early."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SwitchRow
              label="Keep focus active for the full duration"
              description={
                (settings.keepFocusActiveUntilTaskEnd ?? false)
                  ? 'On — completing a task early keeps app-blocking running until the original end time'
                  : 'Off — completing a task immediately ends the focus session (default)'
              }
              value={settings.keepFocusActiveUntilTaskEnd ?? false}
              onValueChange={(v) => void update({ keepFocusActiveUntilTaskEnd: v })}
              theme={theme}
              isLast
            />
          </View>
        </View>

        {/* ── System Protection ────────────────────────────────────── */}
        <View ref={sectionRefs.system} collapsable={false}>
          <SectionHeader
            icon="lock-closed-outline"
            title="System Protection"
            description="Locks down Android system controls so there's no way to wriggle out through system menus. Each toggle runs continuously while it is on."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SwitchRow
              label="Protect system controls"
              description={
                blockProtectionActive && (settings.systemGuardEnabled ?? false)
                  ? 'Locked on — active block in progress'
                  : 'Power menu, Emergency mode & sensitive Settings pages — guarded all the time when on'
              }
              value={settings.systemGuardEnabled ?? false}
              onValueChange={handleSystemGuardToggle}
              disabled={blockProtectionActive && (settings.systemGuardEnabled ?? false)}
              theme={theme}
            />
            <SwitchRow
              label="Block YouTube Shorts"
              description={
                blockProtectionActive && (settings.blockYoutubeShortsEnabled ?? false)
                  ? 'Locked on — active block in progress'
                  : 'Sends you home the moment the Shorts player opens (regular YouTube stays usable) — runs all the time when on'
              }
              value={settings.blockYoutubeShortsEnabled ?? false}
              onValueChange={handleYoutubeToggle}
              disabled={blockProtectionActive && (settings.blockYoutubeShortsEnabled ?? false)}
              theme={theme}
            />
            <SwitchRow
              label="Block Instagram Reels"
              description={
                blockProtectionActive && (settings.blockInstagramReelsEnabled ?? false)
                  ? 'Locked on — active block in progress'
                  : 'Closes the Reels viewer (rest of Instagram stays usable) — runs all the time when on'
              }
              value={settings.blockInstagramReelsEnabled ?? false}
              onValueChange={handleReelsToggle}
              disabled={blockProtectionActive && (settings.blockInstagramReelsEnabled ?? false)}
              theme={theme}
            />
            <SwitchRow
              label="Network blocking (VPN)"
              description={
                blockProtectionActive && (settings.vpnBlockEnabled ?? false)
                  ? 'Locked on — active block in progress'
                  : 'Tunnels blocked apps through a local VPN to cut their internet access — nothing leaves your device'
              }
              value={settings.vpnBlockEnabled ?? false}
              onValueChange={(v) => void handleVpnToggle(v)}
              disabled={blockProtectionActive && (settings.vpnBlockEnabled ?? false)}
              theme={theme}
            />
            <SwitchRow
              label="VPN self-healing"
              description={
                blockProtectionActive && (settings.vpnSelfHealEnabled ?? false)
                  ? 'Locked on — active block in progress'
                  : 'Automatically restarts the VPN if you disconnect it from quick settings mid-session'
              }
              value={settings.vpnSelfHealEnabled ?? false}
              onValueChange={(v) => void update({ vpnSelfHealEnabled: v })}
              disabled={
                !(settings.vpnBlockEnabled ?? false) ||
                (blockProtectionActive && (settings.vpnSelfHealEnabled ?? false))
              }
              theme={theme}
              isLast
            />
          </View>
        </View>

        {/* ── Aversion Deterrents ──────────────────────────────────── */}
        <View ref={sectionRefs.aversion} collapsable={false}>
          <SectionHeader
            icon="flash-outline"
            title="Aversion Deterrents"
            description="Pair discomfort with distraction. Applied the instant a blocked app launches to build a negative reflex."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SwitchRow
              label="Screen Dimmer"
              description="Near-black overlay appears while a blocked app is open"
              value={settings.aversionDimmerEnabled}
              onValueChange={(v) => void update({ aversionDimmerEnabled: v })}
              theme={theme}
            />
            <SwitchRow
              label="Vibration Harassment"
              description="Repeated pulse vibration while a blocked app is in foreground"
              value={settings.aversionVibrateEnabled}
              onValueChange={(v) => void update({ aversionVibrateEnabled: v })}
              theme={theme}
            />
            <SwitchRow
              label="Sound Alert"
              description="Startling sound plays the moment a blocked app launches"
              value={settings.aversionSoundEnabled}
              onValueChange={(v) => void update({ aversionSoundEnabled: v })}
              theme={theme}
              isLast
            />
          </View>
        </View>

        {/* ── Always-On Enforcement ───────────────────────────────── */}
        <View collapsable={false}>
          <SectionHeader
            icon="infinite-outline"
            title="Always-On Block List"
            description="A permanent list of apps that are blocked 24/7 — no session, no timer. Disabling this toggle requires your defense password."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SwitchRow
              label="Enable always-on enforcement"
              description={
                (settings.alwaysOnEnforcementEnabled ?? false)
                  ? `On — ${(settings.alwaysOnPackages ?? []).length} app${(settings.alwaysOnPackages ?? []).length !== 1 ? 's' : ''} blocked 24/7`
                  : 'Off — always-on list is paused (list is preserved, not deleted)'
              }
              value={settings.alwaysOnEnforcementEnabled ?? false}
              onValueChange={handleAlwaysOnEnforcementToggle}
              theme={theme}
            />
            <SwitchRow
              label="Auto-copy from standalone block"
              description="When you add apps to a standalone block, they are automatically added to this always-on list too — so they stay blocked after the timer ends"
              value={settings.autoCopyToAlwaysOn ?? false}
              onValueChange={(v) => void update({ autoCopyToAlwaysOn: v })}
              theme={theme}
            />
            <TouchableOpacity style={styles.cardButton} onPress={() => router.push('/always-on')}>
              <View style={styles.cardButtonContent}>
                <Text style={[styles.cardButtonLabel, { color: theme.text }]}>Manage Always-On App List</Text>
                <Text style={[styles.cardButtonDesc, { color: theme.muted }]}>
                  {(settings.alwaysOnPackages ?? []).length === 0
                    ? 'No apps — tap to add apps to block permanently'
                    : `${(settings.alwaysOnPackages ?? []).length} app${(settings.alwaysOnPackages ?? []).length !== 1 ? 's' : ''} blocked around the clock`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.border} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Home Launcher ────────────────────────────────────────── */}
        <View collapsable={false}>
          <SectionHeader
            icon="home-outline"
            title="Home Launcher"
            description="Replace your default home screen with FocusFlow's built-in launcher — every app tap is intercepted before the OS even sees it. Blocked apps dim in the drawer and tap straight to the block overlay."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SwitchRow
              label="Lock launcher during standalone block"
              description={
                standaloneActive && (settings.launcherLockDuringStandalone ?? true)
                  ? 'Locked on — standalone block in progress'
                  : 'Intercepts the "Default home app" Settings page and presses HOME while a standalone block is active — prevents switching away from FocusFlow launcher mid-session'
              }
              value={settings.launcherLockDuringStandalone ?? true}
              onValueChange={(v) => {
                if (!v && standaloneActive) {
                  Alert.alert('Block is active', 'Cannot disable while a standalone block is running.');
                  return;
                }
                void update({ launcherLockDuringStandalone: v });
              }}
              disabled={standaloneActive && (settings.launcherLockDuringStandalone ?? true)}
              theme={theme}
            />
            <SwitchRow
              label="Block uninstall from launcher long-press"
              description={
                blockProtectionActive && (settings.launcherBlockUninstall ?? false)
                  ? 'Locked on — active block in progress'
                  : 'Suppresses "Uninstall" in the long-press context menu of any launcher, independent of System Protection'
              }
              value={settings.launcherBlockUninstall ?? false}
              onValueChange={(v) => {
                if (!v && blockProtectionActive) {
                  Alert.alert('Block is active', 'Cannot disable while a block is running.');
                  return;
                }
                void update({ launcherBlockUninstall: v });
              }}
              disabled={blockProtectionActive && (settings.launcherBlockUninstall ?? false)}
              theme={theme}
            />
            <TouchableOpacity
              style={styles.cardButton}
              onPress={() => {
                if (standaloneActive) {
                  Alert.alert('Block is active', 'Launcher settings are locked while a standalone block is running.');
                  return;
                }
                router.push('/home-launcher');
              }}
            >
              <View style={styles.cardButtonContent}>
                <Text style={[styles.cardButtonLabel, { color: theme.text }]}>Configure Home Launcher</Text>
                <Text style={[styles.cardButtonDesc, { color: theme.muted }]}>
                  {(settings.launcherEnabled ?? false)
                    ? `Enabled — ${(settings.launcherPinnedPackages ?? []).length} pinned app${(settings.launcherPinnedPackages ?? []).length !== 1 ? 's' : ''}, ${(settings.launcherHiddenPackages ?? []).length} hidden`
                    : 'Pinned apps, drawer visibility, wallpaper, clock style'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.border} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Block Schedules ─────────────────────────────────────── */}
        <View ref={sectionRefs.greyout} collapsable={false}>
          <SectionHeader
            icon="time-outline"
            title="Block Schedules"
            description="Create one or more batches — each batch picks a group of apps and the hours/days they should be blocked. Set once, runs forever, no focus session needed. Protected by your defense password."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.cardButton}
              onPress={() =>
                requireDefensePin(
                  'Manage Block Schedules',
                  'Enter your defense password to add, edit, or remove schedule batches.',
                  () => setGreyoutModalVisible(true),
                )
              }
            >
              <View style={styles.cardButtonContent}>
                <View style={styles.cardButtonLabelRow}>
                  <Text style={[styles.cardButtonLabel, { color: theme.text }]}>Manage Schedule Batches</Text>
                  {defensePinSet && (
                    <Ionicons name="lock-closed" size={13} color={COLORS.primary} style={{ marginLeft: 4 }} />
                  )}
                </View>
                <Text style={[styles.cardButtonDesc, { color: theme.muted }]}>
                  {(() => {
                    const all = settings.greyoutSchedule ?? [];
                    if (all.length === 0) return 'No batches set — tap to add your first one';
                    const active = all.filter((w) => w.enabled !== false).length;
                    const paused = all.length - active;
                    if (paused === 0) return `${all.length} batch${all.length !== 1 ? 'es' : ''} active`;
                    return `${active} active · ${paused} paused`;
                  })()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.border} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <GreyoutScheduleModal
        visible={greyoutModalVisible}
        windows={settings.greyoutSchedule ?? []}
        onSave={async (windows: GreyoutWindow[]) => { await update({ greyoutSchedule: windows }); }}
        onClose={() => setGreyoutModalVisible(false)}
        standaloneActive={standaloneActive}
        requireDefensePin={requireDefensePin}
      />

      <PinVerifyModal
        visible={pinModal.type === 'verify'}
        pinType={pinModal.type === 'verify' ? pinModal.pinType : 'defense'}
        title={pinModal.type === 'verify' ? pinModal.title : undefined}
        description={pinModal.type === 'verify' ? pinModal.description : undefined}
        onVerified={(hash) => {
          if (pinModal.type === 'verify') {
            pinModal.onVerified(hash);
          }
        }}
        onCancel={() => setPinModal({ type: 'none' })}
      />

      <PinSetupModal
        visible={pinModal.type === 'setup'}
        pinType={pinModal.type === 'setup' ? pinModal.pinType : 'focus'}
        onSaved={handlePinSaved}
        onCancel={() => setPinModal({ type: 'none' })}
      />

      <PinRotationModal
        visible={alwaysOnPinRotationVisible}
        pinType="defense"
        reuseTrackerKey="alwayson"
        actionLabel="Update Always-On Password"
        actionDescription="Always-On Enforcement has been paused. Set the password that will be required next time you change this setting."
        onComplete={() => {
          setAlwaysOnPinRotationVisible(false);
          void loadPinStatus();
        }}
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
      <NuclearModeModal
        visible={nuclearModeVisible}
        onClose={() => setNuclearModeVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PinRow({
  icon,
  label,
  description,
  isSet,
  isLast = false,
  onSet,
  onChange,
  onRemove,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  isSet: boolean;
  isLast?: boolean;
  onSet: () => void;
  onChange: () => void;
  onRemove: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View
      style={[
        styles.pinRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <View style={styles.pinRowTop}>
        <View style={[styles.pinIcon, { backgroundColor: isSet ? COLORS.primary + '18' : theme.border + '44' }]}>
          <Ionicons name={icon} size={16} color={isSet ? COLORS.primary : theme.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pinLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.pinDesc, { color: isSet ? COLORS.primary : theme.muted }]} numberOfLines={2}>
            {description}
          </Text>
        </View>
      </View>
      <View style={styles.pinBtns}>
        {!isSet ? (
          <TouchableOpacity
            style={[styles.pinBtn, { backgroundColor: COLORS.primary }]}
            onPress={onSet}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={[styles.pinBtnText, { color: '#fff' }]}>Set Password</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.pinBtn, { borderWidth: 1, borderColor: COLORS.primary + 'AA' }]}
              onPress={onChange}
              activeOpacity={0.8}
            >
              <Text style={[styles.pinBtnText, { color: COLORS.primary }]}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pinBtn, { borderWidth: 1, borderColor: COLORS.red + '66' }]}
              onPress={onRemove}
              activeOpacity={0.8}
            >
              <Text style={[styles.pinBtnText, { color: COLORS.red }]}>Remove</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionIcon, { backgroundColor: COLORS.primary + '18' }]}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionDesc, { color: theme.muted }]}>{description}</Text>
    </View>
  );
}

function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  theme,
  isLast = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.switchRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.switchDesc, { color: theme.muted }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
        thumbColor={value ? COLORS.primary : COLORS.muted}
      />
    </View>
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
  nuclearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  nuclearBtnText: { fontSize: FONT.xs, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  introBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  introText: { flex: 1, fontSize: FONT.sm, lineHeight: 20 },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  hintBannerText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },

  sectionHeader: { gap: 4, marginBottom: 2 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: FONT.md, fontWeight: '800' },
  sectionDesc: { fontSize: FONT.xs, lineHeight: 17, paddingLeft: 28 + SPACING.sm },

  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  switchLabel: { fontSize: FONT.sm, fontWeight: '600' },
  switchDesc: { fontSize: FONT.xs, lineHeight: 16, marginTop: 1 },

  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  cardButtonContent: { flex: 1, gap: 2 },
  cardButtonLabelRow: { flexDirection: 'row', alignItems: 'center' },
  cardButtonLabel: { fontSize: FONT.sm, fontWeight: '600' },
  cardButtonDesc: { fontSize: FONT.xs, lineHeight: 16 },

  pinRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  pinRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  pinIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  pinLabel: { fontSize: FONT.sm, fontWeight: '700' },
  pinDesc: { fontSize: FONT.xs, lineHeight: 16, marginTop: 2 },
  pinBtns: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingLeft: 30 + SPACING.sm,
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  pinBtnText: { fontSize: FONT.xs, fontWeight: '700' },
});
