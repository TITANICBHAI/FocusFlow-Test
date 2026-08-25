import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS } from '@/styles/theme';

const TRACK_W = 58;
const TRACK_H = 30;
const KNOB = 24;
const KNOB_PAD = 3;
const TRAVEL = TRACK_W - KNOB - KNOB_PAD * 2;

export default function DarkModeToggle() {
  const { isDark, toggleTheme } = useTheme();

  const knobX = useRef(new Animated.Value(isDark ? TRAVEL : 0)).current;
  const trackColor = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(knobX, {
        toValue: isDark ? TRAVEL : 0,
        useNativeDriver: true,
        tension: 70,
        friction: 9,
      }),
      Animated.timing(trackColor, {
        toValue: isDark ? 1 : 0,
        duration: 240,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isDark, knobX, trackColor]);

  const trackBg = trackColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#93c5fd', '#312e81'],
  });

  return (
    <Pressable
      onPress={toggleTheme}
      style={styles.wrapper}
      hitSlop={8}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityRole="switch"
    >
      <Animated.View style={[styles.track, { backgroundColor: trackBg }]}>
        {/* Light-mode accent: sun + cloud on the right */}
        <View style={styles.lightIcons}>
          <Ionicons name="cloud-outline" size={9} color="rgba(255,255,255,0.7)" />
          <Ionicons name="sunny" size={10} color="#fbbf24" />
        </View>

        {/* Dark-mode accent: stars on the left */}
        <View style={styles.darkIcons}>
          <Ionicons name="star" size={6} color="rgba(255,255,255,0.5)" />
          <Ionicons name="star" size={4} color="rgba(255,255,255,0.35)" />
        </View>

        {/* Sliding knob */}
        <Animated.View
          style={[
            styles.knob,
            { transform: [{ translateX: knobX }] },
          ]}
        >
          {isDark ? (
            <Ionicons name="moon" size={13} color="#6366f1" />
          ) : (
            <Ionicons name="sunny" size={13} color="#f59e0b" />
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    paddingHorizontal: KNOB_PAD,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lightIcons: {
    position: 'absolute',
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  darkIcons: {
    position: 'absolute',
    left: 7,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  knob: {
    position: 'absolute',
    left: KNOB_PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
