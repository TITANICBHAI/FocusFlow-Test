import { useState, useEffect, useRef } from 'react';

export function useVideoPlayer(totalScenes: number, durationPerScene: number): { currentScene: number } {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScene(prev => (prev + 1) % totalScenes);
    }, durationPerScene);
    return () => clearTimeout(timer);
  }, [currentScene, totalScenes, durationPerScene]);

  return { currentScene };
}

export function useSceneTimer(events: Array<{ time: number; callback: () => void }>) {
  const firedRef = useRef<Set<number>>(new Set());
  const callbacksRef = useRef<Array<() => void>>([]);
  useEffect(() => { callbacksRef.current = events.map(e => e.callback); }, [events]);
  const scheduleKey = events.map((e, i) => `${i}:${e.time}`).join('|');
  useEffect(() => {
    firedRef.current = new Set();
    const timers = events.map(({ time }, index) =>
      setTimeout(() => {
        if (!firedRef.current.has(index)) { firedRef.current.add(index); callbacksRef.current[index]?.(); }
      }, time)
    );
    return () => timers.forEach(clearTimeout);
  }, [scheduleKey]);
}

export type SceneDurations = number;
export type UseVideoPlayerOptions = { totalScenes: number; durationPerScene: number };
export type UseVideoPlayerReturn = { currentScene: number };
