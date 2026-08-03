import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '../../lib/video/animations';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 px-12 bg-indigo-900/90 backdrop-blur-sm"
      {...sceneTransitions.morphExpand}
    >
      <div className="flex flex-col items-center text-center max-w-5xl">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-8 font-mono text-2xl bg-black/40 px-6 py-3 rounded-lg border border-indigo-400/30 text-indigo-200"
        >
          BIND_ACCESSIBILITY_SERVICE
        </motion.div>

        <motion.h2
          className="text-5xl md:text-6xl font-black mb-10 leading-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, type: 'spring' }}
        >
          Used exclusively for real-time <br/> foreground app detection.
        </motion.h2>

        <motion.div
          className="flex gap-6 mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <span className="text-2xl font-semibold text-teal-300 bg-teal-900/30 px-6 py-2 rounded-full border border-teal-500/30">
            On-device
          </span>
          <span className="text-2xl font-semibold text-emerald-300 bg-emerald-900/30 px-6 py-2 rounded-full border border-emerald-500/30">
            Never transmitted
          </span>
        </motion.div>

        <motion.div
          className="flex items-center gap-4 mt-8 pt-8 border-t border-white/10 w-full justify-center"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 1 }}
        >
          <svg className="w-12 h-12 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-4xl font-extrabold tracking-tight">FocusFlow</span>
        </motion.div>
      </div>
    </motion.div>
  );
}