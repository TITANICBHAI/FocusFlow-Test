/**
 * app/_layout.tsx
 *
 * expo-router entry layout. Reproduces the module-level setup from App.tsx:
 *   1. Background task definitions
 *   2. Notification foreground handler
 *   3. EventBridge initialisation
 *   4. Splash screen keep-alive
 *   5. Notification response handler
 *   6. Notification action categories
 *   7. React component tree (providers + expo-router Stack)
 */

// ─── 0. Polyfills — must run before any library import ───────────────────────
import '@/polyfills';

// ─── 1. Register all background tasks with the OS ────────────────────────────
import '@/tasks/backgroundTasks';

import '@/i18n';

import React, { useEffect, useRef } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { StyleSheet, View, Text, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACING } from '@/styles/theme';

import { AppProvider, useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { EventBridge } from '@/services/eventBridge';
import { navigateToTask, consumePendingTaskNavigation } from '@/navigation/navigationRef';
import { registerBackgroundFetch, registerOverrunCheckTask } from '@/tasks/backgroundTasks';
import { BlockedAppOverlay } from '@/components/BlockedAppOverlay';
import { AchievementCelebrationModal } from '@/components/AchievementCelebrationModal';
import { VpnPermissionLostBanner } from '@/components/VpnPermissionLostBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorAlertBanner } from '@/components/ErrorAlertBanner';
import { logger } from '@/services/startupLogger';

// ─── Deferred notification action store ──────────────────────────────────────
// Stores action from background notification tap so the app can handle it on resume.
const pendingNotificationAction: { taskId: string | null; action: 'complete' | 'extend' | null } = {
  taskId: null,
  action: null,
};
export function consumePendingNotificationAction() {
  const snap = { ...pendingNotificationAction };
  pendingNotificationAction.taskId = null;
  pendingNotificationAction.action = null;
  return snap;
}

// ─── 2. Foreground notification display behaviour ─────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ─── 3. Connect native event channel ─────────────────────────────────────────
EventBridge.init();

// ─── 4. Keep splash visible until app context is ready ───────────────────────
SplashScreen.preventAutoHideAsync();

// ─── 5. Notification response handler (tap or action button) ─────────────────
Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data as {
    taskId?: string;
    type?: string;
  };
  const actionId = response.actionIdentifier;
  const taskId   = data?.taskId;

  // ── Standalone block expiry tap → open app ─────────────────────────────
  if (data?.type === 'standalone-expiry') {
    try { router.push('/(tabs)/focus'); } catch { /* headless */ }
    return;
  }

  // ── Morning digest tap → open Stats on the Yesterday tab ──────────────
  // The morning notification is a recap of yesterday, so landing on the
  // Yesterday tab of Stats gives the user the most useful first view.
  if (data?.type === 'morning-digest') {
    try { router.push('/(tabs)/stats'); } catch { /* headless */ }
    return;
  }

  if (!taskId) return;

  // ── Tap the notification body or explicit VIEW button ─────────────────
  if (
    actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
    actionId === 'VIEW'
  ) {
    navigateToTask(taskId);
    return;
  }

  // ── COMPLETE button: navigate to task list with highlight + action ─────
  // The Schedule screen reads `highlightTaskId`; adding `autoComplete=1`
  // lets it auto-open the completion sheet for that task.
  if (actionId === 'COMPLETE') {
    try {
      router.push({ pathname: '/(tabs)', params: { highlightTaskId: taskId, autoComplete: '1' } });
    } catch {
      pendingNotificationAction.taskId  = taskId;
      pendingNotificationAction.action  = 'complete';
    }
    return;
  }

  // ── EXTEND button: go directly to the Focus tab so the user can extend ─
  if (actionId === 'EXTEND') {
    try {
      router.push({ pathname: '/(tabs)/focus', params: { autoExtend: taskId } });
    } catch {
      pendingNotificationAction.taskId  = taskId;
      pendingNotificationAction.action  = 'extend';
    }
    return;
  }
});

// ─── 6. Foreground notification received listener ────────────────────────────
Notifications.addNotificationReceivedListener(async (notification) => {
  const data = notification.request.content.data as {
    taskId?: string;
    type?: string;
  };
  // LATE_START_WARNING: the Schedule screen's own polling already surfaces this.
  // persistent-dismiss: the native ForegroundTaskService owns its own lifecycle;
  // dismissPersistentNotification() is a no-op shim so nothing to do here.
  // All other received notifications are shown by the handler above.
  void data; // silence unused-variable warning
});

