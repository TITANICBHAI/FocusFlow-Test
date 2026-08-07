import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import type { Task } from '@/data/types';
import {
  dbGetTasksForDate,
  dbGetRecentUnresolvedTasks,
  dbInsertTask,
  dbUpdateTask,
  dbUpdateTasksBatch,
  dbDeleteTask,
} from '@/data/db';
import {
  getTodayTasks,
  getActiveTask,
  getCurrentTask,
  getAllActiveTasks,
  getUpcomingTask,
  isAwaitingDecision,
  extendTask,
  updateTaskStatus,
} from '@/services/taskService';
import {
  rebalanceAfterOverrun,
  getUnfinishedOverdueTasks,
} from '@/services/schedulerEngine';
import { logger } from '@/services/startupLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
}

type TaskAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string };

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_TASKS':
      return { ...state, tasks: action.payload, isLoading: false };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? action.payload : t)),
      };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.payload) };
    default:
      return state;
  }
}

interface TaskContextValue {
  tasks: Task[];
  todayTasks: Task[];
  activeTask: Task | null;
  currentTask: Task | null;
  activeTasks: Task[];
  isLoading: boolean;

  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  skipTask: (taskId: string) => Promise<void>;
  extendTaskTime: (taskId: string, extraMinutes: number) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextValue | null>(null);

const initialTaskState: TaskState = {
  tasks: [],
  isLoading: true,
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);
  const alertedUnresolvedRef = useRef<Set<string>>(new Set());

  // Derived state (memoized)
  const todayTasks = useMemo(() => getTodayTasks(state.tasks), [state.tasks]);
  const activeTask = useMemo(() => getActiveTask(state.tasks), [state.tasks]);
  const currentTask = useMemo(() => getCurrentTask(state.tasks), [state.tasks]);
  const activeTasks = useMemo(() => getAllActiveTasks(state.tasks), [state.tasks]);

  // ── Refresh tasks ──────────────────────────────────────────────────────────
  const refreshTasks = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const tasks = await dbGetTasksForDate(new Date().toISOString());
      dispatch({ type: 'SET_TASKS', payload: tasks });
    } catch (e) {
      void logger.warn('TaskProvider', `refreshTasks failed: ${String(e)}`);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // ── Overdue recovery (run once after initial load) ─────────────────────────
  useEffect(() => {
    if (state.isLoading) return;
    const runOverdueRecovery = async () => {
      try {
        const allTasks = await dbGetTasksForDate(new Date().toISOString());
        const overdue = getUnfinishedOverdueTasks(allTasks);
        for (const t of overdue) {
          const marked = updateTaskStatus(t, 'overdue');
          await dbUpdateTask(marked);
        }
        if (overdue.length > 0) {
          void logger.info('TaskProvider', `Marked ${overdue.length} tasks as overdue`);
          await refreshTasks();
        }
      } catch (e) {
        void logger.warn('TaskProvider', `Overdue task recovery failed: ${String(e)}`);
      }
    };
    runOverdueRecovery();
  }, [state.isLoading, refreshTasks]);

  // ── CRUD operations ────────────────────────────────────────────────────────

  const addTask = useCallback(async (task: Task) => {
    await dbInsertTask(task);
    dispatch({ type: 'ADD_TASK', payload: task });
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    await dbUpdateTask(task);
    dispatch({ type: 'UPDATE_TASK', payload: task });
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    await dbDeleteTask(taskId);
    dispatch({ type: 'DELETE_TASK', payload: taskId });
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const completed = updateTaskStatus(task, 'completed');
    await dbUpdateTask(completed);
    dispatch({ type: 'UPDATE_TASK', payload: completed });
  }, [state.tasks]);

  const skipTask = useCallback(async (taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const skipped = updateTaskStatus(task, 'skipped');
    await dbUpdateTask(skipped);
    dispatch({ type: 'UPDATE_TASK', payload: skipped });
  }, [state.tasks]);

  const extendTaskTime = useCallback(async (taskId: string, extraMinutes: number) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const extended = extendTask(task, extraMinutes);
    await dbUpdateTask(extended);
    dispatch({ type: 'UPDATE_TASK', payload: extended });
  }, [state.tasks]);

  // ── Unresolved task alert tracking (could be moved to a hook) ─────────────
  // This is kept here because it relates to task state

  const value: TaskContextValue = useMemo(
    () => ({
      tasks: state.tasks,
      todayTasks,
      activeTask,
      currentTask,
      activeTasks,
      isLoading: state.isLoading,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      skipTask,
      extendTaskTime,
      refreshTasks,
    }),
    [
      state.tasks,
      todayTasks,
      activeTask,
      currentTask,
      activeTasks,
      state.isLoading,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      skipTask,
      extendTaskTime,
      refreshTasks,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTaskContext(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return ctx;
}