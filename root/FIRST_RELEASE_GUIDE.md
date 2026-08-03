# FocusFlow — First Release Publishing Guide
> Step-by-step. No assumptions. Follow in order.

---

## Overview

Publishing your first Play Store release has three phases:
1. **Prepare** — build the signed APK/AAB and gather all assets
2. **Submit** — configure Play Console and upload everything
3. **Pass review** — handle Accessibility Services scrutiny and get approved

This guide covers all three. Do not skip steps — Play Store first-time submissions are reviewed manually.

---

## Phase 1: Prepare Your Build

### Step 1: Generate a Keystore (one-time, permanent)

Your keystore is the cryptographic identity of your app. You cannot update your app on Play Store without the same keystore. Store it somewhere permanent and backed up.

```bash
keytool -genkeypair -v \
  -keystore focusflow-release.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias focusflow
```

You will be prompted for:
- Keystore password (save this — you need it forever)
- Key alias password (same or different — save this)
- Your name / organization / city / country

**Back this file up immediately.** If you lose it, you cannot update the app on Play Store — you would have to republish under a new package name and lose all your reviews.

See `KEYSTORE_GUIDE.md` for full storage and backup instructions.

---

### Step 2: Configure Signing in your Build

In `artifacts/focusflow/android/app/build.gradle`, add your signing config:

```gradle
android {
    signingConfigs {
        release {
            storeFile file("../../focusflow-release.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "focusflow"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

Set these as environment variables (not in code):
```
KEYSTORE_PASSWORD=<your keystore password>
KEY_PASSWORD=<your key password>
```

---

### Step 3: Build the Release AAB

Google Play requires an Android App Bundle (.aab), not an APK.

```bash
cd artifacts/focusflow/android
./gradlew bundleRelease
```

The output will be at:
```
artifacts/focusflow/android/app/build/outputs/bundle/release/app-release.aab
```

Verify the file exists and is larger than 1MB before proceeding.

---

### Step 4: Verify the Build Works

Before submitting to Play Store, install the release APK on a physical device:

```bash
./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

Test the following before submission — these are the most common causes of rejection or 1-star reviews at launch:

- [ ] App installs cleanly on a fresh Android device
- [ ] Accessibility Service permission prompt appears and is clearly explained
- [ ] App blocking works after granting Accessibility Service
- [ ] App blocking works in airplane mode (this is your hero claim — verify it)
- [ ] The "Blocked" overlay shows FocusFlow branding clearly (not a system dialog)
- [ ] Onboarding includes the "Bought once, yours forever" screen
- [ ] Free tier limits (3 tasks, 3 apps) work correctly
- [ ] App does not crash on devices running Android 10, 12, 14 (test across versions if possible)
- [ ] Privacy policy URL opens correctly from within the app

---

## Phase 2: Set Up Play Console

### Step 5: Create a Google Play Developer Account

If you don't have one:
1. Go to https://play.google.com/console
2. Pay the one-time $25 registration fee
3. Complete identity verification (takes 24–48 hours for personal accounts, 1–3 days for organizations)
4. Use a real business name — "TB Techs" is your developer name on the store

**Developer name matters.** It appears under your app name in search results. "TB Techs" is fine for launch.

---

### Step 6: Create a New App in Play Console

1. Play Console → All apps → Create app
2. App name: `FocusFlow: Focus & App Blocker`
3. Default language: English (United States)
4. App or game: App
5. Free or paid: Free (you will add in-app purchases for Pro)
6. Accept the declarations

---

### Step 7: Complete the Store Listing

Use the exact copy from `PLAY_STORE_STRATEGY.md`. Do not paraphrase.

**App name (30 chars):**
```
FocusFlow: Focus & App Blocker
```

**Short description (80 chars):**
```
On-device app blocking tied to your tasks. No subscription. No bypass.
```

**Full description:** Copy the full description from `PLAY_STORE_STRATEGY.md` Section 3.

**App icon:**
- File: `artifacts/focusflow/assets/images/icon.png`
- Required: 512×512 PNG, no transparency, no rounding (Play Store adds rounding)

**Feature graphic:**
- Required: 1024×500 JPG or PNG
- Design: App name + tagline "Block distracting apps. On-device. No bypass." on a dark background
- Tool: Canva → "Feature Graphic" template works fine

