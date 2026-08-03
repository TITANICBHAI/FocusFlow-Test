# FocusFlow — Play Store Listing & ASO Strategy
> Based on competitive analysis · April 2026 · Confidential

---

## 1. Store Listing Title (30 chars max)

**FocusFlow: Focus & App Blocker**

*Rationale:* Leads with the brand, then the two highest-value buyer keywords on the Play Store. "Focus" + "App Blocker" are the exact terms users type when they're switching from Freedom or AppBlock.

### Alternates to A/B Test
| Variant | Title |
|---|---|
| A (recommended) | FocusFlow: Focus & App Blocker |
| B | FocusFlow – Block Apps & Focus |
| C | FocusFlow: Task + App Blocker |

---

## 2. Short Description (80 chars max)

**On-device app blocking tied to your tasks. No subscription. No bypass.**

*Why this works:*
- "On-device" = directly answers Freedom's #1 complaint (cloud blocking fails offline)
- "No subscription" = directly answers Stay Focused's #1 complaint (revoked lifetime licences)
- "No bypass" = the promise your competitors cannot make

---

## 3. Full Description (4,000 chars max, keyword-dense)

```
Block distracting apps the moment your task starts — and unblock them the moment it ends.

FocusFlow is the only Android productivity app that links app blocking directly to your task schedule. When your work session begins, your distractions are blocked automatically. No manual setup. No excuses.

━━━ WHY FOCUSFLOW IS DIFFERENT ━━━

✅ 100% ON-DEVICE ENFORCEMENT
Blocks are enforced by Android's Accessibility Service — not a VPN, not a cloud server. Go offline. Turn off Wi-Fi. Your blocks still work. Freedom and Digital Wellbeing can't say that.

✅ TASK-LINKED AUTO-BLOCKING
Schedule your task → choose which apps to block → FocusFlow handles the rest. The blocks start when your task starts and expire the moment it ends. No competitor does this.

✅ NO SUBSCRIPTION. EVER.
Bought once, yours forever. We will never revoke your access or move your features behind a paywall. This is in writing in our privacy policy. (Looking at you, Stay Focused.)

✅ BUILT-IN DETERRENTS (no other app has these)
• Screen dimming on blocked app open
• Vibration alert
• Custom deterrent sound
Three layers of friction before you can override a block — because willpower needs engineering.

━━━ FOCUSFLOW FEATURES ━━━

📋 TASK SCHEDULING
• Add tasks with start time, duration, priority, and tags
• Tasks auto-complete with one tap
• Focus Mode: auto-starts app blocking when task begins

🚫 APP BLOCKING
• Block any installed app during a focus session
• Daily allowance modes: count limit, time budget, or interval unlock
• Custom named block presets (save your "deep work" or "writing" block lists)
• Block schedules with automatic expiry
• Recurring block schedules (daily, weekdays, weekends, custom days)

⚡ STRICT MODE (coming soon)
• Partner unlock for extra accountability

📊 STATS & INSIGHTS  
• Focus time tracked per session
• 7-day task productivity trends
• App discipline: see which apps you reach for most when you shouldn't
• All-time stats: lifetime focus hours, best streak, calendar heatmap
• Milestone badges for consistency

🔔 SMART NOTIFICATIONS
• Task start/end alerts
• Mid-session focus reminders
• 5-minute block-expiry warnings
• Complete or Extend directly from the notification

━━━ SWITCHING FROM STAY FOCUSED? ━━━
Import your blocked apps list in one step. FocusFlow gives you everything Stay Focused had — plus task scheduling and enforced blocks — with a policy that guarantees your purchase is permanent.

━━━ SWITCHING FROM FREEDOM? ━━━
Freedom's Android enforcement fails when you're offline. FocusFlow's Accessibility Service works with zero internet. Same locked-mode concept, real enforcement.

━━━ PERFECT FOR ━━━
• Remote workers fighting distraction
• Students who need distraction-free study blocks
• ADHD users who need hard enforcement, not suggestions
• Anyone who's tried "just willpower" and failed

No cloud. No subscription. No loopholes.
```

---

## 4. ASO Keyword Strategy

### Primary Keywords (high intent, high volume)
| Keyword | Search Intent | Priority |
|---|---|---|
| app blocker android | Replace Digital Wellbeing / Freedom | 🔴 P1 |
| focus app | General productivity | 🔴 P1 |
| block distracting apps | High intent, switching | 🔴 P1 |
| stay focused alternative | Stay Focused refugee traffic | 🔴 P1 |
| productivity app | Broad, competitive | 🟠 P2 |

