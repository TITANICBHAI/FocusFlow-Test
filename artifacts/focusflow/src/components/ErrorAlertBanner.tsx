/**
 * ErrorAlertBanner.tsx
 *
 * Global error overlay that auto-appears the instant any component calls
 * logger.error() — database failures, SharedPrefs bridge errors, native
 * module misses, AppContext crashes, anything.
 *
 * Key design decisions:
 *  - Uses a React Native <Modal transparent> so it renders above EVERY
 *    screen in the navigator, including expo-router fullScreenModal routes
 *    (onboarding, privacy-policy, etc.). A plain absolute View cannot
 *    pierce a native modal presented by the OS.
 *  - The error listener fires even in release builds (see startupLogger.ts)
 *    so the banner is visible on physical devices without Metro.
 *  - console.error() is always called for ERROR-level entries, so adb
 *    logcat surfaces the error independently of the banner.
 *  - Multiple rapid errors accumulate the count; only the latest message
 *    is shown. The banner stays open until the user explicitly dismisses it.
 *
 * Place once inside <SafeAreaProvider> in _layout.tsx.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToErrors, type LogEntry } from '@/services/startupLogger';
import DiagnosticsModal from '@/components/DiagnosticsModal';

const SLIDE_DURATION = 260;

export function ErrorAlertBanner() {
  const insets = useSafeAreaInsets();

  const [bannerVisible, setBannerVisible] = useState(false);
  const [diagVisible, setDiagVisible]     = useState(false);
  const [errorCount, setErrorCount]       = useState(0);
  const [lastError, setLastError]         = useState<LogEntry | null>(null);

  const slideY   = useRef(new Animated.Value(120)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Slide banner up from bottom.
  const slideIn = useCallback(() => {
    Animated.timing(slideY, {
      toValue: 0,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [slideY]);

  // Slide banner back down then hide the Modal.
  const slideOut = useCallback((onDone?: () => void) => {
    Animated.timing(slideY, {
      toValue: 120,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (isMounted.current) setBannerVisible(false);
      onDone?.();
    });
  }, [slideY]);

  // Subscribe to startupLogger error events.
  useEffect(() => {
    const unsub = subscribeToErrors((entry) => {
      if (!isMounted.current) return;
      setLastError(entry);
      setErrorCount((n) => n + 1);
      // If the banner is already visible just bump the count;
      // no need to re-show. If hidden, open it.
      setBannerVisible((prev) => {
        if (!prev) {
          // Reset the slide position before showing.
          slideY.setValue(120);
        }
        return true;
      });
      // Slide in on next frame so the Modal has time to mount.
      requestAnimationFrame(() => slideIn());
    });
    return unsub;
  }, [slideIn, slideY]);

  const handleDismiss = useCallback(() => {
    setErrorCount(0);
    slideOut();
  }, [slideOut]);

  const handleViewLogs = useCallback(() => {
    slideOut(() => {
      if (isMounted.current) {
        setErrorCount(0);
        setDiagVisible(true);
      }
    });
  }, [slideOut]);

  const bottomOffset = insets.bottom + 16;

  return (
    <>
      {/*
       * Transparent Modal — this is the key that makes the banner appear above
       * EVERY route, including fullScreenModal routes (onboarding, etc.).
       * The Modal itself is invisible (transparent + no background); only the
       * animated banner View inside is rendered.
       *
       * `presentationStyle="overFullScreen"` on iOS ensures it sits above
       * other full-screen modals. On Android this is the default behaviour.
       */}
      <Modal
        visible={bannerVisible}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.banner,
              { bottom: bottomOffset, transform: [{ translateY: slideY }] },
            ]}
          >
            {/* Left: icon + message */}
            <View style={styles.left}>
              <View style={styles.iconCircle}>
                <Ionicons name="alert-circle" size={18} color="#fff" />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.title} numberOfLines={1}>
                  {errorCount > 1 ? `${errorCount} errors detected` : 'Error detected'}
                </Text>
                {lastError != null && (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    [{lastError.tag}] {lastError.message}
                  </Text>
                )}
              </View>
            </View>

            {/* Right: View Logs + Dismiss */}
            <View style={styles.actions}>
              <Pressable
                onPress={handleViewLogs}
                style={styles.viewBtn}
                accessibilityLabel="View diagnostic logs"
              >
                <Text style={styles.viewBtnText}>View Logs</Text>
              </Pressable>
              <Pressable
                onPress={handleDismiss}
                style={styles.closeBtn}
                accessibilityLabel="Dismiss error banner"
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Full diagnostics modal — opened from the banner. */}
      <DiagnosticsModal
        visible={diagVisible}
        onClose={() => setDiagVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Transparent full-screen container — lets touches pass through to app below.
  overlay: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1C1C2E',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.45)',
    ...Platform.select({
      ios: {
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
      },
      android: { elevation: 12 },
    }),
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 15,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  viewBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
