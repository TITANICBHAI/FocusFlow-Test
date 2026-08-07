import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Appearance } from 'react-native';
import type { AppSettings, DailyAllowanceEntry, RecurringBlockSchedule, GreyoutWindow } from '@/data/types';
import {
  dbGetSettings,
  dbSaveSettings,
} from '@/data/db';
import { SharedPrefsModule, SP_KEYS } from '@/native-modules/SharedPrefsModule';
import { AversionsModule } from '@/native-modules/AversionsModule';
import { GreyoutModule } from '@/native-modules/GreyoutModule';
import { NetworkBlockModule } from '@/native-modules/NetworkBlockModule';
import { logger } from '@/services/startupLogger';
import { initI18n } from '@/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
}

type SettingsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SETTINGS'; payload: AppSettings };

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload, isLoading: false };
    default:
      return state;
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (settings: AppSettings, dirtyGroups?: string[]) => Promise<void>;
  setStandaloneBlock: (packages: string[], untilMs: number | null, pinHash?: string | null) => Promise<void>;
  setStandaloneBlockAndAllowance: (packages: string[], untilMs: number | null, allowanceEntries: DailyAllowanceEntry[], vpnPackages?: string[], pinHash?: string | null) => Promise<void>;
  setDailyAllowanceEntries: (entries: DailyAllowanceEntry[]) => Promise<void>;
  setBlockedWords: (words: string[]) => Promise<void>;
  setRecurringBlockSchedules: (schedules: RecurringBlockSchedule[]) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const defaultSettings: AppSettings = {
  darkMode: Appearance.getColorScheme() === 'dark',
  defaultDuration: 60,
  defaultReminderOffsets: [-10, -5, 0],
  focusModeEnabled: true,
  allowedInFocus: [],
  allowedAppPresets: [],
  blockPresets: [],
  pomodoroEnabled: false,
  pomodoroDuration: 25,
  pomodoroBreak: 5,
  notificationsEnabled: true,
  privacyAccepted: false,
  onboardingComplete: false,
  standaloneBlockPackages: [],
  standaloneBlockUntil: null,
  alwaysOnPackages: [],
  autoCopyToAlwaysOn: false,
  dailyAllowanceEntries: [],
  blockedWords: [],
  aversionDimmerEnabled: false,
  aversionVibrateEnabled: false,
  aversionSoundEnabled: false,
  weeklyReportEnabled: false,
  greyoutSchedule: [],
  systemGuardEnabled: false,
  blockInstallActionsEnabled: false,
  blockYoutubeShortsEnabled: false,
  blockInstagramReelsEnabled: false,
  vpnBlockEnabled: false,
  standaloneVpnPackages: [],
  keepFocusActiveUntilTaskEnd: false,
  vpnSelfHealEnabled: true,
  launcherEnabled: false,
  launcherHiddenPackages: [],
  launcherPinnedPackages: [],
  launcherDockPackages: [],
  launcherWallpaperUri: null,
  launcherClockStyle: 'digital' as const,
  launcherBlockUninstall: false,
  launcherLockDuringStandalone: true,
  overlayWallpaper: '',
  overlayQuotes: [],
  recurringBlockSchedules: [],
};

const initialSettingsState: SettingsState = {
  settings: defaultSettings,
  isLoading: true,
};

// ─── Helper: selective SP sync ────────────────────────────────────────────────

type SyncGroup =
  | 'standaloneBlock'
  | 'dailyAllowance'
  | 'alwaysBlock'
  | 'blockedWords'
  | 'aversions'
  | 'greyoutSchedule'
  | 'systemGuard'
  | 'launcher'
  | 'all';

