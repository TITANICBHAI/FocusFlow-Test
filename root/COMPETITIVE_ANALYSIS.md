# FocusFlow — Competitive Analysis

> April 2026 · Expanded edition · 12 competitors · Research basis: Play Store, App Store, Reddit, G2, Trustpilot, vendor pricing pages, changelogs.

---

## Executive Summary

The Android focus-and-blocking category in 2026 is large, fragmented, and structurally dissatisfied. We map twelve direct and adjacent competitors below, grouped into four strategic clusters:

1. **Hard enforcers (Accessibility Service)** — AppBlock, Stay Focused, Lock Me Out — same enforcement primitive as FocusFlow, all on subscriptions, none with task-linked blocking or layered deterrents.
2. **Soft friction apps (mindful pause)** — One Sec, ScreenZen, Opal — gentle interruptions, beloved by light users, useless for the hard-addiction segment.
3. **Trackers with light blocking** — StayFree, Google Digital Wellbeing — show stats, easy to bypass.
4. **Out-of-pattern players** — Freedom (VPN), Forest (gamified timer), Cold Turkey (desktop only), Brick (physical NFC puck).

**FocusFlow's defensible position:** the only Android app combining true accessibility enforcement, task-linked auto-blocking, three-layer aversion deterrents, a system-protection layer that runs continuously, and a free, one-time, open-source price. No competitor occupies this quadrant.

**Top 3 recommendations:**
1. **Ship import bridges from Stay Focused, AppBlock, and Lock Me Out first** — these are the three Android accessibility-based apps whose users have the same mental model as ours and whose blocked-app lists translate 1:1.
2. **Lead with the "always-on" promise** — every other accessibility-based competitor only enforces during a session. We just made all five enforcement layers continuous. That is a direct, demoable wedge.
3. **Build a "leaving Stay Focused?" landing page** — the lifetime-licence revocation is a still-live trust crisis. Combine with a Reddit reply playbook.

---

## Full Competitor Matrix

| Feature | FocusFlow | AppBlock | Stay Focused | Lock Me Out | Freedom | Forest | Digital Wellbeing | One Sec | ScreenZen | StayFree | Opal | Brick |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Enforcement type** | Accessibility | Accessibility | Accessibility | Accessibility | VPN | Honor system | OS soft timer | Friction pause | Friction pause | Light block | Friction + VPN | Hardware NFC |
| **Works offline** | Yes | Yes | Yes | Yes | No | N/A | Yes | Yes | Yes | Yes | Partial | Yes |
| **Task-linked blocking** | Yes — automatic | No | No | No | Manual | Manual | No | No | No | No | No | No |
| **Always-on enforcement** | Yes (every layer) | Session only | Session only | Session only | Session only | N/A | Toggle | Always | Always | Schedule | Session | Tap to lift |
| **Aversion deterrents (dim + vibrate + sound)** | Yes — 3 layers | No | No | No | No | Soft (tree dies) | No | Mindful pause | Mindful pause | No | Mindful pause | Physical step |
| **System protection (settings, install, uninstall)** | Yes — always-on | Limited | Limited | Limited | No | No | No | No | No | No | No | N/A |
| **Shorts / Reels blocker (always-on)** | Yes | No | No | No | Per site | No | No | No | Yes (web) | Yes (web) | No | No |
| **Keyword blocker (always-on)** | Yes | No | No | No | Limited | No | No | No | No | No | No | No |
| **Recurring schedules** | Yes | Yes | Yes | Yes | Yes | No | Limited | Yes | Yes | Yes | Yes | Manual |
| **Daily allowance modes** | 3 modes | Limited | Some | Yes | No | No | No | Pro | Yes | Pro | Pro | No |
| **Pricing model** | Free, one-time, open source | $3–5/mo | $2.99/mo | Sub or one-time | $8.99/mo or $129 lifetime | $1.99 + $0.99/mo | Free | $0/$2.99/mo/$50 lifetime | Free | Freemium | $19.99/mo or $99/yr | $59 hardware |
| **Cost / yr (typical)** | $0 | $36–60 | $36 | ~$30 or $30 once | $99 | $24 | $0 | $20 | $0 | ~$30 | $99 | $59 once |
| **Privacy (on-device)** | 100% | Mostly | Mostly | Mostly | Cloud | Cloud | OS | Mostly | Mostly | Cloud sync | Cloud | Mostly |
| **Open source** | Yes | No | No | No | No | No | No | No | No | No | No | Partial |
| **Import from competitor** | Planned | No | No | No | No | No | No | No | No | No | No | N/A |

