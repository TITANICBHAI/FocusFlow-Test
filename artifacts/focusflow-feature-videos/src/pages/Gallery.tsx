import { motion } from 'framer-motion';
import { ALL_VIDEOS } from '../App';

export default function Gallery() {
  const features = ALL_VIDEOS.filter(v => v.category === 'feature');
  const combos = ALL_VIDEOS.filter(v => v.category === 'combo');

  return (
    <div className="w-screen h-screen gallery-page bg-[#08080f] text-white">
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Header */}
        <motion.div className="mb-12" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-brand-400 font-mono text-sm tracking-widest uppercase mb-3">FocusFlow</p>
          <h1 className="text-5xl font-display font-bold tracking-tight mb-4">Feature Videos</h1>
          <p className="text-white/50 text-lg">Click any card to watch the animated intro. Use your browser's built-in recording to capture.</p>
        </motion.div>

        {/* Feature videos */}
        <motion.div className="mb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2 className="text-sm font-mono text-white/30 uppercase tracking-widest mb-5">Individual Features — {features.length} videos</h2>
          <div className="grid grid-cols-2 gap-4">
            {features.map((video, i) => (
              <motion.a
                key={video.id}
                href={`#${video.id}`}
                className="glass-panel p-6 rounded-2xl cursor-pointer group no-underline block"
                style={{ borderLeft: `3px solid ${video.accent}` }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                whileHover={{ scale: 1.02, borderColor: video.accent }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-display font-semibold text-white group-hover:text-brand-300 transition-colors">{video.title}</h3>
                  <span className="text-xs font-mono text-white/30 ml-3 flex-shrink-0">{video.duration}</span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">{video.description}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono" style={{ color: video.accent }}>
                  <span>▶</span>
                  <span>Watch</span>
                </div>
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* Combo videos */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <h2 className="text-sm font-mono text-white/30 uppercase tracking-widest mb-5">Combined Workflows — {combos.length} videos</h2>
          <div className="grid grid-cols-3 gap-4">
            {combos.map((video, i) => (
              <motion.a
                key={video.id}
                href={`#${video.id}`}
                className="glass-panel p-6 rounded-2xl cursor-pointer group no-underline block"
                style={{ borderTop: `3px solid ${video.accent}` }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="mb-2">
                  <span className="text-xs font-mono px-2 py-1 rounded-full" style={{ background: `${video.accent}22`, color: video.accent }}>COMBO</span>
                </div>
                <h3 className="text-base font-display font-semibold text-white mt-3 mb-2 group-hover:text-brand-300 transition-colors">{video.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed mb-4">{video.description}</p>
                <span className="text-xs font-mono text-white/30">{video.duration}</span>
              </motion.a>
            ))}
          </div>
        </motion.div>

        <div className="h-8" />
      </div>
    </div>
  );
}
