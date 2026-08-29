# Implementation Plan — Accessibility Restricted-Settings Recovery Flow

## Overview

This adds a **post-attempt recovery panel** to `onboarding.tsx` that
appears only after the user has tried to enable Accessibility and returned
without success because Android's restricted-settings wall is active.
Nothing changes for `permissions.tsx`. The existing `RestrictedSettingsBanner`
inside `onboarding.tsx` is removed. The one inside `permissions.tsx` stays.

---

## Scope

| File | Action |
|---|---|
| `src/components/AccessibilityRestrictedRecovery.tsx` | **Create (new file)** |
| `app/onboarding.tsx` | **Four surgical edits** |
| `app/permissions.tsx` | **No change** |
| `src/components/RestrictedSettingsBanner.tsx` | **No change** |

---

## Part 1 — Trigger Logic

The component renders **only when ALL four are true simultaneously**:

1. `Platform.OS === 'android'`
2. `accessibilityAttempted === true` (prop passed from parent)
3. `statuses['accessibility'] !== 'granted'` (implicit — parent only renders
   the component when accessibility is still denied; see Part 2)
4. `isRestricted === true` (internal state from `UsageStatsModule.isRestrictedSettingsBlocked()`)

Condition 3 is enforced by the parent (see Part 2, Edit D).
The component enforces conditions 1, 2, 4 internally and returns `null` if any fails.

---

## Part 2 — Changes to `app/onboarding.tsx`

Four edits. No other lines change.

---

### Edit A — Remove `RestrictedSettingsBanner` import

**Find and delete this line** (it is the only import from that module in this file):
```
import { RestrictedSettingsBanner } from '@/components/RestrictedSettingsBanner';
```

**Replace with:**
```typescript
import { AccessibilityRestrictedRecovery } from '@/components/AccessibilityRestrictedRecovery';
```

---

### Edit B — Add `accessibilityAttempted` state

**Find** the block of `useState` declarations inside `OnboardingScreen`
(same group as `pinProtectionChoice`, `defensePinSet`, etc.).

**Add this line anywhere in that group:**
```typescript
const [accessibilityAttempted, setAccessibilityAttempted] = useState(false);
```

---

### Edit C — Mark attempt in `handleGrant`

**Find** this exact block inside `handleGrant`:
```typescript
} else if (perm.id === 'accessibility') {
  await UsageStatsModule.openAccessibilitySettings();
}
```

**Replace with:**
```typescript
} else if (perm.id === 'accessibility') {
  setAccessibilityAttempted(true);
  await UsageStatsModule.openAccessibilitySettings();
}
```

`setAccessibilityAttempted(true)` is placed BEFORE the `await` so that even
if the native module throws and control falls to the `catch` block (which
calls `Linking.openSettings()` as fallback), the attempt is still recorded.

---

### Edit D — Remove old banner, add new recovery component

**Find** this block in the JSX (inside `{step === 'core' && (...)}`):
```tsx
        {/* Restricted-settings unlock banner — shown above everything else
            on the first-run flow when the OS is currently locking the
            Accessibility toggle. Auto-hides the moment the user completes
            the App Info → ⋮ → Allow restricted settings flow. */}
        <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
          <RestrictedSettingsBanner />
        </View>
```

**Delete it entirely.** (Three lines of comment + three lines of JSX = 6 lines gone.)

---

**Then find** the end of the core permission cards map and the comment above the
missing-permissions tip. It looks like this:
```tsx
        })}

        {/* Missing required permissions tip */}
        {!allRequiredReady && (
```

**Insert the new component between those two blocks:**
```tsx
        })}

        {/* Restricted-settings recovery — only shown after user attempted
            Accessibility and Android confirmed the restriction is active. */}
        {statuses['accessibility'] !== 'granted' && (
          <AccessibilityRestrictedRecovery
            accessibilityAttempted={accessibilityAttempted}
          />
        )}

        {/* Missing required permissions tip */}
        {!allRequiredReady && (
```

The `statuses['accessibility'] !== 'granted'` guard in the parent means the
component is unmounted the moment accessibility is successfully granted,
so there is no need for an extra dismiss animation — it simply disappears
with the normal React re-render.

---

