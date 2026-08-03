/**
 * vpn-block-list.tsx
 *
 * Standalone VPN Block List — a dedicated screen for managing which apps
 * are network-blocked via the always-on VPN, independently of the overlay
 * (accessibility) block list. Apps added here have their internet access
 * cut 24/7 without needing to be in the overlay block list.
 *
 * PIN gating:
 *   - Adding apps → no password required
 *   - Removing apps (save with fewer apps than original) → defense password required
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
import { PinVerifyModal } from '@/components/PinVerifyModal';

const SYSTEM_NEVER_BLOCK = new Set([
  'com.android.dialer',
  'com.google.android.dialer',
  'com.samsung.android.dialer',
  'com.whatsapp',
]);

export default function VpnBlockListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(settings.alwaysOnVpnPackages ?? [])
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);

  const originalPkgsRef = useRef<Set<string>>(new Set(settings.alwaysOnVpnPackages ?? []));
  const pendingPinAction = useRef<(() => void) | null>(null);

  const withDefensePin = useCallback((action: () => void) => {
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => {
        if (hash) {
          pendingPinAction.current = action;
          setPinVerifyVisible(true);
        } else {
          action();
        }
      })
      .catch(() => action());
  }, []);

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
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  }, []);

  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      const vpnPkgs = Array.from(selected);
      await updateSettings({
        ...settings,
        alwaysOnVpnPackages: vpnPkgs,
      });
      router.back();
    } catch {
      Alert.alert('Save failed', 'Could not save the VPN block list. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selected, settings, updateSettings]);

  const handleSave = () => {
    const originalPkgs = originalPkgsRef.current;
    const isRemoving = [...originalPkgs].some((pkg) => !selected.has(pkg));
    if (isRemoving) {
      withDefensePin(() => void doSave());
      return;
    }
    void doSave();
  };

  const handleClearAll = () => {
    if (selected.size === 0) return;
    withDefensePin(() => {
      Alert.alert(
        'Clear VPN block list?',
        'This removes all apps from network blocking. Their internet access will no longer be restricted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear all',
            style: 'destructive',
            onPress: () => setSelected(new Set()),
          },
        ]
      );
    });
  };

  const renderItem = ({ item }: { item: InstalledApp }) => {
    const checked = selected.has(item.packageName);
    const overlayBlocked = (settings.alwaysOnPackages ?? []).includes(item.packageName);

    return (
      <TouchableOpacity
        style={[
          styles.appRow,
          { borderBottomColor: theme.border },
          checked && { backgroundColor: COLORS.primary + '0D' },
        ]}
        onPress={() => toggle(item.packageName)}
        activeOpacity={0.7}
      >
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
          <View style={styles.appNameRow}>
            <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
              {item.appName}
            </Text>
            {overlayBlocked && (
              <View style={[styles.overlayBadge, { backgroundColor: COLORS.orange + '22', borderColor: COLORS.orange + '44' }]}>
                <Ionicons name="infinite-outline" size={9} color={COLORS.orange} />
                <Text style={[styles.overlayBadgeText, { color: COLORS.orange }]}>overlay</Text>
              </View>
            )}
          </View>
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
          <Text style={[styles.title, { color: theme.text }]}>VPN Block List</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {selected.size > 0
              ? `${selected.size} app${selected.size !== 1 ? 's' : ''} network-blocked 24/7`
              : 'Cut internet access — no overlay needed'}
          </Text>
        </View>
        {selected.size > 0 && (
          <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearBtn, { color: COLORS.red }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner */}
      <View style={[styles.banner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '33' }]}>
        <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
        <Text style={[styles.bannerText, { color: theme.text }]}>
          Ticked apps have their internet access cut via a local VPN — 24/7, no session needed.
          {'\n'}
          <Text style={{ color: theme.muted }}>
            Nothing leaves your device. Works independently of the overlay block list. Apps marked "overlay" are also blocked by the Accessibility Service.
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

      <PinVerifyModal
        visible={pinVerifyVisible}
        pinType="defense"
        title="Defense Password Required"
        description="You are removing apps from the VPN block list. Enter your defense password to confirm."
        onVerified={() => {
          setPinVerifyVisible(false);
          pendingPinAction.current?.();
          pendingPinAction.current = null;
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
  appIcon: { width: 40, height: 40, borderRadius: RADIUS.sm },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: { flex: 1, gap: 2 },
  appNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  appName: { fontSize: FONT.sm, fontWeight: '600' },
  overlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  overlayBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  appPkg: { fontSize: FONT.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
