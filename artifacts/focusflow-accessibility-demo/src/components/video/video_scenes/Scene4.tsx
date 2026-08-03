import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '../../lib/video/animations';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1000), // SMS
      setTimeout(() => setPhase(3), 1400), // Calls
      setTimeout(() => setPhase(4), 1800), // Passwords
      setTimeout(() => setPhase(5), 2200), // Screen
      setTimeout(() => setPhase(6), 2600), // Personal
      setTimeout(() => setPhase(7), 4000), // Statement
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const items = [
    { label: "SMS messages" },
    { label: "Call logs" },
    { label: "Passwords" },
    { label: "Screen content" },
    { label: "Personal data" }
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 px-12"
      {...sceneTransitions.splitHorizontal}
    >
      <h2 className="text-6xl font-black mb-12 text-white/90">
        What it does <span className="text-red-500">NOT</span> do
      </h2>

      <div className="grid grid-cols-2 gap-x-12 gap-y-6 max-w-4xl w-full mb-16">
        {items.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-6 glass-panel px-8 py-5 rounded-2xl border-l-4 border-red-500/50"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              {/* X mark drawn dynamically */}
              <svg className="absolute w-full h-full text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <motion.path
                  d="M6 6l12 12"
                  initial={{ pathLength: 0 }}
                  animate={phase >= i + 2 ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                />
                <motion.path
                  d="M18 6L6 18"
                  initial={{ pathLength: 0 }}
                  animate={phase >= i + 2 ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                />
              </svg>
            </div>
            <span className="text-3xl font-semibold text-white/80 line-through decoration-red-500/50 decoration-4">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="max-w-3xl text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 7 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, type: 'spring' }}
      >
        <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-full px-8 py-4 inline-flex items-center gap-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-3xl font-bold text-emerald-300">All data stays on your device. Zero transmission.</span>
        </div>
      </motion.div>
    </motion.div>
  );
}