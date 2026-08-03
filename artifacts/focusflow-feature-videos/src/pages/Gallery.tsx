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

          {/* Download CTA */}
          <motion.div
            className="mt-16 glass-panel rounded-2xl p-8 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{ borderTop: '3px solid #6366f1' }}
          >
            <p className="text-brand-400 font-mono text-xs tracking-widest uppercase mb-3">Free & Open Source · Android</p>
            <h2 className="text-3xl font-display font-bold text-white mb-3">Ready to take back your focus?</h2>
            <p className="text-white/50 text-base mb-8 max-w-md">
              FocusFlow enforces focus at the OS level — Accessibility Service + local VPN + Device Admin.
              No soft timers. No bypass.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <motion.a
                href="https://github.com/TITANICBHAI/FocusFlow/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-white font-semibold text-sm transition-colors no-underline"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                Download APK
              </motion.a>
              <motion.a
                href="https://github.com/TITANICBHAI/FocusFlow"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 glass-panel hover:bg-white/10 rounded-xl text-white/70 hover:text-white font-semibold text-sm transition-colors no-underline"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                View Source
              </motion.a>
            </div>
          </motion.div>

          <div className="h-8" />
        </div>
      </div>
    );
  }
  