import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    startRecording?: () => Promise<void>;
    stopRecording?: () => void;
  }
}

export interface SceneDurations { [key: string]: number; }
export interface UseVideoPlayerOptions { durations: SceneDurations; onVideoEnd?: () => void; loop?: boolean; }
export interface UseVideoPlayerReturn { currentScene: number; totalScenes: number; currentSceneKey: string; hasEnded: boolean; }

export function useVideoPlayer(options: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const { durations, onVideoEnd, loop = true } = options;
  const sceneKeys = useRef(Object.keys(durations)).current;
  const totalScenes = sceneKeys.length;
  const durationsArray = useRef(Object.values(durations)).current;
  const [currentScene, setCurrentScene] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => { window.startRecording?.(); }, []);

  useEffect(() => {
    if (hasEnded && !loop) return;
    const timer = setTimeout(() => {
      if (currentScene >= totalScenes - 1) {
        if (!hasEnded) { window.stopRecording?.(); setHasEnded(true); onVideoEnd?.(); }
        if (loop) setCurrentScene(0);
      } else {
        setCurrentScene(prev => prev + 1);
      }
    }, durationsArray[currentScene]);
    return () => clearTimeout(timer);
  }, [currentScene, totalScenes, durationsArray, hasEnded, loop, onVideoEnd]);

  return { currentScene, totalScenes, currentSceneKey: sceneKeys[currentScene], hasEnded };
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