### Secondary Keywords (longtail, lower competition)
| Keyword | Why |
|---|---|
| app blocker no subscription | Directly attacks Stay Focused pain point |
| offline app blocker | Directly attacks Freedom pain point |
| task scheduler with app blocking | FocusFlow's unique feature, zero competition |
| screen time manager android | Captures Digital Wellbeing dissatisfied users |
| focus timer app block | Captures Pomodoro + block combo seekers |
| ADHD app blocker | High-value niche with strong conversion |

### Negative Positioning (do NOT target)
- "Forest alternative" — Forest users want gamification; FocusFlow doesn't offer it
- "parental control" — wrong intent, wrong user, App Store policy risk

---

## 5. Screenshots Brief (8 screenshots, ordered)

| # | Screen | Headline Text | Why |
|---|---|---|---|
| 1 | Task → auto-block flow (side by side) | "Block apps when your task starts. Automatically." | Hero differentiator — no competitor can show this |
| 2 | Block active overlay with dim + deterrent | "On-device. No bypass. No internet needed." | Addresses Freedom's #1 weakness |
| 3 | Recurring schedule setup | "Set it once. Block every weekday, forever." | AppBlock's closest feature, done simpler |
| 4 | Stats All-Time tab with heatmap | "See your focus habits at a glance." | Forest-style visual appeal |
| 5 | Daily allowance modes (3 modes shown) | "Your rules. Count, time, or interval unlocks." | Unique feature, zero competitors |
| 6 | Aversion deterrents settings | "Three layers of friction. Because willpower isn't enough." | Unique, no competitor can copy this screenshot |
| 7 | Notification with Complete / Extend | "Act on focus sessions without opening the app." | Modern UX expected by power users |
| 8 | Pricing / one-time purchase screen | "Bought once. Yours forever. No subscription, ever." | Trust closing shot — converts Stay Focused refugees |

---

## 6. Category & Tags

- **Primary Category:** Productivity
- **Secondary Category:** Tools
- **Content Rating:** Everyone
- **In-app purchases:** No (or Yes if premium tier added)

---

## 7. Play Store Approval Risk — Accessibility Services

FocusFlow uses `BIND_ACCESSIBILITY_SERVICE` to enforce app blocking. This is the **highest-scrutiny permission** on the Play Store as of 2024.

### Risk Level: HIGH (but manageable)

**What Google checks:**
1. Accessibility Service is used for a clear, documented purpose
2. The purpose cannot be achieved without the Accessibility Service
3. The service is not used to collect personal data

**What you must do to pass review:**

### a) Accessibility Declaration (required in Play Console)
In Play Console → App content → Accessibility Service, explain:
> "FocusFlow uses Android Accessibility Service to detect when a user opens a blocked app. When a blocked app is detected, FocusFlow displays a full-screen deterrent overlay and returns the user to the home screen. This enforcement cannot be achieved through any other API. No user interaction data, screen content, or personal information is collected or transmitted."

### b) In-app Accessibility Permission Prompt
Show a clear explanation BEFORE requesting the permission:
```
FocusFlow needs Accessibility Service access to enforce app blocks.

This lets FocusFlow:
✅ Detect when you open a blocked app
✅ Show a deterrent screen to redirect you
✅ Return you to your task

FocusFlow does NOT:
❌ Read your screen content
❌ Record your interactions
❌ Send any data off your device

You can revoke this permission at any time in Settings.
```

### c) Privacy Policy requirements
Your privacy policy MUST explicitly state:
- Accessibility Service is used solely for app-blocking enforcement
- No screen content is read or stored
- No interaction data is collected or transmitted
- The permission is revocable at any time

### d) Common rejection reasons and fixes
| Rejection reason | Fix |
|---|---|
| "Accessibility Service not clearly explained" | Add the in-app permission rationale screen (see above) |
| "Must be core functionality" | Your play store description must lead with app blocking, not a secondary feature |
| "Data collection concern" | Add explicit "we collect nothing" statement to privacy policy |
| "Deceptive behavior" | Ensure the overlay is clearly identifiable as FocusFlow, not a system dialog |

### e) Timeline
- First submission: expect 2–5 business days review
- If rejected: Google provides a specific reason; respond within 7 days
- Second submission after fix: 1–3 business days
- Build a buffer of 3–4 weeks before any launch deadline

---

## 8. Rating & Review Strategy

**Target:** 4.5★+ within 90 days of launch

**Trigger in-app review prompt when:**
- User completes their 3rd task with Focus Mode ON (high satisfaction moment)
- User hits a 7-day streak (emotional peak)
- User blocks 10+ app attempts in a week (they feel protected, not annoyed)

**Never prompt:**
- On app open
- After a block override (user is frustrated)
- During an active focus session

**Response to 1-2 star reviews:** Always reply publicly within 48h. Template:
> "Thanks for the feedback — [acknowledge specific complaint]. [Fix or explanation]. We'd love to make it right — email us at [support]. Your experience matters to us."
