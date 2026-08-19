import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Clock, Calendar, BarChart3, BellRing } from 'lucide-react';
import RecordingButton from './components/RecordingButton';

const SCENE_DURATIONS = [
  5000, // 0: Opening
  5000, // 1: Problem Beat
  5000, // 2: Solution Intro
  6000, // 3: Feature 1 - Blocking
  6000, // 4: Feature 2 - Focus Timer
  6000, // 5: Feature 3 - Smart Scheduling
  6000, // 6: Stats Beat
  7000, // 7: Closing Lockup
];

export default function App() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScene((prev) => (prev + 1) % SCENE_DURATIONS.length);
    }, SCENE_DURATIONS[currentScene]);
    return () => clearTimeout(timer);
  }, [currentScene]);

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* 4:3 canvas — matches 1600×1200 or 1200×900 target */}
      <div
        id="ad-canvas"
        className="relative bg-dark-900 overflow-hidden font-sans"
        style={{
          aspectRatio: '4 / 3',
          height: 'min(100vh, calc(100vw * 3 / 4))',
          width: 'min(100vw, calc(100vh * 4 / 3))',
        }}
      >
        <div className="noise-overlay" />

        {/* Background Layer */}
        <motion.div
          className="absolute inset-0 opacity-40 mix-blend-screen"
          animate={{
            scale: [1, 1.05, 1],
            opacity: currentScene === 0 ? 0.3 : 0.6,
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/cinematic-bg.png`}
            alt="Cinematic Background"
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Main Content Area */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <Scene key={currentScene} sceneIndex={currentScene} />
          </AnimatePresence>
        </div>
      </div>

      {/* Recording controls — outside the canvas so they don't appear in the recording */}
      <RecordingButton />
    </div>
  );
}

function Scene({ sceneIndex }: { sceneIndex: number }) {
  // Simple switch for scenes
  switch (sceneIndex) {
    case 0:
      return <SceneOpening />;
    case 1:
      return <SceneProblem />;
    case 2:
      return <SceneSolution />;
    case 3:
      return <SceneBlocking />;
    case 4:
      return <SceneTimer />;
    case 5:
      return <SceneScheduling />;
    case 6:
      return <SceneStats />;
    case 7:
      return <SceneClosing />;
    default:
      return null;
  }
}

// Scene 0: Opening
function SceneOpening() {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0 opacity-50"
        initial={{ filter: "blur(20px)", scale: 1.5 }}
        animate={{ filter: "blur(40px)", scale: 1 }}
        transition={{ duration: 4 }}
      >
        <img src={`${import.meta.env.BASE_URL}assets/distraction-noise.png`} alt="Noise" className="w-full h-full object-cover" />
      </motion.div>
      <motion.div
        initial={{ scale: 0, opacity: 0, rotate: -15 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.6)]">
          <img src={`${import.meta.env.BASE_URL}assets/app-icon.jpeg`} alt="FocusFlow" className="w-full h-full object-cover" />
        </div>
        <motion.h1 
          className="text-6xl font-display font-bold mt-8 tracking-tight text-white"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          FocusFlow
        </motion.h1>
      </motion.div>
    </motion.div>
  )
}

function SceneProblem() {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center w-full h-full relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ y: "-100%" }}
        animate={{ y: "100%" }}
        transition={{ duration: 5, ease: "linear" }}
      >
         <img src={`${import.meta.env.BASE_URL}assets/distraction-noise.png`} alt="Noise" className="w-full h-full object-cover opacity-30" />
      </motion.div>
      <motion.h2 
        className="text-7xl font-display font-bold text-center z-10"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        Your phone is stealing<br/>your focus.
      </motion.h2>
    </motion.div>
  )
}

function SceneSolution() {
  return (
    <motion.div 
      className="flex flex-row items-center justify-between w-full h-full px-[15vw] relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1.2 }}
    >
      <div className="absolute right-0 top-0 bottom-0 w-1/2 flex items-center justify-end z-0">
         <motion.img 
            src={`${import.meta.env.BASE_URL}assets/focused-person.png`} 
            alt="Focused Person" 
            className="h-[120%] object-cover object-right opacity-80"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 0.8 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
         />
         <div className="absolute inset-0 bg-gradient-to-r from-dark-900 via-dark-900/50 to-transparent" />
      </div>

      <div className="z-10 w-1/2 flex flex-col items-start">
        <motion.div 
           className="flex items-center gap-6 mb-8"
           initial={{ scale: 0.9, opacity: 0, y: 20 }}
           animate={{ scale: 1, opacity: 1, y: 0 }}
           transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(99,102,241,0.6)]">
             <img src={`${import.meta.env.BASE_URL}assets/app-icon.jpeg`} alt="FocusFlow" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-8xl font-display font-bold text-white tracking-tight">FocusFlow</h1>
        </motion.div>
        <motion.div
           initial={{ width: 0 }}
           animate={{ width: "100%" }}
           transition={{ duration: 1, delay: 0.8, ease: "easeInOut" }}
           className="h-1 bg-gradient-to-r from-brand-500 to-transparent mb-8"
        />
        <motion.p 
          className="text-4xl text-brand-200 font-medium tracking-wide uppercase"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
        >
          Your discipline<br/>operating system
        </motion.p>
      </div>
    </motion.div>
  )
}

function SceneBlocking() {
  return (
    <motion.div 
      className="flex flex-row items-center justify-between w-full h-full px-[15vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1 }}
    >
      <div className="w-1/2 flex flex-col items-start gap-6 z-10">
        <motion.div 
          className="bg-brand-500/20 p-4 rounded-2xl border border-brand-500/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Lock className="w-8 h-8 text-brand-400" />
        </motion.div>
        <motion.h2 
          className="text-6xl font-display font-bold leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Block distractions.<br/>
          <span className="text-brand-400">For real.</span>
        </motion.h2>
      </div>
      <div className="w-1/2 flex justify-center items-center">
        <PhoneMockup>
          <motion.div 
            className="w-full h-full bg-dark-800 flex items-center justify-center flex-col relative overflow-hidden"
          >
            <motion.div 
              className="absolute inset-0 bg-red-500 flex items-center justify-center"
              initial={{ y: "100%" }}
              animate={{ y: ["100%", "0%", "0%", "-100%"] }}
              transition={{ times: [0, 0.2, 0.8, 1], duration: 4, delay: 1 }}
            >
              <span className="text-white text-3xl font-bold">Social Media App</span>
            </motion.div>
            <motion.div 
              className="absolute inset-0 bg-brand-900 flex flex-col items-center justify-center p-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1, 1] }}
              transition={{ times: [0, 0.8, 0.85, 1], duration: 4, delay: 1 }}
            >
              <img src={`${import.meta.env.BASE_URL}assets/app-icon.jpeg`} alt="FocusFlow" className="w-16 h-16 rounded-xl object-cover mb-6" />
              <h3 className="text-2xl font-bold text-white mb-2">App Blocked</h3>
              <p className="text-brand-200">You are in a focus session.</p>
            </motion.div>
          </motion.div>
        </PhoneMockup>
      </div>
    </motion.div>
  )
}

function SceneTimer() {
  return (
    <motion.div 
      className="flex flex-row-reverse items-center justify-between w-full h-full px-[15vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1 }}
    >
      <div className="w-1/2 flex flex-col items-start gap-6 z-10 pl-16">
        <motion.div 
          className="bg-brand-500/20 p-4 rounded-2xl border border-brand-500/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Clock className="w-8 h-8 text-brand-400" />
        </motion.div>
        <motion.h2 
          className="text-6xl font-display font-bold leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Deep focus.<br/>
          <span className="text-brand-400">No escape.</span>
        </motion.h2>
      </div>
      <div className="w-1/2 flex justify-center items-center">
        <PhoneMockup>
          <div className="w-full h-full bg-dark-900 flex flex-col items-center justify-center relative p-6">
            <motion.div 
              className="w-64 h-64 rounded-full border-4 border-brand-500/30 flex items-center justify-center relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <motion.div 
                className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              />
              <div className="text-5xl font-display font-bold tabular-nums text-white">24:59</div>
            </motion.div>
            <div className="mt-12 text-center">
              <div className="text-xl font-semibold text-white mb-2">Deep Work</div>
              <div className="px-6 py-3 bg-white/10 rounded-full text-white font-medium">Extend Focus</div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </motion.div>
  )
}

function SceneScheduling() {
  return (
    <motion.div 
      className="flex flex-row items-center justify-between w-full h-full px-[15vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1 }}
    >
      <div className="w-1/2 flex flex-col items-start gap-6 z-10">
        <motion.div 
          className="bg-brand-500/20 p-4 rounded-2xl border border-brand-500/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Calendar className="w-8 h-8 text-brand-400" />
        </motion.div>
        <motion.h2 
          className="text-6xl font-display font-bold leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Plan your day.<br/>
          <span className="text-brand-400">Own it.</span>
        </motion.h2>
      </div>
      <div className="w-1/2 flex justify-center items-center">
        <PhoneMockup>
          <div className="w-full h-full bg-dark-900 p-6 flex flex-col pt-16">
            <h3 className="text-2xl font-bold text-white mb-6">Today's Schedule</h3>
            <div className="flex flex-col gap-4">
              <motion.div 
                className="bg-brand-600 rounded-2xl p-4 border border-brand-400/50"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <div className="text-xs text-brand-200 mb-1">09:00 - 11:30</div>
                <div className="text-lg font-semibold text-white">Deep Work Block</div>
              </motion.div>
              <motion.div 
                className="bg-dark-800 rounded-2xl p-4 border border-white/5"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <div className="text-xs text-brand-200/60 mb-1">11:30 - 12:00</div>
                <div className="text-lg font-semibold text-white/70">Email & Slack</div>
              </motion.div>
              <motion.div 
                className="bg-dark-800 rounded-2xl p-4 border border-white/5"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                <div className="text-xs text-brand-200/60 mb-1">13:00 - 15:00</div>
                <div className="text-lg font-semibold text-white/70">Project Planning</div>
              </motion.div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </motion.div>
  )
}

function SceneStats() {
  return (
    <motion.div 
      className="flex flex-row-reverse items-center justify-between w-full h-full px-[15vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1 }}
    >
      <div className="w-1/2 flex flex-col items-start gap-6 z-10 pl-16">
        <motion.div 
          className="bg-brand-500/20 p-4 rounded-2xl border border-brand-500/30"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <BarChart3 className="w-8 h-8 text-brand-400" />
        </motion.div>
        <motion.h2 
          className="text-6xl font-display font-bold leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Track your<br/>
          <span className="text-brand-400">discipline.</span>
        </motion.h2>
      </div>
      <div className="w-1/2 flex justify-center items-center">
        <PhoneMockup>
          <div className="w-full h-full bg-dark-900 p-6 pt-16 flex flex-col gap-6">
            <h3 className="text-2xl font-bold text-white">Analytics</h3>
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                className="bg-dark-800 rounded-2xl p-4 flex flex-col"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <div className="text-sm text-brand-200/60 mb-2">Focus Minutes</div>
                <div className="text-3xl font-display font-bold text-white">420</div>
              </motion.div>
              <motion.div 
                className="bg-dark-800 rounded-2xl p-4 flex flex-col"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <div className="text-sm text-brand-200/60 mb-2">Current Streak</div>
                <div className="text-3xl font-display font-bold text-brand-400">12<span className="text-lg">days</span></div>
              </motion.div>
            </div>
            <motion.div 
              className="flex-1 bg-dark-800 rounded-2xl p-6 flex flex-col items-center justify-center border border-white/5"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.4 }}
            >
              <div className="relative w-32 h-32 mb-4">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="12" fill="none" />
                  <motion.circle 
                    cx="50" cy="50" r="40" 
                    stroke="#5B5BD6" 
                    strokeWidth="12" 
                    fill="none" 
                    strokeDasharray="251.2" 
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 * 0.15 }} // 85% complete
                    transition={{ duration: 2, delay: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <div className="text-2xl font-bold text-white">85%</div>
                </div>
              </div>
              <div className="text-center text-sm text-brand-200/80">Weekly Completion</div>
            </motion.div>
          </div>
        </PhoneMockup>
      </div>
    </motion.div>
  )
}

function SceneClosing() {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center w-full h-full relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="absolute inset-0 noise-overlay opacity-10"></div>
      <motion.div
        className="w-40 h-40 rounded-[2.5rem] overflow-hidden shadow-[0_0_120px_rgba(99,102,241,0.8)] mb-8"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
      >
        <img src={`${import.meta.env.BASE_URL}assets/app-icon.jpeg`} alt="FocusFlow" className="w-full h-full object-cover" />
      </motion.div>
      <motion.h1 
        className="text-8xl font-display font-bold text-white tracking-tight mb-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        FocusFlow
      </motion.h1>
      <motion.p 
        className="text-3xl text-brand-400 font-medium tracking-wide uppercase"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        Block apps. On-device. No bypass.
      </motion.p>
      <motion.div
        className="flex gap-8 mt-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-brand-400">Free</div>
          <div className="text-sm text-white/40 mt-1">Always. No cost.</div>
        </div>
        <div className="w-px bg-white/10" />
        <div className="text-center">
          <div className="text-2xl font-bold text-white">Open Source</div>
          <div className="text-sm text-white/40 mt-1">github.com/TITANICBHAI/FocusFlow</div>
        </div>
        <div className="w-px bg-white/10" />
        <div className="text-center">
          <div className="text-2xl font-bold text-white">No bypass</div>
          <div className="text-sm text-white/40 mt-1">Works offline too</div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <motion.div 
      className="relative w-[340px] h-[680px] bg-dark-700 rounded-[45px] p-2 shadow-2xl border border-white/10"
      initial={{ y: 50, rotateX: 10 }}
      animate={{ y: 0, rotateX: 0 }}
      transition={{ duration: 1, type: "spring", bounce: 0.2 }}
    >
      <div className="absolute -left-[2px] top-32 w-[3px] h-12 bg-dark-600 rounded-l-md" />
      <div className="absolute -left-[2px] top-48 w-[3px] h-20 bg-dark-600 rounded-l-md" />
      <div className="absolute -right-[2px] top-40 w-[3px] h-16 bg-dark-600 rounded-r-md" />
      
      <div className="w-full h-full bg-black rounded-[38px] overflow-hidden relative">
        {/* Camera Punch Hole */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-dark-900 rounded-full z-50 border border-white/5" />
        
        {/* Screen Content */}
        {children}
        
        {/* Gloss overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none rounded-[38px]" />
      </div>
    </motion.div>
  )
}
