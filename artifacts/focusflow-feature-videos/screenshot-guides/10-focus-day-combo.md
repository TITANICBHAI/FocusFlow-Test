# Screenshot Guide — Focus Day (Combo)

**Video file:** `src/videos/combos/FocusDay.tsx`
**Scenes:** 5 · ~35 sec total

> This is a combo video showing a complete productive day: Schedule → Focus Session → Block fires → Active screen → Stats review.

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `focusday-schedule-tab.png`
**Where:** Schedule tab (main task list).
**State:** Full day of tasks visible — at least 4 tasks. One marked as active/in-progress. One completed (checkmark). Some with the FOCUS badge. Real task names and times.
**Capture:** Full portrait screenshot.

> **You already have this if you captured `schedule-tab.png` for video 04. Reuse it.**

### Screenshot B — `focusday-focus-ring-active.png`
**Where:** Focus tab while a session is running.
**State:** Countdown ring partially filled, task name showing, "Focus Mode active" text, Pomodoro indicator if enabled.
**Capture:** Full portrait screenshot.

> **You already have this if you captured `focus-tab-active.png` for video 04. Reuse it.**

### Screenshot C — `focusday-block-fires.png`
**Where:** While a Focus Session is active, open a blocked app.
**State:** The block overlay on screen — "APP BLOCKED", app name, shake animation if caught mid-shake (just screenshot right away).
**Capture:** Full portrait screenshot.

> **You already have this if you captured `focus-block-overlay.png` for video 04. Reuse it.**

### Screenshot D — `focusday-active-screen.png`
**Where:** The main Active screen (or home screen of FocusFlow while a session is running).
**State:** Live session info showing — session name, time remaining, today's focus minutes, distractions blocked count. Enforcement layers status (System Protection ON, etc.) if visible.
**Capture:** Full portrait screenshot.

### Screenshot E — `focusday-yesterday-digest.png`
**Where:** Stats → Yesterday tab.
**State:** Full day review — tasks with scheduled vs actual times, on-time/extended badges, streak count and total distractions blocked at the bottom.
**Capture:** Full portrait screenshot.

> **You already have this if you captured `stats-yesterday.png` for video 08. Reuse it.**

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `focusday-schedule-tab.png` | Scene 1 | Replace the 4-task list (lines 37–58) with a phone frame screenshot |
| `focusday-focus-ring-active.png` | Scene 2 | Replace the SVG ring (lines 88–98) with a phone frame screenshot; keep heading text above |
| `focusday-block-fires.png` | Scene 3 | Replace the block overlay card (lines 140–163) with a phone frame screenshot |
| `focusday-active-screen.png` | Scene 4 | Replace the two-column stat panel (lines 187–228) with a phone frame screenshot |
| `focusday-yesterday-digest.png` | Scene 5 | Replace the 3-task row list (lines 246–269) with a phone frame screenshot; keep the streak/blocked badges below |

**Import lines to add:**
```ts
import focusdayScheduleTab from '@assets/screenshots/focusday-schedule-tab.png';
import focusdayFocusRingActive from '@assets/screenshots/focusday-focus-ring-active.png';
import focusdayBlockFires from '@assets/screenshots/focusday-block-fires.png';
import focusdayActiveScreen from '@assets/screenshots/focusday-active-screen.png';
import focusdayYesterdayDigest from '@assets/screenshots/focusday-yesterday-digest.png';
```
