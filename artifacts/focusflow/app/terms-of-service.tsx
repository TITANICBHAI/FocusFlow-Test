import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

const TERMS_URL = 'https://focusflowapp.pages.dev/terms-of-service/';

export default function TermsOfServiceScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.text }]}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="document-text" size={34} color="#fff" />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Terms of Service</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Last updated: April 2026
          </Text>
        </View>

        <TosSection title="1. Acceptance">
          By installing or using FocusFlow you unconditionally agree to these Terms. If you do not agree, uninstall the app immediately. These Terms may be changed, amended, or replaced at any time without prior notice or obligation. Continued use after any change constitutes your immediate, irrevocable acceptance of the updated Terms. You are solely responsible for reviewing these Terms periodically.
        </TosSection>

        <TosSection title="2. What FocusFlow Does">
          FocusFlow is a personal productivity tool that uses Android Accessibility Services, Usage Stats, and System Overlay permissions to enforce self-imposed focus sessions and app restrictions. All enforcement is performed locally on your device by the Android OS and is subject to hardware, software, and OS limitations beyond FocusFlow's control.
        </TosSection>

        <TosSection title="3. Your Sole Responsibility">
          You are solely and exclusively responsible for all consequences of configuring, enabling, or disabling any blocking session. FocusFlow and TBTechs bear absolutely no responsibility for missed communications, missed alarms, missed appointments, accidents, injuries, financial losses, or any other outcome — foreseeable or unforeseeable — arising while any blocking feature is active or inactive. Use of FocusFlow is entirely at your own risk.
        </TosSection>

        <TosSection title="4. Emergency Access Disclaimer">
          FocusFlow attempts to allow emergency dialers and calls but makes NO guarantee whatsoever that emergency services (112, 911, 999, or any equivalent) will be reachable during an active session. Android OS, OEM skins (One UI, MIUI, ColorOS, etc.), carrier restrictions, or device state may prevent or delay emergency access in ways FocusFlow cannot detect or control. TBTechs is not liable — under any legal theory, in any jurisdiction — for any failure, delay, or inability to access emergency services while FocusFlow is installed, running, or active. DO NOT rely on FocusFlow in any safety-critical or emergency situation.
        </TosSection>

        <TosSection title="5. No Data Collection">
          FocusFlow does not collect, transmit, or share any personal data, usage statistics, or behavioral information. All data is stored locally on your device and never leaves it.
        </TosSection>

        <TosSection title="6. Accessibility Service Disclosure">
          FocusFlow uses Android's Accessibility Service solely to detect which app is in the foreground and enforce the blocking rules you configure. It does not read passwords, private messages, or any user input beyond keyword patterns you explicitly configure. This disclosure is required by Google Play policy.
        </TosSection>

        <TosSection title="7. No Warranty">
          TO THE FULLEST EXTENT PERMITTED BY LAW: FocusFlow is provided "AS IS" and "AS AVAILABLE" without any warranty of any kind, whether express, implied, or statutory, including but not limited to implied warranties of merchantability, fitness for a particular purpose, accuracy, or reliability. TBTechs explicitly disclaims any warranty that the app will function correctly on your device, Android version, or OEM configuration. Blocking may fail at any time for any reason, including but not limited to OS updates, permission revocation, battery optimization, Doze mode, or OEM-specific process killing.
        </TosSection>

        <TosSection title="8. Limitation of Liability">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW: TBTechs, its affiliates, officers, developers, and contributors shall not be liable for any damages of any kind — including direct, indirect, incidental, special, punitive, or consequential damages, personal injury, death, property damage, financial loss, or harm resulting from failure to access emergency services — arising out of or related to your use of or inability to use FocusFlow, regardless of the legal theory (contract, tort, strict liability, or otherwise), even if advised of the possibility of such damages. The aggregate total liability of TBTechs for any and all claims shall not exceed zero (USD $0). No legal action, arbitration, or proceeding against TBTechs may exceed this cap under any circumstances or jurisdiction.
        </TosSection>

        <TosSection title="9. Changes to These Terms">
          These Terms may be updated, replaced, or removed at any time without prior notice. The updated Terms are effective immediately upon publication. Your continued use of FocusFlow after any change — regardless of whether you have read the updated Terms — constitutes your unconditional acceptance.
        </TosSection>

        <TosSection title="10. Contact">
          For questions about these terms, email us at tbtechsdev@gmail.com or visit focusflowapp.pages.dev. Questions do not alter or waive any provision of these Terms.
        </TosSection>

        <TouchableOpacity
          style={styles.fullLinkBtn}
          onPress={() => Linking.openURL(TERMS_URL)}
          activeOpacity={0.7}
        >
          <Ionicons name="open-outline" size={14} color={COLORS.primary} />
          <Text style={styles.fullLinkText}>Read the full Terms of Service online</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backBtnBottom}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
          <Text style={styles.backBtnText}>Back to Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function TosSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: FONT.md,
    fontWeight: '700',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 48,
    gap: SPACING.md,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT.xxl,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT.sm,
    textAlign: 'center',
  },
  section: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT.md,
    fontWeight: '800',
  },
  sectionBody: {
    fontSize: FONT.sm,
    lineHeight: 21,
  },
  fullLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    backgroundColor: COLORS.primaryLight,
  },
  fullLinkText: { color: COLORS.primary, fontSize: FONT.sm, fontWeight: '700' },
  backBtnBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  backBtnText: {
    color: COLORS.primary,
    fontSize: FONT.md,
    fontWeight: '700',
  },
});
