# Agent Task — Navigation Feedback + Double-Press Fix

## What this fixes

1. **Any button that opens a screen can be tapped multiple times** — each tap
   pushes the route again onto the stack, stacking duplicate screens.

2. **No feedback on press** — the user taps a nav button, nothing happens
   visually for 300–1200ms while JS/DB work loads, so they tap again.

3. **Sheets stutter on open** — `setVisible(true)` fires while the JS thread
   is busy, blocking the slide animation on the first frame.

4. **Active screen feels frozen** — DB queries + native bridge calls fire
   immediately on focus, blocking the navigation animation mid-transition.

The existing pattern the app already uses: `StandaloneBlockModal` shows
`saving && { opacity: 0.5 }` on its Save button and `disabled={saving}`.
The `SettingButton` in `defense.tsx` shows `disabled` on its Switch.
This task extends the same idea to navigation buttons.

---

## Step 1 — Create src/utils/nav.ts

New file. Does not touch any existing file.

```typescript
import { router } from 'expo-router';

const LOCK_MS = 800;
let _locked = false;

/**
 * Guarded router.push. Drops the call if navigation is already in flight.
 * Returns true if navigation fired, false if it was blocked (double-press).
 * Use this everywhere instead of router.push() for user-initiated navigation.
 *
 * _layout.tsx notification handlers are the only exception — they call
 * router.push directly because there is no button to show feedback on,
 * but they should still be switched to navPush() to block duplicates.
 */
export function navPush(href: string | object): boolean {
  if (_locked) return false;
  _locked = true;
  router.push(href as never);
  setTimeout(() => { _locked = false; }, LOCK_MS);
  return true;
}
```

---

## Step 2 — Create src/hooks/useNavPress.ts

New file. Used by any component that has a button navigating to a screen.

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { navPush } from '@/utils/nav';

/**
 * Drop-in for navigation onPress handlers.
 * Returns { onPress, loading } where loading is true from the moment
 * the button is pressed until the screen mounts (component unmounts)
 * or 1 second passes (fallback if navigation was blocked or slow).
 *
 * Usage:
 *   const { onPress, loading } = useNavPress('/always-on');
 *   <SettingButton onPress={onPress} loading={loading} ... />
 */
