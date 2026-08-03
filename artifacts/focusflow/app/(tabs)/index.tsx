import React, { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withScreenErrorBoundary } from '@/components/withScreenErrorBoundary';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import TaskCard from '@/components/TaskCard';

import QuickAddModal from '@/components/QuickAddModal';
import ExtendModal from '@/components/ExtendModal';
import EditTaskModal from '@/components/EditTaskModal';
import TaskDetailModal from '@/components/TaskDetailModal';
import { COLORS, FONT, RADIUS, SPACING, SHADOW } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Task } from '@/data/types';
import { formatTime, isAwaitingDecision } from '@/services/taskService';

function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { state, todayTasks, activeTask, currentTask, addTask, updateTask, deleteTask, completeTask, skipTask, extendTaskTime, startFocusMode, refreshTasks } = useApp();
  const bannerTask = activeTask ?? currentTask;
  const bannerAwaitingDecision = bannerTask ? isAwaitingDecision(bannerTask) : false;
  const [showAddModal, setShowAddModal] = useState(false);
  const [extendTaskId, setExtendTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTasks();
    setRefreshing(false);
  }, [refreshTasks]);

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      await completeTask(taskId);
    },
    [completeTask],
  );

  const handleSkipTask = useCallback(
    async (taskId: string) => {
      Alert.alert('Skip Task', 'Skip this task?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            await skipTask(taskId);
          },
        },
      ]);
    },
    [skipTask],
  );

  const completedCount = todayTasks.filter((t) => t.status === 'completed').length;
  const totalCount = todayTasks.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.dateText, { color: theme.text }]}>{dayjs().format('dddd, MMMM D')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {totalCount === 0 ? 'No tasks today' : `${completedCount}/${totalCount} tasks done`}
          </Text>
        </View>
      </View>

      {/* Active / Time's-up Banner — surfaces ended-but-undecided tasks too. */}
      {bannerTask && (
        <TouchableOpacity
          style={[
            styles.activeBanner,
            bannerAwaitingDecision && { backgroundColor: COLORS.orange },
          ]}
          onPress={() => setSelectedTask(bannerTask)}
          activeOpacity={0.9}
        >
          <View style={styles.activePulse} />
          <View style={styles.activeBannerContent}>
            <Text style={styles.activeBannerLabel}>{bannerAwaitingDecision ? "TIME'S UP" : 'NOW'}</Text>
            <Text style={styles.activeBannerTitle} numberOfLines={1}>
              {bannerTask.title}
            </Text>
            <Text style={styles.activeBannerTime}>
              {bannerAwaitingDecision
                ? `ended ${formatTime(bannerTask.endTime)} · pick one`
                : `until ${formatTime(bannerTask.endTime)}`}
            </Text>
          </View>
          <View style={styles.activeBannerActions}>
            <TouchableOpacity
              style={styles.bannerAction}
              onPress={() => handleCompleteTask(bannerTask.id)}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bannerAction, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={() => setExtendTaskId(bannerTask.id)}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
            {bannerAwaitingDecision ? (
              <TouchableOpacity
                style={[styles.bannerAction, { backgroundColor: 'rgba(0,0,0,0.2)' }]}
                onPress={() => handleSkipTask(bannerTask.id)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            ) : bannerTask.focusMode ? (
              <TouchableOpacity
                style={[styles.bannerAction, { backgroundColor: 'rgba(245,158,11,0.4)' }]}
                onPress={() => startFocusMode(bannerTask.id)}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      )}

      {/* Task list */}
      <FlatList
        data={todayTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            isActive={item.id === activeTask?.id}
            onPress={(t) => setSelectedTask(t)}
            onComplete={handleCompleteTask}
            onSkip={handleSkipTask}
            onExtend={(id) => setExtendTaskId(id)}
            onStartFocus={startFocusMode}
          />
        )}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: 60 + insets.bottom + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          state.isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.muted }]}>No tasks scheduled for today</Text>
              <Text style={[styles.emptySubtext, { color: theme.border }]}>Tap + to add your first task</Text>
            </View>
          )
        }
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
      />

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: 60 + insets.bottom + 12 }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modals */}
      <QuickAddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={addTask}
      />

      {extendTaskId && (
        <ExtendModal
          visible
          taskId={extendTaskId}
          onClose={() => setExtendTaskId(null)}
          onExtend={async (id, mins) => {
            await extendTaskTime(id, mins);
            setExtendTaskId(null);
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
          onSkip={handleSkipTask}
          onExtend={(id) => { setSelectedTask(null); setExtendTaskId(id); }}
          onStartFocus={startFocusMode}
          onEdit={(task) => { setSelectedTask(null); setEditTask(task); }}
        />
      )}

      {editTask && (
        <EditTaskModal
          visible
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={updateTask}
          onDelete={async (id) => { await deleteTask(id); setEditTask(null); }}
        />
      )}
    </SafeAreaView>
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
  dateText: { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.lg,
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: SPACING.sm,
    opacity: 0.8,
  },
  activeBannerContent: { flex: 1 },
  activeBannerLabel: { fontSize: FONT.xs, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  activeBannerTitle: { fontSize: FONT.md, fontWeight: '700', color: '#fff' },
  activeBannerTime: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)' },
  activeBannerActions: { flexDirection: 'row', gap: SPACING.xs },
  bannerAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1, marginTop: SPACING.md },
  listContent: { paddingHorizontal: SPACING.lg },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyText: { fontSize: FONT.lg, fontWeight: '600', color: COLORS.muted },
  emptySubtext: { fontSize: FONT.sm, color: COLORS.border },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.lg,
  },
});

export default withScreenErrorBoundary(ScheduleScreen, 'Schedule');

