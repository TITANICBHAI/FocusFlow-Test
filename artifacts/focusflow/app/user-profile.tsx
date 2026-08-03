import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import type { UserProfile } from '@/data/types';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { scheduleMorningDigest, scheduleWeeklyReport } from '@/services/notificationService';
import { pickAndImportBackup } from '@/services/backupService';
import {
  dbGetTodayFocusMinutes,
  dbGetStreak,
  dbGetBestStreak,
  dbGetAllTimeFocusMinutes,
  dbGetAllTimeFocusSessions,
} from '@/data/database';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { Alert } from 'react-native';

// ── Option data ───────────────────────────────────────────────────────────────

const OCCUPATIONS = [
  { id: 'student',      label: 'Student',      icon: 'school-outline'    },
  { id: 'professional', label: 'Professional', icon: 'briefcase-outline' },
  { id: 'freelancer',   label: 'Freelancer',   icon: 'laptop-outline'    },
  { id: 'creator',      label: 'Creator',      icon: 'color-palette-outline' },
  { id: 'other',        label: 'Other',        icon: 'person-outline'    },
];

const WAKE_UP_TIMES = [
  { id: '05:00', label: '5 am' },
  { id: '06:00', label: '6 am' },
  { id: '07:00', label: '7 am' },
  { id: '08:00', label: '8 am' },
  { id: '09:00', label: '9 am' },
  { id: '10:00', label: '10 am' },
  { id: '11:00', label: '11 am' },
];

const FOCUS_GOALS = [
  { id: 'deep_work',   label: 'Deep Work',      icon: 'flash-outline'         },
  { id: 'study',       label: 'Study',          icon: 'book-outline'          },
  { id: 'no_social',   label: 'No Social Media',icon: 'phone-portrait-outline' },
  { id: 'reading',     label: 'Reading',        icon: 'library-outline'       },
  { id: 'exercise',    label: 'Exercise',       icon: 'fitness-outline'       },
  { id: 'creative',    label: 'Creative',       icon: 'brush-outline'         },
  { id: 'coding',      label: 'Coding',         icon: 'code-slash-outline'    },
  { id: 'writing',     label: 'Writing',        icon: 'create-outline'        },
];

// ── Deeper-profile option lists ───────────────────────────────────────────────

const SLEEP_TIMES = [
  { id: '21:00', label: '9 pm'  },
  { id: '22:00', label: '10 pm' },
  { id: '23:00', label: '11 pm' },
  { id: '00:00', label: '12 am' },
  { id: '01:00', label: '1 am'  },
  { id: '02:00', label: '2 am'  },
];

const CHRONOTYPES: { id: NonNullable<UserProfile['chronotype']>; label: string; icon: string }[] = [
  { id: 'morning',   label: 'Early morning (5–9 am)',  icon: 'sunny-outline'    },
  { id: 'midday',    label: 'Late morning (9–12)',     icon: 'partly-sunny-outline' },
  { id: 'afternoon', label: 'Afternoon (12–5 pm)',     icon: 'cafe-outline'     },
  { id: 'evening',   label: 'Evening (5–9 pm)',         icon: 'wine-outline'     },
  { id: 'night',     label: 'Late night (9 pm+)',       icon: 'moon-outline'     },
  { id: 'flexible',  label: 'Varies day to day',        icon: 'shuffle-outline'  },
];

const FOCUS_LENGTHS = [
  { id: 15, label: '15 min', hint: 'Quick sprints' },
  { id: 25, label: '25 min', hint: 'Classic Pomodoro' },
  { id: 45, label: '45 min', hint: 'Balanced block' },
  { id: 60, label: '60 min', hint: 'Deep focus' },
  { id: 90, label: '90 min', hint: 'Flow state' },
];

const BREAK_STYLES: { id: NonNullable<UserProfile['breakStyle']>; label: string; hint: string; mins: number }[] = [
  { id: 'short_frequent',  label: 'Short & frequent', hint: '5 min breaks',  mins: 5 },
  { id: 'balanced',        label: 'Balanced',         hint: '10 min breaks', mins: 10 },
  { id: 'long_infrequent', label: 'Long & infrequent',hint: '15 min breaks', mins: 15 },
  { id: 'no_break',        label: 'No breaks',        hint: 'Push straight through', mins: 0 },
];

