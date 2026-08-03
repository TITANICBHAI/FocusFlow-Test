import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { Ban, ShieldCheck } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 200, height: 400, background: '#0d0d0d',
      borderRadius: 32, border: '2px solid #374151',
      boxShadow: '0 32px 64px rgba(0,0,0,0.8)', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 50, height: 5, background: '#2d3748', borderRadius: 3 }} />
      <div style={{ paddingTop: 28, height: '100%' }}>{children}</div>
    </div>
  );
}

function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 600), setTimeout(() => setPhase(2), 1600), setTimeout(() => setPhase(3), 2800)];
    return () => t.forEach(clearTimeout);
  }, []);
  const apps = ['Instagram', 'YouTube', 'TikTok', 'Twitter', 'Reddit'];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10" {...sceneTransitions.scaleFade}>
      <motion.div className="text-center flex flex-col gap-4" animate={phase >= 2 ? { y: -50 } : { y: 0 }} transition={{ duration: 0.8, ease: 'circOut' }}>
        <h1 className="text-6xl font-black text-white leading-tight">Apps that steal your<br /><span style={{ color: RED }}>focus</span></h1>
        <p className="text-2xl" style={{ color: MUTED }}>are on your phone right now.</p>
      </motion.div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="apps" className="flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {apps.map((app, i) => (
              <motion.div key={app} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 18px' }}>
                <span style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>{app}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="cta" className="text-2xl font-semibold" style={{ color: PRIMARY }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            FocusFlow blocks them all.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setShake(true), 200), setTimeout(() => setPhase(1), 800), setTimeout(() => setPhase(2), 1700)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center gap-20 z-10" {...sceneTransitions.scaleFade}>
      <div className="flex flex-col gap-4 items-center">
        <p className="text-2xl font-bold" style={{ color: MUTED }}>User opens Instagram…</p>
        <motion.div style={{ fontSize: 56 }}>📱</motion.div>
        <motion.p className="text-xl font-semibold" style={{ color: RED }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          Instantly intercepted
        </motion.p>
      </div>
      <PhoneMockup>
        <motion.div
          animate={shake ? { x: [0, 12, -10, 8, -6, 0] } : {}}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 16px' }}>
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', tension: 80, friction: 8 }}
            style={{ width: 70, height: 70, borderRadius: 35, background: `${RED}18`, border: `2px solid ${RED}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ban size={32} color={RED} />
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: RED, fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>APP BLOCKED</motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ color: '#fff', fontSize: 18, fontWeight: 800, textAlign: 'center' }}>Instagram</motion.p>
          <AnimatePresence mode="popLayout">
            {phase >= 1 && (
              <motion.p key="desc" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
                This app is blocked while focus mode or a block schedule is active.
              </motion.p>
            )}
          </AnimatePresence>
          <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
          <AnimatePresence mode="popLayout">
            {phase >= 2 && (
              <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={12} color={PRIMARY} />
                <span style={{ color: PRIMARY, fontSize: 10, fontWeight: 600 }}>FocusFlow is protecting your focus</span>
              </motion.div>
            )}
          </AnimatePresence>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>This will dismiss automatically</p>
        </motion.div>
      </PhoneMockup>
    </motion.div>
  );
}

function Scene3({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const items = [
    { emoji: '🚫', label: 'Standalone Block', sub: 'Block now for any duration' },
    { emoji: '🛡️', label: 'Task Focus', sub: 'Focus Mode tied to your task' },
    { emoji: '☀️', label: 'Daily Allowance', sub: '3 apps configured', badge: 'ACTIVE' },
    { emoji: '⏰', label: 'Block Schedules', sub: 'Block apps during set hours' },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>BLOCK CONTROLS</p>
        <h2 className="text-5xl font-black text-white">Multiple ways to block</h2>
        <p className="text-xl" style={{ color: MUTED }}>Swipe right or tap › to open the quick menu</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 500 }}>
        {items.map((item, i) => (
          <AnimatePresence mode="popLayout" key={item.label}>
            {phase >= 1 && (
              <motion.div key={item.label}
                initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${PRIMARY}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{item.label}</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>{item.sub}</p>
                </div>
                {item.badge && (
                  <span style={{ background: `${RED}22`, color: RED, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: 1 }}>{item.badge}</span>
                )}
                <span style={{ color: BORDER }}>›</span>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </motion.div>
  );
}

function Scene4() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let n = 0; const id = setInterval(() => { n++; setCount(n); if (n >= 47) clearInterval(id); }, 45);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.8 }}
        style={{ width: 130, height: 130, borderRadius: 65, background: `${PRIMARY}18`, border: `2px solid ${PRIMARY}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShieldCheck size={60} color={PRIMARY} />
      </motion.div>
      <h1 className="text-7xl font-black text-white text-center leading-tight">Zero bypass.<br />Zero exceptions.</h1>
      <div className="flex items-end gap-4">
        <span style={{ fontSize: 80, fontWeight: 900, color: PRIMARY, lineHeight: 1 }}>{count}</span>
        <span className="text-3xl font-bold mb-3" style={{ color: MUTED }}>apps blocked today</span>
      </div>
      <p className="text-lg" style={{ color: MUTED }}>Accessibility Service · Standalone Block · Block Schedules</p>
    </motion.div>
  );
}

export default function AppBlocking() {
  const { currentScene } = useVideoPlayer(4, 7000);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 25% 50%, #1a0505 0%, transparent 55%), radial-gradient(ellipse at 75% 50%, #05050f 0%, transparent 55%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" currentScene={currentScene} />}
        {currentScene === 3 && <Scene4 key="s4" />}
      </AnimatePresence>
    </div>
  );
}
