/**
 * keyword-blocker.tsx
 *
 * Dedicated page for the Keyword Blocker. Lifted out of `block-defense` so
 * the keyword-management UI no longer competes for attention with app-blocking
 * settings (system guard, schedules, deterrents). Reachable from:
 *   • Side Menu → Keyword Blocker
 *   • Active page → "Keyword Blocker" enforcement tile
 *
 * PIN gating:
 *   - Adding keywords → no password required
 *   - Removing keywords (via BlockedWordsModal or "Clear all") → defense password required
 *     when standalone block is NOT active. When standalone IS active → existing lock behavior.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { BlockedWordsModal } from '@/components/BlockedWordsModal';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

interface QuickPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  words: string[];
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'doomscroll',
    label: 'Doomscroll bait',
    emoji: '📰',
    description: 'Outrage headlines, viral controversy, breaking-news loops',
    words: ['breaking', 'shocking', 'must see', 'gone wrong', 'you wont believe', 'controversy', 'drama', 'reaction'],
  },
  {
    id: 'social-drama',
    label: 'Social-media drama',
    emoji: '🎭',
    description: 'Celebrity feuds, beef tracks, trending arguments',
    words: ['cancelled', 'feud', 'expose', 'beef', 'callout', 'roasted', 'clapback', 'tea'],
  },
  {
    id: 'shorts-bait',
    label: 'Shorts/Reels bait',
    emoji: '📱',
    description: 'Words that show up next to short-form-video rabbit holes',
    words: ['short', 'reel', 'tiktok', 'fyp', 'viral', 'trending', 'compilation', 'pov'],
  },
  {
    id: 'shopping',
    label: 'Impulse-buy traps',
    emoji: '🛒',
    description: 'Sale-pressure words that pull you into shopping apps',
    words: ['flash sale', 'deal of the day', 'limited time', 'lightning deal', 'cart', 'buy now', 'discount'],
  },
  {
    id: 'gambling',
    label: 'Gambling triggers',
    emoji: '🎰',
    description: 'Betting lines, casino lure, loot-box language',
    words: ['bet', 'odds', 'spin', 'jackpot', 'casino', 'parlay', 'wager', 'free spins'],
  },
  {
    id: 'adult',
    label: 'NSFW content',
    emoji: '🚫',
    description: 'Adult-content terms across browsers, search, and feeds',
    words: ['nsfw', 'porn', 'xxx', 'onlyfans', 'adult', 'nude'],
  },
];

export default function KeywordBlockerScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const [modalVisible, setModalVisible] = useState(false);
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const blockedWords = settings.blockedWords ?? [];
  const isOn = blockedWords.length > 0;

  const isLocked = (() => {
    if (!settings.standaloneBlockUntil) return false;
    if ((settings.standaloneBlockPackages ?? []).length === 0) return false;
    return new Date(settings.standaloneBlockUntil).getTime() > Date.now();
  })();

  const handleSaveWords = async (words: string[]) => {
    await updateSettings({ ...settings, blockedWords: words });
  };

  const handleAddPreset = (preset: QuickPreset) => {
    const existing = new Set(blockedWords.map((w) => w.toLowerCase()));
    const additions = preset.words.filter((w) => !existing.has(w.toLowerCase()));
    if (additions.length === 0) {
      Alert.alert(`${preset.label} already added`, 'Every keyword in this preset is already on your list.');
      return;
    }
    Alert.alert(
      `Add ${preset.label}?`,
      `Adds ${additions.length} keyword${additions.length !== 1 ? 's' : ''} to your blocked list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            const merged = [...blockedWords, ...additions];
            void updateSettings({ ...settings, blockedWords: merged });
          },
        },
      ],
    );
  };

  /**
   * Runs action immediately if no defense PIN is set,
   * otherwise shows the verify modal first.
   */
  const withDefensePin = (action: () => void) => {
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => {
        if (!hash) {
          action();
        } else {
          pendingAction.current = action;
          setPinVerifyVisible(true);
        }
      })
      .catch(() => action());
  };

  const handleClearAll = () => {
    if (blockedWords.length === 0) return;
    withDefensePin(() => {
      Alert.alert(
        'Clear all keywords?',
        `Removes all ${blockedWords.length} keywords from the block list. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => { void updateSettings({ ...settings, blockedWords: [] }); },
          },
        ],
      );
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Keyword Blocker</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Explainer */}
        <View style={[styles.intro, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="text-outline" size={26} color={COLORS.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.introTitle, { color: theme.text }]}>Block by keyword</Text>
            <Text style={[styles.introDesc, { color: theme.muted }]}>
              The moment any of your blocked words appear on screen — in URLs, search bars, or visible text —
              the app is sent home. Active during Focus Mode and whenever the always-on list is enforcing.
            </Text>
          </View>
        </View>

        {/* Status card */}
        <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: isOn ? COLORS.green + '88' : theme.border }]}>
          <View style={[styles.statusDot, { backgroundColor: isOn ? COLORS.green : theme.muted }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: theme.text }]}>
              {isOn ? 'Active' : 'Inactive'}
            </Text>
            <Text style={[styles.statusDesc, { color: theme.muted }]}>
              {isOn
                ? `${blockedWords.length} keyword${blockedWords.length !== 1 ? 's' : ''} on the block list`
                : 'Add keywords below to start filtering content'}
            </Text>
          </View>
        </View>

        {/* Manage list */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name={isOn ? 'create-outline' : 'add-circle-outline'} size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>{isOn ? 'Manage Keywords' : 'Add Keywords'}</Text>
        </TouchableOpacity>

        {isOn && !isLocked && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: COLORS.red + '66', backgroundColor: COLORS.red + '11' }]}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.red} />
            <Text style={[styles.secondaryBtnText, { color: COLORS.red }]}>Clear all keywords</Text>
          </TouchableOpacity>
        )}

        {isLocked && (
          <View style={[styles.secondaryBtn, { borderColor: COLORS.orange + '55', backgroundColor: COLORS.orange + '0E' }]}>
            <Ionicons name="lock-closed-outline" size={15} color={COLORS.orange} />
            <Text style={[styles.secondaryBtnText, { color: COLORS.orange }]}>Locked — block is active</Text>
          </View>
        )}

        {/* Quick presets */}
        <Text style={[styles.sectionLabel, { color: theme.muted }]}>QUICK PRESETS</Text>
        <Text style={[styles.sectionHint, { color: theme.muted }]}>
          Tap a category to add a curated set of keywords. You can edit the full list anytime.
        </Text>

        {QUICK_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={[styles.presetCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => handleAddPreset(preset)}
            activeOpacity={0.7}
          >
            <Text style={styles.presetEmoji}>{preset.emoji}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.presetLabel, { color: theme.text }]}>{preset.label}</Text>
              <Text style={[styles.presetDesc, { color: theme.muted }]} numberOfLines={2}>
                {preset.description}
              </Text>
              <Text style={[styles.presetCount, { color: COLORS.primary }]}>
                +{preset.words.length} keywords
              </Text>
            </View>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ))}

        {/* Footer note */}
        <View style={[styles.footnote, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.muted} />
          <Text style={[styles.footnoteText, { color: theme.muted }]}>
            Keyword detection runs on the device — nothing is sent to the cloud. Detection requires
            the Accessibility Service to be enabled.
          </Text>
        </View>
      </ScrollView>

      <BlockedWordsModal
        visible={modalVisible}
        words={blockedWords}
        locked={isLocked}
        requireDefensePin={true}
        onSave={handleSaveWords}
        onClose={() => setModalVisible(false)}
      />

      <PinVerifyModal
        visible={pinVerifyVisible}
        pinType="defense"
        title="Defense Password Required"
        description="Enter your defense password to remove keywords from the block list."
        onVerified={() => {
          setPinVerifyVisible(false);
          pendingAction.current?.();
          pendingAction.current = null;
        }}
        onCancel={() => {
          setPinVerifyVisible(false);
          pendingAction.current = null;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.lg, fontWeight: '700' },
  content: { padding: SPACING.lg, gap: SPACING.md },
  intro: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  introTitle: { fontSize: FONT.md, fontWeight: '700' },
  introDesc: { fontSize: FONT.xs, lineHeight: 18 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { fontSize: FONT.md, fontWeight: '700' },
  statusDesc: { fontSize: FONT.xs, marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  primaryBtnText: { color: '#fff', fontSize: FONT.md, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: FONT.sm, fontWeight: '700' },
  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: SPACING.md,
  },
  sectionHint: { fontSize: FONT.xs, lineHeight: 17, marginTop: -SPACING.xs },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  presetEmoji: { fontSize: 28 },
  presetLabel: { fontSize: FONT.md, fontWeight: '700' },
  presetDesc: { fontSize: FONT.xs, lineHeight: 17 },
  presetCount: { fontSize: FONT.xs, fontWeight: '700', marginTop: 2 },
  footnote: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  footnoteText: { fontSize: FONT.xs, lineHeight: 17, flex: 1 },
});