const DISTRACTION_TRIGGERS = [
  { id: 'social',    label: 'Social media',  icon: 'people-outline'        },
  { id: 'video',     label: 'Videos / TV',   icon: 'play-circle-outline'   },
  { id: 'news',      label: 'News',          icon: 'newspaper-outline'     },
  { id: 'games',     label: 'Games',         icon: 'game-controller-outline' },
  { id: 'shopping',  label: 'Shopping',      icon: 'cart-outline'          },
  { id: 'messaging', label: 'Messaging',     icon: 'chatbubbles-outline'   },
];

const MOTIVATION_STYLES = [
  { id: 'streaks',    label: 'Streaks',         icon: 'flame-outline'    },
  { id: 'stats',      label: 'Stats & charts',  icon: 'stats-chart-outline' },
  { id: 'milestones', label: 'Milestones',      icon: 'trophy-outline'   },
  { id: 'quotes',     label: 'Daily quotes',    icon: 'chatbubble-ellipses-outline' },
];

const REVIEW_DAYS: { id: NonNullable<UserProfile['weeklyReviewDay']>; label: string }[] = [
  { id: 'sun', label: 'Sun' },
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
];

// ── App block suggestions removed per user request ────────────────────────────
// The previous occupation/goal/trigger → suggested-apps tables and the
// "Apps to consider blocking" section have been removed.  Distraction triggers
// are still captured in the profile for future use.

