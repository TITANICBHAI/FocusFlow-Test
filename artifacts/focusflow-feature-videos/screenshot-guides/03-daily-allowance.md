# Screenshot Guide — Daily Allowance

**Video file:** `src/videos/features/DailyAllowance.tsx`
**Scenes:** 3 · ~22 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `daily-allowance-list.png`
**Where:** Side Menu → Daily Allowance (the main list screen).
**State:** At least 3 apps configured with different limit types. Ideally one at full usage (red bar), one at partial usage (amber bar), one fresh. Real usage numbers showing.
**Capture:** Full portrait screenshot of the list.

### Screenshot B — `allowance-config-screen.png`
**Where:** Tap any app in the Daily Allowance list to open its configuration screen.
**State:** The mode picker must be visible — showing Count / Time Budget / Interval options. One mode selected.
**Capture:** Full portrait screenshot.

### Screenshot C — `allowance-blocked-overlay.png`
**Where:** Use an app until its daily limit is reached, then open it again.
**State:** The app-blocked overlay shown specifically because the daily allowance was exhausted. Should ideally show "Daily limit reached" or equivalent message.
**Capture:** Full portrait screenshot of the block screen that appears.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `daily-allowance-list.png` | Scene 1 | Replace the 3-card mini allowance display (lines 34–50) with a phone frame containing the screenshot |
| `allowance-config-screen.png` | Scene 2 | Replace the 3-mode card layout (lines 82–99) with phone frame + screenshot |
| `allowance-blocked-overlay.png` | Scene 3 | Replace the animated usage bar card (lines 131–163) with phone frame + screenshot |

**Implementation note:** Scene 1 headline ("Per-app usage limits. You set the rules.") and subheadlines stay. Scene 3 can optionally keep the animated bar above the phone screenshot to show the concept visually before revealing the real screen.

**Import lines to add:**
```ts
import dailyAllowanceList from '@assets/screenshots/daily-allowance-list.png';
import allowanceConfigScreen from '@assets/screenshots/allowance-config-screen.png';
import allowanceBlockedOverlay from '@assets/screenshots/allowance-blocked-overlay.png';
```
