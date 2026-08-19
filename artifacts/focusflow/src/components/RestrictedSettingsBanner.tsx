import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UsageStatsModule } from '@/native-modules/UsageStatsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

/**
 * RestrictedSettingsBanner
 *
 * Walks the user through the Android 13+ "Restricted Settings" unlock flow
 * that blocks sideloaded apps from enabling Accessibility / Device Admin
 * until the user manually allows it via the App Info ⋮ menu.
 *
 * Behaviour:
 *   • Renders nothing when the OS is not currently restricting this app
 *     (Android < 13, Play Store install, trusted OEM store install, or
 *     already unblocked by the user).
 *   • Auto re-checks every time the app returns to the foreground so the
 *     banner disappears the moment the user completes the unlock flow.
 *   • Provides one-tap deep link to the App Info screen + collapsible
 *     "Why is this needed?" explainer + step-by-step instructions tailored
 *     to whether the user is on stock Android, OneUI, ColorOS, MIUI, etc.
 *
 * Used by:
 *   • app/permissions.tsx       — top of the in-settings permissions list
 *   • app/onboarding.tsx        — top of the first-run permissions step
 */

type Props = {
  /** Optional override — auto-detects via UsageStatsModule when omitted. */
  forceVisible?: boolean;
};

export function RestrictedSettingsBanner({ forceVisible }: Props) {
  const { theme } = useTheme();
  const [restricted, setRestricted] = useState(false);
  const [installer, setInstaller] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const recheck = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setRestricted(false);
      return;
    }
    try {
      const [r, inst] = await Promise.all([
        UsageStatsModule.isRestrictedSettingsBlocked(),
        UsageStatsModule.getInstallerPackage(),
      ]);
      setRestricted(r);
      setInstaller(inst);
    } catch {
      setRestricted(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  const visible = forceVisible ?? restricted;
  if (!visible) return null;

  const installSourceLabel = describeInstaller(installer);

  const openAppInfo = () => {
    UsageStatsModule.openAppInfoSettings().catch(() => Linking.openSettings());
  };

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.card, borderColor: COLORS.orange + '88' },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconRing}>
          <Ionicons name="lock-closed" size={20} color={COLORS.orange} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: theme.text }]}>
            Permission toggle is locked by Android
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            One-time unlock needed before Accessibility can be turned on.
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Android 13+ greys out sensitive toggles for apps installed outside the
        Play Store. This is a system security feature — not a FocusFlow bug.
        {installSourceLabel ? ` (${installSourceLabel})` : ''}
      </Text>

      {/* Step-by-step */}
      <View style={[styles.stepsBox, { backgroundColor: theme.surface }]}>
        <Text style={[styles.stepsTitle, { color: theme.text }]}>
          Quick fix — takes 10 seconds:
        </Text>
        <Step n={1} text="Tap “Open App Info” below." theme={theme} />
        <Step
          n={2}
          text="Tap the ⋮ (three dots) in the top-right corner."
          theme={theme}
        />
        <Step n={3} text="Tap “Allow restricted settings”." theme={theme} />
        <Step
          n={4}
          text="Come back here — the Accessibility toggle will work now."
          theme={theme}
        />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={openAppInfo}
          activeOpacity={0.85}
        >
          <Ionicons name="open-outline" size={14} color="#fff" />
          <Text style={styles.primaryBtnText}>Open App Info</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.border }]}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'help-circle-outline'}
            size={14}
            color={COLORS.primary}
          />
          <Text style={[styles.secondaryBtnText, { color: COLORS.primary }]}>
            {expanded ? 'Hide details' : 'Why is this needed?'}
          </Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={[styles.detailsBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.detailsTitle, { color: theme.text }]}>
            What is this?
          </Text>
          <Text style={[styles.detailsBody, { color: theme.textSecondary }]}>
            Starting in Android 13, Google added a feature called “Restricted
            Settings” to stop sideloaded apps from quietly granting themselves
            powerful permissions like Accessibility — the same permission
            FocusFlow legitimately needs to detect and block apps.
            {'\n\n'}
            The toggle is greyed out only because Android cannot tell whether
            FocusFlow is a real productivity app or a piece of malware
            pretending to be one. Manually allowing it from the App Info menu
            is the OS asking you to confirm: “yes, I trust this app.”
            {'\n\n'}
            Once you complete the unlock once, it stays allowed forever —
            you won’t see this banner again on this install.
          </Text>

          <Text style={[styles.detailsTitle, { color: theme.text, marginTop: SPACING.md }]}>
            Why does it work on Samsung without this?
          </Text>
          <Text style={[styles.detailsBody, { color: theme.textSecondary }]}>
            Samsung’s OneUI handles the unlock flow more leniently — it often
            silently auto-allows the toggle when you tap through the in-app
            permission flow. Pixel, Oppo, OnePlus, Realme, Xiaomi, Vivo,
            Motorola, and Nothing all enforce it strictly.
          </Text>

          <Text style={[styles.detailsTitle, { color: theme.text, marginTop: SPACING.md }]}>
            How do I avoid this on the next install?
          </Text>
          <Text style={[styles.detailsBody, { color: theme.textSecondary }]}>
            Install FocusFlow from any of these stores instead — they’re
            treated as “trusted installers” and the unlock step is skipped:
            {'\n'}  • Google Play Store
            {'\n'}  • Samsung Galaxy Store (Samsung phones)
            {'\n'}  • Oppo / Realme App Market (ColorOS phones)
            {'\n'}  • Xiaomi GetApps (MIUI / HyperOS phones)
            {'\n'}  • Vivo App Store (FuntouchOS / OriginOS phones)
            {'\n'}  • Huawei AppGallery (Huawei / Honor phones)
          </Text>
        </View>
      )}
    </View>
  );
}

