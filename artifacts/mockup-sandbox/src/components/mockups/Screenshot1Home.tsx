import React from 'react';
import { CheckCircle2, ChevronForward, Shield, Lock, Activity, Settings, Moon, Menu, Search, MoreHorizontal, Bell } from 'lucide-react';

const PhoneFrame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <div className="w-full h-screen bg-[#000000] flex items-center justify-center relative font-sans text-white overflow-hidden">
    {/* Glow effect behind phone */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[60vh] h-[60vh] bg-indigo-500/10 rounded-full blur-[100px]"></div>
    </div>
    
    <div className="relative aspect-[9/16] h-[82vh] max-h-[900px] border-[10px] border-[#1a1a24] rounded-[48px] bg-[#0a0a0f] overflow-hidden shadow-2xl flex flex-col">
      {/* Dynamic Island */}
      <div className="absolute top-0 inset-x-0 flex justify-center z-50 pt-2">
        <div className="w-32 h-8 bg-black rounded-full"></div>
      </div>
      
      {/* Top Status Bar (fake) */}
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

      {/* App Content */}
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

export default function Screenshot1Home() {
  return (
    <PhoneFrame caption="Smart Daily Scheduling">
      <div className="px-6 pt-4 pb-8 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-white">Today</h1>
            <p className="text-[#6366f1] text-sm font-medium mt-1">Thursday, Oct 24</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#111118] border border-white/5 flex items-center justify-center">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Daily Progress</span>
            <span className="text-white font-medium">3 of 5 tasks done</span>
          </div>
          <div className="h-2 bg-[#111118] rounded-full overflow-hidden">
            <div className="h-full bg-[#6366f1] w-[60%] rounded-full"></div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-4 flex-1">
          {/* Active Task */}
          <div className="bg-[#111118] border border-[#6366f1]/30 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6366f1]"></div>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-xs font-bold text-green-400 tracking-wider">ACTIVE NOW</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Morning Study Session</h3>
                <p className="text-gray-400 text-sm">09:00 – 11:00</p>
              </div>
              <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Upcoming Task 1 */}
          <div className="bg-[#111118]/50 border border-white/5 rounded-2xl p-4 relative overflow-hidden opacity-80">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-600"></div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-gray-500 tracking-wider mb-1 block">UPCOMING</span>
                <h3 className="text-white font-medium mb-1">Team Meeting</h3>
                <p className="text-gray-500 text-sm">11:30 – 12:00</p>
              </div>
            </div>
          </div>

          {/* Upcoming Task 2 */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6366f1]/50"></div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-[#6366f1] tracking-wider mb-1 block">UPCOMING</span>
                <h3 className="text-white font-medium mb-1">Deep Work: Project X</h3>
                <p className="text-gray-400 text-sm">13:00 – 15:00</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="mt-auto pt-4 flex justify-between items-center px-4 border-t border-white/5">
          <div className="flex flex-col items-center text-[#6366f1]">
            <CheckCircle2 className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Tasks</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <Shield className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Focus</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <Activity className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Stats</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <Settings className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Settings</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
