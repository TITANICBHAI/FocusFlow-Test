/**
 * VpnPermissionLostBanner
 *
 * Shown whenever VPN blocking is enabled but the Android system VPN permission
 * has been silently revoked — either because:
 *   • The user tapped "Disconnect" in the quick-settings VPN tile.
 *   • Another VPN app started and kicked FocusFlow's tunnel out.
 *   • The user went to Settings → VPN and removed the permission manually.
 *
 * In all those cases every heal/watchdog path in the native layer detects
 * `VpnService.prepare() != null` and writes `vpn_permission_lost = true` to
 * SharedPreferences. This banner calls `isVpnPermissionGranted()` on every
 * app foreground and shows itself when the grant is missing.
 *
 * Tapping "Re-grant" calls `requestVpnPermission()` which shows the standard
 * Android "FocusFlow wants to set up a VPN" system dialog. On return to the
 * app the banner re-checks and, if the grant succeeded, automatically restarts
 * the VPN tunnel so blocking resumes without any further user action.
 *
 * The banner is an always-on-top overlay (absolute bottom, above safe area)
 * so it is visible from every screen in the app without requiring navigation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NetworkBlockModule } from '@/native-modules/NetworkBlockModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

interface Props {
  /** Only shown when VPN blocking is turned on in settings. */
  vpnBlockEnabled: boolean;
  /**
   * Packages to route through the VPN tunnel when the permission is re-granted.
   * Should be the merged set of alwaysOnVpnPackages + any active session packages.
   */
  vpnPackages: string[];
}

export function VpnPermissionLostBanner({ vpnBlockEnabled, vpnPackages }: Props) {
  const insets = useSafeAreaInsets();
  const [permissionLost, setPermissionLost] = useState(false);
  const [regranting, setRegranting] = useState(false);
  const slideAnim = useRef(new Animated.Value(120)).current;

  const check = useCallback(async () => {
    if (Platform.OS !== 'android' || !vpnBlockEnabled) {
      setPermissionLost(false);
      return;
    }
    try {
      const granted = await NetworkBlockModule.isVpnPermissionGranted();
      setPermissionLost(!granted);
    } catch {
      setPermissionLost(false);
    }
  }, [vpnBlockEnabled]);

  // Check on mount and every time the app returns to the foreground.
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  // Animate in / out whenever visibility changes.
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: permissionLost ? 0 : 120,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [permissionLost, slideAnim]);

  const handleRegrant = async () => {
    setRegranting(true);
    try {
      await NetworkBlockModule.requestVpnPermission();
      // The system VPN dialog has been launched. Wait a tick for the user to
      // return to the app, then check the permission again and restart the tunnel.
      // The AppState 'active' listener will also fire — so in the common case the
      // check runs twice (harmless) and the banner auto-hides on success.
    } catch {
      // Best-effort — user may have dismissed the dialog.
    }
    // Give the system dialog time to be fully dismissed before re-checking.
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    setRegranting(false);
    try {
      const granted = await NetworkBlockModule.isVpnPermissionGranted();
      if (granted) {
        // Permission has been re-granted — restart the VPN tunnel immediately
        // so blocking resumes without the user needing to go to Settings and save.
        if (vpnPackages.length > 0) {
          await NetworkBlockModule.startNetworkBlock(JSON.stringify(vpnPackages));
        }
        setPermissionLost(false);
      }
    } catch {
      // check() via AppState listener will handle this on foreground.
    }
  };

  if (!vpnBlockEnabled) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { bottom: insets.bottom + SPACING.sm, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={permissionLost ? 'box-none' : 'none'}
    >
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-half-outline" size={20} color="#ff6b35" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>VPN permission lost</Text>
          <Text style={styles.body}>
            Network blocking is on but the VPN tunnel isn't running. Tap to re-grant access.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.regrantBtn, regranting && styles.regrantBtnBusy]}
          onPress={handleRegrant}
          disabled={regranting}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={14} color="#fff" />
          <Text style={styles.regrantText}>{regranting ? '…' : 'Re-grant'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    elevation: 20,
    borderRadius: RADIUS.lg,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#ff6b3540',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff6b3520',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f0f0ff',
    marginBottom: 2,
  },
  body: {
    fontSize: 11,
    color: '#9090aa',
    lineHeight: 15,
  },
  regrantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ff6b35',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    flexShrink: 0,
  },
  regrantBtnBusy: {
    backgroundColor: '#ff6b3580',
  },
  regrantText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