function Step({ n, text, theme }: { n: number; text: string; theme: any }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );
}

/**
 * Best-effort human-readable label for the installer package, used purely
 * to add context to the banner ("you installed via Aptoide, that's why").
 */
function describeInstaller(pkg: string | null): string | null {
  if (!pkg) return 'installed from an unknown source';
  switch (pkg) {
    case 'com.android.vending':
    case 'com.google.android.feedback':
      return null; // Play Store users should not see the banner anyway.
    case 'com.sec.android.app.samsungapps':
      return 'installed via Samsung Galaxy Store';
    case 'com.heytap.market':
    case 'com.oppo.market':
      return 'installed via Oppo App Market';
    case 'com.xiaomi.market':
      return 'installed via Xiaomi GetApps';
    case 'com.bbk.appstore':
      return 'installed via Vivo App Store';
    case 'com.huawei.appmarket':
      return 'installed via Huawei AppGallery';
    case 'cm.aptoide.pt':
      return 'installed via Aptoide';
    case 'com.aptoide.uploader':
      return 'installed via Aptoide Uploader';
    case 'com.uptodown.installer':
    case 'com.uptodown':
      return 'installed via Uptodown';
    case 'org.fdroid.fdroid':
      return 'installed via F-Droid';
    case 'com.android.packageinstaller':
    case 'com.google.android.packageinstaller':
    case 'com.samsung.android.packageinstaller':
      return 'installed from an APK file';
    default:
      return `installed via ${pkg}`;
  }
}

const styles = StyleSheet.create({
  banner: {
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
    backgroundColor: COLORS.orange + '22',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTextWrap: { flex: 1, gap: 2 },
  title: { fontSize: FONT.md, fontWeight: '800' },
  subtitle: { fontSize: FONT.xs, fontWeight: '600' },
  body: { fontSize: FONT.xs, lineHeight: 17 },

  stepsBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 6,
  },
  stepsTitle: { fontSize: FONT.xs, fontWeight: '800', marginBottom: 2 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },

  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: { color: '#fff', fontSize: FONT.xs, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: FONT.xs, fontWeight: '700' },

  detailsBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  detailsTitle: { fontSize: FONT.xs, fontWeight: '800' },
  detailsBody: { fontSize: FONT.xs, lineHeight: 18, marginTop: 4 },
});
