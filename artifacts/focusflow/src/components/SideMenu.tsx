/**
 * SideMenu.tsx
 *
 * A slide-in panel from the left edge of the screen, accessible via:
 *   1. A "›" floating tab button positioned just above the bottom nav bar.
 *   2. Swiping right from the left edge of the screen.
 *
 * Structure (top → bottom):
 *   • Profile header — avatar initials, name, occupation, daily goal
 *   • BLOCK CONTROLS — Standalone Block | Task Focus | Daily Allowance
 *   • BLOCK ENFORCEMENT — Keyword Blocker | System Protection | Aversion Deterrents | Block Schedules
 *   • INSIGHTS — Reports
 *   • Footer — Privacy | Terms of Service | How to Use
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import type { DailyAllowanceEntry } from '@/data/types';

import { StandaloneBlockModal } from '@/components/StandaloneBlockModal';
import { DailyAllowanceModal } from '@/components/DailyAllowanceModal';

const { width: SCREEN_W } = Dimensions.get('window');
const MENU_W = Math.min(SCREEN_W * 0.82, 340);
const EDGE_ZONE = 24; // px from left edge that counts as a swipe-start

interface SideMenuProps {
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Bottom-nav bar height so the toggle button clears it */
  tabBarHeight: number;
}

export function SideMenu({ visible, onOpen, onClose, tabBarHeight }: SideMenuProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { state, updateSettings, setStandaloneBlockAndAllowance, setDailyAllowanceEntries } = useApp();
  const { settings } = state;

  const translateX = useRef(new Animated.Value(-MENU_W)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keep a ref so PanResponder closures don't capture a stale `visible`
  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  const [blockModalVisible, setBlockModalVisible] = React.useState(false);
  const [dailyModalVisible, setDailyModalVisible] = React.useState(false);

  // Animate panel in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -MENU_W, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateX, backdropOpacity]);

  // Swipe gesture — uses ref so closures always see current open/closed state
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, gs) => {
        const isOpen = visibleRef.current;
        if (!isOpen && e.nativeEvent.pageX < EDGE_ZONE && gs.dx > 8) return true;
        if (isOpen && gs.dx < -8) return true;
        return false;
      },
      onPanResponderMove: (_, gs) => {
        const isOpen = visibleRef.current;
        if (isOpen) {
          const x = Math.min(0, gs.dx);
          translateX.setValue(x);
          backdropOpacity.setValue(Math.max(0, 1 + x / MENU_W));
        } else {
          const x = Math.min(0, -MENU_W + gs.dx);
          translateX.setValue(x);
          backdropOpacity.setValue(Math.max(0, gs.dx / MENU_W));
        }
      },
      onPanResponderRelease: (_, gs) => {
        const isOpen = visibleRef.current;
        if (isOpen) {
          gs.dx < -MENU_W * 0.3 ? onClose() : onOpen();
        } else {
          gs.dx > MENU_W * 0.3 ? onOpen() : onClose();
        }
      },
    })
  ).current;

  const profile = settings.userProfile;
  const initials = profile?.name
    ? profile.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const standaloneActive = (() => {
    if (!settings.standaloneBlockUntil) return false;
    if ((settings.standaloneBlockPackages ?? []).length === 0) return false;
    return new Date(settings.standaloneBlockUntil).getTime() > Date.now();
  })();

  const handleSaveStandaloneBlock = async (packages: string[], untilMs: number | null, allowanceEntries: DailyAllowanceEntry[], vpnPackages?: string[], pinHash?: string | null) => {
    await setStandaloneBlockAndAllowance(packages, untilMs, allowanceEntries, vpnPackages, pinHash ?? null);
  };

  const navigate = useCallback((path: string) => {
    onClose();
    setTimeout(() => router.push(path as never), 280);
  }, [onClose]);

  const openModal = useCallback((modal: 'block' | 'daily') => {
    onClose();
    setTimeout(() => {
      if (modal === 'block') setBlockModalVisible(true);
      if (modal === 'daily') setDailyModalVisible(true);
    }, 280);
  }, [onClose]);

  return (
    <>
      {/* Thin left-edge strip — catches swipe-right when menu is closed */}
      {!visible && (
        <View
          style={styles.edgeStrip}
          {...panResponder.panHandlers}
        />
      )}

      {/* Backdrop */}
      {visible && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="auto"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>
      )}

      {/* Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            width: MENU_W,
            backgroundColor: isDark ? COLORS.darkCard : '#fff',
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
        {...panResponder.panHandlers}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 0 }}
          bounces={false}
        >
          {/* ── Profile ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.profileRow, { borderBottomColor: isDark ? COLORS.darkBorder : COLORS.border }]}
            onPress={() => navigate('/user-profile')}
            activeOpacity={0.75}
          >
            <View style={[styles.avatar, { backgroundColor: COLORS.primary + '22' }]}>
              <Text style={[styles.avatarText, { color: COLORS.primary }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.profileName, { color: isDark ? COLORS.darkText : COLORS.text }]} numberOfLines={1}>
                {profile?.name ?? 'Set up profile'}
              </Text>
              {profile?.occupation && (
                <Text style={[styles.profileSub, { color: isDark ? COLORS.muted : COLORS.textSecondary }]} numberOfLines={1}>
                  {profile.occupation}
                  {profile.dailyGoalHours ? `  ·  ${profile.dailyGoalHours}h goal` : ''}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? COLORS.muted : COLORS.border} />
          </TouchableOpacity>

          {/* ── Live status ─────────────────────────────────────────── */}
          <MenuSection label="Live">
            <MenuItem
              icon="pulse-outline"
              label="Active"
              description="Live status of every block running now"
              onPress={() => navigate('/active')}
              isDark={isDark}
              isLast
            />
          </MenuSection>

          {/* ── Block Controls ───────────────────────────────────────── */}
          <MenuSection label="Block Controls">
            <MenuItem
              icon="ban-outline"
              label="Standalone Block"
              badge={standaloneActive ? 'active' : undefined}
              onPress={() => openModal('block')}
              isDark={isDark}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Task Focus"
              description="Focus Mode tied to your task"
              onPress={() => navigate('/(tabs)/focus')}
              isDark={isDark}
            />
            <MenuItem
              icon="sunny-outline"
              label="Daily Allowance"
              description={
                (settings.dailyAllowanceEntries ?? []).length > 0
                  ? `${(settings.dailyAllowanceEntries ?? []).length} app${(settings.dailyAllowanceEntries ?? []).length !== 1 ? 's' : ''} configured`
                  : 'Per-app usage limits'
              }
              onPress={() => openModal('daily')}
              isDark={isDark}
              isLast
            />
          </MenuSection>

          {/* ── Block Enforcement ───────────────────────────────────── */}
          <MenuSection
            label="Block Enforcement"
            subtitle="The layers that make blocks impossible to bypass"
          >
            <MenuItem
              icon="text-outline"
              label="Keyword Blocker"
              description={
                (settings.blockedWords ?? []).length > 0
                  ? `${(settings.blockedWords ?? []).length} keywords active`
                  : 'Block by on-screen text'
              }
              onPress={() => navigate('/keyword-blocker')}
              isDark={isDark}
            />
            <MenuItem
              icon="lock-closed-outline"
              label="System Protection"
              description="Power menu, Settings lockdown"
              badge={(settings.systemGuardEnabled ?? false) ? 'on' : undefined}
              onPress={() => navigate('/block-defense?tab=system')}
              isDark={isDark}
            />
            <MenuItem
              icon="flash-outline"
              label="Aversion Deterrents"
              description="Dimmer, vibration, alarm"
              onPress={() => navigate('/block-defense?tab=aversion')}
              isDark={isDark}
            />
            <MenuItem
              icon="time-outline"
              label="Block Schedules"
              description={
                (settings.greyoutSchedule ?? []).length > 0
                  ? `${(settings.greyoutSchedule ?? []).length} time window${(settings.greyoutSchedule ?? []).length !== 1 ? 's' : ''}`
                  : 'Block apps during set hours'
              }
              onPress={() => navigate('/block-defense?tab=greyout')}
              isDark={isDark}
              isLast
            />
          </MenuSection>

          {/* ── Insights ─────────────────────────────────────────────── */}
          <MenuSection label="Insights">
            <MenuItem
              icon="bar-chart-outline"
              label="Stats"
              description="Yesterday's digest, focus time, streaks, blocked apps"
              onPress={() => navigate('/(tabs)/stats')}
              isDark={isDark}
              isLast
            />
          </MenuSection>
        </ScrollView>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={[styles.footer, { borderTopColor: isDark ? COLORS.darkBorder : COLORS.border }]}>
          {/* Windows PC link — full-width row above the other links */}
          <TouchableOpacity
            style={styles.footerPcBtn}
            onPress={() => Linking.openURL('https://focusflowpc.pages.dev/')}
          >
            <Ionicons name="desktop-outline" size={13} color={COLORS.primary} />
            <Text style={[styles.footerText, { color: COLORS.primary, fontWeight: '600' }]}>Also on Windows — focusflowpc.pages.dev</Text>
          </TouchableOpacity>
          {/* Standard links row */}
          <View style={styles.footerLinks}>
            <TouchableOpacity style={styles.footerBtn} onPress={() => navigate('/privacy-policy')}>
              <Ionicons name="shield-outline" size={14} color={isDark ? COLORS.muted : COLORS.textSecondary} />
              <Text style={[styles.footerText, { color: isDark ? COLORS.muted : COLORS.textSecondary }]}>Privacy</Text>
            </TouchableOpacity>
            <View style={[styles.footerDivider, { backgroundColor: isDark ? COLORS.darkBorder : COLORS.border }]} />
            <TouchableOpacity style={styles.footerBtn} onPress={() => navigate('/terms-of-service')}>
              <Ionicons name="document-text-outline" size={14} color={isDark ? COLORS.muted : COLORS.textSecondary} />
              <Text style={[styles.footerText, { color: isDark ? COLORS.muted : COLORS.textSecondary }]}>Terms</Text>
            </TouchableOpacity>
            <View style={[styles.footerDivider, { backgroundColor: isDark ? COLORS.darkBorder : COLORS.border }]} />
            <TouchableOpacity style={styles.footerBtn} onPress={() => navigate('/how-to-use')}>
              <Ionicons name="help-circle-outline" size={14} color={isDark ? COLORS.muted : COLORS.textSecondary} />
              <Text style={[styles.footerText, { color: isDark ? COLORS.muted : COLORS.textSecondary }]}>How to Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ── Block modals (rendered outside the panel so they cover full screen) ── */}
      <StandaloneBlockModal
        visible={blockModalVisible}
        blockedPackages={settings.standaloneBlockPackages ?? []}
        blockUntil={settings.standaloneBlockUntil}
        locked={standaloneActive}
        dailyAllowanceEntries={settings.dailyAllowanceEntries ?? []}
        blockPresets={settings.blockPresets ?? []}
        onSave={handleSaveStandaloneBlock}
        onSavePreset={async (preset) => {
          const presets = [...(settings.blockPresets ?? []), preset];
          await updateSettings({ ...settings, blockPresets: presets });
        }}
        onDeletePreset={async (id) => {
          const presets = (settings.blockPresets ?? []).filter((p) => p.id !== id);
          await updateSettings({ ...settings, blockPresets: presets });
        }}
        onClose={() => setBlockModalVisible(false)}
      />

      <DailyAllowanceModal
        visible={dailyModalVisible}
        selectedEntries={settings.dailyAllowanceEntries ?? []}
        locked={standaloneActive}
        requireDefensePin={true}
        onSave={async (entries) => { await setDailyAllowanceEntries(entries); }}
        onClose={() => setDailyModalVisible(false)}
      />

    </>
  );
}

