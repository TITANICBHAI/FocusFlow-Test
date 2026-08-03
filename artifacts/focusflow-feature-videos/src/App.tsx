import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Gallery from './pages/Gallery';

export interface VideoMeta {
  id: string;
  title: string;
  category: 'feature' | 'combo';
  duration: string;
  description: string;
  accent: string;
}

export const ALL_VIDEOS: VideoMeta[] = [
  { id: 'app-blocking',      title: 'App Blocking',         category: 'feature', duration: '~30s', description: 'Block distracting apps instantly during focus sessions.', accent: '#6366f1' },
  { id: 'focus-sessions',    title: 'Focus Sessions',       category: 'feature', duration: '~30s', description: 'Pomodoro-style timers that lock you in and keep you there.', accent: '#06b6d4' },
  { id: 'daily-allowance',   title: 'Daily Allowance',      category: 'feature', duration: '~30s', description: 'Set time budgets per app. Enforce them automatically.', accent: '#f59e0b' },
  { id: 'keyword-blocker',   title: 'Keyword Blocker',      category: 'feature', duration: '~30s', description: 'Block any app the moment a distracting keyword appears.', accent: '#ec4899' },
  { id: 'network-blocking',  title: 'Network Blocking',     category: 'feature', duration: '~30s', description: 'Cut off the internet at the VPN level. No bypass possible.', accent: '#ef4444' },
  { id: 'stats-analytics',   title: 'Stats & Analytics',    category: 'feature', duration: '~30s', description: 'Track streaks, focus minutes, and weekly productivity scores.', accent: '#10b981' },
  { id: 'overlay-appearance', title: 'Overlay Appearance',  category: 'feature', duration: '~25s', description: 'Custom themes, quotes, and wallpapers on the block screen.', accent: '#8b5cf6' },
  { id: 'block-defense',     title: 'Block Defense',        category: 'feature', duration: '~25s', description: 'Prevents uninstall, power menu, and system bypass attempts.', accent: '#f97316' },
  { id: 'combo-focus-day',   title: 'Your Focus Day',       category: 'combo',   duration: '~45s', description: 'Focus Session + App Blocking + Stats working together.', accent: '#6366f1' },
  { id: 'combo-max-lock',    title: 'Maximum Lock Mode',    category: 'combo',   duration: '~40s', description: 'Network Blocking + Keyword Blocker + Block Defense stacked.', accent: '#ef4444' },
  { id: 'combo-habits',      title: 'Build Better Habits',  category: 'combo',   duration: '~40s', description: 'Daily Allowance + Schedule + Analytics for lasting change.', accent: '#10b981' },
];

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.replace('#', ''));
  useEffect(() => {
    const handler = () => setHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

async function loadVideo(id: string): Promise<React.ComponentType | null> {
  try {
    const map: Record<string, () => Promise<{ default: React.ComponentType }>> = {
      'app-blocking':       () => import('./videos/features/AppBlocking'),
      'focus-sessions':     () => import('./videos/features/FocusSessions'),
      'daily-allowance':    () => import('./videos/features/DailyAllowance'),
      'keyword-blocker':    () => import('./videos/features/KeywordBlocker'),
      'network-blocking':   () => import('./videos/features/NetworkBlocking'),
      'stats-analytics':    () => import('./videos/features/StatsAnalytics'),
      'overlay-appearance': () => import('./videos/features/OverlayAppearance'),
      'block-defense':      () => import('./videos/features/BlockDefense'),
      'combo-focus-day':    () => import('./videos/combos/FocusDay'),
      'combo-max-lock':     () => import('./videos/combos/MaximumLock'),
      'combo-habits':       () => import('./videos/combos/BuildHabits'),
    };
    if (!map[id]) return null;
    const mod = await map[id]();
    return mod.default;
  } catch {
    return null;
  }
}

export default function App() {
  const hash = useHashRoute();
  const [VideoComponent, setVideoComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hash) { setVideoComponent(null); return; }
    setLoading(true);
    loadVideo(hash).then(comp => { setVideoComponent(() => comp); setLoading(false); });
  }, [hash]);

  const meta = ALL_VIDEOS.find(v => v.id === hash);

  if (!hash) return <Gallery />;

  return (
    <div className="w-screen h-screen bg-[#08080f] overflow-hidden relative">
      <AnimatePresence mode="sync">
        {loading && (
          <motion.div key="loader" className="absolute inset-0 flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </motion.div>
        )}
        {!loading && VideoComponent && <VideoComponent key={hash} />}
        {!loading && !VideoComponent && (
          <motion.div key="missing" className="absolute inset-0 flex flex-col items-center justify-center gap-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-white/50 text-2xl">Video not found: {hash}</p>
            <button onClick={() => { window.location.hash = ''; }}
              className="px-6 py-3 bg-brand-600 rounded-xl text-white font-semibold">Back to Gallery</button>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && VideoComponent && (
        <motion.button
          className="absolute top-6 left-6 z-[100] flex items-center gap-2 px-4 py-2 glass-panel rounded-xl text-white/70 hover:text-white text-sm font-medium transition-colors"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
          onClick={() => { window.location.hash = ''; }}>
          ← Gallery
        </motion.button>
      )}

      {meta && !loading && (
        <motion.div className="absolute bottom-6 right-6 z-[100] glass-panel px-4 py-2 rounded-xl text-xs text-white/40 font-mono"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {meta.title} · {meta.duration}
        </motion.div>
      )}
    </div>
  );
}
