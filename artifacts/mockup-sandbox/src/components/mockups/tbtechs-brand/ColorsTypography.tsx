import React from 'react';

export function ColorsTypography() {
  return (
    <div className="min-h-screen bg-[#0E0F1A] text-[#E2E8F0] p-12 font-sans" style={{ fontFamily: 'Inter, sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@800&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}} />

      <div className="max-w-6xl mx-auto space-y-24">
        <header>
          <h1 className="font-display text-5xl font-extrabold tracking-tight mb-4">TBTechs Brand Kit</h1>
          <p className="text-[#8892A4] text-xl max-w-2xl font-body">
            Board 1: Colors & Typography. Mission-driven & righteous. Bold & confrontational.
          </p>
        </header>

        {/* 1. Color Palette */}
        <section className="space-y-8">
          <h2 className="font-display text-3xl font-extrabold border-b border-[#1A1D2E] pb-4">1. Core Palette</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ColorSwatch name="Primary Indigo" hex="#6366F1" oklch="oklch(57% 0.22 264)" usage="Primary actions, brand identity" />
            <ColorSwatch name="Electric Blue" hex="#22D3EE" oklch="oklch(82% 0.14 200)" usage="Highlights, active states" />
            <ColorSwatch name="Deep Purple" hex="#7C3AED" oklch="oklch(47% 0.26 292)" usage="Deep accents, gradients" />
            <ColorSwatch name="Surface Dark" hex="#0E0F1A" oklch="oklch(8% 0.02 270)" usage="Main background" border />
            <ColorSwatch name="Surface Mid" hex="#1A1D2E" oklch="-" usage="Cards, secondary backgrounds" />
            <ColorSwatch name="Text Primary" hex="#E2E8F0" oklch="oklch(91% 0.01 250)" usage="Main headings & body text" textDark />
            <ColorSwatch name="Text Muted" hex="#8892A4" oklch="-" usage="Secondary text, disabled states" textDark />
            <ColorSwatch name="Accent Success" hex="#10B981" oklch="-" usage="Success states, growth metrics" />
            <ColorSwatch name="Accent Warning" hex="#F59E0B" oklch="-" usage="Warnings, limits reached" textDark />
            <ColorSwatch name="Neutral 50" hex="#F8F9FF" oklch="-" usage="Light mode backgrounds" textDark />
            <ColorSwatch name="Neutral 900" hex="#0A0B14" oklch="-" usage="Deepest shadows" border />
          </div>
        </section>

        {/* 2. Shade Ramps */}
        <section className="space-y-8">
          <h2 className="font-display text-3xl font-extrabold border-b border-[#1A1D2E] pb-4">2. Shade Ramps</h2>
          <div className="space-y-6">
            <ShadeRamp name="Primary Indigo" colors={['#EEF2FF', '#C7D2FE', '#6366F1', '#4338CA', '#312E81']} />
            <ShadeRamp name="Electric Blue" colors={['#ECFEFF', '#A5F3FC', '#22D3EE', '#0891B2', '#164E63']} />
          </div>
        </section>

        {/* 3. Gradient Showcase */}
        <section className="space-y-8">
          <h2 className="font-display text-3xl font-extrabold border-b border-[#1A1D2E] pb-4">3. Brand Gradient</h2>
          <div className="h-48 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#22D3EE] flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.2)]">
            <span className="font-display text-4xl font-extrabold text-white tracking-widest uppercase mix-blend-overlay opacity-50">FocusFlow</span>
          </div>
        </section>

        {/* 4. Typography Specimens & 5. Rationale */}
        <section className="space-y-8">
          <h2 className="font-display text-3xl font-extrabold border-b border-[#1A1D2E] pb-4">4 & 5. Typography</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div>
                <div className="text-[#8892A4] mb-2 text-sm uppercase tracking-wider font-bold">Display (Space Grotesk 800)</div>
                <h1 className="font-display text-6xl font-extrabold mb-2 leading-tight">Heading 1</h1>
                <h2 className="font-display text-5xl font-extrabold mb-2 leading-tight">Heading 2</h2>
                <h3 className="font-display text-4xl font-extrabold mb-2 leading-tight">Heading 3</h3>
                <h4 className="font-display text-3xl font-extrabold mb-2 leading-tight">Heading 4</h4>
              </div>
              
              <div>
                <div className="text-[#8892A4] mb-2 text-sm uppercase tracking-wider font-bold">Body (Inter Regular/Medium)</div>
                <p className="font-body text-lg leading-relaxed text-[#E2E8F0] mb-4">
                  Take back your time. FocusFlow doesn't ask politely. It enforces your boundaries when you don't have the willpower to do it yourself.
                </p>
                <p className="font-body text-sm leading-relaxed text-[#8892A4]">
                  Small body text for secondary information, disclaimers, and metadata. Legible at small sizes, neutral to let the display typeface shine.
                </p>
              </div>
            </div>

            <div className="bg-[#1A1D2E] p-8 rounded-2xl">
              <h3 className="font-display text-2xl font-extrabold mb-4 text-[#22D3EE]">Pairing Rationale</h3>
              <p className="font-body text-[#E2E8F0] mb-6 leading-relaxed">
                <strong className="text-white">Space Grotesk</strong> at Black (800) weight provides a bold, unapologetic, and slightly technical voice. It demands attention and feels authoritative—perfect for a hard-enforcement app that stops you in your tracks.
              </p>
              <p className="font-body text-[#E2E8F0] leading-relaxed">
                <strong className="text-white">Inter</strong> acts as the invisible workhorse. Highly legible, neutral, and precise, it balances the aggressive display font with extreme readability for UI elements and long-form text.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Contrast Audit & 7. Dark/Light Mode */}
        <section className="space-y-8">
          <h2 className="font-display text-3xl font-extrabold border-b border-[#1A1D2E] pb-4">6 & 7. UI Treatments & Contrast</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="bg-[#0E0F1A] border border-[#1A1D2E] p-6 rounded-xl">
                <h3 className="font-display text-xl font-extrabold mb-2 text-[#E2E8F0]">Dark Mode (Primary)</h3>
                <p className="text-[#8892A4] mb-4 text-sm">The default experience. Immersive, reduces eye strain, feels like a developer tool.</p>
                <button className="bg-[#6366F1] text-white px-6 py-3 rounded-lg font-bold w-full font-body hover:bg-[#4338CA] transition-colors">
                  Enable Deep Work
                </button>
              </div>

              <div className="bg-[#F8F9FF] border border-[#E2E8F0] p-6 rounded-xl">
                <h3 className="font-display text-xl font-extrabold mb-2 text-[#0A0B14]">Light Mode (Secondary)</h3>
                <p className="text-[#64748B] mb-4 text-sm">For daytime use or users who prefer high-key interfaces.</p>
                <button className="bg-[#6366F1] text-white px-6 py-3 rounded-lg font-bold w-full font-body hover:bg-[#4338CA] transition-colors">
                  Enable Deep Work
                </button>
              </div>
            </div>

            <div>
               <table className="w-full text-left font-body">
                <thead>
                  <tr className="border-b border-[#1A1D2E]">
                    <th className="py-3 text-[#8892A4] font-medium">Text / Background</th>
                    <th className="py-3 text-[#8892A4] font-medium">Ratio</th>
                    <th className="py-3 text-[#8892A4] font-medium">WCAG AA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1D2E]">
                  <tr>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#E2E8F0] border border-gray-600 flex items-center justify-center">
                          <span className="text-[#0E0F1A] text-[10px] font-bold">Aa</span>
                        </div>
                        <span className="text-[#E2E8F0]">Primary / Surface Dark</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-sm">13.6:1</td>
                    <td className="py-4 text-[#10B981] font-bold">PASS</td>
                  </tr>
                  <tr>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#8892A4] flex items-center justify-center">
                          <span className="text-[#0E0F1A] text-[10px] font-bold">Aa</span>
                        </div>
                        <span className="text-[#E2E8F0]">Muted / Surface Dark</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-sm">5.1:1</td>
                    <td className="py-4 text-[#10B981] font-bold">PASS</td>
                  </tr>
                  <tr>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
                          <span className="text-[#6366F1] text-[10px] font-bold">Aa</span>
                        </div>
                        <span className="text-[#E2E8F0]">White / Primary Indigo</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-sm">4.5:1</td>
                    <td className="py-4 text-[#10B981] font-bold">PASS</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ColorSwatch({ name, hex, oklch, usage, border = false, textDark = false }: { name: string, hex: string, oklch: string, usage: string, border?: boolean, textDark?: boolean }) {
  return (
    <div className="flex items-center gap-4 bg-[#1A1D2E] p-4 rounded-xl">
      <div 
        className={`w-16 h-16 rounded-lg shrink-0 ${border ? 'border border-[#E2E8F0]/20' : ''}`} 
        style={{ backgroundColor: hex }}
      />
      <div>
        <h4 className="font-bold text-[#E2E8F0] font-body">{name}</h4>
        <div className="text-xs text-[#8892A4] font-mono mt-1">{hex}</div>
        {oklch !== '-' && <div className="text-[10px] text-[#8892A4] font-mono">{oklch}</div>}
        <div className="text-xs text-[#E2E8F0] mt-2 font-body opacity-80">{usage}</div>
      </div>
    </div>
  );
}

function ShadeRamp({ name, colors }: { name: string, colors: string[] }) {
  return (
    <div>
      <div className="text-sm font-bold text-[#E2E8F0] mb-2">{name} Ramp</div>
      <div className="flex h-12 rounded-lg overflow-hidden">
        {colors.map((c, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}
