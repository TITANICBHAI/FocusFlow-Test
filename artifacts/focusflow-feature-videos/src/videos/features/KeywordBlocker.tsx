import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { Home } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';
const PINK = '#ec4899';

function Scene1({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1600)];
    return () => t.forEach(clearTimeout);
  }, []);
  const presets = [
    { emoji: '📰', label: 'Doomscroll bait', desc: 'Outrage headlines, viral controversy', words: ['breaking', 'shocking', 'must see'] },
    { emoji: '🎭', label: 'Social-media drama', desc: 'Celebrity feuds, trending arguments', words: ['cancelled', 'feud', 'expose'] },
    { emoji: '📱', label: 'Shorts/Reels bait', desc: 'Short-form-video rabbit holes', words: ['short', 'reel', 'viral'] },
    { emoji: '🛒', label: 'Impulse-buy traps', desc: 'Sale-pressure words', words: ['flash sale', 'limited time', 'buy now'] },
    { emoji: '🎰', label: 'Gambling triggers', desc: 'Betting lines, casino lure', words: ['bet', 'odds', 'jackpot'] },
    { emoji: '🚫', label: 'NSFW content', desc: 'Adult-content terms', words: ['nsfw', 'adult'] },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-3">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Side Menu → Keyword Blocker</p>
        <h1 className="text-5xl font-black text-white">Block by on-screen text.</h1>
        <p className="text-xl" style={{ color: MUTED }}>Any word spotted → sent straight to home screen.</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="presets" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, width: 700 }}>
            {presets.map((p, i) => (
              <motion.div key={p.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 22, marginBottom: 6 }}>{p.emoji}</p>
                <p style={{ color: TEXT, fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{p.label}</p>
                <p style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>{p.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {p.words.map(w => (
                    <span key={w} style={{ background: `${PINK}18`, color: PINK, fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{w}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.p key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: PRIMARY, fontSize: 18 }}>
            One tap to add a preset. Add your own words too.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  const [detectedWord, setDetectedWord] = useState<string | null>(null);
  const [redirected, setRedirected] = useState(false);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setDetectedWord('breaking'), 1400),
      setTimeout(() => setRedirected(true), 2400),
    ];
    return () => t.forEach(clearTimeout);
  }, []);
  const words = ['breaking', 'shocking', 'must see', 'cancelled', 'viral', 'flash sale', 'bet', 'reel'];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <h2 className="text-5xl font-black text-white text-center">The moment a blocked word<br /><span style={{ color: PINK }}>appears on screen…</span></h2>
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', width: 300 }}>
          <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Active keyword list</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {words.map(w => (
              <motion.span key={w}
                animate={detectedWord === w ? { scale: [1, 1.3, 1], background: [`${PINK}18`, `${RED}44`, `${RED}22`] } : {}}
                style={{ background: `${PINK}18`, color: w === detectedWord ? RED : PINK, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, display: 'inline-block' }}>
                {w}
              </motion.span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 32 }}>→</div>

        <AnimatePresence mode="popLayout">
          {detectedWord && !redirected && (
            <motion.div key="detected" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ background: `${RED}18`, border: `1.5px solid ${RED}55`, borderRadius: 14, padding: '20px 24px', textAlign: 'center', width: 220 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>👁️</p>
              <p style={{ color: RED, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Word detected</p>
              <p style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>"{detectedWord}"</p>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>Sending to home screen…</p>
            </motion.div>
          )}
          {redirected && (
            <motion.div key="home" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ background: `${PRIMARY}18`, border: `1.5px solid ${PRIMARY}55`, borderRadius: 14, padding: '20px 28px', textAlign: 'center', width: 220 }}>
              <Home size={40} color={PRIMARY} style={{ margin: '0 auto 12px' }} />
              <p style={{ color: PRIMARY, fontSize: 14, fontWeight: 700 }}>Redirected to</p>
              <p style={{ color: TEXT, fontSize: 22, fontWeight: 800 }}>Home Screen</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p style={{ color: MUTED, fontSize: 16 }}>Works inside any app. No app-specific setup needed.</p>
    </motion.div>
  );
}

function Scene3() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 400), setTimeout(() => setPhase(2), 1200)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <h1 className="text-6xl font-black text-white text-center leading-tight">Block the content.<br /><span style={{ color: PINK }}>Not the whole app.</span></h1>
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { title: 'Adding words', detail: 'No password required', color: GREEN },
          { title: 'Removing words', detail: 'Defense password required', color: RED },
          { title: 'Custom words', detail: 'Add anything you want blocked', color: PRIMARY },
        ].map((item, i) => (
          <AnimatePresence mode="popLayout" key={item.title}>
            {phase >= 1 && (
              <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px 24px', width: 210, textAlign: 'center' }}>
                <p style={{ color: TEXT, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</p>
                <p style={{ color: item.color, fontSize: 13, fontWeight: 600 }}>{item.detail}</p>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.p key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: MUTED, fontSize: 16 }}>
            Pairs with Accessibility Service — real-time text scanning.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const GREEN = '#10b981';

export default function KeywordBlocker() {
  const { currentScene } = useVideoPlayer(3, 7500);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a0a1a 0%, transparent 60%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" />}
      </AnimatePresence>
    </div>
  );
}