**Screenshots (minimum 4, recommended 8):**
Follow the brief in `PLAY_STORE_STRATEGY.md` Section 5. Capture on a real Android device.
- Required size: minimum 320dp on shortest side, max 3840dp on longest side
- Format: JPEG or PNG, no transparency
- Take on a Pixel or Samsung device for clean screenshots (avoid skins with system UI overlays)

---

### Step 8: Set Category and Tags

- Application type: Application
- Category: Productivity
- Tags: Add "Focus", "Productivity", "App Blocker", "Time Management"
- Content rating: Complete the questionnaire — select "Everyone," no violence, no adult content

---

### Step 9: Set Up Pricing

- Availability: Start with your primary market (United States), then expand
- Price: Free (the app is free to download)

**For in-app purchases (FocusFlow — free):**
1. Play Console → Monetize → Products → In-app products
2. Create product ID: `focusflow_pro`
3. Name: "FocusFlow — Lifetime"
4. Description: "Unlimited tasks, unlimited blocked apps, all features. Bought once, yours forever."
5. Default price: free USD
6. Status: Active

---

### Step 10: Add a Privacy Policy

Google requires a privacy policy for any app that requests sensitive permissions (Accessibility Service qualifies).

Your privacy policy must state:
- Accessibility Service is used solely to detect when blocked apps are opened
- No screen content is read, stored, or transmitted
- No personal data is collected or sent off-device
- The permission can be revoked at any time in Settings
- No data is shared with third parties

Host it at a stable URL (GitHub Pages, Notion, or a simple web page). Add the URL to:
- Play Console → Store listing → Privacy policy
- Inside the app (Settings → Privacy Policy)

---

### Step 11: Complete the App Content Declaration

Play Console → Policy → App content

Complete every section:

**Accessibility Services declaration** (this is required for FocusFlow):
- Question: "Does your app use Accessibility Services?"
- Answer: Yes
- Justification text (copy exactly):
```
FocusFlow uses Android Accessibility Service to detect when a user attempts to open 
a blocked app during an active focus session. When detected, FocusFlow displays a 
full-screen deterrent overlay and returns the user to the home screen. This 
enforcement is the core functionality of the app and cannot be achieved through any 
other Android API. FocusFlow does not read screen content, record user interactions, 
collect any personal data, or transmit any information off the device.
```

**Ads:** No ads (if true)  
**Data safety:** Complete the Data Safety form accurately:
- Data collected: None
- Data shared: None
- Security practices: Data encrypted in transit (if applicable), you can delete user data

---

## Phase 3: Submit and Pass Review

### Step 12: Upload Your AAB

