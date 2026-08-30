# Daily Allowance — Complete Bug & Practices List (Plain English)

No code. Just what breaks, when it breaks, and why.

---

## THE FEATURE IN ONE SENTENCE

Daily allowance lets you say "YouTube gets 5 minutes every 2 hours" or "Instagram gets 3 opens per day" or "Chrome gets 30 minutes total today." FocusFlow tracks usage and kicks you out when you hit the limit.

Three modes:
- **Count** — N opens per day. Every time you open the app, it counts.
- **Time Budget** — N total minutes per day. The clock runs while the app is open.
- **Interval** — N minutes every Y hours. The window resets after Y hours.

---

# PART A — REAL BUGS (actively breaking things)

---

## BUG 1 — Getting kicked out right after unlocking when you shouldn't be

**Who it hits:** Interval and Time Budget mode users.

**When it happens:**
You use up your quota. You turn your screen off. Enough time passes that your allowance resets — the interval window expires or a new day starts. You unlock your phone with that app still open. You get kicked to the home screen instantly, even though your quota just reset.

**Why it happens:**
When you unlock, FocusFlow runs two checks back to back. First check: "has the window or day reset?" It correctly says yes — user is allowed in. Second check: "how many minutes are left?" This second check reads the old usage number from storage without noticing that the reset already happened. It sees "you used 5 of 5 minutes, so 0 minutes left" and kicks you out — directly contradicting the first check that just said you were allowed in.

**What the user experiences:**
Unlock phone → app briefly visible → immediately booted to home screen → no explanation.

---

## BUG 2 — Usage counter shows the wrong number after the window resets

**Who it hits:** Interval mode users.

**When it happens:**
Your 2-hour window expires. You open the app and correctly get let in. But if you check the allowance settings screen, it still shows your old usage number instead of zero.

**Why it happens:**
The settings display reads a stored snapshot of your usage. For interval mode, the snapshot contains the old used number. The display doesn't know the window expired because it doesn't have access to the window length. So it just shows the stale number.

**What the user experiences:**
Enforcement works. Display is wrong. Shows "1m remaining" when you actually have the full 5 minutes.

---

## BUG 3 — Forcing a fresh data read doesn't actually get fresh data

**Who it hits:** Affects the allowance display after changing settings.

**When it happens:**
You change an allowance setting. The app requests a fresh data refresh. But if a data fetch was already in progress from a few seconds ago, the force refresh silently joins that old fetch instead of starting a new one. You see pre-change data.

**Why it happens:**
The data-fetching layer deduplicates concurrent requests. Force refresh bypasses the cache check but then still hits the dedup check and gets the stale in-progress result.

**What the user experiences:**
Change a setting → display briefly shows old data → corrects itself within 10 seconds. Minor but noticeable.

---

## BUG 4 — App usage isn't tracked after a service restart if the app was already open

**Who it hits:** Anyone whose background service restarts while an allowance app is open.

**When it happens:**
FocusFlow's background service restarts. You're already inside YouTube. The service comes back, looks for "what just came to the foreground" in the last 3 seconds, finds nothing because you were already there, and never starts the usage timer. You stay in YouTube indefinitely without usage being tracked.

**Why it happens:**
The service detects app opens by watching for foreground transition events. On restart it only scans the last 3 seconds. If you've been in YouTube for 10 minutes, there's no transition event in that window. The service doesn't know you're there.

**What the user experiences:**
Service restarts → already in YouTube → spend as long as you want → quota never consumed → allowance bypassed until you leave and come back.

---

## BUG 5 — Gets kicked to home screen after focus mode ends, for no reason

**Who it hits:** Focus mode users with timed allowances.

**When it happens:**
Focus mode is active. YouTube has a 5-minute allowance. You open YouTube near the end of your focus session. Focus ends. You're now in free time. A minute later, your YouTube allowance timer fires and boots you to the home screen even though you're not in any enforcement session.

**Why it happens:**
When the allowance timer is scheduled, it doesn't know focus mode might end before it fires. When it fires, it doesn't check whether enforcement is still active — it just kicks you home regardless. Same happens when standalone block expires before your allowance timer.

**What the user experiences:**
Focus ends → think you're free → suddenly booted to home screen with no reason → seems like a random crash.

---

## BUG 6 — Editing allowance settings mid-session leaves a ghost timer

**Who it hits:** Anyone who changes allowance config while actively using an app.

**When it happens:**
You have YouTube on a 5-minute time budget. You're 3 minutes in. You open settings and delete YouTube from the allowance list. Two minutes later, the old timer fires and boots you to the home screen.

Same thing if you change YouTube from time budget to count mode — the old time-based timer keeps running and fires on schedule.

**Why it happens:**
When you save allowance changes, the background enforcement service isn't notified. The timer that was already running has no way to know the config changed.

**What the user experiences:**
Edit settings → think you've fixed things → get booted anyway.

---

## BUG 7 — The backup enforcer blocks you during free time when the main service is off

**Who it hits:** OEM device users (Xiaomi, OPPO, Samsung) where services get killed aggressively.

**When it happens:**
You have a 30-minute YouTube budget. No focus mode, no standalone block active. You hit your 30 minutes. You try to use YouTube again and get a block overlay, even though nothing should be enforcing you right now.

**Why it happens:**
FocusFlow has two enforcement layers: the main accessibility service, and a fallback that runs when the main one is dead. They have inconsistent rules.

Main service: allowance only enforces during focus, standalone, or always-on blocking. Without those, allowance doesn't block you.

Fallback service: allowance blocks you regardless of whether any enforcement session is active.

