import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { ShieldCheck, Pause } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';
const AMBER = '#f59e0b';

function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1400), setTimeout(() => setPhase(3), 2400)];
    return () => t.forEach(clearTimeout);
  }, []);
  const tasks = [
    { title: 'Deep Work', time: '9:00 – 11:00 AM', color: PRIMARY, focus: true, status: 'active' },
    { title: 'Email Review', time: '11:00 – 11:30 AM', color: AMBER, focus: false, status: 'scheduled' },
    { title: 'Project Planning', time: '1:00 – 2:30 PM', color: GREEN, focus: true, status: 'scheduled' },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <motion.div animate={phase >= 2 ? { y: -40 } : { y: 0 }} transition={{ duration: 0.8, ease: 'circOut' }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '16px 24px', marginBottom: 16, width: 480 }}>
          <p style={{ color: TEXT, fontSize: 20, fontWeight: 700 }}>Wednesday, May 12</p>
          <p style={{ color: MUTED, fontSize: 13 }}>2 / 3 tasks done</p>
        </div>
        <AnimatePresence mode="popLayout">
          {phase >= 2 && tasks.map((task, i) => (
            <motion.div key={task.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              style={{
                background: task.status === 'active' ? `${PRIMARY}18` : CARD,
                border: `1px solid ${task.status === 'active' ? `${PRIMARY}55` : BORDER}`,
                borderRadius: 12, padding: '12px 16px', marginBottom: 8, width: 480,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              <div style={{ width: 4, height: 36, background: task.color, borderRadius: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>{task.title}</p>
                  {task.focus && (
                    <span style={{ background: `${PRIMARY}22`, color: PRIMARY, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>FOCUS</span>
                  )}
                </div>
                <p style={{ color: MUTED, fontSize: 12 }}>{task.time}</p>
              </div>
              {task.status === 'active' && (
                <span style={{ background: `${GREEN}22`, color: GREEN, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>NOW</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl font-semibold" style={{ color: PRIMARY }}>
            Tap Focus tab → activate Focus Mode for any task
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 600), setTimeout(() => setPhase(2), 1600)];
    const id = setInterval(() => setSeconds(s => Math.min(s + 1, 47 * 60 + 23)), 30);
    return () => { t.forEach(clearTimeout); clearInterval(id); };
  }, []);
  const mins = 47 - Math.floor(seconds / 60);
  const secs = 23 - (seconds % 60);
  const displayMins = Math.max(0, mins).toString().padStart(2, '0');
  const displaySecs = Math.max(0, secs < 0 ? 59 + secs : secs).toString().padStart(2, '0');
  const progress = seconds / (47 * 60 + 23);
  const r = 110; const circ = 2 * Math.PI * r;

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <p style={{ color: MUTED, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Focus Tab · Task Focus</p>
      <div style={{ position: 'relative', width: 260, height: 260 }}>
        <svg width="260" height="260" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="130" cy="130" r={r} fill="none" stroke={BORDER} strokeWidth={10} />
          <circle cx="130" cy="130" r={r} fill="none" stroke={PRIMARY} strokeWidth={10}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
            strokeLinecap="round" transform="rotate(-90 130 130)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <p style={{ color: TEXT, fontSize: 48, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{displayMins}:{displaySecs}</p>
          <p style={{ color: MUTED, fontSize: 13 }}>remaining</p>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 24, fontWeight: 700 }}>Deep Work</p>
        <p style={{ color: PRIMARY, fontSize: 14 }}>Focus Mode active · Distraction apps blocked</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="allowed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <ShieldCheck size={16} color={PRIMARY} />
            <p style={{ color: TEXT, fontSize: 13 }}>Allowed in Focus: <span style={{ color: GREEN }}>Phone, Maps</span></p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="pomo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}33`, borderRadius: 12, padding: '10px 24px' }}>
            <p style={{ color: PRIMARY, fontSize: 14, fontWeight: 600 }}>🍅 Pomodoro: 25 min focus · 5 min break</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene3({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1200), setTimeout(() => setPhase(3), 2200)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <h2 className="text-5xl font-black text-white text-center">Try opening Instagram<br /><span style={{ color: RED }}>during Focus Mode…</span></h2>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="overlay"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', tension: 80, friction: 8 }}
            style={{
              width: 360, background: '#1a0505', border: `1.5px solid ${RED}55`,
              borderRadius: 24, padding: '32px 28px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 12,
            }}>
            <motion.div
              animate={{ x: [0, 10, -8, 6, -4, 0] }}
              transition={{ delay: 0.4, duration: 0.5 }}
              style={{ width: 90, height: 90, borderRadius: 45, background: `${RED}18`, border: `2px solid ${RED}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 44 }}>🚫</span>
            </motion.div>
            <p style={{ color: RED, fontSize: 11, fontWeight: 800, letterSpacing: 3 }}>APP BLOCKED</p>
            <p style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>Instagram</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
              This app is blocked while focus mode or a block schedule is active.
            </p>
            <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={PRIMARY} />
              <span style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>FocusFlow is protecting your focus</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>This will dismiss automatically</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl" style={{ color: PRIMARY }}>
            No bypass. No override. Just focus.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene4() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 600), setTimeout(() => setPhase(2), 1400), setTimeout(() => setPhase(3), 2200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const stats = [
    { label: 'Focus minutes today', value: '127', color: PRIMARY },
    { label: 'Distractions blocked', value: '23', color: RED },
    { label: 'Current streak', value: '12 days', color: AMBER },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10" {...sceneTransitions.scaleFade}>
      <h1 className="text-7xl font-black text-white text-center leading-tight">Task Focus.<br /><span style={{ color: PRIMARY }}>Real Focus.</span></h1>
      <div style={{ display: 'flex', gap: 20 }}>
        {stats.map((s, i) => (
          <AnimatePresence mode="popLayout" key={s.label}>
            {phase >= 1 && (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px 28px', textAlign: 'center', minWidth: 160 }}>
                <p style={{ color: s.color, fontSize: 36, fontWeight: 900 }}>{s.value}</p>
                <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{s.label}</p>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.div key="btn" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: PRIMARY, borderRadius: 14, padding: '14px 40px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Pause size={20} color="#fff" />
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Stop Focus · requires session password</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FocusSessions() {
  const { currentScene } = useVideoPlayer(4, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, transparent 60%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" currentScene={currentScene} />}
        {currentScene === 3 && <Scene4 key="s4" />}
      </AnimatePresence>
    </div>
  );
}
