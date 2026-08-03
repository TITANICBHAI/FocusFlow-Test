import React from 'react';
import { Activity, Shield, Bell, Battery, Eye, Lock, Check } from 'lucide-react';

const PhoneFrame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <div className="w-full h-screen bg-[#000000] flex items-center justify-center relative font-sans text-white overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[60vh] h-[60vh] bg-indigo-500/10 rounded-full blur-[100px]"></div>
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

      <div className="flex-1 w-full h-full overflow-hidden mt-14 relative flex flex-col">
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

export default function Screenshot5Permissions() {
  return (
    <PhoneFrame caption="Simple Setup, Maximum Protection">
      <div className="px-6 pb-8 flex-1 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="w-20 h-20 rounded-full bg-[#6366f1] flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.4)]">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black font-['Space_Grotesk'] text-white tracking-tight">FocusFlow</h1>
          <p className="text-gray-400 text-sm mt-2 text-center">Your discipline operating system</p>
        </div>

        <div className="w-full text-xs font-bold text-gray-500 tracking-widest mb-4">
          GRANT PERMISSIONS
        </div>

        {/* Permissions List */}
        <div className="w-full space-y-3 flex-1 overflow-y-auto pb-4">
          
          {/* Permission 1: Notifications */}
          <div className="bg-[#111118]/80 border border-green-500/30 rounded-2xl p-4 flex gap-4 bg-green-500/5">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-white">Notifications</h3>
              </div>
              <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                Get reminders before tasks start and alerts when time is up.
              </p>
              <div className="inline-flex items-center bg-green-500/20 border border-green-500/40 px-2 py-0.5 rounded-full">
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Granted</span>
              </div>
            </div>
          </div>

          {/* Permission 2: Battery */}
          <div className="bg-[#111118]/80 border border-green-500/30 rounded-2xl p-4 flex gap-4 bg-green-500/5">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-white">Battery Optimization</h3>
              </div>
              <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                Keep FocusFlow running in the background so sessions aren't cut short.
              </p>
              <div className="inline-flex items-center bg-green-500/20 border border-green-500/40 px-2 py-0.5 rounded-full">
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Granted</span>
              </div>
            </div>
          </div>

          {/* Permission 3: Usage Access */}
          <div className="bg-[#111118] border border-orange-500/40 rounded-2xl p-4 flex gap-4 relative overflow-hidden bg-orange-500/5">
            <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-[#6366f1]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-white">Usage Access</h3>
              </div>
              <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                Shows FocusFlow which app you opened, so it can block distractions.
              </p>
              <div className="inline-flex items-center bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 rounded-full">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Tap to Enable</span>
              </div>
            </div>
          </div>

          {/* Permission 4: Accessibility */}
          <div className="bg-[#111118] border border-orange-500/40 rounded-2xl p-4 flex gap-4 relative overflow-hidden bg-orange-500/5">
            <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-[#6366f1]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-white">Accessibility Service</h3>
              </div>
              <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                Lets FocusFlow redirect you away from blocked apps immediately.
              </p>
              <div className="inline-flex items-center bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 rounded-full">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Tap to Enable</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Button */}
        <div className="w-full mt-auto pt-2">
          <button className="w-full bg-[#6366f1]/50 text-white/70 font-bold py-4 rounded-xl text-lg flex items-center justify-center border border-[#6366f1]/30">
            Get Started <span className="ml-2">→</span>
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
