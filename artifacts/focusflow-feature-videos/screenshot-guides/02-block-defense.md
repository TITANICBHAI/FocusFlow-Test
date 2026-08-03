# Screenshot Guide — Block Defense

**Video file:** `src/videos/features/BlockDefense.tsx`
**Scenes:** 4 · ~30 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `block-enforcement-menu.png`
**Where:** Side Menu → Block Enforcement (the main enforcement hub screen).
**State:** The screen showing all 4 enforcement sections: System Protection, Aversion Deterrents, PIN Protection, Nuclear Mode — all collapsed as a menu list.
**Capture:** Full portrait screenshot.

### Screenshot B — `system-protection-toggles.png`
**Where:** Side Menu → Block Enforcement → System Protection.
**State:** All toggles turned ON — System Protection, YouTube Shorts Block, Instagram Reels Block, Block Install Actions all showing as enabled (green).
**Capture:** Full portrait screenshot showing all 4 rows with toggles.

### Screenshot C — `aversion-settings.png`
**Where:** Side Menu → Block Enforcement → Aversion Deterrents.
**State:** At least Dimmer and Vibration enabled. The screen showing the three aversion options with their toggle states.
**Capture:** Full portrait screenshot.

### Screenshot D — `pin-protection-screen.png`
**Where:** Side Menu → Block Enforcement → PIN Protection (or wherever Defense Password is set).
**State:** The screen showing Focus Session Password and Defense Password options.
**Capture:** Full portrait screenshot.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `block-enforcement-menu.png` | Scene 1 | Replace the 4-item layer list (`items.map()` lines 47–67) with a centered phone frame containing the screenshot |
| `system-protection-toggles.png` | Scene 2 | Replace the `items.map()` toggle list (lines 91–99) with phone frame + screenshot |
| `aversion-settings.png` | Scene 3 | Replace the 3-card deterrent layout (lines 122–135) with phone frame + screenshot |
| `pin-protection-screen.png` | Scene 4 | Replace the two PIN cards layout (lines 162–181) with phone frame + screenshot |

**Implementation note:** Keep all animated text headings and subheadings for each scene — only the UI demo section gets replaced with the screenshot. Scene 4's Nuclear Mode warning card at the bottom stays as-is.

**Import lines to add:**
```ts
import blockEnforcementMenu from '@assets/screenshots/block-enforcement-menu.png';
import systemProtectionToggles from '@assets/screenshots/system-protection-toggles.png';
import aversionSettings from '@assets/screenshots/aversion-settings.png';
import pinProtectionScreen from '@assets/screenshots/pin-protection-screen.png';
```