// ─── ">" Toggle button — rendered by the tabs _layout above the bottom nav ────

interface SideMenuToggleProps {
  onPress: () => void;
  isOpen: boolean;
  tabBarHeight: number;
}

export function SideMenuToggle({ onPress, isOpen, tabBarHeight }: SideMenuToggleProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, tension: 80, friction: 6 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }).start();

  return (
    <Animated.View
      style={[
        styles.toggle,
        {
          bottom: tabBarHeight + 16,
          backgroundColor: isDark ? COLORS.darkCard : '#fff',
          borderColor: isDark ? COLORS.darkBorder : COLORS.border,
          transform: [{ scale }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.toggleInner}
      >
        <Ionicons
          name={isOpen ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={COLORS.primary}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Guide tip — shown once after onboarding ─────────────────────────────────

interface SideMenuGuideTipProps {
  visible: boolean;
  onDismiss: () => void;
  tabBarHeight: number;
}

export function SideMenuGuideTip({ visible, onDismiss, tabBarHeight }: SideMenuGuideTipProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, opacity, translateY, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.guideTip,
        {
          bottom: tabBarHeight + 64,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Left-pointing arrow tip (points toward the › toggle button) */}
      <View style={styles.guideTipArrow} />
      <View style={styles.guideTipBubble}>
        <Text style={styles.guideTipText}>Swipe right or tap › to open the quick menu</Text>
      </View>
    </Animated.View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MenuSection({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: isDark ? COLORS.muted : COLORS.textSecondary }]}>
          {label.toUpperCase()}
        </Text>
      </View>
      {subtitle && (
        <Text style={[styles.sectionSubtitle, { color: isDark ? '#4b5563' : '#9ca3af' }]}>{subtitle}</Text>
      )}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#f9fafb', borderColor: isDark ? COLORS.darkBorder : COLORS.border }]}>
        {children}
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  description,
  badge,
  onPress,
  isDark,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  badge?: string;
  onPress: () => void;
  isDark: boolean;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? COLORS.darkBorder : COLORS.border },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[styles.menuItemIcon, { backgroundColor: COLORS.primary + '18' }]}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.menuItemLabel, { color: isDark ? COLORS.darkText : COLORS.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.menuItemDesc, { color: isDark ? '#6b7280' : COLORS.textSecondary }]} numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
      {badge && (
        <View style={[
          styles.badge,
          badge === 'active' && { backgroundColor: COLORS.green + '22' },
          badge === 'on' && { backgroundColor: COLORS.primary + '22' },
        ]}>
          <Text style={[
            styles.badgeText,
            badge === 'active' && { color: COLORS.green },
            badge === 'on' && { color: COLORS.primary },
          ]}>
            {badge === 'active' ? 'ACTIVE' : badge === 'on' ? 'ON' : badge.toUpperCase()}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={14} color={isDark ? '#374151' : '#d1d5db'} />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  edgeStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: EDGE_ZONE,
    zIndex: 810,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
    zIndex: 800,
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 900,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: SPACING.xs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FONT.md,
    fontWeight: '700',
  },
  profileName: {
    fontSize: FONT.md,
    fontWeight: '700',
  },
  profileSub: {
    fontSize: FONT.xs,
  },
  section: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: FONT.xs - 1,
    marginBottom: 4,
  },
  sectionCard: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  menuItemIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    fontSize: FONT.sm,
    fontWeight: '600',
  },
  menuItemDesc: {
    fontSize: FONT.xs,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'column',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  footerPcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: FONT.xs,
  },
  footerDivider: {
    width: 1,
    height: 12,
  },
  // Toggle button
  toggle: {
    position: 'absolute',
    left: 0,
    zIndex: 850,
    width: 28,
    height: 36,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 6,
  },
  toggleInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Guide tip
  guideTip: {
    position: 'absolute',
    left: 32,
    zIndex: 860,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideTipArrow: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: COLORS.primary,
  },
  guideTipBubble: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 230,
  },
  guideTipText: {
    color: '#fff',
    fontSize: FONT.xs,
    fontWeight: '600',
  },
});
