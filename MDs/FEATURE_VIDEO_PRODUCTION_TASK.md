# FocusFlow Feature Video — Recording Script & Handoff Task

## Purpose

Create one polished FocusFlow feature video from a real screen recording, place it inside a premium animated phone mockup, and add it to the FocusFlow documentation website.

Reference feature-video gallery:

https://titanicbhai.github.io/FocusFlow-Feature-Videos/#

The final result should feel like a natural extension of the existing FocusFlow dark, indigo, product-focused visual style.

---

## Part 1 — Recording script

### Recommended format

- Record in portrait orientation if possible: 9:16.
- Use the highest practical resolution available.
- Keep the phone steady and avoid notification banners.
- Turn on Do Not Disturb before recording.
- Use a clean demo account/state with realistic sample tasks and blocked apps.
- Record each action with a short pause before and after it.
- Do not include passwords, private data, personal notifications, or unrelated apps.

### Target duration

Record approximately 45–60 seconds. The editor may shorten pauses and remove repeated actions.

### Video concept

**“From distraction to protected focus in seconds.”**

### Shot list and spoken/on-screen script

#### Shot 1 — Hook: the distraction

**Duration:** 3–5 seconds

Open a selected distracting app or blocked destination.

**On-screen text:**

> A distraction appears.

**Optional voiceover:**

> “The hardest part of focusing is the moment a distraction appears.”

#### Shot 2 — FocusFlow blocks it

**Duration:** 5–7 seconds

Show FocusFlow’s block screen/overlay clearly. Let the block state remain visible long enough to understand it.

**On-screen text:**

> FocusFlow steps in immediately.

**Optional voiceover:**

> “FocusFlow blocks the app at the system level instead of relying on willpower alone.”

#### Shot 3 — Start a focus session

**Duration:** 7–9 seconds

Navigate to the FocusFlow home screen or focus screen. Start a focus session with a visible duration and task.

**On-screen text:**

> Choose a task. Start focus.

**Optional voiceover:**

> “Choose what you need to do, set your session, and start.”

#### Shot 4 — Configure protection

**Duration:** 7–9 seconds

Show the relevant block settings, such as blocked apps, allowed apps, daily allowance, or a scheduled greyout window. Do not spend too long scrolling.

**On-screen text:**

> Set the rules before temptation hits.

**Optional voiceover:**

> “Use app blocking, schedules, and daily allowances to create rules that fit your day.”

#### Shot 5 — Try the blocked app again

**Duration:** 5–7 seconds

Return to the blocked app and show that the block still applies during the active session.

**On-screen text:**

> No single-tap override.

**Optional voiceover:**

> “When you try to go back, the protection is still there.”

#### Shot 6 — Review progress

**Duration:** 6–8 seconds

Show Stats, the Temptation Log, weekly progress, or the relevant analytics screen.

**On-screen text:**

> Build awareness. Protect your attention.

**Optional voiceover:**

> “Review your focus time and blocked attempts so you can improve the habit.”

#### Shot 7 — End card

**Duration:** 4–6 seconds

End on a clean FocusFlow screen or logo frame.

**On-screen text:**

> FocusFlow  
> Hard-enforcement focus for Android  
> Free and open source

**Optional voiceover:**

> “FocusFlow. Take back your attention.”

---

## Recording notes

- Prefer one continuous recording if that is easier; the editor can cut it into the shots above.
- If a feature is not available in the current build, skip that shot rather than simulating it.
- If showing permissions, use a clean, non-sensitive screen and avoid exposing device/account details.
- If there is no voiceover, record clean device audio anyway. The editor can mute it and use music/captions.
- Capture a few extra seconds of the FocusFlow logo or home screen for transitions and the end card.

---

## Part 2 — Next-agent implementation task

### Input

Use the video file supplied by the user after they complete the recording script above. Probe the file before editing and document its:

- Duration
- Resolution
- Orientation/aspect ratio
- Frame rate
- Audio presence
- Any visible privacy or quality issues

### Editing and compositing requirements

1. Trim dead space and remove accidental taps, notifications, or unrelated screens.
2. Keep the important interaction understandable without requiring audio.
3. Add readable captions/on-screen labels using the FocusFlow visual language:
   - Background: `#0D0D14`
   - Surface: `#16161F`
   - Accent: `#6C63FF`
   - Text: `#F0F0FF`
   - Muted text: `#9090B0`
4. Place the screen recording inside a realistic phone frame:
   - Rounded device silhouette
   - Thin bezel
   - Soft shadow
   - Subtle indigo glow
   - Correct portrait/landscape fit without stretching
5. Add tasteful motion:
   - Gentle phone entrance
   - Small scale/position changes between shots
   - Smooth transitions
   - No distracting effects that reduce screen readability
6. Add a final branded end card with a link or prompt to explore FocusFlow.
7. Preserve or replace audio cleanly:
   - Keep useful original device audio only if it improves the demo.
   - Otherwise use captions and optional background music.
   - Do not add voiceover unless the user supplies or requests it.
8. Export a web-friendly MP4 using H.264 video and AAC audio.
9. Also create a poster/thumbnail frame for the website card if useful.

### Website integration requirements

Add the finished video to the existing static docs website under `docs/`.

The next agent should:

1. Inspect the current docs landing page and the existing feature-video page before editing.
2. Add the video to the existing video showcase rather than creating an unrelated visual language.
3. Use a native `<video controls playsinline preload="metadata">` element when the output file is hosted in this repository.
4. Provide a poster image and accessible fallback text.
5. Keep the external gallery link available for the full collection:

   https://titanicbhai.github.io/FocusFlow-Feature-Videos/#

6. Make the layout work on both mobile and desktop.
7. Avoid autoplay with sound. If autoplay is used for a muted decorative preview, it must not be the only way to access the video.
8. Update relevant metadata only if the new video is actually part of the page content.

### Suggested output locations

Use project-relative paths and keep generated media organized, for example:

- `docs/media/focusflow-feature-video.mp4`
- `docs/media/focusflow-feature-video-poster.jpg`

The next agent may choose different paths if the repository already has a media convention.

### Acceptance criteria

- The final video opens and plays in a normal browser.
- The video is understandable with audio muted.
- The phone frame does not crop or distort important UI.
- Captions have sufficient contrast and remain readable on mobile.
- The website includes the video in the existing showcase and keeps the full gallery link.
- No private information appears in the recording.
- No broken links, missing poster, console errors, or overflowing layout.
- `git diff --check` passes.
- The edited media files and final website changes are presented to the user for review.

### Important handoff rule

Do not replace the user’s original recording. Keep it available as the source asset and produce a separate edited output. If the recording is ambiguous or a feature is not visible, ask before inventing UI, claims, or interactions.
