import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UsageStatsModule } from '@/native-modules/UsageStatsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  accessibilityAttempted: boolean;
};

type HelpChoice = 'idle' | 'yes' | 'no';

export function AccessibilityRestrictedRecovery({ accessibilityAttempted }: Props) {
  const { theme } = useTheme();
  const [isRestricted, setIsRestricted] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [helpChoice, setHelpChoice] = useState<HelpChoice>('idle');
  const [openingSettings, setOpeningSettings] = useState(false);
  const [returnedFromAttempt, setReturnedFromAttempt] = useState(false);
  const wasRestrictedRef = useRef(false);
  const leftAppAfterAttemptRef = useRef(false);
  const accessibilityAttemptedRef = useRef(accessibilityAttempted);
  const retryResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    accessibilityAttemptedRef.current = accessibilityAttempted;
  }, [accessibilityAttempted]);

  const recheck = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setIsRestricted(false);
      setJustUnlocked(false);
      return;
    }

    try {
      const restricted = await UsageStatsModule.isRestrictedSettingsBlocked();
      const restrictionWasCleared = wasRestrictedRef.current && !restricted;

      wasRestrictedRef.current = restricted;
      setIsRestricted(restricted);

      if (restricted) {
        setJustUnlocked(false);
      } else if (restrictionWasCleared) {
        // Android unlocks the AppOp before the user enables Accessibility.
        // Keep the retry action visible instead of dismissing the panel.
        setJustUnlocked(true);
        setHelpChoice('yes');
      }
    } catch {
      // A failed detection must not create a false alarm in onboarding.
      wasRestrictedRef.current = false;
      setIsRestricted(false);
      setJustUnlocked(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        accessibilityAttemptedRef.current &&
        (nextState === 'inactive' || nextState === 'background')
      ) {
        leftAppAfterAttemptRef.current = true;
      }
      if (nextState === 'active' && leftAppAfterAttemptRef.current) {
        setReturnedFromAttempt(true);
        void recheck();
      }
    });
    return () => sub.remove();
  }, [recheck]);

  useEffect(() => {
    return () => {
      if (retryResetTimerRef.current) {
        clearTimeout(retryResetTimerRef.current);
      }
    };
  }, []);

  const openAppInfo = async () => {
    try {
      await UsageStatsModule.openAppInfoSettings();
    } catch {
      // The native module normally handles its own context fallback. This
      // only covers a rejected bridge call.
      try {
        await Linking.openSettings();
      } catch {
        // No further settings fallback is available.
      }
    }
  };

  const handleTryAgain = async () => {
    setOpeningSettings(true);
    try {
      await UsageStatsModule.openAccessibilitySettings();
    } catch {
      // The native module normally handles its own context fallback. These
      // Linking calls cover a rejected bridge call only.
      try {
        await Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS');
      } catch {
        try {
          await Linking.openSettings();
        } catch {
          // No further settings fallback is available.
        }
      }
    } finally {
      retryResetTimerRef.current = setTimeout(() => setOpeningSettings(false), 800);
    }
  };

  if (
    Platform.OS !== 'android' ||
    !accessibilityAttempted ||
    !returnedFromAttempt ||
    (!isRestricted && !justUnlocked)
  ) {
    return null;
  }

  const unlocked = justUnlocked && !isRestricted;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: COLORS.primary + '55',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconRing}>
          <Ionicons
            name={unlocked ? 'checkmark-circle' : 'lock-closed'}
            size={18}
            color={unlocked ? COLORS.green : COLORS.primary}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>
            {unlocked ? 'Restricted settings unlocked' : 'Accessibility is still blocked'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {unlocked
              ? 'Android has unlocked the permission. Enable FocusFlow in Accessibility settings to finish.'
              : 'Android is blocking this permission because FocusFlow was installed outside a trusted app store.'}
          </Text>
        </View>
      </View>

      {helpChoice === 'idle' && (
        <>
          <Text style={[styles.idleQuestion, { color: theme.textSecondary }]}>
            Do you need help enabling it?
          </Text>
          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={styles.yesBtn}
              onPress={() => setHelpChoice('yes')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Yes, show me how"
              testID="restricted-recovery-yes"
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={styles.yesBtnText}>Yes, show me how</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noBtn, { borderColor: theme.border }]}
              onPress={() => setHelpChoice('no')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              testID="restricted-recovery-not-now"
            >
              <Text style={[styles.noBtnText, { color: theme.muted }]}>Not now</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {helpChoice === 'no' && (
        <TouchableOpacity
          style={styles.showHelpLink}
          onPress={() => setHelpChoice('idle')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Need help enabling it? Tap to see the fix."
          testID="restricted-recovery-show-help"
        >
          <Text style={styles.showHelpLinkText}>
            Need help enabling it? Tap to see the fix.
          </Text>
        </TouchableOpacity>
      )}

      {helpChoice === 'yes' && (
        <View style={styles.helpBody}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>QUICK FIX</Text>

          {!unlocked && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void openAppInfo()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open FocusFlow App Info"
              testID="restricted-recovery-open-app-info"
            >
              <Ionicons name="information-circle-outline" size={17} color="#fff" />
              <Text style={styles.primaryBtnText}>Open FocusFlow App Info</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.stepsBox, { backgroundColor: theme.surface }]}>
            <Text style={[styles.stepsBoxHeader, { color: theme.text }]}>
              {unlocked ? 'Now finish enabling Accessibility:' : 'Then follow these steps:'}
            </Text>
            {!unlocked && (
              <>
                <Step n={1} text="Tap the ⋮ menu icon in the top-right corner of the App Info screen." theme={theme} />
                <Step n={2} text={'Tap "Allow restricted settings".'} theme={theme} />
                <Step n={3} text="Return to FocusFlow." theme={theme} />
              </>
            )}
            <Step n={unlocked ? 1 : 4} text={'Tap "Try Accessibility Settings Again" below.'} theme={theme} />
            <Step n={unlocked ? 2 : 5} text="Enable FocusFlow in the Accessibility settings that open." theme={theme} />
          </View>

          {!unlocked && (
            <View
              style={[
                styles.fallbackBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.fallbackBoxHeader, { color: theme.textSecondary }]}>
                Can&apos;t find the option? Try this path instead:
              </Text>
              <Step n={1} text="Open Android Settings." theme={theme} light />
              <Step n={2} text={'Go to Apps (some phones call it "App Management").'} theme={theme} light />
              <Step n={3} text="Find and tap FocusFlow." theme={theme} light />
              <Step n={4} text="Tap the ⋮ menu icon in the top-right corner." theme={theme} light />
              <Step n={5} text={'Tap "Allow restricted settings".'} theme={theme} light />
              <Step n={6} text={'Return to FocusFlow and tap "Try Accessibility Settings Again" below.'} theme={theme} light />
            </View>
          )}

          <TouchableOpacity
            style={styles.tryAgainBtn}
            onPress={() => void handleTryAgain()}
            disabled={openingSettings}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Try Accessibility Settings Again"
            testID="restricted-recovery-try-again"
          >
            {openingSettings ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={15} color={COLORS.primary} />
            )}
            <Text style={styles.tryAgainBtnText}>Try Accessibility Settings Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: FONT.sm,
    fontWeight: '800',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: FONT.xs,
    lineHeight: 17,
  },
  idleQuestion: {
    fontSize: FONT.xs,
    fontWeight: '600',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  yesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
  },
  yesBtnText: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: '#fff',
  },
  noBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
  },
  noBtnText: {
    fontSize: FONT.xs,
    fontWeight: '600',
  },
  showHelpLink: {
    paddingVertical: 4,
  },
  showHelpLinkText: {
    fontSize: FONT.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  helpBody: {
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: {
    fontSize: FONT.sm,
    fontWeight: '800',
    color: '#fff',
  },
  stepsBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 6,
  },
  stepsBoxHeader: {
    fontSize: FONT.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  fallbackBox: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.sm,
    gap: 6,
  },
  fallbackBoxHeader: {
    fontSize: FONT.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumLight: {
    backgroundColor: COLORS.primary + '55',
  },
  stepNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 17,
  },
  tryAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  tryAgainBtnText: {
    fontSize: FONT.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
});