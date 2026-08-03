import React from 'react';
import { Activity, CheckCircle2, Shield, Settings, TrendingUp } from 'lucide-react';

const PhoneFrame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <div className="w-full h-screen bg-[#000000] flex items-center justify-center relative font-sans text-white overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[60vh] h-[60vh] bg-indigo-500/5 rounded-full blur-[100px]"></div>
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

export default function Screenshot4Stats() {
  const chartData = [
    { day: 'Mon', height: 40 },
    { day: 'Tue', height: 85 },
    { day: 'Wed', height: 60 },
    { day: 'Thu', height: 95 },
    { day: 'Fri', height: 30 },
  ];

  return (
    <PhoneFrame caption="Accountability & Progress">
      <div className="px-6 pt-4 pb-8 flex-1 flex flex-col overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-white">This Week</h1>
          <p className="text-gray-400 text-sm mt-1">Oct 21 - Oct 25</p>
        </div>

        {/* Chart */}
        <div className="bg-[#111118] border border-white/5 rounded-3xl p-6 mb-6">
          <div className="flex justify-between items-end mb-3" style={{ height: 120 }}>
            {chartData.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-2" style={{ flex: 1 }}>
                <div
                  className={`w-7 rounded-t-xl ${d.height > 80 ? 'bg-gradient-to-t from-[#6366f1] to-[#818cf8]' : 'bg-[#6366f1]/25'}`}
                  style={{ height: Math.round((d.height / 100) * 110) }}
                />
                <span className={`text-xs leading-none ${d.height > 80 ? 'text-white font-bold' : 'text-gray-500'}`}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#111118] border border-[#6366f1]/30 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <CheckCircle2 className="w-24 h-24 text-[#6366f1]" />
            </div>
            <div className="text-gray-400 text-sm mb-2">Completion</div>
            <div className="text-3xl font-bold text-white font-['Space_Grotesk']">87%</div>
          </div>
          <div className="bg-[#111118] border border-white/5 p-5 rounded-2xl">
            <div className="text-gray-400 text-sm mb-2">Focus Time</div>
            <div className="text-3xl font-bold text-white font-['Space_Grotesk']">14.2h</div>
          </div>
          <div className="bg-[#111118] border border-orange-500/20 p-5 rounded-2xl col-span-2 flex justify-between items-center">
            <div>
              <div className="text-orange-400/80 text-sm mb-1 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Current Streak
              </div>
              <div className="text-2xl font-bold text-white font-['Space_Grotesk']">3 days</div>
            </div>
            <div className="text-4xl">🔥</div>
          </div>
        </div>

        {/* Focus Violations */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white mb-4 font-['Space_Grotesk']">Focus Violations</h2>
          <div className="space-y-3">
            <div className="bg-[#111118] rounded-xl p-4 flex justify-between items-center border border-white/5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-yellow-400 to-pink-500 mr-3"></div>
                <span className="font-medium text-white">Instagram</span>
              </div>
              <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold">
                3x
              </div>
            </div>
            <div className="bg-[#111118] rounded-xl p-4 flex justify-between items-center border border-white/5">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded bg-red-600 mr-3 flex items-center justify-center">
                  <div className="w-3 h-2 bg-white rounded-sm"></div>
                </div>
                <span className="font-medium text-white">YouTube</span>
              </div>
              <div className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-bold">
                1x
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="mt-auto pt-4 flex justify-between items-center px-4 border-t border-white/5 bg-[#0a0a0f]">
          <div className="flex flex-col items-center text-gray-500">
            <CheckCircle2 className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Tasks</span>
          </div>
          <div className="flex flex-col items-center text-gray-500">
            <Shield className="w-6 h-6 mb-1" />
            <span className="text-[10px]">Focus</span>
          </div>
          <div className="flex flex-col items-center text-[#6366f1]">
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
