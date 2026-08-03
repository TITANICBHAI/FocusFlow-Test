/**
 * how-to-use.tsx
 *
 * In-app guide that walks users through FocusFlow's core features.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

interface GuideSection {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  steps: { heading: string; body: string }[];
}

const GUIDE: GuideSection[] = [
  {
    icon: 'calendar-outline',
    title: 'Schedule Your Focus',
    color: COLORS.primary,
    steps: [
      { heading: 'Add a task', body: 'Tap the + button on the Schedule tab. Give it a name, pick a start time and duration. Tap Save.' },
      { heading: 'Set priority', body: 'Tasks are colour-coded by priority — critical (red), high (orange), medium (indigo), low (grey). Higher-priority tasks surface first.' },
      { heading: 'Start focusing', body: 'When a task is active, the Focus tab lights up. Tap "Start Focus Mode" to activate app blocking.' },
    ],
  },
  {
    icon: 'ban-outline',
    title: 'Block Apps',
    color: COLORS.red,
    steps: [
      { heading: 'Standalone block (no task needed)', body: 'Swipe open the side menu → Standalone Block. Pick apps and choose how long to block them. The block survives reboots.' },
      { heading: 'Quick presets', body: 'Save groups of apps as presets (e.g. "Social Media") for one-tap blocking.' },
      { heading: 'Daily Allowance', body: 'Let apps through, but only N times per day, N total minutes, or N minutes every X hours.' },
    ],
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Enforce the Block',
    color: COLORS.orange,
    steps: [
      { heading: 'What\'s blocking right now', body: 'The top of the Block Enforcement screen shows three lights: Focus session, Timed Standalone Block, and Always-on enforcement. Glance there any time you\'re unsure why an app is blocked.' },
      { heading: 'Always-on enforcement', body: 'Any app left in your Standalone Block list (or any Daily Allowance rule) is enforced 24/7 — no timer needed. To turn it off, empty the list (Side menu → Standalone Block).' },
      { heading: 'Keyword Blocker', body: 'Add words to the Keyword Blocker (side menu → Block Enforcement). If any of those words appear on screen, FocusFlow redirects you home immediately.' },
      { heading: 'Aversion Deterrents', body: 'Turn on Vibration Harassment, Screen Dimmer, or Sound Alert. Each one applies the instant a blocked app opens — building a negative reflex over time.' },
      { heading: 'System Protection', body: 'Prevents power-menu tricks, install bypasses, and YouTube Shorts / Instagram Reels from sneaking through.' },
      { heading: 'Keep focus running for full duration', body: 'In Block Enforcement → Focus Session Behaviour. Off by default — completing a task ends the focus session right away. Turn it on if you want app-blocking to stay on until the task\'s original end time even when you finish early.' },
    ],
  },
  {
    icon: 'download-outline',
    title: 'Coming from Another Blocker?',
    color: COLORS.purple,
    steps: [
      { heading: 'Open the import flow', body: 'Settings → "Import from another blocker", or tap the banner during onboarding. Works with Stay Focused, AppBlock, StayFree, ActionDash, Digital Wellbeing, Lock Me Out and others.' },
      { heading: 'File path', body: 'If your old blocker has an Export feature, tap "Browse & Import file" and pick the file. JSON, CSV and plain-text exports are auto-detected.' },
      { heading: 'Paste / type names path', body: 'For Stay Focused (no public export) and similar: tap "Type or paste app names" and enter the names one per line. They\'re fuzzy-matched against your installed apps so capitalisation and small typos are forgiven.' },
      { heading: 'What import does and doesn\'t do', body: 'Import only adds the apps to your Standalone Block list. It never starts a focus session and never starts a new timed block — it preserves any timer you already have. Your existing tasks, stats, and presets are kept untouched.' },
    ],
  },
  {
    icon: 'time-outline',
    title: 'Scheduled Blocks',
    color: COLORS.purple,
    steps: [
      { heading: 'Block Schedules', body: 'Create one or more time-window batches — pick apps and the hours/days they should be blocked (e.g. no Instagram 9–17 Mon–Fri). Each batch runs independently. Set once, runs forever.' },
      { heading: 'Focus Mode tied to tasks', body: 'Enable "Auto-enable Focus Mode" in Settings so blocking starts and stops automatically with each task.' },
    ],
  },
  {
    icon: 'bar-chart-outline',
    title: 'Track Progress',
    color: COLORS.green,
    steps: [
      { heading: 'Stats tab', body: 'Daily and weekly charts of focus time, completed tasks, and blocked app attempts.' },
      { heading: 'Stats screen', body: "Yesterday's digest, today's focus time, weekly charts, all-time heatmap and milestones. Yesterday tab is your morning summary — tasks done vs scheduled, on-time/late/early, and distractions. Open via the bottom tabs or the side menu." },
      { heading: 'Weekly Report notification', body: 'Enable in Settings → Backup & Data to get a Sunday recap in your notification tray.' },
    ],
  },
  {
    icon: 'menu-outline',
    title: 'Side Menu',
    color: COLORS.blue,
    steps: [
      { heading: 'Open it', body: 'Swipe right from the left edge of the screen, or tap the › tab on the left side of the screen (just above the bottom nav bar).' },
      { heading: 'Quick access', body: 'The menu gives you direct access to every blocking tool, enforcement layer, and your focus reports without digging through Settings.' },
      { heading: 'Profile', body: 'Tap your profile card at the top of the menu to update your name, occupation, daily goal, or chronotype.' },
    ],
  },
];

export default function HowToUseScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const params = useLocalSearchParams<{ onboarding?: string }>();
  // When opened as part of the first-run flow, hide the back arrow and show
  // a prominent "Get Started" CTA at the bottom that drops the user on /.
  const isOnboarding = params.onboarding === '1';
  const [expanded, setExpanded] = useState<number | null>(0);

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  // In onboarding mode, intercept the Android hardware back button so it
  // doesn't pop back to the already-completed user-profile screen. Instead,
  // pressing back drops the user on home (same as the Skip / CTA links).
  useEffect(() => {
    if (!isOnboarding) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => sub.remove();
  }, [isOnboarding]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {!isOnboarding && (
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
        <View style={{ marginLeft: isOnboarding ? 0 : SPACING.sm, flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>
            {isOnboarding ? 'Welcome to FocusFlow' : 'How to Use FocusFlow'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {isOnboarding ? 'A quick tour before you get started' : 'Your discipline operating system — explained'}
          </Text>
        </View>
        {isOnboarding && (
          <TouchableOpacity
            onPress={() => router.replace('/')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.skipLink}
          >
            <Text style={[styles.skipText, { color: theme.muted }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
        {/* Info banner */}
        <View style={[styles.noticeBanner, { backgroundColor: `${COLORS.primary}12`, borderColor: `${COLORS.primary}28` }]}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} style={{ flexShrink: 0, marginTop: 1 }} />
          <Text style={[styles.noticeText, { color: theme.text }]}>
            These guide sections are fixed — they cannot be changed or removed. You can always{' '}
            <Text style={{ fontWeight: '700' }}>add more</Text>
            {' '}tasks, blocked apps, block schedules, and presets from the main app.
          </Text>
        </View>

        {GUIDE.map((section, i) => {
          const isOpen = expanded === i;
          return (
            <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: section.color + '18' }]}>
                  <Ionicons name={section.icon} size={20} color={section.color} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{section.title}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.muted}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={[styles.steps, { borderTopColor: theme.border }]}>
                  {section.steps.map((step, j) => (
                    <View
                      key={j}
                      style={[
                        styles.step,
                        j < section.steps.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                      ]}
                    >
                      <View style={[styles.stepBullet, { backgroundColor: section.color }]}>
                        <Text style={styles.stepNum}>{j + 1}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[styles.stepHeading, { color: theme.text }]}>{step.heading}</Text>
                        <Text style={[styles.stepBody, { color: theme.muted }]}>{step.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Text style={[styles.tip, { color: theme.muted }]}>
          All data stays on your device — nothing is sent to any server.
        </Text>

        {isOnboarding && (
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => router.replace('/')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Got it — let&apos;s start</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
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
  content: { padding: SPACING.lg, gap: SPACING.sm },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: FONT.md, fontWeight: '700' },
  steps: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  step: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  stepBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepHeading: { fontSize: FONT.sm, fontWeight: '600' },
  stepBody: { fontSize: FONT.xs, lineHeight: 18 },
  tip: {
    textAlign: 'center',
    fontSize: FONT.xs,
    paddingVertical: SPACING.md,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 18,
  },
  skipLink: { paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  skipText: { fontSize: FONT.sm, fontWeight: '600' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  ctaText: { color: '#fff', fontSize: FONT.md, fontWeight: '700' },
});
