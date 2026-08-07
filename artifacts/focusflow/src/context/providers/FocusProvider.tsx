import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { RNAppState, type AppStateStatus } from 'react-native';
import type { FocusSession } from '@/data/types';
import {
  dbGetActiveFocusSession,
  dbGetTodayFocusMinutes,
  dbGetStreak,
  dbBackfillDayCompletions,
  dbRecordDayCompletion,
  dbCheckpointWal,
  probeDbHealth,
  resetDb,
  logDbDiagnostics,
} from '@/data/db';
import {
  startFocusMode as _startFocusMode,
  stopFocusMode as _stopFocusMode,
  isFocusActive,
} from '@/services/focusService';
import { EventBridge } from '@/services/eventBridge';
import { ForegroundServiceModule } from '@/native-modules/ForegroundServiceModule';
import { TaskAlarmModule } from '@/native-modules/TaskAlarmModule';
import { SharedPrefsModule, SP_KEYS } from '@/native-modules/SharedPrefsModule';
import { logger, logBootMarker } from '@/services/startupLogger';
import { initI18n } from '@/i18n';
import { getTimerCoordinator, TIMER_IDS } from '@/services/TimerCoordinator';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FocusState {
  focusSession: FocusSession | null;
  focusViolationApp: string | null;
  isLoading: boolean;
  isDbReady: boolean;
}

type FocusAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_DB_READY' }
  | { type: 'SET_FOCUS_SESSION'; payload: FocusSession | null }
  | { type: 'SET_FOCUS_VIOLATION'; payload: string | null };

function focusReducer(state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_DB_READY':
      return { ...state, isDbReady: true };
    case 'SET_FOCUS_SESSION':
      return { ...state, focusSession: action.payload };
    case 'SET_FOCUS_VIOLATION':
      return { ...state, focusViolationApp: action.payload };
    default:
      return state;
  }
}

interface FocusContextValue {
  focusSession: FocusSession | null;
  focusViolationApp: string | null;
  isLoading: boolean;
  isDbReady: boolean;

  startFocusMode: (taskId: string) => Promise<void>;
  stopFocusMode: (pinHash?: string | null) => Promise<void>;
  refreshTasks: () => Promise<void>; // needed for focus-related task refreshes
}

const FocusContext = createContext<FocusContextValue | null>(null);

const initialFocusState: FocusState = {
  focusSession: null,
  focusViolationApp: null,
  isLoading: true,
  isDbReady: false,
};

