import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '../../lib/video/animations';

export function Scene2() {
  const [phase, setPhase] = useState(0);
  const permissionString = "android.permission.BIND_ACCESSIBILITY_SERVICE";

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      {...sceneTransitions.clipPolygon}
    >
      {/* Code snippet block */}
      <motion.div 
        className="glass-panel p-8 rounded-2xl border border-indigo-500/30 mb-12 max-w-4xl w-full mx-auto"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="flex gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
        </div>
        <div className="font-mono text-2xl text-indigo-300 flex flex-wrap break-all">
          <span className="text-white mr-4">&lt;uses-permission</span>
          <span className="text-teal-400 mr-2">android:name</span>=
          <span className="text-emerald-400 ml-2">"</span>
          {permissionString.split('').map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: i * 0.03, duration: 0.1 }}
              className="text-emerald-400"
            >
              {char}
            </motion.span>
          ))}
          <span className="text-emerald-400">"</span>
          <span className="text-white ml-4">/&gt;</span>
        </div>
      </motion.div>

      {/* Human readable explanation */}
      <div className="text-center px-12 max-w-4xl mx-auto flex flex-col items-center">
        <motion.h2 
          className="text-5xl font-bold mb-6 text-white"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.8 }}
        >
          Detects which app is in the foreground
        </motion.h2>

        {/* Abstract phone detection diagram */}
        <motion.div
          className="flex items-center gap-6 mt-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.8, type: 'spring' }}
        >
          <div className="flex flex-col items-center">
             <div className="w-16 h-24 border-2 border-white/20 rounded-lg flex items-center justify-center bg-white/5">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
             </div>
             <span className="mt-2 text-sm text-white/50 font-mono">APP SWITCH</span>
          </div>

          <div className="w-24 h-0.5 bg-indigo-500/50 relative overflow-hidden">
             <motion.div 
               className="absolute top-0 left-0 h-full w-1/3 bg-indigo-400"
               animate={{ left: ['-50%', '150%'] }}
               transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
             />
          </div>

          <div className="bg-indigo-900/50 border border-indigo-500/30 px-6 py-3 rounded-lg font-mono text-lg text-teal-400">
             com.instagram.android
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}