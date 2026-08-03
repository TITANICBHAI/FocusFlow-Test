import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InstalledAppsModule, type InstalledApp } from '@/native-modules/InstalledAppsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import type { AllowedAppPreset } from '@/data/types';

// ─── Sensitive-app advisory list ──────────────────────────────────────────────
// These apps CAN be blocked, but the user is warned first because blocking them
// can soft-brick the device, break emergency calls, or lock the user out of
// FocusFlow itself.  The warning is a confirmation dialog — the user can still
// proceed.
//
// Each category groups packages with the same risk so the warning is concise.

type SensitiveCategory = {
  category: string;          // Short label shown on the badge
  warning: string;           // Risk text shown in the confirmation dialog
  pkgs: string[];
};

const SENSITIVE_CATEGORIES: SensitiveCategory[] = [
  {
    category: 'Home launcher',
    warning:
      'Blocking your home launcher can leave you with no way to return to the home screen during a focus session.',
    pkgs: [
      'com.android.launcher', 'com.android.launcher2', 'com.android.launcher3',
      'com.sec.android.app.launcher',          // Samsung OneUI
      'com.google.android.apps.nexuslauncher', // Pixel / stock
      'com.miui.launcher',                     // Xiaomi / MIUI
      'com.huawei.android.launcher',           // Huawei / EMUI
      'com.coloros.launcher',                  // Oppo / ColorOS
      'com.oneplus.launcher',                  // OnePlus OxygenOS
      'com.oppo.launcher',                     // Oppo legacy
      'com.motorola.launcher3',                // Motorola
      'com.nothing.launcher',                  // Nothing OS
      'com.realme.launcher',                   // Realme UI
      'com.iqoo.launcher',                     // iQOO / Funtouch
      'com.vivo.launcher',                     // Vivo
      'com.asus.launcher', 'com.ZenUI.launcher', // Asus
      'com.lge.launcher3',                     // LG
      'com.htc.launcher',                      // HTC
      'com.sonyericsson.home',                 // Sony Xperia
      'com.tcl.launcher',                      // TCL
      'com.nokia.launcher',                    // Nokia
      'com.infinix.launcher',                  // Infinix
      'com.transsion.launcher',                // Transsion / itel / Tecno
      'com.hihonor.launcher',                  // Honor
    ],
  },
  {
    category: 'System UI',
    warning:
      'Blocking System UI hides the status bar and notification shade — the device may become unusable until the focus session ends.',
    pkgs: ['com.android.systemui'],
  },
  {
    category: 'Phone / dialer',
    warning:
      'Blocking the phone dialer can prevent you from making emergency calls (112 / 911) during a focus session.',
    pkgs: [
      'com.android.phone', 'com.android.server.telecom',
      'com.samsung.android.incallui',
      'com.google.android.dialer', 'com.google.android.apps.googledialer',
    ],
  },
  {
    category: 'Caller ID / spam protection',
    warning:
      'Blocking Truecaller (or your caller-ID app) means spam and unknown calls will not be screened during the session — and you may miss the caller name on legitimate incoming calls.',
    pkgs: [
      'com.truecaller',                       // Truecaller
      'com.truecaller.pro',                   // Truecaller Premium
    ],
  },
  {
    category: 'Education essentials',
    warning:
      'You marked this as a learning app you rely on. Blocking it during focus sessions usually defeats the purpose.',
    pkgs: [
      'xyz.penpencil.physicswala',            // PhysicsWallah (PW)
      'digital.allen.study',                  // Allen Digital
      'com.gurukripa.publicapp',              // Gurukripa (GCI)
    ],
  },
  {
    category: 'Android Settings',
    warning:
      'Blocking Settings means you may not be able to change device settings (including disabling FocusFlow) until the session ends.',
    pkgs: ['com.android.settings', 'com.sec.android.app.SecSetupWizard'],
  },
  {
    category: 'Google Play Services',
    warning:
      'Most apps depend on Google Play Services for sign-in, push notifications and Maps. Blocking it can break many other apps at once.',
    pkgs: ['com.google.android.gms'],
  },
  {
    category: 'Package installer',
    warning:
      'Blocking the package installer means Play Store updates and new app installs may silently fail.',
    pkgs: [
      'com.android.packageinstaller',
      'com.google.android.packageinstaller',
      'com.samsung.android.packageinstaller',
    ],
  },
  {
    category: 'Wallet / NFC pay',
    warning:
      'Blocking your wallet app can leave you unable to pay at a card terminal or unlock NFC during the session.',
    pkgs: [
      'com.samsung.android.wallet',
      'com.samsung.android.samsungpay',
      'com.google.android.apps.walletnfcrel',
    ],
  },
  {
    category: 'FocusFlow',
    warning:
      'Blocking FocusFlow itself means you will have no way to end or adjust the active focus session from inside the app.',
    pkgs: ['com.tbtechs.focusflow'],
  },
];