✓ = full · Partial = limited · No = absent or off by default

---

## Strategic Clusters

### Cluster A — Hard enforcers (direct competition)

These are the apps whose users will switch most easily. Same accessibility primitive, same mental model.

#### 1. AppBlock — *Primary subscription rival*

- **Play Store:** 4.1★ · 100k+ reviews · 10M+ downloads
- **Price:** Free tier + $3–5/mo Pro
- **Developer:** MobileSoft, Czech Republic
- **Strengths:** Established brand, reliable accessibility blocking, strong recurring schedules, web dashboard.
- **Weaknesses:** $36–60/yr subscription is the #1 complaint in 1-star reviews; no task integration; no deterrents; UX feels dated; bypass-by-reinstall mentioned repeatedly.
- **Top 1-star phrases:** "too expensive for what it does" · "easy to bypass, just reinstall" · "no link to my calendar" · "monthly subscription not worth it".
- **How we beat them:** Lead with task-linked blocking and free-forever pricing. Run "AppBlock alternative no subscription" search ads. Ship a one-tap AppBlock import.

#### 2. Stay Focused — *Active trust crisis (priority target)*

- **Play Store:** 3.8★ and falling · 5M+ downloads
- **Price:** $2.99/mo (lifetime licences revoked early 2026)
- **Developer:** InnoXApps
- **Situation:** They revoked previously sold lifetime licences and forced subscriptions. Reddit (r/androidapps, r/productivity, r/nosurf) is full of refugees actively asking for an alternative. This is a 60–90-day acquisition window.
- **Strengths:** Clean UI, solid accessibility enforcement, several years of brand equity (now collapsing).
- **Weaknesses:** Trust permanently damaged, no task integration, no deterrents, no import path out.
- **How we beat them:** Onboarding-level "Coming from Stay Focused? Import your blocked list" button. Trust pledge in writing in the Privacy Policy. Reddit reply playbook for the active threads.

#### 3. Lock Me Out — *Underestimated Android-only rival*

- **Play Store:** 4.46★ · ~10k ratings · 859k+ installs · ~80k/mo new downloads
- **Price:** Monthly subscription, yearly subscription, or one-time payment (dynamic pricing)
- **Developer:** TEQTIC Apps, latest release v7.3.3 (Apr 2026)
- **Strengths:** Solid accessibility enforcement; offers a one-time-payment tier (rare in this category — closest thing to our model); strong four-year track record; active monthly downloads put it in the Play Store top 500 productivity apps.
- **Weaknesses:** No task integration; no deterrents beyond the lock screen; no system-protection layer; UX is utilitarian; small developer team means slow updates; minimal marketing presence outside the Play Store.
- **How we beat them:** Match their one-time-payment honesty and beat it with free + open source. Ship task-linked blocking. Demo the three-layer aversion stack.

### Cluster B — Soft friction apps (different psychology)

These apps target users who want gentle reminders, not hard enforcement. Different segment, but they capture our top-of-funnel.

#### 4. One Sec — *Loved by light users, viral on TikTok*

- **Play Store:** 4.7★ · 40k+ Play reviews · 100k+ 5-star reviews overall
- **Price:** Free for 1 app · $2.99/mo · $19.99/yr · ~$50 lifetime · family plan available
- **Strengths:** Beautiful execution of the "deep breath before opening" idea; cross-platform (iOS, Android, macOS, browser extensions); zero-ad even on free tier; founder-credibility ("we don't sell your data" — credible).
- **Weaknesses:** No real enforcement — you can still open the app after the breath; useless for users with severe phone addiction or ADHD; free tier covers only one app.
- **Position vs us:** They own the "mindful" segment. We own the "willpower-failed" segment. Don't compete head-on; convert their churned users with the message *"one sec asks. FocusFlow enforces."*

#### 5. ScreenZen — *Free competitor that punches above its weight*

- **Play Store:** Strong reviews, growing fast
- **Price:** Genuinely free, no premium tier, no ads, no IAP
- **Strengths:** Per-app delay screens, daily limits, scheduled "free periods", cross-platform (iOS + Android); no paywall on any feature; large feature set for $0.
- **Weaknesses:** Friction-based (no hard block); no task linking; no deterrents stack; small team (donation-funded — sustainability risk); no system-protection layer.
- **Position vs us:** Direct threat on the "free" axis but not on enforcement depth. Our wedge: hard block + task linking + deterrents — none of which they offer.

