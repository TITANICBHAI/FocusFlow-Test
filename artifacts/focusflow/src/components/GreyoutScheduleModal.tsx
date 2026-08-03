import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import type { GreyoutWindow } from '@/data/types';
import { InstalledAppsModule, type InstalledApp } from '@/native-modules/InstalledAppsModule';

interface Props {
  visible: boolean;
  windows: GreyoutWindow[];
  onSave: (windows: GreyoutWindow[]) => Promise<void>;
  onClose: () => void;
  /** Freeze delete and disallow weakening edits while a standalone block is active. */
  standaloneActive?: boolean;
  /**
   * Gate destructive / weakening actions behind the defense password.
   * If undefined, actions proceed freely (no PIN configured).
   */
  requireDefensePin?: (title: string, description: string, action: () => void) => void;
}

const DAY_LABELS  = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_VALUES  = [1, 2, 3, 4, 5, 6, 7];

type Mode = 'list' | 'add';

const BLANK_WINDOW: GreyoutWindow = {
  pkg: '',
  pkgs: [],
  startHour: 9,
  startMin: 0,
  endHour: 18,
  endMin: 0,
  days: [2, 3, 4, 5, 6],
  name: '',
  enabled: true,
};

type SelectedApp = { pkg: string; name: string };

export function GreyoutScheduleModal({ visible, windows, onSave, onClose, standaloneActive = false, requireDefensePin }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [localWindows, setLocalWindows] = useState<GreyoutWindow[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [draft, setDraft] = useState<GreyoutWindow>(BLANK_WINDOW);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Track the window being edited so we can detect time-decrease at commit time.
  const [originalWindow, setOriginalWindow] = useState<GreyoutWindow | null>(null);

  // ── App search state ──────────────────────────────────────────────────────
  const [allApps, setAllApps] = useState<InstalledApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [selectedApps, setSelectedApps] = useState<SelectedApp[]>([]);

  // Load installed apps whenever the modal opens
  useEffect(() => {
    if (!visible) return;
    setLocalWindows(windows);
    setMode('list');
    setDraft(BLANK_WINDOW);
    setEditIndex(null);
    setSelectedApps([]);
    setAppSearch('');
    setAppsLoading(true);
    InstalledAppsModule.getInstalledApps()
      .then((apps) => {
        setAllApps(
          apps.slice().sort((a, b) =>
            a.appName.toLowerCase().localeCompare(b.appName.toLowerCase()),
          ),
        );
      })
      .catch(() => {})
      .finally(() => setAppsLoading(false));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lookup map pkg → friendly name (for list view display)
  const pkgToName = useMemo(
    () => new Map(allApps.map((a) => [a.packageName, a.appName])),
    [allApps],
  );

  // Live-filter installed apps as user types, excluding already-selected ones
  const filteredApps = useMemo(() => {
    if (!appSearch.trim()) return [];
    const q = appSearch.toLowerCase();
    const selectedPkgs = new Set(selectedApps.map((a) => a.pkg));
    return allApps
      .filter(
        (a) =>
          (a.appName.toLowerCase().includes(q) ||
            a.packageName.toLowerCase().includes(q)) &&
          !selectedPkgs.has(a.packageName),
      )
      .slice(0, 8);
  }, [appSearch, allApps, selectedApps]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatTime = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

  const toggleDay = (dayVal: number) => {
    const exists = draft.days.includes(dayVal);
    setDraft((d) => ({
      ...d,
      days: exists
        ? d.days.filter((v) => v !== dayVal)
        : [...d.days, dayVal].sort((a, b) => a - b),
    }));
  };

  const adjustHour = (field: 'startHour' | 'endHour', delta: number) => {
    setDraft((d) => ({ ...d, [field]: (d[field] + delta + 24) % 24 }));
  };

  const adjustMin = (field: 'startMin' | 'endMin', delta: number) => {
    setDraft((d) => ({ ...d, [field]: (d[field] + delta + 60) % 60 }));
  };

  /** Returns the block window's duration in minutes (handles overnight spans). */
  const windowDurationMinutes = (w: GreyoutWindow) => {
    const start = w.startHour * 60 + w.startMin;
    const end = w.endHour * 60 + w.endMin;
    return end > start ? end - start : 24 * 60 - start + end;
  };

  const selectApp = useCallback((app: InstalledApp) => {
    setSelectedApps((prev) => [...prev, { pkg: app.packageName, name: app.appName }]);
    setAppSearch('');
  }, []);

  const removeSelectedApp = useCallback((pkg: string) => {
    if (requireDefensePin) {
      requireDefensePin(
        'Remove App from Window',
        'Enter your defense password to remove this app from the block window.',
        () => setSelectedApps((prev) => prev.filter((a) => a.pkg !== pkg)),
      );
    } else {
      setSelectedApps((prev) => prev.filter((a) => a.pkg !== pkg));
    }
  }, [requireDefensePin]);

  const openAdd = () => {
    setDraft(BLANK_WINDOW);
    setSelectedApps([]);
    setAppSearch('');
    setEditIndex(null);
    setMode('add');
  };

  const doOpenEdit = (idx: number) => {
    const w = localWindows[idx];
    const pkgs = w.pkgs && w.pkgs.length > 0 ? w.pkgs : w.pkg ? [w.pkg] : [];
    const selApps = pkgs.map((pkg) => ({ pkg, name: pkgToName.get(pkg) ?? pkg }));
    setSelectedApps(selApps);
    setDraft({ ...w });
    setEditIndex(idx);
    setOriginalWindow({ ...w });
    setAppSearch('');
    setMode('add');
  };

  const openEdit = (idx: number) => {
    if (requireDefensePin) {
      requireDefensePin(
        'Edit Block Window',
        'Enter your defense password to edit this block window.',
        () => doOpenEdit(idx),
      );
    } else {
      doOpenEdit(idx);
    }
  };

  const toggleWindowEnabled = (idx: number) => {
    setLocalWindows((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, enabled: w.enabled === false ? true : false } : w)),
    );
  };

  const doCommitDraft = () => {
    const pkgs = selectedApps.map((a) => a.pkg);
    const updated = [...localWindows];
    const window: GreyoutWindow = {
      ...draft,
      pkg: pkgs[0],
      pkgs,
      name: draft.name?.trim() || undefined,
      enabled: draft.enabled !== false,
    };
    if (editIndex !== null) {
      updated[editIndex] = window;
    } else {
      updated.push(window);
    }
    setLocalWindows(updated);
    setMode('list');
  };

  const commitDraft = () => {
    if (selectedApps.length === 0) {
      Alert.alert(
        'Select at least one app',
        'Search for apps by name and tap to add them to this window.',
      );
      return;
    }
    if (draft.days.length === 0) {
      Alert.alert('Select at least one day');
      return;
    }
    // When editing: if the user shortened the block window (weakens protection),
    // require the defense password before committing.
    if (editIndex !== null && originalWindow && requireDefensePin) {
      const origDuration = windowDurationMinutes(originalWindow);
      const newDuration = windowDurationMinutes(draft);
      if (newDuration < origDuration) {
        requireDefensePin(
          'Shorten Block Window',
          'You\'re decreasing the block duration. Enter your defense password to confirm.',
          doCommitDraft,
        );
        return;
      }
    }
    doCommitDraft();
  };

  const deleteWindow = (idx: number) => {
    // Frozen during standalone — same pattern as System Protection, YT Shorts, etc.
    if (standaloneActive) {
      Alert.alert(
        'Block is Active',
        'Cannot delete a block window while a standalone block is active.',
      );
      return;
    }
    const doDelete = () => {
      const w = localWindows[idx];
      const label = windowDisplayLabel(w);
      Alert.alert('Remove Window', `Remove block window for ${label}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setLocalWindows((prev) => prev.filter((_, i) => i !== idx)),
        },
      ]);
    };
    if (requireDefensePin) {
      requireDefensePin(
        'Delete Block Window',
        'Enter your defense password to delete this block window.',
        doDelete,
      );
    } else {
      doDelete();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localWindows);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const dayRowLabel = (w: GreyoutWindow) => {
    if (w.days.length === 7) return 'Every day';
    if (JSON.stringify(w.days) === JSON.stringify([2, 3, 4, 5, 6])) return 'Weekdays';
    if (JSON.stringify(w.days) === JSON.stringify([1, 7])) return 'Weekends';
    return w.days.map((d) => DAY_NAMES[d - 1]).join(', ');
  };

  const windowDisplayLabel = (w: GreyoutWindow) => {
    const pkgs = w.pkgs && w.pkgs.length > 0 ? w.pkgs : w.pkg ? [w.pkg] : [];
    if (pkgs.length === 0) return '(no app)';
    const firstName = pkgToName.get(pkgs[0]) ?? pkgs[0];
    return pkgs.length > 1 ? `${firstName} +${pkgs.length - 1} more` : firstName;
  };

  const windowAppCount = (w: GreyoutWindow) => {
    const pkgs = w.pkgs && w.pkgs.length > 0 ? w.pkgs : w.pkg ? [w.pkg] : [];
    return pkgs.length;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            {mode === 'add' ? (
              <TouchableOpacity onPress={() => setMode('list')} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
                <Text style={[styles.headerTitle, { color: theme.text }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.headerTitle, { color: theme.text }]}>Block Schedules</Text>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* ── List view ── */}
          {mode === 'list' && (
            <>
              <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 20 }}>
                {localWindows.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Ionicons name="time-outline" size={32} color={theme.muted} />
                    <Text style={[styles.emptyText, { color: theme.muted }]}>
                      No batches yet.{'\n'}Add a batch to block specific apps during specific hours and days.
                    </Text>
                  </View>
                )}
                {localWindows.map((w, idx) => {
                  const count = windowAppCount(w);
                  const isEnabled = w.enabled !== false;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.windowCard,
                        { borderColor: isEnabled ? theme.border : theme.border + '55', backgroundColor: theme.surface },
                        !isEnabled && { opacity: 0.55 },
                      ]}
                    >
                      {/* Enable / disable toggle */}
                      <Switch
                        value={isEnabled}
                        onValueChange={() => toggleWindowEnabled(idx)}
                        trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
                        thumbColor={isEnabled ? COLORS.primary : COLORS.muted}
                        style={styles.windowSwitch}
                      />
                      <TouchableOpacity style={styles.windowMain} onPress={() => openEdit(idx)}>
                        <View style={{ flex: 1 }}>
                          {w.name ? (
                            <Text style={[styles.windowName, { color: theme.text }]} numberOfLines={1}>
                              {w.name}
                            </Text>
                          ) : null}
                          <View style={styles.windowLabelRow}>
                            <Text
                              style={[styles.windowPkg, { color: w.name ? theme.muted : theme.text }]}
                              numberOfLines={1}
                            >
                              {windowDisplayLabel(w)}
                            </Text>
                            {count > 1 && (
                              <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{count} apps</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.windowTime, { color: isEnabled ? COLORS.primary : theme.muted }]}>
                            {formatTime(w.startHour, w.startMin)} – {formatTime(w.endHour, w.endMin)}
                          </Text>
                          <Text style={[styles.windowDays, { color: theme.muted }]}>
                            {dayRowLabel(w)}
                          </Text>
                        </View>
                        <Ionicons name="create-outline" size={18} color={theme.muted} style={{ marginRight: 8 }} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteWindow(idx)}
                        style={[styles.deleteBtn, standaloneActive && { opacity: 0.38 }]}
                      >
                        {standaloneActive ? (
                          <Ionicons name="lock-closed-outline" size={16} color={theme.muted} />
                        ) : (
                          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={[styles.footer, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.addBtn, { borderColor: COLORS.primary }]}
                  onPress={openAdd}
                >
                  <Ionicons name="add" size={18} color={COLORS.primary} />
                  <Text style={[styles.addBtnText, { color: COLORS.primary }]}>Add Batch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Add / Edit view ── */}
          {mode === 'add' && (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Schedule name */}
              <Text style={[styles.formLabel, { color: theme.muted }]}>SCHEDULE NAME (optional)</Text>
              <View style={[styles.searchBox, { borderColor: theme.border, backgroundColor: theme.surface, marginBottom: SPACING.md }]}>
                <Ionicons name="bookmark-outline" size={16} color={theme.muted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  value={draft.name ?? ''}
                  onChangeText={(t) => setDraft((d) => ({ ...d, name: t }))}
                  placeholder="e.g. Morning Focus, Night Wind-down…"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  maxLength={40}
                />
              </View>

              {/* App search */}
              <Text style={[styles.formLabel, { color: theme.muted }]}>APPS</Text>

              {/* Selected app chips */}
              {selectedApps.length > 0 && (
                <View style={styles.chipsRow}>
                  {selectedApps.map((a) => (
                    <View
                      key={a.pkg}
                      style={[styles.appChip, { backgroundColor: `${COLORS.primary}18`, borderColor: COLORS.primary }]}
                    >
                      <Text style={[styles.appChipText, { color: COLORS.primary }]} numberOfLines={1}>
                        {a.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeSelectedApp(a.pkg)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Search input */}
              <View style={[styles.searchBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Ionicons name="search" size={16} color={theme.muted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  value={appSearch}
                  onChangeText={setAppSearch}
                  placeholder="Search apps by name…"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {appsLoading && <ActivityIndicator size="small" color={theme.muted} style={{ marginLeft: 4 }} />}
                {appSearch.length > 0 && !appsLoading && (
                  <TouchableOpacity onPress={() => setAppSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close-circle" size={16} color={theme.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Live search results */}
              {filteredApps.length > 0 && (
                <View style={[styles.resultsBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  {filteredApps.map((app, i) => (
                    <TouchableOpacity
                      key={app.packageName}
                      style={[
                        styles.resultRow,
                        i < filteredApps.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                      ]}
                      onPress={() => selectApp(app)}
                      activeOpacity={0.7}
                    >
                      {app.iconBase64 ? (
                        <Image
                          source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                          style={styles.resultIcon}
                        />
                      ) : (
                        <View style={[styles.resultIconPlaceholder, { backgroundColor: theme.border }]}>
                          <Ionicons name="apps-outline" size={16} color={theme.muted} />
                        </View>
                      )}
                      <View style={styles.resultText}>
                        <Text style={[styles.resultName, { color: theme.text }]} numberOfLines={1}>
                          {app.appName}
                        </Text>
                        <Text style={[styles.resultPkg, { color: theme.muted }]} numberOfLines={1}>
                          {app.packageName}
                        </Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {appSearch.trim().length > 0 && !appsLoading && filteredApps.length === 0 && (
                <Text style={[styles.noResults, { color: theme.muted }]}>No apps match "{appSearch}"</Text>
              )}

              {selectedApps.length === 0 && appSearch.trim().length === 0 && (
                <Text style={[styles.searchHint, { color: theme.muted }]}>
                  Type to search installed apps — tap to add them to this window.
                </Text>
              )}

              {/* Start time */}
              <Text style={[styles.formLabel, { color: theme.muted }]}>START TIME</Text>
              <View style={styles.timeRow}>
                <TimePicker
                  label="Hour"
                  value={draft.startHour}
                  onDecrement={() => adjustHour('startHour', -1)}
                  onIncrement={() => adjustHour('startHour', 1)}
                  theme={theme}
                />
                <Text style={[styles.timeSep, { color: theme.muted }]}>:</Text>
                <TimePicker
                  label="Min"
                  value={draft.startMin}
                  onDecrement={() => adjustMin('startMin', -5)}
                  onIncrement={() => adjustMin('startMin', 5)}
                  theme={theme}
                  pad
                />
              </View>

              {/* End time */}
              <Text style={[styles.formLabel, { color: theme.muted }]}>END TIME</Text>
              <View style={styles.timeRow}>
                <TimePicker
                  label="Hour"
                  value={draft.endHour}
                  onDecrement={() => adjustHour('endHour', -1)}
                  onIncrement={() => adjustHour('endHour', 1)}
                  theme={theme}
                />
                <Text style={[styles.timeSep, { color: theme.muted }]}>:</Text>
                <TimePicker
                  label="Min"
                  value={draft.endMin}
                  onDecrement={() => adjustMin('endMin', -5)}
                  onIncrement={() => adjustMin('endMin', 5)}
                  theme={theme}
                  pad
                />
              </View>

              {/* Time protection hint — only shown when editing with defense PIN active */}
              {editIndex !== null && requireDefensePin && (
                <View style={[styles.hintBanner, { backgroundColor: COLORS.primary + '14', borderColor: COLORS.primary + '40' }]}>
                  <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
                  <Text style={[styles.hintText, { color: COLORS.primary }]}>
                    {'Tap ▲ to increase time — no password needed. Decreasing the window will ask for your Defense Password when you tap "Update Window".'}
                  </Text>
                </View>
              )}

              {/* Days */}
              <Text style={[styles.formLabel, { color: theme.muted }]}>ACTIVE DAYS</Text>
              <View style={styles.daysRow}>
                {DAY_VALUES.map((dayVal, i) => {
                  const active = draft.days.includes(dayVal);
                  return (
                    <TouchableOpacity
                      key={dayVal}
                      style={[
                        styles.dayChip,
                        { borderColor: active ? COLORS.primary : theme.border },
                        active && { backgroundColor: COLORS.primary },
                      ]}
                      onPress={() => toggleDay(dayVal)}
                    >
                      <Text style={[styles.dayChipText, { color: active ? '#fff' : theme.muted }]}>
                        {DAY_LABELS[i]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
                <TouchableOpacity
                  style={[styles.cancelAddBtn, { borderColor: theme.border }]}
                  onPress={() => setMode('list')}
                >
                  <Text style={[styles.cancelAddText, { color: theme.muted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmAddBtn, { backgroundColor: COLORS.primary }]}
                  onPress={commitDraft}
                >
                  <Text style={styles.confirmAddText}>
                    {editIndex !== null ? 'Update Window' : 'Add Window'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Time picker sub-component ────────────────────────────────────────────────

function TimePicker({
  label, value, onDecrement, onIncrement, theme, pad: doPad,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  pad?: boolean;
}) {
  const display = doPad ? String(value).padStart(2, '0') : String(value);
  return (
    <View style={styles.timePicker}>
      <Text style={[styles.timePickerLabel, { color: theme.muted }]}>{label}</Text>
      <TouchableOpacity onPress={onIncrement} style={styles.timeArrow}>
        <Ionicons name="chevron-up" size={20} color={theme.text} />
      </TouchableOpacity>
      <Text style={[styles.timePickerValue, { color: theme.text }]}>{display}</Text>
      <TouchableOpacity onPress={onDecrement} style={styles.timeArrow}>
        <Ionicons name="chevron-down" size={20} color={theme.text} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: FONT.lg, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scroll: { paddingHorizontal: SPACING.lg },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  windowCard: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  windowSwitch: {
    marginLeft: SPACING.sm,
    flexShrink: 0,
  },
  windowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  windowName: { fontSize: FONT.sm, fontWeight: '700', marginBottom: 1 },
  windowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  windowPkg: { fontSize: FONT.sm, fontWeight: '600' },
  countBadge: {
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: { fontSize: FONT.xs, color: COLORS.primary, fontWeight: '600' },
  windowTime: { fontSize: FONT.md, fontWeight: '700', marginTop: 2 },
  windowDays: { fontSize: FONT.xs, marginTop: 2 },
  deleteBtn: {
    padding: SPACING.md,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: COLORS.border,
  },

  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  addBtnText: { fontSize: FONT.sm, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },

  formLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    maxWidth: 180,
  },
  appChipText: { fontSize: FONT.xs, fontWeight: '600', flex: 1 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONT.sm, padding: 0 },

  resultsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  resultIcon: { width: 32, height: 32, borderRadius: RADIUS.sm },
  resultIconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1 },
  resultName: { fontSize: FONT.sm, fontWeight: '600' },
  resultPkg: { fontSize: FONT.xs },

  noResults: { fontSize: FONT.xs, marginTop: SPACING.xs, fontStyle: 'italic' },
  searchHint: { fontSize: FONT.xs, marginTop: SPACING.xs, lineHeight: 17 },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  timeSep: {
    fontSize: FONT.xl,
    fontWeight: '300',
    marginTop: 16,
  },
  timePicker: {
    alignItems: 'center',
    width: 72,
  },
  timePickerLabel: {
    fontSize: FONT.xs,
    marginBottom: 2,
  },
  timeArrow: {
    padding: 4,
  },
  timePickerValue: {
    fontSize: FONT.xxl,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },

  daysRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: FONT.sm, fontWeight: '700' },

  cancelAddBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  cancelAddText: { fontSize: FONT.sm, fontWeight: '600' },
  confirmAddBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  confirmAddText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },

  hintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  hintText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 17,
  },
});
