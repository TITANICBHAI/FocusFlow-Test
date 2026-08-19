/**
 * NuclearModeModal
 *
 * "Nuclear Mode" — permanently uninstall addictive apps via the system dialog.
 * Shows apps from the current standalone block list with one-tap uninstall.
 * Each tap opens Android's system "Uninstall <App>?" confirmation — the user
 * must confirm in the OS dialog, so accidental deletion is impossible.
 *
 * Entry point: Block Enforcement section of the SideMenu.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { InstalledAppsModule } from '@/native-modules/InstalledAppsModule';
import { NuclearModeModule } from '@/native-modules/NuclearModeModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

interface InstalledApp {
  packageName: string;
  appName: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function NuclearModeModal({ visible, onClose }: Props) {
  const { state } = useApp();
  const { theme, isDark } = useTheme();
  const { settings } = state;

  const blockedPackages: string[] = [
    ...(settings.standaloneBlockPackages ?? []),
    ...(settings.alwaysOnPackages ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      setLoading(true);
      const all: InstalledApp[] = await InstalledAppsModule.getInstalledApps();
      const filtered = all.filter((a) => blockedPackages.includes(a.packageName));
      setInstalledApps(filtered);
    } catch {
      setInstalledApps([]);
    } finally {
      setLoading(false);
    }
  }, [blockedPackages.join(',')]);

  useEffect(() => {
    if (visible) void loadApps();
  }, [visible, loadApps]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && visible) void loadApps();
    });
    return () => sub.remove();
  }, [visible, loadApps]);

  const handleUninstall = (pkg: string, label: string) => {
    Alert.alert(
      `Uninstall ${label}?`,
      `This will open Android's system uninstall dialog. You'll need to confirm there to permanently remove ${label}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: async () => {
            setUninstalling(pkg);
            try {
              await NuclearModeModule.requestUninstallApp(pkg);
            } catch {
              Alert.alert('Could not open uninstall dialog', 'Try uninstalling from your device Settings → Apps instead.');
            } finally {
              setUninstalling(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.muted} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Nuclear Mode</Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Warning banner */}
          <View style={[styles.warningBanner, { backgroundColor: isDark ? '#3b1515' : '#fff1f1', borderColor: COLORS.red + '44' }]}>
            <Ionicons name="nuclear-outline" size={22} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warningTitle, { color: COLORS.red }]}>Permanent action</Text>
              <Text style={[styles.warningBody, { color: theme.textSecondary }]}>
                Uninstalling an app removes all its data. You will need to re-download it from the Play Store to get it back. Use this only when you are fully committed.
              </Text>
            </View>
          </View>

          {/* Explanation */}
          <Text style={[styles.sectionLabel, { color: theme.muted }]}>
            APPS FROM YOUR BLOCK LIST
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            These are the apps currently in your standalone block list. Tap Uninstall to permanently remove one.
          </Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : installedApps.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.green} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No blocked apps installed</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                {blockedPackages.length === 0
                  ? 'Add apps to your standalone block list first, then return here to uninstall them.'
                  : 'All apps in your block list have already been uninstalled.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {installedApps.map((app) => (
                <View
                  key={app.packageName}
                  style={[styles.appRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <View style={[styles.appIconWrap, { backgroundColor: COLORS.red + '18' }]}>
                    <Ionicons name="ban-outline" size={20} color={COLORS.red} />
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={[styles.appLabel, { color: theme.text }]} numberOfLines={1}>{app.appName}</Text>
                    <Text style={[styles.appPkg, { color: theme.muted }]} numberOfLines={1}>{app.packageName}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.uninstallBtn, uninstalling === app.packageName && { opacity: 0.5 }]}
                    onPress={() => handleUninstall(app.packageName, app.appName)}
                    disabled={uninstalling !== null}
                    activeOpacity={0.75}
                  >
                    {uninstalling === app.packageName ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.uninstallBtnText}>Uninstall</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* How to add apps tip */}
          {!loading && blockedPackages.length === 0 && (
            <View style={[styles.tipCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                To use Nuclear Mode, first add apps to your <Text style={{ color: COLORS.primary }}>Standalone Block</Text> or <Text style={{ color: COLORS.primary }}>Always-On</Text> block list. Those apps will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: FONT.md, fontWeight: '700' },
  closeBtn: { width: 40, alignItems: 'center' },
  body: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  warningTitle: { fontSize: FONT.sm, fontWeight: '700', marginBottom: 2 },
  warningBody: { fontSize: FONT.sm, lineHeight: 18 },
  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: SPACING.sm,
  },
  hint: { fontSize: FONT.sm, lineHeight: 18, marginTop: -SPACING.xs },
  list: { gap: SPACING.sm },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  appIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: { flex: 1 },
  appLabel: { fontSize: FONT.sm, fontWeight: '600' },
  appPkg: { fontSize: FONT.xs, marginTop: 1 },
  uninstallBtn: {
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    minWidth: 80,
    alignItems: 'center',
  },
  uninstallBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  emptyTitle: { fontSize: FONT.md, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipText: { flex: 1, fontSize: FONT.sm, lineHeight: 18 },
});