## Part 3 — New File: `src/components/AccessibilityRestrictedRecovery.tsx`

### 3.1 Imports

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UsageStatsModule } from '@/native-modules/UsageStatsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
```

---

### 3.2 Types

```typescript
type Props = {
  accessibilityAttempted: boolean;
};

type HelpChoice = 'idle' | 'yes' | 'no';
```

---

### 3.3 Internal State

| State | Type | Initial | Purpose |
|---|---|---|---|
| `isRestricted` | `boolean` | `false` | Result of `isRestrictedSettingsBlocked()` |
| `helpChoice` | `HelpChoice` | `'idle'` | Which phase the UI is in |
| `openingSettings` | `boolean` | `false` | Loading indicator for "Try Again" button |

---

### 3.4 `recheck` function

Called on mount and every time `AppState` transitions to `'active'`.

```
async function recheck():
  if Platform.OS !== 'android': return
  try:
    const restricted = await UsageStatsModule.isRestrictedSettingsBlocked()
    setIsRestricted(restricted)
    if !restricted:
      setHelpChoice('idle')   // reset so the panel is fresh if restriction
                              // somehow comes back (e.g. app reinstalled)
  catch:
    setIsRestricted(false)    // safe failure — never show the panel on error
```

Wire it up:
```typescript
useEffect(() => {
  void recheck();
  const sub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') void recheck();
  });
  return () => sub.remove();
}, [recheck]);
```

---

### 3.5 Early return

```typescript
if (!accessibilityAttempted || !isRestricted) return null;
```

This is the only render gate. If either condition is false, nothing is shown.
When the user completes the unlock flow and returns to the app, `recheck()`
fires, `isRestricted` becomes `false`, and the component returns `null` —
it self-dismisses with no extra logic needed.

---

### 3.6 `openAppInfo` helper

```
async function openAppInfo():
  try:
    await UsageStatsModule.openAppInfoSettings()
  catch:
    try:
      await Linking.openSettings()
    catch:
      // final silent failure — nothing more to do
```

---

### 3.7 `handleTryAgain` helper

```
async function handleTryAgain():
  setOpeningSettings(true)
  try:
    await UsageStatsModule.openAccessibilitySettings()
  catch:
    try:
      await Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS')
    catch:
      try:
        await Linking.openSettings()
      catch:
        // silent failure
  finally:
    // Delay clearing the spinner so it doesn't flicker away before the
    // system settings screen has had a chance to appear.
    setTimeout(() => setOpeningSettings(false), 800)
```

---

### 3.8 JSX Structure

Three phases rendered based on `helpChoice`.

#### Outer container (always rendered when not null):
- `borderRadius: RADIUS.lg`
- `borderWidth: 1.5`
- `borderColor: COLORS.primary + '55'`
- `backgroundColor: theme.card`
- `padding: SPACING.md`
- `gap: SPACING.sm`

#### Header row (always rendered when not null):
Contains an orange icon ring on the left and two text lines on the right.

- **Icon ring**: 36×36 circle, `backgroundColor: COLORS.primary + '18'`,
  icon `lock-closed`, size 18, color `COLORS.primary`
- **Title**: `"Accessibility is still blocked"`, `FONT.sm`, `fontWeight: '800'`, `color: theme.text`
- **Subtitle**: `"Android is blocking this permission because FocusFlow was installed outside a trusted app store."`, `FONT.xs`, `lineHeight: 17`, `color: theme.textSecondary`

---

#### Phase: `helpChoice === 'idle'`

Renders below the header:

**Question text:**
`"Do you need help enabling it?"`, `FONT.xs`, `fontWeight: '600'`, `color: theme.textSecondary`

**Button row** (horizontal, gap `SPACING.sm`, wrapping):

Button 1 — "Yes, show me how":
- `backgroundColor: COLORS.primary`
- `paddingVertical: 9`, `paddingHorizontal: 14`
- `borderRadius: RADIUS.md`
- Icon: `checkmark`, size 14, color `#fff`
- Text: `"Yes, show me how"`, `FONT.xs`, `fontWeight: '700'`, `color: '#fff'`
- `onPress`: `setHelpChoice('yes')`

