import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { WifiOff, ShieldCheck, RefreshCw } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';
const BLUE = '#3b82f6';

function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1500), setTimeout(() => setPhase(3), 2600)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-4">
        <h1 className="text-6xl font-black text-white leading-tight">
          Some apps stay open<br />even while <span style={{ color: RED }}>blocked.</span>
        </h1>
        <p className="text-2xl" style={{ color: MUTED }}>They just go background and keep downloading.</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="solution" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: CARD, border: `1.5px solid ${BLUE}55`, borderRadius: 20, padding: '28px 40px', textAlign: 'center' }}>
            <WifiOff size={52} color={BLUE} style={{ margin: '0 auto 12px' }} />
            <p style={{ color: TEXT, fontSize: 24, fontWeight: 800, marginBottom: 8 }}>VPN Network Block</p>
            <p style={{ color: MUTED, fontSize: 15 }}>Cuts the network at device level.<br />Overlay block + network cut = nothing gets through.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: PRIMARY, fontSize: 18 }}>
            Block Defense → VPN Block · requires VPN permission
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [vpnOn, setVpnOn] = useState(false);
  const [selfHeal, setSelfHeal] = useState(false);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setVpnOn(true), 1000),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setSelfHeal(true), 2600),
    ];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Block Defense · VPN</p>
        <h2 className="text-5xl font-black text-white">Per-app network blocking</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 520 }}>
        <AnimatePresence mode="popLayout">
          {phase >= 1 && (
            <motion.div key="vpn-toggle" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              style={{ background: CARD, border: `1px solid ${vpnOn ? `${BLUE}55` : BORDER}`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${BLUE}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WifiOff size={18} color={BLUE} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>VPN Block</p>
                <p style={{ color: MUTED, fontSize: 12 }}>Tunnel blocked apps through VPN to cut their network access</p>
              </div>
              <motion.div animate={{ background: vpnOn ? GREEN : BORDER }} transition={{ duration: 0.3 }}
                style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
                <motion.div animate={{ left: vpnOn ? 22 : 2 }} transition={{ duration: 0.3 }}
                  style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10, background: '#fff' }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {phase >= 2 && (
            <motion.div key="apps" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px' }}>
              <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>PER-APP VPN SELECTION</p>
              {['Instagram', 'YouTube', 'TikTok'].map((app, i) => (
                <motion.div key={app} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none' }}>
                  <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{app}</span>
                  <span style={{ background: `${BLUE}22`, color: BLUE, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999 }}>VPN ON</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {selfHeal && (
            <motion.div key="selfheal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}44`, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <RefreshCw size={18} color={GREEN} />
              <div>
                <p style={{ color: GREEN, fontSize: 14, fontWeight: 700 }}>VPN Self-Heal enabled</p>
                <p style={{ color: MUTED, fontSize: 12 }}>Auto-reconnects if disconnected mid-session</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Scene3() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1400), setTimeout(() => setPhase(3), 2400)];
    return () => t.forEach(clearTimeout);
  }, []);
  const layers = [
    { label: 'Accessibility Service', desc: 'Detects app in foreground → overlay block', color: PRIMARY, active: true },
    { label: 'VPN Network Block', desc: 'Cuts app\'s internet at device level', color: BLUE, active: true },
    { label: 'System Protection', desc: 'Locks Settings, Power menu', color: GREEN, active: true },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <h1 className="text-6xl font-black text-white text-center leading-tight">
        Cuts the network.<br /><span style={{ color: BLUE }}>Not just the overlay.</span>
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 560 }}>
        {layers.map((l, i) => (
          <AnimatePresence mode="popLayout" key={l.label}>
            {phase >= 1 && (
              <motion.div key={l.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.18 }}
                style={{ background: CARD, border: `1.5px solid ${l.color}44`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <ShieldCheck size={20} color={l.color} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: TEXT, fontSize: 15, fontWeight: 700 }}>{l.label}</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>{l.desc}</p>
                </div>
                <span style={{ background: `${GREEN}22`, color: GREEN, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>ON</span>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.p key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: PRIMARY, fontSize: 20, fontWeight: 700 }}>
            Three enforcement layers. Nothing bypasses all three.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function NetworkBlocking() {
  const { currentScene } = useVideoPlayer(3, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 40% 50%, #050a1a 0%, transparent 60%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" />}
      </AnimatePresence>
    </div>
  );
}
