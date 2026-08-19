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
  Image,
  TextInput,
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
import { NativeImagePickerModule } from '@/native-modules/NativeImagePickerModule';

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
  const [searchQuery, setSearchQuery] = useState('');

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
  const appByPackage = useMemo(
    () => new Map(apps.map((app) => [app.packageName, app])),
    [apps],
  );
  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return apps;
    return apps.filter(
      (app) =>
        app.appName.toLowerCase().includes(query) ||
        app.packageName.toLowerCase().includes(query),
    );
  }, [apps, searchQuery]);
  const pinnedApps = useMemo(
    () => (settings.launcherPinnedPackages ?? [])
      .map((pkg) => appByPackage.get(pkg))
      .filter((app): app is InstalledApp => Boolean(app)),
    [appByPackage, settings.launcherPinnedPackages],
  );
  const dockApps = useMemo(
    () => (settings.launcherDockPackages ?? [])
      .map((pkg) => appByPackage.get(pkg))
      .filter((app): app is InstalledApp => Boolean(app)),
    [appByPackage, settings.launcherDockPackages],
  );

  const movePinned = useCallback(
    (pkg: string, delta: -1 | 1) => {
      const next = [...(settings.launcherPinnedPackages ?? [])];
      const from = next.indexOf(pkg);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= next.length) return;
      [next[from], next[to]] = [next[to], next[from]];
      void update({ launcherPinnedPackages: next });
    },
    [settings.launcherPinnedPackages, update],
  );

  const moveDock = useCallback(
    (pkg: string, delta: -1 | 1) => {
      const next = [...(settings.launcherDockPackages ?? [])];
      const from = next.indexOf(pkg);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= next.length) return;
      [next[from], next[to]] = [next[to], next[from]];
      void update({ launcherDockPackages: next });
    },
    [settings.launcherDockPackages, update],
  );

  const handlePickWallpaper = useCallback(async () => {
    try {
      const uri = await NativeImagePickerModule.pickImage();
      if (!uri) return;
      const path = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
      await update({ launcherWallpaperUri: path });
      await SharedPrefsModule.putString('launcher_wallpaper', path);
    } catch {
      Alert.alert(
        'Could Not Pick Image',
        'Please grant photo access in Settings, then try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  }, [update]);

  const handleClearWallpaper = useCallback(async () => {
    await update({ launcherWallpaperUri: null });
    await SharedPrefsModule.putString('launcher_wallpaper', '');
  }, [update]);

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

          {/* ── Live launcher preview ─────────────────────────────────── */}
          <LauncherPreview
            pinnedApps={pinnedApps}
            dockApps={dockApps}
            wallpaperUri={settings.launcherWallpaperUri ?? null}
            theme={theme}
          />

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
              onPress={() => void handlePickWallpaper()}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  {settings.launcherWallpaperUri ? 'Custom wallpaper' : 'Wallpaper'}
                </Text>
                <Text style={[styles.settingDesc, { color: theme.muted }]}>
                  {settings.launcherWallpaperUri
                    ? 'Tap to choose a different image'
                    : 'Uses your system wallpaper by default — tap to choose an image'}
                </Text>
              </View>
              {settings.launcherWallpaperUri ? (
                <TouchableOpacity
                  onPress={() => void handleClearWallpaper()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={theme.muted} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="image-outline" size={18} color={theme.muted} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── App library search ────────────────────────────────────── */}
          <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search all installed apps"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.searchHint, { color: theme.muted }]}>
            {searchQuery
              ? `${filteredApps.length} matching app${filteredApps.length === 1 ? '' : 's'}`
              : `${apps.length} installed apps · select below to customize your launcher`}
          </Text>

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
              <>
                {dockApps.length > 0 && (
                  <View style={[styles.orderSection, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.orderTitle, { color: theme.text }]}>Dock order</Text>
                    {dockApps.map((app, index) => (
                      <OrderedAppRow
                        key={app.packageName}
                        app={app}
                        index={index}
                        total={dockApps.length}
                        onMove={moveDock}
                        theme={theme}
                      />
                    ))}
                  </View>
                )}
                {filteredApps.map((app) => (
                  <AppToggleRow
                    key={app.packageName}
                    app={app}
                    checked={dockSet.has(app.packageName)}
                    onToggle={() => toggleDock(app.packageName)}
                    theme={theme}
                    badge={blockedPackages.has(app.packageName) ? 'blocked' : undefined}
                    disabled={!dockSet.has(app.packageName) && dockSet.size >= 5}
                  />
                ))}
                {filteredApps.length === 0 && (
                  <View style={styles.emptyRow}>
                    <Text style={[styles.emptyText, { color: theme.muted }]}>No installed apps match this search.</Text>
                  </View>
                )}
              </>
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
              <>
                {pinnedApps.length > 0 && (
                  <View style={[styles.orderSection, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.orderTitle, { color: theme.text }]}>Home grid order</Text>
                    {pinnedApps.map((app, index) => (
                      <OrderedAppRow
                        key={app.packageName}
                        app={app}
                        index={index}
                        total={pinnedApps.length}
                        onMove={movePinned}
                        theme={theme}
                      />
                    ))}
                  </View>
                )}
                {filteredApps.map((app) => (
                  <AppToggleRow
                    key={app.packageName}
                    app={app}
                    checked={pinnedSet.has(app.packageName)}
                    onToggle={() => togglePinned(app.packageName)}
                    theme={theme}
                    badge={blockedPackages.has(app.packageName) ? 'blocked' : undefined}
                  />
                ))}
                {filteredApps.length === 0 && (
                  <View style={styles.emptyRow}>
                    <Text style={[styles.emptyText, { color: theme.muted }]}>No installed apps match this search.</Text>
                  </View>
                )}
              </>
            )}
          </View>

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
                return (
                  <AppToggleRow
                    key={pkg}
                    app={app ?? { packageName: pkg, appName: pkg, isIme: false }}
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

function LauncherPreview({
  pinnedApps,
  dockApps,
  wallpaperUri,
  theme,
}: {
  pinnedApps: InstalledApp[];
  dockApps: InstalledApp[];
  wallpaperUri: string | null;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={[styles.layoutTitle, { color: theme.text }]}>Live launcher preview</Text>
          <Text style={[styles.previewSubtitle, { color: theme.muted }]}>Updates as you change the lists below</Text>
        </View>
        <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.phoneFrame}>
        {wallpaperUri ? (
          <Image source={{ uri: wallpaperUri }} style={styles.previewWallpaper} resizeMode="cover" />
        ) : (
          <View style={styles.previewWallpaperFallback} />
        )}
        <View style={styles.previewScrim} />
        <View style={styles.previewContent}>
          <Text style={styles.previewDate}>MONDAY · AUG 17</Text>
          <Text style={styles.previewClock}>9:41</Text>
          <View style={styles.previewGrid}>
            {pinnedApps.slice(0, 8).map((app) => (
              <PreviewAppIcon key={app.packageName} app={app} />
            ))}
            {pinnedApps.length === 0 && (
              <Text style={styles.previewEmpty}>Choose apps for your home grid below</Text>
            )}
          </View>
          <View style={styles.previewDock}>
            {dockApps.slice(0, 5).map((app) => (
              <PreviewAppIcon key={app.packageName} app={app} small />
            ))}
            {dockApps.length === 0 && <Ionicons name="ellipse-outline" size={20} color="#B9C2D0" />}
          </View>
        </View>
      </View>
    </View>
  );
}

function PreviewAppIcon({ app, small = false }: { app: InstalledApp; small?: boolean }) {
  return app.iconBase64 ? (
    <Image
      source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
      style={small ? styles.previewDockIcon : styles.previewAppIcon}
    />
  ) : (
    <View style={[small ? styles.previewDockIcon : styles.previewAppIcon, styles.previewIconFallback]}>
      <Ionicons name="apps-outline" size={small ? 14 : 18} color="#E7EAF6" />
    </View>
  );
}

function OrderedAppRow({
  app,
  index,
  total,
  onMove,
  theme,
}: {
  app: InstalledApp;
  index: number;
  total: number;
  onMove: (packageName: string, delta: -1 | 1) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.orderRow}>
      {app.iconBase64 ? (
        <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.orderIcon} />
      ) : (
        <View style={[styles.orderIcon, styles.appIconPlaceholder]}>
          <Ionicons name="apps-outline" size={16} color={COLORS.primary} />
        </View>
      )}
      <Text style={[styles.orderName, { color: theme.text }]} numberOfLines={1}>{app.appName}</Text>
      <TouchableOpacity
        onPress={() => onMove(app.packageName, -1)}
        disabled={index === 0}
        style={styles.orderButton}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-up" size={18} color={index === 0 ? theme.border : theme.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onMove(app.packageName, 1)}
        disabled={index === total - 1}
        style={styles.orderButton}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-down" size={18} color={index === total - 1 ? theme.border : theme.text} />
      </TouchableOpacity>
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
  app: { packageName: string; appName: string; isIme: boolean; iconBase64?: string };
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
      {app.iconBase64 ? (
        <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.appIcon} />
      ) : (
        <View style={[styles.appIconPlaceholder, { backgroundColor: COLORS.primary + '18' }]}>
          <Ionicons name="apps-outline" size={18} color={COLORS.primary} />
        </View>
      )}
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
  layoutZoneLabel: { fontSize: FONT.xs, fontWeight: '700', color: '#F5F7FF', textAlign: 'center' },
  layoutZoneDesc: { fontSize: 10, color: '#888', textAlign: 'center', lineHeight: 14 },
  layoutHint: { fontSize: FONT.xs, lineHeight: 17 },
  previewCard: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewSubtitle: { fontSize: FONT.xs, marginTop: 2 },
  phoneFrame: {
    width: '72%',
    aspectRatio: 0.54,
    maxHeight: 310,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 5,
    borderColor: '#242A3A',
    backgroundColor: '#111421',
    position: 'relative',
  },
  previewWallpaper: {
    ...StyleSheet.absoluteFillObject,
  },
  previewWallpaperFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#172B4D',
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A14CC',
  },
  previewContent: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    justifyContent: 'space-between',
  },
  previewDate: {
    color: '#B3B8CA',
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  previewClock: {
    color: '#F5F7FF',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -SPACING.md,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    gap: SPACING.sm,
    flex: 1,
    paddingVertical: SPACING.sm,
  },
  previewAppIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  previewDock: {
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: '#38FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  previewDockIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  previewIconFallback: {
    backgroundColor: '#242A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmpty: {
    color: '#B3B8CA',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: FONT.sm, paddingVertical: 0 },
  searchHint: { fontSize: FONT.xs, marginTop: -SPACING.xs },
  orderSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderTitle: { fontSize: FONT.xs, fontWeight: '700', marginBottom: SPACING.xs },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    gap: SPACING.sm,
  },
  orderIcon: { width: 28, height: 28, borderRadius: 6, flexShrink: 0 },
  orderName: { flex: 1, fontSize: FONT.sm, fontWeight: '600' },
  orderButton: { width: 28, alignItems: 'center', justifyContent: 'center' },

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
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
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