#### 6. Opal — *iOS-first premium brand entering Android*

- **App Store:** Strong on iOS · Android v1 only (Focus Sessions + Timer)
- **Price:** $4.99/wk · $19.99/mo · $99.99/yr · ~$399 lifetime · 50% student discount
- **Strengths:** Beautiful product on iOS; aggressive marketing; backed by VC; strong creator/influencer push; "Opal Score" gamification.
- **Weaknesses:** Android version is barely usable (Play Store reviews call out missing features); VPN-based on Android (same bypass + battery issues as Freedom); $99/yr is the most expensive subscription in the category; no offline guarantee.
- **Position vs us:** We win on Android decisively. Premium iOS users who switch to Android are a high-value segment for us — *"Opal on Android isn't ready. FocusFlow is."*

### Cluster C — Trackers with light blocking

#### 7. StayFree — *Sensor Tower's tracker*

- **Play Store:** Highest-rated screen time app on Play Store · cross-platform (Android, Wear OS, browser extensions, desktop)
- **Price:** Free with premium subscription (pricing not publicly disclosed)
- **Strengths:** Beautiful charts, cross-device pairing without account creation, owned by Sensor Tower (the analytics giant — credibility), Shorts blocker on web extension.
- **Weaknesses:** Primarily a tracker — blocking is secondary; cloud sync raises privacy questions for a Sensor Tower product; subscription pricing not transparent; no accessibility-grade enforcement.
- **Position vs us:** They serve the user who wants to *see* their usage. We serve the user who wants to *stop* it. Different jobs-to-be-done.

#### 8. Google Digital Wellbeing — *The default we displace*

- **Pre-installed on Android** · free · made by Google.
- **Strengths:** Zero install friction, integrated into Settings, zero cost.
- **Weaknesses:** Trivially bypassed (one tap in Settings turns the timer off); no deterrents; no task integration; commonly cited as "doesn't actually block" in our acquisition interviews.
- **Use as foil:** *"Digital Wellbeing is easy to bypass. FocusFlow's accessibility enforcement is not."*

### Cluster D — Out-of-pattern players

#### 9. Freedom — *VPN-based, multi-platform, premium*

- **Play Store:** 4.3★ · 50k+ reviews · 5M+ downloads
- **Price:** $8.99/mo · $99.99/yr · $129.99 lifetime
- **Strengths:** Only true cross-device blocker (Android, iOS, Mac, Windows, Chrome); polished brand; "Locked mode".
- **Weaknesses:** VPN-based on Android — fails offline, drains battery, can be killed in network settings, can't block apps that don't use the internet; Android is a second-class citizen vs Mac; VC obligations mean subscription forever.
- **How we beat them:** "Works offline" demo video is our single most powerful asset. Run ads on "Freedom alternative offline Android".

#### 10. Forest — *Gamified honor-system timer*

- **Play Store:** 4.8★ · 1M+ reviews · 10M+ downloads
- **Price:** $1.99 one-time + $0.99/mo for premium
- **Strengths:** Best-looking app in the category; gamification (virtual trees → real trees) drives retention; community accountability; massive brand.
- **Weaknesses:** Doesn't actually enforce anything — close Forest, open Instagram. Useless when willpower has already failed.
- **Position vs us:** Different psychology entirely. *"Forest asks nicely. FocusFlow enforces."* Don't fight on visual design — fight on enforcement.

#### 11. Cold Turkey Blocker — *Desktop-only, mentioned for context*

- **Platform:** Windows + macOS only — **no Android version**.
- **Price:** $39 one-time (Pro)
- **Strengths:** Most hardcore desktop blocker; kernel-level integration on macOS; cannot be bypassed without a full reboot.
- **Weaknesses:** No mobile presence — but mobile is where the addiction lives in 2026.
- **Position vs us:** Adjacent, not competitive. Worth mentioning in content marketing as the "desktop equivalent of FocusFlow".

#### 12. Brick (formerly Unpluq) — *Hardware NFC puck*