Button 2 — "Not now":
- Transparent background
- `borderWidth: 1`, `borderColor: theme.border`
- `paddingVertical: 9`, `paddingHorizontal: 14`
- `borderRadius: RADIUS.md`
- Text: `"Not now"`, `FONT.xs`, `fontWeight: '600'`, `color: theme.muted`
- `onPress`: `setHelpChoice('no')`

---

#### Phase: `helpChoice === 'yes'`

Renders below the header. Uses `gap: SPACING.sm` between sections.

**Section label:**
`"Quick fix"`, `FONT.xs`, `fontWeight: '800'`, `letterSpacing: 0.5`, `color: theme.text`

**Primary action button** (full width):
- `backgroundColor: COLORS.primary`
- `paddingVertical: 13`, `paddingHorizontal: 16`
- `borderRadius: RADIUS.md`
- `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: 8`
- Icon: `information-circle-outline`, size 17, color `#fff`
- Text: `"Open FocusFlow App Info"`, `FONT.sm`, `fontWeight: '800'`, `color: '#fff'`
- `onPress`: calls `openAppInfo()`
- This button is intentionally larger than normal action buttons.
  It is the primary action and must feel prominent and tappable.

**Primary path step list** (surface box below the button):
- Container: `backgroundColor: theme.surface`, `borderRadius: RADIUS.md`, `padding: SPACING.sm`, `gap: 6`
- Header text: `"Then follow these steps:"`, `FONT.xs`, `fontWeight: '700'`, `color: theme.text`, `marginBottom: 2`
- Five `<Step>` items (see Section 3.9):
  1. `Tap the ⋮ or : menu icon in the top-right corner of the App Info screen.`
  2. `Tap "Allow restricted settings".`
  3. `Return to FocusFlow.`
  4. `Tap "Try Accessibility Settings Again" below.`
  5. `Enable FocusFlow in the Accessibility settings that open.`

**Fallback section** (separate visual block below the primary box):
- Container:
  - `backgroundColor: theme.surface`
  - `borderRadius: RADIUS.md`
  - `borderWidth: StyleSheet.hairlineWidth`
  - `borderColor: theme.border`
  - `padding: SPACING.sm`
  - `gap: 6`
- Header text: `"Can't find the option? Try this path instead:"`,
  `FONT.xs`, `fontWeight: '700'`, `color: theme.textSecondary`, `marginBottom: 2`
- Six `<Step>` items, using `stepNumLight` style for number circles (see 3.9),
  meaning `COLORS.primary + '55'` background (dimmer, visually subordinate):
  1. `Open Android Settings.`
  2. `Go to Apps (some phones call it "App Management").`
  3. `Find and tap FocusFlow.`
  4. `Tap the ⋮ or : menu icon in the top-right corner.`
  5. `Tap "Allow restricted settings".`
  6. `Return to FocusFlow and tap "Try Accessibility Settings Again" below.`

**"Try Accessibility Settings Again" button** (bottom of the yes panel):
- `borderWidth: 1.5`, `borderColor: COLORS.primary`
- `backgroundColor: 'transparent'`
- `paddingVertical: 11`, `paddingHorizontal: 16`
- `borderRadius: RADIUS.md`
- `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: 8`
- `disabled` when `openingSettings === true`
- When loading: show `<ActivityIndicator size="small" color={COLORS.primary} />`
- When not loading:
  - Icon: `refresh-outline`, size 15, color `COLORS.primary`
  - Text: `"Try Accessibility Settings Again"`, `FONT.sm`, `fontWeight: '700'`, `color: COLORS.primary`
- `onPress`: calls `handleTryAgain()`

---

#### Phase: `helpChoice === 'no'`

Renders below the header. Just a single tappable text link.

- Text: `"Need help enabling it? Tap to see the fix."`, `FONT.xs`, `fontWeight: '600'`, `color: COLORS.primary`
- `onPress`: `setHelpChoice('idle')`
- `paddingVertical: 4` for easy tap target

Do NOT fully hide the component when `helpChoice === 'no'`. The header
(icon + title + subtitle) still shows, followed by this link. The user
can always get back to the help flow from the same place.

---

### 3.9 `Step` helper sub-component

