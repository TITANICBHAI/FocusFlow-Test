# Screenshot Guide — Keyword Blocker

**Video file:** `src/videos/features/KeywordBlocker.tsx`
**Scenes:** 3 · ~22 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `keyword-list-screen.png`
**Where:** Side Menu → Keyword Blocker (the main keyword list screen).
**State:** Multiple presets enabled — ideally Doomscroll bait, Social-media drama, Shorts/Reels bait are all toggled on. Custom words visible too if you've added any.
**Capture:** Full portrait screenshot showing preset cards and their word tags.

### Screenshot B — `keyword-redirect-action.png`
**Where:** Open any app (e.g. Chrome or Reddit). Navigate to content that contains a blocked keyword.
**State:** The moment the keyword is detected, FocusFlow sends you to the home screen. Screenshot your home screen immediately after being redirected — or if there's an in-app notification/toast, capture that.

> **Note:** If the redirect happens too fast to screenshot, instead capture the keyword list screen with a recently detected word highlighted (check if there's a "last blocked" indicator in the app).

**Capture:** Whatever is visible at the redirect moment — home screen or detection indicator.

### Screenshot C — `keyword-add-screen.png`
**Where:** Keyword Blocker → tap "Add keyword" or "+" to open the custom word entry screen.
**State:** The text input field visible. Optionally type a word into it before capturing.
**Capture:** Full portrait screenshot of the add-keyword UI.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `keyword-list-screen.png` | Scene 1 | Replace the 6-preset grid (`presets.map()` lines 40–55) with a phone frame containing the screenshot |
| `keyword-redirect-action.png` | Scene 2 | Replace the detected/redirected card pair (lines 101–119) with a phone frame showing the redirect moment |
| `keyword-add-screen.png` | Scene 3 | Replace the 3-info cards (lines 141–151) with a phone frame + screenshot |

**Implementation note:** Scene 2's animated "keyword list" panel on the left side (lines 86–97) can stay as-is to show the concept — only the right-side "detected → redirected" cards get replaced with the screenshot.

**Import lines to add:**
```ts
import keywordListScreen from '@assets/screenshots/keyword-list-screen.png';
import keywordRedirectAction from '@assets/screenshots/keyword-redirect-action.png';
import keywordAddScreen from '@assets/screenshots/keyword-add-screen.png';
```
