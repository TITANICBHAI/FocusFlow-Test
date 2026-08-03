import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

const PRIVACY_URL = 'https://focusflowapp.pages.dev/privacy-policy/';
const TERMS_URL   = 'https://focusflowapp.pages.dev/terms-of-service/';

type Tab = 'privacy' | 'terms';

function getDeviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.toLowerCase();
  } catch {
    return '';
  }
}

const isChinese = getDeviceLanguage().startsWith('zh');

const CONTENT = {
  privacy: {
    developerTitle: isChinese ? '关于本政策' : 'About this policy',
    developerBody: isChinese
      ? '本隐私政策适用于由 TBTechs 开发的 FocusFlow 应用程序，规范您在 Android 设备上使用 FocusFlow 的相关行为。'
      : 'This Privacy Policy applies to FocusFlow, developed by TBTechs. It governs your use of the FocusFlow application on Android devices.',
    cards: [
      {
        title: isChinese ? '本地优先存储' : 'Local-first data',
        icon: 'phone-portrait-outline' as const,
        body: isChinese
          ? '任务、日程、屏蔽列表、使用限额和设置，均仅存储于本设备的 SQLite 数据库和 Android 系统偏好设置中，不会上传至任何服务器。'
          : 'Tasks, schedules, block lists, allowances, and settings are stored exclusively in FocusFlow\'s on-device SQLite database and Android SharedPreferences. Nothing is transmitted to any server.',
      },
      {
        title: isChinese ? 'Android 权限' : 'Android permissions',
        icon: 'shield-checkmark-outline' as const,
        body: isChinese
          ? 'FocusFlow 申请特殊 Android 权限（无障碍服务、使用情况统计、悬浮窗）仅用于检测前台应用、显示屏蔽覆层并保持专注会话正常运行，绝不用于数据收集。'
          : 'FocusFlow requests special Android access (Accessibility Service, Usage Stats, Draw over Other Apps) strictly to detect the foreground app, show blocking overlays, and keep focus sessions running. These are never used for data collection.',
      },
      {
        title: isChinese ? '不读取消息或密码' : 'No message or password collection',
        icon: 'eye-off-outline' as const,
        body: isChinese
          ? '无障碍服务仅读取前台应用的包名以触发屏蔽。FocusFlow 不会捕获密码、消息、表单内容、剪贴板内容或屏幕录像。'
          : 'The Accessibility Service reads only the foreground package name to trigger app blocking. FocusFlow does not capture passwords, messages, form entries, clipboard contents, or screen recordings — ever.',
      },
      {
        title: isChinese ? '照片保持私密' : 'Photos stay private',
        icon: 'images-outline' as const,
        body: isChinese
          ? '若您设置自定义屏蔽界面壁纸，FocusFlow 会将图片复制至应用私有存储区，不会上传、共享或允许其他应用访问。'
          : 'If you set a custom block-screen wallpaper, FocusFlow copies the image into app-private storage. It is never uploaded, shared, or accessible to other apps.',
      },
      {
        title: isChinese ? '您的控制权' : 'Your control',
        icon: 'settings-outline' as const,
        body: isChinese
          ? '您可随时在 Android 设置中撤销任何权限。清除应用数据将永久删除设备上的所有 FocusFlow 数据，不存在云端备份。'
          : 'You can revoke any permission in Android Settings at any time. Clearing app data permanently removes all FocusFlow data from the device. No cloud backup exists.',
      },
      {
        title: isChinese ? '儿童隐私' : 'Children\'s privacy',
        icon: 'people-outline' as const,
        body: isChinese
          ? 'FocusFlow 不收集任何个人信息，适合所有年龄段使用，不涉及账户注册、数据分析或广告投放。'
          : 'FocusFlow does not collect personal information and is safe for all ages. No accounts, analytics, or advertising are involved.',
      },
      {
        title: isChinese ? '隐私政策变更' : 'Policy changes',
        icon: 'refresh-outline' as const,
        body: isChinese
          ? '本隐私政策可能随时更新，恕不另行通知。继续使用 FocusFlow 即视为接受最新版本政策。'
          : 'This Privacy Policy may be updated at any time without prior notice. Continued use of FocusFlow after any change constitutes your acceptance of the revised policy. The current version is always the one in effect.',
      },
    ],
  },
  terms: {
    cards: [
      {
        title: isChinese ? '接受条款' : 'Acceptance of terms',
        icon: 'checkmark-circle-outline' as const,
        body: isChinese
          ? '使用 FocusFlow 即表示您同意本服务条款。条款可能随时变更，继续使用即视为接受最新版本。'
          : 'By using FocusFlow you agree to these Terms of Service. These Terms may be changed at any time without prior notice. Continued use constitutes immediate, irrevocable acceptance of the current Terms.',
      },
      {
        title: isChinese ? '无质量保证' : 'No warranty',
        icon: 'warning-outline' as const,
        body: isChinese
          ? 'FocusFlow 按"现状"提供，不附带任何形式的保证。我们不保证其能在您的设备、Android 版本或定制系统上正常运行。屏蔽功能依赖于 Android 权限，系统可能随时撤销。'
          : 'FocusFlow is provided "AS IS" without any warranty of any kind. We make no guarantee it will function on your device, Android version, or OEM configuration. Blocking relies on Android permissions the OS may revoke at any time, for any reason.',
      },
      {
        title: isChinese ? '紧急呼叫' : 'Emergency access',
        icon: 'medkit-outline' as const,
        body: isChinese
          ? 'FocusFlow 会尝试允许紧急呼叫，但不保证在活动会话中一定能拨通紧急服务。请勿在安全关键场景中依赖 FocusFlow。'
          : 'FocusFlow attempts to permit emergency calls, but makes NO guarantee that emergency services will be reachable during an active session. Device or OS restrictions may override any permission. Do not rely on FocusFlow in safety-critical situations.',
      },
      {
        title: isChinese ? '责任限制' : 'Limitation of liability',
        icon: 'shield-outline' as const,
        body: isChinese
          ? '在法律允许的最大范围内，TBTechs 不对因使用或无法使用 FocusFlow 而产生的任何损失（包括错过紧急情况、人身伤害或数据丢失）承担责任。'
          : 'To the maximum extent permitted by law, TBTechs shall not be liable for any damages — including missed emergencies, personal injury, or data loss — arising from use of or inability to use FocusFlow, regardless of cause or legal theory.',
      },
      {
        title: isChinese ? '无障碍服务声明' : 'Accessibility Service disclosure',
        icon: 'eye-outline' as const,
        body: isChinese
          ? 'FocusFlow 的无障碍服务仅用于检测前台应用并执行您配置的屏蔽规则，不作其他用途。此声明为应用平台政策要求。'
          : 'FocusFlow\'s Accessibility Service is used solely to detect foreground apps and enforce blocking rules you configure. It is not used for any other purpose. This declaration is required by Google Play policy.',
      },
    ],
  },
};