```typescript
function Step({
  n,
  text,
  theme,
  light = false,
}: {
  n: number;
  text: string;
  theme: ReturnType<typeof useTheme>['theme'];
  light?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNum, light && styles.stepNumLight]}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );
}
```

`light` controls whether the number circle uses full or reduced purple:
- Primary path steps → `light={false}` → `backgroundColor: COLORS.primary`
- Fallback path steps → `light={true}` → `backgroundColor: COLORS.primary + '55'`

This gives a clear visual rank: full purple = do this first, muted = backup path.

---

### 3.10 StyleSheet Reference

Every style key the component uses, with exact values:

```
container:
  borderRadius: RADIUS.lg
  borderWidth: 1.5
  borderColor: COLORS.primary + '55'
  padding: SPACING.md
  gap: SPACING.sm

headerRow:
  flexDirection: 'row'
  alignItems: 'flex-start'
  gap: SPACING.sm

iconRing:
  width: 36
  height: 36
  borderRadius: 18
  backgroundColor: COLORS.primary + '18'
  alignItems: 'center'
  justifyContent: 'center'
  flexShrink: 0

headerText:
  flex: 1
  gap: 3

title:
  fontSize: FONT.sm
  fontWeight: '800'
  lineHeight: 18

subtitle:
  fontSize: FONT.xs
  lineHeight: 17

idleQuestion:
  fontSize: FONT.xs
  fontWeight: '600'

choiceRow:
  flexDirection: 'row'
  gap: SPACING.sm
  flexWrap: 'wrap'

yesBtn:
  flexDirection: 'row'
  alignItems: 'center'
  gap: 6
  backgroundColor: COLORS.primary
  paddingVertical: 9
  paddingHorizontal: 14
  borderRadius: RADIUS.md

yesBtnText:
  fontSize: FONT.xs
  fontWeight: '700'
  color: '#fff'

noBtn:
  flexDirection: 'row'
  alignItems: 'center'
  gap: 6
  borderWidth: 1
  paddingVertical: 9
  paddingHorizontal: 14
  borderRadius: RADIUS.md
  (borderColor from theme at render time)

noBtnText:
  fontSize: FONT.xs
  fontWeight: '600'
  (color from theme.muted at render time)

showHelpLink:
  fontSize: FONT.xs
  fontWeight: '600'
  color: COLORS.primary
  paddingVertical: 4

helpBody:
  gap: SPACING.sm

sectionLabel:
  fontSize: FONT.xs
  fontWeight: '800'
  letterSpacing: 0.5
  (color from theme.text at render time)

primaryBtn:
  flexDirection: 'row'
  alignItems: 'center'
  justifyContent: 'center'
  gap: 8
  backgroundColor: COLORS.primary
  paddingVertical: 13
  paddingHorizontal: 16
  borderRadius: RADIUS.md

primaryBtnText:
  fontSize: FONT.sm
  fontWeight: '800'
  color: '#fff'

stepsBox:
  borderRadius: RADIUS.md
  padding: SPACING.sm
  gap: 6
  (backgroundColor from theme.surface at render time)

stepsBoxHeader:
  fontSize: FONT.xs
  fontWeight: '700'
  marginBottom: 2
  (color from theme.text at render time)

fallbackBox:
  borderRadius: RADIUS.md
  borderWidth: StyleSheet.hairlineWidth
  padding: SPACING.sm
  gap: 6
  (backgroundColor: theme.surface, borderColor: theme.border at render time)

fallbackBoxHeader:
  fontSize: FONT.xs
  fontWeight: '700'
  marginBottom: 2
  (color from theme.textSecondary at render time)

stepRow:
  flexDirection: 'row'
  alignItems: 'flex-start'
  gap: 8

stepNum:
  width: 18
  height: 18
  borderRadius: 9
  backgroundColor: COLORS.primary
  alignItems: 'center'
  justifyContent: 'center'
  marginTop: 1
  flexShrink: 0

stepNumLight:
  backgroundColor: COLORS.primary + '55'

stepNumText:
  fontSize: 10
  fontWeight: '800'
  color: '#fff'

stepText:
  flex: 1
  fontSize: FONT.xs
  lineHeight: 17

tryAgainBtn:
  flexDirection: 'row'
  alignItems: 'center'
  justifyContent: 'center'
  gap: 8
  borderWidth: 1.5
  borderColor: COLORS.primary
  paddingVertical: 11
  paddingHorizontal: 16
  borderRadius: RADIUS.md

tryAgainBtnText:
  fontSize: FONT.sm
  fontWeight: '700'
  color: COLORS.primary
```

