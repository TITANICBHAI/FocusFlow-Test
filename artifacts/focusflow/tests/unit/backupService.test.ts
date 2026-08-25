import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('@/data/database', () => ({
  dbGetAllTasks: vi.fn(async () => []),
  dbGetActiveFocusSession: vi.fn(async () => null),
}));

vi.mock('@/native-modules/NativeFilePickerModule', () => ({
  NativeFilePickerModule: {
    pickFile: vi.fn(),
    saveFile: vi.fn(),
  },
}));

import {
  BACKUP_ENVELOPE_KIND,
  buildBackupJson,
  parseBackupJson,
  restoreFromJson,
} from '@/services/backupService';
import type { AppSettings } from '@/data/types';

const settings = {
  darkMode: false,
  defaultDuration: 25,
  defaultReminderOffsets: [-10, 0],
  focusModeEnabled: true,
  allowedInFocus: ['com.android.dialer'],
  pomodoroEnabled: true,
  pomodoroDuration: 25,
  pomodoroBreak: 5,
  notificationsEnabled: true,
  onboardingComplete: true,
  privacyAccepted: true,
  standaloneBlockPackages: ['com.example.blocked'],
  standaloneBlockUntil: '2026-08-24T13:00:00.000Z',
  standaloneVpnPackages: ['com.example.blocked'],
  autoCopiedAlwaysOnPackages: ['com.example.blocked'],
  alwaysOnPackages: ['com.example.always'],
  alwaysOnVpnPackages: [],
  dailyAllowanceEntries: [
    {
      packageName: 'com.example.social',
      mode: 'count',
      countPerDay: 2,
      budgetMinutes: 30,
      intervalMinutes: 5,
      intervalHours: 1,
    },
  ],
  blockedWords: ['spoiler'],
  allowedAppPresets: [],
  blockPresets: [],
  aversionDimmerEnabled: true,
  aversionVibrateEnabled: false,
  aversionSoundEnabled: false,
  weeklyReportEnabled: true,
  greyoutSchedule: [],
  systemGuardEnabled: true,
  blockInstallActionsEnabled: true,
  blockYoutubeShortsEnabled: false,
  blockInstagramReelsEnabled: false,
  vpnBlockEnabled: true,
  vpnSelfHealEnabled: true,
  autoCopyToAlwaysOn: true,
  pinProtectionEnabled: true,
  launcherEnabled: true,
  keepFocusActiveUntilTaskEnd: false,
  recurringBlockSchedules: [],
} as AppSettings;

describe('backupService contracts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects invalid JSON, wrong formats, and missing required sections', () => {
    expect(parseBackupJson('{')).toEqual({
      ok: false,
      error: expect.stringContaining('valid JSON'),
    });
    expect(parseBackupJson(JSON.stringify({ kind: 'Other', settings: {}, tasks: [] }))).toEqual({
      ok: false,
      error: expect.stringContaining('Unsupported format'),
    });
    expect(parseBackupJson(JSON.stringify({ kind: BACKUP_ENVELOPE_KIND, settings: {} }))).toEqual({
      ok: false,
      error: 'Backup is missing task data.',
    });
  });

  it('accepts a versioned envelope with settings and task data', () => {
    const result = parseBackupJson(JSON.stringify({
      kind: BACKUP_ENVELOPE_KIND,
      version: 1,
      exportedAt: '2026-08-24T12:00:00.000Z',
      exportedAtHuman: '8/24/2026',
      platform: { os: 'web' },
      settings: {},
      tasks: [],
      presetSections: [],
      summary: {
        taskCount: 0,
        blockedWordCount: 0,
        greyoutWindowCount: 0,
        dailyAllowanceCount: 0,
      },
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.kind).toBe(BACKUP_ENVELOPE_KIND);
      expect(result.envelope.tasks).toEqual([]);
    }
  });

  it('exports tasks and portable configuration without live enforcement state', async () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));

    const envelope = JSON.parse(await buildBackupJson(settings, '1.0.9'));

    expect(envelope.kind).toBe(BACKUP_ENVELOPE_KIND);
    expect(envelope.appVersion).toBe('1.0.9');
    expect(envelope.platform.os).toBe('web');
    expect(envelope.tasks).toEqual([]);
    expect(envelope.summary).toEqual({
      taskCount: 0,
      blockedWordCount: 1,
      greyoutWindowCount: 0,
      dailyAllowanceCount: 1,
    });
    expect(envelope.settings).not.toHaveProperty('focusModeEnabled');
    expect(envelope.settings).not.toHaveProperty('standaloneBlockUntil');
    expect(envelope.settings.allowedInFocus).toEqual(['com.android.dialer']);
    expect(envelope.presetSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'standalone-block', configured: true }),
        expect.objectContaining({ id: 'daily-allowance', configured: true, itemCount: 1 }),
        expect.objectContaining({ id: 'keyword-blocker', configured: true, itemCount: 1 }),
      ]),
    );
  });

  it('refuses replacement restore during an active focus session', async () => {
    const result = await restoreFromJson(JSON.stringify({
      kind: BACKUP_ENVELOPE_KIND,
      settings: {},
      tasks: [],
    }), {
      updateSettings: vi.fn(),
      addTask: vi.fn(),
      scheduleTasks: vi.fn(),
      deleteTask: vi.fn(),
      refreshTasks: vi.fn(),
      replaceTasks: true,
      currentTasks: [],
      currentSettings: settings,
      currentFocusSession: {
        taskId: 'active-task',
        startedAt: '2026-08-24T12:00:00.000Z',
        isActive: true,
        allowedPackages: [],
      },
    });

    expect(result).toEqual({
      error: expect.stringContaining('Cannot replace tasks while a Focus Session is running'),
    });
  });
});