// ─── 7. Notification action categories ───────────────────────────────────────
async function setupNotificationCategories() {
  if (Platform.OS === 'web' || typeof Notifications.setNotificationCategoryAsync !== 'function') return;
  await Notifications.setNotificationCategoryAsync('task-active', [
    {
      identifier: 'COMPLETE',
      buttonTitle: '✅ Complete',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'EXTEND',
      buttonTitle: '⏱ +15 min',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'VIEW',
      buttonTitle: '👁 View',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('task-reminder', [
    {
      identifier: 'VIEW',
      buttonTitle: '👁 Open',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'COMPLETE',
      buttonTitle: '✅ Done',
      options: { opensAppToForeground: false },
    },
  ]);
}

// ─── Animated in-app splash overlay ──────────────────────────────────────────
// Shows a branded loading screen while the SQLite DB is initialising.
// Fades out the moment isDbReady becomes true so there is no blank flash.

function AppSplashOverlay() {
  const { state } = useApp();
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0.3)).current;
  const textTranslate = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = React.useState(true);

  // Entrance animation: logo springs in, then text fades up
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, [logoScale, logoOpacity, textOpacity, textTranslate]);

  // Pulsing logo animation while loading
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    const timeout = setTimeout(() => loop.start(), 500);
    return () => { clearTimeout(timeout); loop.stop(); };
  }, [pulse]);

  // Fade out when DB is ready
  useEffect(() => {
    if (state.isDbReady || !state.isLoading) {
      if (Platform.OS === 'web') {
        setVisible(false);
        return;
      }
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [state.isDbReady, state.isLoading, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[splashStyles.overlay, { opacity }]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale: Animated.multiply(logoScale, pulse) }], opacity: logoOpacity }}>
        <View style={splashStyles.logoCircle}>
          <Ionicons name="shield-checkmark" size={52} color="#fff" />
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslate }], alignItems: 'center', gap: 6 }}>
        <Text style={splashStyles.name}>FocusFlow</Text>
        <Text style={splashStyles.tagline}>Your discipline operating system</Text>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    zIndex: 999,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  name: {
    fontSize: FONT.xxl + 6,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FONT.sm,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
});

// ─── Themed status bar ───────────────────────────────────────────────────────
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

// ─── Onboarding guard ─────────────────────────────────────────────────────────
// Runs inside AppProvider so it has access to context.
// Once the DB is ready, redirects to /onboarding on first install.
// On every subsequent open onboardingComplete is true so nothing happens.

function OnboardingGuard() {
  const { state } = useApp();
  const pathname = usePathname();

  useEffect(() => {
    if (!state.isDbReady) return;
    if (!state.settings.privacyAccepted) {
      if (pathname !== '/privacy-policy') router.replace('/privacy-policy');
      return;
    }
    if (!state.settings.onboardingComplete) {
      // Allow both the permissions screen and the profile setup screen;
      // everything else redirects to the start of the onboarding flow.
      if (pathname !== '/onboarding' && pathname !== '/user-profile') {
        router.replace('/onboarding');
      }
    }
  }, [pathname, state.isDbReady, state.settings.onboardingComplete, state.settings.privacyAccepted]);

  return null;
}

// ─── Achievement celebration host ────────────────────────────────────────────
// Reads `pendingAchievementCelebration` from settings and shows the
// AchievementCelebrationModal once. On dismiss it clears the pending field
// AND bumps `lastShownStreakMilestone` so the same milestone never fires
// again (the next milestone the user crosses will fire the next celebration).

function AchievementCelebrationHost() {
  const { state, updateSettings } = useApp();
  const milestone = state.settings.pendingAchievementCelebration ?? null;

  const handleDismiss = () => {
    const next = {
      ...state.settings,
      pendingAchievementCelebration: undefined,
      lastShownStreakMilestone: Math.max(
        state.settings.lastShownStreakMilestone ?? 0,
        milestone ?? 0,
      ),
    };
    void updateSettings(next);
  };

  return <AchievementCelebrationModal milestone={milestone} onDismiss={handleDismiss} />;
}

// ─── VPN permission guard ─────────────────────────────────────────────────────
// Shows VpnPermissionLostBanner whenever VPN blocking is enabled but the
// Android system VPN permission has been silently revoked. Runs inside
// AppProvider so it can read settings without a separate context call.

function VpnPermissionHost() {
  const { state } = useApp();
  // Merge always-on and standalone VPN packages — mirrors what _syncSystemGuard does.
  // This is the exact package set the VPN tunnel should cover when restarted.
  const vpnPackages = Array.from(
    new Set([
      ...(state.settings.alwaysOnVpnPackages ?? []),
      ...(state.settings.standaloneVpnPackages ?? []),
    ]),
  );
  return (
    <VpnPermissionLostBanner
      vpnBlockEnabled={state.settings.vpnBlockEnabled ?? false}
      vpnPackages={vpnPackages}
    />
  );
}

// ─── React component ──────────────────────────────────────────────────────────

export default function RootLayout() {
  useEffect(() => {
    async function bootstrap() {
      void logger.info('RootLayout', 'bootstrap() start');
      try {
        await SplashScreen.hideAsync().catch(() => {});
        await setupNotificationCategories();
        await registerBackgroundFetch();
        await registerOverrunCheckTask();
        consumePendingTaskNavigation();
        void logger.info('RootLayout', 'bootstrap() setup complete');

        try {
          const { ForegroundServiceModule } = await import('@/native-modules/ForegroundServiceModule');
          await ForegroundServiceModule.requestBatteryOptimizationExemption();
          void logger.info('RootLayout', 'Battery optimization exemption requested');
        } catch {
          // Native module not yet linked (dev build without EAS)
          void logger.warn('RootLayout', 'Battery optimization exemption failed (native module unavailable)');
        }
      } catch (e) {
        void logger.error('RootLayout', `bootstrap() error: ${String(e)}`);
      } finally {
        setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 400);
        void logger.info('RootLayout', 'bootstrap() done');
      }
    }

    bootstrap();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary screenName="RootLayout">
          <AppProvider>
            <AppSplashOverlay />
            <OnboardingGuard />
            <BlockedAppOverlay />
            <AchievementCelebrationHost />
            <VpnPermissionHost />
            <ErrorAlertBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="privacy-policy" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
              <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
              <Stack.Screen name="permissions" options={{ headerShown: false }} />
              <Stack.Screen name="block-defense" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="keyword-blocker" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="home-launcher" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="how-to-use" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <ThemedStatusBar />
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