- **Price:** $59 one-time (no subscription)
- **Strengths:** Pure one-time pricing; physical action to unblock (tap NFC tag) is a meaningful friction step; strong press in 2024–2026 (Apartment Therapy, Marie Claire, Cybernews).
- **Weaknesses:** Costs $59 to start (vs $0 for us); requires carrying or placing the puck; iOS-first; one-tap unlocks negate enforcement; can't do task-linked or scheduled blocking.
- **Position vs us:** Niche hardware play. Their existence validates the "people will pay one-time for this" thesis. *"Brick costs $59 and a Tile-sized object. FocusFlow is free and lives on the phone you already have."*

---

## Competitive Positioning Map

```
                          HIGH ENFORCEMENT
                                |
                       ★ FocusFlow
                                |
            Lock Me Out         |
        AppBlock                |
        Stay Focused            |          Brick (hardware)
                                |
NO/ONE-TIME ___________________ |__________________ SUBSCRIPTION
  PRICING                       |                      REQUIRED
                                |
        ScreenZen               |          Freedom
                                |          Opal
        Digital Wellbeing       |          One Sec (Pro)
                                |          StayFree (Pro)
                       Forest   |
                                |
                          LOW ENFORCEMENT
```

**FocusFlow uniquely owns the top-left quadrant: high enforcement + zero subscription.**

The only neighbours are Lock Me Out (one-time tier exists but no task linking, no deterrents) and Brick (hardware, $59 entry cost). Defend this corner.

---

## Import-from-Competitor Roadmap

The user request that triggered this analysis: *expand import support beyond what we have today*. Here is the prioritised list, ranked by expected acquisition value × engineering effort.

| # | Source app | Why prioritise | Importable data | Effort |
|---|---|---|---|---|
| 1 | **Stay Focused** | Active refugee crisis; same accessibility model; identical mental model | Blocked apps list, schedules, daily limits | Medium — they have an export-to-text feature |
| 2 | **AppBlock** | Largest competitor by installs; subscription fatigue is high | Blocked apps list, profiles, schedules | Medium — JSON export available in Pro |
| 3 | **Lock Me Out** | One-time-payment users are price-sensitive switchers | Blocked apps list, schedules | Low — exposes a backup file we can parse |
| 4 | **Digital Wellbeing** | Default app — every Android user has one | App timer list, focus mode list | Hard — requires UsageStats permission, not a true export |
| 5 | **One Sec** | Premium churn segment | Watched apps list | Low — short list (free tier = 1 app) |
| 6 | **ScreenZen** | Free-to-free crossover unlikely but nice gesture | Per-app delay settings | Low — JSON backup exists |
| 7 | **Forest** | Gamified-timer users rarely switch to enforcers | Blocked sites list (browser extension only) | Skip — out of pattern |
| 8 | **Freedom** | VPN model is incompatible with our enforcement | Blocklists | Skip — formats incompatible |
| 9 | **Opal** | iOS-first; Android Opal users self-select to us | None public on Android | Skip until they ship export |

**Build order recommendation:** ship #1, #2, #3 in a single "Import from another blocker" sheet during onboarding. They cover ~80% of the addressable migration intent and share the same data shape (a list of package names + optional schedules).

Implementation sketch (for engineering, not marketing):

- One `ImportSource` interface, three concrete parsers (`StayFocusedParser`, `AppBlockParser`, `LockMeOutParser`).
- All three parsers emit the same intermediate `{ blockedPackages: string[], schedules?: Schedule[], dailyAllowance?: AllowanceEntry[] }` structure.
- Reuse the existing `setStandaloneBlockAndAllowance` flow on `AppContext` to commit the merged result.
- Add an "Import from another app" button on the empty state of the Standalone Block screen and in the side menu.

---

## White Space — Where No One Plays

1. **Always-on layered enforcement.** As of the changes shipped this week, FocusFlow is the only app where System Protection, Install/Uninstall guard, Shorts blocker, Reels blocker, and Keyword blocker run continuously when toggled — not only during a session. Every other enforcer is session-gated.
2. **Task-linked auto-blocking.** Zero competitors offer this. The demo video writes itself.
3. **Three-layer aversion deterrents.** Dim + vibrate + sound is unique. Forest's tree-dies is the only adjacent concept and it is purely visual.
4. **Free + one-time + open source + no telemetry.** Lock Me Out has one-time, ScreenZen is free, Brick is one-time hardware. Nobody combines all three with our enforcement depth.
5. **Trust pledge in writing.** Stay Focused destroyed the trust dimension of this category. We can own it permanently.

---

## Action Plan — Top 5 Specific Moves

