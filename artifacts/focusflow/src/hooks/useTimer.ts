import { useState, useEffect, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import { useRegisteredTimer, TIMER_IDS } from '@/services/TimerCoordinator';

export interface TimerState {
  elapsed: number;  // seconds elapsed since start
  remaining: number; // seconds remaining until end
  progress: number;  // 0..1
  isOverdue: boolean;
}

export function useTaskTimer(startTime: string, endTime: string): TimerState {
  const calcState = useCallback((): TimerState => {
    const now = dayjs();
    const start = dayjs(startTime);
    const end = dayjs(endTime);

    if (!start.isValid() || !end.isValid()) {
      return { elapsed: 0, remaining: 0, progress: 0, isOverdue: false };
    }

    const total = end.diff(start, 'second');
    const elapsed = now.diff(start, 'second');
    const remaining = end.diff(now, 'second');

    return {
      elapsed: Math.max(0, elapsed),
      remaining: Math.max(0, remaining),
      progress: total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0,
      isOverdue: remaining < 0,
    };
  }, [startTime, endTime]);

  const [timerState, setTimerState] = useState<TimerState>(calcState);

  const tick = useCallback(() => {
    setTimerState(calcState());
  }, [calcState]);

  // Use TimerCoordinator for coordinated 1-second tick
  // Use a unique timer ID based on the task's time range
  const timerId = `task-timer-${startTime}-${endTime}`;
  useRegisteredTimer(timerId, 'TICK_1S', tick, {
    enabled: true,
    runImmediately: true,
  });

  return timerState;
}

export function useCountdown(targetTime: string): number {
  const calc = useCallback(() => Math.max(0, dayjs(targetTime).diff(dayjs(), 'second')), [targetTime]);
  const [seconds, setSeconds] = useState(calc);

  const tick = useCallback(() => {
    setSeconds(calc());
  }, [calc]);

  // Use TimerCoordinator for coordinated 1-second tick
  useRegisteredTimer(`countdown-${targetTime}`, 'TICK_1S', tick, {
    enabled: true,
    runImmediately: true,
  });

  return seconds;
}