/**
 * always-on.tsx
 *
 * Always-On Enforcement screen — a persistent app block list that runs
 * 24/7 with no timer. Apps in this list stay blocked forever until the
 * user explicitly removes them. No sessions, no expiry — just tick and save.
 *
 * PIN gating:
 *   - Adding apps → no password required
 *   - Removing apps (save with fewer apps than original) → defense password required
 *
 * Each selected (blocked) app also shows a per-app VPN toggle so you can
 * cut network access independently of the overlay block.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { InstalledAppsModule, InstalledApp } from '@/native-modules/InstalledAppsModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { NetworkBlockModule } from '@/native-modules/NetworkBlockModule';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SYSTEM_NEVER_BLOCK } from '@/services/protectedApps';

export default function AlwaysOnScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(settings.alwaysOnPackages ?? [])
  );
  const [vpnSelected, setVpnSelected] = useState<Set<string>>(
    new Set(settings.alwaysOnVpnPackages ?? [])
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);

  // Track the original selection at mount time to detect removals
  const originalPkgsRef = useRef<Set<string>>(new Set(settings.alwaysOnPackages ?? []));
  const originalVpnPkgsRef = useRef<Set<string>>(new Set(settings.alwaysOnVpnPackages ?? []));
  const blockProtectionActive =
    state.focusSession?.isActive === true ||
    (
      !!settings.standaloneBlockUntil &&
      (settings.standaloneBlockPackages ?? []).length > 0 &&
      new Date(settings.standaloneBlockUntil).getTime() > Date.now()
    );

  useEffect(() => {
    InstalledAppsModule.getInstalledApps()
      .then((result) => setApps(result.filter((a) => !SYSTEM_NEVER_BLOCK.has(a.packageName))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
    );
  }, [apps, search]);

  const toggle = useCallback((pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
        // Also remove VPN if block is removed
        setVpnSelected((v) => {
          const vn = new Set(v);
          vn.delete(pkg);
          return vn;
        });
      } else {
        next.add(pkg);
      }
      return next;
    });
  }, []);

  const toggleVpn = useCallback((pkg: string) => {
    setVpnSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  }, []);

  const doSave = useCallback(async (defensePinHash: string | null = null) => {
    setSaving(true);
    try {
      const pkgs = Array.from(selected);
      const vpnPkgs = Array.from(vpnSelected);

      // VPN consent may have been revoked while this picker was open. Do not
      // save a new VPN list until Android confirms the grant again.
      if (vpnPkgs.length > 0) {
        const vpnGranted = await NetworkBlockModule.ensureVpnPermission();
        if (!vpnGranted) {
          Alert.alert(
            'VPN permission required',
            'Network blocking is selected, but Android VPN permission is not available. Grant it and tap Save again.',
          );
          return;
        }
      }

      await updateSettings({
        ...settings,
        alwaysOnPackages: pkgs,
        alwaysOnVpnPackages: vpnPkgs,
        vpnBlockEnabled:
          vpnPkgs.length > 0 || (settings.standaloneVpnPackages ?? []).length > 0,
      }, { defensePinHash });
      router.back();
    } catch {
      Alert.alert('Save failed', 'Could not save the always-on list. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selected, vpnSelected, settings, updateSettings]);

  const handleSave = async () => {
    // Detect if any originally-present packages are being removed
    const originalPkgs = originalPkgsRef.current;
    const originalVpnPkgs = originalVpnPkgsRef.current;
    const isRemoving =
      [...originalPkgs].some((pkg) => !selected.has(pkg)) ||
      [...originalVpnPkgs].some((pkg) => !vpnSelected.has(pkg));

    if (isRemoving && blockProtectionActive) {
      Alert.alert(
        'Network block is locked',
        'Always-on apps and VPN-blocked apps cannot be removed while Focus Mode or a Standalone Block is active.',
      );
      return;
    }

    if (isRemoving) {
      try {
        const hash = await SharedPrefsModule.getString('defense_pin_hash');
        if (hash) {
          setPinVerifyVisible(true);
          return;
        }
      } catch {}
    }

    await doSave();
  };

  const handleClearAll = () => {
    if (selected.size === 0) return;
    Alert.alert(
      'Clear all?',
      'This removes all apps from the always-on enforcement list. They will no longer be blocked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => {
            setSelected(new Set());
            setVpnSelected(new Set());
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: InstalledApp }) => {
    const checked = selected.has(item.packageName);
    const vpnOn = vpnSelected.has(item.packageName);

    return (
      <View>
        <TouchableOpacity
          style={[
            styles.appRow,
            { borderBottomColor: theme.border },
            checked && { backgroundColor: COLORS.primary + '14' },
          ]}
          onPress={() => toggle(item.packageName)}
          activeOpacity={0.7}
        >
          {/* App icon */}
          {item.iconBase64 ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.iconBase64}` }}
              style={styles.appIcon}
            />
          ) : (
            <View style={[styles.appIconPlaceholder, { backgroundColor: theme.surface }]}>
              <Ionicons name="apps-outline" size={20} color={COLORS.muted} />
            </View>
          )}

          <View style={styles.appInfo}>
            <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
              {item.appName}
            </Text>
            <Text style={[styles.appPkg, { color: theme.muted }]} numberOfLines={1}>
              {item.packageName}
            </Text>
          </View>

          <View
            style={[
              styles.checkbox,
              { borderColor: checked ? COLORS.primary : theme.border },
              checked && { backgroundColor: COLORS.primary },
            ]}
          >
            {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>

        {/* VPN toggle — shown for selected apps */}
        {checked && (
          <TouchableOpacity
            style={[
              styles.vpnRow,
              { backgroundColor: theme.surface, borderBottomColor: theme.border },
              vpnOn && styles.vpnRowActive,
            ]}
            onPress={() => toggleVpn(item.packageName)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={vpnOn ? 'shield-checkmark-outline' : 'shield-outline'}
              size={13}
              color={vpnOn ? COLORS.primary : COLORS.muted}
            />
            <Text style={[styles.vpnText, vpnOn && styles.vpnTextActive]}>
              {vpnOn ? 'Network block (VPN): on' : 'Add network block (VPN)'}
            </Text>
            {vpnOn && (
              <View style={styles.vpnBadge}>
                <Text style={styles.vpnBadgeText}>ON</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={[styles.title, { color: theme.text }]}>Always-On Block List</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {selected.size > 0
              ? `${selected.size} app${selected.size !== 1 ? 's' : ''} blocked 24/7`
              : 'Tick apps to block them permanently — no timer'}
          </Text>
        </View>
        {selected.size > 0 && (
          <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearBtn, { color: COLORS.red }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner */}
      <View style={[styles.banner, { backgroundColor: COLORS.primary + '14', borderColor: COLORS.primary + '2E' }]}>
        <Ionicons name="infinite-outline" size={16} color={COLORS.primary} />
        <Text style={[styles.bannerText, { color: theme.text }]}>
          These apps are blocked continuously — no session or timer needed. They stay blocked until you untick them here.
          {'\n'}
          <Text style={{ color: theme.muted }}>
            Removing apps requires your defense password (if set). Tap a blocked app to also enable network blocking (VPN).
          </Text>
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search" size={16} color={COLORS.muted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search apps..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* App list */}
      {loading ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.muted }]}>Loading apps…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            {search ? 'No apps match your search' : 'No apps found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.packageName}
          renderItem={renderItem}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Save button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: COLORS.primary }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving…' : selected.size === 0 ? 'Save (no apps selected)' : `Save ${selected.size} app${selected.size !== 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Defense PIN verify modal — shown when saving removes apps */}
      <PinVerifyModal
        visible={pinVerifyVisible}
        pinType="defense"
        title="Defense Password Required"
        description="You are removing apps from the always-on block list. Enter your defense password to confirm."
        onVerified={(hash) => {
          setPinVerifyVisible(false);
          void doSave(hash);
        }}
        onCancel={() => setPinVerifyVisible(false)}
      />
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
  clearBtn: { fontSize: FONT.sm, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    margin: SPACING.md,
    marginBottom: 0,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: FONT.xs, lineHeight: 18 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: FONT.sm, padding: 0 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
  },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: { flex: 1, gap: 2 },
  appName: { fontSize: FONT.sm, fontWeight: '600' },
  appPkg: { fontSize: FONT.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs + 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  vpnRowActive: {
    backgroundColor: COLORS.primary + '12',
  },
  vpnText: {
    flex: 1,
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  vpnTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  vpnBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vpnBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyText: { fontSize: FONT.sm, textAlign: 'center' },
  footer: {
    padding: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: FONT.md, fontWeight: '700' },
});
