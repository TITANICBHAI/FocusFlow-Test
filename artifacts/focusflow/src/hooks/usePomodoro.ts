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
  if (breakSecs <= 0) {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(sessionStartedAt).getTime()) / 1000),
    );
    const cycleCount = Math.floor(elapsed / workSecs);
    const pos = elapsed % workSecs;
    return {
      phase: 'work',
      secondsLeft: workSecs - pos,
      cycleCount,
      phaseProgress: pos / workSecs,
      isBreakActive: false,
    };
  }
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
  onBreakStart?: (seconds: number) => void,
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

  const activateBreak = useCallback(async (secondsLeft: number) => {
    if (breakActiveRef.current || breakSecs <= 0) return;
    const untilMs = Date.now() + Math.max(1, secondsLeft) * 1000;
    breakActiveRef.current = true;
    breakUntilRef.current = untilMs;
    setPomState((current) => ({ ...current, isBreakActive: true }));
    onBreakStart?.(Math.max(1, secondsLeft));
    await Promise.all([
      SharedPrefsModule.setFocusBreak(true, untilMs),
      ForegroundServiceModule.setBreak(untilMs),
    ]);
  }, [breakSecs, onBreakStart]);

  const takeBreak = useCallback(async () => {
    if (!enabled || pomState.phase !== 'break' || breakActiveRef.current) return;
    // This is a break, not an attempt to end the focus session, so it bypasses
    // the session-PIN gate used by setFocusActive(false).
    await activateBreak(pomState.secondsLeft);
  }, [activateBreak, enabled, pomState.phase, pomState.secondsLeft]);

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
      if (next.phase === 'break' && !breakActiveRef.current) {
        // Breaks start automatically when work time is exhausted. The user
        // does not need to be using the phone for the restriction to lift.
        void activateBreak(next.secondsLeft);
      }
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
              : `Great work! Apps are unlocked for ${breakMinutes} min, then blocking resumes automatically.`,
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
  }, [activateBreak, enabled, sessionStartedAt, workSecs, breakSecs, resumeBreak]);

  return { ...pomState, takeBreak };
}