// ── Screen ────────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { state, updateSettings, addTask, deleteTask, refreshTasks } = useApp();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const isEditMode = navigation.canGoBack(); // came from settings — back is available
  // When opened from Settings the screen starts in read-only "view" mode and
  // the user has to tap the Edit pencil in the top bar to start editing.
  // During onboarding everything is editable from the first frame.
  const [isEditing, setIsEditing] = useState(!isEditMode);

  const existing = state.settings.userProfile ?? {};
  const [name, setName]           = useState(existing.name ?? '');
  const [occupation, setOccupation] = useState(existing.occupation ?? '');
  const [goalHours, setGoalHours] = useState(existing.dailyGoalHours ?? 4);
  const [wakeTime, setWakeTime]   = useState(existing.wakeUpTime ?? '');
  const [goals, setGoals]         = useState<string[]>(existing.focusGoals ?? []);
  const [saving, setSaving]       = useState(false);
  const [usageVisible, setUsageVisible] = useState(false);

  // ── Deeper-profile state ────────────────────────────────────────────────────
  const [sleepTime, setSleepTime]                 = useState(existing.sleepTime ?? '');
  const [chronotype, setChronotype]               = useState<UserProfile['chronotype'] | ''>(existing.chronotype ?? '');
  const [focusLength, setFocusLength]             = useState<number | null>(existing.focusSessionLength ?? null);
  const [breakStyle, setBreakStyle]               = useState<UserProfile['breakStyle'] | ''>(existing.breakStyle ?? '');
  const [triggers, setTriggers]                   = useState<string[]>(existing.distractionTriggers ?? []);
  const [motivation, setMotivation]               = useState<string[]>(existing.motivationStyle ?? []);
  const [reviewDay, setReviewDay]                 = useState<UserProfile['weeklyReviewDay'] | ''>(existing.weeklyReviewDay ?? '');

  // Personal-journey stats — only loaded in edit mode (returning user). On
  // first-run onboarding the DB is empty and this section stays hidden.
  const [stats, setStats] = useState<{
    todayMins: number;
    streak: number;
    bestStreak: number;
    allTimeMins: number;
    sessions: number;
  } | null>(null);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      try {
        const [todayMins, streak, bestStreak, allTimeMins, sessions] = await Promise.all([
          dbGetTodayFocusMinutes().catch(() => 0),
          dbGetStreak().catch(() => 0),
          dbGetBestStreak().catch(() => 0),
          dbGetAllTimeFocusMinutes().catch(() => 0),
          dbGetAllTimeFocusSessions().catch(() => 0),
        ]);
        if (!cancelled) setStats({ todayMins, streak, bestStreak, allTimeMins, sessions });
      } catch {
        // Non-fatal — section stays hidden.
      }
    })();
    return () => { cancelled = true; };
  }, [isEditMode]);

  // Computes today's progress toward the daily focus-hour goal and a short
  // motivational caption used in the journey panel.
  const goalProgress = useMemo(() => {
    if (!stats) return null;
    const targetMins = Math.max(1, goalHours * 60);
    const pct = Math.min(100, Math.round((stats.todayMins / targetMins) * 100));
    const remaining = Math.max(0, targetMins - stats.todayMins);
    const caption = pct >= 100
      ? `Daily goal hit — ${stats.todayMins}m focused today`
      : `${remaining}m to go to today's ${goalHours}h goal`;
    return { pct, caption };
  }, [stats, goalHours]);

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const profile: UserProfile = {
        name: name.trim() || undefined,
        occupation: occupation || undefined,
        dailyGoalHours: goalHours,
        wakeUpTime: wakeTime || undefined,
        focusGoals: goals.length > 0 ? goals : undefined,

        // Deeper-profile fields — undefined when unset so the JSON stays clean.
        sleepTime:           sleepTime || undefined,
        chronotype:          chronotype || undefined,
        focusSessionLength:  focusLength ?? undefined,
        breakStyle:          breakStyle || undefined,
        distractionTriggers: triggers.length > 0 ? triggers : undefined,
        motivationStyle:     motivation.length > 0 ? motivation : undefined,
        weeklyReviewDay:     reviewDay || undefined,
      };

      // Side-effects: deeper-profile fields that map directly to existing
      // app settings. Done here (not in a separate useEffect) so the user
      // gets one atomic save and a single confirmation.
      const settingsPatch: Partial<typeof state.settings> = {};
      if (focusLength) {
        settingsPatch.defaultDuration  = focusLength;
        settingsPatch.pomodoroDuration = focusLength;
      }
      if (breakStyle) {
        const bs = BREAK_STYLES.find((b) => b.id === breakStyle);
        if (bs) settingsPatch.pomodoroBreak = bs.mins;
      }

      const updated = {
        ...state.settings,
        ...settingsPatch,
        onboardingComplete: true,
        userProfile: profile,
      };
      await updateSettings(updated);

      // Mirror onboarding flag into SharedPreferences so it survives DB-file
      // wipes (some Android OEMs aggressively clear app private storage).
      // Restored by AppContext.init() on next launch.
      try { await SharedPrefsModule.putString('onboarding_complete', 'true'); } catch { /* non-fatal */ }

      // Schedule morning digest for tomorrow if a wake-up time is set.
      if (profile.wakeUpTime) {
        try {
          await scheduleMorningDigest(profile, state.tasks ?? []);
        } catch {
          // Non-fatal — notification permission may not be granted yet.
        }
      }

      // Schedule (or cancel) the weekly report notification using the day
      // the user just chose. Passing weeklyReportEnabled from current settings
      // so the master switch in Block Defense is respected.
      try {
        await scheduleWeeklyReport(profile, state.settings.weeklyReportEnabled ?? false);
      } catch {
        // Non-fatal.
      }

      if (isEditMode) {
        router.back();
      } else {
        // First-run flow: show the How-to-Use guide before dropping the user
        // on the home screen. The guide's "Get started" button takes them to /.
        router.replace('/how-to-use?onboarding=1');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (isEditMode) { router.back(); return; }
    // Mark onboarding done but don't save a profile
    try {
      await updateSettings({ ...state.settings, onboardingComplete: true });
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
      return;
    }
    try { await SharedPrefsModule.putString('onboarding_complete', 'true'); } catch { /* non-fatal */ }
    // Even when skipping the questionnaire, show the How-to-Use guide so the
    // brand-new user understands what the app does before landing on home.
    router.replace('/how-to-use?onboarding=1');
  };

  // ── Returning-user import shortcut ───────────────────────────────────────
  // Shown both during onboarding (so a user re-installing on a new phone can
  // skip the questionnaire entirely) and from the profile screen when opened
  // from Settings (so they can pull in a backup later).
  const [importBusy, setImportBusy] = useState(false);
  const handleImportFromBackup = async () => {
    if (importBusy) return;
    setImportBusy(true);
    try {
      const result = await pickAndImportBackup({
        updateSettings,
        addTask,
        deleteTask,
        refreshTasks,
        replaceTasks: false,
        currentTasks: state.tasks ?? [],
        currentSettings: state.settings,
      });
      if ('error' in result) {
        Alert.alert('Import failed', result.error);
        return;
      }
      // Mark onboarding done so the user lands on the home screen.
      await updateSettings({ ...state.settings, onboardingComplete: true });
      try { await SharedPrefsModule.putString('onboarding_complete', 'true'); } catch { /* non-fatal */ }
      Alert.alert(
        'Welcome back',
        `Settings ${result.settings ? 'restored' : 'unchanged'}.\nTasks imported: ${result.tasksImported}`,
        [{ text: 'OK', onPress: () => { if (!isEditMode) router.replace('/how-to-use?onboarding=1'); } }],
      );
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          {isEditMode ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={[styles.topTitle, { color: theme.text }]}>
            {isEditMode ? 'Your Profile' : 'Tell Us About You'}
          </Text>
          {!isEditMode && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
          {isEditMode && !isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="create-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          {isEditMode && isEditing && <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {!isEditMode && (
            <>
              {/* Returning-user shortcut: lets someone re-installing on a new
                  phone skip the entire questionnaire by importing their old
                  backup file. New users just keep scrolling. */}
              <View style={[styles.welcomeBanner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '33' }]}>
                <View style={styles.welcomeRow}>
                  <View style={[styles.welcomeIconCircle, { backgroundColor: COLORS.primary + '22' }]}>
                    <Ionicons name="sparkles" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.welcomeTitle, { color: theme.text }]}>New here, or returning?</Text>
                    <Text style={[styles.welcomeBody,  { color: theme.muted }]}>
                      Brand new — just answer the short questions below.
                      Coming back? Pull in your old backup and we'll skip the rest.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.welcomeBtn, { borderColor: COLORS.primary }, importBusy && { opacity: 0.5 }]}
                  onPress={handleImportFromBackup}
                  disabled={importBusy}
                >
                  <Ionicons name="cloud-download-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.welcomeBtnText, { color: COLORS.primary }]}>
                    {importBusy ? 'Importing…' : 'Import previous backup'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.intro, { color: theme.muted }]}>
                This helps FocusFlow personalise your daily summaries and weekly reports. Everything is stored locally — nothing is shared.
              </Text>
            </>
          )}

          {/* Your Journey — personal stats panel (edit mode only). Renders only
              once stats have loaded so first-time editors don't see a flash of
              zeros. Shows "today" + "all time" + a goal-progress caption. */}
          {isEditMode && stats && (stats.allTimeMins > 0 || stats.sessions > 0 || stats.streak > 0) && (
            <View style={[styles.journeyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.journeyHeader}>
                <Ionicons name="trophy-outline" size={18} color={COLORS.primary} />
                <Text style={[styles.journeyTitle, { color: theme.text }]}>
                  {name ? `${name}'s journey` : 'Your journey'}
                </Text>
              </View>

              <View style={styles.statRow}>
                <StatTile
                  icon="flame"
                  iconColor="#f97316"
                  label="Streak"
                  value={`${stats.streak}d`}
                  hint={stats.bestStreak > stats.streak ? `Best ${stats.bestStreak}d` : 'Keep going'}
                  theme={theme}
                />
                <StatTile
                  icon="time-outline"
                  iconColor={COLORS.primary}
                  label="Today"
                  value={formatHm(stats.todayMins)}
                  hint={goalProgress ? `${goalProgress.pct}% of goal` : ''}
                  theme={theme}
                />
              </View>

              <View style={styles.statRow}>
                <StatTile
                  icon="hourglass-outline"
                  iconColor="#10b981"
                  label="All time"
                  value={formatHm(stats.allTimeMins)}
                  hint={`${stats.sessions} session${stats.sessions === 1 ? '' : 's'}`}
                  theme={theme}
                />
                <StatTile
                  icon="ribbon-outline"
                  iconColor="#8b5cf6"
                  label="Best streak"
                  value={`${stats.bestStreak}d`}
                  hint={stats.bestStreak === stats.streak && stats.streak > 0 ? 'Personal best!' : 'Personal record'}
                  theme={theme}
                />
              </View>

              {goalProgress && (
                <View style={styles.goalRow}>
                  <View style={[styles.goalBarBg, { backgroundColor: COLORS.primaryLight }]}>
                    <View
                      style={[
                        styles.goalBarFill,
                        { width: `${goalProgress.pct}%`, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                  <Text style={[styles.goalCaption, { color: theme.muted }]}>{goalProgress.caption}</Text>
                </View>
              )}
            </View>
          )}

          {/* All editable form sections live inside this wrapper.  When the
              user is in view-mode (opened from Settings, hasn't tapped Edit),
              pointerEvents='none' lets touches fall through to the ScrollView
              so scrolling still works but no field can be tapped. */}
          <View pointerEvents={isEditing ? 'auto' : 'none'} style={{ opacity: isEditing ? 1 : 0.55, gap: SPACING.xl }}>

          {/* Name */}
          <FormSection title="What's your name?">
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. Alex"
              placeholderTextColor={theme.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={40}
            />
          </FormSection>

          {/* Occupation */}
          <FormSection title="What best describes you?">
            <View style={styles.chipGrid}>
              {OCCUPATIONS.map((o) => {
                const selected = occupation === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setOccupation(selected ? '' : o.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={o.icon as any} size={15} color={selected ? '#fff' : theme.muted} />
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* Daily focus goal */}
          <FormSection title="Daily focus goal (hours)">
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setGoalHours((h) => Math.max(1, h - 1))}
                hitSlop={8}
              >
                <Ionicons name="remove" size={20} color={theme.text} />
              </TouchableOpacity>
              <View style={[styles.stepValue, { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary + '44' }]}>
                <Text style={styles.stepValueText}>{goalHours}h</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setGoalHours((h) => Math.min(16, h + 1))}
                hitSlop={8}
              >
                <Ionicons name="add" size={20} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.stepHint, { color: theme.muted }]}>
                FocusFlow will track your daily progress toward this goal.
              </Text>
            </View>
          </FormSection>

          {/* Wake-up time */}
          <FormSection title="When do you usually wake up?">
            <View style={styles.chipRow}>
              {WAKE_UP_TIMES.map((t) => {
                const selected = wakeTime === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setWakeTime(selected ? '' : t.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* Focus goals */}
          <FormSection title="What are your main focus goals?">
            <Text style={[styles.multiHint, { color: theme.muted }]}>Select all that apply</Text>
            <View style={styles.chipGrid}>
              {FOCUS_GOALS.map((g) => {
                const selected = goals.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => toggleGoal(g.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={g.icon as any} size={15} color={selected ? '#fff' : theme.muted} />
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{g.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* ── Deeper profile sections ──────────────────────────────────── */}

          {/* Sleep time */}
          <FormSection title="When do you usually go to sleep?">
            <Text style={[styles.multiHint, { color: theme.muted }]}>
              We pair this with your wake time to know your available focus hours.
            </Text>
            <View style={styles.chipRow}>
              {SLEEP_TIMES.map((t) => {
                const selected = sleepTime === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setSleepTime(selected ? '' : t.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* Chronotype */}
          <FormSection title="When do you focus best?">
            <Text style={[styles.multiHint, { color: theme.muted }]}>
              Helps us suggest the right time slots for deep work.
            </Text>
            <View style={styles.chipGrid}>
              {CHRONOTYPES.map((c) => {
                const selected = chronotype === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setChronotype(selected ? '' : c.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={c.icon as any} size={15} color={selected ? '#fff' : theme.muted} />
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* Preferred focus session length */}
          <FormSection title="Your ideal focus block">
            <Text style={[styles.multiHint, { color: theme.muted }]}>
              We'll set this as your default for new tasks and Pomodoro sessions.
            </Text>
            <View style={styles.chipRow}>
              {FOCUS_LENGTHS.map((f) => {
                const selected = focusLength === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setFocusLength(selected ? null : f.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {focusLength != null && (
              <Text style={[styles.multiHint, { color: theme.muted, marginTop: 4 }]}>
                {FOCUS_LENGTHS.find((f) => f.id === focusLength)?.hint}
              </Text>
            )}
          </FormSection>

          {/* Break style */}
          <FormSection title="How do you like to break?">
            <View style={styles.chipGrid}>
              {BREAK_STYLES.map((b) => {
                const selected = breakStyle === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setBreakStyle(selected ? '' : b.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{b.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {breakStyle && (
              <Text style={[styles.multiHint, { color: theme.muted, marginTop: 4 }]}>
                {BREAK_STYLES.find((b) => b.id === breakStyle)?.hint}
              </Text>
            )}
          </FormSection>

          {/* Distraction triggers */}
          <FormSection title="What pulls you off track most?">
            <Text style={[styles.multiHint, { color: theme.muted }]}>
              Select all that apply. Helps the app recognise the patterns you struggle with most.
            </Text>
            <View style={styles.chipGrid}>
              {DISTRACTION_TRIGGERS.map((t) => {
                const selected = triggers.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setTriggers((prev) => prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id])}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={t.icon as any} size={15} color={selected ? '#fff' : theme.muted} />
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* Motivation style */}
          <FormSection title="What motivates you?">
            <Text style={[styles.multiHint, { color: theme.muted }]}>
              We'll lean into the styles you pick across the app.
            </Text>
            <View style={styles.chipGrid}>
              {MOTIVATION_STYLES.map((m) => {
                const selected = motivation.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setMotivation((prev) => prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id])}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={m.icon as any} size={15} color={selected ? '#fff' : theme.muted} />
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          {/* Weekly review day */}
          <FormSection title="Weekly review day">
            <Text style={[styles.multiHint, { color: theme.muted }]}>
              We'll send a recap of your week on this day.
            </Text>
            <View style={styles.chipRow}>
              {REVIEW_DAYS.map((d) => {
                const selected = reviewDay === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.chip, selected && styles.chipSelected, { borderColor: selected ? COLORS.primary : theme.border, backgroundColor: selected ? COLORS.primary : theme.card }]}
                    onPress={() => setReviewDay(selected ? '' : d.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipLabel, { color: selected ? '#fff' : theme.text }]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormSection>

          </View>
          {/* /editable-form-wrapper */}

          {/* "How your profile is used" — tappable link that opens a detail sheet */}
          <TouchableOpacity
            style={[styles.usageLink, { borderColor: theme.border }]}
            onPress={() => setUsageVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
            <Text style={[styles.usageLinkText, { color: theme.text }]}>How your information is used</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>

          {/* Usage detail modal */}
          <Modal visible={usageVisible} animationType="slide" transparent onRequestClose={() => setUsageVisible(false)}>
            <View style={styles.usageModalBackdrop}>
              <View style={[styles.usageModalSheet, { backgroundColor: theme.card }]}>
                <View style={[styles.usageModalHeader, { borderBottomColor: theme.border }]}>
                  <View style={styles.usageHeader}>
                    <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
                    <Text style={[styles.usageTitle, { color: theme.text }]}>How your profile is used</Text>
                  </View>
                  <TouchableOpacity onPress={() => setUsageVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={theme.muted} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: SPACING.md }}>
                  <UsageRow icon="time-outline" label="Daily focus goal" value={`${goalHours}h`} detail="Tracked on the Stats screen and on your home-screen widget." theme={theme} />
                  <UsageRow icon="sunny-outline" label="Wake-up time" value={wakeTime ? formatWake(wakeTime) : 'Not set'} detail={wakeTime ? "A morning digest notification fires at this time with today's plan." : 'Set a wake-up time to get a morning plan notification.'} theme={theme} />
                  <UsageRow icon="briefcase-outline" label="Occupation" value={occupation ? labelFor(OCCUPATIONS, occupation) : 'Not set'} detail={occupation ? 'Helps tailor your morning digest tone and stats labels to your work pattern.' : 'Pick one so we can tailor the app to your routine.'} theme={theme} />
                  <UsageRow icon="flag-outline" label="Focus goals" value={goals.length > 0 ? `${goals.length} selected` : 'None'} detail={goals.length > 0 ? `Used to label your focus blocks in stats and recaps.` : 'Add goals so we can group and label your focus time.'} theme={theme} />
                  <UsageRow icon="person-circle-outline" label="Name" value={name || 'Not set'} detail={name ? 'Used in your morning digest greeting and journey panel.' : 'Add a name to personalise your morning digest.'} theme={theme} />
                  <UsageRow icon="moon-outline" label="Sleep time" value={sleepTime ? formatTimeId(sleepTime) : 'Not set'} detail={sleepTime ? "Defines your available focus window with wake time." : "Add a sleep time to define your day's focus window."} theme={theme} />
                  <UsageRow icon="sunny-outline" label="Best focus time" value={chronotype ? labelForChronotype(chronotype) : 'Not set'} detail={chronotype ? 'Used to suggest the best slots when you create new tasks.' : 'Tell us when you focus best for smarter task scheduling.'} theme={theme} />
                  <UsageRow icon="hourglass-outline" label="Ideal focus block" value={focusLength ? `${focusLength} min` : 'Not set'} detail={focusLength ? 'Used as the default duration for new tasks and Pomodoro sessions.' : "Pick a length and we'll use it as your default for new tasks."} theme={theme} />
                  <UsageRow icon="pause-circle-outline" label="Break style" value={breakStyle ? (BREAK_STYLES.find((b) => b.id === breakStyle)?.label ?? '') : 'Not set'} detail={breakStyle ? `Sets your Pomodoro break length (${BREAK_STYLES.find((b) => b.id === breakStyle)?.mins ?? 0} min).` : 'Pick a style to set your default Pomodoro break length.'} theme={theme} />
                  <UsageRow icon="ban-outline" label="Distraction triggers" value={triggers.length > 0 ? `${triggers.length} selected` : 'None'} detail={triggers.length > 0 ? 'Recorded so future features can reference what derails you most.' : 'Pick what derails you most so the app can adapt over time.'} theme={theme} />
                  <UsageRow icon="trophy-outline" label="Motivation style" value={motivation.length > 0 ? `${motivation.length} selected` : 'None'} detail={motivation.length > 0 ? 'Drives which gamification we surface most.' : 'Pick what motivates you so we lean into it across the app.'} theme={theme} />
                  <UsageRow icon="calendar-outline" label="Weekly review day" value={reviewDay ? labelForDay(reviewDay) : 'Not set'} detail={reviewDay ? 'A weekly recap notification will fire on this day.' : 'Pick a day to receive your weekly recap.'} theme={theme} isLast />
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Save button — only shown while the form is editable.  In view
              mode (opened from Settings, Edit pencil not yet tapped) we hide
              it so the screen reads as a profile summary rather than a form. */}
          {isEditing && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Save & Continue →'}
              </Text>
            </TouchableOpacity>
          )}

          {!isEditMode && (
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipLink}>
              <Text style={styles.skipLinkText}>Skip for now — I'll set this up later in Settings</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

interface ThemeShape {
  text: string;
  muted: string;
  card: string;
  border: string;
  background: string;
}

function StatTile({
  icon, iconColor, label, value, hint, theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  hint: string;
  theme: ThemeShape;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.statTopRow}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      {!!hint && <Text style={[styles.statHint, { color: theme.muted }]}>{hint}</Text>}
    </View>
  );
}

function UsageRow({
  icon, label, value, detail, theme, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail: string;
  theme: ThemeShape;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.usageRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <View style={[styles.usageIconWrap, { backgroundColor: COLORS.primaryLight }]}>
        <Ionicons name={icon} size={14} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.usageRowTop}>
          <Text style={[styles.usageLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.usageValue, { color: COLORS.primary }]}>{value}</Text>
        </View>
        <Text style={[styles.usageDetail, { color: theme.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

// ── Small formatters ───────────────────────────────────────────────────────────

function formatHm(mins: number): string {
  if (mins <= 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatWake(id: string): string {
  // The WAKE_UP_TIMES values are ids like "07:00" — find the friendly label.
  return WAKE_UP_TIMES.find((t) => t.id === id)?.label ?? id;
}

function labelFor(items: { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label ?? id;
}

// Generic "HH:MM" → friendly label fallback used by sleep time and any other
// time fields that don't have a dedicated lookup table.
function formatTimeId(id: string): string {
  const fromSleep = SLEEP_TIMES.find((t) => t.id === id)?.label;
  if (fromSleep) return fromSleep;
  const fromWake = WAKE_UP_TIMES.find((t) => t.id === id)?.label;
  if (fromWake) return fromWake;
  return id;
}

function labelForChronotype(id: NonNullable<UserProfile['chronotype']>): string {
  return CHRONOTYPES.find((c) => c.id === id)?.label ?? id;
}

function labelForDay(id: NonNullable<UserProfile['weeklyReviewDay']>): string {
  return REVIEW_DAYS.find((d) => d.id === id)?.label ?? id;
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: FONT.md, fontWeight: '800' },
  skipBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  skipText: { color: COLORS.primary, fontSize: FONT.sm, fontWeight: '700' },
  content: { padding: SPACING.lg, paddingBottom: 56, gap: SPACING.xl },
  intro: { fontSize: FONT.sm, lineHeight: 20 },

  welcomeBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  welcomeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  welcomeIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeTitle: { fontSize: FONT.md, fontWeight: '800' },
  welcomeBody: { fontSize: FONT.xs, lineHeight: 16, marginTop: 2 },
  welcomeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  welcomeBtnText: { fontSize: FONT.sm, fontWeight: '700' },
  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: FONT.md, fontWeight: '800' },
  textInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    height: 48,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipSelected: {},
  chipLabel: { fontSize: FONT.sm, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 64,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  stepValueText: { fontSize: FONT.lg, fontWeight: '900', color: COLORS.primary },
  stepHint: { flex: 1, fontSize: FONT.xs, lineHeight: 16 },
  multiHint: { fontSize: FONT.xs, marginTop: -SPACING.xs },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: SPACING.xs,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.md, fontWeight: '800' },
  skipLink: { alignItems: 'center', paddingVertical: SPACING.xs },
  skipLinkText: { color: COLORS.muted, fontSize: FONT.xs, textAlign: 'center' },
  // ── Journey card (personal stats panel) ────────────────────────────────
  journeyCard: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  journeyTitle: { fontSize: FONT.md, fontWeight: '800' },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statTile: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    gap: 2,
  },
  statTopRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: FONT.lg, fontWeight: '900' },
  statHint: { fontSize: 10, marginTop: 1 },
  goalRow: { gap: 4, marginTop: SPACING.xs },
  goalBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: 6, borderRadius: 3 },
  goalCaption: { fontSize: 11, fontWeight: '600' },

  // ── "How your profile is used" link + modal ─────────────────────────────
  usageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  usageLinkText: { flex: 1, fontSize: FONT.sm, fontWeight: '600' },
  usageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  usageModalSheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '88%',
  },
  usageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageTitle: { fontSize: FONT.md, fontWeight: '800' },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  usageIconWrap: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginTop: 1,
  },
  usageRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  usageLabel: { fontSize: FONT.sm, fontWeight: '700' },
  usageValue: { fontSize: FONT.xs, fontWeight: '800' },
  usageDetail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
});
