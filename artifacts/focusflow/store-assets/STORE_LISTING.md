# FocusFlow — App Store Listing Document
## Complete Metadata for Uptodown, Aptoide, Huawei AppGallery & Google Play

---

## CORE APP IDENTITY

| Field | Value |
|---|---|
| **App Title** | FocusFlow — Focus & App Blocker |
| **Package Name** | com.tbtechs.focusflow |
| **Version** | 1.0.8 |
| **Version Code** | 9 |
| **Developer / Company Name** | TB Techs |
| **Category** | Productivity |
| **Age Rating** | Everyone (3+) |
| **License / Price** | Free |
| **Min Android Version** | Android 8.0 (API 26) |
| **Target SDK** | Android 15 (API 35) |
| **App Size** | ~15 MB |
| **In-App Purchases** | No |

---

## URLS & CONTACT

| Field | Value |
|---|---|
| **App Website** | https://titanicbhai.github.io/focusflow-android |
| **Privacy Policy URL** | https://titanicbhai.github.io/focusflow-android/privacy-policy |
| **Support Email** | support@tbtechs.dev |
| **GitHub** | https://github.com/TITANICBHAI/FocusFlow |

---

## SHORT DESCRIPTION (max 70–80 characters)

```
Block distracting apps and build better focus habits.
```
**(54 characters)**

*Alternatives:*
- `Your personal focus enforcer — block apps, finish tasks.` (57 chars)
- `Deep focus, app blocking, and smart daily scheduling.` (53 chars)

---

## FULL DESCRIPTION (English)

```
Struggling to stay focused? FocusFlow is the app that doesn't just remind 
you to focus — it enforces it.

FocusFlow lets you block distracting apps during focus sessions so you can 
actually finish what you started. Whether you're studying, working, or just 
trying to use your phone less, FocusFlow gives you the tools to stay on 
track without relying on willpower alone.

── CORE FEATURES ──

App Blocking During Focus Sessions
Choose which apps to block while you work. Social media, games, shopping — 
locked away until your session ends. Non-essential apps redirect to a calm 
blocking screen so you never lose momentum.

Always-On Block List
Set specific apps to be blocked 24/7, not just during sessions. Great for 
apps you want to cut out completely, like social media or games.

Standalone Timed Block
Not in the mood for a full focus session? Set a timed block for any app for 
any duration. The block stays active until the timer runs out — even if you 
close the app.

Daily App Allowance
Give apps a daily time budget instead of blocking them outright. When the 
limit is hit, the app is blocked for the rest of the day. Helps you use apps 
intentionally without cutting them off completely.

Keyword Blocker
Block apps that contain specific words in their name or content — useful for 
blocking whole categories of apps without listing each one manually.

Focus Sessions with Allowed Apps
Not all apps are distractions. Whitelist your essential tools — Phone, 
navigation, your work apps — while everything else stays locked.

Pomodoro Timer
Built-in Pomodoro support with customisable focus and break durations. Work 
in structured intervals and track your sessions over time.

Greyout / Recurring Block Schedule
Set recurring time windows when distracting apps automatically fade to grey 
and become inaccessible — like evenings or work hours — without starting a 
full session.

Block Enforcement & Defence
PIN-protect your block settings so you can't weaken your own rules in a 
moment of weakness. System-level protections prevent bypassing the blocker 
by switching launchers or uninstalling the app during a session.

VPN-Based Network Block
Block specific apps from accessing the internet during focus sessions using 
a local VPN — no external server, no data ever leaves your device.

Home Launcher Mode
FocusFlow can act as your home launcher during a session, preventing you 
from leaving to open blocked apps.

Focus Violation Tracking
Every attempt to open a blocked app during a session is logged locally. 
Review your patterns and see where your attention actually goes.

Statistics & Streaks
See your daily focus stats, completion streaks, productivity scores, and 
week-over-week trends — all stored locally on your device.

Task Management
Create tasks, assign durations, and track completions. Plan your day inside 
the app and see how your actual focus time compares to your plan.

Daily & Weekly Reports
Get a clear view of how your week went — total focus time, tasks completed, 
streaks, and areas to improve.

Emergency Override
Life happens. You can always override a block in a genuine emergency. Every 
override is logged so you stay honest with yourself.

Boot Recovery
Your block and session settings survive a reboot. If your phone restarts 
during a session, FocusFlow restores your block automatically.

── WHO IS FOCUSFLOW FOR? ──

• Students who need to study without distractions
• Remote workers battling notification overload
• Anyone trying to use their phone more intentionally
• People who want real enforcement, not just reminders

── YOUR PRIVACY MATTERS ──

FocusFlow works entirely on your device. It has no account system, no 
analytics, no ads, and makes zero network requests. Everything — your tasks, 
settings, focus history, and block lists — stays on your phone and is never 
shared with anyone.

── HOW PERMISSIONS ARE USED ──

FocusFlow is transparent about every permission it uses:

• Accessibility Service — Detects which app you open so it can block 
  distractions in real time. It only reads the name of the active app. 
  It cannot see your messages, passwords, or anything on screen.

• Usage Stats — Shows you your own app usage and focus violation history 
  inside the app. This data never leaves your device.

• Display Over Other Apps — Shows the "App Blocked" screen when you try 
  to open a blocked app. Nothing is recorded.

• Foreground Service — Keeps the focus timer and blocker running when you 
  switch to another app. Standard for any timer or active background task.

• Exact Alarm — Fires task reminders at your scheduled times.

• Query All Packages — Lets you browse your installed apps when building 
  your block list. No app data is collected.

• Request Delete Packages — Used only to let you uninstall apps from within 
  FocusFlow's block list manager. The system handles the actual uninstall 
  dialog — FocusFlow never removes apps on its own.

No location. No camera. No microphone. No storage. No account. No internet.

── OPEN SOURCE ──

FocusFlow is fully open source. You can read the complete source code — 
including the accessibility service implementation — on GitHub:
https://github.com/TITANICBHAI/FocusFlow

Build your focus. Protect your time.
```

