import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '../../lib/video/animations';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      {...sceneTransitions.scaleFade}
    >
      <motion.div
        className="mb-8 relative flex items-center justify-center w-32 h-32"
        initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ duration: 1, type: 'spring', bounce: 0.4 }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-24 h-24 text-[#6366f1]" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        </svg>
      </motion.div>

      <div className="text-center px-12">
        <motion.p
          className="text-indigo-400 font-mono text-xl mb-4 tracking-widest uppercase"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Compliance Declaration
        </motion.p>
        
        <h1 className="text-6xl font-extrabold tracking-tight">
          {'Why does FocusFlow need Accessibility?'.split(' ').map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-4"
              initial={{ opacity: 0, y: 40, rotateX: -30 }}
              animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: -30 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {word === 'Accessibility?' ? <span className="text-[#06b6d4]">{word}</span> : word}
            </motion.span>
          ))}
        </h1>
      </div>
    </motion.div>
  );
}