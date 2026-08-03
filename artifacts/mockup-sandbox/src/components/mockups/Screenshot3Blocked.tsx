import React from 'react';
import { Lock, Activity } from 'lucide-react';

const PhoneFrame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <div className="w-full h-screen bg-[#000000] flex items-center justify-center relative font-sans text-white overflow-hidden">
    <div className="relative aspect-[9/16] h-[82vh] max-h-[900px] border-[10px] border-[#1a1a24] rounded-[48px] bg-[#0a0a0f] overflow-hidden shadow-2xl flex flex-col">
      <div className="absolute top-0 inset-x-0 flex justify-center z-50 pt-2">
        <div className="w-32 h-8 bg-black rounded-full"></div>
      </div>
      
      <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-8 text-[12px] font-medium z-40 text-white drop-shadow-md">
        <span>9:41</span>
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4" />
          <div className="w-6 h-3 bg-white/80 rounded-[4px] relative">
            <div className="absolute left-[1px] top-[1px] bottom-[1px] bg-black/80 w-[80%] rounded-[2px]"></div>
            <div className="absolute left-[1px] top-[1px] bottom-[1px] bg-white w-[60%] rounded-[2px]"></div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full overflow-hidden mt-0 relative flex flex-col">
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

export default function Screenshot3Blocked() {
  return (
    <PhoneFrame caption="System-Level App Blocking">
      {/* Background Fake Instagram Feed */}
      <div className="absolute inset-0 overflow-hidden bg-white z-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 mt-12">
          <div className="text-xl font-bold text-black italic">Instagram</div>
          <div className="flex space-x-4">
            <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
            <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
          </div>
        </div>
        <div className="p-4 flex space-x-4 border-b border-gray-100">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-500 p-0.5">
                <div className="w-full h-full bg-white rounded-full p-0.5">
                  <div className="w-full h-full bg-gray-200 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="w-full">
          <div className="flex items-center p-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 mr-3"></div>
            <div className="w-24 h-4 bg-gray-200 rounded"></div>
          </div>
          <div className="w-full aspect-square bg-gray-100"></div>
          <div className="p-4 space-y-3">
            <div className="flex space-x-4">
              <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
              <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
              <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
            </div>
            <div className="w-32 h-4 bg-gray-200 rounded"></div>
            <div className="w-full h-4 bg-gray-200 rounded"></div>
            <div className="w-48 h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>

      {/* Block Overlay */}
      <div className="absolute inset-0 bg-[#0a0a0f]/85 backdrop-blur-xl z-10 flex items-center justify-center p-8">
        <div className="flex flex-col items-center text-center w-full">
          <div className="relative mb-8 flex justify-center items-center">
            <div className="absolute w-40 h-40 bg-red-500/20 rounded-full animate-pulse blur-xl"></div>
            <div className="absolute w-32 h-32 bg-red-500/30 rounded-full animate-ping"></div>
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center relative z-10 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-black text-white mb-4 tracking-tight font-['Space_Grotesk']">APP BLOCKED</h1>
          
          <p className="text-gray-300 text-lg mb-8 max-w-[280px]">
            Instagram is not allowed during your focus session.
          </p>

          <div className="bg-[#111118]/80 border border-white/10 rounded-2xl p-6 w-full mb-8 backdrop-blur-md">
            <div className="text-[#6366f1] text-sm font-bold uppercase tracking-wider mb-2">Time Remaining</div>
            <div className="text-3xl font-bold text-white font-['Space_Grotesk']">
              Focus ends in 18:32
            </div>
          </div>

          <p className="text-gray-500 text-sm">
            Emergency override available in FocusFlow
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}
