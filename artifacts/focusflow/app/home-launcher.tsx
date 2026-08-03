/**
 * home-launcher.tsx
 *
 * Home Launcher configuration screen.
 *
 * Accessible from:
 *   - Block Enforcement → Home Launcher section → "Configure Home Launcher"
 *   - Permissions screen → Home Launcher card (when granted) → "Configure Launcher Settings"
 *
 * Locked during active standalone block (same pattern as permissions.tsx).
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { InstalledAppsModule, InstalledApp } from '@/native-modules/InstalledAppsModule';

export default function HomeLauncherScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const standaloneActive = (() => {
    if (!settings.standaloneBlockUntil) return false;
    if ((settings.standaloneBlockPackages ?? []).length === 0) return false;
    return new Date(settings.standaloneBlockUntil).getTime() > Date.now();
  })();
  const isLocked = standaloneActive;

  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const [checkingDefault, setCheckingDefault] = useState(true);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const blockedPackages = useMemo(
    () => new Set([...(settings.standaloneBlockPackages ?? []), ...(settings.alwaysOnPackages ?? [])]),
    [settings.standaloneBlockPackages, settings.alwaysOnPackages],
  );

  const checkDefault = useCallback(async () => {
    setCheckingDefault(true);
    try {
      const result = await SharedPrefsModule.isDefaultLauncher();
      setIsDefault(result);
    } catch {
      setIsDefault(false);
    } finally {
      setCheckingDefault(false);
    }
  }, []);

  useEffect(() => {
    void checkDefault();
    InstalledAppsModule.getInstalledApps()
      .then(setApps)
      .catch(() => {})
      .finally(() => setLoadingApps(false));
  }, [checkDefault]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkDefault();
    });
    return () => sub.remove();
  }, [checkDefault]);

  const update = useCallback(
    async (partial: Partial<typeof settings>) => {
      try {
        await updateSettings({ ...settings, ...partial });
      } catch {
        Alert.alert('Error', 'Failed to save this setting. Please try again.');
      }
    },
    [settings, updateSettings],
  );

  const handleSetDefault = () => {
    Linking.sendIntent('android.settings.HOME_SETTINGS').catch(() =>
      Linking.sendIntent('android.settings.MANAGE_DEFAULT_APPS_SETTINGS').catch(() =>
        Linking.openSettings(),
      ),
    );
  };

  // ── Home screen grid (pinned) ────────────────────────────────────────────────
  const togglePinned = useCallback(
    (pkg: string) => {
      const pinned = new Set(settings.launcherPinnedPackages ?? []);
      if (pinned.has(pkg)) pinned.delete(pkg);
      else pinned.add(pkg);
      void update({ launcherPinnedPackages: Array.from(pinned) });
    },
    [settings.launcherPinnedPackages, update],
  );

  // ── Dock ─────────────────────────────────────────────────────────────────────
  const toggleDock = useCallback(
    (pkg: string) => {
      const dock = [...(settings.launcherDockPackages ?? [])];
      const idx = dock.indexOf(pkg);
      if (idx >= 0) {
        dock.splice(idx, 1);
      } else {
        if (dock.length >= 5) {
          Alert.alert(
            'Dock is full',
            'The dock holds up to 5 apps. Remove one first before adding another.',
          );
          return;
        }
        dock.push(pkg);
      }
      void update({ launcherDockPackages: dock });
    },
    [settings.launcherDockPackages, update],
  );

  // ── Drawer visibility ─────────────────────────────────────────────────────────
  const toggleHidden = useCallback(
    (pkg: string) => {
      const hidden = new Set(settings.launcherHiddenPackages ?? []);
      if (hidden.has(pkg)) hidden.delete(pkg);
      else {
        if (!blockedPackages.has(pkg)) {
          Alert.alert(
            'Only blocked apps can be hidden',
            'Add this app to your standalone block list or always-on list first, then hide it from the drawer.',
          );
          return;
        }
        hidden.add(pkg);
      }
      void update({ launcherHiddenPackages: Array.from(hidden) });
    },
    [settings.launcherHiddenPackages, blockedPackages, update],
  );

  const pinnedSet = useMemo(() => new Set(settings.launcherPinnedPackages ?? []), [settings.launcherPinnedPackages]);
  const dockSet   = useMemo(() => new Set(settings.launcherDockPackages ?? []),   [settings.launcherDockPackages]);
  const hiddenSet = useMemo(() => new Set(settings.launcherHiddenPackages ?? []), [settings.launcherHiddenPackages]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={[styles.title, { color: theme.text }]}>Home Launcher</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            FocusFlow as your default home screen
          </Text>
        </View>
      </View>

      {/* Full-screen lock during standalone block */}
      {isLocked ? (
        <View style={[styles.lockedScreen, { backgroundColor: theme.background }]}>
          <View style={[styles.lockedCard, { backgroundColor: theme.card, borderColor: COLORS.orange + '55' }]}>
            <View style={styles.lockedIconRing}>
              <Ionicons name="lock-closed" size={32} color={COLORS.orange} />
            </View>
            <Text style={[styles.lockedHeading, { color: theme.text }]}>Launcher Locked</Text>
            <Text style={[styles.lockedBody, { color: theme.muted }]}>
              Launcher settings are disabled while a standalone block is active.{'\n\n'}
              Stop the current block to change launcher configuration.
            </Text>
            <TouchableOpacity style={styles.lockedBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={16} color="#fff" />
              <Text style={styles.lockedBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        >

          {/* ── Status card ──────────────────────────────────────────── */}
          <View style={[styles.statusCard, {
            backgroundColor: isDefault ? COLORS.green + '12' : theme.card,
            borderColor: isDefault ? COLORS.green + '44' : theme.border,
          }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, {
                backgroundColor: (isDefault ? COLORS.green : COLORS.orange) + '20',
              }]}>
                {checkingDefault
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Ionicons
                      name={isDefault ? 'checkmark-circle' : 'alert-circle-outline'}
                      size={24}
                      color={isDefault ? COLORS.green : COLORS.orange}
                    />
                }
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.statusTitle, { color: theme.text }]}>
                  {checkingDefault
                    ? 'Checking...'
                    : isDefault
                    ? 'FocusFlow is your default home app'
                    : 'FocusFlow is not the default home app'}
                </Text>
                <Text style={[styles.statusDesc, { color: theme.muted }]}>
                  {isDefault
                    ? 'Every app tap routes through FocusFlow — zero reaction delay, no brief flashes of blocked apps.'
                    : 'Set FocusFlow as your home app to get instant interception. Your existing home screen is preserved and can be re-selected at any time.'}
                </Text>
              </View>
            </View>
            {!isDefault && (
              <TouchableOpacity style={styles.setDefaultBtn} onPress={handleSetDefault} activeOpacity={0.85}>
                <Ionicons name="home-outline" size={16} color="#fff" />
                <Text style={styles.setDefaultBtnText}>Set as Default Home App</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── How the launcher is laid out ─────────────────────────── */}
          <View style={[styles.layoutPreview, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.layoutTitle, { color: theme.text }]}>Launcher Layout</Text>
            <View style={styles.layoutRow}>
              <LayoutZone icon="time-outline" label="Clock + Date" desc="Always at the top" color={COLORS.primary} />
              <LayoutZone icon="grid-outline" label="Home Grid" desc="App shortcuts (4 col)" color={COLORS.green} />
              <LayoutZone icon="ellipse-outline" label="Dock" desc="Up to 5 pinned apps" color={COLORS.orange} />
            </View>
            <Text style={[styles.layoutHint, { color: theme.muted }]}>
              Swipe up from anywhere to open the full app drawer. Long-press any icon to add/remove or move between Home and Dock.
            </Text>
          </View>

          {/* ── Appearance ───────────────────────────────────────────── */}
          <SectionHeader
            icon="color-palette-outline"
            title="Appearance"
            description="Customise how the FocusFlow home screen looks."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Clock style</Text>
                <Text style={[styles.settingDesc, { color: theme.muted }]}>
                  {settings.launcherClockStyle === 'analog' ? 'Analog clock face' : 'Large digital time display (respects 24 h system setting)'}
                </Text>
              </View>
              <View style={styles.segmentControl}>
                {(['digital', 'analog'] as const).map((style) => (
                  <TouchableOpacity
                    key={style}
                    style={[
                      styles.segmentBtn,
                      (settings.launcherClockStyle ?? 'digital') === style && styles.segmentBtnActive,
                    ]}
                    onPress={() => void update({ launcherClockStyle: style })}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentText,
                      (settings.launcherClockStyle ?? 'digital') === style && styles.segmentTextActive,
                    ]}>
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() =>
                Alert.alert(
                  'Wallpaper',
                  'The launcher uses your Android system wallpaper by default.\n\nTo change it, use Android\'s built-in wallpaper picker from your previous home screen, or long-press the home screen background.',
                  [{ text: 'Got it' }],
                )
              }
              activeOpacity={0.75}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Wallpaper</Text>
                <Text style={[styles.settingDesc, { color: theme.muted }]}>
                  Uses your system wallpaper — change it from Android settings
                </Text>
              </View>
              <Ionicons name="image-outline" size={18} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* ── Dock ─────────────────────────────────────────────────── */}
          <SectionHeader
            icon="ellipse-outline"
            title="Dock"
            description="Up to 5 apps always visible at the bottom of the home screen — your most-used apps go here."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {loadingApps ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={[styles.loadingText, { color: theme.muted }]}>Loading installed apps…</Text>
              </View>
            ) : apps.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyText, { color: theme.muted }]}>No apps found — EAS build required</Text>
              </View>
            ) : (
              apps.slice(0, 30).map((app, idx) => (
                <AppToggleRow
                  key={app.packageName}
                  app={app}
                  checked={dockSet.has(app.packageName)}
                  onToggle={() => toggleDock(app.packageName)}
                  theme={theme}
                  isLast={idx === Math.min(apps.length, 30) - 1}
                  badge={blockedPackages.has(app.packageName) ? 'blocked' : undefined}
                  disabled={!dockSet.has(app.packageName) && dockSet.size >= 5}
                />
              ))
            )}
          </View>
          {(settings.launcherDockPackages ?? []).length >= 5 && (
            <Text style={[styles.moreAppsHint, { color: COLORS.orange }]}>
              Dock is full (5/5). Remove a dock app to add another.
            </Text>
          )}

          {/* ── Home Screen Grid ──────────────────────────────────────── */}
          <SectionHeader
            icon="grid-outline"
            title="Home Screen Grid"
            description="Apps shown in the 4-column grid on the main home screen. Long-press any icon on the home screen to add or remove. You can also use the list below."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {loadingApps ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={[styles.loadingText, { color: theme.muted }]}>Loading installed apps…</Text>
              </View>
            ) : apps.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyText, { color: theme.muted }]}>No apps found — EAS build required</Text>
              </View>
            ) : (
              apps.slice(0, 30).map((app, idx) => (
                <AppToggleRow
                  key={app.packageName}
                  app={app}
                  checked={pinnedSet.has(app.packageName)}
                  onToggle={() => togglePinned(app.packageName)}
                  theme={theme}
                  isLast={idx === Math.min(apps.length, 30) - 1}
                  badge={blockedPackages.has(app.packageName) ? 'blocked' : undefined}
                />
              ))
            )}
          </View>
          {apps.length > 30 && (
            <Text style={[styles.moreAppsHint, { color: theme.muted }]}>
              Showing first 30 apps. Search the full list in the launcher drawer, or long-press any icon there to add it.
            </Text>
          )}

          {/* ── App Drawer Visibility ────────────────────────────────── */}
          <SectionHeader
            icon="eye-off-outline"
            title="App Drawer Visibility"
            description="Completely hide blocked apps from the drawer so they don't appear at all. Only apps already in your block list can be hidden."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {blockedPackages.size === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
                <Text style={[styles.emptyText, { color: theme.muted }]}>
                  No blocked apps yet. Add apps to your standalone or always-on list to hide them from the drawer.
                </Text>
              </View>
            ) : (
              Array.from(blockedPackages).map((pkg, idx) => {
                const app = apps.find((a) => a.packageName === pkg);
                const name = app?.appName ?? pkg;
                return (
                  <AppToggleRow
                    key={pkg}
                    app={{ packageName: pkg, appName: name, isIme: false }}
                    checked={hiddenSet.has(pkg)}
                    onToggle={() => toggleHidden(pkg)}
                    theme={theme}
                    isLast={idx === blockedPackages.size - 1}
                    badge="blocked"
                  />
                );
              })
            )}
          </View>

          {/* ── Launcher Protections ─────────────────────────────────── */}
          <SectionHeader
            icon="shield-checkmark-outline"
            title="Launcher Protections"
            description="Extra guards that apply specifically because FocusFlow is your home screen."
            theme={theme}
          />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SwitchRow
              label="Lock launcher during standalone block"
              description="Intercepts the 'Default home app' Settings page and presses HOME while a standalone block is running — prevents switching away mid-session"
              value={settings.launcherLockDuringStandalone ?? true}
              onValueChange={(v) => void update({ launcherLockDuringStandalone: v })}
              theme={theme}
              isLast
            />
          </View>

          <View style={[styles.tipCard, { backgroundColor: theme.card, borderColor: COLORS.primary + '33' }]}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.tipText, { color: theme.muted }]}>
              <Text style={{ fontWeight: '700', color: theme.text }}>How it works: </Text>
              The launcher reads your block list directly from storage — no accessibility service round-trip needed. Blocked apps dim immediately and the block overlay appears before the app even starts. Unblocked apps launch normally.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LayoutZone({ icon, label, desc, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; desc: string; color: string }) {
  return (
    <View style={styles.layoutZone}>
      <View style={[styles.layoutZoneIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.layoutZoneLabel}>{label}</Text>
      <Text style={styles.layoutZoneDesc}>{desc}</Text>
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
    <View style={[styles.switchRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
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

function AppToggleRow({
  app,
  checked,
  onToggle,
  theme,
  isLast,
  badge,
  disabled = false,
}: {
  app: { packageName: string; appName: string; isIme: boolean };
  checked: boolean;
  onToggle: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  isLast?: boolean;
  badge?: 'blocked';
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.appRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        disabled && { opacity: 0.45 },
      ]}
      onPress={disabled ? undefined : onToggle}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.appIconPlaceholder, { backgroundColor: COLORS.primary + '18' }]}>
        <Ionicons name="apps-outline" size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
          <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
            {app.appName}
          </Text>
          {badge === 'blocked' && (
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedBadgeText}>blocked</Text>
            </View>
          )}
        </View>
        <Text style={[styles.appPkg, { color: theme.muted }]} numberOfLines={1}>
          {app.packageName}
        </Text>
      </View>
      <Switch
        value={checked}
        onValueChange={disabled ? undefined : onToggle}
        disabled={disabled}
        trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
        thumbColor={checked ? COLORS.primary : COLORS.muted}
      />
    </TouchableOpacity>
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
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },

  statusCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  statusTitle: { fontSize: FONT.sm, fontWeight: '700' },
  statusDesc: { fontSize: FONT.xs, lineHeight: 17 },
  setDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
  setDefaultBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },

  layoutPreview: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  layoutTitle: { fontSize: FONT.sm, fontWeight: '700' },
  layoutRow: { flexDirection: 'row', gap: SPACING.sm },
  layoutZone: { flex: 1, alignItems: 'center', gap: 4 },
  layoutZoneIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutZoneLabel: { fontSize: FONT.xs, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  layoutZoneDesc: { fontSize: 10, color: '#888', textAlign: 'center', lineHeight: 14 },
  layoutHint: { fontSize: FONT.xs, lineHeight: 17 },

  sectionHeader: { gap: 4, marginBottom: SPACING.xs },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: FONT.md, fontWeight: '700' },
  sectionDesc: { fontSize: FONT.xs, lineHeight: 18, paddingLeft: 28 + SPACING.sm },

  card: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  settingLabel: { fontSize: FONT.sm, fontWeight: '600' },
  settingDesc: { fontSize: FONT.xs, lineHeight: 17 },

  segmentControl: {
    flexDirection: 'row',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: 'transparent',
  },
  segmentBtnActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: FONT.xs, fontWeight: '600', color: COLORS.muted },
  segmentTextActive: { color: '#fff' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  switchLabel: { fontSize: FONT.sm, fontWeight: '600' },
  switchDesc: { fontSize: FONT.xs, lineHeight: 17 },

  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  appIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  appName: { fontSize: FONT.sm, fontWeight: '600' },
  appPkg: { fontSize: 11 },
  blockedBadge: {
    backgroundColor: COLORS.orange + '22',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.orange + '55',
  },
  blockedBadgeText: { fontSize: 9, color: COLORS.orange, fontWeight: '700' },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  loadingText: { fontSize: FONT.sm },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  emptyText: { fontSize: FONT.xs, flex: 1, lineHeight: 17 },
  moreAppsHint: { fontSize: FONT.xs, textAlign: 'center', marginTop: -SPACING.xs, lineHeight: 17 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  tipText: { flex: 1, fontSize: FONT.xs, lineHeight: 18 },

  lockedScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  lockedCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  lockedIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.orange + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  lockedHeading: { fontSize: FONT.xl, fontWeight: '800', textAlign: 'center' },
  lockedBody: { fontSize: FONT.sm, textAlign: 'center', lineHeight: 21 },
  lockedBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
  },
  lockedBackText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
});
