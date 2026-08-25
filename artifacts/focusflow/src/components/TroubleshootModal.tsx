import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

type PermissionId = 'accessibility' | 'usage' | 'battery' | 'notifications' | 'device_admin' | 'overlay' | 'media_files' | 'launcher';

type Brand = {
  id: string;
  label: string;
  icon: string;
};

const BRANDS: Brand[] = [
  { id: 'samsung', label: 'Samsung', icon: '📱' },
  { id: 'xiaomi', label: 'Xiaomi / MIUI', icon: '📱' },
  { id: 'oneplus', label: 'OnePlus', icon: '📱' },
  { id: 'realme', label: 'Realme / Oppo', icon: '📱' },
  { id: 'stock', label: 'Stock Android', icon: '🤖' },
];

type TroubleshootData = {
  [brand: string]: {
    [perm in PermissionId]?: string[];
  };
};

const TIPS: TroubleshootData = {
  samsung: {
    accessibility: [
      'Go to Settings → Accessibility',
      'Tap "Installed apps" or "Downloaded apps"',
      'Find FocusFlow and toggle it ON',
      'Tap "Allow" on the confirmation popup',
      'If missing: Settings → General management → App info → FocusFlow → Accessibility',
      'Tip: On older One UI (3.x), look under Settings → Accessibility → Vision → Voice Assistant area',
    ],
    usage: [
      'Go to Settings → Digital Wellbeing and parental controls',
      'OR Settings → Apps → ⋮ (three dots) → Special access → Usage access',
      'Find FocusFlow and toggle it ON',
      'Samsung path (One UI 5+): Settings → Privacy → Permission manager → Usage access',
    ],
    battery: [
      'Go to Settings → Battery and device care → Battery',
      'Tap "Background usage limits"',
      'Tap "Never sleeping apps" → Add FocusFlow',
      'Also go back and tap "More battery settings" → Disable Adaptive battery for FocusFlow',
      'Tip: If blocking still stops, go to Settings → Apps → FocusFlow → Battery → set to "Unrestricted"',
    ],
    notifications: [
      'Go to Settings → Notifications → App notifications',
      'Find FocusFlow and enable all notification channels',
      'Make sure "Persistent" or "Foreground service" notification channel is ON',
    ],
    device_admin: [
      'Go to Settings → Biometrics and Security',
      'Scroll down to "Device admin apps"',
      'Find FocusFlow and tap Activate',
      'On One UI 5+: Settings → Security and privacy → Other security settings → Device admin apps',
    ],
    overlay: [
      'Go to Settings → Apps',
      'Tap ⋮ (three dots) → Special access → Appear on top',
      'Find FocusFlow and toggle it ON',
      'On One UI 5+: Settings → Apps → FocusFlow → Appear on top',
      'Tip: Without this, the block screen may appear inside FocusFlow instead of over the blocked app',
    ],
  },
  xiaomi: {
    accessibility: [
      'Go to Settings → Accessibility → Downloaded apps',
      'Find FocusFlow and enable it',
      'On MIUI 12+: Settings → Additional Settings → Accessibility → Downloaded apps',
      'Tap "Allow" when asked about "Observe your actions"',
      'Tip: MIUI sometimes hides downloaded services — try searching "FocusFlow" in the Settings search bar',
    ],
    usage: [
      'Go to Settings → Apps → Manage apps',
      'Tap the ⋮ menu → Special access → Usage access',
      'Find FocusFlow and toggle ON',
      'On MIUI 12+: Settings → Privacy → Special app access → Usage data access',
    ],
    battery: [
      'Go to Settings → Apps → Manage apps → FocusFlow',
      'Tap Battery saver → set to "No restrictions"',
      'Also go to Settings → Battery & performance → App battery saver → FocusFlow → No restriction',
      'Enable "Autostart": Settings → Apps → Manage apps → FocusFlow → Autostart → ON',
      'Tip: MIUI is very aggressive — if blocking still fails, also disable "MIUI Optimization" in Developer options (last resort)',
    ],
    notifications: [
      'Settings → Apps → Manage apps → FocusFlow → Notifications',
      'Enable all channels and set to "Show without popup" or "Important"',
      'Make sure "Lock screen notifications" is enabled',
    ],
    device_admin: [
      'Settings → Password & Security → Device admin apps',
      'Find FocusFlow and activate it',
    ],
    overlay: [
      'Go to Settings → Apps → App info → FocusFlow',
      'Tap "Other permissions" → Display pop-up windows while running in background → Allow',
      'On MIUI 12+: Settings → Apps → Manage apps → FocusFlow → Other permissions → Display pop-up windows',
      'Tip: MIUI labels this "Display pop-up windows while running in background"',
    ],
  },
  oneplus: {
    accessibility: [
      'Go to Settings → Accessibility → Downloaded apps (or Accessibility settings)',
      'Find FocusFlow and switch it ON',
      'Tap OK on the permission warning',
      'If it shows "Stopped" right after: go to Settings → Apps → FocusFlow → Battery → set to Unrestricted',
    ],
    usage: [
      'Settings → Privacy → Special app access → Usage access',
      'Tap FocusFlow and enable "Permit usage access"',
    ],
    battery: [
      'Settings → Battery → Battery optimization',
      'Tap the dropdown → Show "All apps"',
      'Find FocusFlow → tap → select "Don\'t optimize"',
      'Also: Settings → Apps → FocusFlow → Battery → Unrestricted',
      'Tip: OxygenOS 13+ has "Background app management" — make sure FocusFlow is excluded',
    ],
    notifications: [
      'Settings → Apps & notifications → App notifications → FocusFlow',
      'Enable all channels, especially the persistent service notification',
    ],
    device_admin: [
      'Settings → Security → Device admin apps',
      'Toggle FocusFlow and confirm',
    ],
    overlay: [
      'Go to Settings → Apps → App info → FocusFlow',
      'Tap "Special app access" or "Additional permissions" → Display over other apps',
      'Toggle FocusFlow ON',
      'On OxygenOS 13+: Settings → Apps → FocusFlow → Special app access → Appear on top',
    ],
  },
  realme: {
    accessibility: [
      'Settings → Additional Settings → Accessibility → Downloaded apps',
      'Enable FocusFlow',
      'On ColorOS 12+: Settings → Accessibility → Installed services',
      'Tap the toggle next to FocusFlow and confirm',
    ],
    usage: [
      'Settings → Privacy → Permission manager → Usage access',
      'OR Settings → Apps → App Management → ⋮ → Special access → Usage access',
      'Enable FocusFlow',
    ],
    battery: [
      'Settings → Battery → Battery optimization → All apps → FocusFlow → Don\'t optimize',
      'Also: Settings → Apps → App Management → FocusFlow → Battery usage → Unrestricted',
      'Enable Auto-launch: Settings → Privacy → Special app access → Auto-launch → FocusFlow → ON',
      'Tip: Realme UI 3+ has "Battery Optimization" and "Smart power saver" — disable both for FocusFlow',
    ],
    notifications: [
      'Settings → Notifications & Status bar → App notifications → FocusFlow',
      'Turn on all notification categories',
      'Ensure "Persistent notifications" channel is allowed',
    ],
    device_admin: [
      'Settings → Other wireless connections → Device administration apps (some versions)',
      'OR Settings → Security → Device admin apps',
      'Activate FocusFlow',
    ],
    overlay: [
      'Go to Settings → Apps → FocusFlow',
      'Tap "Permissions" or "Special app access" → Display over other apps',
      'Enable FocusFlow',
      'On ColorOS 13+: Settings → Privacy → Special app access → Display over other apps',
    ],
  },
  stock: {
    accessibility: [
      'Go to Settings → Accessibility',
      'Tap "Installed apps" or "Downloaded apps"',
      'Find FocusFlow and toggle ON',
      'Confirm the permission when asked',
      'Return to FocusFlow — it should show "Granted" within a few seconds',
    ],
    usage: [
      'Go to Settings → Apps → Special app access → Usage access',
      'OR Settings → Digital Wellbeing → ⚙ icon → App permissions',
      'Find FocusFlow and enable "Allow"',
    ],
    battery: [
      'Go to Settings → Apps → FocusFlow',
      'Tap "Battery" → select "Unrestricted"',
      'Also check Settings → Battery → Battery optimization → All apps → FocusFlow → Don\'t optimize',
    ],
    notifications: [
      'Go to Settings → Apps → FocusFlow → Notifications',
      'Enable all notification channels',
      'Make sure "Allow notifications" is ON at the top',
    ],
    device_admin: [
      'Go to Settings → Security → Device admin apps',
      'Toggle FocusFlow to Activate',
      'Confirm when prompted',
    ],
    overlay: [
      'Go to Settings → Apps → Special app access → Display over other apps',
      'Find FocusFlow and enable it',
      'Return to FocusFlow — the status should update automatically',
      'Tip: This allows the block screen to appear directly over the blocked app',
    ],
  },
};