Users on OEM phones that kill the main service get the fallback rules. Normal Android users get the main service rules. Same app, different behaviour depending on what's running.

**What the user experiences:**
No session active → budget exhausted → still blocked → unexpected.

---

## BUG 8 — The budget-exhaustion timer in the backup service isn't cancelled when focus ends

**Who it hits:** Focus mode + time budget users on OEM phones.

**When it happens:**
Focus is active. YouTube has a 30-minute budget. The backup service calculates you'll hit your limit in 5 minutes and sets a timer. Focus ends before the timer fires. Timer fires anyway, marks YouTube as exhausted, triggers the fallback enforcer. If the main service is running, nothing bad happens. If it's not, you see a block overlay in your free time.

**Why it happens:**
When focus ends, the code tells the backup service to go idle. Going idle cancels the focus timers but forgets to cancel the allowance expiry timer.

**What the user experiences:**
Focus ends → free period → unexpected block overlay shortly after.

---

## BUG 9 — Wrong message in the block overlay when allowance runs out during focus

**Who it hits:** Focus mode users where allowance is acting as the implicit allow-list.

**When it happens:**
You're in focus mode. YouTube has a 5-minute allowance. You use it up. Block overlay appears but says "Not allowed in the current Focus Mode app list" instead of "YouTube allowance exhausted."

**Why it happens:**
The code checks things in a specific order. When it checks "is this app excluded by focus mode?" it passes because the app is in the allowance config. But by this point the message builder has already gone down the focus-mode branch and returns the wrong reason.

**What the user experiences:**
Blocked for the right reason, shown the wrong explanation. Minor but confusing.

---

# PART B — NOT BUGS NOW, BUT PROBLEMS WAITING TO HAPPEN

These aren't breaking anything today but will under specific conditions or at scale.

---

## PRACTICE 1 — Interval mode has limited recovery when the service restarts

Time budget has a backup: a separate service uses Android's built-in usage tracker to independently verify how long each app was used. If the main service dies, the backup catches up and still enforces correctly.

Interval mode now has a best-effort backup for the currently stored rolling window. Android's usage tracker still cannot identify which rolling window a historical total belongs to, so exact recovery across an expired window remains a platform limitation. FocusFlow preserves the window metadata and reconciles UsageStats only while that window is active.

---

## PRACTICE 2 — Usage writes need one shared handoff

The main service saves your usage every 15 seconds. The backup service also writes every 60 seconds. Both do: read the file, change a number, write the file back. These updates now use one shared in-process lock, so the services cannot read and overwrite the same snapshot at the same time. UsageStats reconciliation remains raise-only as a second safeguard.

---

## PRACTICE 3 — Progress and its heartbeat must move together

When FocusFlow checkpoints a timed allowance, it now saves the usage amount and the timestamp of that save in the same SharedPreferences update. The handoff marker moves with that checkpoint too, so a restart cannot observe new usage paired with an old heartbeat and incorrectly abandon recovery.

---

## PRACTICE 4 — The settings screen refreshes on the same cadence as its data cache

The allowance settings screen now refreshes every 10 seconds, matching the underlying data cache. Each refresh can therefore produce a fresh native usage read instead of alternating between a real refresh and an already-cached result.

This keeps the displayed cadence honest without forcing extra native reads.

---

## PRACTICE 5 — Switching mode intentionally preserves old config values

When you change YouTube from Time Budget to Count mode in the settings screen, it saves both the new Count settings and the old Time Budget minutes — silently in memory. If you switch back to Time Budget, your old minutes value is restored.

This is intentional non-destructive mode switching. The modal documents the behavior so a future cleanup does not accidentally erase values users expect to recover when they switch back.

---

## PRACTICE 6 — Always-on blocking with an empty block list silently becomes allowance-only enforcement

If you enable "always-on blocking" but don't add any apps to the always-on block list, only the daily allowance is enforced. All other apps are unrestricted. The Defense screen now calls this out directly: no apps are blocked 24/7 until the always-on list is populated.

---

## PRACTICE 7 — The backup service also marks YouTube exhausted without checking if the main service already handled it

When the backup service's budget timer fires, it first checks whether the main service has a fresh active allowance session. If so, the main service remains the owner of that live session; otherwise the backup can safely promote the stored usage to the limit.

---

## PRACTICE 8 — Date formatting is cached in both services

Both the main accessibility service and the backup service now reuse a date formatter when producing today's local date key (like "2026-08-28"). The formatter is also refreshed if the device timezone changes, so caching does not make the day boundary stale.

---

# COMPLETE FIX ORDER

**Fix immediately — users are hitting these:**
1. Bug 5 — Ghost kick after focus ends
2. Bug 1 — Wrong remaining time on screen unlock
3. Bug 7 — Fallback enforcer blocks during free time
4. Bug 4 — Service restart misses already-open app

**Fix before release:**
5. Bug 6 — Ghost timer after config change
6. Bug 2 — Stale usage display after window reset
7. Bug 3 — Force refresh doesn't work
8. Bug 8 — Backup service timer not cancelled on focus end
9. Bug 9 — Wrong block message

**Fix when you have time:**
10. Practice 4 — Align refresh timer with cache TTL (done)
11. Practice 7 — Add session ownership check to expiry runnable (done)
12. Practice 8 — Cache the date formatter in both services (done)
13. Practice 3 — Write checkpoint and timestamp atomically

**Document and accept (no clean fix):**
14. Practice 1 — Interval mode has limited recovery (platform limitation)
15. Practice 2 — Read-modify-write race between services (shared lock added)
16. Practice 5 — Non-destructive mode switching (documented as intentional)
17. Practice 6 — Always-on + empty list = allowance-only (UI hint added)
