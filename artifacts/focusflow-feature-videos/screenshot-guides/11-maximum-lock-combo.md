# Screenshot Guide — Maximum Lock (Combo)

**Video file:** `src/videos/combos/MaximumLock.tsx`
**Scenes:** 5 · ~37 sec total

> This is the most intense combo video — it shows every enforcement layer stacked: System Protection + VPN Block + Keyword Blocker + Nuclear Mode.

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `maxlock-system-protection-all-on.png`
**Where:** Side Menu → Block Enforcement → System Protection.
**State:** ALL toggles ON and green — System Protection, YouTube Shorts Block, Instagram Reels Block, Block Install Actions. Every row glowing green.
**Capture:** Full portrait screenshot. This is the "Layer 1" shot — make sure every toggle is on.

> **You already have this if you captured `system-protection-toggles.png` for video 02. Reuse it.**

### Screenshot B — `maxlock-vpn-all-on.png`
**Where:** Block Enforcement → System Protection → VPN Block (or the VPN sub-screen).
**State:** VPN Block toggle ON. Per-app list showing Instagram, YouTube, TikTok, Twitter all with VPN ON. VPN Self-Heal active.
**Capture:** Full portrait screenshot.

> **You already have this if you captured `per-app-vpn-list.png` for video 06. Reuse it.**

### Screenshot C — `maxlock-keyword-presets-on.png`
**Where:** Side Menu → Keyword Blocker.
**State:** 3 presets enabled and green — Doomscroll bait, Social-media drama, Shorts/Reels bait. All showing ACTIVE badge.
**Capture:** Full portrait screenshot.

> **You already have this if you captured `keyword-list-screen.png` for video 05. Reuse it.**

### Screenshot D — `maxlock-nuclear-mode.png`
**Where:** Block Enforcement → Nuclear Mode (the section for permanently uninstalling apps).
**State:** The list of "addictive apps" you've marked for nuclear mode. At least one showing the "Uninstall" button. Ideally one showing "✓ Removed" if you've already nuked an app.
**Capture:** Full portrait screenshot.

> **⚠️ Warning:** Do NOT actually tap "Uninstall" while taking the screenshot unless you genuinely want to remove the app. Just navigate to the screen and screenshot the list.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| *(none)* | Scene 1 | Keep as-is — the 4-card "layer intro" animation is the right teaser here, no screenshot needed |
| `maxlock-system-protection-all-on.png` | Scene 2 | Replace the 4-item toggle list (lines 89–99) with a phone frame screenshot |
| `maxlock-vpn-all-on.png` | Scene 3 | Replace the VPN toggle + per-app list + self-heal row (lines 125–156) with a phone frame screenshot |
| `maxlock-keyword-presets-on.png` | Scene 4 | Replace the 3-preset list (lines 181–200) with a phone frame screenshot |
| `maxlock-nuclear-mode.png` | Scene 5 | Replace the app uninstall list card (lines 231–252) with a phone frame screenshot; keep the "Maximum Lock Mode. Nothing gets through." closing line |

**Implementation note:** Scene 5's "Instagram — Uninstalling… → ✓ Removed" animation can be overlaid as a caption on top of the screenshot if the screenshot itself doesn't show the uninstall-in-progress state. This makes the video still feel dynamic even with a static screenshot.

**Import lines to add:**
```ts
import maxlockSystemProtection from '@assets/screenshots/maxlock-system-protection-all-on.png';
import maxlockVpnAllOn from '@assets/screenshots/maxlock-vpn-all-on.png';
import maxlockKeywordPresets from '@assets/screenshots/maxlock-keyword-presets-on.png';
import maxlockNuclearMode from '@assets/screenshots/maxlock-nuclear-mode.png';
```
