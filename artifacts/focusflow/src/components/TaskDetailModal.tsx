import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Task } from '@/data/types';
import { formatTime } from '@/services/taskService';

interface Props {
  task: Task;
  onClose: () => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onExtend: (id: string) => void;
  onStartFocus: (id: string) => void;
  onEdit: (task: Task) => void;
}

export default function TaskDetailModal({
  task,
  onClose,
  onComplete,
  onSkip,
  onExtend,
  onStartFocus,
  onEdit,
}: Props) {
  const { theme } = useTheme();

  const isActive =
    task.status !== 'completed' &&
    task.status !== 'skipped' &&
    dayjs(task.startTime).isBefore(dayjs()) &&
    dayjs(task.endTime).isAfter(dayjs());

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={[styles.colorDot, { backgroundColor: task.color }]} />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{task.title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body}>
          {task.description && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.muted }]}>Notes</Text>
              <Text style={[styles.desc, { color: theme.text }]}>{task.description}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.muted }]}>Schedule</Text>
            <Text style={[styles.value, { color: theme.text }]}>{formatTime(task.startTime)} – {formatTime(task.endTime)}</Text>
            <Text style={[styles.subvalue, { color: theme.muted }]}>{dayjs(task.startTime).format('dddd, MMMM D')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.muted }]}>Priority</Text>
            <Text style={[styles.value, { color: theme.text, textTransform: 'capitalize' }]}>{task.priority}</Text>
          </View>

          {task.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.muted }]}>Tags</Text>
              <Text style={[styles.value, { color: theme.text }]}>{task.tags.map((t) => `#${t}`).join(' ')}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.muted }]}>Status</Text>
            <Text style={[styles.value, { color: theme.text, textTransform: 'capitalize' }]}>{task.status}</Text>
          </View>
        </ScrollView>

        <View style={[styles.actions, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <ActionBtn label="Edit" icon="create-outline" color={COLORS.blue} onPress={() => onEdit(task)} />
          {task.status !== 'completed' && task.status !== 'skipped' && (
            <>
              <ActionBtn label="Complete" icon="checkmark-circle" color={COLORS.green} onPress={() => { onComplete(task.id); onClose(); }} />
              <ActionBtn label="Skip" icon="close-circle" color={theme.muted} onPress={() => { onSkip(task.id); onClose(); }} />
              <ActionBtn label="Extend" icon="alarm-outline" color={COLORS.orange} onPress={() => onExtend(task.id)} />
              {task.focusMode && (
                <ActionBtn label="Focus" icon="shield-checkmark" color={COLORS.primary} onPress={() => { onStartFocus(task.id); onClose(); }} />
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ActionBtn({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  title: { flex: 1, fontSize: FONT.xl, fontWeight: '700', color: COLORS.text },
  body: { flex: 1, padding: SPACING.lg },
  section: { marginBottom: SPACING.lg },
  label: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  desc: { fontSize: FONT.md, color: COLORS.text, lineHeight: 22 },
  value: { fontSize: FONT.md, fontWeight: '600', color: COLORS.text },
  subvalue: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  closeBtn: { padding: SPACING.sm },
  actionBtn: { alignItems: 'center', gap: SPACING.xs },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: FONT.xs, fontWeight: '600' },
});
