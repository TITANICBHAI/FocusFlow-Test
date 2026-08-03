import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { InstalledAppsModule, InstalledApp } from '@/native-modules/InstalledAppsModule';
import { UsageStatsModule } from '@/native-modules/UsageStatsModule';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import type { DailyAllowanceEntry, AllowanceMode, BlockPreset, RecurringBlockSchedule } from '@/data/types';

// ─── App Categories ───────────────────────────────────────────────────────────
// Known Android package names for common app categories.
// Used to let users block an entire category in one tap.

interface AppCategory {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  packages: string[];
}

// ─── System app block protection ─────────────────────────────────────────────
// These apps must NEVER be added to the block list.  Blocking them via the
// AccessibilityService can cause a soft brick or safety emergency:
//   • Home launchers → no way back to home screen (soft brick)
//   • SystemUI → status bar / quick settings disappear (device unusable without ADB)
//   • Phone/dialer → user cannot dial 112 / 911 in an emergency
//   • Google Play Services → nearly all apps crash or fail authentication
//   • Package installers → OTA updates silently fail
//   • Digital wallets → user stranded at payment terminal
//
// Note: Android Settings IS allowed in the standalone block list — the user
// has explicitly asked to be able to block it.  AppPickerSheet still surfaces
// it as a sensitive category with a warning before adding it to the list.

const SYSTEM_NEVER_BLOCK = new Set([
  'com.android.launcher', 'com.android.launcher2', 'com.android.launcher3',
  'com.sec.android.app.launcher', 'com.google.android.apps.nexuslauncher',
  'com.miui.launcher', 'com.huawei.android.launcher', 'com.coloros.launcher',
  'com.oneplus.launcher', 'com.oppo.launcher', 'com.motorola.launcher3',
  'com.nothing.launcher', 'com.realme.launcher', 'com.iqoo.launcher',
  'com.vivo.launcher', 'com.asus.launcher', 'com.ZenUI.launcher',
  'com.lge.launcher3', 'com.htc.launcher', 'com.sonyericsson.home',
  'com.tcl.launcher', 'com.nokia.launcher', 'com.infinix.launcher',
  'com.transsion.launcher', 'com.hihonor.launcher',
  'com.android.systemui',
  'com.android.phone', 'com.android.server.telecom',
  'com.samsung.android.incallui', 'com.google.android.dialer',
  'com.google.android.apps.googledialer',
  'com.google.android.gms',
  'com.android.packageinstaller', 'com.google.android.packageinstaller',
  'com.samsung.android.packageinstaller',
  'com.samsung.android.wallet', 'com.samsung.android.samsungpay',
  'com.google.android.apps.walletnfcrel',
  'com.tbtechs.focusflow',
]);

