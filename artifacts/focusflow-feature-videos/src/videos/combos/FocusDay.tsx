import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { ShieldCheck, Ban, Flame, CheckCircle2 } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

// Scene 1: Schedule tab — tasks for the day
function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 2500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const tasks = [
    { title: 'Deep Work', time: '9:00 – 11:00 AM', color: PRIMARY, focus: true, status: 'active' },
    { title: 'Email Review', time: '11:00 – 11:30 AM', color: AMBER, focus: false, status: 'completed' },
    { title: 'Project Planning', time: '1:00 – 2:30 PM', color: GREEN, focus: true, status: 'scheduled' },
    { title: 'Code Review', time: '3:00 – 4:00 PM', color: '#8b5cf6', focus: false, status: 'scheduled' },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10" {...sceneTransitions.scaleFade}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '16px 24px', width: 520 }}>
        <p style={{ color: TEXT, fontSize: 22, fontWeight: 700 }}>Wednesday, May 12</p>
        <p style={{ color: MUTED, fontSize: 14 }}>1 / 4 tasks done</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && tasks.map((task, i) => (
          <motion.div key={task.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            style={{
              background: task.status === 'active' ? `${PRIMARY}12` : CARD,
              border: `1px solid ${task.status === 'active' ? `${PRIMARY}55` : BORDER}`,
              borderRadius: 12, padding: '12px 16px', width: 520,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <div style={{ width: 4, height: 36, background: task.color, borderRadius: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <p style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>{task.title}</p>
                {task.focus && <span style={{ background: `${PRIMARY}22`, color: PRIMARY, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>FOCUS</span>}
              </div>
              <p style={{ color: MUTED, fontSize: 12 }}>{task.time}</p>
            </div>
            {task.status === 'active' && <span style={{ background: `${GREEN}22`, color: GREEN, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>NOW</span>}
            {task.status === 'completed' && <CheckCircle2 size={18} color={GREEN} />}
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: PRIMARY, fontSize: 18, fontWeight: 600 }}>
            Tap Focus tab → activate Focus Mode on "Deep Work"
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Scene 2: Focus tab — ring running, focus active
function Scene2({ }: { currentScene: number }) {
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 700), setTimeout(() => setPhase(2), 1700)];
    const id = setInterval(() => setSeconds(s => Math.min(s + 1, 60)), 60);
    return () => { t.forEach(clearTimeout); clearInterval(id); };
  }, []);
  const totalSecs = 2 * 60 * 60;
  const remaining = totalSecs - seconds;
  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const progress = seconds / totalSecs;
  const r = 110; const circ = 2 * Math.PI * r;
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Focus Tab · Task Focus active</p>
      <div style={{ position: 'relative', width: 260, height: 260 }}>
        <svg width="260" height="260" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="130" cy="130" r={r} fill="none" stroke={BORDER} strokeWidth={10} />
          <circle cx="130" cy="130" r={r} fill="none" stroke={PRIMARY} strokeWidth={10}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
            strokeLinecap="round" transform="rotate(-90 130 130)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <p style={{ color: TEXT, fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{hrs}:{mins.toString().padStart(2, '0')}</p>
          <p style={{ color: MUTED, fontSize: 13 }}>remaining</p>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 22, fontWeight: 700 }}>Deep Work</p>
        <p style={{ color: PRIMARY, fontSize: 14 }}>Focus Mode active</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="guard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <ShieldCheck size={16} color={GREEN} />
            <p style={{ color: TEXT, fontSize: 13 }}>Blocking all apps except: <span style={{ color: GREEN }}>Phone, Maps</span></p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="pomo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}33`, borderRadius: 10, padding: '8px 20px' }}>
            <p style={{ color: PRIMARY, fontSize: 13, fontWeight: 600 }}>🍅 Pomodoro: 25 min · 5 min break · running</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Scene 3: Try to open Instagram → block overlay
function Scene3({ }: { currentScene: number }) {
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setShake(true), 200), setTimeout(() => setPhase(1), 900), setTimeout(() => setPhase(2), 1800)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center gap-20 z-10" {...sceneTransitions.scaleFade}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: MUTED, fontSize: 18, marginBottom: 12 }}>Temptation strikes…</p>
        <p style={{ fontSize: 56 }}>📱</p>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>Opens Instagram</p>
      </div>
      <motion.div
        animate={shake ? { x: [0, 12, -10, 8, -6, 0] } : {}}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{ width: 360, background: '#1a0505', border: `1.5px solid ${RED}55`, borderRadius: 24, padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 90, height: 90, borderRadius: 45, background: `${RED}18`, border: `2px solid ${RED}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ban size={44} color={RED} />
        </div>
        <p style={{ color: RED, fontSize: 11, fontWeight: 800, letterSpacing: 3 }}>APP BLOCKED</p>
        <p style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>Instagram</p>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
          This app is blocked while focus mode or a block schedule is active.
        </p>
        <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
        <AnimatePresence mode="popLayout">
          {phase >= 1 && (
            <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={PRIMARY} />
              <span style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>FocusFlow is protecting your focus</span>
            </motion.div>
          )}
        </AnimatePresence>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>This will dismiss automatically</p>
      </motion.div>
    </motion.div>
  );
}

// Scene 4: Active screen — live dashboard
function Scene4({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1300), setTimeout(() => setPhase(3), 2200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const layers = [
    { label: 'System Protection', on: true, icon: '🔒' },
    { label: 'YouTube Shorts Block', on: true, icon: '▶️' },
    { label: 'Keyword Blocker', on: true, icon: '📝', count: 8 },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Active Screen · Live dashboard</p>
        <h2 className="text-5xl font-black text-white">Everything running right now</h2>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280 }}>
          <div style={{ background: `${PRIMARY}18`, border: `1.5px solid ${PRIMARY}44`, borderRadius: 14, padding: '16px 18px' }}>
            <p style={{ color: PRIMARY, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>FOCUS SESSION</p>
            <p style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>Deep Work</p>
            <p style={{ color: MUTED, fontSize: 13 }}>1h 47m remaining</p>
          </div>
          <AnimatePresence mode="popLayout">
            {phase >= 1 && (
              <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>TODAY'S STATS</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: PRIMARY, fontSize: 24, fontWeight: 800 }}>73</p>
                    <p style={{ color: MUTED, fontSize: 11 }}>focus min</p>
                  </div>
                  <div>
                    <p style={{ color: RED, fontSize: 24, fontWeight: 800 }}>23</p>
                    <p style={{ color: MUTED, fontSize: 11 }}>blocked</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="popLayout">
          {phase >= 2 && (
            <motion.div key="layers" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px', width: 280 }}>
              <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>ENFORCEMENT LAYERS</p>
              {layers.map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 16 }}>{l.icon}</span>
                  <p style={{ color: TEXT, fontSize: 13, flex: 1 }}>{l.label}</p>
                  <span style={{ background: `${GREEN}22`, color: GREEN, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>ON</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Scene 5: Stats Yesterday — task review
function Scene5() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1200)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Stats → Yesterday's digest</p>
        <h2 className="text-5xl font-black text-white">Your day, reviewed.</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 580 }}>
        {[
          { title: 'Deep Work', scheduled: 120, actual: 118, timing: 'on-time', status: 'completed' },
          { title: 'Email Review', scheduled: 30, actual: 38, timing: 'extended', status: 'completed' },
          { title: 'Project Planning', scheduled: 90, actual: 0, timing: null, status: 'skipped' },
        ].map((task, i) => (
          <AnimatePresence mode="popLayout" key={task.title}>
            {phase >= 1 && (
              <motion.div key={task.title} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {task.status === 'completed' ? <CheckCircle2 size={20} color={GREEN} /> : <span style={{ color: MUTED, fontSize: 18 }}>✗</span>}
                <div style={{ flex: 1 }}>
                  <p style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{task.title}</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>{task.scheduled} min scheduled{task.actual > 0 ? ` · ${task.actual} min actual` : ' · skipped'}</p>
                </div>
                {task.timing && (
                  <span style={{ color: task.timing === 'on-time' ? GREEN : AMBER, fontSize: 12, fontWeight: 700, background: task.timing === 'on-time' ? `${GREEN}18` : `${AMBER}18`, padding: '2px 10px', borderRadius: 999 }}>
                    {task.timing}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
        <AnimatePresence mode="popLayout">
          {phase >= 2 && (
            <motion.div key="streak" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
              <div style={{ background: `${AMBER}18`, border: `1px solid ${AMBER}44`, borderRadius: 12, padding: '14px 24px', textAlign: 'center' }}>
                <Flame size={24} color={AMBER} style={{ margin: '0 auto 6px' }} />
                <p style={{ color: AMBER, fontSize: 22, fontWeight: 800 }}>12</p>
                <p style={{ color: MUTED, fontSize: 11 }}>day streak</p>
              </div>
              <div style={{ background: `${RED}18`, border: `1px solid ${RED}44`, borderRadius: 12, padding: '14px 24px', textAlign: 'center' }}>
                <Ban size={24} color={RED} style={{ margin: '0 auto 6px' }} />
                <p style={{ color: RED, fontSize: 22, fontWeight: 800 }}>47</p>
                <p style={{ color: MUTED, fontSize: 11 }}>distractions blocked</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function FocusDay() {
  const { currentScene } = useVideoPlayer(5, 7000);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 40% 30%, #1a1a2e 0%, transparent 55%), radial-gradient(ellipse at 60% 70%, #0a1a0a 0%, transparent 55%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" currentScene={currentScene} />}
        {currentScene === 3 && <Scene4 key="s4" currentScene={currentScene} />}
        {currentScene === 4 && <Scene5 key="s5" />}
      </AnimatePresence>
    </div>
  );
}
