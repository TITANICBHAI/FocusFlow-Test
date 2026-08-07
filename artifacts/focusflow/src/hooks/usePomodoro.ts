import { useState, useEffect, useRef, useCallback } from 'react';
import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRegisteredTimer, TIMER_IDS } from '@/services/TimerCoordinator';

export interface PomodoroState {
  phase: 'work' | 'break';
  secondsLeft: number;
  cycleCount: number;
  phaseProgress: number; // 0..1 — how far through the current phase
}

function calcPomodoro(
  sessionStartedAt: string,
  workSecs: number,
  breakSecs: number,
): PomodoroState {
  const cycleSecs = workSecs + breakSecs;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(sessionStartedAt).getTime()) / 1000),
  );
  const pos = elapsed % cycleSecs;
  const cycleCount = Math.floor(elapsed / cycleSecs);

  if (pos < workSecs) {
    const secondsLeft = workSecs - pos;
    return { phase: 'work', secondsLeft, cycleCount, phaseProgress: pos / workSecs };
  }
  const breakPos = pos - workSecs;
  const secondsLeft = breakSecs - breakPos;
  return { phase: 'break', secondsLeft, cycleCount, phaseProgress: breakPos / breakSecs };
}

export function usePomodoro(
  enabled: boolean,
  sessionStartedAt: string | null,
  workMinutes: number,
  breakMinutes: number,
): PomodoroState {
  const workSecs = workMinutes * 60;
  const breakSecs = breakMinutes * 60;

  const idle: PomodoroState = { phase: 'work', secondsLeft: workSecs, cycleCount: 0, phaseProgress: 0 };

  const [pomState, setPomState] = useState<PomodoroState>(() =>
    enabled && sessionStartedAt ? calcPomodoro(sessionStartedAt, workSecs, breakSecs) : idle,
  );

  const prevPhaseRef = useRef<'work' | 'break' | null>(null);

  const tick = useCallback(() => {
    if (!enabled || !sessionStartedAt) {
      setPomState(idle);
      prevPhaseRef.current = null;
      return;
    }

    const next = calcPomodoro(sessionStartedAt, workSecs, breakSecs);
    setPomState(next);

    if (prevPhaseRef.current !== null && prevPhaseRef.current !== next.phase) {
      const toWork = next.phase === 'work';
      Vibration.vibrate(toWork ? [0, 200, 100, 200] : [0, 400]);
      void Notifications.scheduleNotificationAsync({
        content: {
          title: toWork ? '🎯 Back to Work' : '☕ Break Time',
          body: toWork
            ? `Focus up — ${workMinutes} min work session starting now.`
            : `Great work! Take a ${breakMinutes} min break.`,
        },
        trigger: null,
      }).catch(() => {});
    }
    prevPhaseRef.current = next.phase;
  }, [enabled, sessionStartedAt, workSecs, breakSecs, workMinutes, breakMinutes]);

  // Use TimerCoordinator for coordinated 1-second tick
  useRegisteredTimer(TIMER_IDS.POMODORO_TICK, 'TICK_1S', tick, {
    enabled: enabled && !!sessionStartedAt,
    runImmediately: true,
  });

  return pomState;
}