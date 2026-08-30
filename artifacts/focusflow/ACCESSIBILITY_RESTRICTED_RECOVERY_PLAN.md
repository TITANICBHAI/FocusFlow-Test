# Accessibility Restricted-Settings Recovery Plan

## Goal

Help an Android user recover when the Accessibility entry is greyed out, without
showing the recovery helper before the user has tried the normal Accessibility
action.

The flow applies only to first-run onboarding. The existing Permissions screen
and its proactive `RestrictedSettingsBanner` remain unchanged.

## Corrections applied to the source plan

- **Post-unlock retry:** Android can clear the restricted-settings AppOp before
  Accessibility is enabled. The recovery UI must remain visible in a
  just-unlocked state and keep the retry action available; it must not vanish
  at the exact point the user needs to continue.
- **Native navigation behavior:** the current Kotlin open-settings methods
  perform their own activity/context fallback and resolve their promises even
  when they cannot prove that a screen opened. The new component will not
  describe JS `catch` blocks as a reliable fallback chain. It will use the
  native methods directly and retain a final best-effort fallback only where
  the bridge itself rejects.
- **Targeted service deep link:** do not add it. The general Accessibility
  settings intent is the safer cross-OEM behavior.

## Scope

- [x] Add `src/components/AccessibilityRestrictedRecovery.tsx`.
- [x] Update `app/onboarding.tsx` only:
  - [x] Replace the immediate onboarding banner with the recovery component.
  - [x] Track whether the user attempted Accessibility setup.
  - [x] Render recovery only while Accessibility is not granted.
- [x] Leave `app/permissions.tsx` unchanged.
- [x] Leave `src/components/RestrictedSettingsBanner.tsx` unchanged.
- [x] Do not change the native Kotlin module or add a targeted OEM-specific
  Accessibility intent.

## Component behavior

- [x] Render nothing on non-Android platforms.
- [x] Render nothing before the Accessibility action has been attempted.
- [x] Render nothing when Accessibility is granted.
- [x] Show a greyed-entry question after the user returns from the normal
  Accessibility attempt, without requiring reliable detection of which system
  row they tapped.
- [x] Provide three choices: “Yes, I tapped it”, “No, I haven’t tapped it”, and
  “Skip Accessibility”.
- [x] “No, I haven’t tapped it” shows the greyed-entry instructions, deep-links
  to Accessibility settings, and waits for the user to confirm they are done.
- [x] “Yes, I tapped it” goes directly to the App Info → ⋮ → Allow restricted
  settings instructions.
- [x] Keep a collapsible greyed-entry fallback inside the App Info instructions
  so an accidental “Yes” selection cannot trap the user.
- [x] Check `UsageStatsModule.isRestrictedSettingsBlocked()` only after the App
  Info step is marked done.
- [x] If restricted settings are allowed, show the final Accessibility enable
  step and keep it visible until Accessibility is actually granted.
- [x] “Skip Accessibility” dismisses this recovery helper and lets onboarding
  continue.
- [x] Show a dismiss X on every recovery stage; it dismisses only the popup
  recovery helper and does not mark Accessibility as granted or exit onboarding.
- [x] Present recovery as a step-based modal popup over onboarding, with a
  progress indicator and one focused stage at a time.

## Verification

- [x] TypeScript/type-level checks for the changed component and screen.
- [x] FocusFlow test suite (90 tests).
- [x] Expo production-style Android and iOS bundle build.
- [x] Confirm only onboarding changed; Permissions and the existing banner are
  untouched.
- [x] Confirm Android/non-Android and pre-attempt render gates.
- [x] Confirm the retry panel remains after App Info unlock.
- [x] Confirm recovery can be dismissed from every stage without an async check
  reopening the helper.
- [x] Confirm no `allowBackup` changes are part of this accessibility work; the
  prior backup-security changes remain separate.
- [ ] Run the FocusFlow workflow and inspect logs after implementation — blocked
  because no FocusFlow workflow is registered in the workspace workflow list.
- [ ] Mark device-only Android 13+ verification items below when a device is
  available:
  - [ ] Sideloaded install shows no panel before the Accessibility attempt.
  - [ ] Returning from blocked Accessibility settings shows the prompt.
  - [ ] App Info button opens FocusFlow App Info.
  - [ ] Both manual paths are clear and accurate.
  - [ ] Returning after Allow restricted settings keeps the retry visible.
  - [ ] Retry opens Accessibility settings and the toggle can be enabled.
  - [ ] Play Store/trusted install and Android 12 or older do not show the
    panel.
  - [ ] Dark mode and small-screen layout remain usable.

## Execution status

Legend: `[x]` complete, `[ ]` pending or blocked. Blocked items say so
explicitly in their text.

- [x] Read the Android findings and source plan.
- [x] Resolve the post-unlock CTA and native promise-handling catches.
- [x] Create this trackable plan.
- [x] Implement the recovery component.
- [x] Wire the component into onboarding.
- [x] Run static validation available in this checkout.
- [ ] Restart the FocusFlow workflow and inspect logs — blocked because no
  FocusFlow workflow is registered in the workspace workflow list.
- [ ] Complete physical Android 13+ sideload verification — blocked until an
  Android 13+ device/build is available.