const GROUP_TO_SYNC_FN: Record<Exclude<SyncGroup, 'all'>, (settings: AppSettings) => Promise<void>> = {
  standaloneBlock: _syncStandaloneBlock,
  dailyAllowance: _syncDailyAllowance,
  alwaysBlock: _syncAlwaysBlock,
  blockedWords: _syncBlockedWords,
  aversions: _syncAversions,
  greyoutSchedule: _syncGreyoutSchedule,
  systemGuard: _syncSystemGuard,
  launcher: _syncLauncher,
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, initialSettingsState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Initialize settings from DB + SP ────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Fast SP read for enforcement-critical fields
        let spSnapshot: Partial<AppSettings> = {};
        try {
          spSnapshot = await SharedPrefsModule.getAllEnforcementSettings();
        } catch (e) {
          void logger.warn('SettingsProvider', `[SP_READ] Failed: ${String(e)}`);
        }
        dispatch({ type: 'SET_SETTINGS', payload: { ...defaultSettings, ...spSnapshot } });

        // DB read with timeout
        let rawSettings = defaultSettings;
        let dbSucceeded = false;
        try {
          const timeoutGate = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
          const race = await Promise.race([
            dbGetSettings().then((s) => ({ ok: true as const, s })).catch(() => ({ ok: false as const, s: defaultSettings })),
            timeoutGate.then(() => ({ ok: false as const, s: defaultSettings })),
          ]);
          if (race.ok) {
            rawSettings = race.s;
            dbSucceeded = true;
          }
        } catch {}

        // Merge: DB wins on success, SP wins on timeout
        let settings: AppSettings = dbSucceeded
          ? { ...spSnapshot, ...rawSettings }
          : { ...defaultSettings, ...spSnapshot };

        // Cross-check privacy/onboarding with SP backup
        let restoredFromSp = false;
        if (!rawSettings.privacyAccepted) {
          try {
            const spValue = await SharedPrefsModule.getString(SP_KEYS.PRIVACY_ACCEPTED);
            if (spValue === 'true') {
              settings = { ...settings, privacyAccepted: true };
              restoredFromSp = true;
            }
          } catch {}
        }
        if (!rawSettings.onboardingComplete) {
          try {
            const spValue = await SharedPrefsModule.getString(SP_KEYS.ONBOARDING_COMPLETE);
            if (spValue === 'true') {
              settings = { ...settings, onboardingComplete: true };
              restoredFromSp = true;
            }
          } catch {}
        }
        if (restoredFromSp) {
          try { await dbSaveSettings(settings); } catch {}
        }

        // Apply language
        try { initI18n(settings.language ?? null); } catch {}

        dispatch({ type: 'SET_SETTINGS', payload: settings });

        // Initial native sync (all groups)
        await syncGroups(settings, ['standaloneBlock', 'dailyAllowance', 'alwaysBlock', 'blockedWords', 'aversions', 'greyoutSchedule', 'systemGuard', 'launcher']);
      } catch (e) {
        void logger.error('SettingsProvider', `init failed: ${String(e)}`);
        dispatch({ type: 'SET_SETTINGS', payload: defaultSettings });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    init();
  }, []);

  // ── Selective sync helper ──────────────────────────────────────────────────
  async function syncGroups(settings: AppSettings, groups: SyncGroup[]) {
    for (const group of groups) {
      if (group === 'all') {
        await Promise.all(Object.values(GROUP_TO_SYNC_FN).map(fn => fn(settings).catch(() => {})));
      } else {
        await GROUP_TO_SYNC_FN[group](settings).catch(() => {});
      }
    }
  }

  // ── updateSettings with dirtyGroups ────────────────────────────────────────
  const updateSettings = useCallback(async (nextSettings: AppSettings, dirtyGroups?: string[]) => {
    dispatch({ type: 'SET_SETTINGS', payload: nextSettings });
    // Selective sync based on dirty groups
    const groupsToSync = dirtyGroups && dirtyGroups.length > 0
      ? dirtyGroups as SyncGroup[]
      : ['all' as const];
    await syncGroups(nextSettings, groupsToSync);
    try { await dbSaveSettings(nextSettings); } catch {}
  }, []);

  // ── Standalone block ───────────────────────────────────────────────────────
  const setStandaloneBlock = useCallback(async (packages: string[], untilMs: number | null, pinHash?: string | null) => {
    const current = stateRef.current.settings;
    const next = { ...current, standaloneBlockPackages: packages, standaloneBlockUntil: untilMs ? new Date(untilMs).toISOString() : null };
    await updateSettings(next, ['standaloneBlock']);
  }, [updateSettings]);

  const setStandaloneBlockAndAllowance = useCallback(async (
    packages: string[], untilMs: number | null, allowanceEntries: DailyAllowanceEntry[], vpnPackages?: string[], pinHash?: string | null
  ) => {
    const current = stateRef.current.settings;
    const next = {
      ...current,
      standaloneBlockPackages: packages,
      standaloneBlockUntil: untilMs ? new Date(untilMs).toISOString() : null,
      dailyAllowanceEntries: allowanceEntries,
      standaloneVpnPackages: vpnPackages ?? current.standaloneVpnPackages,
    };
    await updateSettings(next, ['standaloneBlock', 'dailyAllowance']);
  }, [updateSettings]);

  const setDailyAllowanceEntries = useCallback(async (entries: DailyAllowanceEntry[]) => {
    const current = stateRef.current.settings;
    const next = { ...current, dailyAllowanceEntries: entries };
    await updateSettings(next, ['dailyAllowance']);
  }, [updateSettings]);

  const setBlockedWords = useCallback(async (words: string[]) => {
    const current = stateRef.current.settings;
    const next = { ...current, blockedWords: words };
    await updateSettings(next, ['blockedWords']);
  }, [updateSettings]);

  const setRecurringBlockSchedules = useCallback(async (schedules: RecurringBlockSchedule[]) => {
    const current = stateRef.current.settings;
    const next = { ...current, recurringBlockSchedules: schedules };
    await updateSettings(next, ['greyoutSchedule']);
  }, [updateSettings]);

  const value: SettingsContextValue = useMemo(
    () => ({
      settings: state.settings,
      isLoading: state.isLoading,
      updateSettings,
      setStandaloneBlock,
      setStandaloneBlockAndAllowance,
      setDailyAllowanceEntries,
      setBlockedWords,
      setRecurringBlockSchedules,
    }),
    [
      state.settings,
      state.isLoading,
      updateSettings,
      setStandaloneBlock,
      setStandaloneBlockAndAllowance,
      setDailyAllowanceEntries,
      setBlockedWords,
      setRecurringBlockSchedules,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// ─── Sync functions (extracted from AppContext) ──────────────────────────────

async function _syncDailyAllowance(settings: AppSettings): Promise<void> {
  const entries = settings.dailyAllowanceEntries ?? [];
  try {
    await SharedPrefsModule.setDailyAllowanceConfig(entries);
  } catch (e) {
    void logger.warn('SettingsProvider', `daily allowance sync failed: ${String(e)}`);
  }
}

async function _syncAlwaysBlock(settings: AppSettings): Promise<void> {
  const packages = settings.alwaysOnPackages ?? [];
  const allowanceEntries = settings.dailyAllowanceEntries ?? [];
  const enforcementOn = settings.alwaysOnEnforcementEnabled !== false;
  const active = enforcementOn && (packages.length > 0 || allowanceEntries.length > 0);
  try {
    await SharedPrefsModule.setAlwaysBlockActive(active, packages);
  } catch (e) {
    void logger.warn('SettingsProvider', `always block sync failed: ${String(e)}`);
  }
}

async function _syncBlockedWords(settings: AppSettings): Promise<void> {
  const words = settings.blockedWords ?? [];
  try {
    await SharedPrefsModule.setBlockedWords(words);
  } catch (e) {
    void logger.warn('SettingsProvider', `blocked words sync failed: ${String(e)}`);
  }
}

async function _syncAversions(settings: AppSettings): Promise<void> {
  try {
    await AversionsModule.setSettings({
      dimmerEnabled: settings.aversionDimmerEnabled ?? false,
      vibrateEnabled: settings.aversionVibrateEnabled ?? false,
      soundEnabled: settings.aversionSoundEnabled ?? false,
      weeklyReportEnabled: settings.weeklyReportEnabled ?? false,
    });
  } catch (e) {
    void logger.warn('SettingsProvider', `aversions sync failed: ${String(e)}`);
  }
}

async function _syncGreyoutSchedule(settings: AppSettings): Promise<void> {
  try {
    const activeWindows = (settings.greyoutSchedule ?? []).filter((w) => w.enabled !== false);
    await GreyoutModule.setSchedule(activeWindows);
  } catch (e) {
    void logger.warn('SettingsProvider', `greyout sync failed: ${String(e)}`);
  }
}

async function _syncSystemGuard(settings: AppSettings): Promise<void> {
  try {
    await SharedPrefsModule.setSystemGuardEnabled(settings.systemGuardEnabled ?? false);
  } catch (e) {
    void logger.warn('SettingsProvider', `system guard sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setBlockYoutubeShortsEnabled(settings.blockYoutubeShortsEnabled ?? false);
  } catch (e) {
    void logger.warn('SettingsProvider', `youtube-shorts guard sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setBlockInstagramReelsEnabled(settings.blockInstagramReelsEnabled ?? false);
  } catch (e) {
    void logger.warn('SettingsProvider', `instagram-reels guard sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setNetworkBlockEnabled(settings.vpnBlockEnabled ?? false);
  } catch (e) {
    void logger.warn('SettingsProvider', `vpn block enabled sync failed: ${String(e)}`);
  }
  try {
    const alwaysOnVpnPkgs = settings.alwaysOnVpnPackages ?? [];
    const sessionVpnPkgs = settings.standaloneVpnPackages ?? [];
    const mergedVpnPkgs = Array.from(new Set([...alwaysOnVpnPkgs, ...sessionVpnPkgs]));
    await SharedPrefsModule.setVpnSelectedPackages(mergedVpnPkgs);
  } catch (e) {
    void logger.warn('SettingsProvider', `vpn selected packages sync failed: ${String(e)}`);
  }
  try {
    await NetworkBlockModule.setVpnSelfHealEnabled(settings.vpnSelfHealEnabled ?? false);
  } catch (e) {
    void logger.warn('SettingsProvider', `vpn self-heal sync failed: ${String(e)}`);
  }
  // Always-on VPN
  try {
    const alwaysOnVpnPkgs = settings.alwaysOnVpnPackages ?? [];
    if ((settings.vpnBlockEnabled ?? false) && alwaysOnVpnPkgs.length > 0) {
      void NetworkBlockModule.startNetworkBlock(JSON.stringify(alwaysOnVpnPkgs)).catch((e) =>
        void logger.warn('SettingsProvider', `always-on VPN start failed: ${String(e)}`),
      );
    }
  } catch (e) {
    void logger.warn('SettingsProvider', `always-on VPN start failed: ${String(e)}`);
  }
}

async function _syncLauncher(settings: AppSettings): Promise<void> {
  try {
    await SharedPrefsModule.setLauncherHiddenPackages(settings.launcherHiddenPackages ?? []);
  } catch (e) {
    void logger.warn('SettingsProvider', `launcher hidden packages sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setLauncherDockPackages(settings.launcherDockPackages ?? []);
  } catch (e) {
    void logger.warn('SettingsProvider', `launcher dock packages sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setLauncherLockDuringStandalone(settings.launcherLockDuringStandalone ?? true);
  } catch (e) {
    void logger.warn('SettingsProvider', `launcher lock sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setLauncherBlockUninstall(settings.launcherBlockUninstall ?? false);
  } catch (e) {
    void logger.warn('SettingsProvider', `launcher block uninstall sync failed: ${String(e)}`);
  }
  try {
    await SharedPrefsModule.setLauncherClockStyle((settings.launcherClockStyle ?? 'digital') as 'digital' | 'analog');
  } catch (e) {
    void logger.warn('SettingsProvider', `launcher clock style sync failed: ${String(e)}`);
  }
}

async function _syncStandaloneBlock(settings: AppSettings): Promise<void> {
  const { standaloneBlockPackages, standaloneBlockUntil } = settings;
  const packages = standaloneBlockPackages ?? [];
  if (packages.length === 0 || !standaloneBlockUntil) {
    try {
      await SharedPrefsModule.setStandaloneBlock(false, [], 0);
    } catch (e) {
      void logger.warn('SettingsProvider', `standalone block clear failed: ${String(e)}`);
    }
    return;
  }
  const untilMs = new Date(standaloneBlockUntil).getTime();
  if (untilMs <= Date.now()) {
    // Timer expired: clear the timed session
    try {
      await SharedPrefsModule.setStandaloneBlock(false, packages, 0);
    } catch (e) {
      void logger.warn('SettingsProvider', `expired standalone block clear failed: ${String(e)}`);
    }
    let updatedAlwaysOn = settings.alwaysOnPackages ?? [];
    if ((settings.autoCopyToAlwaysOn ?? false) && packages.length > 0) {
      const toRemove = new Set(packages);
      updatedAlwaysOn = updatedAlwaysOn.filter((p) => !toRemove.has(p));
    }
    const cleared = { ...settings, standaloneBlockUntil: null, alwaysOnPackages: updatedAlwaysOn };
    try { await dbSaveSettings(cleared); } catch {}
    // Re-sync always-on after expiry
    try { await _syncAlwaysBlock(cleared); } catch {}
  } else {
    try {
      await SharedPrefsModule.setStandaloneBlock(true, packages, untilMs);
    } catch (e) {
      void logger.warn('SettingsProvider', `standalone block sync failed: ${String(e)}`);
    }
  }
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return ctx;
}