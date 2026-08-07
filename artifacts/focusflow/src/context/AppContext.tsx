import React, { createContext, useContext, useMemo } from 'react';
import { TaskProvider, useTaskContext } from './providers/TaskProvider';
import { SettingsProvider, useSettingsContext } from './providers/SettingsProvider';
import { FocusProvider, useFocusContext } from './providers/FocusProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ─── Composed Context (thin wrapper for backward compatibility) ────────────────

interface AppContextValue {
  // Task state & actions
  tasks: Task[];
  todayTasks: Task[];
  activeTask: Task | null;
  currentTask: Task | null;
  activeTasks: Task[];
  isTasksLoading: boolean;

  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  skipTask: (taskId: string) => Promise<void>;
  extendTaskTime: (taskId: string, extraMinutes: number) => Promise<void>;
  refreshTasks: () => Promise<void>;

  // Settings state & actions
  settings: AppSettings;
  isSettingsLoading: boolean;

  updateSettings: (settings: AppSettings, dirtyGroups?: string[]) => Promise<void>;
  setStandaloneBlock: (packages: string[], untilMs: number | null, pinHash?: string | null) => Promise<void>;
  setStandaloneBlockAndAllowance: (packages: string[], untilMs: number | null, allowanceEntries: DailyAllowanceEntry[], vpnPackages?: string[], pinHash?: string | null) => Promise<void>;
  setDailyAllowanceEntries: (entries: DailyAllowanceEntry[]) => Promise<void>;
  setBlockedWords: (words: string[]) => Promise<void>;
  setRecurringBlockSchedules: (schedules: RecurringBlockSchedule[]) => Promise<void>;

  // Focus state & actions
  focusSession: FocusSession | null;
  focusViolationApp: string | null;
  isFocusLoading: boolean;
  isDbReady: boolean;

  startFocusMode: (taskId: string) => Promise<void>;
  stopFocusMode: (pinHash?: string | null) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// Re-export types for consumers
export type { AppContextValue, AppSettings, Task, FocusSession, DailyAllowanceEntry, RecurringBlockSchedule, GreyoutWindow } from './providers/TaskProvider';
export type { AppSettings, DailyAllowanceEntry, RecurringBlockSchedule, GreyoutWindow } from '@/data/types';

// ─── Provider Composition ────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <FocusProvider>
      <SettingsProvider>
        <TaskProvider>
          <ErrorBoundary>
            <AppContextInner>{children}</AppContextInner>
          </ErrorBoundary>
        </TaskProvider>
      </SettingsProvider>
    </FocusProvider>
  );
}

function AppContextInner({ children }: { children: React.ReactNode }) {
  const taskCtx = useTaskContext();
  const settingsCtx = useSettingsContext();
  const focusCtx = useFocusContext();

  const value = useMemo<AppContextValue>(() => ({
    // Tasks
    tasks: taskCtx.tasks,
    todayTasks: taskCtx.todayTasks,
    activeTask: taskCtx.activeTask,
    currentTask: taskCtx.currentTask,
    activeTasks: taskCtx.activeTasks,
    isTasksLoading: taskCtx.isLoading,
    addTask: taskCtx.addTask,
    updateTask: taskCtx.updateTask,
    deleteTask: taskCtx.deleteTask,
    completeTask: taskCtx.completeTask,
    skipTask: taskCtx.skipTask,
    extendTaskTime: taskCtx.extendTaskTime,
    refreshTasks: taskCtx.refreshTasks,

    // Settings
    settings: settingsCtx.settings,
    isSettingsLoading: settingsCtx.isLoading,
    updateSettings: settingsCtx.updateSettings,
    setStandaloneBlock: settingsCtx.setStandaloneBlock,
    setStandaloneBlockAndAllowance: settingsCtx.setStandaloneBlockAndAllowance,
    setDailyAllowanceEntries: settingsCtx.setDailyAllowanceEntries,
    setBlockedWords: settingsCtx.setBlockedWords,
    setRecurringBlockSchedules: settingsCtx.setRecurringBlockSchedules,

    // Focus
    focusSession: focusCtx.focusSession,
    focusViolationApp: focusCtx.focusViolationApp,
    isFocusLoading: focusCtx.isLoading,
    isDbReady: focusCtx.isDbReady,
    startFocusMode: focusCtx.startFocusMode,
    stopFocusMode: focusCtx.stopFocusMode,
  }), [
    taskCtx.tasks,
    taskCtx.todayTasks,
    taskCtx.activeTask,
    taskCtx.currentTask,
    taskCtx.activeTasks,
    taskCtx.isLoading,
    taskCtx.addTask,
    taskCtx.updateTask,
    taskCtx.deleteTask,
    taskCtx.completeTask,
    taskCtx.skipTask,
    taskCtx.extendTaskTime,
    taskCtx.refreshTasks,
    settingsCtx.settings,
    settingsCtx.isLoading,
    settingsCtx.updateSettings,
    settingsCtx.setStandaloneBlock,
    settingsCtx.setStandaloneBlockAndAllowance,
    settingsCtx.setDailyAllowanceEntries,
    settingsCtx.setBlockedWords,
    settingsCtx.setRecurringBlockSchedules,
    focusCtx.focusSession,
    focusCtx.focusViolationApp,
    focusCtx.isLoading,
    focusCtx.isDbReady,
    focusCtx.startFocusMode,
    focusCtx.stopFocusMode,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}