1. Play Console → Testing → Internal testing → Create new release
2. Upload your `.aab` file
3. Release name: `1.0.0`
4. Release notes (what's new):
```
First release of FocusFlow.

• On-device app blocking using Android Accessibility Service
• Task-linked blocking: blocks start when your task starts
• Works in airplane mode — no cloud dependency
• Aversion deterrents: screen dim, vibration, sound
• Daily allowance modes: count, time budget, interval unlock
• Free tier: 3 tasks, 3 blocked apps
• FocusFlow: unlimited everything, free free one-time open source
```

5. Save and review → Roll out to Internal testing

**Internal testing first.** Add your own email as a tester. Install via the internal test link. Confirm everything works on a real device before promoting to production.

---

### Step 13: Promote to Production

After testing:
1. Testing → Internal testing → Promote release → Production
2. Rollout percentage: Start at **20%** — this protects you if there's a critical bug
3. If no crashes or bad reviews after 48 hours → increase to 100%

Play Console → Publishing → Review → Submit for review

---

### Step 14: Prepare for the Review Process

**Timeline:**
- First submission: 2–5 business days
- If rejected: You receive a specific reason. Fix it and resubmit within 7 days
- After first fix: 1–3 business days
- Plan for 2–3 weeks total before the app is live

**Most likely rejection reason: Accessibility Services**

If Google rejects for Accessibility Services, they will ask you to prove the permission is necessary for core functionality. Your response:

1. Record a 2-minute video showing:
   - The app's onboarding explaining the permission
   - Granting the permission
   - A focus session starting
   - Opening a blocked app → the overlay appearing
   - The user being redirected back to the task
2. Submit the video as part of your appeal
3. Reference the exact justification text from Step 11

**What Google looks for:**
- The permission explanation is clear to users (in-app, not just in the Play Console)
- The permission is used for exactly what you describe (they will test the app)
- No screen content is accessed (the overlay must not read what's on the blocked app's screen)
- The service is not always-on when not needed

---

### Step 15: After Approval — Launch Actions

Do these on the day your app goes live. Do not wait.

**Day 1 (launch day):**
- [ ] Post in r/androidapps: "I built this" post (template in `GROWTH_PLAYBOOK.md` Section 3)
- [ ] Post in r/nosurf: same post, different intro
- [ ] Find the top 3 active "Stay Focused alternative" Reddit threads and post a reply
- [ ] Update your AlternativeTo.net profile: https://alternativeto.net — add FocusFlow
- [ ] Share a link with 5 personal contacts and ask them to download and leave an honest review
- [ ] Set up Google Alerts using links from `competitor-monitoring.md`

**Day 2–3:**
- [ ] Post in r/productivity
- [ ] Email 10 micro-influencers (template in `AD_CREATIVES_BRIEF.md` Section 8)
- [ ] Record the 30-second "bypass test" screen recording

**Day 7:**
- [ ] Check Play Console for any early crashes or ANRs — fix immediately if found
- [ ] Respond to every Play Store review personally — every single one
- [ ] Check your Day-1 retention in Play Console (should be >55%)

---

## Checklist Summary

### Pre-Submission
- [ ] Keystore generated and backed up
- [ ] Release AAB built and signed
- [ ] App tested on real Android device
- [ ] Accessibility Service prompt is clear and shown before permission request
- [ ] "Blocked" overlay clearly shows FocusFlow branding
- [ ] Privacy policy live at a stable URL
- [ ] Onboarding includes "Bought once, yours forever" screen
- [ ] Free tier limits work correctly

### Play Console Setup
- [ ] Developer account created ($25 fee paid)
- [ ] App name: FocusFlow: Focus & App Blocker
- [ ] Store listing copy from PLAY_STORE_STRATEGY.md
- [ ] App icon (512×512 PNG)
- [ ] Feature graphic (1024×500)
- [ ] 8 screenshots per PLAY_STORE_STRATEGY.md Section 5
- [ ] Category: Productivity
- [ ] Privacy policy URL added
- [ ] Data safety form complete
- [ ] Accessibility Services justification text submitted
- [ ] In-app product created: focusflow_pro at free

### Submission
- [ ] AAB uploaded to Internal testing
- [ ] Internal testing passed on real device
- [ ] Promoted to Production (start at 20% rollout)
- [ ] Release notes written

### Launch Day
- [ ] Reddit posts live
- [ ] Google Alerts set up
- [ ] AlternativeTo.net profile created
- [ ] Influencer outreach started
- [ ] Play Console being monitored daily

---

## Key Contacts and Resources

| Resource | URL |
|---|---|
| Google Play Console | https://play.google.com/console |
| Play Store policy (Accessibility) | https://support.google.com/googleplay/android-developer/answer/10964491 |
| Data safety guidance | https://support.google.com/googleplay/android-developer/answer/10787469 |
| AlternativeTo listing | https://alternativeto.net/platform/android/ |
| ASO keyword tool (free) | https://www.appfollow.io or https://keywordtool.io/google-play |
| Android App Bundle guide | https://developer.android.com/guide/app-bundle |

---

## After Launch: Month 1 Priorities

Follow the full plan in `GROWTH_PLAYBOOK.md`. In order of ROI:
1. Reply to every Play Store review within 48 hours
2. Reply to Stay Focused complaint threads on Reddit (do not spam — be helpful)
3. Post to r/androidapps, r/productivity, r/nosurf (3 days apart, one subreddit each)
4. Monitor crashes and ANRs in Play Console daily
5. Trigger the in-app review prompt at day 7 streak users (highest positive moment)
6. After 50 organic ratings at 4.2★+: begin the $200/month Reddit ad experiment
