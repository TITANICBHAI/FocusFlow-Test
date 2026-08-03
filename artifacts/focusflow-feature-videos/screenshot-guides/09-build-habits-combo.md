# Screenshot Guide — Build Habits (Combo)

**Video file:** `src/videos/combos/BuildHabits.tsx`
**Scenes:** 5 · ~37 sec total

> This is a combo video showing the Daily Allowance → Block Schedules → Stats workflow as a habit-building loop.

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `habits-allowance-configured.png`
**Where:** Side Menu → Daily Allowance.
**State:** 3 apps each configured with DIFFERENT limit types — one Count (Instagram), one Time Budget (YouTube), one Interval (Twitter). Progress bars showing real usage. At least one showing "LIMIT HIT" or fully red.
**Capture:** Full portrait screenshot of the allowance list.

> **You already have this if you captured `daily-allowance-list.png` for video 03. Reuse it.**

### Screenshot B — `habits-block-schedule.png`
**Where:** Side Menu → Block Enforcement → Block Schedules.
**State:** At least 2 schedules set up — e.g. "Morning Focus" (8 AM–12 PM, Mon–Fri) and "Night Wind-down" (9 PM–7 AM, Daily). Both showing as ENABLED.
**Capture:** Full portrait screenshot showing both schedule cards.

### Screenshot C — `habits-stats-week-chart.png`
**Where:** Stats → Week tab.
**State:** Bar chart showing focus minutes across the week. An upward trend is ideal — bars getting taller toward the end of the week.
**Capture:** Full portrait screenshot.

> **You already have this if you captured `stats-week.png` for video 08. Reuse it.**

### Screenshot D — `habits-alltime-heatmap.png`
**Where:** Stats → All Time tab.
**State:** 12-week heatmap visible with filled squares showing consistent usage. Streak badges visible (7 days, 14 days, 21 days if unlocked).
**Capture:** Full portrait screenshot.

> **You already have this if you captured `stats-alltime.png` for video 08. Reuse it.**

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `habits-allowance-configured.png` | Scene 1 | Replace the 3-entry allowance list (lines 37–69) with a phone frame screenshot |
| `habits-block-schedule.png` | Scene 2 | Replace the 2-schedule card list (lines 93–115) with a phone frame screenshot |
| `habits-stats-week-chart.png` | Scene 3 | Replace the bar chart card (lines 145–164) with a phone frame screenshot |
| `habits-alltime-heatmap.png` | Scene 4 | Replace the heatmap + stats side panel (lines 197–237) with a phone frame screenshot |
| *(none)* | Scene 5 | Keep as-is — the confetti + "21-Day Streak!" celebration scene is pure animation, no screenshot needed |

**Import lines to add:**
```ts
import habitsAllowanceConfigured from '@assets/screenshots/habits-allowance-configured.png';
import habitsBlockSchedule from '@assets/screenshots/habits-block-schedule.png';
import habitsStatsWeekChart from '@assets/screenshots/habits-stats-week-chart.png';
import habitsAlltimeHeatmap from '@assets/screenshots/habits-alltime-heatmap.png';
```