// ─── Provider ────────────────────────────────────────────────────────────────
export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(focusReducer, initialFocusState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tryAutoStartFocusRef = useRef<(() => void) | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const appStatePrev = useRef(RNAppState.currentState);
  const timerCoordinator = getTimerCoordinator();
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Prune old data once per session after DB is ready ────────────────────
  useEffect(() => {
    if (!state.isDbReady) return;
    void dbPruneOldData(90).catch(() => {});
  }, [state.isDbReady]);

  // ── 12-second splash watchdog ─────────────────────────────────────────────
  useEffect(() => {
    timerCoordinator.register({
      id: TIMER_IDS.SPLASH_WATCHDOG,
      type: 'ONESHOT',
      callback: () => {
        if (!state.isDbReady) {
          void logger.error('FocusProvider', '[WATCHDOG_TRIGGERED] isDbReady still false after 12 s — forcing ready');
          dispatch({ type: 'SET_DB_READY' });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      },
      delayMs: 12000,
    });
    return () => timerCoordinator.unregister(TIMER_IDS.SPLASH_WATCHDOG);
  }, []);

  // Clear watchdog when DB is ready
  useEffect(() => {
    if (state.isDbReady) {
      timerCoordinator.unregister(TIMER_IDS.SPLASH_WATCHDOG);
    }
  }, [state.isDbReady]);

  // ── Initialize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await logBootMarker();
      } catch {}
      void logger.info('FocusProvider', '[STARTUP_BEGIN] init() called');
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Notification channels
        const { setupNotificationChannels, requestPermissions } = await import('@/services/notificationService');
        try {
          void logger.info('FocusProvider', 'Setting up notification channels');
          await setupNotificationChannels();
          void logger.info('FocusProvider', 'Notification channels ready');
        } catch (e) {
          void logger.warn('FocusProvider', `Notification channel setup failed: ${String(e)}`);
        }
        try {
          void logger.info('FocusProvider', 'Requesting notification permissions');
          const granted = await requestPermissions();
          void logger.info('FocusProvider', `Notification permission: ${granted ? 'granted' : 'denied'}`);
        } catch (e) {
          void logger.warn('FocusProvider', `Notification permission request failed: ${String(e)}`);
        }

        // Exact alarm permission
        try {
          const exactOk = await TaskAlarmModule.canScheduleExactAlarms();
          void logger.info('FocusProvider', `Exact alarm permission: ${exactOk ? 'granted' : 'denied'}`);
        } catch (e) {
          void logger.warn('FocusProvider', `Exact alarm probe failed: ${String(e)}`);
        }

        // Foreground service (idle mode)
        try {
          void logger.info('FocusProvider', 'Starting idle foreground service');
          await ForegroundServiceModule.startIdleService();
          void logger.info('FocusProvider', 'Idle foreground service started');
        } catch (e) {
          void logger.warn('FocusProvider', `Idle foreground service failed: ${String(e)}`);
        }

        // Active focus session restore
        try {
          void logger.info('FocusProvider', 'Checking for active focus session');
          const activeSession = await dbGetActiveFocusSession();
          if (activeSession) {
            void logger.info('FocusProvider', `Restored active focus session for task ${activeSession.taskId}`);
            dispatch({ type: 'SET_FOCUS_SESSION', payload: activeSession });
          }
        } catch (e) {
          void logger.warn('FocusProvider', `Focus session restore failed: ${String(e)}`);
        }

        void logger.info('FocusProvider', '[STARTUP_COMPLETE] init() finished successfully');
      } catch (e) {
        void logger.error('FocusProvider', `[STARTUP_ERROR] Unhandled init error: ${String(e)}`);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
        void logger.info('FocusProvider', 'SET_LOADING: false dispatched');
      }
    };
    init();
  }, []);

  // ── WAL checkpoint on app background ────────────────────────────────────────
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void dbCheckpointWal();
        void logger.info('FocusProvider', 'WAL checkpoint triggered on app background');
      }
    };
    const sub = RNAppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  // ── Foreground resume: reload tasks on app-active ────────────────────────────
  useEffect(() => {
    const handleResume = async (nextState: AppStateStatus) => {
      const isResuming =
        (appStatePrev.current === 'background' || appStatePrev.current === 'inactive') &&
        nextState === 'active';
      appStatePrev.current = nextState;

      if (!isResuming) return;

      const alive = await probeDbHealth();
      if (alive) {
        void logger.debug('FocusProvider', '[FOREGROUND_RESUME] DB handle healthy — refreshing without reset');
      } else {
        void logger.info('FocusProvider', '[FOREGROUND_RESUME] DB handle dead — resetting before reset');
        resetDb();
      }
    };
    const sub = RNAppState.addEventListener('change', handleResume);
    return () => sub.remove();
  }, []);

  // ── Native event subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    const unsubFocusStarted = EventBridge.on('FOCUS_STARTED', (data: { taskId: string; startedAt: string; allowedPackages: string[] }) => {
      dispatch({ type: 'SET_FOCUS_SESSION', payload: data });
    });
    const unsubFocusEnded = EventBridge.on('FOCUS_ENDED', () => {
      dispatch({ type: 'SET_FOCUS_SESSION', payload: null });
    });
    const unsubViolation = EventBridge.on('FOCUS_VIOLATION', (appName: string) => {
      dispatch({ type: 'SET_FOCUS_VIOLATION', payload: appName });
    });
    return () => {
      unsubFocusStarted();
      unsubFocusEnded();
      unsubViolation();
    };
  }, []);

  // ── Tick: check active tasks + standalone block expiry every 30s ─────────────
  useEffect(() => {
    if (!state.isDbReady) return;

    timerCoordinator.register({
      id: TIMER_IDS.APP_TICK_30S,
      type: 'TICK_30S',
      callback: () => {
        const s = stateRef.current;
        tryAutoStartFocusRef.current?.();
        // The task list would come from TaskProvider via context
        // This is a placeholder - actual implementation needs task context
      },
      runImmediately: true,
    });

    return () => {
      timerCoordinator.unregister(TIMER_IDS.APP_TICK_30S);
    };
  }, [state.isDbReady]);

  // ── Focus mode controls ─────────────────────────────────────────────────────
  const startFocusMode = useCallback(async (taskId: string) => {
    await _startFocusMode(taskId);
  }, []);

  const stopFocusMode = useCallback(async (pinHash?: string | null) => {
    await _stopFocusMode(pinHash);
    dispatch({ type: 'SET_FOCUS_SESSION', payload: null });
    dispatch({ type: 'SET_FOCUS_VIOLATION', payload: null });
  }, []);

  // ── Streak backfill ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.isDbReady) return;
    void (async () => {
      try {
        await dbBackfillDayCompletions(30);
        const streak = await dbGetStreak();
        // Could dispatch streak milestone celebration here
      } catch (e) {
        void logger.warn('FocusProvider', `streak milestone check failed: ${String(e)}`);
      }
    })();
  }, [state.isDbReady]);

  const value: FocusContextValue = useMemo(
    () => ({
      focusSession: state.focusSession,
      focusViolationApp: state.focusViolationApp,
      isLoading: state.isLoading,
      isDbReady: state.isDbReady,
      startFocusMode,
      stopFocusMode,
      refreshTasks: async () => {
        // This will be overridden by TaskProvider's refreshTasks
        // or we can use EventBridge to trigger a refresh
        EventBridge.emit('REFRESH_TASKS', {});
      },
    }),
    [
      state.focusSession,
      state.focusViolationApp,
      state.isLoading,
      state.isDbReady,
      startFocusMode,
      stopFocusMode,
    ],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocusContext(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error('useFocusContext must be used within a FocusProvider');
  }
  return ctx;
}