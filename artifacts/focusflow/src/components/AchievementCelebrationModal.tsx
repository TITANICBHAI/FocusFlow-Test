import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  milestone: number | null;
  onDismiss: () => void;
}

const COPY: Record<number, { title: string; subtitle: string; emoji: string }> = {
  3:   { title: 'Three days strong!',     subtitle: 'You showed up three days running. Habits start here.',                emoji: '🔥' },
  7:   { title: 'A full week!',           subtitle: 'Seven days of focus. Your future self is paying attention.',          emoji: '⚡' },
  14:  { title: 'Two-week streak',        subtitle: 'Two weeks. This isn\'t luck anymore — it\'s discipline.',             emoji: '💪' },
  30:  { title: 'A whole month!',         subtitle: 'Thirty days. You\'ve rewritten what you thought you were capable of.', emoji: '🏆' },
  60:  { title: 'Sixty-day streak',       subtitle: 'Two months of intent. The version of you that started is gone.',      emoji: '🚀' },
  90:  { title: 'Ninety. Days.',          subtitle: 'A quarter of a year of focus. Almost no one gets here.',               emoji: '👑' },
  180: { title: 'Half a year of focus',   subtitle: 'Six months. You\'ve quietly become someone different.',                emoji: '🌟' },
  365: { title: 'A FULL YEAR',            subtitle: 'Three hundred and sixty-five days. Read that again.',                  emoji: '🎆' },
};

/**
 * One-shot celebration shown when the user crosses a streak milestone. Uses
 * Animated (no extra deps) for: scale-bounce-in on the badge, slow rotation,
 * and a confetti-emoji fountain.
 */
export function AchievementCelebrationModal({ milestone, onDismiss }: Props) {
  const { theme } = useTheme();
  const visible = milestone != null;
  const copy = (milestone != null && COPY[milestone]) || null;

  // Animations
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Confetti pieces — eight emojis falling at slightly different speeds.
  const screenH = Dimensions.get('window').height;
  const confettiCount = 14;
  const confettiAnims = useRef(
    Array.from({ length: confettiCount }, () => ({
      y: new Animated.Value(-80),
      x: Math.random(),       // 0–1, mapped to screen width on render
      delay: Math.random() * 600,
      rot: new Animated.Value(0),
      emoji: ['✨', '⭐', '🎉', '🎊', '💫', '🌟', '⚡'][Math.floor(Math.random() * 7)],
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;
    badgeScale.setValue(0);
    badgeRotate.setValue(0);
    titleOpacity.setValue(0);
    subtitleOpacity.setValue(0);
    buttonOpacity.setValue(0);

    Animated.sequence([
      // Badge bounces in
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(titleOpacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Slow continuous rotation on the badge
    Animated.loop(
      Animated.timing(badgeRotate, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Confetti fall
    confettiAnims.forEach((c) => {
      c.y.setValue(-80);
      c.rot.setValue(0);
      Animated.parallel([
        Animated.timing(c.y, {
          toValue: screenH + 80,
          duration: 3500 + Math.random() * 2500,
          delay: c.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(c.rot, {
          toValue: 1,
          duration: 3500,
          delay: c.delay,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [visible, badgeScale, badgeRotate, titleOpacity, subtitleOpacity, buttonOpacity, confettiAnims, screenH]);

  if (!visible || !copy) return null;

  const screenW = Dimensions.get('window').width;
  const rotateInterp = badgeRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        {/* Confetti layer (behind the card) */}
        {confettiAnims.map((c, i) => {
          const rot = c.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
          return (
            <Animated.Text
              key={i}
              style={[
                styles.confetti,
                {
                  left: c.x * screenW,
                  transform: [{ translateY: c.y }, { rotate: rot }],
                },
              ]}
            >
              {c.emoji}
            </Animated.Text>
          );
        })}

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Animated.View
            style={[
              styles.badge,
              { backgroundColor: COLORS.orange + '22', borderColor: COLORS.orange + '88' },
              { transform: [{ scale: badgeScale }, { rotate: rotateInterp }] },
            ]}
          >
            <Text style={styles.badgeEmoji}>{copy.emoji}</Text>
          </Animated.View>

          <Animated.Text style={[styles.dayLabel, { color: COLORS.orange, opacity: titleOpacity }]}>
            {milestone}-DAY STREAK
          </Animated.Text>

          <Animated.Text style={[styles.title, { color: theme.text, opacity: titleOpacity }]}>
            {copy.title}
          </Animated.Text>

          <Animated.Text style={[styles.subtitle, { color: theme.muted, opacity: subtitleOpacity }]}>
            {copy.subtitle}
          </Animated.Text>

          <Animated.View style={{ opacity: buttonOpacity, width: '100%' }}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: COLORS.orange }]}
              onPress={onDismiss}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.buttonText}>Keep going</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  confetti: {
    position: 'absolute',
    fontSize: 24,
    top: 0,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  badge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 56,
  },
  dayLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: SPACING.sm,
  },
  title: {
    fontSize: FONT.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT.md,
    fontWeight: '700',
  },
});
