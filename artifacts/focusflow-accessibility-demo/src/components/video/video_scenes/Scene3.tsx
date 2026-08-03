import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '../../lib/video/animations';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Start session
      setTimeout(() => setPhase(2), 1500),  // Open app
      setTimeout(() => setPhase(3), 2500),  // Event fires
      setTimeout(() => setPhase(4), 3500),  // Reads package
      setTimeout(() => setPhase(5), 4500),  // Block overlay
      setTimeout(() => setPhase(6), 6000),  // Final statement
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const steps = [
    { label: "Focus Session Active", icon: "shield" },
    { label: "Social Media Opened", icon: "app" },
    { label: "TYPE_WINDOW_STATE_CHANGED", icon: "event", mono: true },
    { label: "Reads: com.tiktok.android", icon: "read", mono: true },
    { label: "Blocks instantly", icon: "block" }
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 px-12"
      {...sceneTransitions.wipe}
    >
      <h2 className="text-5xl font-bold mb-16 text-center">How FocusFlow Uses It</h2>

      <div className="flex flex-col gap-6 w-full max-w-4xl relative">
        {/* Connecting vertical line */}
        <motion.div 
          className="absolute left-[27px] top-8 bottom-8 w-1 bg-indigo-500/20"
          initial={{ height: 0 }}
          animate={phase >= 1 ? { height: '80%' } : { height: 0 }}
          transition={{ duration: 4, ease: 'linear' }}
        />

        {steps.map((step, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-8 relative z-10"
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= i + 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
          >
            {/* Node indicator */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${i === 4 ? 'bg-red-500/20 border-2 border-red-500' : 'bg-indigo-900/50 border-2 border-indigo-500'}`}>
              <div className={`w-4 h-4 rounded-full ${i === 4 ? 'bg-red-400' : 'bg-indigo-400'}`} />
            </div>

            {/* Content card */}
            <div className={`flex-1 glass-panel px-8 py-5 rounded-xl border ${i === 4 ? 'border-red-500/30 bg-red-900/10' : 'border-indigo-500/20'} flex items-center`}>
              <span className={`text-2xl ${step.mono ? 'font-mono text-teal-300 text-xl' : 'font-display font-semibold'}`}>
                {step.label}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-16 text-3xl font-bold text-center bg-indigo-600 px-8 py-4 rounded-xl border-l-4 border-teal-400 shadow-2xl"
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={phase >= 6 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.9 }}
        transition={{ duration: 0.8, type: 'spring' }}
      >
        Only the <span className="text-teal-200">package name</span> is read. Nothing else.
      </motion.div>
    </motion.div>
  );
}