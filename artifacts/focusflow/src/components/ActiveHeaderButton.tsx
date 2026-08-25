import React, { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/context/AppContext';

/**
 * Shared entry point for the live Active dashboard.
 * Kept as a small header action so every bottom-nav screen reaches the same
 * status surface without adding Active as a sixth tab.
 */
export function ActiveHeaderButton() {
  const { theme } = useTheme();
  const { state } = useApp();
  const pulse = useRef(new Animated.Value(1)).current;
  const hasActiveProtection =
    state.focusSession?.isActive === true ||
    Boolean(
      state.settings.standaloneBlockUntil &&
        (state.settings.standaloneBlockPackages ?? []).length > 0 &&
        new Date(state.settings.standaloneBlockUntil).getTime() > Date.now(),
    ) ||
    (state.settings.alwaysOnEnforcementEnabled ?? false) ||
    (state.settings.blockedWords ?? []).length > 0 ||
    (state.settings.greyoutSchedule ?? []).length > 0 ||
    (state.settings.vpnBlockEnabled ?? false);

  useEffect(() => {
    if (!hasActiveProtection) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [hasActiveProtection, pulse]);

  return (
    <TouchableOpacity
      onPress={() => router.push('/active')}
      accessibilityRole="button"
      accessibilityLabel="Open Active blocks"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ padding: 4 }}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Ionicons
          name={hasActiveProtection ? 'pulse' : 'pulse-outline'}
          size={22}
          color={hasActiveProtection ? '#2BAE66' : theme.text}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}