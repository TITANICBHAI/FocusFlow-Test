import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { ShieldCheck, WifiOff, Lock, Trash2, TextSelect } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const ORANGE = '#f97316';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

function Toggle({ on, color = GREEN }: { on: boolean; color?: string }) {
  return (
    <motion.div animate={{ background: on ? color : BORDER }} transition={{ duration: 0.35 }}
      style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', flexShrink: 0 }}>
      <motion.div animate={{ left: on ? 18 : 2 }} transition={{ duration: 0.35 }}
        style={{ position: 'absolute', top: 2, width: 18, height: 18, borderRadius: 9, background: '#fff' }} />
    </motion.div>
  );
}

// Scene 1: Intro — what Maximum Lock is
function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 600), setTimeout(() => setPhase(2), 1600)];
    return () => t.forEach(clearTimeout);
  }, []);
  const layers = [
    { icon: Lock, label: 'System Protection', color: PRIMARY },
    { icon: WifiOff, label: 'VPN Network Block', color: BLUE },
    { icon: TextSelect, label: 'Keyword Blocker', color: '#ec4899' },
    { icon: Trash2, label: 'Nuclear Mode', color: RED },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-3">
        <h1 className="text-7xl font-black text-center leading-tight" style={{ color: RED }}>Maximum Lock<br /><span className="text-white">Mode.</span></h1>
        <p className="text-2xl" style={{ color: MUTED }}>Stack every enforcement layer. Nothing gets through.</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="layers" className="flex gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {layers.map((l, i) => {
              const Icon = l.icon;
              return (
                <motion.div key={l.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.15 }}
                  style={{ background: CARD, border: `1.5px solid ${l.color}44`, borderRadius: 14, padding: '18px 16px', textAlign: 'center', width: 140 }}>
                  <Icon size={28} color={l.color} style={{ margin: '0 auto 10px' }} />
                  <p style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>{l.label}</p>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Scene 2: Block Defense — System Protection toggles
function Scene2({ }: { currentScene: number }) {
  const [toggles, setToggles] = useState([false, false, false, false]);
  useEffect(() => {
    [0, 1, 2, 3].forEach(i => setTimeout(() => setToggles(t => { const n = [...t]; n[i] = true; return n; }), 300 + i * 450));
  }, []);
  const items = [
    { label: 'System Protection', desc: 'Power menu · Settings lockdown', color: PRIMARY },
    { label: 'YouTube Shorts Block', desc: 'Intercepts the Shorts player', color: RED },
    { label: 'Instagram Reels Block', desc: 'Intercepts the Reels viewer', color: '#e1306c' },
    { label: 'Block Install Actions', desc: 'Play Store / packageinstaller dialogs', color: AMBER },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Layer 1 · Block Defense</p>
        <h2 className="text-5xl font-black text-white">System Protection</h2>
        <p style={{ color: MUTED, fontSize: 16 }}>Lock every escape route in the OS</p>
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

// Scene 3: VPN Block — network cut per-app
function Scene3({ }: { currentScene: number }) {
  const [vpnOn, setVpnOn] = useState(false);
  const [selfHeal, setSelfHeal] = useState(false);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setVpnOn(true), 500),
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setSelfHeal(true), 2000),
    ];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Layer 2 · Block Defense → VPN</p>
        <h2 className="text-5xl font-black text-white">VPN Network Block</h2>
        <p style={{ color: MUTED, fontSize: 16 }}>Cut internet access at device level</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 520 }}>
        <div style={{ background: CARD, border: `1px solid ${vpnOn ? `${BLUE}55` : BORDER}`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.3s' }}>
          <WifiOff size={20} color={BLUE} />
          <div style={{ flex: 1 }}>
            <p style={{ color: TEXT, fontSize: 15, fontWeight: 600 }}>VPN Block</p>
            <p style={{ color: MUTED, fontSize: 12 }}>Tunnel blocked apps through VPN to cut network access</p>
          </div>
          <Toggle on={vpnOn} color={BLUE} />
        </div>
        <AnimatePresence mode="popLayout">
          {phase >= 1 && (
            <motion.div key="apps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}>
              <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>PER-APP VPN · standaloneVpnPackages</p>
              {['Instagram', 'YouTube', 'TikTok', 'Twitter'].map((app, i) => (
                <motion.div key={app} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 3 ? `1px solid ${BORDER}` : 'none' }}>
                  <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{app}</span>
                  <span style={{ background: `${BLUE}22`, color: BLUE, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999 }}>VPN ON</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {selfHeal && (
            <motion.div key="sh" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}44`, borderRadius: 12, padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <ShieldCheck size={16} color={GREEN} />
              <p style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>VPN Self-Heal: auto-reconnects if disconnected mid-session</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Scene 4: Keyword Blocker — add doomscroll preset
function Scene4({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1400)];
    return () => t.forEach(clearTimeout);
  }, []);
  const presets = [
    { emoji: '📰', label: 'Doomscroll bait', words: ['breaking', 'shocking', 'must see', 'gone wrong'], active: true },
    { emoji: '🎭', label: 'Social-media drama', words: ['cancelled', 'feud', 'expose', 'beef'], active: true },
    { emoji: '📱', label: 'Shorts/Reels bait', words: ['short', 'reel', 'viral', 'tiktok'], active: true },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Layer 3 · Keyword Blocker</p>
        <h2 className="text-5xl font-black text-white">Block by on-screen text</h2>
        <p style={{ color: MUTED, fontSize: 16 }}>Any blocked word spotted → home screen instantly</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 600 }}>
        {presets.map((p, i) => (
          <AnimatePresence mode="popLayout" key={p.label}>
            {phase >= 1 && (
              <motion.div key={p.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                style={{ background: CARD, border: `1px solid ${p.active ? `${PRIMARY}44` : BORDER}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{p.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: TEXT, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{p.label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {p.words.map(w => (
                      <span key={w} style={{ background: `${PRIMARY}18`, color: PRIMARY, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{w}</span>
                    ))}
                  </div>
                </div>
                {p.active && <span style={{ background: `${GREEN}22`, color: GREEN, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>ACTIVE</span>}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </motion.div>
  );
}

// Scene 5: Nuclear Mode — uninstall permanently
function Scene5() {
  const [phase, setPhase] = useState(0);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [uninstalled, setUninstalled] = useState<string[]>([]);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setUninstalling('Instagram'), 1200),
      setTimeout(() => { setUninstalled(['Instagram']); setUninstalling(null); setPhase(2); }, 2200),
    ];
    return () => t.forEach(clearTimeout);
  }, []);
  const apps = ['Instagram', 'TikTok', 'Twitter'];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Nuclear Mode · Block Defense</p>
        <h2 className="text-5xl font-black text-white">Permanently uninstall<br /><span style={{ color: RED }}>addictive apps.</span></h2>
        <p style={{ color: MUTED, fontSize: 16 }}>Each tap opens Android's system "Uninstall?" dialog. Accidental deletion impossible.</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '20px 24px', width: 420 }}>
            {apps.map((app, i) => (
              <div key={app} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < apps.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <span style={{ color: uninstalled.includes(app) ? MUTED : TEXT, fontSize: 15, fontWeight: 600, textDecoration: uninstalled.includes(app) ? 'line-through' : 'none' }}>{app}</span>
                <AnimatePresence mode="popLayout">
                  {uninstalling === app ? (
                    <motion.span key="uninstalling" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ color: AMBER, fontSize: 12, fontWeight: 700 }}>Uninstalling…</motion.span>
                  ) : uninstalled.includes(app) ? (
                    <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>✓ Removed</motion.span>
                  ) : (
                    <motion.div key="btn" style={{ background: `${RED}18`, border: `1px solid ${RED}44`, borderRadius: 8, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Trash2 size={13} color={RED} />
                      <span style={{ color: RED, fontSize: 12, fontWeight: 700 }}>Uninstall</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.p key="cta" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ color: RED, fontSize: 22, fontWeight: 800 }}>
            Maximum Lock Mode. Nothing gets through.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MaximumLock() {
  const { currentScene } = useVideoPlayer(5, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a0505 0%, transparent 60%)' }} />
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
