import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { Fingerprint, Hourglass, Timer, Ban } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 2600)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-4">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Side Menu → Daily Allowance</p>
        <h1 className="text-6xl font-black text-white">Per-app usage limits.<br /><span style={{ color: AMBER }}>You set the rules.</span></h1>
        <p className="text-2xl" style={{ color: MUTED }}>Not a blanket ban — a budget.</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="concept" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: 20 }}>
            {[
              { emoji: '📱', app: 'Instagram', limit: '1 open/day', used: 1, max: 1 },
              { emoji: '▶️', app: 'YouTube', limit: '30 min/day', used: 22, max: 30 },
              { emoji: '🐦', app: 'Twitter', limit: '5 min/hr', used: 3, max: 5 },
            ].map((item) => (
              <motion.div key={item.app} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px', width: 150, textAlign: 'center' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>{item.emoji}</p>
                <p style={{ color: TEXT, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.app}</p>
                <div style={{ height: 6, background: BORDER, borderRadius: 3, marginBottom: 6 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(item.used / item.max) * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    style={{ height: '100%', background: item.used >= item.max ? RED : AMBER, borderRadius: 3 }} />
                </div>
                <p style={{ color: item.used >= item.max ? RED : MUTED, fontSize: 11 }}>{item.limit}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl" style={{ color: PRIMARY }}>
            Runs midnight-to-midnight. Auto-resets daily.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1200), setTimeout(() => setPhase(3), 2200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const modes = [
    { icon: Fingerprint, label: 'Count', sub: '1 open/day', desc: 'Max N opens per day', color: PRIMARY },
    { icon: Hourglass, label: 'Time Budget', sub: '30 min/day', desc: 'Total minutes allowed', color: AMBER },
    { icon: Timer, label: 'Interval', sub: '5 min every 1 hr', desc: 'Rolling time window', color: GREEN },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-5xl font-black text-white">Three allowance modes</h2>
        <p style={{ color: MUTED, fontSize: 18 }}>Pick the right limit for each app</p>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {modes.map((mode, i) => {
          const Icon = mode.icon;
          return (
            <AnimatePresence mode="popLayout" key={mode.label}>
              {phase >= 1 && (
                <motion.div key={mode.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.18 }}
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '28px 24px', width: 200, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 26, background: `${mode.color}18`, border: `1.5px solid ${mode.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={24} color={mode.color} />
                  </div>
                  <p style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{mode.label}</p>
                  <p style={{ color: mode.color, fontSize: 20, fontWeight: 800 }}>{mode.sub}</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>{mode.desc}</p>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: MUTED, fontSize: 16 }}>
            Each app gets its own mode and limit. Defense PIN protects changes.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene3({ }: { currentScene: number }) {
  const [usagePercent, setUsagePercent] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    setTimeout(() => setPhase(1), 300);
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / 3000) * 100);
      setUsagePercent(p);
      if (p >= 100) { clearInterval(id); setTimeout(() => setBlocked(true), 400); }
    }, 50);
    return () => clearInterval(id);
  }, []);
  const minUsed = Math.round((usagePercent / 100) * 30);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <h2 className="text-5xl font-black text-white text-center">Watch the limit drain…<br /><span style={{ color: RED }}>then auto-block.</span></h2>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '28px 32px', width: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 32 }}>▶️</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>YouTube</p>
            <p style={{ color: MUTED, fontSize: 13 }}>Time Budget · 30 min/day</p>
          </div>
          <AnimatePresence mode="popLayout">
            {blocked && (
              <motion.div key="badge" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <Ban size={24} color={RED} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div style={{ height: 10, background: BORDER, borderRadius: 5, marginBottom: 10 }}>
          <motion.div style={{ height: '100%', background: usagePercent >= 100 ? RED : AMBER, borderRadius: 5, width: `${usagePercent}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ color: usagePercent >= 100 ? RED : MUTED, fontSize: 14, fontWeight: 600 }}>
            {minUsed} min used
          </p>
          <p style={{ color: MUTED, fontSize: 14 }}>30 min limit</p>
        </div>
        <AnimatePresence mode="popLayout">
          {blocked && (
            <motion.div key="blocked" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 16, background: `${RED}18`, border: `1px solid ${RED}44`, borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
              <p style={{ color: RED, fontSize: 14, fontWeight: 700 }}>Daily limit reached · App blocked until midnight</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function DailyAllowance() {
  const { currentScene } = useVideoPlayer(3, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1c1a0a 0%, transparent 60%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" currentScene={currentScene} />}
      </AnimatePresence>
    </div>
  );
}
