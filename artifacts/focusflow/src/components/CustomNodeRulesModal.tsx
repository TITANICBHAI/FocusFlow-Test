/**
 * CustomNodeRulesModal
 *
 * Lets the user manage custom node-blocking rules derived from NodeSpy captures
 * or any compatible JSON export.
 *
 * Import sources supported:
 *   1. Paste JSON directly into the text area (title typed manually)
 *   2. Browse device files via the native file picker (title auto-filled from filename)
 *
 * Accepted JSON formats:
 *   • NodeSpyCaptureV1  — official NodeSpy export; uses recommendedRules array
 *   • Any JSON object   — must contain recommendedRules[] or nodes[]+pinnedNodeIds[]
 *   • Plain array       — [{pkg, matchResId?, matchText?, matchCls?, label?}, ...]
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CustomNodeRule } from '@/data/types';
import { NativeFilePickerModule } from '@/native-modules/NativeFilePickerModule';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:         '#0F0F14',
  surface:    '#1A1A24',
  surfaceVar: '#242430',
  border:     '#2E2E3E',
  text:       '#E8E8F0',
  muted:      '#6B6B80',
  primary:    '#6366f1',
  green:      '#22c55e',
  red:        '#ef4444',
  orange:     '#f97316',
  yellow:     '#eab308',
};

// ─── JSON parse types ─────────────────────────────────────────────────────────
interface NodeSpyCapture {
  format?: string;
  version?: number;
  timestamp?: number;
  pkg?: string;
  nodes?: Array<{
    id: string; cls: string; resId?: string; text?: string;
    desc?: string; flags: { visible: boolean }; depth: number;
  }>;
  pinnedNodeIds?: string[];
  ruleQuality?: {
    totalPinned: number; exportableRules: number;
    strongRules: number; mediumRules: number; weakRules: number;
    averageConfidence: number; warnings?: string[];
  };
  recommendedRules?: Array<{
    nodeId: string; label: string; pkg: string;
    selector: { matchResId?: string; matchText?: string; matchCls?: string };
    selectorType?: string; confidence?: number;
    tier?: 'strong' | 'medium' | 'weak';
    stability?: number; warnings?: string[];
  }>;
}

// ─── Parse result ─────────────────────────────────────────────────────────────
interface ParseResult {
  capture: NodeSpyCapture | null;
  rawRules: CustomNodeRule[] | null;
  error: string | null;
}

function parseJson(text: string): ParseResult {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { capture: null, rawRules: null, error: 'Invalid JSON — check for missing brackets or quotes.' }; }

  // Plain array — [{pkg, matchResId?, matchText?, label?}, ...]
  if (Array.isArray(parsed)) {
    const now = new Date().toISOString();
    const rawRules: CustomNodeRule[] = (parsed as Record<string, unknown>[])
      .filter(item => typeof item === 'object' && item !== null && typeof item.pkg === 'string')
      .map((item, i) => ({
        id:         `cnr_${Date.now()}_arr${i}`,
        label:      (item.label as string) || (item.matchResId as string | undefined)?.split('/').pop() || `Rule ${i + 1}`,
        pkg:        item.pkg as string,
        matchResId: item.matchResId as string | undefined,
        matchText:  item.matchText as string | undefined,
        matchCls:   item.matchCls as string | undefined,
        action:     'overlay' as const,
        enabled:    true,
        importedAt: now,
      }));
    if (rawRules.length === 0)
      return { capture: null, rawRules: null, error: 'Array found but no items have a "pkg" field.' };
    return { capture: null, rawRules, error: null };
  }

  // Object — NodeSpyCaptureV1 or similar
  if (typeof parsed !== 'object' || parsed === null)
    return { capture: null, rawRules: null, error: 'Expected a JSON object or array.' };

  const obj = parsed as NodeSpyCapture;

  // Must have at least one usable section
  const hasRecommended = Array.isArray(obj.recommendedRules);
  const hasNodes       = Array.isArray(obj.nodes) && Array.isArray(obj.pinnedNodeIds);
  if (!hasRecommended && !hasNodes)
    return { capture: null, rawRules: null, error: 'JSON does not contain "recommendedRules" or "nodes"+"pinnedNodeIds" fields.' };

  if (!obj.pkg)
    return { capture: null, rawRules: null, error: 'Missing "pkg" (target app package name).' };

  return { capture: obj, rawRules: null, error: null };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  rules: CustomNodeRule[];
  onClose: () => void;
  onSave: (rules: CustomNodeRule[]) => void;
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function CustomNodeRulesModal({ visible, rules, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'rules' | 'import'>('rules');

  const [importTitle, setImportTitle] = useState('');
  const [importJson,  setImportJson]  = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [action, setAction] = useState<'overlay' | 'home'>('overlay');
  const [browsing, setBrowsing] = useState(false);

  // ── Reset import form ──
  const resetImport = useCallback(() => {
    setImportTitle('');
    setImportJson('');
    setParseResult(null);
  }, []);

  // ── Live-parse as the user types ──
  const handleJsonChange = useCallback((text: string) => {
    setImportJson(text);
    if (!text.trim()) { setParseResult(null); return; }
    setParseResult(parseJson(text));
  }, []);

  // ── Native file browse ──
  const handleBrowse = useCallback(async () => {
    setBrowsing(true);
    try {
      const file = await NativeFilePickerModule.pickFile('*/*');
      if (!file) return;
      const stem = file.name.replace(/\.[^.]+$/, '');   // strip extension for title
      setImportTitle(stem);
      setImportJson(file.content);
      setParseResult(parseJson(file.content));
    } catch {
      Alert.alert('Error', 'Could not open the file.');
    } finally {
      setBrowsing(false);
    }
  }, []);

  // ── Confirm import ──
  const handleImport = useCallback(() => {
    if (!parseResult || parseResult.error) return;
    const sourceName = importTitle.trim() || undefined;
    const now = new Date().toISOString();
    let newRules: CustomNodeRule[] = [];

    if (parseResult.rawRules) {
      // Plain array path
      newRules = parseResult.rawRules.map(r => ({ ...r, sourceName, action }));
    } else if (parseResult.capture) {
      const { capture } = parseResult;
      const { pkg, nodes = [], pinnedNodeIds = [], timestamp, recommendedRules } = capture;

      if (pinnedNodeIds.length === 0 && !recommendedRules?.length) {
        Alert.alert('Nothing to import', 'No pinned nodes or recommended rules found.');
        return;
      }

      if (Array.isArray(recommendedRules) && recommendedRules.length > 0) {
        newRules = recommendedRules.map(rec => ({
          id:            `cnr_${Date.now()}_${rec.nodeId}`,
          label:         rec.label || rec.selector.matchResId?.split('/').pop() || rec.nodeId,
          pkg:           rec.pkg || pkg!,
          matchResId:    rec.selector.matchResId || undefined,
          matchText:     rec.selector.matchText || undefined,
          matchCls:      rec.selector.matchCls || undefined,
          action,
          enabled:       true,
          confidence:    rec.confidence,
          qualityTier:   rec.tier,
          selectorType:  rec.selectorType,
          stability:     rec.stability,
          warnings:      rec.warnings,
          importedAt:    now,
          captureTimestamp: timestamp,
          sourceName,
        } as CustomNodeRule));
      } else {
        // Fall back to raw pinned nodes
        newRules = pinnedNodeIds
          .map(id => nodes.find(n => n.id === id))
          .filter(Boolean)
          .map(n => n!)
          .map(node => ({
            id:        `cnr_${Date.now()}_${node.id}`,
            label:     node.text?.slice(0, 40) || node.desc?.slice(0, 40) ||
                       node.resId?.split('/').pop()?.slice(0, 40) ||
                       node.cls.split('.').pop() || node.id,
            pkg:       pkg!,
            matchResId: node.resId || undefined,
            matchText: (node.text || node.desc)?.slice(0, 100) || undefined,
            action,
            enabled:   true,
            importedAt: now,
            captureTimestamp: timestamp,
            sourceName,
          } as CustomNodeRule));
      }
    }

    if (newRules.length === 0) {
      Alert.alert('Nothing to import', 'No valid rules could be extracted from this JSON.');
      return;
    }

    onSave(dedupeRules([...rules, ...newRules]));
    resetImport();
    setTab('rules');
  }, [parseResult, importTitle, action, rules, onSave, resetImport]);

  const toggleRule = useCallback((id: string) => {
    onSave(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, [rules, onSave]);

  const deleteRule = useCallback((id: string) => {
    Alert.alert('Delete Rule', 'Remove this blocking rule?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onSave(rules.filter(r => r.id !== id)) },
    ]);
  }, [rules, onSave]);

  const clearAll = useCallback(() => {
    Alert.alert('Clear All Rules', 'Remove all custom node rules?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => onSave([]) },
    ]);
  }, [onSave]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={C.muted} />
          </TouchableOpacity>
          <Text style={s.title}>Custom Node Rules</Text>
          {rules.length > 0 && (
            <TouchableOpacity onPress={clearAll} style={s.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={C.red} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.subtitle}>
          Block specific in-app UI elements surgically — without blocking the whole app.
        </Text>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {(['rules', 'import'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'rules' ? `Rules (${rules.length})` : 'Add Script'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {tab === 'rules' ? (
          <RulesTab
            rules={rules}
            onToggle={toggleRule}
            onDelete={deleteRule}
            onImport={() => setTab('import')}
          />
        ) : (
          <ImportTab
            title={importTitle}
            json={importJson}
            parseResult={parseResult}
            action={action}
            browsing={browsing}
            onTitleChange={setImportTitle}
            onJsonChange={handleJsonChange}
            onBrowse={handleBrowse}
            onActionChange={setAction}
            onImport={handleImport}
            onClear={resetImport}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Rules tab ────────────────────────────────────────────────────────────────
function RulesTab({
  rules, onToggle, onDelete, onImport,
}: {
  rules: CustomNodeRule[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
}) {
  if (rules.length === 0) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="scan-outline" size={52} color={C.muted} />
        <Text style={s.emptyTitle}>No rules yet</Text>
        <Text style={s.emptyBody}>
          Paste a NodeSpy JSON export or browse any JSON file from your device.
        </Text>
        <TouchableOpacity style={s.actionBtn} onPress={onImport}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={s.actionBtnText}>Add Script</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.list}>
      {rules.map(rule => (
        <RuleRow key={rule.id} rule={rule} onToggle={onToggle} onDelete={onDelete} />
      ))}
      <TouchableOpacity style={[s.actionBtn, { marginTop: 16 }]} onPress={onImport}>
        <Ionicons name="add-circle-outline" size={18} color="#fff" />
        <Text style={s.actionBtnText}>Add Another Script</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function RuleRow({
  rule, onToggle, onDelete,
}: {
  rule: CustomNodeRule;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={s.ruleCard}>
      <View style={s.ruleHeader}>
        <View style={[s.actionBadge, { backgroundColor: rule.action === 'overlay' ? C.primary + '33' : C.orange + '33' }]}>
          <Text style={[s.actionBadgeText, { color: rule.action === 'overlay' ? C.primary : C.orange }]}>
            {rule.action === 'overlay' ? 'OVERLAY' : 'HOME'}
          </Text>
        </View>
        <Text style={s.ruleLabel} numberOfLines={1}>{rule.label}</Text>
        {typeof rule.confidence === 'number' && (
          <View style={[s.qualityBadge, { backgroundColor: qualityColor(rule.qualityTier) + '22' }]}>
            <Text style={[s.qualityBadgeText, { color: qualityColor(rule.qualityTier) }]}>
              {rule.confidence} {rule.qualityTier?.toUpperCase() ?? ''}
            </Text>
          </View>
        )}
      </View>
      <Text style={s.rulePkg} numberOfLines={1}>{rule.pkg}</Text>
      {rule.sourceName && (
        <Text style={s.ruleSource} numberOfLines={1}>
          <Ionicons name="document-text-outline" size={10} color={C.muted} /> {rule.sourceName}
        </Text>
      )}
      <View style={s.ruleSelectors}>
        {rule.matchResId && <SelectorChip label="id"    value={rule.matchResId.split('/').pop() || rule.matchResId} />}
        {rule.matchText   && <SelectorChip label="text"  value={rule.matchText} />}
        {rule.matchCls    && <SelectorChip label="class" value={rule.matchCls} />}
      </View>
      {rule.warnings?.[0] && (
        <Text style={s.ruleWarning} numberOfLines={2}>{rule.warnings[0]}</Text>
      )}
      <View style={s.ruleFooter}>
        <Text style={s.ruleDate}>{new Date(rule.importedAt).toLocaleDateString()}</Text>
        <View style={s.ruleActions}>
          <Switch
            value={rule.enabled}
            onValueChange={() => onToggle(rule.id)}
            trackColor={{ false: C.border, true: C.primary + '88' }}
            thumbColor={rule.enabled ? C.primary : C.muted}
          />
          <TouchableOpacity onPress={() => onDelete(rule.id)} style={s.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function SelectorChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipLabel}>{label}:</Text>
      <Text style={s.chipValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Import / Add Script tab ──────────────────────────────────────────────────
function ImportTab({
  title, json, parseResult, action, browsing,
  onTitleChange, onJsonChange, onBrowse, onActionChange, onImport, onClear,
}: {
  title: string;
  json: string;
  parseResult: ParseResult | null;
  action: 'overlay' | 'home';
  browsing: boolean;
  onTitleChange: (t: string) => void;
  onJsonChange: (t: string) => void;
  onBrowse: () => void;
  onActionChange: (a: 'overlay' | 'home') => void;
  onImport: () => void;
  onClear: () => void;
}) {
  const capture = parseResult?.capture ?? null;
  const rawRules = parseResult?.rawRules ?? null;
  const error = parseResult?.error ?? null;
  const readyCount = rawRules?.length
    ?? (capture?.recommendedRules?.length
        || capture?.pinnedNodeIds?.length
        || 0);
  const canImport = !error && (!!rawRules || !!capture) && readyCount > 0;

  return (
    <ScrollView contentContainerStyle={s.importContent} keyboardShouldPersistTaps="handled">

      {/* Title row */}
      <View style={s.titleRow}>
        <View style={s.titleInputWrap}>
          <Ionicons name="pricetag-outline" size={15} color={C.muted} style={s.titleIcon} />
          <TextInput
            style={s.titleInput}
            placeholder="Script title (optional)"
            placeholderTextColor={C.muted}
            value={title}
            onChangeText={onTitleChange}
            returnKeyType="done"
          />
        </View>

        {/* Browse file button */}
        <TouchableOpacity style={s.browseBtn} onPress={onBrowse} disabled={browsing}>
          {browsing
            ? <ActivityIndicator size="small" color={C.primary} />
            : <>
                <Ionicons name="folder-open-outline" size={16} color={C.primary} />
                <Text style={s.browseBtnText}>Browse</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      <Text style={s.importHint}>
        Paste a NodeSpy JSON export below, or tap Browse to pick any JSON file from your device. The filename becomes the title automatically.
      </Text>

      {/* JSON textarea */}
      <TextInput
        style={[s.jsonInput, error ? s.jsonInputError : (!error && canImport ? s.jsonInputOk : null)]}
        multiline
        numberOfLines={8}
        placeholder={'Paste JSON here…'}
        placeholderTextColor={C.muted}
        value={json}
        onChangeText={onJsonChange}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Clear */}
      {json.length > 0 && (
        <TouchableOpacity onPress={onClear} style={s.clearJsonBtn}>
          <Ionicons name="close-circle-outline" size={14} color={C.muted} />
          <Text style={s.clearJsonText}>Clear</Text>
        </TouchableOpacity>
      )}

      {/* Error */}
      {error && (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={C.red} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Preview + action picker */}
      {canImport && (
        <View style={s.previewBox}>
          <Text style={s.previewTitle}>
            {rawRules ? `${rawRules.length} rule${rawRules.length !== 1 ? 's' : ''} ready` : 'Ready to import'}
          </Text>

          {capture?.pkg && <PreviewRow icon="phone-portrait-outline" label="App" value={capture.pkg} />}
          {capture?.nodes && <PreviewRow icon="layers-outline" label="Total nodes" value={`${capture.nodes.length}`} />}
          {capture?.pinnedNodeIds && (
            <PreviewRow icon="pin-outline" label="Pinned" value={`${capture.pinnedNodeIds.length}`} color={C.green} />
          )}
          {capture?.ruleQuality && (
            <>
              <PreviewRow
                icon="shield-checkmark-outline"
                label="Recommended"
                value={`${capture.ruleQuality.exportableRules} / ${capture.ruleQuality.totalPinned}`}
                color={capture.ruleQuality.weakRules > 0 ? C.yellow : C.green}
              />
              <PreviewRow
                icon="analytics-outline"
                label="Quality"
                value={`${capture.ruleQuality.strongRules} strong · ${capture.ruleQuality.mediumRules} medium · ${capture.ruleQuality.weakRules} weak`}
              />
              {capture.ruleQuality.warnings?.map((w, i) => (
                <Text key={i} style={s.importWarning}>{w}</Text>
              ))}
            </>
          )}

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>Block action</Text>
          <View style={s.actionToggleRow}>
            <ActionToggle
              label="Show overlay"
              desc="Display FocusFlow block screen"
              selected={action === 'overlay'}
              onSelect={() => onActionChange('overlay')}
            />
            <ActionToggle
              label="Press HOME"
              desc="Silently send user to home screen"
              selected={action === 'home'}
              onSelect={() => onActionChange('home')}
            />
          </View>

          <TouchableOpacity style={s.importConfirmBtn} onPress={onImport}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={s.importConfirmText}>
              Import {readyCount} rule{readyCount !== 1 ? 's' : ''}
              {title.trim() ? ` · "${title.trim()}"` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function PreviewRow({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <View style={s.previewRow}>
      <Ionicons name={icon as any} size={16} color={C.muted} style={{ marginRight: 6 }} />
      <Text style={s.previewLabel}>{label}</Text>
      <Text style={[s.previewValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function ActionToggle({ label, desc, selected, onSelect }: {
  label: string; desc: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <TouchableOpacity style={[s.actionToggle, selected && s.actionToggleSelected]} onPress={onSelect}>
      <View style={s.actionToggleCheck}>
        {selected && <Ionicons name="checkmark" size={14} color={C.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.actionToggleLabel, selected && { color: C.primary }]}>{label}</Text>
        <Text style={s.actionToggleDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dedupeRules(rules: CustomNodeRule[]): CustomNodeRule[] {
  const seen = new Set<string>();
  return rules.filter(r => {
    const key = `${r.pkg}|${r.matchResId ?? ''}|${r.matchText ?? ''}|${r.matchCls ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function qualityColor(tier?: string) {
  if (tier === 'strong') return C.green;
  if (tier === 'medium') return C.yellow;
  return C.orange;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 24 : 0 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn:      { marginRight: 12, padding: 4 },
  title:         { flex: 1, color: C.text, fontSize: 17, fontWeight: '700' },
  clearBtn:      { padding: 6 },
  subtitle:      { color: C.muted, fontSize: 12, paddingHorizontal: 16, paddingVertical: 8, lineHeight: 18 },
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabText:       { color: C.muted, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: C.primary },
  list:          { padding: 12, gap: 10 },

  // Rule card
  ruleCard:      { backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  ruleHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  actionBadge:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  actionBadgeText:{ fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  ruleLabel:     { flex: 1, color: C.text, fontSize: 14, fontWeight: '600' },
  qualityBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  qualityBadgeText:{ fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  rulePkg:       { color: C.muted, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 2 },
  ruleSource:    { color: C.muted, fontSize: 10, marginBottom: 6, opacity: 0.7 },
  ruleSelectors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  ruleWarning:   { color: C.orange, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  chip:          { flexDirection: 'row', backgroundColor: C.surfaceVar, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  chipLabel:     { color: C.muted, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  chipValue:     { color: C.text, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', maxWidth: 160, marginLeft: 2 },
  ruleFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ruleDate:      { color: C.muted, fontSize: 11 },
  ruleActions:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn:     { padding: 6 },

  // Empty / action button
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle:    { color: C.text, fontSize: 18, fontWeight: '700' },
  emptyBody:     { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, gap: 8 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Import tab
  importContent: { padding: 16, gap: 12 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleInputWrap:{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, height: 44 },
  titleIcon:     { marginRight: 6 },
  titleInput:    { flex: 1, color: C.text, fontSize: 14 },
  browseBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.primary + '66', paddingHorizontal: 12, height: 44 },
  browseBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  importHint:    { color: C.muted, fontSize: 12, lineHeight: 18 },
  jsonInput:     { backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', padding: 12, textAlignVertical: 'top', minHeight: 140 },
  jsonInputError:{ borderColor: C.red },
  jsonInputOk:   { borderColor: C.green + '88' },
  clearJsonBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  clearJsonText: { color: C.muted, fontSize: 12 },
  errorBox:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.red + '18', borderRadius: 8, padding: 10 },
  errorText:     { color: C.red, fontSize: 13, flex: 1, lineHeight: 18 },
  previewBox:    { backgroundColor: C.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  previewTitle:  { color: C.green, fontWeight: '700', fontSize: 14, marginBottom: 10 },
  previewRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  previewLabel:  { color: C.muted, fontSize: 13, flex: 1 },
  previewValue:  { color: C.text, fontSize: 13, fontWeight: '600' },
  importWarning: { color: C.yellow, fontSize: 12, lineHeight: 17, marginTop: 4 },
  sectionLabel:  { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  actionToggleRow:{ gap: 8 },
  actionToggle:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surfaceVar, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.border },
  actionToggleSelected: { borderColor: C.primary + '88' },
  actionToggleCheck:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  actionToggleLabel:    { color: C.text, fontSize: 14, fontWeight: '600' },
  actionToggleDesc:     { color: C.muted, fontSize: 12, marginTop: 2 },
  importConfirmBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 10, paddingVertical: 14, gap: 8, marginTop: 16 },
  importConfirmText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
});
