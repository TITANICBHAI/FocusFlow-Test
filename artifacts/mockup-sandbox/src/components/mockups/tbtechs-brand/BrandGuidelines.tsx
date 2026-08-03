import React from "react";
import { Check, X, Shield, Code, Palette, Accessibility, Type, FileText } from "lucide-react";

export function BrandGuidelines() {
  return (
    <div 
      className="min-h-screen text-slate-200 selection:bg-indigo-500/30" 
      style={{ 
        backgroundColor: "#0E0F1A",
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap');
        
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        
        :root {
          --color-primary: #6366F1;
          --color-electric: #22D3EE;
          --color-deep: #7C3AED;
          --color-surface: #0E0F1A;
          --color-surface-mid: #1A1D2E;
          --color-border: #2D3148;
          --color-text: #E2E8F0;
          --color-muted: #8892A4;
        }
      `}} />

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-24">
        {/* Header */}
        <header className="space-y-4 border-b border-[#2D3148] pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1D2E] border border-[#2D3148] text-sm font-medium text-[#8892A4] mb-4">
            <Shield className="w-4 h-4 text-[#6366F1]" />
            Brand Manual v1.0
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-white">
            Brand Guidelines
          </h1>
          <p className="text-xl text-[#8892A4] max-w-2xl leading-relaxed">
            The definitive reference for designers and developers working on TBTechs and FocusFlow products.
          </p>
        </header>

        {/* Section 1: Brand Identity */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-white flex items-center gap-3">
              <FileText className="text-[#6366F1] w-8 h-8" />
              1. Brand Identity
            </h2>
            <p className="text-[#8892A4]">The core foundation of who we are and what we build.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl p-8 space-y-4">
              <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Name Architecture</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-[#2D3148] pb-2">
                  <span className="text-[#8892A4]">Company</span>
                  <strong className="font-display text-lg text-white">TBTechs</strong>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#8892A4]">Product</span>
                  <strong className="font-display text-lg text-white">FocusFlow</strong>
                </div>
              </div>
            </div>

            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl p-8 space-y-4">
              <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Mission Statement</div>
              <blockquote className="font-display text-xl text-white font-medium italic border-l-4 border-[#6366F1] pl-4">
                "We build tools that give people hard control over their digital attention."
              </blockquote>
            </div>

            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl p-8 space-y-4 md:col-span-2">
              <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Brand Positioning</div>
              <p className="font-display text-2xl text-white font-medium">
                "The only free screen time blocker with three stacked enforcement layers."
              </p>
            </div>

            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl p-8 space-y-4 md:col-span-2">
              <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Target Audience</div>
              <ul className="grid md:grid-cols-3 gap-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-[#22D3EE] shrink-0" />
                  <span className="text-slate-300">Students needing extreme focus</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-[#22D3EE] shrink-0" />
                  <span className="text-slate-300">Knowledge workers battling distraction</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-[#22D3EE] shrink-0" />
                  <span className="text-slate-300">Anyone who wants hard limits, not gentle reminders</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: Voice & Tone */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-white flex items-center gap-3">
              <Type className="text-[#6366F1] w-8 h-8" />
              2. Voice & Tone
            </h2>
            <p className="text-[#8892A4]">How we sound: Mission-driven · Uncompromising · Technical · Righteous · Direct</p>
          </div>

          <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2D3148]">
                  <th className="p-6 text-sm font-medium text-white bg-[#6366F1]/10 w-1/2">
                    <div className="flex items-center gap-2"><Check className="text-[#6366F1] w-5 h-5" /> DO</div>
                  </th>
                  <th className="p-6 text-sm font-medium text-white bg-red-500/10 w-1/2 border-l border-[#2D3148]">
                    <div className="flex items-center gap-2"><X className="text-red-400 w-5 h-5" /> DON'T</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3148]">
                <tr>
                  <td className="p-6 text-slate-300 font-medium">"Take back your time"</td>
                  <td className="p-6 text-[#8892A4] border-l border-[#2D3148]">"Achieve digital wellness"</td>
                </tr>
                <tr>
                  <td className="p-6 text-slate-300 font-medium">"12 apps blocked. Zero exceptions."</td>
                  <td className="p-6 text-[#8892A4] border-l border-[#2D3148]">"We gently reminded you"</td>
                </tr>
                <tr>
                  <td className="p-6 text-slate-300 font-medium">"They built the addiction. We built the exit."</td>
                  <td className="p-6 text-[#8892A4] border-l border-[#2D3148]">"Balance your screen time"</td>
                </tr>
                <tr>
                  <td className="p-6 text-slate-300 font-medium">"System Guard activated."</td>
                  <td className="p-6 text-[#8892A4] border-l border-[#2D3148]">"Feature enabled successfully!"</td>
                </tr>
                <tr>
                  <td className="p-6 text-slate-300 font-medium">"Zero loopholes. Zero compromises."</td>
                  <td className="p-6 text-[#8892A4] border-l border-[#2D3148]">"Premium experience unlocked"</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="font-display text-xl font-bold text-white">Copy Context Examples</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-[#2D3148] bg-gradient-to-b from-[#1A1D2E] to-[#0E0F1A]">
                <div className="text-xs font-semibold text-[#8892A4] uppercase tracking-wider mb-3">Hero Headline</div>
                <div className="font-display text-2xl font-bold text-white">They engineered your addiction.<br/><span className="text-[#6366F1]">We engineered the exit.</span></div>
              </div>
              <div className="p-6 rounded-xl border border-[#2D3148] bg-gradient-to-b from-[#1A1D2E] to-[#0E0F1A]">
                <div className="text-xs font-semibold text-[#8892A4] uppercase tracking-wider mb-3">Onboarding Welcome</div>
                <div className="text-lg font-medium text-slate-200">You took back control. Let's make it permanent.</div>
              </div>
              <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="text-xs font-semibold text-red-400/80 uppercase tracking-wider mb-3">Error Message</div>
                <div className="font-medium text-red-200">Block failed. Retrying. We don't give up easily.</div>
              </div>
              <div className="p-6 rounded-xl border border-[#2D3148] bg-gradient-to-b from-[#1A1D2E] to-[#0E0F1A] border-dashed">
                <div className="text-xs font-semibold text-[#8892A4] uppercase tracking-wider mb-3">Empty State</div>
                <div className="text-slate-400">No active blocks. Your attention is unguarded.</div>
              </div>
              <div className="md:col-span-2 flex justify-center p-8 rounded-xl border border-[#2D3148] bg-[#1A1D2E]">
                <div className="text-center space-y-4 w-full max-w-sm">
                  <div className="text-xs font-semibold text-[#8892A4] uppercase tracking-wider mb-2">CTA Button</div>
                  <button className="w-full py-4 px-6 bg-[#6366F1] hover:bg-[#5558DD] text-white font-display font-bold rounded-lg transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                    Take back your time
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Color Usage */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-white flex items-center gap-3">
              <Palette className="text-[#6366F1] w-8 h-8" />
              3. Color Usage Rules
            </h2>
            <p className="text-[#8892A4]">Strict guidelines for applying the palette across interfaces.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Primary Indigo */}
            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl overflow-hidden">
              <div className="h-32 bg-[#6366F1] flex flex-col justify-end p-4">
                <div className="font-display font-bold text-white">Primary Indigo</div>
                <div className="text-indigo-200 text-sm font-mono">#6366F1</div>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">Use for CTAs, active states, key UI elements.</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-slate-400">Don't use for body text on dark backgrounds.</span>
                </div>
              </div>
            </div>

            {/* Electric Blue */}
            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl overflow-hidden">
              <div className="h-32 bg-[#22D3EE] flex flex-col justify-end p-4">
                <div className="font-display font-bold text-slate-900">Electric Blue</div>
                <div className="text-cyan-800 text-sm font-mono">#22D3EE</div>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">Use for gradients, highlights, data viz.</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-slate-400">Don't use as background color.</span>
                </div>
              </div>
            </div>

            {/* Deep Purple */}
            <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl overflow-hidden">
              <div className="h-32 bg-[#7C3AED] flex flex-col justify-end p-4">
                <div className="font-display font-bold text-white">Deep Purple</div>
                <div className="text-purple-200 text-sm font-mono">#7C3AED</div>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">Use for secondary/gradient ends.</span>
                </div>
                <div className="flex items-start gap-2">
                  <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-slate-400">Don't use alone without contrast check.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Accessibility */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-white flex items-center gap-3">
              <Accessibility className="text-[#6366F1] w-8 h-8" />
              4. Accessibility Standards
            </h2>
            <p className="text-[#8892A4]">Non-negotiable requirements for inclusive design.</p>
          </div>

          <div className="bg-[#1A1D2E] border border-[#2D3148] rounded-2xl p-8 grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2 border-b border-[#2D3148] pb-4">
                <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Typography</div>
                <div className="text-slate-200 font-medium">16px web / 14px mobile minimum</div>
              </div>
              <div className="space-y-2 border-b border-[#2D3148] pb-4">
                <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Touch Targets</div>
                <div className="flex items-center gap-4">
                  <div className="text-slate-200 font-medium">44x44px minimum</div>
                  <div className="w-[44px] h-[44px] border border-dashed border-[#6366F1] bg-[#6366F1]/10 rounded flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-[#6366F1]" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 pb-4">
                <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Contrast</div>
                <div className="text-slate-200 font-medium">WCAG AA (4.5:1) on dark surfaces</div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2 border-b border-[#2D3148] pb-4">
                <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Motion</div>
                <div className="text-slate-200 font-medium">Respect `prefers-reduced-motion`</div>
                <p className="text-sm text-[#8892A4]">If animations used, always provide a fallback static state.</p>
              </div>
              <div className="space-y-2 pb-4">
                <div className="text-sm font-medium text-[#8892A4] uppercase tracking-wider">Iconography</div>
                <div className="text-slate-200 font-medium">Legible at 24px</div>
                <div className="flex gap-2 text-[#8892A4]">
                  <Shield className="w-6 h-6" />
                  <Code className="w-6 h-6" />
                  <Accessibility className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Design Tokens */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-white flex items-center gap-3">
              <Code className="text-[#6366F1] w-8 h-8" />
              5. CSS Design Tokens
            </h2>
            <p className="text-[#8892A4]">Root variables for implementation across codebases.</p>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-[#0A0B10] border border-[#2D3148]">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#1A1D2E] border-b border-[#2D3148]">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-[#8892A4]">theme.css</span>
            </div>
            <pre className="p-6 overflow-x-auto text-sm font-mono leading-relaxed">
              <code className="text-emerald-300">:root</code> <code className="text-slate-300">{`{`}</code>{`\n`}
              <code className="text-[#8892A4]">  /* Colors */</code>{`\n`}
              <code className="text-cyan-200">  --color-primary:</code> <code className="text-indigo-300">#6366F1</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --color-electric:</code> <code className="text-indigo-300">#22D3EE</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --color-deep:</code> <code className="text-indigo-300">#7C3AED</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --color-surface:</code> <code className="text-indigo-300">#0E0F1A</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --color-surface-mid:</code> <code className="text-indigo-300">#1A1D2E</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --color-text:</code> <code className="text-indigo-300">#E2E8F0</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --color-muted:</code> <code className="text-indigo-300">#8892A4</code><code className="text-slate-300">;</code>{`\n\n`}
              <code className="text-[#8892A4]">  /* Typography */</code>{`\n`}
              <code className="text-cyan-200">  --font-display:</code> <code className="text-amber-200">'Space Grotesk'</code><code className="text-slate-300">, system-ui, sans-serif;</code>{`\n`}
              <code className="text-cyan-200">  --font-body:</code> <code className="text-amber-200">'Inter'</code><code className="text-slate-300">, system-ui, sans-serif;</code>{`\n\n`}
              <code className="text-[#8892A4]">  /* Radii */</code>{`\n`}
              <code className="text-cyan-200">  --radius-sm:</code> <code className="text-fuchsia-300">6px</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --radius-md:</code> <code className="text-fuchsia-300">10px</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-cyan-200">  --radius-lg:</code> <code className="text-fuchsia-300">16px</code><code className="text-slate-300">;</code>{`\n`}
              <code className="text-slate-300">{`}`}</code>
            </pre>
          </div>
        </section>

      </div>
    </div>
  );
}

export default BrandGuidelines;
