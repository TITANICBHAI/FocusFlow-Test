# Onboarding & Welcome — Change Log (v1.0.3 → v1.0.5)

This file tracks every meaningful change made to `onboarding.tsx` and `welcome.tsx`
across releases. Each entry shows the commit, when it happened, and what actually changed.

---

## At a Glance

| Version | Commit | onboarding.tsx | welcome.tsx |
|---|---|---|---|
| v1.0.3 | `eb05367d` | Rich expandable cards (all perms, one page) | ❌ Does not exist |
| Pre-v1.0.4 | `2f0eb558` | **3-step flow** (required → optional → how-to + PIN) | ❌ Does not exist |
| Pre-v1.0.4 | `3c8d84f1` | Slimmed to **2-step** (3 essential perms → done) | ✅ Created (emoji slides, no Terms yet) |
| v1.0.4 tag | `7f631943` | 2-step, minor polish | Slides redesigned + Terms URL added |
| Post-v1.0.4 | `4c46e5fa` | unchanged | Slide copy tweaked |
| v1.0.5 | `340ac949` | **One perm per step** (3 steps) | Slides overhauled + Accessibility trust slide added |

> 📌 **FocusFlow-Test is currently at `2f0eb558`** — the 3-step onboarding, no welcome screen.

---

## onboarding.tsx

### v1.0.3 — `eb05367df2e1be0bc9c26fb00f891bd9cbe7aacd`
*Last state before any v1.0.4 work began. May 14, 2026.*

One big scrollable page. No steps, no wizard — every permission shown at once as an
**expandable card**. Tapping a card reveals a `whyNeeded` description and a
`brokenWithout` list explaining what stops working if you skip it.

- Required + Optional permissions listed together on the same page
- Each card has a deep-link button to open the relevant Android Settings screen
- PIN setup option at the bottom
- "Continue" button always enabled — if perms are missing, a tip points to Settings → Permissions
- File size: ~34 KB

---

### `2f0eb558e9dbf71c87071efa428a54d5ac58c185` ← **FocusFlow-Test is here**
*May 18, 2026. First v1.0.4-era change to onboarding.*

Complete restructure into a **3-step wizard**:

- **Step 1** — Required permissions: Accessibility, Usage Access, Overlay, Notifications, Battery optimisation
- **Step 2** — Optional permissions: VPN, Device Admin, Media
- **Step 3** — Quick how-to-use guide + PIN protection toggle

Each step still uses expandable permission cards with `whyNeeded` explanations.
"Continue" still always enabled. `RestrictedSettingsBanner` component added
(warns Samsung/Xiaomi users about restricted settings). File size: ~39 KB.

---

### `3c8d84f1611b8bcf16ffb7fe5109bb1779d4b4c3`
*Jun 1, 2026 — 00:55 UTC. About an hour before the v1.0.4 tag.*

Heavily slimmed down to a **2-step flow**:

- **Step 1** — Only 3 essential permissions: Usage Access, Overlay, Accessibility
- **Step 2** — "You're all set!" finish screen

What changed vs the 3-step:
- Battery optimisation is now auto-fired in the layout bootstrap — no card needed
- Optional perms (VPN, Device Admin, Media) removed from onboarding, moved to Settings
- Notifications requested silently on mount — user never sees a card for it
- `Animated` added for step transitions
- File size dropped to ~18 KB (less than half the 3-step version)

---

### v1.0.4 tag — `7f6319439a966a434b7a2538b1bbb1511c3d4179`
*Jun 1, 2026 — 01:59 UTC.*

Same 2-step structure as above, minor polish:

- Step 2 copy changed from "You're all set!" → "Ready to go"
- Small wording and styling tweaks
- File size: ~21 KB

---

### v1.0.5 — `340ac9490b8bb79d84ec234960aeaf6cf038c11c`
*Jun 1, 2026 — 03:46 UTC.*

Another restructure — now **one permission per step**:

- **Step 1** — Draw over other apps (Overlay)
- **Step 2** — App usage access
- **Step 3** — Accessibility service (with extra reassurance copy to reduce alarm)

Notifications still silent on mount. Battery still auto-fired. Optional perms still in Settings.
Each permission now gets the user's full attention individually rather than being grouped.
File size: ~16 KB.

---

## welcome.tsx

### v1.0.3
❌ **This file does not exist in v1.0.3.** Users went straight to `onboarding.tsx` on first launch.
There was no welcome screen, no privacy policy step, no terms of service.

---

### `3c8d84f1611b8bcf16ffb7fe5109bb1779d4b4c3` — First appearance
*Jun 1, 2026 — 00:55 UTC. Created in the same commit that slimmed onboarding to 2 steps.*

A new swipeable welcome screen placed **before** onboarding. 3 slides with a soft, motivational tone:

1. 🌸 *"Your focus, finally yours"* — explains why FocusFlow exists
2. 🌿 *"Build habits that actually stick"* — pitch for the blocking + session flow
3. 🌱 *"Watch yourself grow"* — streaks and stats

On the last slide, Next routes to `/privacy-policy` (a separate screen).
Uses `Animated` fade between slides. No Accept button, no Terms URL yet.
File size: ~5.5 KB.

---

### v1.0.4 tag — `7f6319439a966a434b7a2538b1bbb1511c3d4179`
*Jun 1, 2026 — 01:59 UTC. Same day, ~1 hour after creation.*

Slides completely redesigned — tone shifted from soft/motivational to **direct and honest**:

1. 🕐 *"You open it for a second. An hour disappears."* — hook on the problem
2. 🛡 *"Real blocking needs deep Android access."* — explains why permissions are needed,
   mentions Accessibility Service + local VPN upfront so users aren't surprised
3. 📊 *"Focus sessions, streaks, and full visibility."* — what you get, with a privacy note
   ("Everything stays on your device — nothing is sent to any server.")

Key changes vs the first version:
- Emoji → Ionicon icons
- **Terms of Service URL added** (`focusflowapp.pages.dev/terms-of-service/`)
- **Accept/Agree button added** — user explicitly accepts before proceeding
- `Animated` removed, replaced with `Linking` for Privacy + Terms links
- File size: ~6.5 KB

---

### `4c46e5fa374dacfa90c37b07fd0e17f81f620b77`
*Jun 1, 2026 — 02:39 UTC. Between v1.0.4 tag and v1.0.5.*

Small copy tweak only — same 3 slides, same structure:

- Slide 1 title changed: *"You open it for a second."* → *"Open a social app."*

File size: ~7.1 KB.

---

### v1.0.5 — `340ac9490b8bb79d84ec234960aeaf6cf038c11c`
*Jun 1, 2026 — 03:46 UTC.*

Slides overhauled — now 3 slides with a stronger focus on **trust and transparency**:

1. 🕐 *"Open one app. An hour disappears."* — label changed to "Sound familiar?"
2. 🛡 *"Blocks that can't be tapped away."* — rewritten to be more concrete, added
   trust badge: *"Your data never leaves your device."*
3. 🔒 *"Android will ask about 'Accessibility'."* — **new slide** specifically to
   reassure users before they see the permission request. Explains exactly what
   Accessibility can and can't see. Trust badge: *"Same method used by every
   serious blocker on Android."*

Key changes vs v1.0.4:
- Third slide topic changed: "What you get" → Accessibility reassurance
- Trust badges added to slides
- Copy is more direct and less salesy throughout
- File size: ~8.5 KB
