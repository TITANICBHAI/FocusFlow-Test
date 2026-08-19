import { useState, useEffect, useRef, useCallback } from 'react';
import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { ForegroundServiceModule } from '@/native-modules/ForegroundServiceModule';

export interface PomodoroState {
  phase: 'work' | 'break';
  secondsLeft: number;
  cycleCount: number;
  phaseProgress: number; // 0..1 — how far through the current phase
  isBreakActive: boolean;
  takeBreak: () => Promise<void>;
}

type PomodoroSnapshot = Omit<PomodoroState, 'takeBreak'>;

function calcPomodoro(
  sessionStartedAt: string,
  workSecs: number,
  breakSecs: number,
): PomodoroSnapshot {
  const cycleSecs = workSecs + breakSecs;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(sessionStartedAt).getTime()) / 1000),
  );
  const pos = elapsed % cycleSecs;
  const cycleCount = Math.floor(elapsed / cycleSecs);

  if (pos < workSecs) {
    const secondsLeft = workSecs - pos;
    return { phase: 'work', secondsLeft, cycleCount, phaseProgress: pos / workSecs, isBreakActive: false };
  }
  const breakPos = pos - workSecs;
  const secondsLeft = breakSecs - breakPos;
  return { phase: 'break', secondsLeft, cycleCount, phaseProgress: breakPos / breakSecs, isBreakActive: false };
}

export function usePomodoro(
  enabled: boolean,
  sessionStartedAt: string | null,
  workMinutes: number,
  breakMinutes: number,
): PomodoroState {
  const workSecs = workMinutes * 60;
  const breakSecs = breakMinutes * 60;

  const idle: PomodoroSnapshot = {
    phase: 'work',
    secondsLeft: workSecs,
    cycleCount: 0,
    phaseProgress: 0,
    isBreakActive: false,
  };

  const [pomState, setPomState] = useState<PomodoroSnapshot>(() =>
    enabled && sessionStartedAt
      ? { ...calcPomodoro(sessionStartedAt, workSecs, breakSecs), isBreakActive: false }
      : idle,
  );

  const prevPhaseRef = useRef<'work' | 'break' | null>(null);
  const breakUntilRef = useRef(0);
  const breakActiveRef = useRef(false);

  const resumeBreak = useCallback(async () => {
    if (!breakActiveRef.current) return;
    breakActiveRef.current = false;
    breakUntilRef.current = 0;
    setPomState((current) => ({ ...current, isBreakActive: false }));
    await Promise.all([
      SharedPrefsModule.setFocusBreak(false, 0),
      ForegroundServiceModule.clearBreak(),
    ]);
  }, []);

  const clearBreakWithoutResumingFocus = useCallback(async () => {
    breakActiveRef.current = false;
    breakUntilRef.current = 0;
    await SharedPrefsModule.clearFocusBreak();
  }, []);

  const takeBreak = useCallback(async () => {
    if (!enabled || pomState.phase !== 'break' || breakActiveRef.current) return;
    const untilMs = Date.now() + Math.max(1, pomState.secondsLeft) * 1000;
    breakActiveRef.current = true;
    breakUntilRef.current = untilMs;
    setPomState((current) => ({ ...current, isBreakActive: true }));
    await Promise.all([
      // This is a deliberate break, not an attempt to end the focus session,
      // so it bypasses the session-PIN gate used by setFocusActive(false).
      SharedPrefsModule.setFocusBreak(true, untilMs),
      ForegroundServiceModule.setBreak(untilMs),
    ]);
  }, [enabled, pomState.phase, pomState.secondsLeft]);

  useEffect(() => {
    if (!enabled || !sessionStartedAt) {
      setPomState(idle);
      prevPhaseRef.current = null;
      void clearBreakWithoutResumingFocus();
      return;
    }

    let cancelled = false;
    void SharedPrefsModule.getFocusBreakUntilMs().then((untilMs) => {
      if (cancelled || untilMs <= Date.now()) return;
      breakUntilRef.current = untilMs;
      breakActiveRef.current = true;
      setPomState((current) => ({ ...current, isBreakActive: true }));
    });

    const tick = () => {
      const next = calcPomodoro(sessionStartedAt, workSecs, breakSecs);
      if (breakActiveRef.current && Date.now() >= breakUntilRef.current) {
        void resumeBreak();
      }
      setPomState({ ...next, isBreakActive: breakActiveRef.current });

      if (prevPhaseRef.current !== null && prevPhaseRef.current !== next.phase) {
        const toWork = next.phase === 'work';
        Vibration.vibrate(toWork ? [0, 200, 100, 200] : [0, 400]);
        void Notifications.scheduleNotificationAsync({
          content: {
            title: toWork ? '🎯 Back to Work' : '☕ Break Available',
            body: toWork
              ? `Focus up — ${workMinutes} min work session starting now.`
              : `Great work! Tap Take Break in FocusFlow to unlock apps for ${breakMinutes} min.`,
          },
          trigger: null,
        }).catch(() => {});
      }
      prevPhaseRef.current = next.phase;
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionStartedAt, workSecs, breakSecs, resumeBreak]);

  return { ...pomState, takeBreak };
}
