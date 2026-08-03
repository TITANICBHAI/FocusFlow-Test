import React, { useState } from 'react';
import { Power, Star, Pause, Play, Instagram } from 'lucide-react';

export function BrandInAction() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div 
      className="min-h-screen p-8 md:p-12 flex flex-col items-center justify-center font-sans antialiased text-[#E2E8F0] select-none"
      style={{ backgroundColor: '#0A0B14' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;900&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .bg-surface-dark { background-color: #0E0F1A; }
        .bg-surface-mid { background-color: #1A1D2E; }
        .border-brand { border-color: #2D3148; }
        .text-brand-muted { color: #8892A4; }
        .text-brand-blue { color: #22D3EE; }
        .text-brand-indigo { color: #6366F1; }
        .text-brand-purple { color: #7C3AED; }
        .bg-brand-indigo { background-color: #6366F1; }
        .bg-brand-blue { background-color: #22D3EE; }
      `}} />

      <div className="max-w-4xl w-full">
        <h1 className="font-display text-4xl font-bold mb-2">Brand in Action</h1>
        <p className="text-brand-muted mb-12 font-medium">Real-world product touchpoints.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* 1. App Store Listing */}
          <div className="flex flex-col gap-8">
            <div 
              className="bg-surface-dark border border-brand rounded-3xl p-6 shadow-xl flex flex-col relative overflow-hidden"
              style={{ width: '340px', height: '180px' }}
            >
              <div className="flex gap-4 mb-4">
                <div className="w-20 h-20 rounded-2xl bg-surface-mid flex items-center justify-center flex-shrink-0 shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#6366F1] via-[#7C3AED] to-[#22D3EE] opacity-20"></div>
                  <Power className="w-10 h-10 text-white z-10" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col justify-center flex-grow">
                  <h2 className="font-display text-xl font-bold leading-tight">FocusFlow</h2>
                  <p className="text-brand-blue text-xs font-medium mt-0.5">TBTechs</p>
                  <p className="text-brand-muted text-[10px] mt-0.5">Productivity • Take back your time</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-sm font-bold">
                    4.8 <Star className="w-3.5 h-3.5 fill-[#E2E8F0] text-[#E2E8F0]" />
                  </div>
                  <div className="text-[10px] text-brand-muted">98K Reviews</div>
                </div>
                <button className="bg-brand-indigo hover:bg-[#4F46E5] transition-colors text-white text-sm font-bold py-1.5 px-6 rounded-full">
                  Install
                </button>
              </div>
            </div>

            {/* 3. Social Media Post */}
            <div 
              className="rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl"
              style={{ 
                width: '340px', 
                height: '340px',
                background: 'linear-gradient(135deg, #0E0F1A 0%, #1A1D2E 50%, #2D3148 100%)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1]/40 via-[#7C3AED]/20 to-transparent"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#22D3EE] rounded-full blur-[100px] opacity-10 mix-blend-screen transform translate-x-1/2 -translate-y-1/2"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex-grow flex flex-col justify-center">
                  <div className="font-display text-7xl font-black text-brand-blue leading-none tracking-tighter drop-shadow-lg">
                    4h 37m
                  </div>
                  <div className="font-display text-2xl font-bold mt-4 text-white leading-tight">
                    Average daily<br/>phone use.
                  </div>
                  <div className="text-lg text-[#8892A4] mt-2 font-medium">
                    Not on our watch.
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mt-auto pt-6 border-t border-white/10">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#22D3EE] flex items-center justify-center">
                    <Power className="w-4 h-4 text-white" strokeWidth={3} />
                  </div>
                  <div className="text-sm font-bold">@TBTechs</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {/* 2. Android App Widget */}
            <div 
              className="bg-surface-dark rounded-3xl p-6 shadow-2xl flex flex-col relative"
              style={{ 
                width: '300px', 
                height: '300px',
                boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.2), 0 20px 40px -10px rgba(0,0,0,0.5)'
              }}
            >
              <div className="absolute -inset-0.5 rounded-[1.6rem] bg-gradient-to-b from-[#6366F1]/30 to-transparent opacity-50 pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-xl bg-surface-mid flex items-center justify-center">
                    <Power className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-bold tracking-wide flex items-center gap-1.5 border border-[#10B981]/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
                    ACTIVE
                  </div>
                </div>
                
                <div className="flex-grow flex flex-col justify-center">
                  <div className="text-brand-muted text-sm font-medium mb-1">Deep Work Session</div>
                  <div className="font-display text-4xl font-bold text-white mb-2 tracking-tight">12</div>
                  <div className="text-[#E2E8F0] font-medium text-sm">Apps blocked</div>
                </div>
                
                <div className="mt-auto">
                  <button 
                    onClick={() => setIsPaused(!isPaused)}
                    className="w-full bg-surface-mid hover:bg-[#2D3148] transition-colors border border-brand rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-sm"
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                    {isPaused ? 'Resume Session' : 'Pause (5m left)'}
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Notification */}
            <div 
              className="bg-[#1A1D2E] rounded-2xl shadow-2xl relative overflow-hidden flex items-stretch"
              style={{ width: '340px', height: '120px' }}
            >
              <div className="w-1.5 bg-[#6366F1]"></div>
              <div className="flex-grow p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-gradient-to-tr from-[#6366F1] to-[#22D3EE] flex items-center justify-center">
                    <Power className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-xs font-medium text-brand-muted">FocusFlow • Session Active</span>
                  <span className="text-xs text-brand-muted ml-auto">Now</span>
                </div>
                
                <div className="text-sm font-bold text-white mb-0.5">Instagram blocked.</div>
                <div className="text-sm text-[#8892A4] mb-3">3h 45m remaining in session.</div>
                
                <div className="flex gap-4 mt-auto">
                  <button className="text-brand-blue text-xs font-bold uppercase tracking-wide hover:text-white transition-colors">
                    Take a Break
                  </button>
                  <button className="text-[#E2E8F0] text-xs font-bold uppercase tracking-wide hover:text-white transition-colors">
                    View Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
