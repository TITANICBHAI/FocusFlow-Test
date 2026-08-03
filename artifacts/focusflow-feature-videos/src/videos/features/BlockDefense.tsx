import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { Lock, ShieldCheck, Trash2, Key, Zap } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const ORANGE = '#f97316';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

function Toggle({ on, color = GREEN }: { on: boolean; color?: string }) {
  return (
    <motion.div animate={{ background: on ? color : BORDER }} transition={{ duration: 0.35 }}
      style={{ width: 42, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0 }}>
      <motion.div animate={{ left: on ? 20 : 2 }} transition={{ duration: 0.35 }}
        style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10, background: '#fff' }} />
    </motion.div>
  );
}

function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1200)];
    return () => t.forEach(clearTimeout);
  }, []);
  const layers = [
    { icon: Lock, label: 'System Protection', desc: 'Power menu · Settings lockdown', color: PRIMARY },
    { icon: Zap, label: 'Aversion Deterrents', desc: 'Dimmer · Vibration · Alert sound', color: ORANGE },
    { icon: ShieldCheck, label: 'PIN Protection', desc: 'Focus Session password · Defense password', color: GREEN },
    { icon: Trash2, label: 'Nuclear Mode', desc: 'Permanently uninstall addictive apps', color: RED },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-3">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Block Defense · Side Menu → Block Enforcement</p>
        <h1 className="text-5xl font-black text-white leading-tight">The layers that make blocks<br /><span style={{ color: PRIMARY }}>impossible to bypass.</span></h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 560 }}>
        {layers.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <AnimatePresence mode="popLayout" key={layer.label}>
              {phase >= 1 && (
                <motion.div key={layer.label} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.14 }}
                  style={{ background: CARD, border: `1px solid ${layer.color}33`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${layer.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color={layer.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>{layer.label}</p>
                    <p style={{ color: MUTED, fontSize: 12 }}>{layer.desc}</p>
                  </div>
                  <span style={{ color: BORDER }}>›</span>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [toggles, setToggles] = useState([false, false, false, false]);
  useEffect(() => {
    [0, 1, 2, 3].forEach(i => setTimeout(() => setToggles(t => { const n = [...t]; n[i] = true; return n; }), 400 + i * 500));
  }, []);
  const items = [
    { label: 'System Protection', desc: 'Power menu, Settings lockdown', color: PRIMARY },
    { label: 'YouTube Shorts Block', desc: 'Intercepts the Shorts player', color: RED },
    { label: 'Instagram Reels Block', desc: 'Intercepts the Reels viewer', color: '#e1306c' },
    { label: 'Block Install Actions', desc: 'Play Store / packageinstaller dialogs', color: AMBER },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-5xl font-black text-white">System Protection</h2>
        <p style={{ color: MUTED, fontSize: 18 }}>Lock down every escape hatch.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 560 }}>
        {items.map((item, i) => (
          <div key={item.label} style={{ background: CARD, border: `1px solid ${toggles[i] ? `${item.color}44` : BORDER}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.3s' }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>{item.label}</p>
              <p style={{ color: MUTED, fontSize: 12 }}>{item.desc}</p>
            </div>
            <Toggle on={toggles[i]} color={item.color} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Scene3({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1400), setTimeout(() => setPhase(3), 2400)];
    return () => t.forEach(clearTimeout);
  }, []);
  const deterrents = [
    { label: 'Dimmer', desc: 'Near-black overlay on screen the instant you open a blocked app', icon: '🌑', color: PRIMARY },
    { label: 'Vibration', desc: 'Repeated vibration pulse while the blocked app is open', icon: '📳', color: AMBER },
    { label: 'Alert Sound', desc: 'Alert tone fires the moment the blocked app opens', icon: '🔔', color: RED },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-5xl font-black text-white">Aversion Deterrents</h2>
        <p style={{ color: MUTED, fontSize: 18 }}>Make distraction apps physically unpleasant to open.</p>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {deterrents.map((d, i) => (
          <AnimatePresence mode="popLayout" key={d.label}>
            {phase >= 1 && (
              <motion.div key={d.label} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.18 }}
                style={{ background: CARD, border: `1px solid ${d.color}44`, borderRadius: 18, padding: '28px 24px', width: 200, textAlign: 'center' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>{d.icon}</p>
                <p style={{ color: TEXT, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{d.label}</p>
                <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>{d.desc}</p>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: MUTED, fontSize: 16 }}>
            Applied the instant the blocked app opens — before you even see it.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene4() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1400), setTimeout(() => setPhase(3), 2400)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-5xl font-black text-white">PIN Protection</h2>
        <p style={{ color: MUTED, fontSize: 18 }}>Two separate passwords. Two separate locks.</p>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { icon: Lock, title: 'Focus Session Password', desc: 'Gates ending any active focus session. Set once per session start.', color: PRIMARY },
          { icon: Key, title: 'Defense Password', desc: 'Gates disabling any protection toggle (System Guard, VPN, etc).', color: GREEN },
        ].map((p, i) => {
          const Icon = p.icon;
          return (
            <AnimatePresence mode="popLayout" key={p.title}>
              {phase >= 1 && (
                <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2 }}
                  style={{ background: CARD, border: `1.5px solid ${p.color}44`, borderRadius: 18, padding: '28px 28px', width: 280, textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 28, background: `${p.color}18`, border: `1.5px solid ${p.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Icon size={26} color={p.color} />
                  </div>
                  <p style={{ color: TEXT, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{p.title}</p>
                  <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>{p.desc}</p>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="nuclear" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: `${RED}12`, border: `1.5px solid ${RED}44`, borderRadius: 16, padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Trash2 size={22} color={RED} />
            <div>
              <p style={{ color: RED, fontSize: 15, fontWeight: 700 }}>Nuclear Mode</p>
              <p style={{ color: MUTED, fontSize: 13 }}>Permanently uninstall addictive apps via the system dialog.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BlockDefense() {
  const { currentScene } = useVideoPlayer(4, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a0a05 0%, transparent 60%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" currentScene={currentScene} />}
        {currentScene === 3 && <Scene4 key="s4" />}
      </AnimatePresence>
    </div>
  );
}