const PERM_LABELS: Record<PermissionId, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  accessibility: { label: 'Accessibility Service', icon: 'accessibility-outline' },
  usage:         { label: 'Usage Access',          icon: 'analytics-outline'    },
  battery:       { label: 'Battery Optimization',  icon: 'battery-charging-outline' },
  notifications: { label: 'Notifications',         icon: 'notifications-outline' },
  device_admin:  { label: 'Device Admin',          icon: 'shield-outline'       },
  overlay:       { label: 'Appear on Top',         icon: 'layers-outline'       },
  media_files:   { label: 'Media Files Access',    icon: 'images-outline'       },
  launcher:      { label: 'Home Launcher',         icon: 'home-outline'         },
};

interface Props {
  visible: boolean;
  permissionId: PermissionId;
  onClose: () => void;
}

export function TroubleshootModal({ visible, permissionId, onClose }: Props) {
  const { theme } = useTheme();
  const [selectedBrand, setSelectedBrand] = useState('stock');

  const tips = TIPS[selectedBrand]?.[permissionId] ?? [
    'Open Settings → search for FocusFlow',
    'Grant the required permission',
    'Return to FocusFlow to verify',
  ];

  const permInfo = PERM_LABELS[permissionId];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={() => {}}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Title */}
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <Ionicons name={permInfo.icon} size={18} color={COLORS.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Troubleshoot: {permInfo.label}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Select your phone brand for step-by-step instructions
          </Text>

          {/* Brand selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.brandScroll}
            contentContainerStyle={styles.brandRow}
          >
            {BRANDS.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.brandChip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  selectedBrand === b.id && styles.brandChipActive,
                ]}
                onPress={() => setSelectedBrand(b.id)}
              >
                <Text style={styles.brandIcon}>{b.icon}</Text>
                <Text
                  style={[
                    styles.brandLabel,
                    { color: theme.muted },
                    selectedBrand === b.id && styles.brandLabelActive,
                  ]}
                >
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tips */}
          <ScrollView
            style={styles.tipScroll}
            contentContainerStyle={styles.tipContent}
            showsVerticalScrollIndicator={false}
          >
            {tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</Text>
              </View>
            ))}

            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.blue} />
              <Text style={styles.noteText}>
                After granting the permission, come back here. The status refreshes
                automatically within a few seconds.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FONT.md,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: { padding: 4 },
  subtitle: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  brandScroll: { flexGrow: 0 },
  brandRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  brandChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  brandIcon: { fontSize: 14 },
  brandLabel: { fontSize: FONT.xs, fontWeight: '600', color: COLORS.muted },
  brandLabelActive: { color: COLORS.primary },
  tipScroll: { flex: 0, maxHeight: 320 },
  tipContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNum: { fontSize: FONT.xs, fontWeight: '800', color: '#fff' },
  tipText: {
    flex: 1,
    fontSize: FONT.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.blueLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  noteText: {
    flex: 1,
    fontSize: FONT.xs,
    color: COLORS.blue,
    lineHeight: 17,
  },
  doneBtn: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: FONT.md, fontWeight: '800', color: '#fff' },
});
