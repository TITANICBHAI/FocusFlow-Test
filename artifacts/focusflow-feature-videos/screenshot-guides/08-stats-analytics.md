# Screenshot Guide — Stats & Analytics

**Video file:** `src/videos/features/StatsAnalytics.tsx`
**Scenes:** 4 tabs cycling (Yesterday → Today → Week → All Time) · ~32 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `stats-yesterday.png`
**Where:** Stats screen → "Yesterday" tab.
**State:** Real data from your previous day — tasks listed with their scheduled vs actual times, timing badges (on-time / extended), distraction count at the top. The more real data the better.
**Capture:** Full portrait screenshot. Scroll to show all tasks if the list is long — or capture the top portion that fits one screen.

### Screenshot B — `stats-today.png`
**Where:** Stats screen → "Today" tab.
**State:** Live data — focus minutes counter running, distractions blocked count, current streak showing. Task progress bar partially filled.
**Capture:** Full portrait screenshot mid-day so numbers are real and non-zero.

### Screenshot C — `stats-week.png`
**Where:** Stats screen → "Week" tab.
**State:** The bar chart showing focus minutes per day of the current week. At least a few days with real bars.
**Capture:** Full portrait screenshot.

### Screenshot D — `stats-alltime.png`
**Where:** Stats screen → "All Time" tab.
**State:** Total focus hours, total sessions, best streak all showing. The 12-week heatmap visible below. Achievement badges earned.
**Capture:** Full portrait screenshot. If the heatmap is below the fold, scroll slightly and capture again as a second shot.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene (tab) | Component | Placement |
|---|---|---|---|
| `stats-yesterday.png` | `yesterday` | `YesterdayView` (lines 39–78) | Replace the task rows inside the div with a full-width phone frame screenshot |
| `stats-today.png` | `today` | `TodayView` (lines 80–118) | Replace the 3-stat cards + progress bar with a phone frame screenshot |
| `stats-week.png` | `week` | Inline bar chart (lines 200–215) | Replace the bar chart div with a phone frame screenshot |
| `stats-alltime.png` | `alltime` | `AllTimeView` (lines 120–178) | Replace the 3 summary cards + heatmap with a phone frame screenshot |

**Implementation note:** The `TabBar` component at the top of the screen stays and still animates through tabs — only the content area below it gets swapped with the phone screenshots. The scene cycling logic in `useVideoPlayer(4, 8000)` and `useEffect` tab switcher stay untouched.

**Import lines to add:**
```ts
import statsYesterday from '@assets/screenshots/stats-yesterday.png';
import statsToday from '@assets/screenshots/stats-today.png';
import statsWeek from '@assets/screenshots/stats-week.png';
import statsAlltime from '@assets/screenshots/stats-alltime.png';
```