---

## RELEASE NOTES (v1.0.8)

```
FocusFlow v1.0.8 — Onboarding and Reliability Improvements

This update makes first-run setup clearer while continuing to improve
blocking reliability and consistency.

What's new:
• New two-mode onboarding lets users choose Standard Mode or Iron Mode
• Standard Mode keeps first-run setup focused on essential app-blocking access
• Iron Mode adds layered setup for VPN, Device Admin, and Defense Password protection
• Iron Mode activation includes a live protection-layer counter
• Permission checkmarks reflect real Android permission state changes
• Reduced-motion preferences are respected during onboarding feedback
• Standalone timed block now applies correctly even when the app database 
  is slow to initialise — the block always goes through
• Daily allowance entries now save reliably on all devices
• Keyword blocker and recurring schedule saves are now fault-tolerant
• Block Enforcement screen: all toggle saves now surface errors clearly 
  instead of failing silently
• Home Launcher settings saves improved for all configurations
• Onboarding: settings save failures now show a clear error instead of 
  getting stuck silently

Bug fixes:
• Fixed: Save button in Standalone Block modal appearing to do nothing on 
  some devices (root cause: database initialisation race condition)
• Fixed: Blocked words and recurring schedules not applying after save on 
  cold launch
• Fixed: Block Defence toggles silently failing on some OEM devices

If you've had issues with blocks not applying after saving — this update 
fixes that.
```

---

## UPTODOWN — SPECIFIC FIELDS

| Field | Fill With |
|---|---|
| **Version** | 1.0.8 |
| **License** | Free |
| **Development Stage** | Final Release |
| **Min SDK Version** | 8.0 (Android 8.0) |
| **Max SDK Version** | 15 (Android 15) |
| **Short Description** | Block distracting apps and build better focus habits. |
| **Full Description** | *(use Full Description above)* |
| **New Features in this Version** | *(use Release Notes above)* |
| **YouTube Video URL** | *(add once uploaded)* |
| **File Languages** | English |

---

## UPTODOWN — REVIEWER MESSAGE (Accessibility Permission Appeal)

