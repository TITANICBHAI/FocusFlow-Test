import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Lock, Calendar, Clock, BarChart3, ShieldAlert, XCircle, CheckCircle2, Zap, Smartphone, Check } from "lucide-react";

// Video Structure
// 0: HOOK (3s): Chaotic phone notifications raining down -> FREEZE -> "Enough."
// 1: INTRO (4s): FocusFlow logo and tagline reveal with indigo energy burst
// 2: FEATURE 1 (4s): App Blocker - "BLOCKED" overlay screen, apps grayed out
// 3: FEATURE 2 (4s): Smart Scheduler - timeline card morphs into day plan
// 4: FEATURE 3 (3s): Pomodoro timer - circular progress ring
// 5: FEATURE 4 (4s): Stats - completion percentages, streak counter
// 6: CTA (4s): "Take back your time." - FocusFlow logo lockup

const SCENE_DURATIONS = [3000, 4000, 4000, 4000, 3000, 4000, 4000];

export default function FocusFlowPromo() {
  const [currentScene, setCurrentScene] = useState(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    let animationFrameId: number;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      
      let totalDuration = 0;
      let targetScene = 0;
      
      for (let i = 0; i < SCENE_DURATIONS.length; i++) {
        if (elapsed < totalDuration + SCENE_DURATIONS[i]) {
          targetScene = i;
          break;
        }
        totalDuration += SCENE_DURATIONS[i];
      }

      // Loop video
      if (elapsed >= totalDuration && targetScene === 0) {
        startTime = now;
      }

      setCurrentScene(targetScene);
      setTime(elapsed);
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="w-full h-screen bg-[#050505] overflow-hidden relative font-sans text-white flex items-center justify-center">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        
        .glow-indigo {
          box-shadow: 0 0 60px 20px rgba(99, 102, 241, 0.15);
        }
        
        .kinetic-bg {
          background-image: radial-gradient(circle at center, rgba(99,102,241,0.1) 0%, rgba(5,5,5,1) 60%);
        }
      `}} />

      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0 kinetic-bg pointer-events-none" />
      
      <motion.div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none"
        animate={{
          opacity: currentScene === 0 ? 0.3 : currentScene === 1 ? 0.6 : 0.2,
          scale: currentScene === 1 ? 1.1 : 1
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      >
        <video 
          src="/videos/indigo-particles.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        />
      </motion.div>

      <motion.div 
        className="absolute inset-0 z-0 opacity-20 mix-blend-screen pointer-events-none"
        animate={{
          opacity: currentScene === 2 || currentScene === 4 ? 0.5 : 0.1
        }}
        transition={{ duration: 1 }}
      >
        <video 
          src="/videos/tech-kinetic.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Persistent Cross-Scene Elements */}
      <motion.div 
        className="absolute w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] rounded-full bg-indigo-600/20 blur-[100px] z-0 pointer-events-none"
        animate={{
          x: currentScene === 0 ? '-20%' : currentScene === 2 ? '50%' : currentScene === 5 ? '-50%' : '0%',
          y: currentScene === 0 ? '20%' : currentScene === 3 ? '-20%' : '0%',
          scale: currentScene === 1 || currentScene === 6 ? 1.5 : 1,
          opacity: currentScene === 1 || currentScene === 6 ? 0.8 : 0.3
        }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="wait">
        {currentScene === 0 && <Scene0Hook key="scene0" />}
        {currentScene === 1 && <Scene1Intro key="scene1" />}
        {currentScene === 2 && <Scene2Blocker key="scene2" />}
        {currentScene === 3 && <Scene3Scheduler key="scene3" />}
        {currentScene === 4 && <Scene4Pomodoro key="scene4" />}
        {currentScene === 5 && <Scene5Stats key="scene5" />}
        {currentScene === 6 && <Scene6CTA key="scene6" />}
      </AnimatePresence>

    </div>
  );
}

// ------------------------------------------------------------------
// SCENE 0: HOOK - Chaotic notifications -> FREEZE -> "Enough."
// ------------------------------------------------------------------
function Scene0Hook() {
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFrozen(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const notifications = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: (Math.random() - 0.5) * 80 + 'vw',
    yStart: '-20vh',
    yEnd: (Math.random() * 60 + 20) + 'vh',
    rotate: (Math.random() - 0.5) * 20
  }));

  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.5 }}
    >
      {/* Notifications raining down */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            className="absolute left-1/2 top-0 w-[80vw] max-w-sm bg-zinc-800/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-4 shadow-xl"
            initial={{ x: n.x, y: n.yStart, rotate: n.rotate, opacity: 0 }}
            animate={frozen ? { 
              x: n.x, 
              y: n.yEnd, 
              rotate: n.rotate, 
              opacity: 0.2, 
              scale: 0.9,
              filter: "grayscale(100%) blur(4px)"
            } : { 
              x: n.x, 
              y: n.yEnd, 
              rotate: n.rotate, 
              opacity: 1 
            }}
            transition={frozen ? { duration: 0.4, ease: "easeOut" } : { duration: 0.8, delay: n.delay, type: "spring" }}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="font-display font-bold text-sm">Social App</span>
                <span className="text-xs text-white/50">Now</span>
              </div>
              <p className="font-body text-sm text-white/80 leading-tight">Someone liked your post. See who it was before you miss out...</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* The disruption */}
      <AnimatePresence>
        {frozen && (
          <motion.div 
            className="relative z-20 flex flex-col items-center justify-center"
            initial={{ scale: 0.5, opacity: 0, filter: "blur(20px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div 
              className="font-display font-bold text-7xl md:text-9xl text-white tracking-tighter"
              animate={{ 
                textShadow: ["0 0 0px rgba(255,255,255,0)", "0 0 40px rgba(255,255,255,0.8)", "0 0 20px rgba(255,255,255,0.4)"]
              }}
              transition={{ duration: 1 }}
            >
              ENOUGH.
            </motion.div>
            <motion.p 
              className="font-body text-xl md:text-2xl text-red-400 mt-4 tracking-wide font-medium"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              You have 47 unread distractions.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// SCENE 1: INTRO - FocusFlow logo and tagline
// ------------------------------------------------------------------
function Scene1Intro() {
  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div 
        className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] mb-8 glow-indigo"
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
      >
        <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center relative overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-indigo-500/20"
            animate={{ scale: [1, 1.5, 1], opacity: [0, 0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <Zap className="w-16 h-16 md:w-20 md:h-20 text-indigo-400" strokeWidth={1.5} />
        </div>
      </motion.div>

      <div className="overflow-hidden">
        <motion.h1 
          className="font-display font-bold text-5xl md:text-7xl text-white tracking-tight"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.4 }}
        >
          FocusFlow
        </motion.h1>
      </div>

      <div className="overflow-hidden mt-4">
        <motion.p 
          className="font-body text-xl md:text-2xl text-indigo-200"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Your Discipline Operating System.
        </motion.p>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// SCENE 2: FEATURE 1 - App Blocker
// ------------------------------------------------------------------
function Scene2Blocker() {
  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 px-8"
      initial={{ opacity: 0, x: "100vw" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "-50vw" }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="flex-1 max-w-md text-left">
        <motion.div 
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-body text-sm font-semibold mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Lock className="w-4 h-4" /> System-Level Protection
        </motion.div>
        
        <motion.h2 
          className="font-display font-bold text-4xl md:text-5xl text-white mb-4 leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Physical enforcement.<br/>No excuses.
        </motion.h2>
        
        <motion.p 
          className="font-body text-lg text-zinc-400"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          FocusFlow uses Android Accessibility Service to literally block distracting apps while you work.
        </motion.p>
      </div>

      <motion.div 
        className="relative w-[280px] h-[580px] shrink-0 perspective-1000"
        initial={{ opacity: 0, rotateY: 30, scale: 0.8 }}
        animate={{ opacity: 1, rotateY: -10, scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 20, delay: 0.2 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Phone Mockup Frame */}
        <div className="absolute inset-0 rounded-[40px] border-[8px] border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          {/* Status Bar */}
          <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-6 z-30">
            <span className="text-[10px] font-medium text-white">9:41</span>
            <div className="flex gap-1">
              <div className="w-4 h-3 bg-white rounded-sm" />
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
          </div>
          {/* Dynamic Island / Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30" />

          {/* Fake App Content under the block */}
          <div className="absolute inset-0 pt-16 px-4 pb-4 opacity-30 filter grayscale">
            <div className="flex gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800" />
              <div className="flex-1">
                <div className="w-24 h-4 bg-zinc-800 rounded mb-2" />
                <div className="w-3/4 h-3 bg-zinc-800 rounded" />
              </div>
            </div>
            <div className="w-full h-64 bg-zinc-800 rounded-xl mb-4" />
            <div className="w-full h-4 bg-zinc-800 rounded mb-2" />
            <div className="w-2/3 h-4 bg-zinc-800 rounded" />
          </div>

          {/* The Block Overlay */}
          <motion.div 
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-xl"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <motion.div 
              className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6 relative"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 1.2 }}
            >
              <motion.div 
                className="absolute inset-0 rounded-full border border-red-500/50"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Lock className="w-10 h-10 text-red-500" />
            </motion.div>
            
            <motion.h3 
              className="font-display font-bold text-2xl text-white mb-2 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
            >
              STRICT FOCUS
            </motion.h3>
            
            <motion.p 
              className="font-body text-zinc-400 text-center px-8 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
            >
              This app is blocked until your deep work session ends.
            </motion.p>
            
            <motion.div 
              className="mt-12 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 w-3/4 flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
            >
              <span className="font-body font-bold text-indigo-400">14:59</span>
              <span className="text-zinc-500 text-xs uppercase font-bold tracking-wider">Remaining</span>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// SCENE 3: FEATURE 2 - Scheduler
// ------------------------------------------------------------------
function Scene3Scheduler() {
  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col md:flex-row-reverse items-center justify-center gap-12 md:gap-24 px-8"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: "-50vh" }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex-1 max-w-md text-left">
        <motion.div 
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-body text-sm font-semibold mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Calendar className="w-4 h-4" /> Smart Scheduler
        </motion.div>
        
        <motion.h2 
          className="font-display font-bold text-4xl md:text-5xl text-white mb-4 leading-tight"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          Plan the day.<br/>We'll handle conflicts.
        </motion.h2>
        
        <motion.p 
          className="font-body text-lg text-zinc-400"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          Visual timeline engine intelligently slots your tasks, rebalances overruns, and protects deep work.
        </motion.p>
      </div>

      <div className="relative w-[320px] shrink-0">
        <motion.div 
          className="w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-display font-bold text-lg text-white">Today's Timeline</h4>
            <span className="text-zinc-500 text-sm font-body">Tue, Oct 24</span>
          </div>

          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-zinc-800">
            {[
              { time: "09:00", title: "Morning Standup", duration: "30m", type: "normal", delay: 0.6 },
              { time: "09:30", title: "Deep Work: Architecture", duration: "120m", type: "focus", delay: 0.8 },
              { time: "11:30", title: "Code Review", duration: "45m", type: "normal", delay: 1.0 },
            ].map((task, i) => (
              <motion.div 
                key={i}
                className="relative pl-8"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: task.delay, type: "spring" }}
              >
                <div className={`absolute left-[9px] top-1.5 w-2 h-2 rounded-full ring-4 ring-zinc-900 ${task.type === 'focus' ? 'bg-indigo-500' : 'bg-zinc-600'}`} />
                <div className={`p-3 rounded-xl border ${task.type === 'focus' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-zinc-800/50 border-white/5'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-zinc-400">{task.time}</span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${task.type === 'focus' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-700/50 text-zinc-400'}`}>
                      {task.duration}
                    </span>
                  </div>
                  <h5 className={`font-body font-medium ${task.type === 'focus' ? 'text-indigo-100' : 'text-zinc-200'}`}>
                    {task.title}
                  </h5>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// SCENE 4: FEATURE 3 - Pomodoro
// ------------------------------------------------------------------
function Scene4Pomodoro() {
  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2, filter: "blur(10px)" }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center"
        initial={{ rotate: -90 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 1, type: "spring", stiffness: 100 }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="rgba(255,255,255,0.05)" 
            strokeWidth="4" 
          />
          <motion.circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="#6366f1" 
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="283"
            initial={{ strokeDashoffset: 283 }}
            animate={{ strokeDashoffset: 140 }} // Halfway done
            transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
          />
        </svg>

        <div className="text-center">
          <motion.div 
            className="font-display font-bold text-5xl md:text-7xl text-white tracking-tighter"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            12:45
          </motion.div>
          <motion.div 
            className="font-body text-indigo-400 font-medium uppercase tracking-widest text-sm mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Focus Session
          </motion.div>
        </div>
      </motion.div>

      <motion.h2 
        className="font-display font-bold text-3xl md:text-4xl text-white mt-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        Built-in Pomodoro
      </motion.h2>
      <motion.p 
        className="font-body text-zinc-400 mt-4 text-center max-w-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        Work in rhythmic intervals. We track the time, you do the work.
      </motion.p>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// SCENE 5: FEATURE 4 - Stats & Streaks
// ------------------------------------------------------------------
function Scene5Stats() {
  return (
    <motion.div 
      className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8"
      initial={{ opacity: 0, rotateX: 90 }}
      animate={{ opacity: 1, rotateX: 0 }}
      exit={{ opacity: 0, y: "100vh" }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      style={{ perspective: 1000 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* Stat Card 1 */}
        <motion.div 
          className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col relative overflow-hidden"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full" />
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-xl text-white">Focus Score</h3>
          </div>
          
          <div className="flex items-end gap-4 mt-auto">
            <motion.span 
              className="font-display font-bold text-7xl text-white leading-none tracking-tighter"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
            >
              94<span className="text-4xl text-zinc-500">%</span>
            </motion.span>
            <span className="font-body text-emerald-400 font-bold mb-2 flex items-center gap-1">
              ↑ 12%
            </span>
          </div>
        </motion.div>

        {/* Stat Card 2 */}
        <motion.div 
          className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col relative overflow-hidden"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/20 blur-3xl rounded-full" />
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-xl text-white">Current Streak</h3>
          </div>
          
          <div className="flex items-end gap-4 mt-auto">
            <motion.span 
              className="font-display font-bold text-7xl text-white leading-none tracking-tighter"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
            >
              14
            </motion.span>
            <span className="font-body text-zinc-400 font-bold mb-2">
              days
            </span>
          </div>
          
          {/* Mini chart */}
          <div className="flex items-end gap-2 h-12 mt-6">
            {[30, 50, 40, 70, 60, 90, 100].map((h, i) => (
              <motion.div 
                key={i}
                className={`w-full rounded-sm ${i === 6 ? 'bg-orange-500' : 'bg-zinc-800'}`}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 1 + (i * 0.1), duration: 0.5 }}
              />
            ))}
          </div>
        </motion.div>

      </div>

      <motion.h2 
        className="font-display font-bold text-3xl md:text-5xl text-white mt-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
      >
        Track your discipline.
      </motion.h2>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// SCENE 6: CTA - Outro
// ------------------------------------------------------------------
function Scene6CTA() {
  return (
    <motion.div 
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div 
        className="absolute inset-0 z-0 opacity-50 pointer-events-none mix-blend-screen"
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 2 }}
      >
        <video 
          src="/videos/tech-kinetic.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        />
      </motion.div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div 
          className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center mb-8 glow-indigo"
          initial={{ scale: 0, rotate: 90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
        >
          <Zap className="w-10 h-10 text-white" fill="currentColor" />
        </motion.div>

        <motion.h2 
          className="font-display font-bold text-5xl md:text-7xl text-white mb-6 tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Take back your time.
        </motion.h2>

        <motion.div 
          className="flex flex-col items-center gap-2 mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <div className="px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-display font-bold text-lg flex items-center gap-3">
            <Smartphone className="w-5 h-5" />
            Free on Android
          </div>
          <span className="text-zinc-500 font-body text-sm mt-4 uppercase tracking-widest font-semibold">
            Search "FocusFlow"
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
