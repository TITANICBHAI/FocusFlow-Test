/**
 * ImportFromOtherAppModal.tsx
 *
 * Lets the user import a blocked-app list from any popular app-blocker.
 *
 * Two entry paths:
 *   1. "Browse & Import file" — for blockers that DO export a file
 *      (AppBlock, StayFree, ActionDash, Digital Wellbeing Takeout, plain text, etc.).
 *      Supported formats are auto-detected:
 *        - Plain text:  one Android package name per line (.txt)
 *        - CSV:         any column containing valid package names (.csv)
 *        - JSON:        arrays / objects with packageName / package / appId keys
 *        - Mixed:       anything else — scanned line-by-line for package patterns
 *
 *   2. "Type or paste app names" — for blockers that DO NOT export anything
 *      (Stay Focused, Lock Me Out free tier, etc.). The user types or
 *      pastes app display names ("Instagram", "TikTok") one per line and
 *      we fuzzy-match them against installed apps on the device.
 *
 * After either path the user sees a preview of matched installed apps and
 * taps "Add to Block List" to merge them into the standalone block list.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { NativeFilePickerModule } from '@/native-modules/NativeFilePickerModule';
import { InstalledAppsModule, type InstalledApp } from '@/native-modules/InstalledAppsModule';

// ─── Package-name detector ────────────────────────────────────────────────────

const PKG_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
function looksLikePkg(s: string): boolean {
  const t = s.trim();
  return t.length >= 5 && t.length <= 200 && PKG_RE.test(t) && t.includes('.');
}

function extractPackages(content: string, filename: string): string[] {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const first = content.trimStart()[0];

  if (ext === 'json' || first === '{' || first === '[') {
    const pkgs = extractFromJson(content);
    if (pkgs.length > 0) return pkgs;
  }

  if (ext === 'csv' || (content.includes(',') && content.includes('\n'))) {
    const pkgs = extractFromCsv(content);
    if (pkgs.length > 0) return pkgs;
  }

  return extractFromText(content);
}

function extractFromText(content: string): string[] {
  const seen = new Set<string>();
  content.split(/\r?\n/).forEach((line) => {
    line.split(/[\s,;|]+/).forEach((tok) => {
      const t = tok.replace(/^["'`]|["'`]$/g, '');
      if (looksLikePkg(t)) seen.add(t);
    });
  });
  return Array.from(seen);
}

function extractFromCsv(content: string): string[] {
  const seen = new Set<string>();
  content.split(/\r?\n/).forEach((line) => {
    line.split(',').forEach((cell) => {
      const t = cell.trim().replace(/^"|"$/g, '');
      if (looksLikePkg(t)) seen.add(t);
    });
  });
  return Array.from(seen);
}

function extractFromJson(content: string): string[] {
  try {
    const parsed = JSON.parse(content);
    const seen = new Set<string>();
    const PKG_KEYS = [
      'packageName', 'package', 'pkg', 'appId',
      'bundleId', 'app_package', 'appPackage', 'id', 'name',
    ];

    function walk(v: unknown) {
      if (typeof v === 'string') {
        if (looksLikePkg(v)) seen.add(v);
      } else if (Array.isArray(v)) {
        v.forEach(walk);
      } else if (v && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        for (const key of PKG_KEYS) {
          if (typeof obj[key] === 'string' && looksLikePkg(obj[key] as string)) {
            seen.add(obj[key] as string);
          }
        }
        Object.values(obj).forEach(walk);
      }
    }
    walk(parsed);
    return Array.from(seen);
  } catch {
    return [];
  }
}

// ─── Supported source info ────────────────────────────────────────────────────
//
// `method` tells the user which entry path to use:
//   - 'file'  → the "Browse & Import file" button
//   - 'names' → the "Type or paste app names" button
//   - 'both'  → either works
//
// Stay Focused is listed first because their lifetime-licence revocation
// in late 2025 created a wave of users actively looking for alternatives.

type ImportMethod = 'file' | 'names' | 'both';

const SOURCES: { name: string; hint: string; icon: string; method: ImportMethod }[] = [
  {
    name: 'Stay Focused',
    hint: 'Stay Focused has no export. Tap "Type or paste app names" below and list the apps you had blocked, one per line.',
    icon: 'lock-closed-outline',
    method: 'names',
  },
  {
    name: 'AppBlock',
    hint: 'Settings → Backup → Export → share the .json file with FocusFlow.',
    icon: 'shield-checkmark-outline',
    method: 'file',
  },
  {
    name: 'Lock Me Out',
    hint: 'Profiles → ⋮ → Export. Or, if your version has no export, use "Type or paste app names" below.',
    icon: 'key-outline',
    method: 'both',
  },
  {
    name: 'StayFree – Screen Time',
    hint: 'Reports → Export → share the .csv or .json file.',
    icon: 'time-outline',
    method: 'file',
  },
  {
    name: 'ActionDash',
    hint: 'Export weekly usage → share the .csv file.',
    icon: 'analytics-outline',
    method: 'file',
  },
  {
    name: 'Digital Wellbeing (Google Takeout)',
    hint: 'takeout.google.com → select Digital Wellbeing → download & unzip → pick the JSON inside.',
    icon: 'heart-outline',
    method: 'file',
  },
  {
    name: 'Any other blocker',
    hint: 'Either pick a file with package names, or type the app names you remember.',
    icon: 'document-text-outline',
    method: 'both',
  },
];

// ─── Name → installed-package fuzzy matcher ──────────────────────────────────
//
// Used by the "Type or paste app names" path. Stay Focused and several other
// blockers don't export package names, only display names. We normalise both
// sides (strip case + non-alphanumerics) and try exact, then prefix, then
// substring matches against the installed-app list.

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface NameMatchResult {
  matchedPkgs: string[];
  unmatched: string[];
}

export function matchNamesToInstalledApps(
  rawNames: string[],
  installed: InstalledApp[],
): NameMatchResult {
  const norm = installed.map((a) => ({
    key: normaliseName(a.appName),
    pkg: a.packageName,
  }));
  const matchedPkgs: string[] = [];
  const seenPkgs = new Set<string>();
  const unmatched: string[] = [];

  for (const raw of rawNames) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const k = normaliseName(trimmed);
    if (!k) continue;

    let hit =
      norm.find((n) => n.key === k) ||
      norm.find((n) => n.key.startsWith(k) || k.startsWith(n.key)) ||
      norm.find((n) => n.key.includes(k) || k.includes(n.key));

    if (hit) {
      if (!seenPkgs.has(hit.pkg)) {
        seenPkgs.add(hit.pkg);
        matchedPkgs.push(hit.pkg);
      }
    } else {
      unmatched.push(trimmed);
    }
  }

  return { matchedPkgs, unmatched };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onImport: (packages: string[]) => Promise<void>;
}

type Step = 'sources' | 'paste' | 'preview';

type Source = 'file' | 'names';

// ─── Component ───────────────────────────────────────────────────────────────

export function ImportFromOtherAppModal({ visible, onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('sources');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detectedPkgs, setDetectedPkgs] = useState<string[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [filename, setFilename] = useState('');
  const [pastedNames, setPastedNames] = useState('');
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [source, setSource] = useState<Source>('file');

  const installedMap = useMemo(
    () => new Map(installedApps.map((a) => [a.packageName, a])),
    [installedApps],
  );

  const matchedApps = useMemo(
    () => detectedPkgs.map((pkg) => ({ pkg, app: installedMap.get(pkg) })).filter(({ app }) => !!app),
    [detectedPkgs, installedMap],
  );

  const unmatchedCount = detectedPkgs.length - matchedApps.length;

  const resetState = useCallback(() => {
    setStep('sources');
    setDetectedPkgs([]);
    setInstalledApps([]);
    setFilename('');
    setPastedNames('');
    setUnmatchedNames([]);
    setSource('file');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleBrowse = useCallback(async () => {
    setLoading(true);
    try {
      const picked = await NativeFilePickerModule.pickFile('*/*');
      if (!picked) return;

      const pkgs = extractPackages(picked.content, picked.name);
      if (pkgs.length === 0) {
        Alert.alert(
          'No apps found',
          'Could not find any Android package names in this file.\n\nMake sure you exported the block list from your other app, then try again.',
        );
        return;
      }

      const apps = await InstalledAppsModule.getInstalledApps();
      setInstalledApps(apps);
      setDetectedPkgs(pkgs);
      setFilename(picked.name);
      setUnmatchedNames([]);
      setSource('file');
      setStep('preview');
    } catch (e) {
      Alert.alert('Error reading file', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenPaste = useCallback(() => {
    setStep('paste');
  }, []);

  const handleMatchNames = useCallback(async () => {
    const lines = pastedNames
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      Alert.alert('No names entered', 'Type or paste at least one app name, one per line.');
      return;
    }

    setLoading(true);
    try {
      const apps = await InstalledAppsModule.getInstalledApps();
      const { matchedPkgs, unmatched } = matchNamesToInstalledApps(lines, apps);

      if (matchedPkgs.length === 0) {
        Alert.alert(
          'No matches',
          `None of the ${lines.length} name${lines.length !== 1 ? 's' : ''} you entered match any app installed on this device.\n\nCheck the spelling, or try the app's full display name (e.g. "Instagram" not "IG").`,
        );
        return;
      }

      setInstalledApps(apps);
      setDetectedPkgs(matchedPkgs);
      setUnmatchedNames(unmatched);
      setFilename(`${lines.length} typed name${lines.length !== 1 ? 's' : ''}`);
      setSource('names');
      setStep('preview');
    } catch (e) {
      Alert.alert('Error matching apps', String(e));
    } finally {
      setLoading(false);
    }
  }, [pastedNames]);

  const handleConfirmImport = useCallback(() => {
    const toImport = matchedApps.map(({ pkg }) => pkg);
    if (toImport.length === 0) {
      Alert.alert('Nothing to import', 'None of the detected apps are installed on this device.');
      return;
    }
    Alert.alert(
      `Add ${toImport.length} app${toImport.length !== 1 ? 's' : ''} to Block List?`,
      'These apps will be added to your Standalone Block list. You can review or remove them from Block Controls at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Block List',
          onPress: async () => {
            setImporting(true);
            try {
              await onImport(toImport);
              handleClose();
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  }, [matchedApps, onImport, handleClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {step !== 'sources' ? (
            <TouchableOpacity onPress={() => setStep('sources')} style={styles.headerSide}>
              <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose} style={styles.headerSide}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Import Block List</Text>
          <View style={styles.headerSide} />
        </View>

        {step === 'sources' ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Intro banner */}
            <View style={styles.introBanner}>
              <Ionicons name="swap-horizontal-outline" size={32} color={COLORS.primary} />
              <Text style={styles.introTitle}>Import from another app</Text>
              <Text style={styles.introSub}>
                Bring your block list across from any app-blocker — pick an exported file, or just type the app names. FocusFlow matches them to the apps installed on this device.
              </Text>
            </View>

            {/* Two action buttons */}
            <TouchableOpacity
              style={[styles.browseBtn, loading && styles.browseBtnDim]}
              onPress={handleBrowse}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="folder-open-outline" size={20} color="#fff" />
              )}
              <Text style={styles.browseBtnText}>{loading ? 'Reading file…' : 'Browse & Import file'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pasteBtn}
              onPress={handleOpenPaste}
              activeOpacity={0.8}
            >
              <Ionicons name="text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.pasteBtnText}>Type or paste app names</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
              Only apps installed on this device are imported. Uninstalled apps are skipped automatically.
            </Text>

            {/* Supported sources */}
            <Text style={styles.sectionLabel}>SUPPORTED SOURCES</Text>
            {SOURCES.map((src) => (
              <View key={src.name} style={styles.sourceCard}>
                <View style={styles.sourceIconWrap}>
                  <Ionicons name={src.icon as never} size={20} color={COLORS.primary} />
                </View>
                <View style={styles.sourceText}>
                  <View style={styles.sourceNameRow}>
                    <Text style={styles.sourceName}>{src.name}</Text>
                    <MethodTag method={src.method} />
                  </View>
                  <Text style={styles.sourceHint}>{src.hint}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : step === 'paste' ? (
          /* ── Paste step ── */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.introBanner}>
                <Ionicons name="text-outline" size={32} color={COLORS.primary} />
                <Text style={styles.introTitle}>Type or paste app names</Text>
                <Text style={styles.introSub}>
                  One name per line — like "Instagram", "TikTok", "YouTube". We'll match them to the apps installed on this device.
                </Text>
              </View>

              <TextInput
                style={styles.pasteInput}
                value={pastedNames}
                onChangeText={setPastedNames}
                placeholder={'Instagram\nTikTok\nYouTube\nReddit\nTwitter'}
                placeholderTextColor={COLORS.muted}
                multiline
                autoCapitalize="words"
                autoCorrect={false}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.browseBtn, loading && styles.browseBtnDim]}
                onPress={handleMatchNames}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search-outline" size={20} color="#fff" />
                )}
                <Text style={styles.browseBtnText}>
                  {loading ? 'Matching apps…' : 'Match installed apps'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.footnote}>
                Tip: type the name that shows under the app icon on your home screen. We match case-insensitively and forgive small typos.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          /* ── Preview step ── */
          <View style={{ flex: 1 }}>
            {/* File meta */}
            <View style={styles.fileMeta}>
              <Ionicons name="document-outline" size={15} color={COLORS.muted} />
              <Text style={styles.fileMetaText} numberOfLines={1}>{filename}</Text>
            </View>

            {/* Stats bar */}
            <View style={styles.statsBar}>
              <StatPill
                label={source === 'names' ? 'Matched' : 'Detected'}
                value={detectedPkgs.length}
                color={COLORS.primary}
              />
              <StatPill label="On this device" value={matchedApps.length} color="#22c55e" />
              {source === 'names' && unmatchedNames.length > 0 && (
                <StatPill label="Not found" value={unmatchedNames.length} color={COLORS.muted} />
              )}
              {source === 'file' && unmatchedCount > 0 && (
                <StatPill label="Not installed" value={unmatchedCount} color={COLORS.muted} />
              )}
            </View>

            {/* Unmatched names callout (paste path only) */}
            {source === 'names' && unmatchedNames.length > 0 && (
              <View style={styles.unmatchedCallout}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.muted} />
                <Text style={styles.unmatchedCalloutText}>
                  Couldn't find: {unmatchedNames.slice(0, 4).join(', ')}
                  {unmatchedNames.length > 4 ? ` and ${unmatchedNames.length - 4} more` : ''}.
                </Text>
              </View>
            )}

            <FlatList
              data={matchedApps}
              keyExtractor={({ pkg }) => pkg}
              contentContainerStyle={styles.appList}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListHeaderComponent={
                matchedApps.length > 0 ? (
                  <Text style={[styles.sectionLabel, { marginBottom: SPACING.sm }]}>
                    APPS TO IMPORT ({matchedApps.length})
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <View style={styles.appRow}>
                  {item.app?.iconBase64 ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${item.app.iconBase64}` }}
                      style={styles.appIcon}
                    />
                  ) : (
                    <View style={styles.appIconPlaceholder}>
                      <Ionicons name="apps-outline" size={20} color={COLORS.muted} />
                    </View>
                  )}
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{item.app?.appName ?? item.pkg}</Text>
                    <Text style={styles.appPkg} numberOfLines={1}>{item.pkg}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="alert-circle-outline" size={40} color={COLORS.muted} />
                  <Text style={styles.emptyText}>
                    {source === 'names'
                      ? 'None of the names you typed match any app installed on this device.'
                      : 'None of the detected apps are installed on this device.'}
                  </Text>
                  <TouchableOpacity onPress={() => setStep('sources')} style={styles.retryBtn}>
                    <Text style={styles.retryText}>
                      {source === 'names' ? 'Try different names' : 'Try another file'}
                    </Text>
                  </TouchableOpacity>
                </View>
              }
            />

            {matchedApps.length > 0 && (
              <View style={styles.importFooter}>
                <TouchableOpacity
                  style={[styles.importBtn, importing && styles.importBtnDim]}
                  onPress={handleConfirmImport}
                  disabled={importing}
                  activeOpacity={0.8}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  )}
                  <Text style={styles.importBtnText}>
                    {importing
                      ? 'Importing…'
                      : `Add ${matchedApps.length} App${matchedApps.length !== 1 ? 's' : ''} to Block List`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MethodTag({ method }: { method: ImportMethod }) {
  const label =
    method === 'file' ? 'File' : method === 'names' ? 'Type names' : 'File or names';
  return (
    <View style={styles.methodTag}>
      <Text style={styles.methodTagText}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

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
  headerSide: { minWidth: 60, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: FONT.md, fontWeight: '700', color: COLORS.text },
  cancelText: { fontSize: FONT.md, color: COLORS.muted },
  backText: { fontSize: FONT.md, color: COLORS.primary, marginLeft: 2 },

  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },

  introBanner: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  introTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  introSub: { fontSize: FONT.sm, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },

  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },

  sourceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: `${COLORS.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  sourceText: { flex: 1 },
  sourceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  sourceName: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  sourceHint: { fontSize: FONT.xs, color: COLORS.muted, lineHeight: 17 },

  methodTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: `${COLORS.primary}15`,
  },
  methodTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  browseBtnDim: { opacity: 0.6 },
  browseBtnText: { fontSize: FONT.md, fontWeight: '700', color: '#fff' },

  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  pasteBtnText: { fontSize: FONT.md, fontWeight: '700', color: COLORS.primary },

  pasteInput: {
    minHeight: 180,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  unmatchedCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  unmatchedCalloutText: { flex: 1, fontSize: FONT.xs, color: COLORS.muted, lineHeight: 16 },

  footnote: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 17,
  },

  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  fileMetaText: { fontSize: FONT.xs, color: COLORS.muted, flex: 1 },

  statsBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  statPill: { alignItems: 'center', paddingHorizontal: SPACING.md },
  statValue: { fontSize: FONT.xl, fontWeight: '800' },
  statLabel: { fontSize: FONT.xs, color: COLORS.muted },

  appList: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: 120 },

  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  appIcon: { width: 40, height: 40, borderRadius: RADIUS.sm },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: { flex: 1, marginLeft: SPACING.sm },
  appName: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  appPkg: { fontSize: FONT.xs, color: COLORS.muted },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },

  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    gap: SPACING.md,
  },
  emptyText: { fontSize: FONT.sm, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },

  importFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  importBtnDim: { opacity: 0.6 },
  importBtnText: { fontSize: FONT.md, fontWeight: '700', color: '#fff' },
});
