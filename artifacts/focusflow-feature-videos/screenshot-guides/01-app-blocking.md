# Screenshot Guide — App Blocking

**Video file:** `src/videos/features/AppBlocking.tsx`
**Scenes:** 4 · ~28 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `block-overlay.png`
**Where:** Open any blocked app (e.g. Instagram) while a Focus Session or Block Schedule is active.
**State:** The full-screen FocusFlow block overlay must be visible — the dark screen with the red 🚫 circle, "APP BLOCKED" text, the app name, and "FocusFlow is protecting your focus" at the bottom.
**Capture:** Full portrait screenshot. Make sure status bar is visible at top.

### Screenshot B — `app-list-blocked.png`
**Where:** Side Menu → Block Enforcement → App Blocking (the list of blocked apps).
**State:** At least 3 apps should be showing with their block type visible (Standalone, Schedule, or Focus).
**Capture:** Full portrait screenshot of this list screen.

### Screenshot C — `block-controls-menu.png`
**Where:** On any app row in the blocked apps list, swipe right (or tap the `›` arrow) to open the quick-action menu showing the 4 block modes.
**State:** The menu must be expanded showing: Standalone Block, Task Focus, Daily Allowance, Block Schedules.
**Capture:** Full portrait screenshot with the expanded row visible.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Component | Placement |
|---|---|---|---|
| `block-overlay.png` | Scene 2 | `PhoneMockup` inner content (lines 84–116) | Replace the coded dark overlay div with `<img src={blockOverlay} style={{width:'100%',height:'100%',objectFit:'cover'}} />` |
| `app-list-blocked.png` | Scene 3 | The 4-item list (lines 141–163) | Replace list div with phone frame + screenshot |
| `block-controls-menu.png` | Scene 3 | Same scene, shown after list | Swap the `items.map()` section with phone screenshot |

**Implementation note:** Scene 1 is text-only ("Apps that steal your focus") — no screenshot needed, keep as-is. Scene 4 is the "47 apps blocked today" counter — keep as-is (pure animation, no real UI).

**Import line to add at top:**
```ts
import blockOverlay from '@assets/screenshots/block-overlay.png';
import appListBlocked from '@assets/screenshots/app-list-blocked.png';
```