> Paste this into the reviewer notes / appeal form when submitting or resubmitting.

```
Dear Uptodown Review Team,

Thank you for reviewing FocusFlow. I'd like to clarify exactly how our app 
uses the Accessibility Service, since I understand this permission requires 
additional scrutiny.

WHAT THE ACCESSIBILITY SERVICE DOES IN FOCUSFLOW:

FocusFlow's entire purpose is to help users block distracting apps during 
focus sessions they choose to start. The Accessibility Service is the only 
Android API that provides real-time foreground app detection without root 
access.

Specifically, the service listens ONLY to TYPE_WINDOW_STATE_CHANGED events. 
When this event fires, FocusFlow reads the package name of the newly active 
app (e.g. "com.instagram.android") and checks it against the user's local 
block list. If the app is blocked, FocusFlow displays a full-screen overlay 
redirecting the user back to their task.

WHAT THE ACCESSIBILITY SERVICE DOES NOT DO:

• It does NOT read any on-screen text, messages, passwords, or content
• It does NOT log keystrokes or capture any user input
• It does NOT access contacts, SMS, call logs, or any personal data
• It does NOT transmit any data off the device — ever
• Phone and emergency apps are unconditionally whitelisted and can NEVER 
  be blocked

WHY NO ALTERNATIVE API WORKS:

UsageStatsManager and ActivityManager only provide historical or polled 
data — they cannot detect an app switch in real time. Without real-time 
detection, a user could open a blocked app and use it for several seconds 
before a polling check could catch it. The Accessibility Service is the 
only way to enforce an immediate redirect.

This is the same approach used by all legitimate parental control and 
focus apps on Android (Google's own Digital Wellbeing, ActionDash, 
StayFree, AppBlock, etc.).

TRANSPARENCY:

• The accessibility service description shown to users in Android Settings 
  clearly explains what it does
• Our full source code is publicly available for inspection:
  https://github.com/TITANICBHAI/FocusFlow
  The relevant file is: AppBlockerAccessibilityService.kt
• Our privacy policy is at:
  https://titanicbhai.github.io/focusflow-android/privacy-policy

We believe FocusFlow meets Uptodown's guidelines and we're happy to provide 
any additional information or source code access needed for your review.

Thank you for your time.
— TB Techs
```

---

## GOOGLE PLAY STORE — SPECIFIC FIELDS

### Content Rating Questionnaire Answers

| Question | Answer |
|---|---|
| Violence | None |
| Sexual content | None |
| Language | Clean |
| Controlled substances | None |
| User interaction (social features) | No |
| Location sharing | No |
| Personal information collected | No |
| **Expected Rating** | **Everyone (3+)** |

### Google Play Categories

- **Primary Category:** Productivity
- **Secondary Category:** Tools

### Data Safety (Google Play)

| Data Type | Collected? | Why |
|---|---|---|
| Location | No | — |
| Contacts | No | — |
| Personal files / media | No | — |
| App activity | Locally only | Focus violation logs stored on-device; never shared |
| Device info | No | — |
| Financial info | No | — |

**Data shared with third parties:** None
**Data encrypted in transit:** N/A (no network data)
**Users can delete their data:** Yes (clear app data)

### Google Play — Accessibility Declaration

**Does your app use the Android Accessibility API?**
→ Yes

**Which features require it?**
```
FocusFlow uses the Accessibility Service to detect in real time when the 
user opens an app that is on their personal block list during a focus 
session. When a blocked app is detected, FocusFlow immediately displays a 
blocking screen redirecting the user to their task.

This is the only technically viable method for real-time foreground app 
detection on Android without root access. UsageStatsManager and 
ActivityManager are polling-based — they cannot intercept an app launch 
instantly. Without the Accessibility API, real-time blocking is not 
possible.

The service listens exclusively to TYPE_WINDOW_STATE_CHANGED events and 
reads only the package name of the active window. No screen content, text, 
keystrokes, or personal data is ever read or recorded.
```

