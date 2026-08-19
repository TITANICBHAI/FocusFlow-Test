import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { isProtectedApp } from '@/services/protectedApps';
import type { UsageApp } from '@/native-modules/UsageStatsModule';

interface Props {
  visible: boolean;
  app: UsageApp | null;
  onClose: () => void;
}

function nextTime(hour: number, minute = 0): number {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  if (value.getTime() <= Date.now()) value.setDate(value.getDate() + 1);
  return value.getTime();
}

function tomorrowMorning(wakeUpTime?: string): number {
  const [hour, minute] = (wakeUpTime ?? '08:00').split(':').map(Number);
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
  return value.getTime();
}

export function QuickBlockSheet({ visible, app, onClose }: Props) {
  const { theme } = useTheme();
  const { state, updateSettings, setQuickBlockTemporary } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customDate, setCustomDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));

  useEffect(() => {
    if (visible) {
      setLoading(false);
      setError('');
      setCustomDate(new Date(Date.now() + 60 * 60 * 1000));
    }
  }, [visible, app?.packageName]);

  const isAlwaysOn = !!app && (state.settings.alwaysOnPackages ?? []).includes(app.packageName);
  const isTemporarilyBlocked = useMemo(() => {
    if (!app || !(state.settings.standaloneBlockUntil && state.settings.standaloneBlockPackages?.includes(app.packageName))) return false;
    return new Date(state.settings.standaloneBlockUntil).getTime() > Date.now();
  }, [app, state.settings.standaloneBlockPackages, state.settings.standaloneBlockUntil]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (!app) return;
    if (isProtectedApp(app.packageName)) {
      setError(`${app.appName} is a protected system app and cannot be blocked.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await action();
      onClose();
    } catch {
      setError('Could not update the block. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [app, onClose]);

  const temporary = useCallback(
    (untilMs: number) => run(() => setQuickBlockTemporary(app!.packageName, untilMs)),
    [app, run, setQuickBlockTemporary],
  );

  const openAndroidPicker = useCallback(() => {
    const minDate = new Date(Date.now() + 60 * 1000);
    DateTimePickerAndroid.open({
      value: customDate > minDate ? customDate : minDate,
      mode: 'date',
      minimumDate: minDate,
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== 'set' || !pickedDate) return;
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: 'time',
          is24Hour: false,
          onChange: (timeEvent, pickedTime) => {
            if (timeEvent.type !== 'set' || !pickedTime) return;
            const combined = new Date(pickedDate);
            combined.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
            if (combined.getTime() <= Date.now()) return;
            setCustomDate(combined);
            void temporary(combined.getTime());
          },
        });
      },
    });
  }, [customDate, temporary]);

  if (!app) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={[styles.appIcon, { backgroundColor: COLORS.primary + '18' }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.headingText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>Quick Block {app.appName}</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                {isAlwaysOn
                  ? isTemporarilyBlocked ? 'Always-On + temporary block is active' : 'Always-On protection is active'
                  : isTemporarilyBlocked ? `Blocked until ${formatExpiry(state.settings.standaloneBlockUntil)}`
                  : 'Choose how long to protect this app'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.muted }]}>TEMPORARY BLOCK</Text>
          <View style={styles.optionGrid}>
            <ActionButton icon="time-outline" label="1 hour" onPress={() => temporary(Date.now() + 60 * 60 * 1000)} theme={theme} disabled={loading} />
            <ActionButton icon="sunny-outline" label="Until tonight" onPress={() => temporary(nextTime(20))} theme={theme} disabled={loading} />
            <ActionButton icon="moon-outline" label="Tomorrow morning" onPress={() => temporary(tomorrowMorning(state.settings.userProfile?.wakeUpTime))} theme={theme} disabled={loading} />
            <ActionButton
              icon="calendar-outline"
              label="Choose time"
              onPress={() => {
                if (Platform.OS === 'android') {
                  openAndroidPicker();
                }
              }}
              theme={theme}
              disabled={loading}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: theme.muted }]}>ALWAYS-ON PROTECTION</Text>
          <TouchableOpacity
            style={[styles.alwaysButton, { backgroundColor: isAlwaysOn ? theme.surface : COLORS.orange + '16', borderColor: isAlwaysOn ? theme.border : COLORS.orange + '45' }]}
            disabled={loading || isAlwaysOn}
            onPress={() => run(async () => {
              const alwaysOnPackages = Array.from(new Set([...(state.settings.alwaysOnPackages ?? []), app.packageName]));
              await updateSettings({
                ...state.settings,
                alwaysOnPackages,
                autoCopiedAlwaysOnPackages: (state.settings.autoCopiedAlwaysOnPackages ?? []).filter((pkg) => pkg !== app.packageName),
              });
            })}
          >
            <Ionicons name={isAlwaysOn ? 'checkmark-circle' : 'shield-outline'} size={22} color={isAlwaysOn ? COLORS.green : COLORS.orange} />
            <View style={styles.alwaysText}>
              <Text style={[styles.alwaysTitle, { color: isAlwaysOn ? COLORS.green : theme.text }]}>{isAlwaysOn ? 'Already Always-On' : 'Block always'}</Text>
              <Text style={[styles.alwaysSub, { color: theme.muted }]}>Keep this app blocked 24/7 until you remove it from Always-On</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.manageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.manageHeader}>
              <Ionicons name="help-circle-outline" size={19} color={COLORS.primary} />
              <Text style={[styles.manageTitle, { color: theme.text }]}>Need to remove this later?</Text>
            </View>
            {isTemporarilyBlocked || isAlwaysOn ? (
              <>
                <Text style={[styles.manageDescription, { color: theme.muted }]}>
                  {isTemporarilyBlocked && isAlwaysOn
                    ? 'This app has both a timed block and Always-On protection. Manage each one separately:'
                    : isTemporarilyBlocked
                      ? 'This timed block is managed from Active. It cannot be removed while its timer is running and expires automatically.'
                      : 'Always-On protection stays until you remove the app from the Always-On list. A defense password may be required.'}
                </Text>
                <View style={styles.manageActions}>
                  {isTemporarilyBlocked ? (
                    <TouchableOpacity
                      style={[styles.manageButton, { borderColor: theme.border }]}
                      onPress={() => { onClose(); router.push('/active'); }}
                    >
                      <Ionicons name="pulse-outline" size={16} color={COLORS.primary} />
                      <Text style={[styles.manageButtonText, { color: theme.text }]}>Open Active</Text>
                    </TouchableOpacity>
                  ) : null}
                  {isAlwaysOn ? (
                    <TouchableOpacity
                      style={[styles.manageButton, { borderColor: theme.border }]}
                      onPress={() => { onClose(); router.push('/always-on'); }}
                    >
                      <Ionicons name="settings-outline" size={16} color={COLORS.primary} />
                      <Text style={[styles.manageButtonText, { color: theme.text }]}>Open Always-On</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : (
              <Text style={[styles.manageDescription, { color: theme.muted }]}>
                Temporary blocks expire automatically. If you choose “Block always”, remove the app later from Settings → Always-On.
              </Text>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={COLORS.primary} style={styles.loading} /> : null}
          <Text style={[styles.privacyNote, { color: theme.muted }]}>Quick Block uses FocusFlow's existing block lists. No separate block history is created.</Text>
        </View>
      </View>
    </Modal>
  );
}

function formatExpiry(value: string | null): string {
  if (!value) return 'expiry';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'expiry';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ActionButton({
  icon,
  label,
  onPress,
  theme,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  theme: { surface: string; border: string; text: string };
  disabled: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.option, { backgroundColor: theme.surface, borderColor: theme.border }, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' },
  sheet: { borderTopLeftRadius: RADIUS.xl ?? 22, borderTopRightRadius: RADIUS.xl ?? 22, padding: SPACING.lg, paddingBottom: SPACING.xl + 8, gap: SPACING.md },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF', alignSelf: 'center', marginBottom: SPACING.xs },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  appIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, gap: 3 },
  title: { fontSize: FONT.md, fontWeight: '800' },
  subtitle: { fontSize: FONT.xs, lineHeight: 17 },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 0.8, marginTop: SPACING.xs },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  option: { width: '48%', minHeight: 52, borderWidth: 1, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm },
  optionLabel: { fontSize: FONT.sm, fontWeight: '700' },
  alwaysButton: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  alwaysText: { flex: 1, gap: 2 },
  alwaysTitle: { fontSize: FONT.sm, fontWeight: '800' },
  alwaysSub: { fontSize: FONT.xs, lineHeight: 16 },
  manageCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, gap: SPACING.xs },
  manageHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  manageTitle: { fontSize: FONT.sm, fontWeight: '800' },
  manageDescription: { fontSize: FONT.xs, lineHeight: 17 },
  manageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  manageButton: { minHeight: 36, borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 6 },
  manageButtonText: { fontSize: FONT.xs, fontWeight: '700' },
  error: { color: COLORS.red, fontSize: FONT.xs, textAlign: 'center' },
  loading: { marginTop: -SPACING.xs },
  privacyNote: { fontSize: FONT.xs, textAlign: 'center', lineHeight: 17, marginTop: SPACING.xs },
});
