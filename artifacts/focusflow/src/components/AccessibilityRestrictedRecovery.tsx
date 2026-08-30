import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { UsageStatsModule } from "@/native-modules/UsageStatsModule";
import { COLORS, FONT, RADIUS, SPACING } from "@/styles/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  accessibilityAttempted: boolean;
};

type RecoveryStage =
  | "question"
  | "greyed-entry"
  | "app-info"
  | "checking"
  | "enable"
  | "skipped";

type PendingSettings =
  | "initial"
  | "greyed-entry"
  | "app-info"
  | "fallback"
  | "retry"
  | null;

export function AccessibilityRestrictedRecovery({
  accessibilityAttempted,
}: Props) {
  const { theme } = useTheme();
  const [stage, setStage] = useState<RecoveryStage>("question");
  const [returnedFromAttempt, setReturnedFromAttempt] = useState(false);
  const [returnedFromGreyedEntry, setReturnedFromGreyedEntry] = useState(false);
  const [returnedFromFallback, setReturnedFromFallback] = useState(false);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [hasCheckedRestrictedSettings, setHasCheckedRestrictedSettings] =
    useState(false);
  const [openingSettings, setOpeningSettings] = useState(false);
  const [checkingSettings, setCheckingSettings] = useState(false);
  const [completed, setCompleted] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const leftAppAfterAttemptRef = useRef(false);
  const accessibilityAttemptedRef = useRef(accessibilityAttempted);
  const pendingSettingsRef = useRef<PendingSettings>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    accessibilityAttemptedRef.current = accessibilityAttempted;
  }, [accessibilityAttempted]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        accessibilityAttemptedRef.current &&
        (nextState === "inactive" || nextState === "background")
      ) {
        leftAppAfterAttemptRef.current = true;
      }

      if (
        nextState === "active" &&
        appStateRef.current !== "active" &&
        leftAppAfterAttemptRef.current
      ) {
        leftAppAfterAttemptRef.current = false;
        setReturnedFromAttempt(true);

        const pending = pendingSettingsRef.current;
        pendingSettingsRef.current = null;

        if (pending === "greyed-entry") {
          setReturnedFromGreyedEntry(true);
        } else if (pending === "fallback") {
          setReturnedFromFallback(true);
        } else if (pending === "retry") {
          void finishAccessibilityRetry();
        } else if (stage === "question" || pending === "initial") {
          // The first trip to Accessibility is launched by the parent card,
          // so it has no pending action registered in this component.
          setStage("question");
        }
      }

      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, [stage]);

  if (
    Platform.OS !== "android" ||
    !accessibilityAttempted ||
    !returnedFromAttempt ||
    completed ||
    stage === "skipped"
  ) {
    return null;
  }

  const openAccessibilitySettings = async (
    pending: Exclude<PendingSettings, null>,
  ) => {
    pendingSettingsRef.current = pending;
    setOpeningSettings(true);
    try {
      await UsageStatsModule.openAccessibilitySettings();
    } catch {
      try {
        await Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS");
      } catch {
        try {
          await Linking.openSettings();
        } catch {
          // The native method already has its own fallback chain.
        }
      }
    } finally {
      setOpeningSettings(false);
    }
  };

  const openAppInfo = async () => {
    pendingSettingsRef.current = "app-info";
    setOpeningSettings(true);
    try {
      await UsageStatsModule.openAppInfoSettings();
    } catch {
      try {
        await Linking.openSettings();
      } catch {
        // The native method already has its own fallback chain.
      }
    } finally {
      setOpeningSettings(false);
    }
  };

  const checkRestrictedSettings = async (): Promise<boolean> => {
    try {
      const restricted = await UsageStatsModule.isRestrictedSettingsBlocked();
      setIsRestricted(restricted);
      setHasCheckedRestrictedSettings(true);
      return restricted;
    } catch {
      // A failed detector must not trap the user in a false recovery state.
      setIsRestricted(false);
      setHasCheckedRestrictedSettings(true);
      return false;
    }
  };

  const continueFromAppInfo = async () => {
    setCheckingSettings(true);
    setStage("checking");
    try {
      const restricted = await checkRestrictedSettings();
      if (dismissedRef.current) return;
      setStage(restricted ? "app-info" : "enable");
      setReturnedFromFallback(false);
    } finally {
      setCheckingSettings(false);
    }
  };

  async function finishAccessibilityRetry() {
    setCheckingSettings(true);
    setStage("checking");
    try {
      const granted = await UsageStatsModule.hasAccessibilityPermission();
      if (dismissedRef.current) return;
      if (granted) {
        setCompleted(true);
        return;
      }

      const restricted = await checkRestrictedSettings();
      if (dismissedRef.current) return;
      setStage(restricted ? "app-info" : "enable");
    } finally {
      setCheckingSettings(false);
    }
  }

  const dismissRecovery = () => {
    dismissedRef.current = true;
    pendingSettingsRef.current = null;
    setStage("skipped");
  };

  const stageNumber =
    stage === "question"
      ? 1
      : stage === "greyed-entry"
        ? 2
        : stage === "app-info" || stage === "checking"
          ? 3
          : 4;
  const progressPercent = stage === "checking" ? 82 : stageNumber * 25;

  const renderStep = (number: number, text: string, light = false) => (
    <View style={styles.stepRow} key={`${number}-${text}`}>
      <View style={[styles.stepNumber, light && styles.stepNumberLight]}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={[styles.stepText, { color: theme.textSecondary }]}>
        {text}
      </Text>
    </View>
  );

  const renderSettingsButton = (
    label: string,
    pending: Exclude<PendingSettings, null>,
    testID: string,
  ) => (
    <TouchableOpacity
      style={styles.primaryButton}
      onPress={() => void openAccessibilitySettings(pending)}
      disabled={openingSettings}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {openingSettings ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="open-outline" size={17} color="#fff" />
      )}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderQuestion = () => (
    <>
      <Text style={[styles.question, { color: theme.textSecondary }]}>
        Did you tap the greyed-out FocusFlow entry? Android may need this step
        before restricted settings can be allowed.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setStage("app-info")}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Yes, I tapped the greyed-out FocusFlow entry"
        testID="restricted-recovery-greyed-yes"
      >
        <Ionicons name="checkmark" size={17} color="#fff" />
        <Text style={styles.primaryButtonText}>Yes, I tapped it</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: theme.border }]}
        onPress={() => {
          setReturnedFromGreyedEntry(false);
          setStage("greyed-entry");
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="No, I have not tapped the greyed-out FocusFlow entry"
        testID="restricted-recovery-greyed-no"
      >
        <Ionicons
          name="arrow-forward-circle-outline"
          size={17}
          color={COLORS.primary}
        />
        <Text style={styles.secondaryButtonText}>No, I haven’t tapped it</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => setStage("skipped")}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Skip Accessibility setup"
        testID="restricted-recovery-skip"
      >
        <Text style={[styles.skipButtonText, { color: theme.muted }]}>
          Skip Accessibility
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderGreyedEntry = () => (
    <>
      <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
        Some phones keep FocusFlow greyed out until you open its entry once in
        Accessibility settings.
      </Text>
      <View style={[styles.stepsBox, { backgroundColor: theme.surface }]}>
        {renderStep(1, "Open Accessibility settings below.")}
        {renderStep(2, "Tap the greyed-out FocusFlow entry.")}
        {renderStep(3, "Read Android’s explanation, then return to FocusFlow.")}
      </View>
      {!returnedFromGreyedEntry ? (
        renderSettingsButton(
          "Open Accessibility Settings",
          "greyed-entry",
          "restricted-recovery-open-accessibility",
        )
      ) : (
        <>
          <View
            style={[
              styles.returnedBox,
              { backgroundColor: COLORS.green + "14" },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={17}
              color={COLORS.green}
            />
            <Text style={[styles.returnedText, { color: COLORS.green }]}>
              Welcome back. Continue when you have tapped the greyed-out
              FocusFlow entry.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setStage("app-info")}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue to App Info instructions"
            testID="restricted-recovery-greyed-done"
          >
            <Ionicons name="arrow-forward" size={17} color="#fff" />
            <Text style={styles.primaryButtonText}>I’m done — continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void openAccessibilitySettings("greyed-entry")}
            disabled={openingSettings}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open Accessibility Settings again"
            testID="restricted-recovery-greyed-retry"
          >
            <Text style={styles.secondaryButtonText}>Open settings again</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  const renderFallback = () => (
    <View
      style={[
        styles.fallbackBox,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <TouchableOpacity
        style={styles.fallbackHeader}
        onPress={() => setFallbackExpanded((expanded) => !expanded)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: fallbackExpanded }}
        accessibilityLabel="Show the greyed-out entry instructions again"
        testID="restricted-recovery-greyed-fallback-toggle"
      >
        <View style={styles.fallbackHeaderText}>
          <Text style={[styles.fallbackTitle, { color: theme.text }]}>
            Didn’t actually tap the greyed-out entry?
          </Text>
          <Text
            style={[styles.fallbackSubtitle, { color: theme.textSecondary }]}
          >
            Expand this if you selected Yes by mistake.
          </Text>
        </View>
        <Ionicons
          name={fallbackExpanded ? "chevron-up" : "chevron-down"}
          size={17}
          color={theme.muted}
        />
      </TouchableOpacity>

      {fallbackExpanded && (
        <View style={styles.fallbackBody}>
          {renderStep(1, "Open Accessibility settings below.", true)}
          {renderStep(2, "Tap the greyed-out FocusFlow entry.", true)}
          {renderStep(
            3,
            "Return here and check the restricted setting again.",
            true,
          )}
          {!returnedFromFallback ? (
            renderSettingsButton(
              "Open Accessibility Settings",
              "fallback",
              "restricted-recovery-fallback-open-accessibility",
            )
          ) : (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void continueFromAppInfo()}
              disabled={checkingSettings}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Check restricted settings again"
              testID="restricted-recovery-fallback-done"
            >
              {checkingSettings ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={17}
                  color={COLORS.primary}
                />
              )}
              <Text style={styles.secondaryButtonText}>
                I tapped it — check again
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderAppInfo = () => (
    <>
      <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
        Now allow restricted settings from FocusFlow’s App Info screen. The
        three-dot option may only appear after the greyed-out Accessibility
        entry has been opened.
      </Text>
      {hasCheckedRestrictedSettings && isRestricted && (
        <View
          style={[styles.warningBox, { backgroundColor: COLORS.orange + "18" }]}
        >
          <Ionicons name="warning-outline" size={17} color={COLORS.orange} />
          <Text style={[styles.warningText, { color: COLORS.orange }]}>
            Restricted settings are still blocked. Finish the steps below, then
            check again.
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => void openAppInfo()}
        disabled={openingSettings}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open FocusFlow App Info"
        testID="restricted-recovery-open-app-info"
      >
        {openingSettings ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="information-circle-outline" size={17} color="#fff" />
        )}
        <Text style={styles.primaryButtonText}>Open FocusFlow App Info</Text>
      </TouchableOpacity>
      <View style={[styles.stepsBox, { backgroundColor: theme.surface }]}>
        {renderStep(1, "In App Info, tap the ⋮ menu in the top-right corner.")}
        {renderStep(2, "Tap “Allow restricted settings”.")}
        {renderStep(3, "Return to FocusFlow and tap the check button below.")}
      </View>
      {renderFallback()}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => void continueFromAppInfo()}
        disabled={checkingSettings}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Check restricted settings"
        testID="restricted-recovery-check-settings"
      >
        {checkingSettings ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons
            name="checkmark-circle-outline"
            size={17}
            color={COLORS.primary}
          />
        )}
        <Text style={styles.secondaryButtonText}>
          I’m done — check settings
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderEnable = () => (
    <>
      <View
        style={[styles.returnedBox, { backgroundColor: COLORS.green + "14" }]}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={18}
          color={COLORS.green}
        />
        <Text style={[styles.returnedText, { color: COLORS.green }]}>
          Restricted settings are ready.
        </Text>
      </View>
      <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
        One last step: return to Accessibility settings and enable FocusFlow.
      </Text>
      {renderStep(1, "Open Accessibility settings below.")}
      {renderStep(2, "Tap FocusFlow and turn on the Accessibility service.")}
      {renderSettingsButton(
        "Open Accessibility Settings",
        "retry",
        "restricted-recovery-try-again",
      )}
    </>
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismissRecovery}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.card,
              borderColor:
                stage === "enable"
                  ? COLORS.green + "66"
                  : COLORS.primary + "55",
            },
          ]}
          accessibilityViewIsModal
        >
          <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: COLORS.primary }]}>
                  ACCESSIBILITY RECOVERY
                </Text>
                <Text style={[styles.progressCount, { color: theme.muted }]}>
                  Step {stageNumber} of 4
                </Text>
              </View>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor:
                        stage === "enable" ? COLORS.green : COLORS.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.iconRing,
                    {
                      backgroundColor:
                        stage === "enable"
                          ? COLORS.green + "18"
                          : COLORS.primary + "18",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      stage === "enable" ? "checkmark-circle" : "lock-closed"
                    }
                    size={26}
                    color={stage === "enable" ? COLORS.green : COLORS.primary}
                  />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: theme.text }]}>
                    {stage === "question" &&
                      "One Accessibility step may be needed"}
                    {stage === "greyed-entry" &&
                      "Tap the greyed-out FocusFlow entry"}
                    {stage === "app-info" && "Allow restricted settings"}
                    {stage === "checking" && "Checking Android settings"}
                    {stage === "enable" && "Now enable Accessibility"}
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: theme.textSecondary }]}
                  >
                    {stage === "question" &&
                      "Some Android phones require this extra path before FocusFlow can be enabled."}
                    {stage === "greyed-entry" &&
                      "This helps Android reveal the restricted-access explanation."}
                    {stage === "app-info" &&
                      "Follow the Android App Info steps, then we will check the result."}
                    {stage === "checking" &&
                      "Please wait while FocusFlow verifies the permission state."}
                    {stage === "enable" &&
                      "Restricted settings are unlocked, but Accessibility is not enabled yet."}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={dismissRecovery}
                  hitSlop={8}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss Accessibility recovery"
                  testID="restricted-recovery-dismiss"
                >
                  <Ionicons name="close" size={22} color={theme.muted} />
                </TouchableOpacity>
              </View>

              {stage === "question" && renderQuestion()}
              {stage === "greyed-entry" && renderGreyedEntry()}
              {stage === "app-info" && renderAppInfo()}
              {stage === "checking" && (
                <View style={styles.checkingBox}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text
                    style={[styles.bodyText, { color: theme.textSecondary }]}
                  >
                    Checking restricted settings…
                  </Text>
                </View>
              )}
              {stage === "enable" && renderEnable()}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  modalSafe: {
    flexShrink: 1,
  },
  modalScroll: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  progressCount: {
    fontSize: FONT.xs,
    fontWeight: "700",
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  container: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  dismissButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4,
    marginRight: -4,
  },
  title: {
    fontSize: FONT.sm,
    fontWeight: "800",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: FONT.xs,
    lineHeight: 17,
  },
  question: {
    fontSize: FONT.xs,
    fontWeight: "600",
    lineHeight: 17,
  },
  bodyText: {
    fontSize: FONT.xs,
    lineHeight: 17,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  primaryButtonText: {
    fontSize: FONT.sm,
    fontWeight: "800",
    color: "#fff",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  secondaryButtonText: {
    fontSize: FONT.xs,
    fontWeight: "700",
    color: COLORS.primary,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  skipButtonText: {
    fontSize: FONT.xs,
    fontWeight: "600",
  },
  stepsBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 7,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  stepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumberLight: {
    backgroundColor: COLORS.primary + "55",
  },
  stepNumberText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 17,
  },
  returnedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  returnedText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 17,
    fontWeight: "600",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  warningText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 17,
    fontWeight: "600",
  },
  fallbackBox: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.sm,
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  fallbackHeaderText: {
    flex: 1,
    gap: 2,
  },
  fallbackTitle: {
    fontSize: FONT.xs,
    fontWeight: "700",
  },
  fallbackSubtitle: {
    fontSize: FONT.xs,
    lineHeight: 16,
  },
  fallbackBody: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  checkingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
});
