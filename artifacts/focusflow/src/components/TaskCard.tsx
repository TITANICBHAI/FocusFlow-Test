import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@/data/types';
import { formatTime, formatDuration, getTimeUntilStart } from '@/services/taskService';
import { useTaskTimer } from '@/hooks/useTimer';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

interface Props {
  task: Task;
  isActive?: boolean;
  onPress?: (task: Task) => void;
  onComplete?: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  onExtend?: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
}

export default function TaskCard({
  task,
  isActive = false,
  onPress,
  onComplete,
  onSkip,
  onExtend,
  onStartFocus,
}: Props) {
  const timer = useTaskTimer(task.startTime, task.endTime);

  const handleExtend = useCallback(() => {
    onExtend?.(task.id);
  }, [task.id, onExtend]);

  const priorityColor = {
    low: COLORS.green,
    medium: COLORS.blue,
    high: COLORS.orange,
    critical: COLORS.red,
  }[task.priority];

  const statusOpacity = task.status === 'completed' || task.status === 'skipped' ? 0.5 : 1;

  return (
    <TouchableOpacity
      onPress={() => onPress?.(task)}
      activeOpacity={0.8}
      style={[
        styles.card,
        isActive && styles.cardActive,
        { opacity: statusOpacity },
      ]}
    >
      {/* Left color bar */}
      <View style={[styles.colorBar, { backgroundColor: task.color }]} />

      {/* Main content */}
      <View style={styles.body}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            {task.focusMode && (
              <Ionicons name="shield-checkmark" size={14} color={COLORS.orange} style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.title,
                task.status === 'completed' && styles.titleDone,
              ]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '22' }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {task.priority}
            </Text>
          </View>
        </View>

        {/* Time */}
        <Text style={styles.timeText}>
          {formatTime(task.startTime)} – {formatTime(task.endTime)} · {formatDuration(task.durationMinutes)}
        </Text>

        {/* Tags */}
        {task.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {task.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Active task: progress bar + timer */}
        {isActive && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${timer.progress * 100}%`, backgroundColor: task.color },
                ]}
              />
            </View>
            <Text style={styles.timerText}>
              {timer.isOverdue
                ? `Overdue by ${Math.floor(-timer.remaining / 60)}m`
                : `${Math.floor(timer.remaining / 60)}m remaining`}
            </Text>
          </View>
        )}

        {/* Scheduled: time until start */}
        {task.status === 'scheduled' && !isActive && (
          <Text style={styles.untilText}>{getTimeUntilStart(task.startTime)}</Text>
        )}

        {/* Completed / skipped label */}
        {(task.status === 'completed' || task.status === 'skipped') && (
          <View style={styles.doneRow}>
            <Ionicons
              name={task.status === 'completed' ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={task.status === 'completed' ? COLORS.green : COLORS.muted}
            />
            <Text style={styles.doneText}>
              {task.status === 'completed' ? 'Completed' : 'Skipped'}
            </Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      {isActive && (
        <View style={styles.actions}>
          <ActionButton icon="checkmark" color={COLORS.green} onPress={() => onComplete?.(task.id)} />
          <ActionButton icon="alarm-outline" color={COLORS.orange} onPress={handleExtend} />
          {task.focusMode && (
            <ActionButton
              icon="shield-checkmark-outline"
              color={COLORS.purple}
              onPress={() => onStartFocus?.(task.id)}
            />
          )}
        </View>
      )}

      {task.status === 'scheduled' && !isActive && (
        <View style={styles.actions}>
          <ActionButton icon="play-skip-forward-outline" color={COLORS.muted} onPress={() => onSkip?.(task.id)} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function ActionButton({
  icon,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionBtn, { borderColor: color + '44' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  colorBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: FONT.md,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: COLORS.muted,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  priorityText: {
    fontSize: FONT.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: FONT.sm,
    color: COLORS.muted,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  progressContainer: {
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timerText: {
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  untilText: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneText: {
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  actions: {
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
    gap: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
