# Screenshot Guide — Focus Sessions

**Video file:** `src/videos/features/FocusSessions.tsx`
**Scenes:** 4 · ~30 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `schedule-tab.png`
**Where:** Schedule tab (main task list for the day).
**State:** At least 3 tasks visible. One should show "NOW" or be highlighted as active. At least one should have the "FOCUS" badge. Real times and task names.
**Capture:** Full portrait screenshot.

### Screenshot B — `focus-tab-active.png`
**Where:** Focus tab while a Focus Session is actively running.
**State:** The countdown ring must be visible and counting down. Task name shown. "Focus Mode active · Distraction apps blocked" text visible. Pomodoro indicator visible if enabled.
**Capture:** Full portrait screenshot — capture mid-session so the ring is partially filled.

### Screenshot C — `focus-block-overlay.png`
**Where:** While a Focus Session is active, open a blocked app (e.g. Instagram).
**State:** The block overlay appears. Should show "APP BLOCKED", the app name, and "FocusFlow is protecting your focus".
**Capture:** Full portrait screenshot of the overlay.

### Screenshot D — `focus-session-stats.png`
**Where:** Stats tab → Today view (while session is running or just after).
**State:** Focus minutes, distractions blocked, and current streak numbers are all visible. Real numbers from your actual usage.
**Capture:** Full portrait screenshot of the Today stats view.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `schedule-tab.png` | Scene 1 | Replace the task list (lines 36–60) with a phone frame containing the screenshot |
| `focus-tab-active.png` | Scene 2 | Replace the SVG ring + timer div (lines 91–102) with a phone frame screenshot; keep heading text above |
| `focus-block-overlay.png` | Scene 3 | Replace the overlay card (lines 139–165) with a phone frame screenshot |
| `focus-session-stats.png` | Scene 4 | Replace the 3-stat card row (lines 193–204) with phone frame screenshot; keep the "Stop Focus · requires session password" button below |

**Import lines to add:**
```ts
import scheduleTab from '@assets/screenshots/schedule-tab.png';
import focusTabActive from '@assets/screenshots/focus-tab-active.png';
import focusBlockOverlay from '@assets/screenshots/focus-block-overlay.png';
import focusSessionStats from '@assets/screenshots/focus-session-stats.png';
```