export default function PrivacyPolicyScreen() {
  const { state, updateSettings } = useApp();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const isRevisit = navigation.canGoBack();
  const [activeTab, setActiveTab] = useState<Tab>('privacy');
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (accepting || !accepted) return;
    setAccepting(true);
    try {
      const updated = { ...state.settings, privacyAccepted: true };
      await updateSettings(updated);
      try {
        await SharedPrefsModule.putString('privacy_accepted', 'true');
      } catch {
        // Non-fatal — the DB save above is the primary path.
      }
      router.replace('/onboarding');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      isChinese ? '拒绝隐私政策' : 'Decline Privacy Policy',
      isChinese
        ? '如果您拒绝，FocusFlow 将无法正常使用。您可以随时重新打开应用并接受政策以继续使用。'
        : 'If you decline, FocusFlow cannot be used. You can reopen the app at any time and accept the policy to get started.',
      [
        {
          text: isChinese ? '返回查看' : 'Go Back',
          style: 'cancel',
        },
        {
          text: isChinese ? '确认拒绝并退出' : 'Decline & Exit',
          style: 'destructive',
          onPress: () => BackHandler.exitApp(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {isRevisit && (
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: theme.text }]}>
            {isChinese ? '隐私与条款' : 'Privacy & Terms'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Ionicons name="lock-closed" size={28} color="#fff" />
        </View>
        <Text style={[styles.heroTitle, { color: theme.text }]}>
          {isChinese ? '隐私与条款' : 'Privacy & Terms'}
        </Text>
        <Text style={[styles.heroSub, { color: theme.muted }]}>
          {isChinese ? '您的数据永不离开此设备。' : 'Your data never leaves this device.'}
        </Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text-outline"
            size={15}
            color={activeTab === 'privacy' ? COLORS.primary : theme.muted}
          />
          <Text style={[styles.tabLabel, activeTab === 'privacy' && styles.tabLabelActive, { color: activeTab === 'privacy' ? COLORS.primary : theme.muted }]}>
            {isChinese ? '隐私政策' : 'Privacy Policy'}
          </Text>
        </TouchableOpacity>
        <View style={[styles.tabDivider, { backgroundColor: theme.border }]} />
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="reader-outline"
            size={15}
            color={activeTab === 'terms' ? COLORS.primary : theme.muted}
          />
          <Text style={[styles.tabLabel, activeTab === 'terms' && styles.tabLabelActive, { color: activeTab === 'terms' ? COLORS.primary : theme.muted }]}>
            {isChinese ? '服务条款' : 'Terms of Service'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {activeTab === 'privacy' ? (
          <>
            {/* Issue 4 fix: developer + app name identification card */}
            <PolicyCard title={CONTENT.privacy.developerTitle} icon="information-circle-outline">
              {CONTENT.privacy.developerBody}
            </PolicyCard>

            {CONTENT.privacy.cards.map((card) => (
              <PolicyCard key={card.title} title={card.title} icon={card.icon}>
                {card.body}
              </PolicyCard>
            ))}

            <TouchableOpacity
              style={[styles.fullLinkBtn, { borderColor: COLORS.primary + '44', backgroundColor: COLORS.primaryLight }]}
              onPress={() => Linking.openURL(PRIVACY_URL)}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={14} color={COLORS.primary} />
              <Text style={styles.fullLinkText}>
                {isChinese ? '在线查看完整隐私政策' : 'Read the full Privacy Policy online'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {CONTENT.terms.cards.map((card) => (
              <PolicyCard key={card.title} title={card.title} icon={card.icon}>
                {card.body}
              </PolicyCard>
            ))}

            <TouchableOpacity
              style={[styles.fullLinkBtn, { borderColor: COLORS.primary + '44', backgroundColor: COLORS.primaryLight }]}
              onPress={() => Linking.openURL(TERMS_URL)}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={14} color={COLORS.primary} />
              <Text style={styles.fullLinkText}>
                {isChinese ? '在线查看完整服务条款' : 'Read the full Terms of Service online'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Issue 1 fix: unchecked checkbox + explicit Decline button — first-time only */}
        {!isRevisit && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={[styles.checkRow, { backgroundColor: theme.card, borderColor: accepted ? COLORS.primary : theme.border }]}
              onPress={() => setAccepted((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, { borderColor: accepted ? COLORS.primary : theme.border, backgroundColor: accepted ? COLORS.primary : 'transparent' }]}>
                {accepted && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.checkText, { color: theme.textSecondary }]}>
                {isChinese ? '我已阅读并同意' : 'I have read and agree to the'}{' '}
                <Text
                  style={styles.checkLink}
                  onPress={(e) => { e.stopPropagation?.(); Linking.openURL(PRIVACY_URL); }}
                >
                  {isChinese ? '隐私政策' : 'Privacy Policy'}
                </Text>
                {isChinese ? '和' : ' and '}{' '}
                <Text
                  style={styles.checkLink}
                  onPress={(e) => { e.stopPropagation?.(); Linking.openURL(TERMS_URL); }}
                >
                  {isChinese ? '服务条款' : 'Terms of Service'}
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptBtn, (!accepted || accepting) && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              activeOpacity={0.85}
              disabled={!accepted || accepting}
            >
              {accepting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.acceptText}>
                    {isChinese ? '我已了解，继续' : 'I Understand and Continue'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* Explicit Decline option — Huawei rule 7.5 */}
            <TouchableOpacity
              style={[styles.declineBtn, { borderColor: theme.border }]}
              onPress={handleDecline}
              activeOpacity={0.7}
            >
              <Text style={[styles.declineText, { color: theme.muted }]}>
                {isChinese ? '拒绝并退出' : 'Decline & Exit'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {isRevisit && (
          <TouchableOpacity style={styles.backBtnBottom} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backBtnText}>
              {isChinese ? '返回设置' : 'Back to Settings'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyCard({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{children}</Text>
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
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: FONT.md, fontWeight: '700' },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: 6,
  },
  logoCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: FONT.xl, fontWeight: '900' },
  heroSub: { fontSize: FONT.sm, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm + 2,
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: SPACING.xs,
  },
  tabLabel: { fontSize: FONT.sm, fontWeight: '600' },
  tabLabelActive: { fontWeight: '800' },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 48, gap: SPACING.md },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconWrap: {
    width: 34, height: 34, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: FONT.md, fontWeight: '800' },
  cardBody: { fontSize: FONT.sm, lineHeight: 21 },
  fullLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  fullLinkText: { color: COLORS.primary, fontSize: FONT.sm, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.xs },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  checkText: { flex: 1, fontSize: FONT.sm, lineHeight: 20 },
  checkLink: { color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },
  acceptBtn: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 52,
  },
  acceptBtnDisabled: { opacity: 0.4 },
  acceptText: { color: '#fff', fontSize: FONT.md, fontWeight: '800' },
  declineBtn: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  declineText: { fontSize: FONT.sm, fontWeight: '600' },
  backBtnBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  backBtnText: { color: COLORS.primary, fontSize: FONT.md, fontWeight: '700' },
});
