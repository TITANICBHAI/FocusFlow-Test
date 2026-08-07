import { useRef, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { logger } from '@/services/startupLogger';

/**
 * TimerCoordinator — Centralized timer management for FocusFlow.
 *
 * Consolidates all setInterval/setTimeout calls across the app into a single
 * coordinated system that:
 *   - Pauses all timers when app is backgrounded
 *   - Resumes timers on foreground
 *   - Prevents timer drift and race conditions on resume
 *   - Provides a single source of truth for timer lifecycle
 *
 * Timer types:
 *   - TICK_1S   : 1-second precision (pomodoro, task timers, countdowns)
 *   - TICK_30S  : 30-second coarse tick (standalone expiry, widget sync, auto-start)
 *   - ONESHOT   : One-time timeouts (watchdog, precise expiry)
 */
export type TimerType = 'TICK_1S' | 'TICK_30S' | 'ONESHOT';

export interface TimerRegistration {
  id: string;
  type: TimerType;
  callback: () => void;
  intervalMs?: number;    // for TICK_1S, TICK_30S
  delayMs?: number;       // for ONESHOT
  runImmediately?: boolean;
}

type ActiveTimer = {
  registration: TimerRegistration;
  timerId: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>;
  nextFire: number;
};

class TimerCoordinatorImpl {
  private timers = new Map<string, ActiveTimer>();
  private appState: AppStateStatus = 'active';
  private paused = false;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined' || typeof global !== 'undefined') {
      AppState.addEventListener('change', this.handleAppStateChange);
    }
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    const wasActive = this.appState === 'active';
    const isActive = nextState === 'active';
    this.appState = nextState;

    if (wasActive && !isActive) {
      // App backgrounded - pause all timers
      this.pauseAll();
    } else if (!wasActive && isActive) {
      // App foregrounded - resume all timers
      this.resumeAll();
    }
  };

  private pauseAll() {
    if (this.paused) return;
    this.paused = true;
    for (const [, timer] of this.timers) {
      if (timer.registration.type === 'ONESHOT') {
        clearTimeout(timer.timerId);
      } else {
        clearInterval(timer.timerId);
      }
    }
    logger.debug('TimerCoordinator', 'All timers paused');
  }

  private resumeAll() {
    if (!this.paused) return;
    this.paused = false;
    const now = Date.now();

    for (const [id, timer] of this.timers) {
      const { registration } = timer;

      if (registration.type === 'ONESHOT') {
        // Reschedule one-shot with remaining delay
        const remaining = Math.max(0, timer.nextFire - now);
        const newId = setTimeout(() => {
          registration.callback();
          this.unregister(id);
        }, remaining);
        timer.timerId = newId;
        timer.nextFire = now + remaining;
      } else {
        // For interval timers, fire immediately if we missed a tick,
        // then restart the interval
        const elapsed = now - timer.nextFire;
        if (elapsed >= registration.intervalMs!) {
          // We missed at least one tick - fire once to catch up
          registration.callback();
        }
        // Restart interval
        const newId = setInterval(registration.callback, registration.intervalMs);
        timer.timerId = newId;
        timer.nextFire = now + registration.intervalMs!;
      }
    }
    logger.debug('TimerCoordinator', 'All timers resumed');
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try { listener(); } catch {}
    }
  }

  /** Register a new timer. Returns the timer ID. */
  register(registration: TimerRegistration): string {
    const id = registration.id;
    const now = Date.now();
    let timerId: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>;
    let nextFire = now;

    if (registration.type === 'ONESHOT') {
      const delay = registration.delayMs ?? 0;
      timerId = setTimeout(() => {
        registration.callback();
        this.unregister(id);
      }, delay);
      nextFire = now + delay;
    } else {
      const interval = registration.intervalMs ?? (registration.type === 'TICK_1S' ? 1000 : 30000);
      if (registration.runImmediately) {
        registration.callback();
      }
      timerId = setInterval(registration.callback, interval);
      nextFire = now + interval;
    }

    this.timers.set(id, { registration, timerId, nextFire });
    logger.debug('TimerCoordinator', `Registered timer: ${id} (${registration.type})`);
    return id;
  }

  /** Unregister a timer by ID. */
  unregister(id: string): boolean {
    const timer = this.timers.get(id);
    if (!timer) return false;

    if (timer.registration.type === 'ONESHOT') {
      clearTimeout(timer.timerId);
    } else {
      clearInterval(timer.timerId);
    }
    this.timers.delete(id);
    logger.debug('TimerCoordinator', `Unregistered timer: ${id}`);
    return true;
  }

  /** Check if a timer is registered. */
  has(id: string): boolean {
    return this.timers.has(id);
  }

  /** Get all active timer IDs. */
  getActiveIds(): string[] {
    return Array.from(this.timers.keys());
  }

  /** Subscribe to timer state changes (pause/resume). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Cleanup all timers. */
  destroy() {
    for (const [id, timer] of this.timers) {
      if (timer.registration.type === 'ONESHOT') {
        clearTimeout(timer.timerId);
      } else {
        clearInterval(timer.timerId);
      }
    }
    this.timers.clear();
    AppState.removeEventListener('change', this.handleAppStateChange);
  }
}

// Singleton instance
let instance: TimerCoordinatorImpl | null = null;

export function getTimerCoordinator(): TimerCoordinatorImpl {
  if (!instance) {
    instance = new TimerCoordinatorImpl();
  }
  return instance;
}

/** React hook for easy timer registration in components. */
export function useTimerCoordinator() {
  const coordinatorRef = useRef(getTimerCoordinator());
  return coordinatorRef.current;
}

/** Hook to register a timer that auto-cleans up on unmount. */
export function useRegisteredTimer(
  id: string,
  type: TimerType,
  callback: () => void,
  options: {
    intervalMs?: number;
    delayMs?: number;
    runImmediately?: boolean;
    enabled?: boolean;
  } = {}
) {
  const coordinator = useTimerCoordinator();
  const { intervalMs, delayMs, runImmediately, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    coordinator.register({
      id,
      type,
      callback,
      intervalMs,
      delayMs,
      runImmediately,
    });
    return () => coordinator.unregister(id);
  }, [id, type, enabled, intervalMs, delayMs, runImmediately]);

  // Allow manual control
  const cancel = useCallback(() => coordinator.unregister(id), [coordinator, id]);
  return { cancel };
}

/** Predefined timer IDs for app-wide coordination. */
export const TIMER_IDS = {
  // 1-second ticks
  POMODORO_TICK: 'pomodoro-tick',
  TASK_TIMER_TICK: 'task-timer-tick',
  COUNTDOWN_TICK: 'countdown-tick',

  // 30-second ticks
  APP_TICK_30S: 'app-tick-30s',

  // One-shots
  SPLASH_WATCHDOG: 'splash-watchdog',
  STANDBY_EXPIRY: 'standalone-expiry',
  AUTO_START_FOCUS: 'auto-start-focus',
} as const;