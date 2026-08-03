# Screenshot Guide — Overlay Appearance

**Video file:** `src/videos/features/OverlayAppearance.tsx`
**Scenes:** 3 · ~24 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `overlay-live-dark.png`
**Where:** Trigger a block on any app so the block overlay appears over it.
**State:** The full overlay visible — your custom quote (or the default one) showing on your custom background/wallpaper. This is the real overlay that appears on your phone when an app is blocked.
**Capture:** Full portrait screenshot. This is the hero shot — make it look good (set a good wallpaper and quote first if possible).

### Screenshot B — `overlay-settings-quotes.png`
**Where:** Side Menu → Overlay Appearance → Custom Quotes section (or wherever quotes are managed).
**State:** The quote input field visible, plus at least 1–2 existing quotes listed below it.
**Capture:** Full portrait screenshot.

### Screenshot C — `overlay-settings-wallpaper.png`
**Where:** Side Menu → Overlay Appearance → Wallpaper / Background section.
**State:** The wallpaper options visible — built-in presets (dark gradient, forest, ocean) and the "choose from gallery" option. One should be selected/highlighted.
**Capture:** Full portrait screenshot.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `overlay-live-dark.png` | Scene 1 | Replace `BlockOverlayPreview` component (lines 57–67) with the real screenshot in a phone frame. The `quoteIndex` cycling animation can stay but just rotate a caption text instead of re-rendering |
| `overlay-settings-quotes.png` | Scene 2 | Replace the animated quote input card (lines 95–114) with a phone frame + screenshot |
| `overlay-settings-wallpaper.png` | Scene 3 | Replace the 4 wallpaper preview swatches (lines 140–151) with a phone frame screenshot; keep the "Result →" panel next to it using `overlay-live-dark.png` |

**Implementation note:** Scene 1 is the most important — `overlay-live-dark.png` will appear in both Scene 1 AND the Scene 3 "Result →" panel on the right side. One screenshot, two uses.

**Import lines to add:**
```ts
import overlayLiveDark from '@assets/screenshots/overlay-live-dark.png';
import overlaySettingsQuotes from '@assets/screenshots/overlay-settings-quotes.png';
import overlaySettingsWallpaper from '@assets/screenshots/overlay-settings-wallpaper.png';
```