export function useNavPress(href: string | object) {
  const [loading, setLoading] = useState(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPress = useCallback(() => {
    if (loading) return;
    setLoading(true);
    // requestAnimationFrame yields one frame so the loading state
    // renders before navigation work starts — user sees feedback instantly.
    requestAnimationFrame(() => {
      const fired = navPush(href);
      if (!fired) {
        // Double-press was blocked — clear loading immediately
        setLoading(false);
        return;
      }
    });
    // Fallback: clear if component doesn't unmount within 1s
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = setTimeout(() => setLoading(false), 1000);
  }, [href, loading]);

  // Clear on unmount
  useEffect(() => () => {
    if (fallback.current) clearTimeout(fallback.current);
  }, []);

  return { onPress, loading };
}
```

---

## Step 3 — Update SettingButton in defense.tsx

`SettingButton` is the shared navigation row used for always-on, keyword-blocker,
vpn-block-list, password-protection, and how-to-use. Add a `loading` prop and
swap the chevron for a spinner when loading.

Find:
```typescript
function SettingButton({
  icon,
  label,
  description,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <TouchableOpacity
      style={[styles.button, { borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.muted} />
    </TouchableOpacity>
  );
}
```

Replace with:
```typescript
function SettingButton({
  icon,
  label,
  description,
  onPress,
  loading = false,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  loading?: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <TouchableOpacity
      style={[styles.button, { borderBottomColor: theme.border }, loading && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={theme.muted} />
        : <Ionicons name="chevron-forward" size={17} color={theme.muted} />
      }
    </TouchableOpacity>
  );
}
```

Add `ActivityIndicator` to the import at the top of `defense.tsx` if it isn't there.

---

## Step 4 — Update every SettingButton call site in defense.tsx

Each of these currently passes an inline `router.push`. Replace with `useNavPress`.

Add these hooks near the top of the `DefenseScreen` component (after existing useState declarations):

```typescript
const navAlwaysOn    = useNavPress('/always-on');
const navKeyword     = useNavPress('/keyword-blocker');
const navVpn         = useNavPress('/vpn-block-list');
const navPassword    = useNavPress('/password-protection');
const navHowToUse    = useNavPress('/how-to-use');
const navLauncher    = useNavPress('/home-launcher');
```

Add the import at the top:
```typescript
import { useNavPress } from '@/hooks/useNavPress';
```

Then update each `SettingButton` call:

```typescript
// how-to-use (line 244):
<SettingButton
  icon="help-circle-outline"
  label="How to use"
  description="..."
  onPress={navHowToUse.onPress}
  loading={navHowToUse.loading}
  theme={theme}
/>

// always-on (line 311):
<SettingButton
  icon="shield-outline"
  label="Always-on blocking"
  description="..."
  onPress={navAlwaysOn.onPress}
  loading={navAlwaysOn.loading}
  theme={theme}
/>

// keyword-blocker (line 332):
<SettingButton
  icon="text-outline"
  label="Keyword blocker"
  description="..."
  onPress={navKeyword.onPress}
  loading={navKeyword.loading}
  theme={theme}
/>

// vpn-block-list (line 354):
<SettingButton
  icon="globe-outline"
  label="VPN block list"
  description="..."
  onPress={navVpn.onPress}
  loading={navVpn.loading}
  theme={theme}
/>

// password-protection (line 365):
<SettingButton
  icon="lock-closed-outline"
  label="Password protection"
  description="..."
  onPress={navPassword.onPress}
  loading={navPassword.loading}
  theme={theme}
/>
```

For line 524 (home-launcher push inside async logic):
```typescript
// old:
router.push('/home-launcher');
// new:
navLauncher.onPress();
```

---

## Step 5 — Update ActiveHeaderButton.tsx

Show a small spinner replacing the pulse icon while navigating.

Replace the full component:
```typescript
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/context/AppContext';
import { useNavPress } from '@/hooks/useNavPress';

export function ActiveHeaderButton() {
  const { theme } = useTheme();
  const { state } = useApp();
  const { onPress, loading } = useNavPress('/active');
  const pulse = useRef(new Animated.Value(1)).current;

  const hasActiveProtection =
    state.focusSession?.isActive === true ||
    Boolean(
      state.settings.standaloneBlockUntil &&
        (state.settings.standaloneBlockPackages ?? []).length > 0 &&
        new Date(state.settings.standaloneBlockUntil).getTime() > Date.now(),
    ) ||
    (state.settings.alwaysOnEnforcementEnabled ?? false) ||
    (state.settings.blockedWords ?? []).length > 0 ||
    (state.settings.greyoutSchedule ?? []).length > 0 ||
    (state.settings.vpnBlockEnabled ?? false);

  useEffect(() => {
    if (!hasActiveProtection || loading) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [hasActiveProtection, loading, pulse]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Open Active blocks"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ padding: 4 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={hasActiveProtection ? '#2BAE66' : theme.text} />
      ) : (
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Ionicons
            name={hasActiveProtection ? 'pulse' : 'pulse-outline'}
            size={22}
            color={hasActiveProtection ? '#2BAE66' : theme.text}
          />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}
```

---

## Step 6 — Update remaining bare router.push calls

For every remaining `router.push` in screens — use `useNavPress` for button presses,
use `navPush` directly for calls inside async logic or conditional branches.

### block-defense.tsx

Add imports:
```typescript
import { navPush } from '@/utils/nav';
import { useNavPress } from '@/hooks/useNavPress';
```

Add hooks inside the component:
```typescript
const navActive       = useNavPress('/active');
const navPassword     = useNavPress('/password-protection');
const navAlwaysOn     = useNavPress('/always-on');
const navVpnList      = useNavPress('/vpn-block-list');
const navHomeLauncher = useNavPress('/home-launcher');
```

Line 136 (inside async logic — no button to show loading on):
```typescript
// old: router.push('/vpn-block-list');
navPush('/vpn-block-list');
```

Line 396 (button):
```typescript
onPress={navActive.onPress}
// add: disabled={navActive.loading} and opacity when loading
```

Line 428 (button):
```typescript
onPress={navPassword.onPress}
```

Line 659 (TouchableOpacity with cardButton style):
```typescript
onPress={navAlwaysOn.onPress}
disabled={navAlwaysOn.loading}
style={[styles.cardButton, navAlwaysOn.loading && { opacity: 0.6 }]}
```

Line 709:
```typescript
onPress={navVpnList.onPress}
disabled={navVpnList.loading}
style={[styles.cardButton, navVpnList.loading && { opacity: 0.6 }]}
```

Line 777 (inside async logic):
```typescript
// old: router.push('/home-launcher');
navPush('/home-launcher');
```

### active.tsx

Add imports:
```typescript
import { useNavPress } from '@/hooks/useNavPress';
```

Add hooks inside `ActiveScreen`:
```typescript
const navFocus   = useNavPress('/(tabs)/focus');
const navAlwaysOn = useNavPress('/always-on');
const navDefense  = useNavPress('/(tabs)/defense');
const navKeyword  = useNavPress('/keyword-blocker');
const navVpn      = useNavPress('/vpn-block-list');
```

Lines 310, 325, 339, 348, 383, 425 — update each `TouchableOpacity`:
```typescript
// Line 310 example:
<TouchableOpacity
  style={[styles.action, { borderColor: theme.border }, navFocus.loading && { opacity: 0.6 }]}
  onPress={navFocus.onPress}
  disabled={navFocus.loading}
>
// ... existing children stay the same ...
</TouchableOpacity>
```

Apply the same `loading && { opacity: 0.6 }` + `disabled={x.loading}` pattern
to lines 325, 339, 348, 383, 425 with their respective hook.

### settings.tsx

```typescript
const navProfile     = useNavPress('/user-profile');
const navPermissions = useNavPress('/permissions');
const navStats       = useNavPress('/(tabs)/stats');
const navChangelog   = useNavPress('/changelog');
const navPrivacy     = useNavPress('/privacy-policy');
```

Update each of the 5 button presses (lines 233, 369, 401, 407, 415) to use
the respective hook. Apply `disabled={x.loading}` and `opacity: 0.6` when loading.

### vpn-block-list.tsx

```typescript
const navBlockDefense = useNavPress('/block-defense?tab=system');
// line 265:
onPress={navBlockDefense.onPress}
disabled={navBlockDefense.loading}
```

### permissions.tsx

```typescript
const navLauncher = useNavPress('/home-launcher');
// line 561:
onPress={navLauncher.onPress}
disabled={navLauncher.loading}
```

### focus.tsx

```typescript
const navHome = useNavPress('/');
// lines 319 and 409 both go to '/':
onPress={navHome.onPress}
disabled={navHome.loading}
```

### _layout.tsx (notification handlers — no button, just block double-nav)

```typescript
import { navPush } from '@/utils/nav';

// line 85:
try { navPush('/(tabs)/focus'); } catch { /* headless */ }

// line 93:
try { navPush('/(tabs)/stats'); } catch { /* headless */ }

// line 113:
navPush({ pathname: '/(tabs)', params: { highlightTaskId: taskId, autoComplete: '1' } });

// line 124:
navPush({ pathname: '/(tabs)/focus', params: { autoExtend: taskId } });
```

---

## Step 7 — Defer active screen data load

**File:** `app/active.tsx`

The `useFocusEffect` refresh fires immediately on focus, running three DB queries
and two native bridge calls during the navigation animation. Wrap it with
`InteractionManager` the same way `getInstalledApps` is already handled.

Find the `useFocusEffect` block:
```typescript
useFocusEffect(
  useCallback(() => {
    let mounted = true;
    const refresh = (force = false) => {
      if (!state.isDbReady || state.isDbUnrecoverable) return;
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      void (async () => {
        // ... queries ...
      })();
    };
    refresh(true);
    const timer = setInterval(refresh, 5_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refreshLiveData, state.isDbReady, state.isDbUnrecoverable]),
);
```

Replace:
```typescript
useFocusEffect(
  useCallback(() => {
    let mounted = true;
    const refresh = (force = false) => {
      if (!state.isDbReady || state.isDbUnrecoverable) return;
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      void (async () => {
        // ... exact same query logic, unchanged ...
      })();
    };

    // Defer the first load until the navigation animation completes.
    // The screen renders immediately with AppContext state (which is current).
    // Stats at the bottom populate ~200ms later — same as getInstalledApps.
    const task = InteractionManager.runAfterInteractions(() => {
      if (mounted) refresh(true);
    });
    const timer = setInterval(refresh, 5_000);

    return () => {
      mounted = false;
      task.cancel();
      clearInterval(timer);
    };
  }, [refreshLiveData, state.isDbReady, state.isDbUnrecoverable]),
);
```

`InteractionManager` is already imported in `active.tsx` — no new imports needed.

---

## Step 8 — Defer sheet open by one frame

For every `onPress` that calls `setXxxVisible(true)` to open a modal or sheet,
add `requestAnimationFrame` so the press animation completes before the
sheet's slide animation starts. This stops the stutter on the first frame.

Files and locations:

**focus.tsx:**
```typescript
// line 252 and 327 and 494:
// old: onPress={() => setBlockModalVisible(true)}
onPress={() => requestAnimationFrame(() => setBlockModalVisible(true))}
```

**defense.tsx:**
```typescript
// daily allowance (line 322):
onPress={() => requestAnimationFrame(() => setDailyAllowanceVisible(true))}

// greyout schedule (line 341):
onPress={() => requestAnimationFrame(() => setGreyoutScheduleVisible(true))}
```

Apply the same `requestAnimationFrame` wrapper to any other `onPress` that
opens a modal with `animationType="slide"` or `presentationStyle="pageSheet"`.

---

## What not to change

- `_layout.tsx` bootstrap logic that calls `router.push` outside of `useEffect`
  or inside early-return paths — these are not user button presses.
- Any `onPress` that calls an async action (like `stopFocusMode()`) rather than
  navigating — those have their own loading patterns already.
- `QuickBlockSheet` action buttons (they're inside an already-open modal).
- The `StandaloneBlockModal` save button — already uses `saving` state correctly.

---

## Verification

- [ ] Tap `ActiveHeaderButton` rapidly 5 times — only one `/active` push happens,
      spinner shows on first tap, subsequent taps do nothing.
- [ ] Tap any `SettingButton` in defense — chevron becomes spinner immediately,
      button is disabled, screen opens, chevron returns if you navigate back.
- [ ] Open `active.tsx` — screen appears instantly, stats section populates
      shortly after (no frozen frame during navigation animation).
- [ ] Open `StandaloneBlockModal` — sheet slides up smoothly with no stutter
      on the first frame.
- [ ] Tap a notification while the app is open — navigates once, not multiple times.
