import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

export function BlockedAppOverlay() {
  const { state } = useApp();
  const insets = useSafeAreaInsets();
  const visible = !!state.focusViolationApp;

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    shakeAnim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    });
  }, [visible, state.focusViolationApp]);

  const isInstaller =
    !!state.focusViolationApp &&
    state.focusViolationApp.toLowerCase().includes('packageinstaller');

  const appName = state.focusViolationApp ?? '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
              paddingTop: insets.top + SPACING.xxl,
              paddingBottom: insets.bottom + SPACING.xxl,
            },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="ban" size={52} color={COLORS.red} />
          </View>

          {/* Title */}
          <Text style={styles.blockedLabel}>APP BLOCKED</Text>

          {/* App name */}
          <Text style={styles.appName} numberOfLines={2}>
            {isInstaller ? 'Package Installer' : appName}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            {isInstaller
              ? 'The package installer is blocked while focus mode or a block schedule is active.'
              : 'This app is blocked while focus mode or a block schedule is active.'}
          </Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Status row */}
          <View style={styles.statusRow}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
            <Text style={styles.statusText}>FocusFlow is protecting your focus</Text>
          </View>

          <Text style={styles.dismissHint}>This will dismiss automatically</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1a0505',
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.red + '55',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.red + '18',
    borderWidth: 2,
    borderColor: COLORS.red + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  blockedLabel: {
    fontSize: FONT.xs,
    fontWeight: '800',
    letterSpacing: 3,
    color: COLORS.red,
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: FONT.xl,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  description: {
    fontSize: FONT.sm,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  divider: {
    width: '80%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: SPACING.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusText: {
    fontSize: FONT.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dismissHint: {
    fontSize: FONT.xs,
    color: 'rgba(255,255,255,0.3)',
    marginTop: SPACING.xs,
  },
});
