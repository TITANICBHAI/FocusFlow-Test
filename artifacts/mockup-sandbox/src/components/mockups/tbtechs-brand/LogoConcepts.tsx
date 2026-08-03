import React from "react";

export function LogoConcepts() {
  const Icon = ({ size = 48, gradientId = "icon-gradient", monochrome = false }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={monochrome ? "#FFFFFF" : "#22D3EE"} />
          <stop offset="100%" stopColor={monochrome ? "#FFFFFF" : "#7C3AED"} />
        </linearGradient>
      </defs>
      
      {/* Background crosshairs */}
      <line x1="20" y1="20" x2="80" y2="80" stroke={monochrome ? "rgba(255,255,255,0.2)" : "rgba(124,58,237,0.3)"} strokeWidth="4" strokeLinecap="round" />
      <line x1="80" y1="20" x2="20" y2="80" stroke={monochrome ? "rgba(255,255,255,0.2)" : "rgba(34,211,238,0.3)"} strokeWidth="4" strokeLinecap="round" />

      {/* Main Arc */}
      <path
        d="M 25,25 A 40 40 0 1 0 75,25"
        stroke={`url(#${gradientId})`}
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Center dash */}
      <line
        x1="35"
        y1="50"
        x2="65"
        y2="50"
        stroke={`url(#${gradientId})`}
        strokeWidth="12"
        strokeLinecap="round"
      />
    </svg>
  );

  const WordmarkText = ({ monochrome = false }) => (
    <div className="font-[800] tracking-tighter flex items-center leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <span
        style={
          monochrome
            ? { color: "#FFFFFF" }
            : {
                background: "linear-gradient(to bottom left, #22D3EE, #7C3AED)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }
        }
      >
        TB
      </span>
      <span style={{ color: monochrome ? "#FFFFFF" : "#6366F1" }}>Techs</span>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#0E0F1A] text-[#E2E8F0] p-12 overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;800&display=swap');
      `}} />
      
      <div className="max-w-6xl mx-auto space-y-20">
        <header>
          <h1 className="text-3xl font-bold mb-2 font-['Space_Grotesk'] tracking-tight">TBTechs Logo Concepts</h1>
          <p className="text-[#6366F1] font-['Space_Grotesk']">Board 2 • FocusFlow Brand Identity</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          
          {/* 1. Wordmark */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">1. Primary Wordmark</h2>
            <div className="bg-[#1A1D2E] p-12 rounded-xl flex items-center justify-center border border-slate-800/50 shadow-2xl h-64">
              <div className="text-7xl">
                <WordmarkText />
              </div>
            </div>
            <p className="text-sm text-slate-400">Intended use: <strong className="text-slate-200">Website header, Corporate branding</strong></p>
          </section>

          {/* 4. App Icon */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">4. App Store Icon</h2>
            <div className="bg-[#1A1D2E] p-12 rounded-xl flex items-center justify-center border border-slate-800/50 shadow-2xl h-64">
              <div 
                className="w-32 h-32 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0E0F1A 0%, #1A1D2E 100%)", boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)" }}
              >
                <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')]"></div>
                <Icon size={80} gradientId="app-icon-grad" />
              </div>
            </div>
            <p className="text-sm text-slate-400">Intended use: <strong className="text-slate-200">App Store, macOS/Windows application icons</strong></p>
          </section>

          {/* 2. Horizontal */}
          <section className="space-y-6 md:col-span-2">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">2. Horizontal Lockup (Light/Dark Contexts)</h2>
            <div className="grid grid-cols-2 rounded-xl overflow-hidden shadow-2xl h-48 border border-slate-800/50">
              <div className="bg-[#0E0F1A] p-8 flex items-center justify-center">
                <div className="flex items-center gap-4">
                  <Icon size={48} gradientId="horiz-dark" />
                  <div className="text-4xl"><WordmarkText /></div>
                </div>
              </div>
              <div className="bg-[#F8F9FF] p-8 flex items-center justify-center">
                <div className="flex items-center gap-4">
                  <Icon size={48} gradientId="horiz-light" />
                  <div className="text-4xl"><WordmarkText /></div>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-400">Intended use: <strong className="text-slate-200">Navbar, External placements, Press materials</strong></p>
          </section>

          {/* 3. Icon Only Sizes */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">3. Mark Scale Test</h2>
            <div className="bg-[#1A1D2E] p-12 rounded-xl flex items-end justify-center gap-12 border border-slate-800/50 shadow-2xl h-64">
              <div className="flex flex-col items-center gap-4">
                <Icon size={96} gradientId="size-96" />
                <span className="text-xs text-slate-500 font-mono">96px</span>
              </div>
              <div className="flex flex-col items-center gap-4">
                <Icon size={48} gradientId="size-48" />
                <span className="text-xs text-slate-500 font-mono">48px</span>
              </div>
              <div className="flex flex-col items-center gap-4">
                <Icon size={32} gradientId="size-32" />
                <span className="text-xs text-slate-500 font-mono">32px</span>
              </div>
            </div>
            <p className="text-sm text-slate-400">Intended use: <strong className="text-slate-200">Favicon, App Preview, UI elements</strong></p>
          </section>

          {/* 5. Single Color */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">5. Monochrome Lockup</h2>
            <div className="bg-black p-12 rounded-xl flex items-center justify-center border border-slate-800/50 shadow-2xl h-64">
              <div className="flex items-center gap-6">
                <Icon size={64} gradientId="mono" monochrome={true} />
                <div className="text-5xl"><WordmarkText monochrome={true} /></div>
              </div>
            </div>
            <p className="text-sm text-slate-400">Intended use: <strong className="text-slate-200">Print, Emboss, High-contrast contexts</strong></p>
          </section>

        </div>
      </div>
    </div>
  );
}

export default LogoConcepts;
