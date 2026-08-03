import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { Flame, Trophy } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

type Filter = 'yesterday' | 'today' | 'week' | 'alltime';

function TabBar({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const tabs: { key: Filter; label: string }[] = [
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'alltime', label: 'All Time' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, background: CARD, borderRadius: 12, padding: 4, border: `1px solid ${BORDER}` }}>
      {tabs.map(t => (
        <motion.button key={t.key} onClick={() => onChange(t.key)}
          animate={{ background: active === t.key ? PRIMARY : 'transparent', color: active === t.key ? '#fff' : MUTED }}
          style={{ borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          {t.label}
        </motion.button>
      ))}
    </div>
  );
}

function YesterdayView({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { if (active) { const t = setTimeout(() => setPhase(1), 400); return () => clearTimeout(t); } }, [active]);
  const tasks = [
    { title: 'Deep Work', scheduled: 120, actual: 118, timing: 'on-time', status: 'completed' },
    { title: 'Email Review', scheduled: 30, actual: 38, timing: 'extended', status: 'completed' },
    { title: 'Project Planning', scheduled: 90, actual: 0, timing: null, status: 'skipped' },
  ];
  const timingColor = (t: string | null) => t === 'on-time' ? GREEN : t === 'extended' ? AMBER : MUTED;
  const statusIcon = (s: string) => s === 'completed' ? '✓' : s === 'skipped' ? '✗' : '○';
  const statusColor = (s: string) => s === 'completed' ? GREEN : s === 'skipped' ? MUTED : AMBER;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 620 }}>
      <div style={{ background: `${RED}18`, border: `1px solid ${RED}44`, borderRadius: 12, padding: '12px 18px', display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>Yesterday's digest</p>
        <p style={{ color: RED, fontSize: 14, fontWeight: 700 }}>23 distractions blocked</p>
      </div>
      {tasks.map((task, i) => (
        <AnimatePresence mode="popLayout" key={task.title}>
          {phase >= 1 && (
            <motion.div key={task.title} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.14 }}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: statusColor(task.status), fontSize: 18, fontWeight: 800 }}>{statusIcon(task.status)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{task.title}</p>
                <p style={{ color: MUTED, fontSize: 12 }}>{task.scheduled} min scheduled · {task.actual > 0 ? `${task.actual} min actual` : 'skipped'}</p>
              </div>
              {task.timing && (
                <span style={{ color: timingColor(task.timing), fontSize: 12, fontWeight: 700, background: `${timingColor(task.timing)}18`, padding: '2px 10px', borderRadius: 999 }}>
                  {task.timing}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      ))}
    </div>
  );
}

function TodayView({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { if (active) { const t = setTimeout(() => setPhase(1), 300); return () => clearTimeout(t); } }, [active]);
  const [focusMin, setFocusMin] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFocusMin(n => Math.min(n + 3, 127)), 40);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 600 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Focus minutes', value: focusMin, suffix: 'min', color: PRIMARY },
          { label: 'Distractions blocked', value: 23, suffix: '', color: RED },
          { label: 'Current streak', value: 12, suffix: ' days', color: AMBER },
        ].map(s => (
          <motion.div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px 24px', flex: 1, textAlign: 'center' }}>
            <p style={{ color: s.color, fontSize: 38, fontWeight: 900 }}>{s.value}{s.suffix}</p>
            <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{s.label}</p>
          </motion.div>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="tasks" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px' }}>
            <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>TODAY'S TASKS</p>
            <div style={{ height: 8, background: BORDER, borderRadius: 4 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: '67%' }} transition={{ duration: 1, ease: 'easeOut' }}
                style={{ height: '100%', background: GREEN, borderRadius: 4 }} />
            </div>
            <p style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>4 / 6 tasks completed</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AllTimeView({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { if (active) { const t = setTimeout(() => setPhase(1), 300); return () => clearTimeout(t); } }, [active]);
  const weeks = Array.from({ length: 12 }, (_, i) => Array.from({ length: 7 }, (_, j) => {
    const v = Math.random();
    return i < 10 || (i === 10 && j < 5) ? v : 0;
  }));
  const rateColor = (r: number) => {
    if (r === 0) return BORDER;
    if (r < 0.3) return `${PRIMARY}40`;
    if (r < 0.6) return `${PRIMARY}80`;
    return PRIMARY;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 680, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 16, width: '100%' }}>
        {[
          { label: 'Total focus hours', value: '312', color: PRIMARY, icon: '⏱' },
          { label: 'Total sessions', value: '248', color: GREEN, icon: '🎯' },
          { label: 'Best streak', value: '21 days', color: AMBER, icon: '🔥' },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px', flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</p>
            <p style={{ color: s.color, fontSize: 28, fontWeight: 900 }}>{s.value}</p>
            <p style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>{s.label}</p>
          </div>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="heatmap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px', width: '100%' }}>
            <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>12-WEEK COMPLETION HEATMAP</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {week.map((rate, di) => (
                    <motion.div key={di} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: (wi * 7 + di) * 0.004 }}
                      style={{ width: 18, height: 18, borderRadius: 4, background: rateColor(rate) }} />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="badges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            style={{ display: 'flex', gap: 10 }}>
            {['7 days 🔥', '14 days ⭐', '21 days 🏆'].map(b => (
              <span key={b} style={{ background: `${AMBER}18`, border: `1px solid ${AMBER}44`, color: AMBER, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999 }}>{b}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StatsAnalytics() {
  const { currentScene } = useVideoPlayer(4, 8000);
  const [activeTab, setActiveTab] = useState<Filter>('yesterday');
  useEffect(() => {
    const tabs: Filter[] = ['yesterday', 'today', 'week', 'alltime'];
    setActiveTab(tabs[currentScene] ?? 'yesterday');
  }, [currentScene]);
  return (
    <div className="w-full h-screen relative overflow-hidden flex flex-col items-center justify-center gap-8" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a1a0a 0%, transparent 60%)' }} />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-center">
          <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Stats Screen</p>
          <TabBar active={activeTab} onChange={setActiveTab} />
        </div>
        <AnimatePresence mode="popLayout">
          {activeTab === 'yesterday' && <motion.div key="y" {...sceneTransitions.scaleFade}><YesterdayView active={activeTab === 'yesterday'} /></motion.div>}
          {activeTab === 'today' && <motion.div key="t" {...sceneTransitions.scaleFade}><TodayView active={activeTab === 'today'} /></motion.div>}
          {activeTab === 'week' && (
            <motion.div key="w" {...sceneTransitions.scaleFade} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 620 }}>
              <p style={{ color: TEXT, fontSize: 20, fontWeight: 700, textAlign: 'center' }}>Week · Task productivity trend</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px' }}>
                {['M','T','W','T','F','S','S'].map((d, i) => {
                  const h = [60, 90, 127, 45, 110, 30, 75][i];
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <motion.div initial={{ height: 0 }} animate={{ height: (h / 130) * 100 }}
                        transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                        style={{ width: '100%', background: i === 2 ? PRIMARY : `${PRIMARY}55`, borderRadius: 4 }} />
                      <span style={{ color: MUTED, fontSize: 11 }}>{d}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
          {activeTab === 'alltime' && <motion.div key="a" {...sceneTransitions.scaleFade}><AllTimeView active={activeTab === 'alltime'} /></motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