---

## Part 4 — Visual Design Rationale

### Why purple, not orange?

Counting actual usage in `onboarding.tsx`:
- `COLORS.primary` (purple `#6366f1`) — **22 uses**
- `COLORS.orange` (`#f59e0b`) — **10 uses**, all concentrated in two places:
  the attention callout strips on the VPN and Device Admin cards specifically,
  and the `whyBox` inside expanded card detail sections.

Orange in this codebase is a narrow special-purpose accent, used only for
those two "watch out, this is unusual" callouts. It is not the brand identity.
The existing `RestrictedSettingsBanner` (which this component replaces in
onboarding) uses orange heavily — that was inconsistent with the rest of the app.

The dominant interaction language in onboarding is purple: grant buttons,
progress bar, status badges, the tutorial banner, the `manageTip` block.
The new component matches that language.

### Visual lineage

The container and icon ring (`COLORS.primary + '55'` border,
`COLORS.primary + '18'` ring background) directly match the `tutorialBanner`
and `manageTip` styles already in `onboarding.tsx`. Any developer reading
the code will immediately recognise the pattern.

### Why not a modal?

The user is mid-onboarding and already looking at a scrollable list of cards.
A modal would force them to context-switch, remember what they were doing,
and dismiss. An inline expansion below the cards keeps them anchored to where
they are and makes the "Try Accessibility Settings Again" button immediately
visible after returning from settings.

### Light/dark mode

Every background, text, and border color that varies between light and dark
mode is pulled from `theme.*` at render time. Every static accent color
uses `COLORS.*`. This is identical to how every other component in the app
works, so both modes are handled automatically.

### Button hierarchy

```
[Open FocusFlow App Info]      ← filled purple, large padding  = PRIMARY
[Try Accessibility Again]      ← purple outline                = SECONDARY
[Not now]                      ← ghost outline, muted text     = TERTIARY
```

This makes the intended action path visually unambiguous even for a user
who is confused and stressed about a permission they can't enable.

---

## Part 5 — Error Handling Specification

| Failure | Behaviour |
|---|---|
| `isRestrictedSettingsBlocked()` throws | Treat as `false`. Never show the panel. |
| `openAppInfoSettings()` throws | Fallback to `Linking.openSettings()`. |
| `Linking.openSettings()` also throws | Silent catch. Nothing more to do. |
| `openAccessibilitySettings()` throws | Fallback to `Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS')`. |
| `sendIntent` also throws | Fallback to `Linking.openSettings()`. |
| Any fallback also throws | Silent catch. |
| `AppState` listener fires while component is unmounting | React will log a warning but this is not a bug. If needed, use a `mounted` ref to guard the `setState` calls inside `recheck`. |

The `mounted` ref pattern if needed:
```typescript
const mountedRef = useRef(true);
useEffect(() => {
  return () => { mountedRef.current = false; };
}, []);
// Inside recheck:
if (mountedRef.current) setIsRestricted(restricted);
```
This is optional. React 18 StrictMode does not cause issues here in a
production Expo build.

---

## Part 6 — Edge Cases

| Scenario | What happens |
|---|---|
| User grants Accessibility successfully | Parent renders `null` for this component (guard condition). Component unmounts. Self-dismissed. |
| User completes App Info unlock but does NOT enable Accessibility | `isRestrictedSettingsBlocked()` returns `false` on next AppState active. Component hides. User now sees normal Accessibility card. They can tap it to go enable it. |
| User taps "Try Accessibility Settings Again" without doing the App Info step | Settings open. Toggle is still greyed out. They return. `isRestricted` is still `true`. Panel is still showing. They see it again. No broken state. |
| User installs from Play Store (should never see this) | `isRestrictedSettingsBlocked()` returns `false`. Component returns `null`. Invisible. |
| Android 12 or older | Same as above — `isRestrictedSettingsBlocked()` returns `false` on old API. |
| `accessibilityAttempted` is `false` | Early return `null`. Component never renders even if restricted. |
| User leaves `helpChoice === 'yes'` expanded and grants from a different path | Parent guard unmounts the component. Clean. |
| User taps "Not now" | Header still shows. `showHelpLink` renders below. They can get back. |
| `recheck` fires mid-animation | State update is synchronous. `isRestricted` flips to `false`. Component unmounts on next render. No crash. |