**Does your app collect or share any data via the Accessibility API?**
```
No. The only information read from accessibility events is the package name 
of the foreground app. This package name is:

1. Compared locally against the user's block list (stored in SQLite on-device)
2. Optionally logged locally so the user can review their own focus violations
3. Never transmitted off the device under any circumstances
4. Never shared with any third party

FocusFlow has no analytics SDK, no crash reporting SDK, no advertising SDK, 
and makes zero network requests.
```

### Google Play — Sensitive Permissions Summary

| Permission | Why It's Needed | Data Collected | Data Transmitted |
|---|---|---|---|
| `BIND_ACCESSIBILITY_SERVICE` | Real-time foreground app detection for blocking | Package name of active app only | Never |
| `PACKAGE_USAGE_STATS` | Show user their own focus violation history | Local usage events | Never |
| `SYSTEM_ALERT_WINDOW` | Display "App Blocked" overlay | None | Never |
| `QUERY_ALL_PACKAGES` | Let user browse installed apps to build block list | None | Never |
| `REQUEST_DELETE_PACKAGES` | Let user remove apps via system uninstall dialog | None | Never |
| `FOREGROUND_SERVICE` | Keep focus timer running when app is minimised | None | Never |
| `SCHEDULE_EXACT_ALARM` | Fire task reminders at exact scheduled times | None | Never |

---

## APTOIDE — SPECIFIC FIELDS

| Field | Fill With |
|---|---|
| **Application Title** | FocusFlow — Focus & App Blocker |
| **Privacy Policy URL** | https://titanicbhai.github.io/focusflow-android/privacy-policy |
| **Support Email** | support@tbtechs.dev |
| **Website** | https://titanicbhai.github.io/focusflow-android |
| **Company Legal Name** | TB Techs |
| **Category** | Productivity |
| **Age Rating** | Everyone |
| **In-App Purchases** | No |
| **Description** | *(use Full Description above)* |
| **Release Notes** | *(use Release Notes above)* |

### Aptoide — Reviewer Message

```
FocusFlow uses Android's Accessibility Service exclusively to detect 
foreground app changes and block non-allowed apps during user-initiated 
focus sessions.

The service listens only to TYPE_WINDOW_STATE_CHANGED events to read the 
package name of the currently active app. It does NOT read on-screen text, 
log keystrokes, capture passwords, or observe any content within apps.

All data stays on-device. No network requests. Full source code available:
https://github.com/TITANICBHAI/FocusFlow
Relevant file: AppBlockerAccessibilityService.kt
```

---

## HUAWEI APPGALLERY — SENSITIVE PERMISSION DESCRIPTION

```
FocusFlow uses android.permission.BIND_ACCESSIBILITY_SERVICE exclusively 
to detect which app is in the foreground by listening to 
TYPE_WINDOW_STATE_CHANGED events. When a user opens a blocked app during a 
focus session, the service reads only the package name of that app and 
displays a blocking overlay. It does not read, access, collect, store, or 
transmit any SMS messages, call logs, passwords, screen content, or personal 
data. Phone and dialer apps are unconditionally whitelisted — calls are 
never blocked. The BIND_ACCESSIBILITY_SERVICE permission is not used for any 
purpose other than real-time foreground app detection for user-initiated 
blocking sessions.
```

*(Select "Display caller IDs and block harassment" as the closest matching 
scenario checkbox. The description above clarifies no SMS/call data is accessed.)*

---

## KEYWORDS / TAGS

```
focus, productivity, app blocker, pomodoro, deep work, distraction blocker,
study timer, task manager, digital wellbeing, screen time, focus mode,
anti-distraction, time management, daily allowance, keyword blocker,
always-on block, standalone block, focus session, work timer, habit
```

---

## ASSETS CHECKLIST

- [ ] App Icon — 512 × 512 px PNG (`assets/images/icon.png`)
- [ ] Feature Graphic — 1024 × 500 px (Aptoide & Google Play)
- [ ] Screenshots — at least 3 phone screenshots (portrait)
- [ ] Promo Video — uploaded to YouTube, URL added to listings
- [ ] APK / AAB file — built via EAS Build
- [ ] Privacy Policy — live at URL listed above