const APP_CATEGORIES: AppCategory[] = [
  {
    id: 'social',
    label: 'Social',
    icon: 'people-outline',
    color: '#3b82f6',
    packages: [
      'com.facebook.katana',
      'com.instagram.android',
      'com.twitter.android',
      'com.zhiliaoapp.musically',   // TikTok
      'com.snapchat.android',
      'com.reddit.frontpage',
      'com.pinterest',
      'com.linkedin.android',
      'com.whatsapp',
      'org.telegram.messenger',
      'com.discord',
      'com.bereal.android',
      'com.tumblr',
      'com.vkontakte.android',
      'jp.naver.line.android',
    ],
  },
  {
    id: 'video',
    label: 'Video',
    icon: 'play-circle-outline',
    color: '#ef4444',
    packages: [
      'com.google.android.youtube',
      'com.netflix.mediaclient',
      'com.amazon.avod.thirdpartyclient',
      'com.disney.disneyplus',
      'tv.twitch.android.app',
      'com.hulu.plus',
      'com.max.android',
      'com.peacocktv.peacockandroid',
      'tv.pluto.android',
      'com.roku.remote',
      'com.apple.android.music', // Apple TV
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: 'bag-outline',
    color: '#f59e0b',
    packages: [
      'com.amazon.mShop.android.shopping',
      'com.ebay.mobile',
      'com.shein.app.us',
      'com.walmart.android',
      'com.etsy.android',
      'com.target.ui',
      'com.wish.android',
      'com.alibaba.aliexpresshd',
      'com.temu.app',
      'com.bestbuy.android',
    ],
  },
  {
    id: 'news',
    label: 'News',
    icon: 'newspaper-outline',
    color: '#8b5cf6',
    packages: [
      'com.google.android.apps.magazines',
      'com.nytimes.android',
      'com.cnn.mobile.android.phone',
      'com.bbc.news',
      'com.nbcnews.android',
      'com.fox.news',
      'com.reddit.frontpage',
      'flipboard.app',
      'com.apple.news',
      'com.feedly.android',
    ],
  },
  {
    id: 'games',
    label: 'Games',
    icon: 'game-controller-outline',
    color: '#10b981',
    packages: [
      'com.king.candycrushsaga',
      'com.supercell.clashofclans',
      'com.mojang.minecraftpe',
      'com.roblox.client',
      'com.ea.gp.fifamobile',
      'com.epicgames.fortnite',
      'com.pubg.krmobile',
      'com.garena.game.freefire',
      'com.supercell.brawlstars',
      'com.activision.callofduty.shooter',
    ],
  },
];

interface Props {
  visible: boolean;
  blockedPackages: string[];
  blockUntil: string | null;
  locked?: boolean;
  dailyAllowanceEntries?: DailyAllowanceEntry[];
  vpnPackages?: string[];
  blockPresets?: BlockPreset[];
  recurringBlockSchedules?: RecurringBlockSchedule[];
  onSave: (packages: string[], untilMs: number | null, allowanceEntries: DailyAllowanceEntry[], vpnPackages?: string[], pinHash?: string | null) => void | Promise<void>;
  onSavePreset?: (preset: BlockPreset) => void | Promise<void>;
  onDeletePreset?: (id: string) => void | Promise<void>;
  onSaveRecurringSchedules?: (schedules: RecurringBlockSchedule[]) => void | Promise<void>;
  onClose: () => void;
}

const ALL_MODES: AllowanceMode[] = ['count', 'time_budget', 'interval'];

const MODE_LABELS: Record<AllowanceMode, string> = {
  count: 'Count',
  time_budget: 'Time',
  interval: 'Interval',
};

const MODE_ICONS: Record<AllowanceMode, React.ComponentProps<typeof Ionicons>['name']> = {
  count: 'finger-print-outline',
  time_budget: 'hourglass-outline',
  interval: 'timer-outline',
};

function makeDefaultEntry(packageName: string): DailyAllowanceEntry {
  return {
    packageName,
    mode: 'count',
    countPerDay: 1,
    budgetMinutes: 30,
    intervalMinutes: 5,
    intervalHours: 1,
  };
}

/**
 * StandaloneBlockModal
 *
 * Lets the user pick apps to block and set an expiry date/time.
 * Independent of any task — the block persists until the expiry, regardless
 * of whether a task focus session is running or not.
 *
 * Renders immediately with a manual entry field at the top.
 * The auto-detected installed apps list loads asynchronously in the background.
 */
export function StandaloneBlockModal({
  visible,
  blockedPackages,
  blockUntil,
  locked = false,
  dailyAllowanceEntries = [],
  vpnPackages = [],
  blockPresets = [],
  recurringBlockSchedules = [],
  onSave,
  onSavePreset,
  onDeletePreset,
  onSaveRecurringSchedules,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(blockedPackages));
  // Derive allowed-package set from entries (for display) and keep the full entries map for saving
  const [dailyEntriesMap, setDailyEntriesMap] = useState<Map<string, DailyAllowanceEntry>>(
    new Map(dailyAllowanceEntries.map((e) => [e.packageName, e]))
  );
  const [originalDailyPkgs, setOriginalDailyPkgs] = useState<Set<string>>(
    new Set(dailyAllowanceEntries.map((e) => e.packageName))
  );
  const dailyAllowed = useMemo(() => new Set(dailyEntriesMap.keys()), [dailyEntriesMap]);
  const [vpnPkgsSet, setVpnPkgsSet] = useState<Set<string>>(new Set(vpnPackages));
  const [search, setSearch] = useState('');
  const [loadingApps, setLoadingApps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualPackages, setManualPackages] = useState<string[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);

  const defaultUntil = blockUntil ? new Date(blockUntil) : dayjs().add(1, 'day').toDate();
  const [untilDate, setUntilDate] = useState<Date>(defaultUntil);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(blockedPackages));
    setDailyEntriesMap(new Map(dailyAllowanceEntries.map((e) => [e.packageName, e])));
    setOriginalDailyPkgs(new Set(dailyAllowanceEntries.map((e) => e.packageName)));
    setVpnPkgsSet(new Set(vpnPackages));
    setSearch('');
    setManualInput('');
    setShowAdvanced(false);
    setUntilDate(blockUntil ? new Date(blockUntil) : dayjs().add(1, 'day').toDate());

    // Derive manual packages from existing blocked list before apps load
    const existingManual = blockedPackages.filter(
      (pkg) => !apps.some((a) => a.packageName === pkg)
    );
    setManualPackages(existingManual);

    // Load apps asynchronously — modal is already visible
    void loadApps();
  }, [visible]);

  const loadApps = async () => {
    setLoadingApps(true);
    try {
      const result = await InstalledAppsModule.getInstalledApps();
      const sorted = result
        .filter((a) => !SYSTEM_NEVER_BLOCK.has(a.packageName)) // never show system-critical apps
        .slice()
        .sort((a, b) => a.appName.toLowerCase().localeCompare(b.appName.toLowerCase()));
      setApps(sorted);
      // Re-derive manual packages now that we have the installed list
      setManualPackages((prev) => {
        const installedPkgs = new Set(sorted.map((a) => a.packageName));
        const fromCurrent = Array.from(selected).filter((pkg) => !installedPkgs.has(pkg));
        const union = new Set([...prev, ...fromCurrent]);
        return Array.from(union);
      });
    } catch (e) {
      console.warn('[StandaloneBlockModal] Failed to load apps', e);
    } finally {
      setLoadingApps(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
    );
  }, [apps, search]);

  const toggle = (packageName: string) => {
    if (SYSTEM_NEVER_BLOCK.has(packageName)) return; // cannot block critical system apps
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        if (locked) return next;
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  };

  const isDailyEntryLocked = (packageName: string) => locked && originalDailyPkgs.has(packageName);

  const toggleDailyAllowed = (packageName: string) => {
    if (isDailyEntryLocked(packageName)) return;
    setDailyEntriesMap((prev) => {
      const next = new Map(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.set(packageName, makeDefaultEntry(packageName));
      }
      return next;
    });
  };

  const updateDailyEntry = (packageName: string, patch: Partial<DailyAllowanceEntry>) => {
    setDailyEntriesMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(packageName) ?? makeDefaultEntry(packageName);
      next.set(packageName, { ...existing, ...patch });
      return next;
    });
  };

  const adjustDailyValue = (
    packageName: string,
    field: 'countPerDay' | 'budgetMinutes' | 'intervalMinutes' | 'intervalHours',
    delta: number,
    min: number,
    max: number,
  ) => {
    const existing = dailyEntriesMap.get(packageName) ?? makeDefaultEntry(packageName);
    const nextValue = Math.min(max, Math.max(min, (existing[field] ?? min) + delta));
    updateDailyEntry(packageName, { [field]: nextValue });
  };

  const handleAddManual = () => {
    const pkg = manualInput.trim().toLowerCase();
    if (!pkg || !pkg.includes('.')) return;
    if (!manualPackages.includes(pkg)) {
      setManualPackages((prev) => [...prev, pkg]);
    }
    setSelected((prev) => new Set([...prev, pkg]));
    setManualInput('');
  };

  const applyPreset = useCallback((preset: BlockPreset) => {
    // Filter out system-critical apps that must never be blocked
    const safe = preset.packages.filter((p) => !SYSTEM_NEVER_BLOCK.has(p));
    if (locked) {
      // Active session: only ADD packages that aren't already selected.
      // Never remove apps the user has already chosen to block.
      setSelected((prev) => new Set([...prev, ...safe]));
    } else {
      // No active session: replace selection with the preset's package list.
      setSelected(new Set(safe));
    }
  }, [locked]);

  // ── Category helpers ──────────────────────────────────────────────────────

  const installedPkgSet = useMemo(() => new Set(apps.map((a) => a.packageName)), [apps]);

  const categoryInstalledCount = useCallback((cat: AppCategory) => {
    return cat.packages.filter((pkg) => installedPkgSet.has(pkg)).length;
  }, [installedPkgSet]);

  const handleSelectCategory = useCallback((cat: AppCategory) => {
    const installedInCat = cat.packages.filter((pkg) => installedPkgSet.has(pkg));
    if (installedInCat.length === 0) {
      // If none installed, still add the known packages
      setSelected((prev) => new Set([...prev, ...cat.packages]));
      return;
    }
    const allAlreadySelected = installedInCat.every((pkg) => selected.has(pkg));
    if (allAlreadySelected) {
      // Deselect all from this category
      setSelected((prev) => {
        const next = new Set(prev);
        for (const pkg of cat.packages) next.delete(pkg);
        return next;
      });
    } else {
      // Select all installed from this category
      setSelected((prev) => new Set([...prev, ...installedInCat]));
    }
  }, [installedPkgSet, selected]);

  const isCategoryFullySelected = useCallback((cat: AppCategory) => {
    const installed = cat.packages.filter((pkg) => installedPkgSet.has(pkg));
    if (installed.length === 0) return false;
    return installed.every((pkg) => selected.has(pkg));
  }, [installedPkgSet, selected]);


  const handleSaveCurrentAsPreset = useCallback(async () => {
    const name = presetNameInput.trim();
    if (!name) return;
    if (selected.size === 0) {
      Alert.alert('No Apps Selected', 'Select apps first, then save as preset.');
      return;
    }
    const preset: BlockPreset = {
      id: Date.now().toString(),
      name,
      packages: Array.from(selected),
    };
    await onSavePreset?.(preset);
    setPresetNameInput('');
    setShowSavePreset(false);
  }, [presetNameInput, selected, onSavePreset]);

  const handleDeletePreset = useCallback((preset: BlockPreset) => {
    Alert.alert(
      `Delete "${preset.name}"?`,
      'This preset will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeletePreset?.(preset.id),
        },
      ]
    );
  }, [onDeletePreset]);

  const handleSave = async () => {
    if (selected.size === 0) {
      Alert.alert(
        'No Apps Selected',
        'Select at least one app to block, or use Clear Block to disable.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (untilDate.getTime() <= Date.now()) {
      Alert.alert(
        'Expiry in the Past',
        'Please set a future date and time for the block to expire.',
        [{ text: 'OK' }]
      );
      return;
    }
    // Check that the required permissions are in place before committing the block.
    if (Platform.OS === 'android') {
      const hasAccessibility = await UsageStatsModule.hasAccessibilityPermission().catch(() => false);
      const hasUsage = await UsageStatsModule.hasPermission().catch(() => false);
      if (!hasAccessibility || !hasUsage) {
        Alert.alert(
          'Permissions Required',
          'FocusFlow needs Accessibility and Usage Access permissions to block apps.\n\nGo to Settings → Permissions to grant them, then try again.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Permissions',
              onPress: async () => {
                if (!hasAccessibility) await UsageStatsModule.openAccessibilitySettings().catch(() => {});
                else await UsageStatsModule.openUsageAccessSettings().catch(() => {});
              },
            },
          ]
        );
        return;
      }
    }
    setSaving(true);
    try {
      // Pass both block packages and daily allowance entries together so the
      // parent can save them atomically in a single state + DB update.
      await onSave(Array.from(selected), untilDate.getTime(), Array.from(dailyEntriesMap.values()), Array.from(vpnPkgsSet));
      onClose();
    } catch (e) {
      console.error('[StandaloneBlockModal] Failed to save', e);
      Alert.alert('Error', 'Failed to apply the block. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    Alert.alert(
      'Clear Block',
      'This will disable the app block schedule and allow all apps again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (locked) {
              const pinIsSet = await SessionPinModule.isPinSet().catch(() => false);
              if (pinIsSet) {
                setPinVerifyVisible(true);
                return;
              }
            }
            try {
              await onSave([], null, Array.from(dailyEntriesMap.values()), [], null);
              onClose();
            } catch (e) {
              console.error('[StandaloneBlockModal] Failed to clear', e);
              Alert.alert('Error', 'Failed to clear the block. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handlePinVerified = async (pinHash: string) => {
    setPinVerifyVisible(false);
    try {
      await onSave([], null, Array.from(dailyEntriesMap.values()), [], pinHash);
      onClose();
    } catch (e) {
      console.error('[StandaloneBlockModal] Failed to clear after PIN verify', e);
      Alert.alert('Error', 'Failed to clear the block. Please try again.');
    }
  };

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const merged = dayjs(date)
        .hour(untilDate.getHours())
        .minute(untilDate.getMinutes())
        .second(0)
        .toDate();
      setUntilDate(merged);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      let merged = dayjs(untilDate)
        .hour(date.getHours())
        .minute(date.getMinutes())
        .second(0);
      // If the resulting datetime is in the past (user picked an earlier time
      // on today's date), auto-advance to the next day so the block always
      // starts in the future and handleSave never rejects it silently.
      if (merged.isBefore(dayjs())) {
        merged = merged.add(1, 'day');
      }
      setUntilDate(merged.toDate());
    }
  };

  const allowanceSummary = (entry: DailyAllowanceEntry) => {
    if (entry.mode === 'time_budget') return `${entry.budgetMinutes ?? 30} min/day`;
    if (entry.mode === 'interval') return `${entry.intervalMinutes ?? 5} min every ${entry.intervalHours ?? 1}hr`;
    return `${entry.countPerDay ?? 1}×/day`;
  };

  const toggleVpn = (packageName: string) => {
    if (locked) return;
    setVpnPkgsSet((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) next.delete(packageName);
      else next.add(packageName);
      return next;
    });
  };

  const renderVpnControl = (packageName: string) => {
    const isVpn = vpnPkgsSet.has(packageName);
    // Show VPN toggle for any app — network blocking is independent of overlay blocking.
    // An app can be VPN-blocked without being in the block overlay list.
    if (!isVpn && !selected.has(packageName)) {
      // For unblocked apps, only show the VPN row if VPN is already enabled
      // (so unselected apps don't clutter with an extra row by default).
      return null;
    }
    return (
      <View style={[styles.vpnRow, { backgroundColor: theme.surface, borderTopColor: theme.border }, isVpn && styles.vpnRowActive]}>
        <TouchableOpacity
          style={styles.dailyToggle}
          onPress={() => toggleVpn(packageName)}
          activeOpacity={locked ? 1 : 0.7}
        >
          <Ionicons
            name={isVpn ? (locked ? 'lock-closed-outline' : 'shield-checkmark-outline') : 'shield-outline'}
            size={13}
            color={isVpn ? (locked ? COLORS.muted : COLORS.primary) : COLORS.muted}
          />
          <Text style={[styles.dailyText, isVpn && !locked && styles.vpnTextActive]}>
            {isVpn ? (locked ? 'Network block (locked)' : 'Network block: on') : 'Add network block (VPN)'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDailyControls = (packageName: string) => {
    const isDaily = dailyAllowed.has(packageName);
    const dailyEntry = dailyEntriesMap.get(packageName);
    const entryLocked = isDailyEntryLocked(packageName);
    return (
      <View style={[styles.dailyRow, { backgroundColor: theme.surface, borderTopColor: theme.border }, isDaily && styles.dailyRowActive]}>
        <View style={styles.dailyTopLine}>
          <TouchableOpacity
            style={styles.dailyToggle}
            onPress={() => toggleDailyAllowed(packageName)}
            activeOpacity={entryLocked ? 1 : 0.7}
          >
            <Ionicons
              name={isDaily ? (entryLocked ? 'lock-closed-outline' : 'sunny') : 'sunny-outline'}
              size={13}
              color={isDaily ? (entryLocked ? COLORS.muted : COLORS.orange) : COLORS.muted}
            />
            <Text style={[styles.dailyText, isDaily && !entryLocked && styles.dailyTextActive]}>
              {isDaily ? (entryLocked ? 'Daily allowance (locked):' : 'Daily allowance:') : 'Add daily allowance'}
            </Text>
          </TouchableOpacity>
          {isDaily && dailyEntry && (
            <Text style={styles.dailyCountText}>{allowanceSummary(dailyEntry)}</Text>
          )}
        </View>
        {isDaily && dailyEntry && (
          <View style={styles.dailyConfig}>
            <View style={styles.modeRow}>
              {ALL_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modePill, dailyEntry.mode === mode && styles.modePillActive, entryLocked && { opacity: 0.45 }]}
                  onPress={() => { if (!entryLocked) updateDailyEntry(packageName, { mode }); }}
                  activeOpacity={entryLocked ? 1 : 0.75}
                >
                  <Ionicons
                    name={MODE_ICONS[mode]}
                    size={12}
                    color={dailyEntry.mode === mode ? (entryLocked ? COLORS.muted : COLORS.orange) : COLORS.muted}
                  />
                  <Text style={[styles.modePillText, dailyEntry.mode === mode && !entryLocked && styles.modePillTextActive]}>
                    {MODE_LABELS[mode]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {dailyEntry.mode === 'count' && (
              <StepperRow
                label="Opens per day"
                value={dailyEntry.countPerDay ?? 1}
                suffix=""
                onMinus={() => { if (!entryLocked) adjustDailyValue(packageName, 'countPerDay', -1, 1, 20); }}
                onPlus={() => { if (!entryLocked) adjustDailyValue(packageName, 'countPerDay', 1, 1, 20); }}
                disabled={entryLocked}
              />
            )}
            {dailyEntry.mode === 'time_budget' && (
              <StepperRow
                label="Minutes per day"
                value={dailyEntry.budgetMinutes ?? 30}
                suffix=" min"
                onMinus={() => { if (!entryLocked) adjustDailyValue(packageName, 'budgetMinutes', -5, 1, 480); }}
                onPlus={() => { if (!entryLocked) adjustDailyValue(packageName, 'budgetMinutes', 5, 1, 480); }}
                disabled={entryLocked}
              />
            )}
            {dailyEntry.mode === 'interval' && (
              <>
                <StepperRow
                  label="Minutes per window"
                  value={dailyEntry.intervalMinutes ?? 5}
                  suffix=" min"
                  onMinus={() => { if (!entryLocked) adjustDailyValue(packageName, 'intervalMinutes', -1, 1, 120); }}
                  onPlus={() => { if (!entryLocked) adjustDailyValue(packageName, 'intervalMinutes', 1, 1, 120); }}
                  disabled={entryLocked}
                />
                <StepperRow
                  label="Window size"
                  value={dailyEntry.intervalHours ?? 1}
                  suffix=" hr"
                  onMinus={() => { if (!entryLocked) adjustDailyValue(packageName, 'intervalHours', -1, 1, 24); }}
                  onPlus={() => { if (!entryLocked) adjustDailyValue(packageName, 'intervalHours', 1, 1, 24); }}
                  disabled={entryLocked}
                />
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: InstalledApp }) => {
    const blocked = selected.has(item.packageName);
    return (
      <View style={styles.rowWrap}>
        <TouchableOpacity style={[styles.row, { backgroundColor: theme.card }]} onPress={() => toggle(item.packageName)} activeOpacity={0.7}>
          {item.iconBase64 ? (
            <Image
              source={{ uri: `data:image/png;base64,${item.iconBase64}` }}
              style={styles.icon}
            />
          ) : (
            <View style={styles.iconPlaceholder}>
              <Ionicons name="apps-outline" size={22} color={COLORS.muted} />
            </View>
          )}
          <View style={styles.appInfo}>
            <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{item.appName}</Text>
            <Text style={[styles.packageName, { color: theme.muted }]} numberOfLines={1}>{item.packageName}</Text>
          </View>
          <View style={[styles.checkbox, { borderColor: theme.border }, blocked && styles.checkboxBlocked]}>
            {blocked && <Ionicons name="ban" size={13} color="#fff" />}
          </View>
        </TouchableOpacity>
        {renderDailyControls(item.packageName)}
        {renderVpnControl(item.packageName)}
      </View>
    );
  };

  const renderManualPackage = (pkg: string) => {
    const blocked = selected.has(pkg);
    return (
      <View key={pkg} style={styles.rowWrap}>
        <TouchableOpacity style={[styles.row, { backgroundColor: theme.card }]} onPress={() => toggle(pkg)} activeOpacity={0.7}>
          <View style={styles.iconPlaceholder}>
            <Ionicons name="cube-outline" size={22} color={COLORS.muted} />
          </View>
          <View style={styles.appInfo}>
            <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>Manual Entry</Text>
            <Text style={[styles.packageName, { color: theme.muted }]} numberOfLines={1}>{pkg}</Text>
          </View>
          <View style={[styles.checkbox, { borderColor: theme.border }, blocked && styles.checkboxBlocked]}>
            {blocked && <Ionicons name="ban" size={13} color="#fff" />}
          </View>
        </TouchableOpacity>
        {renderDailyControls(pkg)}
        {renderVpnControl(pkg)}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>{locked ? '🔒 Block Active' : 'Block Schedule'}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Active block banner */}
        {locked && (
          <View style={styles.lockedBanner}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.orange} />
            <Text style={styles.lockedBannerText}>
              Block is active — the expiry date is locked and blocked apps cannot be removed. You can still add more apps to the block.
            </Text>
          </View>
        )}

        {/* Expiry date/time pickers */}
        <View style={[styles.expirySection, { backgroundColor: theme.card, borderColor: theme.border }, locked && styles.expirySectionLocked]}>
          <Text style={[styles.expirySectionLabel, { color: theme.textSecondary }]}>
            {locked ? 'BLOCK UNTIL (LOCKED)' : 'BLOCK UNTIL'}
          </Text>
          <View style={styles.expiryRow}>
            <TouchableOpacity
              style={[styles.expiryBtn, locked && styles.expiryBtnLocked]}
              onPress={() => { if (!locked) setShowDatePicker(true); }}
              activeOpacity={locked ? 1 : 0.7}
            >
              <Ionicons name={locked ? 'lock-closed-outline' : 'calendar-outline'} size={16} color={locked ? COLORS.muted : COLORS.primary} />
              <Text style={[styles.expiryBtnText, locked && { color: COLORS.muted }]}>
                {dayjs(untilDate).format('MMM D, YYYY')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.expiryBtn, locked && styles.expiryBtnLocked]}
              onPress={() => { if (!locked) setShowTimePicker(true); }}
              activeOpacity={locked ? 1 : 0.7}
            >
              <Ionicons name={locked ? 'lock-closed-outline' : 'time-outline'} size={16} color={locked ? COLORS.muted : COLORS.primary} />
              <Text style={[styles.expiryBtnText, locked && { color: COLORS.muted }]}>
                {dayjs(untilDate).format('h:mm A')}
              </Text>
            </TouchableOpacity>
          </View>
          {locked && (
            <View style={styles.addTimeRow}>
              <Text style={[styles.addTimeLabel, { color: theme.textSecondary }]}>Add time:</Text>
              {[30, 60, 120, 240].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.addTimeBtn, { borderColor: COLORS.primary + '55' }]}
                  onPress={() => setUntilDate((prev) => dayjs(prev).add(mins, 'minute').toDate())}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.addTimeBtnText, { color: COLORS.primary }]}>
                    +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={untilDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={untilDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            onChange={onTimeChange}
          />
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.packageName}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {/* ── Presets section ── */}
              {(blockPresets.length > 0 || selected.size > 0) && (
                <View style={[styles.presetSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.presetHeaderRow}>
                    <Text style={[styles.presetSectionLabel, { color: theme.muted }]}>PRESETS</Text>
                    {selected.size > 0 && !showSavePreset && (
                      <TouchableOpacity onPress={() => setShowSavePreset(true)}>
                        <Text style={styles.savePresetLink}>+ Save current selection</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {blockPresets.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                      {blockPresets.map((preset) => (
                        <TouchableOpacity
                          key={preset.id}
                          style={[styles.presetChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => applyPreset(preset)}
                          onLongPress={() => handleDeletePreset(preset)}
                          delayLongPress={500}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.presetChipName, { color: theme.text }]} numberOfLines={1}>{preset.name}</Text>
                          <Text style={[styles.presetChipCount, { color: COLORS.muted }]}>{preset.packages.length} app{preset.packages.length !== 1 ? 's' : ''}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {blockPresets.length === 0 && !showSavePreset && (
                    <Text style={[styles.presetEmpty, { color: theme.muted }]}>
                      Select apps below then tap "+ Save current selection" to create your first preset.
                    </Text>
                  )}

                  {showSavePreset && (
                    <View style={styles.savePresetRow}>
                      <TextInput
                        style={[styles.savePresetInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                        placeholder="Preset name (e.g. Social Media)…"
                        placeholderTextColor={COLORS.muted}
                        value={presetNameInput}
                        onChangeText={setPresetNameInput}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => { void handleSaveCurrentAsPreset(); }}
                      />
                      <TouchableOpacity
                        style={[styles.savePresetConfirmBtn, !presetNameInput.trim() && { opacity: 0.4 }]}
                        onPress={() => { void handleSaveCurrentAsPreset(); }}
                        disabled={!presetNameInput.trim()}
                      >
                        <Text style={styles.savePresetConfirmText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { setShowSavePreset(false); setPresetNameInput(''); }}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Ionicons name="close" size={20} color={COLORS.muted} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* ── (Categories and Recurring sections removed) ── */}

              {/* ── Advanced toggle (Add by Package Name) ── */}
              <TouchableOpacity
                style={[styles.recurringToggleBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setShowAdvanced((v) => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={16} color={COLORS.muted} />
                <Text style={[styles.recurringToggleLabel, { color: theme.text }]}>Advanced</Text>
                <Ionicons
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.muted}
                />
              </TouchableOpacity>

              {showAdvanced && (
                <>
                  <View style={[styles.manualSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.manualSectionLabel, { color: theme.muted }]}>ADD BY PACKAGE NAME</Text>
                    <Text style={[styles.manualHint, { color: theme.textSecondary }]}>
                      Enter app package name, e.g. com.instagram.android
                    </Text>
                    <View style={[styles.installerTip, { backgroundColor: theme.surface }]}>
                      <Ionicons name="information-circle-outline" size={14} color={COLORS.muted} />
                      <Text style={[styles.installerTipText, { color: theme.textSecondary }]}>
                        To block the Android Package Installer / Uninstaller, add it manually:{' '}
                        <Text style={styles.installerTipCode}>com.android.packageinstaller</Text>
                      </Text>
                    </View>
                    <View style={styles.manualInputRow}>
                      <TextInput
                        style={[styles.manualInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                        placeholder="com.example.app"
                        placeholderTextColor={COLORS.muted}
                        value={manualInput}
                        onChangeText={setManualInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onSubmitEditing={handleAddManual}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={[styles.addBtn, !manualInput.trim().includes('.') && styles.addBtnDisabled]}
                        onPress={handleAddManual}
                        disabled={!manualInput.trim().includes('.')}
                      >
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {manualPackages.length > 0 && (
                    <View style={[styles.manualSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.manualSectionLabel, { color: theme.muted }]}>MANUALLY ADDED</Text>
                      {manualPackages.map(renderManualPackage)}
                    </View>
                  )}
                </>
              )}

              {/* Search and installed apps header */}
              <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="search" size={16} color={COLORS.muted} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search installed apps…"
                  placeholderTextColor={COLORS.muted}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                {selected.size > 0
                  ? `${selected.size} app${selected.size !== 1 ? 's' : ''} will be blocked — tap to toggle`
                  : 'Tap apps below to block them'}
              </Text>

              {loadingApps && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading installed apps…</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            !loadingApps ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {search ? 'No apps match your search.' : 'No user-installed apps found.'}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            selected.size > 0 && !locked ? (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                <Text style={styles.clearBtnText}>Clear Block</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </SafeAreaView>
      <PinVerifyModal
        visible={pinVerifyVisible}
        pinType="focus"
        title="Session Password Required"
        description="Enter your session password to end the standalone block early."
        onVerified={handlePinVerified}
        onCancel={() => setPinVerifyVisible(false)}
      />
    </Modal>
  );
}

function StepperRow({
  label,
  value,
  suffix,
  onMinus,
  onPlus,
  disabled = false,
}: {
  label: string;
  value: number;
  suffix: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.stepperRow, disabled && { opacity: 0.45 }]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.dailyStepper}>
        <TouchableOpacity onPress={onMinus} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={disabled}>
          <Ionicons name="remove-circle-outline" size={18} color={COLORS.orange} />
        </TouchableOpacity>
        <Text style={styles.dailyCountText}>{value}{suffix}</Text>
        <TouchableOpacity onPress={onPlus} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={disabled}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.orange} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    minWidth: 60,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  title: {
    fontSize: FONT.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  cancelText: {
    fontSize: FONT.md,
    color: COLORS.muted,
  },
  saveText: {
    fontSize: FONT.md,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  expirySection: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  expirySectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: COLORS.muted,
  },
  expiryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  expiryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
  expiryBtnText: {
    fontSize: FONT.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  expirySectionLocked: {
    // no longer dim the whole section — user can still add time
  },
  expiryBtnLocked: {
    backgroundColor: COLORS.border,
  },
  addTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  addTimeLabel: {
    fontSize: FONT.xs,
    fontWeight: '500',
    marginRight: 2,
  },
  addTimeBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  addTimeBtnText: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.orange + '18',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  lockedBannerText: {
    flex: 1,
    fontSize: FONT.xs,
    color: COLORS.orange,
    lineHeight: 16,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  manualSection: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  manualSectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  manualHint: {
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  installerTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  installerTipText: {
    flex: 1,
    fontSize: FONT.xs,
    color: COLORS.muted,
    lineHeight: 16,
  },
  installerTipCode: {
    fontFamily: 'monospace',
    color: COLORS.text,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  manualInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '66',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    color: COLORS.text,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: COLORS.primaryLight,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.xs,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: FONT.md,
    color: COLORS.text,
  },
  hint: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  loadingText: {
    fontSize: FONT.sm,
    color: COLORS.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: FONT.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  packageName: {
    fontSize: FONT.xs,
    color: COLORS.muted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxBlocked: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  separator: {
    height: SPACING.xs,
  },
  rowWrap: {
    gap: 0,
  },
  dailyRow: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: -2,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  dailyRowActive: {
    backgroundColor: COLORS.orange + '15',
    borderTopColor: COLORS.orange + '33',
  },
  vpnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: -2,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  vpnRowActive: {
    backgroundColor: COLORS.primary + '12',
    borderTopColor: COLORS.primary + '33',
  },
  vpnTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  dailyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  dailyTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  dailyText: {
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  dailyTextActive: {
    color: COLORS.orange,
    fontWeight: '600',
  },
  dailyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dailyConfig: {
    gap: SPACING.xs,
    paddingTop: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 5,
    backgroundColor: COLORS.card,
  },
  modePillActive: {
    borderColor: COLORS.orange,
    backgroundColor: COLORS.orange + '15',
  },
  modePillText: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.muted,
  },
  modePillTextActive: {
    color: COLORS.orange,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  stepperLabel: {
    flex: 1,
    fontSize: FONT.xs,
    color: COLORS.muted,
  },
  dailyCountText: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.orange,
    minWidth: 40,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT.sm,
    color: COLORS.muted,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.red + '44',
    backgroundColor: COLORS.redLight,
  },
  clearBtnText: {
    fontSize: FONT.sm,
    fontWeight: '600',
    color: COLORS.red,
  },
  presetSection: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  presetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetSectionLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  savePresetLink: {
    fontSize: FONT.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  presetScroll: {
    marginTop: SPACING.xs,
  },
  presetChip: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    minWidth: 90,
  },
  presetChipName: {
    fontSize: FONT.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  presetChipCount: {
    fontSize: FONT.xs,
  },
  presetEmpty: {
    fontSize: FONT.xs,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  savePresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  savePresetInput: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT.sm,
  },
  savePresetConfirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  savePresetConfirmText: {
    color: '#fff',
    fontSize: FONT.sm,
    fontWeight: '600',
  },

  // ── Category styles ────────────────────────────────────────────────────────
  categorySection: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  categoryHint: {
    fontSize: FONT.xs,
    lineHeight: 16,
  },
  categoryScroll: {
    marginTop: SPACING.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
  },
  categoryChipLabel: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  categoryChipCount: {
    fontSize: FONT.xs,
    fontWeight: '600',
  },

  // ── Recurring schedule styles ──────────────────────────────────────────────
  recurringToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
  },
  recurringToggleLabel: {
    flex: 1,
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  recurringBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  recurringBadgeText: {
    color: '#fff',
    fontSize: FONT.xs,
    fontWeight: '700',
  },
  recurringSection: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  recurringSectionHint: {
    fontSize: FONT.xs,
    lineHeight: 16,
  },
  recurringItem: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.sm,
  },
  recurringItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recurringItemName: {
    fontSize: FONT.sm,
    fontWeight: '700',
  },
  recurringItemMeta: {
    fontSize: FONT.xs,
    marginTop: 1,
  },
  addRecurringBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  addRecurringBtnText: {
    fontSize: FONT.sm,
    fontWeight: '600',
  },
  recurringForm: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  recurringFormTitle: {
    fontSize: FONT.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  recurringNameInput: {
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.sm,
  },
  recurringFormLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  recurringFormValue: {
    fontSize: FONT.xs,
    marginTop: 2,
  },
  recurringDayRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  recurringDayBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recurringDayBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  recurringDayLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLORS.muted,
  },
  recurringDayLabelActive: {
    color: '#fff',
  },
  recurringTimeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  recurringTimeSteppers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  recurringTimeValue: {
    fontSize: FONT.sm,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
  recurringFormActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  recurringCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  recurringCancelBtnText: {
    fontSize: FONT.sm,
    fontWeight: '600',
  },
  recurringSaveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  recurringSaveBtnText: {
    color: '#fff',
    fontSize: FONT.sm,
    fontWeight: '700',
  },
});