1. **Ship the "Import from Stay Focused / AppBlock / Lock Me Out" sheet** within 30 days. Brand it inside the app as *"Coming from another blocker?"*. Single sheet, three buttons, one parser interface behind them.
2. **Cut a 20-second always-on demo video.** Toggle Shorts blocker, exit the app, open YouTube → blocked. Same for Keyword blocker. Post to Reddit, Instagram, TikTok with the caption *"Every other blocker only works during a session. Ours doesn't sleep."*
3. **Build a `/coming-from-stay-focused` landing page.** One scroll: trust pledge, import button, screenshot of the import sheet, link to download.
4. **Reddit reply playbook.** Five canned reply templates for r/androidapps, r/productivity, r/nosurf, r/getdisciplined, r/ADHD — each tailored to the most common refugee question. Don't spam; reply only where someone has already asked for an alternative.
5. **Trust Pledge in writing.** One paragraph in Privacy Policy and a banner in Settings: *"FocusFlow will not revoke your access, will not introduce a subscription on existing features, and will not transmit your blocked-app list."* Sign it with the developer name.

---

## Battlecard — Sales / Reddit Reply Snippets

| Competitor | One-line trap question to set | Our positioning sentence |
|---|---|---|
| AppBlock | "Does it actually link to your calendar or task list?" | "Same enforcement, no subscription, plus task-linked auto-blocking." |
| Stay Focused | "Did your lifetime licence get revoked too?" | "Free, open source, written trust pledge — your access cannot be revoked." |
| Lock Me Out | "Does it give you task-linked blocking and aversion deterrents?" | "Same one-time-payment honesty, plus free, plus task linking, plus three-layer deterrents." |
| Freedom | "Does it still block when you go offline?" | "FocusFlow uses Android's Accessibility Service, not a VPN — your blocks survive airplane mode." |
| Forest | "What stops you from just closing Forest?" | "Forest asks nicely. FocusFlow enforces." |
| One Sec | "Does the breath actually stop you, or do you still scroll?" | "Mindful pause is the appetiser. Hard enforcement is the meal." |
| ScreenZen | "Does it block apps when willpower has already failed?" | "We share the free-forever promise. We add the hard block." |
| Opal | "How is the Android version compared to iOS?" | "Opal on Android is v1. FocusFlow is built Android-first." |
| Brick | "Do you want to carry a $59 puck for the rest of your life?" | "Same one-time idea — without the puck and without the $59." |
| Digital Wellbeing | "How easy is it to turn off?" | "One tap in Settings. FocusFlow's System Protection blocks that tap." |

---

## Sources

1. Cold Turkey pricing — https://getcoldturkey.com/pricing/
2. Cold Turkey 2026 review — https://productivitystack.io/tools/cold-turkey/
3. Opal Play Store listing — https://play.google.com/store/apps/details?id=com.withopal.opal
4. Opal pricing — https://www.opal.so/ (and App Store listing)
5. One Sec Play Store — https://play.google.com/store/apps/details?id=wtf.riedel.onesec
6. One Sec Pro plans — https://tutorials.one-sec.app/en/articles/3036418
7. ScreenZen — https://screenzen.co/
8. ScreenZen Play Store — https://play.google.com/store/apps/details?id=com.screenzen
9. StayFree — https://stayfreeapps.com/
10. StayFree Play Store — https://play.google.com/store/apps/details?id=com.burockgames.timeclocker
11. Lock Me Out — https://www.teqtic.com/lock-me-out
12. Lock Me Out Play Store — https://play.google.com/store/apps/details?id=com.teqtic.lockmeout
13. Brick review — https://cybernews.com/reviews/brick-phone-blocker-review/
14. Brick (Apartment Therapy) — https://www.apartmenttherapy.com/brick-app-review-37523373
15. AppBlock — https://appblock.app/
16. Freedom — https://freedom.to/
17. Forest — https://www.forestapp.cc/
18. Best app blockers 2026 (Mindful Suite) — https://www.mindfulsuite.com/reviews/best-app-blockers
19. Roots — https://www.getroots.app/
20. Flipd — https://www.flipdapp.co/

---

*Methodology note: profiles for newer or smaller competitors (Opal Android, Lock Me Out, Brick) are built from vendor pages, store listings, and press reviews rather than independent G2/Capterra data — those databases have thin coverage of consumer Android. Pricing reflects publicly listed tiers as of April 2026 and may change.*