const SENSITIVE_APPS = new Map<string, { category: string; warning: string }>();
SENSITIVE_CATEGORIES.forEach((c) =>
  c.pkgs.forEach((p) => SENSITIVE_APPS.set(p, { category: c.category, warning: c.warning })),
);

interface Props {
  visible: boolean;
  title?: string;
  // [] = "all apps allowed" sentinel (all apps pre-checked on open)
  // [...pkgs] = specific allowed list (only those pre-checked)
  // When noneWhenEmpty=true: [] = "block all" (nothing pre-checked)
  initialSelected: string[];
  noneWhenEmpty?: boolean;
  presets: AllowedAppPreset[];
  onSave: (packages: string[]) => void;
  onSavePreset: (preset: AllowedAppPreset) => void;
  onDeletePreset: (id: string) => void;
  onClose: () => void;
}

export function AppPickerSheet({
  visible,
  title = 'Allowed Apps',
  initialSelected,
  noneWhenEmpty = false,
  presets,
  onSave,
  onSavePreset,
  onDeletePreset,
  onClose,
}: Props) {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (!visible) {
      setShowPresetInput(false);
      setPresetName('');
      return;
    }
    setSearch('');
    setLoading(true);
    setApps([]);

    void (async () => {
      try {
        const result = await InstalledAppsModule.getInstalledApps();
        const sorted = result
          .slice()
          .sort((a, b) => a.appName.toLowerCase().localeCompare(b.appName.toLowerCase()));
        setApps(sorted);

        const allPkgs = new Set(sorted.map((a) => a.packageName));
        if (initialSelected.length === 0) {
          if (noneWhenEmpty) {
            // Focus-mode context: [] = block all → start with nothing checked
            setSelected(new Set());
          } else {
            // Standalone-block context: [] = all allowed sentinel → check ALL apps
            setSelected(new Set(allPkgs));
          }
        } else {
          // Honour the user's saved selection exactly — sensitive apps are
          // surfaced with a warning at toggle time, not auto-added here.
          setSelected(new Set(initialSelected.filter((p) => allPkgs.has(p))));
        }
      } catch {
        setApps([]);
        setSelected(new Set(initialSelected));
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  const filtered = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }, [apps, search]);

  const removePkg = useCallback((pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(pkg);
      return next;
    });
  }, []);

  const toggle = useCallback((pkg: string) => {
    const sensitive = SENSITIVE_APPS.get(pkg);
    const isAllowed = selected.has(pkg);
    // Only warn when REMOVING (= "blocking during focus") a sensitive app.
    if (sensitive && isAllowed) {
      Alert.alert(
        `Block ${sensitive.category}?`,
        `${sensitive.warning}\n\nYou can re-enable it any time from this screen.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block anyway', style: 'destructive', onPress: () => removePkg(pkg) },
        ],
      );
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  }, [selected, removePkg]);

  // Pre-computed set of installed sensitive packages (launcher, dialer,
  // Settings, Play Services, FocusFlow, etc.). Bulk operations keep these
  // *allowed* so the device stays usable mid-session — without this guard
  // a single tap on "Deselect All" can soft-brick the phone.
  const sensitiveInstalled = useMemo(
    () => new Set(apps.map((a) => a.packageName).filter((p) => SENSITIVE_APPS.has(p))),
    [apps],
  );

  const selectAll = useCallback(() => {
    setSelected(new Set(apps.map((a) => a.packageName)));
  }, [apps]);

  const deselectAll = useCallback(() => {
    // Keep sensitive apps allowed — they are protected by design.  If the
    // user really wants to block one of them they can untick it manually
    // (the per-app toggle still surfaces the warning dialog).
    setSelected(new Set(sensitiveInstalled));
  }, [sensitiveInstalled]);

  const applyPreset = useCallback(
    (preset: AllowedAppPreset) => {
      if (preset.packages.length === 0) {
        // [] sentinel → all apps allowed
        setSelected(new Set(apps.map((a) => a.packageName)));
      } else if (preset.packages.includes('__block_all__')) {
        // '__block_all__' sentinel → block everything *except* sensitive
        // apps. Same protection as the Deselect-All button so a saved
        // "Block all" preset cannot accidentally lock the user out.
        setSelected(new Set(sensitiveInstalled));
      } else {
        // Honour the explicit preset list, but always keep sensitives
        // allowed regardless of how the preset was authored.
        setSelected(new Set([...preset.packages, ...sensitiveInstalled]));
      }
    },
    [apps, sensitiveInstalled],
  );

  const confirmDeletePreset = useCallback(
    (preset: AllowedAppPreset) => {
      Alert.alert('Delete Preset', `Delete "${preset.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeletePreset(preset.id) },
      ]);
    },
    [onDeletePreset],
  );

  // "Effectively none selected" = no real user-pickable apps remain — only
  // sensitive system apps that the picker keeps allowed for safety. This is
  // what the user means when they tap Deselect All and we treat it as the
  // "block everything" save state.
  const onlySensitivesSelected =
    apps.length > 0 &&
    selected.size > 0 &&
    selected.size === sensitiveInstalled.size &&
    Array.from(selected).every((p) => sensitiveInstalled.has(p));

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    const allChecked = apps.length > 0 && selected.size === apps.length;
    const blockAll = apps.length > 0 && (selected.size === 0 || onlySensitivesSelected);
    const packages = allChecked ? [] : blockAll ? ['__block_all__'] : Array.from(selected);
    onSavePreset({ id: Date.now().toString(), name, packages });
    setShowPresetInput(false);
    setPresetName('');
  }, [presetName, selected, apps, onSavePreset, onlySensitivesSelected]);

  const handleSave = useCallback(() => {
    // all checked  → [] sentinel (all apps allowed, no blocking)
    // block-all    → ['__block_all__'] sentinel (everything except sensitive
    //                apps is blocked).  Sensitive apps are always passed
    //                through by the AccessibilityService anyway, so the
    //                stored allow-list does not need to include them.
    // some checked → explicit allow-list (only those apps pass through during Focus)
    const allChecked = apps.length > 0 && selected.size === apps.length;
    const blockAll = apps.length > 0 && (selected.size === 0 || onlySensitivesSelected);
    const packages = allChecked ? [] : blockAll ? ['__block_all__'] : Array.from(selected);

    // Always ask for confirmation before saving the allowed-apps list.
    // Users should consciously acknowledge which apps bypass blocking.
    let summaryLine: string;
    if (allChecked) {
      summaryLine = `All ${apps.length} installed apps will be allowed during Focus sessions — blocking will have no effect.`;
    } else if (blockAll) {
      summaryLine = `All apps (except system-critical ones) will be blocked during Focus sessions.`;
    } else {
      const blockedCount = apps.length - selected.size;
      summaryLine = `${selected.size} app${selected.size !== 1 ? 's' : ''} allowed · ${blockedCount} app${blockedCount !== 1 ? 's' : ''} will be blocked during Focus sessions.`;
    }

    Alert.alert(
      'Save allowed apps?',
      `${summaryLine}\n\nAllowed apps bypass all Focus Mode blocking rules.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => { onSave(packages); onClose(); },
        },
      ],
    );
  }, [selected, apps, onSave, onClose, onlySensitivesSelected]);

  const allChecked = apps.length > 0 && selected.size === apps.length;
  const noneSelected = apps.length > 0 && (selected.size === 0 || onlySensitivesSelected);

  const renderApp = ({ item }: { item: InstalledApp }) => {
    const checked = selected.has(item.packageName);
    const sensitive = SENSITIVE_APPS.get(item.packageName);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => toggle(item.packageName)}
        activeOpacity={0.7}
      >
        {item.iconBase64 ? (
          <Image
            source={{ uri: `data:image/png;base64,${item.iconBase64}` }}
            style={styles.icon}
          />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Ionicons name="apps-outline" size={22} color={COLORS.muted} />
          </View>
        )}
        <View style={styles.appInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.appName} numberOfLines={1}>{item.appName}</Text>
            {sensitive && (
              <View style={styles.systemBadge}>
                <Ionicons name="alert-circle-outline" size={10} color={COLORS.primary} />
                <Text style={styles.systemBadgeText}>Sensitive</Text>
              </View>
            )}
          </View>
          <Text style={styles.pkgName} numberOfLines={1}>
            {sensitive ? `${sensitive.category} · ${item.packageName}` : item.packageName}
          </Text>
        </View>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <>
      {/* Presets section */}
      <View style={styles.presetsSection}>
        <View style={styles.presetsTitleRow}>
          <Text style={styles.sectionLabel}>PRESETS</Text>
          {!showPresetInput && (
            <TouchableOpacity
              style={styles.savePresetBtn}
              onPress={() => setShowPresetInput(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="bookmark-outline" size={13} color={COLORS.primary} />
              <Text style={styles.savePresetText}>Save current</Text>
            </TouchableOpacity>
          )}
        </View>

        {showPresetInput ? (
          <View style={styles.presetInputRow}>
            <TextInput
              style={styles.presetInput}
              placeholder="Preset name…"
              placeholderTextColor={COLORS.muted}
              value={presetName}
              onChangeText={setPresetName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSavePreset}
              maxLength={32}
            />
            <TouchableOpacity
              style={[styles.presetInputBtn, !presetName.trim() && styles.presetInputBtnDim]}
              onPress={handleSavePreset}
              disabled={!presetName.trim()}
            >
              <Text style={styles.presetInputBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetInputCancel}
              onPress={() => { setShowPresetInput(false); setPresetName(''); }}
            >
              <Ionicons name="close" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        ) : presets.length === 0 ? (
          <Text style={styles.presetEmpty}>
            No presets yet — save the current selection as a named preset.
          </Text>
        ) : null}

        {presets.length > 0 && !showPresetInput && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsRow}
            >
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={styles.presetChip}
                  onPress={() => applyPreset(preset)}
                  onLongPress={() => confirmDeletePreset(preset)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="bookmark"
                    size={12}
                    color={COLORS.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.presetChipText} numberOfLines={1}>
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.presetHint}>Tap to apply · Long-press to delete</Text>
          </>
        )}
      </View>

      {/* Select All / Deselect All + count.  Both buttons are always
          visible so the user can jump from any state to "allow all" or
          "block all" in a single tap (no more two-tap toggle dance). */}
      <View style={styles.controlRow}>
        <Text style={styles.countText}>
          {allChecked
            ? `All ${apps.length} apps allowed`
            : noneSelected
            ? `All apps blocked · ${sensitiveInstalled.size} sensitive kept allowed`
            : `${selected.size} of ${apps.length} allowed`}
        </Text>
        <View style={styles.controlBtnRow}>
          <TouchableOpacity
            onPress={selectAll}
            style={[styles.selectAllBtn, allChecked && styles.selectAllBtnDisabled]}
            disabled={allChecked}
          >
            <Text style={[styles.selectAllText, allChecked && styles.selectAllTextDisabled]}>
              Select All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={deselectAll}
            style={[styles.selectAllBtn, noneSelected && styles.selectAllBtnDisabled]}
            disabled={noneSelected}
          >
            <Text style={[styles.selectAllText, noneSelected && styles.selectAllTextDisabled]}>
              Deselect All
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search"
          size={16}
          color={COLORS.muted}
          style={{ marginRight: SPACING.xs }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or package…"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <Text style={styles.hint}>
        Checked apps are allowed during Focus. The &quot;Sensitive&quot; tag means an app
        can be blocked but will warn first (e.g. Settings, Wallet). Truly
        protected apps — your phone dialer, home launcher and WhatsApp — are
        kept usable by the system and don&apos;t appear here at all.
      </Text>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading installed apps…</Text>
        </View>
      )}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.packageName}
          renderItem={renderApp}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {search ? 'No apps match your search.' : 'No installed apps found.'}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    minWidth: 60,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  cancelText: {
    fontSize: FONT.md,
    color: COLORS.muted,
  },
  saveText: {
    fontSize: FONT.md,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  presetsSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  presetsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.8,
  },
  savePresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  savePresetText: {
    fontSize: FONT.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  presetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  presetInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '88',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    color: COLORS.text,
  },
  presetInputBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  presetInputBtnDim: {
    backgroundColor: COLORS.primaryLight,
  },
  presetInputBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.sm,
  },
  presetInputCancel: {
    padding: SPACING.xs,
  },
  presetEmpty: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  presetsRow: {
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    maxWidth: 160,
  },
  presetChipText: {
    fontSize: FONT.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  presetHint: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  controlBtnRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  countText: {
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  selectAllBtn: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectAllBtnDisabled: {
    opacity: 0.4,
  },
  selectAllText: {
    fontSize: FONT.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  selectAllTextDisabled: {
    color: COLORS.muted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.md,
    color: COLORS.text,
    height: '100%',
  },
  hint: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  loadingText: {
    fontSize: FONT.sm,
    color: COLORS.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: FONT.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  pkgName: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  systemBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
  },
  separator: {
    height: SPACING.xs,
  },
  empty: {
    paddingTop: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT.sm,
    color: COLORS.muted,
  },
});
