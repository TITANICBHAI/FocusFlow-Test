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
const COLORS_OPTIONS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
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
  const [tags, setTags] = useState(task.tags.join(', '));
  const [color, setColor] = useState(task.color);
  const [focusMode, setFocusMode] = useState(task.focusMode);
  // undefined = use global setting; [] = all apps allowed (explicit override)
  const [useGlobalApps, setUseGlobalApps] = useState<boolean>(
    task.focusAllowedPackages === undefined,
  );
  const [focusAllowedPackages, setFocusAllowedPackages] = useState<string[]>(
    task.focusAllowedPackages ?? [],
  );
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [saving, setSaving] = useState(false);

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
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      color,
      focusMode,
      focusAllowedPackages: focusMode ? (useGlobalApps ? undefined : focusAllowedPackages) : undefined,
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

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">

          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor={theme.muted}
              returnKeyType="next"
              autoFocus
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add notes..."
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Start time */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Start Time</Text>
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

          {/* Duration */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Duration (minutes)</Text>
            <TextInput
              style={[styles.input, { width: 120, backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={durationStr}
              onChangeText={setDurationStr}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={theme.muted}
            />
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Priority</Text>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.chipText, { color: theme.text }, priority === p && { color: '#fff' }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Tags (comma separated)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              value={tags}
              onChangeText={setTags}
              placeholder="work, deep-focus, health"
              placeholderTextColor={theme.muted}
            />
          </View>

          {/* Color */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
                  onPress={() => setColor(c)}
                >
                  {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
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

            {/* Pomodoro toggle — shown when focus mode is on */}
            {focusMode && (
              <TouchableOpacity
                style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => { void updateSettings({ ...state.settings, pomodoroEnabled: !state.settings.pomodoroEnabled }); }}
              >
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleTitle, { color: theme.text }]}>Pomodoro Mode</Text>
                  <Text style={[styles.toggleSub, { color: theme.muted }]}>
                    {state.settings.pomodoroEnabled
                      ? `On — ${state.settings.pomodoroDuration ?? 25}m work / ${state.settings.pomodoroBreak ?? 5}m break`
                      : 'Off — one continuous session (global setting)'}
                  </Text>
                </View>
                <View style={[styles.toggle, state.settings.pomodoroEnabled && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, state.settings.pomodoroEnabled && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            )}

            {/* Allowed apps — shown when focus mode is on */}
            {focusMode && (
              <>
                <TouchableOpacity
                  style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setUseGlobalApps((v) => !v)}
                >
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleTitle, { color: theme.text }]}>Use Global Allowed List</Text>
                    <Text style={[styles.toggleSub, { color: theme.muted }]}>
                      {globalAllowedCount > 0
                        ? `${globalAllowedCount} app${globalAllowedCount !== 1 ? 's' : ''} from Settings → Allowed In Focus`
                        : 'All apps (configure in Settings → Allowed In Focus)'}
                    </Text>
                  </View>
                  <View style={[styles.toggle, useGlobalApps && styles.toggleOn]}>
                    <View style={[styles.toggleThumb, useGlobalApps && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>

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
          </View>
        </ScrollView>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
          <Text style={styles.deleteBtnText}>Delete Task</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
  label: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
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
  timePickerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  timePickerText: { fontSize: FONT.md, color: COLORS.text },
  chipRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  colorRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
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
  allowedAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1.5,
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
  allowedAppsInfo: { flex: 1 },
  allowedAppsLabel: { fontSize: FONT.md, fontWeight: '600', color: COLORS.text },
  allowedAppsValue: { fontSize: FONT.sm, color: COLORS.primary, marginTop: 2 },
});