---

## Part 7 — What NOT to Change

- `app/permissions.tsx` — leave entirely unchanged. The existing
  `<RestrictedSettingsBanner />` in that file stays exactly as-is.
  It is the correct UX for a user who has navigated to Settings → Permissions
  deliberately. They do not need a "do you want help?" gate — they already know.

- `src/components/RestrictedSettingsBanner.tsx` — do not modify or delete.
  It is still used by `permissions.tsx`.

- The `PERMISSIONS` array in `onboarding.tsx` — no changes.

- The `handleGrant` error handling (`catch` block that falls back to
  `Linking.openSettings()`) — no changes other than the one line added
  for accessibility in Edit C.

- The `checkAll` function and `AppState` listener already in `onboarding.tsx`
  — no changes. The component has its own separate `recheck` and `AppState`
  listener. They are independent.

- The `collapsedAction` block inside the accessibility card (the "Give access"
  button that shows when the card is not expanded) — leave unchanged. The user
  should still be able to tap it. It triggers `handleGrant`, which sets
  `accessibilityAttempted = true`, and the recovery panel appears below
  when they return.

---

## Part 8 — Answer to the Product Question

> Should this after-failure help flow appear in both Onboarding and
> Settings → Permissions, or only during first-run onboarding?

**Only onboarding. Leave permissions.tsx with the proactive banner.**

Reason: In onboarding the user is being guided step by step. They tap
"Open Accessibility Settings," return confused, and need a hand-holding
recovery flow with two buttons asking them what they want.

In Settings → Permissions the user navigated there intentionally. They
are already in a troubleshooting mindset. The proactive `RestrictedSettingsBanner`
(always visible at the top when restricted) is the correct pattern there —
it shows the information immediately without requiring an extra "do you
need help?" confirmation step.

If you later want the same interactive flow in permissions.tsx, make
`AccessibilityRestrictedRecovery` accept an optional `alwaysExpanded`
prop that skips the idle/yes/no gate and goes straight to the help content.
Don't implement this now.

---

## Part 9 — Verification Checklist (for when you do have a device)

These are the things to manually verify on an Android 13+ sideloaded build:

- [ ] Opening onboarding with restriction active: proactive banner is GONE
      from the top. The cards render normally.
- [ ] Tapping "Give access" on the Accessibility card opens Accessibility
      settings. Returning without enabling shows the recovery panel
      (both prompt buttons visible).
- [ ] Tapping "Not now" collapses the panel to header + link. Tapping
      the link brings back the prompt.
- [ ] Tapping "Yes, show me how" shows primary button + two step boxes +
      retry button. All visible without scrolling (test on small phones).
- [ ] Tapping "Open FocusFlow App Info" opens the App Info screen.
- [ ] Completing the App Info → ⋮ → Allow restricted settings flow and
      returning: panel self-dismisses. Accessibility card still shows.
- [ ] Tapping "Try Accessibility Settings Again" opens Accessibility
      settings with the toggle now active.
- [ ] Enabling FocusFlow in Accessibility settings and returning:
      recovery panel is gone. Accessibility card shows green "Ready" badge.
- [ ] Granting accessibility any other way (manually from Android settings):
      same result — panel gone on next AppState active.
- [ ] On Android 12 device or Play Store install: panel never appears at any point.
- [ ] Dark mode: all colours correct (no hardcoded light-only values).
- [ ] permissions.tsx: `RestrictedSettingsBanner` still shows at top of
      that screen unchanged.

---

## File Creation Summary

```
NEW:    src/components/AccessibilityRestrictedRecovery.tsx
EDIT:   app/onboarding.tsx  (4 surgical edits — Edits A, B, C, D)
TOUCH:  nothing else
```
