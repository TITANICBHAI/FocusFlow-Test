import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { createTask, parseQuickInput, formatDuration } from '@/services/taskService';
import { COLORS, FONT, RADIUS, SPACING, TASK_COLORS } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Task, TaskPriority, AllowedAppPreset } from '@/data/types';
import { AppPickerSheet } from './AppPickerSheet';
import { useApp } from '@/context/AppContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (task: Task) => Promise<void>;
  initialStartTime?: string;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

function initialDate(hhmm?: string): Date {
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return dayjs().hour(h).minute(m).second(0).toDate();
  }
  return dayjs().add(5, 'minute').second(0).toDate();
}

export default function QuickAddModal({ visible, onClose, onSave, initialStartTime }: Props) {
  const insets = useSafeAreaInsets();
  const { state, updateSettings } = useApp();
  const { theme } = useTheme();
  const presets: AllowedAppPreset[] = state.settings.allowedAppPresets ?? [];

  const [quickText, setQuickText] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(() => initialDate(initialStartTime));
  const [showPicker, setShowPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState(60);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationText, setCustomDurationText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState(TASK_COLORS[0]);
  const [focusMode, setFocusMode] = useState(false);
  // undefined = use global setting (default for new tasks); [] = all apps allowed (explicit)
  const [useGlobalApps, setUseGlobalApps] = useState(true);
  const [focusAllowedPackages, setFocusAllowedPackages] = useState<string[]>([]);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleQuickParse = useCallback(() => {
    if (!quickText.trim()) return;
    const parsed = parseQuickInput(quickText);
    setTitle(parsed.title);
    setDuration(parsed.durationMinutes);
    if (parsed.startTime) {
      setStartDate(new Date(parsed.startTime));
    }
    setIsAdvanced(true);
  }, [quickText]);

  const handleSave = useCallback(async () => {
    const finalTitle = title || quickText || 'New Task';
    if (!finalTitle.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }

    const startISO = dayjs(startDate).second(0).toISOString();

    const task = createTask({
      title: finalTitle.trim(),
      description: description.trim() || undefined,
      startTime: startISO,
      durationMinutes: duration,
      priority,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      color,
      focusMode,
      focusAllowedPackages: focusMode ? (useGlobalApps ? undefined : focusAllowedPackages) : undefined,
    });

    setSaving(true);
    try {
      await onSave(task);
      handleClose();
    } catch {
      Alert.alert('Error', 'Failed to save task. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [title, quickText, description, startDate, duration, priority, tags, color, focusMode, focusAllowedPackages, useGlobalApps, onSave]);

  const handleClose = () => {
    setQuickText('');
    setTitle('');
    setDescription('');
    setStartDate(initialDate(initialStartTime));
    setShowPicker(false);
    setShowDatePicker(false);
    setDuration(60);
    setIsCustomDuration(false);
    setCustomDurationText('');
    setPriority('medium');
    setTags('');
    setColor(TASK_COLORS[0]);
    setFocusMode(false);
    setUseGlobalApps(true);
    setFocusAllowedPackages([]);
    setShowAppPicker(false);
    setIsAdvanced(false);
    onClose();
  };

  const globalAllowedCount = (state.settings.allowedInFocus ?? []).length;
  const allowedAppsLabel = useGlobalApps
    ? globalAllowedCount > 0
      ? `Using global setting (${globalAllowedCount} app${globalAllowedCount !== 1 ? 's' : ''})`
      : 'Using global setting (all apps allowed)'
    : focusAllowedPackages.length === 0
      ? 'All apps allowed'
      : `${focusAllowedPackages.length} app${focusAllowedPackages.length !== 1 ? 's' : ''} allowed`;

  const handleSavePreset = async (preset: AllowedAppPreset) => {
    const newPresets = [...presets, preset];
    await updateSettings({ ...state.settings, allowedAppPresets: newPresets });
  };

  const handleDeletePreset = async (id: string) => {
    const newPresets = presets.filter((p) => p.id !== id);
    await updateSettings({ ...state.settings, allowedAppPresets: newPresets });
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={theme.muted} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.text }]}>New Task</Text>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
              keyboardShouldPersistTaps="handled"
            >

              {/* Quick input */}
              {!isAdvanced && (
                <View style={styles.quickRow}>
                  <TextInput
                    style={[styles.quickInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                    placeholder='e.g. "Call Bob at 3pm for 30m"'
                    placeholderTextColor={theme.muted}
                    value={quickText}
                    onChangeText={setQuickText}
                    onSubmitEditing={handleQuickParse}
                    returnKeyType="done"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.parseBtn} onPress={handleQuickParse}>
                    <Ionicons name="flash" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {(isAdvanced || !quickText) && (
                <>
                  {/* Title */}
                  <Field label="Title" labelColor={theme.textSecondary}>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                      placeholder="What do you need to do?"
                      placeholderTextColor={theme.muted}
                      value={title}
                      onChangeText={setTitle}
                      autoFocus={isAdvanced}
                    />
                  </Field>

                  {/* Description */}
                  <Field label="Notes (optional)" labelColor={theme.textSecondary}>
                    <TextInput
                      style={[styles.input, styles.multiline, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                      placeholder="Add details…"
                      placeholderTextColor={theme.muted}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={3}
                    />
                  </Field>

                  {/* Date + Time — supports scheduling for any future day */}
                  <Field label="Start" labelColor={theme.textSecondary}>
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity
                        style={[styles.input, styles.timePickerRow, styles.flexHalf, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => setShowDatePicker(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="calendar-outline" size={18} color={theme.muted} />
                        <Text style={[styles.timePickerText, { color: theme.text }]}>
                          {dayjs(startDate).isSame(dayjs(), 'day')
                            ? 'Today'
                            : dayjs(startDate).isSame(dayjs().add(1, 'day'), 'day')
                              ? 'Tomorrow'
                              : dayjs(startDate).format('ddd, MMM D')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.input, styles.timePickerRow, styles.flexHalf, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => setShowPicker(true)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time-outline" size={18} color={theme.muted} />
                        <Text style={[styles.timePickerText, { color: theme.text }]}>
                          {dayjs(startDate).format('h:mm A')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {showDatePicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        minimumDate={new Date()}
                        display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                        onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                          setShowDatePicker(false);
                          if (selected) {
                            // Preserve the time portion already chosen
                            const merged = dayjs(selected)
                              .hour(startDate.getHours())
                              .minute(startDate.getMinutes())
                              .second(0)
                              .toDate();
                            setStartDate(merged);
                          }
                        }}
                      />
                    )}
                    {showPicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                        onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                          setShowPicker(false);
                          if (selected) {
                            // Preserve the date portion already chosen
                            const merged = dayjs(startDate)
                              .hour(selected.getHours())
                              .minute(selected.getMinutes())
                              .second(0)
                              .toDate();
                            setStartDate(merged);
                          }
                        }}
                      />
                    )}
                  </Field>

                  {/* Duration */}
                  <Field label={`Duration: ${isCustomDuration ? (parseInt(customDurationText, 10) > 0 ? formatDuration(parseInt(customDurationText, 10)) : 'Custom') : formatDuration(duration)}`} labelColor={theme.textSecondary}>
                    <View style={styles.durationRow}>
                      {DURATION_OPTIONS.map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, !isCustomDuration && d === duration && styles.chipSelected]}
                          onPress={() => { setDuration(d); setIsCustomDuration(false); setCustomDurationText(''); }}
                        >
                          <Text style={[styles.chipText, { color: theme.text }, !isCustomDuration && d === duration && styles.chipTextSelected]}>
                            {formatDuration(d)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, isCustomDuration && styles.chipSelected]}
                        onPress={() => { setIsCustomDuration(true); setCustomDurationText(String(duration)); }}
                      >
                        <Text style={[styles.chipText, { color: theme.text }, isCustomDuration && styles.chipTextSelected]}>
                          Custom
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isCustomDuration && (
                      <View style={styles.customDurationRow}>
                        <TextInput
                          style={[styles.input, styles.customDurationInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                          value={customDurationText}
                          onChangeText={(text) => {
                            setCustomDurationText(text);
                            const parsed = parseInt(text, 10);
                            if (!isNaN(parsed) && parsed > 0) setDuration(parsed);
                          }}
                          keyboardType="number-pad"
                          placeholder="Minutes"
                          placeholderTextColor={theme.muted}
                          autoFocus
                        />
                        <Text style={[styles.customDurationLabel, { color: theme.textSecondary }]}>minutes</Text>
                      </View>
                    )}
                  </Field>

                  {/* Priority */}
                  <Field label="Priority" labelColor={theme.textSecondary}>
                    <View style={styles.row}>
                      {PRIORITY_OPTIONS.map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, p === priority && styles.chipSelected]}
                          onPress={() => setPriority(p)}
                        >
                          <Text style={[styles.chipText, { color: theme.text }, p === priority && styles.chipTextSelected]}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Field>

                  {/* Color */}
                  <Field label="Color" labelColor={theme.textSecondary}>
                    <View style={styles.row}>
                      {TASK_COLORS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.colorDot, { backgroundColor: c }, c === color && styles.colorDotSelected, c === color && { borderColor: theme.text }]}
                          onPress={() => setColor(c)}
                        />
                      ))}
                    </View>
                  </Field>

                  {/* Tags */}
                  <Field label="Tags (comma separated)" labelColor={theme.textSecondary}>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                      placeholder="work, focus, meeting"
                      placeholderTextColor={theme.muted}
                      value={tags}
                      onChangeText={setTags}
                      autoCapitalize="none"
                    />
                  </Field>

                  {/* Focus Mode toggle */}
                  <View style={[styles.switchRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>Enable Focus Mode</Text>
                      <Text style={[styles.switchDesc, { color: theme.muted }]}>Block distractions during this task</Text>
                    </View>
                    <Switch
                      value={focusMode}
                      onValueChange={setFocusMode}
                      trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
                      thumbColor={focusMode ? COLORS.primary : theme.muted}
                    />
                  </View>

                  {/* Pomodoro toggle — shown when focus mode is on */}
                  {focusMode && (
                    <View style={[styles.switchRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>Pomodoro Mode</Text>
                        <Text style={[styles.switchDesc, { color: theme.muted }]}>
                          {state.settings.pomodoroEnabled
                            ? `On — ${state.settings.pomodoroDuration ?? 25}m work / ${state.settings.pomodoroBreak ?? 5}m break`
                            : 'Off — one continuous session (global setting)'}
                        </Text>
                      </View>
                      <Switch
                        value={state.settings.pomodoroEnabled}
                        onValueChange={(v) => { void updateSettings({ ...state.settings, pomodoroEnabled: v }); }}
                        trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
                        thumbColor={state.settings.pomodoroEnabled ? COLORS.primary : theme.muted}
                      />
                    </View>
                  )}

                  {/* Allowed apps — shown when focus mode is on */}
                  {focusMode && (
                    <>
                      <View style={[styles.switchRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.switchLabel, { color: theme.text }]}>Use Global Allowed List</Text>
                          <Text style={[styles.switchDesc, { color: theme.muted }]}>
                            {globalAllowedCount > 0
                              ? `${globalAllowedCount} app${globalAllowedCount !== 1 ? 's' : ''} from Settings → Allowed In Focus`
                              : 'All apps (configure in Settings → Allowed In Focus)'}
                          </Text>
                        </View>
                        <Switch
                          value={useGlobalApps}
                          onValueChange={setUseGlobalApps}
                          trackColor={{ false: theme.border, true: COLORS.primary + '88' }}
                          thumbColor={useGlobalApps ? COLORS.primary : theme.muted}
                        />
                      </View>

                      {!useGlobalApps && (
                        <TouchableOpacity
                          style={[styles.allowedAppsRow, { backgroundColor: theme.card }]}
                          onPress={() => setShowAppPicker(true)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.allowedAppsIcon}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                          </View>
                          <View style={styles.allowedAppsInfo}>
                            <Text style={[styles.allowedAppsLabel, { color: theme.text }]}>Allowed Apps</Text>
                            <Text style={styles.allowedAppsValue}>{allowedAppsLabel}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Nested app picker sheet */}
      <AppPickerSheet
        visible={showAppPicker}
        title="Allowed Apps for This Task"
        initialSelected={focusAllowedPackages}
        presets={presets}
        onSave={setFocusAllowedPackages}
        onSavePreset={(preset) => { void handleSavePreset(preset); }}
        onDeletePreset={(id) => { void handleDeletePreset(id); }}
        onClose={() => setShowAppPicker(false)}
      />
    </>
  );
}

function Field({ label, children, labelColor }: { label: string; children: React.ReactNode; labelColor?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.sm },
  body: { flex: 1, padding: SPACING.lg },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  quickInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  parseBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  multiline: { height: 80, textAlignVertical: 'top', paddingTop: SPACING.sm },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dateTimeRow: { flexDirection: 'row', gap: SPACING.sm },
  flexHalf: { flex: 1 },
  timePickerText: { fontSize: FONT.md, color: COLORS.text },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT.sm, color: COLORS.text, textTransform: 'capitalize' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: SPACING.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: COLORS.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: { fontSize: FONT.md, fontWeight: '600', color: COLORS.text },
  switchDesc: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  customDurationInput: {
    width: 100,
  },
  customDurationLabel: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
  },
  allowedAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    gap: SPACING.sm,
  },
  allowedAppsIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowedAppsInfo: {
    flex: 1,
  },
  allowedAppsLabel: {
    fontSize: FONT.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  allowedAppsValue: {
    fontSize: FONT.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
});
