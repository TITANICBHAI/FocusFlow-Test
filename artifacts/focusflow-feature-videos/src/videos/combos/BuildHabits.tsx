import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { Fingerprint, Hourglass, Timer, Flame, Trophy } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

// Scene 1: Daily Allowance — configure per-app limits
function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1400)];
    return () => t.forEach(clearTimeout);
  }, []);
  const entries = [
    { emoji: '📱', app: 'Instagram', mode: 'Count', limit: '1 open/day', icon: Fingerprint, color: PRIMARY, used: 1, max: 1 },
    { emoji: '▶️', app: 'YouTube', mode: 'Time Budget', limit: '30 min/day', icon: Hourglass, color: AMBER, used: 22, max: 30 },
    { emoji: '🐦', app: 'Twitter', mode: 'Interval', limit: '5 min / 1 hr', icon: Timer, color: GREEN, used: 3, max: 5 },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Step 1 · Daily Allowance</p>
        <h2 className="text-5xl font-black text-white">Set budgets.<br /><span style={{ color: AMBER }}>Not total bans.</span></h2>
        <p style={{ color: MUTED, fontSize: 16 }}>Per-app usage limits that reset midnight-to-midnight.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 560 }}>
        {entries.map((e, i) => {
          const Icon = e.icon;
          return (
            <AnimatePresence mode="popLayout" key={e.app}>
              {phase >= 1 && (
                <motion.div key={e.app} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.16 }}
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 24 }}>{e.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <p style={{ color: TEXT, fontSize: 15, fontWeight: 700 }}>{e.app}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${e.color}18`, padding: '2px 8px', borderRadius: 6 }}>
                        <Icon size={11} color={e.color} />
                        <span style={{ color: e.color, fontSize: 11, fontWeight: 600 }}>{e.mode}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: BORDER, borderRadius: 3, marginBottom: 4 }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(e.used / e.max) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.16 + 0.3, ease: 'easeOut' }}
                        style={{ height: '100%', background: e.used >= e.max ? RED : e.color, borderRadius: 3 }} />
                    </div>
                    <p style={{ color: MUTED, fontSize: 11 }}>{e.limit}</p>
                  </div>
                  {e.used >= e.max && (
                    <span style={{ background: `${RED}22`, color: RED, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>LIMIT HIT</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>
    </motion.div>
  );
}

// Scene 2: Block Schedules — recurring time windows
function Scene2({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1400)];
    return () => t.forEach(clearTimeout);
  }, []);
  const schedules = [
    { name: 'Morning Focus', time: '8:00 AM – 12:00 PM', days: 'Mon–Fri', apps: 'Instagram, Twitter, TikTok', vpn: false },
    { name: 'Night Wind-down', time: '9:00 PM – 7:00 AM', days: 'Daily', apps: 'All social media', vpn: true },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Step 2 · Block Schedules</p>
        <h2 className="text-5xl font-black text-white">Recurring blocks.<br /><span style={{ color: PRIMARY }}>Set once, runs forever.</span></h2>
        <p style={{ color: MUTED, fontSize: 16 }}>Side Menu → Block Enforcement → Block Schedules</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 580 }}>
        {schedules.map((s, i) => (
          <AnimatePresence mode="popLayout" key={s.name}>
            {phase >= 1 && (
              <motion.div key={s.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                style={{ background: CARD, border: `1px solid ${PRIMARY}33`, borderRadius: 16, padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{s.name}</p>
                    <p style={{ color: PRIMARY, fontSize: 14, fontWeight: 600 }}>{s.time}</p>
                  </div>
                  <span style={{ background: `${GREEN}22`, color: GREEN, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 999, alignSelf: 'flex-start' }}>ENABLED</span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <p style={{ color: MUTED, fontSize: 12 }}>📅 {s.days}</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>🚫 {s.apps}</p>
                  {s.vpn && <p style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600 }}>📶 VPN enabled</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </motion.div>
  );
}

// Scene 3: Stats Week — improving trend
function Scene3({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 300), setTimeout(() => setPhase(2), 1300)];
    return () => t.forEach(clearTimeout);
  }, []);
  const weekData = [
    { day: 'Mon', focus: 45, completed: 2, total: 4 },
    { day: 'Tue', focus: 60, completed: 3, total: 4 },
    { day: 'Wed', focus: 90, completed: 4, total: 5 },
    { day: 'Thu', focus: 75, completed: 4, total: 5 },
    { day: 'Fri', focus: 120, completed: 5, total: 6 },
    { day: 'Sat', focus: 45, completed: 2, total: 3 },
    { day: 'Sun', focus: 30, completed: 1, total: 2 },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Step 3 · Stats → Week</p>
        <h2 className="text-5xl font-black text-white">Watch the trend climb.</h2>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '24px 28px', width: 640 }}>
            <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>FOCUS MINUTES · WEEK</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 140 }}>
              {weekData.map((d, i) => (
                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <p style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>{d.focus}m</p>
                  <motion.div initial={{ height: 0 }} animate={{ height: (d.focus / 120) * 100 }}
                    transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                    style={{ width: '100%', background: i === 4 ? PRIMARY : `${PRIMARY}55`, borderRadius: 6 }} />
                  <p style={{ color: MUTED, fontSize: 11 }}>{d.day}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
              <p style={{ color: MUTED, fontSize: 13 }}>Total: <span style={{ color: PRIMARY, fontWeight: 700 }}>465 min</span></p>
              <p style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>↑ 34% vs last week</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Scene 4: Stats All Time — heatmap + streak
function Scene4({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 300), setTimeout(() => setPhase(2), 1200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const weeks = Array.from({ length: 12 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const progress = (wi * 7 + di) / 84;
      return progress < 0.92 ? Math.min(1, progress * 0.5 + Math.random() * 0.5) : 0;
    })
  );
  const rateColor = (r: number) => {
    if (r === 0) return BORDER;
    if (r < 0.25) return `${PRIMARY}30`;
    if (r < 0.5) return `${PRIMARY}60`;
    if (r < 0.75) return `${PRIMARY}90`;
    return PRIMARY;
  };
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Stats → All Time</p>
        <h2 className="text-5xl font-black text-white">Habits compound.</h2>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <AnimatePresence mode="popLayout">
          {phase >= 1 && (
            <motion.div key="heatmap" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px' }}>
              <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>12-WEEK HEATMAP</p>
              <div style={{ display: 'flex', gap: 3 }}>
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {week.map((rate, di) => (
                      <motion.div key={di} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: (wi * 7 + di) * 0.004 }}
                        style={{ width: 16, height: 16, borderRadius: 3, background: rateColor(rate) }} />
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {phase >= 2 && (
            <motion.div key="stats" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Current streak', value: '21 days', icon: Flame, color: AMBER },
                { label: 'Best streak', value: '21 days', icon: Trophy, color: PRIMARY },
                { label: 'Total focus', value: '312 hrs', color: GREEN, icon: null },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} style={{ background: CARD, border: `1px solid ${s.color}33`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
                    {Icon && <Icon size={22} color={s.color} />}
                    <div>
                      <p style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</p>
                      <p style={{ color: MUTED, fontSize: 12 }}>{s.label}</p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Scene 5: Achievement celebration — streak milestone
function Scene5() {
  const [phase, setPhase] = useState(0);
  const [confetti] = useState(() => Array.from({ length: 30 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 0.8,
    color: [PRIMARY, AMBER, GREEN, RED, '#ec4899'][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 8,
  })));
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 300), setTimeout(() => setPhase(2), 1200)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      {phase >= 1 && confetti.map(c => (
        <motion.div key={c.id}
          initial={{ opacity: 1, y: -20, x: `${c.x}vw`, rotate: 0 }}
          animate={{ opacity: 0, y: '110vh', rotate: 720 }}
          transition={{ delay: c.delay, duration: 2 + Math.random(), ease: 'linear' }}
          style={{ position: 'absolute', top: 0, width: c.size, height: c.size, background: c.color, borderRadius: 2 }} />
      ))}
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', tension: 60, friction: 8 }}
        style={{ width: 120, height: 120, borderRadius: 60, background: `${AMBER}18`, border: `2px solid ${AMBER}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Trophy size={56} color={AMBER} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="text-center flex flex-col gap-4">
        <h1 className="text-7xl font-black text-white">21-Day Streak! 🔥</h1>
        <p className="text-2xl" style={{ color: MUTED }}>Daily Allowance → Block Schedules → Stats<br />Three features. One consistent habit.</p>
      </motion.div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="badges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: 12 }}>
            {['7 days 🔥', '14 days ⭐', '21 days 🏆'].map(b => (
              <motion.span key={b} initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                style={{ background: `${AMBER}18`, border: `1.5px solid ${AMBER}55`, color: AMBER, fontSize: 14, fontWeight: 800, padding: '8px 18px', borderRadius: 999 }}>
                {b}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BuildHabits() {
  const { currentScene } = useVideoPlayer(5, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #0a1a0a 0%, transparent 60%)' }} />
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
