import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import dayjs from 'dayjs';
import type { Task } from '@/data/types';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

const HOUR_HEIGHT = 64;
const TIMELINE_START_HOUR = 6; // 6 AM
const TIMELINE_END_HOUR = 23; // 11 PM
const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => i + TIMELINE_START_HOUR,
);

interface Props {
  tasks: Task[];
  onTaskPress?: (task: Task) => void;
}

export default function TimelineView({ tasks, onTaskPress }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const getTaskPosition = (task: Task) => {
    const start = dayjs(task.startTime);
    const end = dayjs(task.endTime);
    const startHour = start.hour() + start.minute() / 60;
    const endHour = end.hour() + end.minute() / 60;

    const clampedStart = Math.max(startHour, TIMELINE_START_HOUR);
    const clampedEnd = Math.min(endHour, TIMELINE_END_HOUR + 1);

    const top = (clampedStart - TIMELINE_START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT, 28);
    return { top, height };
  };

  const nowOffset = () => {
    const now = dayjs();
    const h = now.hour() + now.minute() / 60;
    return (h - TIMELINE_START_HOUR) * HOUR_HEIGHT;
  };

  const containerWidth = Dimensions.get('window').width - 64 - SPACING.lg * 2;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.container}>
        {/* Hour labels column */}
        <View style={styles.labelCol}>
          {HOURS.map((h) => (
            <View key={h} style={styles.hourLabel}>
              <Text style={styles.hourText}>
                {dayjs().hour(h).minute(0).format('h A')}
              </Text>
            </View>
          ))}
        </View>

        {/* Timeline body */}
        <View style={[styles.body, { width: containerWidth }]}>
          {/* Hour grid lines */}
          {HOURS.map((h) => (
            <View key={h} style={styles.gridLine} />
          ))}

          {/* Now indicator */}
          <View style={[styles.nowLine, { top: nowOffset() }]}>
            <View style={styles.nowDot} />
            <View style={styles.nowBar} />
          </View>

          {/* Task blocks */}
          {tasks.map((task) => {
            const { top, height } = getTaskPosition(task);
            const isActive =
              task.status !== 'completed' &&
              task.status !== 'skipped' &&
              dayjs(task.startTime).isBefore(dayjs()) &&
              dayjs(task.endTime).isAfter(dayjs());
            const isDone = task.status === 'completed' || task.status === 'skipped';

            return (
              <View
                key={task.id}
                style={[
                  styles.taskBlock,
                  {
                    top,
                    height,
                    backgroundColor: task.color + (isDone ? '44' : 'cc'),
                    borderColor: task.color,
                  },
                  isActive && styles.taskBlockActive,
                ]}
                // @ts-ignore - TouchableOpacity in ScrollView
                onTouchEnd={() => onTaskPress?.(task)}
              >
                <Text
                  style={[styles.taskBlockTitle, isDone && { textDecorationLine: 'line-through', opacity: 0.7 }]}
                  numberOfLines={height > 40 ? 2 : 1}
                >
                  {task.title}
                </Text>
                {height > 44 && (
                  <Text style={styles.taskBlockTime}>
                    {dayjs(task.startTime).format('h:mm')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  labelCol: {
    width: 48,
    marginRight: SPACING.sm,
  },
  hourLabel: {
    height: HOUR_HEIGHT,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  hourText: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    textAlign: 'right',
  },
  body: {
    position: 'relative',
    flex: 1,
  },
  gridLine: {
    height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.red,
    marginLeft: -4,
  },
  nowBar: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.red,
    opacity: 0.7,
  },
  taskBlock: {
    position: 'absolute',
    left: 0,
    right: 4,
    borderRadius: RADIUS.sm,
    borderLeftWidth: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  taskBlockActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  taskBlockTitle: {
    fontSize: FONT.xs,
    fontWeight: '600',
    color: '#fff',
  },
  taskBlockTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
});
