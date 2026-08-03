import React from 'react';
import { CheckCircle2, ChevronForward, Shield, Lock, Activity, Settings, Moon, Menu, Search, MoreHorizontal, Bell } from 'lucide-react';

const PhoneFrame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <div className="w-full h-screen bg-[#000000] flex items-center justify-center relative font-sans text-white overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[80vh] h-[80vh] bg-indigo-600/15 rounded-full blur-[120px]"></div>
    </div>
    
    <div className="relative aspect-[9/16] h-[82vh] max-h-[900px] border-[10px] border-[#1a1a24] rounded-[48px] bg-[#0a0a0f] overflow-hidden shadow-2xl flex flex-col">
      <div className="absolute top-0 inset-x-0 flex justify-center z-50 pt-2">
        <div className="w-32 h-8 bg-black rounded-full"></div>
      </div>
      
      <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-8 text-[12px] font-medium z-40">
        <span>9:41</span>
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4" />
          <div className="w-6 h-3 bg-white rounded-[4px] relative">
            <div className="absolute left-[1px] top-[1px] bottom-[1px] bg-black w-[80%] rounded-[2px]"></div>
            <div className="absolute left-[1px] top-[1px] bottom-[1px] bg-white w-[60%] rounded-[2px]"></div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full overflow-hidden mt-12 relative flex flex-col">
        {children}
      </div>
    </div>
    
    <div className="absolute bottom-8 w-full text-center z-50">
      <span className="bg-[#111118]/80 backdrop-blur-md border border-white/10 px-8 py-4 rounded-full text-xl font-bold tracking-wide text-white shadow-2xl inline-block" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
        {caption}
      </span>
    </div>
  </div>
);

export default function Screenshot2Focus() {
  return (
    <PhoneFrame caption="Pomodoro Timer Built-In">
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
        <div className="absolute inset-0 bg-[#6366f1]/5 flex items-center justify-center">
          <div className="w-64 h-64 bg-[#6366f1]/20 rounded-full blur-[60px]"></div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="bg-[#6366f1]/20 text-[#6366f1] px-4 py-1.5 rounded-full text-sm font-bold tracking-widest mb-12 border border-[#6366f1]/30">
            DEEP WORK
          </div>

          <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
            <svg className="w-full h-full absolute transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#111118" strokeWidth="2" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="289" strokeDashoffset="40" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            </svg>
            <div className="text-center">
              <div className="text-6xl font-bold font-['Space_Grotesk'] text-white drop-shadow-md">23:45</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-8 text-center font-['Space_Grotesk']">Architecture Review</h2>

          <div className="flex items-center justify-center space-x-6 w-full mb-16">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">2</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Pomodoros<br/>Done</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">47m</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Focused<br/>Time</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">0</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Violations<br/>Count</div>
            </div>
          </div>

          <div className="w-full space-y-4">
            <button className="w-full py-4 rounded-xl border border-red-500/30 bg-red-500/5 text-red-500 font-bold hover:bg-red-500/10 transition">
              Emergency Override
            </button>
            <button className="w-full py-4 rounded-xl text-gray-400 font-medium hover:text-white transition">
              End Session
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
