import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';

export interface TimerState {
  elapsed: number;  // seconds elapsed since start
  remaining: number; // seconds remaining until end
  progress: number;  // 0..1
  isOverdue: boolean;
}

export function useTaskTimer(startTime: string, endTime: string): TimerState {
  const calcState = (): TimerState => {
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
  };

  const [timerState, setTimerState] = useState<TimerState>(calcState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTimerState(calcState());
    intervalRef.current = setInterval(() => {
      setTimerState(calcState());
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime, endTime]);

  return timerState;
}

export function useCountdown(targetTime: string): number {
  const calc = () => Math.max(0, dayjs(targetTime).diff(dayjs(), 'second'));
  const [seconds, setSeconds] = useState(calc);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSeconds(calc());
    ref.current = setInterval(() => setSeconds(calc()), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [targetTime]);

  return seconds;
}
