# Accessibility Restricted-Settings Recovery Plan

## Goal

Help a sideloaded Android 13+ user recover when Android greys out FocusFlow's
Accessibility toggle, without showing the help panel before the user has tried
the normal Accessibility action.

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
- [x] Detect the Android 13+ restricted-settings wall using
  `UsageStatsModule.isRestrictedSettingsBlocked()`.
- [x] Recheck on mount and when the app returns to the foreground.
- [x] Show the prompt after a failed Accessibility attempt:
  “Do you need help enabling it?”
- [x] “Not now” keeps a compact header and a link to reopen the help.
- [x] “Yes, show me how” shows:
  - [x] A prominent App Info button.
  - [x] App Info → ⋮ → Allow restricted settings instructions.
  - [x] A separate Settings → Apps → FocusFlow → ⋮ fallback route.
  - [x] A “Try Accessibility Settings Again” button.
- [x] When the restriction changes from blocked to allowed but Accessibility is
  still not granted, keep the panel visible, show that the unlock succeeded,
  and keep the retry action available.
- [x] Clear the panel once Accessibility becomes granted.

## Verification

- [ ] TypeScript/type-level checks for the changed component and screen — blocked
  because this checkout has no installed `node_modules` or `tsc` binary.
- [x] Confirm only onboarding changed; Permissions and the existing banner are
  untouched.
- [x] Confirm Android/non-Android and pre-attempt render gates.
- [x] Confirm the retry panel remains after App Info unlock.
- [x] Confirm no `allowBackup` changes are part of this accessibility work; the
  prior backup-security changes remain separate.
- [ ] Run the FocusFlow workflow and inspect logs after implementation — blocked
  because Expo is not linked while `node_modules` is missing.
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
- [ ] Restart the FocusFlow workflow and inspect logs — blocked by missing
  dependencies (`expo` is not available).
- [ ] Complete physical Android 13+ sideload verification — blocked until an
  Android 13+ device/build is available.