import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Task, TaskPriority, AllowedAppPreset } from '@/data/types';
import { AppPickerSheet } from './AppPickerSheet';
import { useApp } from '@/context/AppContext';

interface Props {
  task: Task;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: Task) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: COLORS.green,
  medium: COLORS.blue,
  high: COLORS.orange,
  critical: COLORS.red,
};
const DURATION_PRESETS = [
  { label: '25m', minutes: 25 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h 30m', minutes: 90 },
  { label: '2h', minutes: 120 },
];

export default function EditTaskModal({ task, visible, onClose, onSave, onDelete }: Props) {
  const { state, updateSettings } = useApp();
  const { theme } = useTheme();
  const presets: AllowedAppPreset[] = state.settings.allowedAppPresets ?? [];

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [startDate, setStartDate] = useState<Date>(new Date(task.startTime));
  const [showPicker, setShowPicker] = useState(false);
  const [durationStr, setDurationStr] = useState(String(task.durationMinutes));
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [localTags, setLocalTags] = useState<string[]>(task.tags);
  const [tagInput, setTagInput] = useState('');
  const [color, setColor] = useState(PRIORITY_COLORS[task.priority]);
  const [focusMode, setFocusMode] = useState(task.focusMode);
  const [focusAllowedPackages, setFocusAllowedPackages] = useState<string[]>(
    task.focusAllowedPackages ?? [],
  );
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(description.trim()));
  const [saving, setSaving] = useState(false);

  const globalAllowedCount = (state.settings.allowedInFocus ?? []).length;
  const usesGlobalApps = task.focusAllowedPackages === undefined;
  const allowedAppsDescription = usesGlobalApps && focusAllowedPackages.length === 0
    ? globalAllowedCount > 0
      ? `Using your global list (${globalAllowedCount} app${globalAllowedCount !== 1 ? 's' : ''})`
      : 'Using your global list (all apps allowed)'
    : focusAllowedPackages.length === 0
      ? 'All apps allowed for this task'
      : `${focusAllowedPackages.length} custom app${focusAllowedPackages.length !== 1 ? 's' : ''} allowed`;

  const addTag = () => {
    const nextTag = tagInput.trim().replace(/^#/, '');
    if (!nextTag || localTags.includes(nextTag)) {
      setTagInput('');
      return;
    }
    setLocalTags((current) => [...current, nextTag]);
    setTagInput('');
  };

  const handleSavePreset = async (preset: AllowedAppPreset) => {
    const newPresets = [...presets, preset];
    await updateSettings({ ...state.settings, allowedAppPresets: newPresets });
  };

  const handleDeletePreset = async (id: string) => {
    const newPresets = presets.filter((p) => p.id !== id);
    await updateSettings({ ...state.settings, allowedAppPresets: newPresets });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a task title.');
      return;
    }

    const duration = parseInt(durationStr, 10);

    if (isNaN(duration) || duration < 5) {
      Alert.alert('Invalid duration', 'Duration must be at least 5 minutes.');
      return;
    }

    const newStart = dayjs(startDate).second(0).millisecond(0);
    const newEnd = newStart.add(duration, 'minute');

    const updated: Task = {
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      durationMinutes: duration,
      priority,
      tags: localTags,
      color,
      focusMode,
      focusAllowedPackages: focusMode
        ? (usesGlobalApps && focusAllowedPackages.length === 0 ? undefined : focusAllowedPackages)
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSave(updated);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      `Delete "${task.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await onDelete(task.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={[styles.cancel, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Task</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
            <Text style={[styles.save, saving && { opacity: 0.5 }]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="never"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={Keyboard.dismiss}
        >

          <View style={styles.field}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor={theme.muted}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <TouchableOpacity
              style={[styles.notesToggle, { borderColor: theme.border }]}
              onPress={() => setShowNotes((current) => !current)}
              activeOpacity={0.7}
            >
              <View style={styles.notesToggleInfo}>
                <Ionicons name="document-text-outline" size={18} color={theme.muted} />
                <Text style={[styles.notesToggleText, { color: theme.text }]}>Notes</Text>
                {!description.trim() && <Text style={[styles.optionalText, { color: theme.muted }]}>Optional</Text>}
              </View>
              <Ionicons name={showNotes ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} />
            </TouchableOpacity>
            {showNotes && (
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add notes..."
                placeholderTextColor={theme.muted}
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          <View style={styles.field}>
            <TouchableOpacity
              style={[styles.input, styles.timePickerRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color={theme.muted} />
              <Text style={[styles.timePickerText, { color: theme.text }]}>
                {dayjs(startDate).format('h:mm A')}
              </Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={startDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                  setShowPicker(false);
                  if (selected) setStartDate(selected);
                }}
              />
            )}
          </View>

          <View style={styles.field}>
            <View style={styles.durationRow}>
              {DURATION_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.minutes}
                  style={[
                    styles.durationChip,
                    { borderColor: theme.border },
                    Number(durationStr) === preset.minutes && {
                      backgroundColor: COLORS.primary,
                      borderColor: COLORS.primary,
                    },
                  ]}
                  onPress={() => setDurationStr(String(preset.minutes))}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.durationChipText,
                    { color: theme.text },
                    Number(durationStr) === preset.minutes && { color: '#fff' },
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] },
                  ]}
                  onPress={() => {
                    setPriority(p);
                    setColor(PRIORITY_COLORS[p]);
                  }}
                >
                  <Text style={[styles.chipText, { color: theme.text }, priority === p && { color: '#fff' }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            {localTags.length > 0 && (
              <View style={styles.tagsRow}>
                {localTags.map((tag) => (
                  <View key={tag} style={[styles.tagChip, { backgroundColor: COLORS.primary + '16', borderColor: COLORS.primary + '44' }]}>
                    <Text style={[styles.tagChipText, { color: COLORS.primary }]}>#{tag}</Text>
                    <TouchableOpacity onPress={() => setLocalTags((current) => current.filter((item) => item !== tag))} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                      <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              placeholder="Add a tag"
              placeholderTextColor={theme.muted}
              returnKeyType="done"
            />
            <Text style={[styles.helperText, { color: theme.muted }]}>Press return to add each tag.</Text>
          </View>

          {/* Focus mode toggle */}
          <View style={styles.field}>
            <TouchableOpacity style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setFocusMode((v) => !v)}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>Focus Mode</Text>
                <Text style={[styles.toggleSub, { color: theme.muted }]}>Block distracting apps during this task</Text>
              </View>
              <View style={[styles.toggle, focusMode && styles.toggleOn]}>
                <View style={[styles.toggleThumb, focusMode && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Allowed apps — shown when focus mode is on */}
            {focusMode && (
              <View style={[styles.allowedAppsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.allowedAppsInfo}>
                  <Text style={[styles.allowedAppsLabel, { color: theme.text }]}>Allowed apps</Text>
                  <Text style={[styles.allowedAppsDescription, { color: theme.muted }]}>{allowedAppsDescription}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.customizeRow, { borderColor: COLORS.primary + '44' }]}
                  onPress={() => setShowAppPicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="options-outline" size={18} color={COLORS.primary} />
                  <Text style={[styles.customizeText, { color: COLORS.primary }]}>Customize</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
          <Text style={styles.deleteBtnText}>Delete Task</Text>
        </TouchableOpacity>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>

    {/* Nested app picker sheet — rendered outside the main Modal to avoid z-index issues */}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
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
  headerTitle: { fontSize: FONT.md, fontWeight: '700', color: COLORS.text },
  headerBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xs, minWidth: 60 },
  cancel: { fontSize: FONT.md, color: COLORS.muted },
  save: { fontSize: FONT.md, fontWeight: '700', color: COLORS.primary },
  body: { flex: 1 },
  bodyContent: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 40 },
  field: { gap: SPACING.xs },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    color: COLORS.text,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: SPACING.sm },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  notesToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  notesToggleText: { fontSize: FONT.md, fontWeight: '600' },
  optionalText: { fontSize: FONT.xs, marginLeft: SPACING.xs },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  timePickerText: { fontSize: FONT.md, color: COLORS.text },
  durationRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  durationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  durationChipText: { fontSize: FONT.sm, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  tagsRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  tagChipText: { fontSize: FONT.sm, fontWeight: '600' },
  helperText: { fontSize: FONT.xs, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.border },
  toggleInfo: { flex: 1 },
  toggleTitle: { fontSize: FONT.md, fontWeight: '600', color: COLORS.text },
  toggleSub: { fontSize: FONT.xs, color: COLORS.muted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: COLORS.border, padding: 3 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    margin: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.red + '44',
    backgroundColor: COLORS.red + '08',
  },
  deleteBtnText: { color: COLORS.red, fontSize: FONT.md, fontWeight: '600' },
  allowedAppsSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1.5,
    gap: SPACING.sm,
  },
  allowedAppsInfo: { flex: 1 },
  allowedAppsLabel: { fontSize: FONT.md, fontWeight: '600', color: COLORS.text },
  allowedAppsDescription: { fontSize: FONT.xs, marginTop: 2 },
  customizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  customizeText: { flex: 1, fontSize: FONT.sm, fontWeight: '700' },
});
