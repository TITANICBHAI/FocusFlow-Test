import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

const TOTAL_DURATION_MS = 46000; // 5+5+5+6+6+6+6+7 = 46s

export default function RecordingButton() {
  const [status, setStatus] = useState<'idle' | 'countdown' | 'recording' | 'done'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      setStatus('countdown');
      setCountdown(3);

      await new Promise<void>((resolve) => {
        let count = 3;
        const tick = setInterval(() => {
          count--;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(tick);
            resolve();
          }
        }, 1000);
      });

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
        // @ts-ignore — supported in Chrome
        preferCurrentTab: true,
      });

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'focusflow-ad-4x3.webm';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('done');
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => setStatus('idle'), 4000);
      };

      recorder.start(500);
      setStatus('recording');
      setElapsed(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const e = Date.now() - startTime;
        setElapsed(e);
        if (e >= TOTAL_DURATION_MS) {
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 200);

    } catch (err) {
      console.error('Recording failed:', err);
      setStatus('idle');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const progressPct = Math.min((elapsed / TOTAL_DURATION_MS) * 100, 100);
  const remainingS = Math.max(0, Math.ceil((TOTAL_DURATION_MS - elapsed) / 1000));

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {status === 'recording' && (
        <div className="bg-black/80 text-white text-sm rounded-xl px-4 py-2 flex flex-col gap-1 min-w-[200px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording
            </span>
            <span>{remainingS}s left</span>
          </div>
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-white/50 mt-1">Downloads as .webm when done</p>
        </div>
      )}

      {status === 'countdown' && (
        <div className="bg-black/80 text-white text-4xl font-bold rounded-2xl w-20 h-20 flex items-center justify-center">
          {countdown > 0 ? countdown : '●'}
        </div>
      )}

      {status === 'done' && (
        <div className="bg-green-500/90 text-white text-sm rounded-xl px-4 py-2">
          ✓ Saved — check your downloads
        </div>
      )}

      <button
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={status === 'countdown'}
        className={`
          rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg transition-all
          ${status === 'recording'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : status === 'countdown'
            ? 'bg-gray-600 text-white cursor-not-allowed'
            : 'bg-white text-black hover:bg-gray-100'}
        `}
      >
        {status === 'recording' ? '⏹ Stop & Save' : status === 'countdown' ? 'Starting…' : '⏺ Record (4:3 MP4)'}
      </button>
    </div>
  );
}
