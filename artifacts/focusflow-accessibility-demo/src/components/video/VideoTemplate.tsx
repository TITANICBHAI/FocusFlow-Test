import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '../../lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  hook: 4000,
  permission: 6000,
  flow: 8000,
  notAccessed: 7000,
  closing: 6000
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#08080f] font-display text-white">
      {/* Background Layer (Persistent) */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={`${import.meta.env.BASE_URL}images/tech-bg.png`}
          alt="Tech Background"
          className="absolute w-full h-full object-cover opacity-20"
        />
        <div className="noise-overlay" />
        
        {/* Animated gradients */}
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[100px] opacity-30"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
          animate={{
            x: ['-20%', '10%', '-20%'],
            y: ['-20%', '20%', '-20%'],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[80px] opacity-20 right-0 bottom-0"
          style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }}
          animate={{
            x: ['20%', '-10%', '20%'],
            y: ['20%', '-10%', '20%'],
            scale: [1, 1.3, 1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Persistent Midground Grid/Lines */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: currentScene === 4 ? 0 : 1 }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '4vw 4vw', transform: 'perspective(500px) rotateX(60deg) scale(2)', transformOrigin: 'top center' }} />
      </motion.div>

      {/* Scene Content */}
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="hook" />}
        {currentScene === 1 && <Scene2 key="permission" />}
        {currentScene === 2 && <Scene3 key="flow" />}
        {currentScene === 3 && <Scene4 key="notAccessed" />}
        {currentScene === 4 && <Scene5 key="closing" />}
      </AnimatePresence>
    </div>
  );
}