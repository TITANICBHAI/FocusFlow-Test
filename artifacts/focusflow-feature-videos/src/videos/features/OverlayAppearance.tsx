import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { sceneTransitions } from '@/lib/video/animations';
import { ShieldCheck, Image, Plus } from 'lucide-react';

const BG = '#111827';
const CARD = '#1f2937';
const BORDER = '#374151';
const PRIMARY = '#6366f1';
const RED = '#ef4444';
const MUTED = '#9ca3af';
const TEXT = '#f3f4f6';

const DEFAULT_QUOTES = [
  "The impediment to action advances action. What stands in the way becomes the way.",
  "Focus is the art of knowing what to ignore.",
  "You don't need more time. You need more focus.",
  "Deep work is the superpower of the 21st century.",
];

function BlockOverlayPreview({ quote, wallpaperColor }: { quote: string; wallpaperColor: string }) {
  return (
    <div style={{
      width: 300, height: 220, borderRadius: 20, overflow: 'hidden', position: 'relative',
      background: wallpaperColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
      border: `1.5px solid ${RED}33`,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>STAY FOCUSED</p>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>"{quote}"</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 12 }}>
          <ShieldCheck size={12} color={PRIMARY} />
          <span style={{ color: PRIMARY, fontSize: 10, fontWeight: 600 }}>FocusFlow is protecting your focus</span>
        </div>
      </div>
    </div>
  );
}

function Scene1({ }: { currentScene: number }) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 800)];
    const id = setInterval(() => setQuoteIndex(i => (i + 1) % DEFAULT_QUOTES.length), 2500);
    return () => { t.forEach(clearTimeout); clearInterval(id); };
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-3">
        <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Overlay Appearance</p>
        <h1 className="text-5xl font-black text-white">The block overlay is<br /><span style={{ color: PRIMARY }}>fully yours to design.</span></h1>
        <p className="text-xl" style={{ color: MUTED }}>Custom quotes. Custom wallpaper.</p>
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 1 && (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <BlockOverlayPreview quote={DEFAULT_QUOTES[quoteIndex]} wallpaperColor="linear-gradient(135deg,#0f0c29,#302b63,#24243e)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>Built-in motivational quotes</p>
              <p style={{ color: MUTED, fontSize: 13 }}>Rotate automatically each time<br />the block overlay appears.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Scene2({ }: { currentScene: number }) {
  const [draftQuote, setDraftQuote] = useState('');
  const [quotes, setQuotes] = useState<string[]>([]);
  const [phase, setPhase] = useState(0);
  const fullQuote = 'Every temptation resisted makes you stronger.';
  useEffect(() => {
    let i = 0; const t = setTimeout(() => setPhase(1), 400);
    const type = setInterval(() => {
      if (i <= fullQuote.length) { setDraftQuote(fullQuote.slice(0, i)); i++; }
      else {
        clearInterval(type);
        setTimeout(() => setQuotes(q => [...q, fullQuote]), 500);
      }
    }, 55);
    return () => { clearTimeout(t); clearInterval(type); };
  }, []);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-5xl font-black text-white">Add your own quotes</h2>
        <p style={{ color: MUTED, fontSize: 18 }}>Words that mean something to you personally.</p>
      </div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '24px 28px', width: 560 }}>
        <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>CUSTOM QUOTES</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ color: draftQuote ? TEXT : MUTED, fontSize: 14 }}>{draftQuote || 'Type a motivational quote…'}<span style={{ color: PRIMARY }}>|</span></p>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18} color="#fff" />
          </div>
        </div>
        <AnimatePresence mode="popLayout">
          {quotes.map((q, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <p style={{ color: TEXT, fontSize: 13, fontStyle: 'italic' }}>"{q}"</p>
            </motion.div>
          ))}
        </AnimatePresence>
        <p style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>Stored in SharedPreferences. Syncs to the native overlay immediately.</p>
      </div>
    </motion.div>
  );
}

function Scene3({ }: { currentScene: number }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [setTimeout(() => setPhase(1), 500), setTimeout(() => setPhase(2), 1500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const wallpapers = [
    { label: 'Dark gradient', bg: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
    { label: 'Forest dark', bg: 'linear-gradient(135deg,#0a1628,#1a3a2a,#0d2016)' },
    { label: 'Deep ocean', bg: 'linear-gradient(135deg,#020c1b,#0a2a4a,#0d3358)' },
    { label: 'Custom photo', bg: 'linear-gradient(135deg,#1a1a1a,#2d2d2d)', isCustom: true },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10" {...sceneTransitions.scaleFade}>
      <div className="text-center flex flex-col gap-2">
        <h2 className="text-5xl font-black text-white">Custom wallpaper</h2>
        <p style={{ color: MUTED, fontSize: 18 }}>Pick any photo from your library as the overlay background.</p>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {wallpapers.map((w, i) => (
          <AnimatePresence mode="popLayout" key={w.label}>
            {phase >= 1 && (
              <motion.div key={w.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.14 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 120, height: 90, borderRadius: 12, background: w.bg, border: `1.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(w as { isCustom?: boolean }).isCustom && <Image size={28} color={MUTED} />}
                </div>
                <p style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>{w.label}</p>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
      <AnimatePresence mode="popLayout">
        {phase >= 2 && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <p className="text-xl font-semibold" style={{ color: TEXT }}>Result →</p>
            <BlockOverlayPreview
              quote="Every temptation resisted makes you stronger."
              wallpaperColor="linear-gradient(135deg,#0a1628,#1a3a2a,#0d2016)"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function OverlayAppearance() {
  const { currentScene } = useVideoPlayer(3, 8000);
  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: BG, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 60% 40%, #1a1030 0%, transparent 60%)' }} />
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" currentScene={currentScene} />}
        {currentScene === 1 && <Scene2 key="s2" currentScene={currentScene} />}
        {currentScene === 2 && <Scene3 key="s3" currentScene={currentScene} />}
      </AnimatePresence>
    </div>
  );
}
