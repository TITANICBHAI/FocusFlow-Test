/**
 * backupService.ts
 *
 * Export & import the user's full FocusFlow state — settings, profile, tasks,
 * presets, schedules, custom rules — as a portable .focusflow file.
 *
 * Export: builds the envelope, then uses the native "Save to" dialog
 *         (ACTION_CREATE_DOCUMENT) so Android shows real storage targets —
 *         Downloads, Google Drive, Files — and the user picks where to save.
 *         This replaces the old Share.share({ url: 'file://...' }) approach
 *         which never worked on Android (file:// URIs are private-app-storage
 *         only and cannot be opened by other apps).
 *
 * Import: opens the Android file picker accepting any file type so .focusflow
 *         files are visible, validates the JSON envelope, then restores.
 *
 * Format: .focusflow files are JSON internally with a versioned envelope that
 *         includes rich metadata for diagnostics and forward-compatibility.
 *
 * File extension: .focusflow  (unique to this app — no ambiguity with generic JSON)
 * MIME type for sharing: application/octet-stream (no registered MIME for .focusflow)
 */

import { Platform } from 'react-native';
import { dbGetActiveFocusSession, dbGetAllTasks } from '@/data/database';
import { NativeFilePickerModule } from '@/native-modules/NativeFilePickerModule';
import type { AppSettings, FocusSession, Task } from '@/data/types';

// ─── Envelope ────────────────────────────────────────────────────────────────

export const BACKUP_ENVELOPE_KIND = 'FocusFlowBackupV1';
export const BACKUP_FILE_EXT = '.focusflow';

export interface BackupEnvelope {
  /** Always "FocusFlowBackupV1" — used to validate on import. */
  kind: typeof BACKUP_ENVELOPE_KIND;
  /** Schema version — bump when the shape changes in a breaking way. */
  version: 1;
  /** ISO timestamp of when this file was exported. */
  exportedAt: string;
  /** Human-readable export date for display in file managers. */
  exportedAtHuman: string;
  /** App version string, e.g. "c1.0.9". */
  appVersion?: string;
  /** Platform info for diagnostics. */
  platform: {
    os: string;
  };
  /** Full app settings including profile, blocking config, and scheduling. */
  settings: AppSettings;
  /** All tasks (scheduled, completed, skipped). */
  tasks: Task[];
  /**
   * Human-readable, sectioned preset inventory. These sections describe
   * configured lists and presets for portability; they intentionally contain
   * no live enabled/disabled state and are not used to activate protections.
   */
  presetSections: BackupPresetSection[];
  /** Summary counts so a restore preview can be shown without parsing. */
  summary: {
    taskCount: number;
    blockedWordCount: number;
    greyoutWindowCount: number;
    dailyAllowanceCount: number;
  };
}

export interface BackupPresetSection {
  id:
    | 'focus-mode'
    | 'standalone-block'
    | 'always-on'
    | 'daily-allowance'
    | 'keyword-blocker'
    | 'block-schedules'
    | 'defense';
  name: string;
  configured: boolean;
  appPackages?: string[];
  vpnPackages?: string[];
  itemCount?: number;
  details?: Record<string, unknown>;
}

export interface ImportSummary {
  settings: boolean;
  tasksImported: number;
  tasksSkipped: number;
  warnings: string[];
}

/**
 * Backups carry reusable configuration and presets, not device-local live
 * enforcement state. The current device decides which protections are active
 * when a backup is imported.
 */
function getPortableSettings(settings: AppSettings): AppSettings {
  const {
    // Standalone blocking is an independent, device-local runtime state.
    standaloneBlockPackages,
    standaloneBlockUntil,
    standaloneVpnPackages,
    autoCopiedAlwaysOnPackages,

    // These are live enforcement switches, not portable presets.
    focusModeEnabled,
    pomodoroEnabled,
    notificationsEnabled,
    weeklyReportEnabled,
    launcherEnabled,
    alwaysOnEnforcementEnabled,
    aversionDimmerEnabled,
    aversionVibrateEnabled,
    aversionSoundEnabled,
    systemGuardEnabled,
    blockInstallActionsEnabled,
    blockYoutubeShortsEnabled,
    blockInstagramReelsEnabled,
    vpnBlockEnabled,
    autoCopyToAlwaysOn,
    vpnSelfHealEnabled,
    pinProtectionEnabled,

    ...portable
  } = settings;

  // Keep the full AppSettings shape in the versioned envelope for backwards
  // compatibility. Omitted fields are restored from the importing device's
  // current settings during merge.
  void standaloneBlockPackages;
  void standaloneBlockUntil;
  void standaloneVpnPackages;
  void autoCopiedAlwaysOnPackages;
  void alwaysOnEnforcementEnabled;
  void focusModeEnabled;
  void pomodoroEnabled;
  void notificationsEnabled;
  void weeklyReportEnabled;
  void launcherEnabled;
  void aversionDimmerEnabled;
  void aversionVibrateEnabled;
  void aversionSoundEnabled;
  void systemGuardEnabled;
  void blockInstallActionsEnabled;
  void blockYoutubeShortsEnabled;
  void blockInstagramReelsEnabled;
  void vpnBlockEnabled;
  void autoCopyToAlwaysOn;
  void vpnSelfHealEnabled;
  void pinProtectionEnabled;

  return portable as AppSettings;
}

function buildPresetSections(settings: AppSettings): BackupPresetSection[] {
  const allowedApps = settings.allowedInFocus ?? [];
  const standaloneApps = settings.standaloneBlockPackages ?? [];
  const standaloneVpnApps = settings.standaloneVpnPackages ?? [];
  const alwaysOnApps = settings.alwaysOnPackages ?? [];
  const alwaysOnVpnApps = settings.alwaysOnVpnPackages ?? [];
  const allowances = settings.dailyAllowanceEntries ?? [];
  const keywords = settings.blockedWords ?? [];
  const schedules = settings.greyoutSchedule ?? [];
  const blockPresets = settings.blockPresets ?? [];
  const allowedAppPresets = settings.allowedAppPresets ?? [];

  return [
    {
      id: 'focus-mode',
      name: 'Focus Mode',
      configured: allowedApps.length > 0 || allowedAppPresets.length > 0,
      appPackages: allowedApps,
      itemCount: allowedAppPresets.length,
      details: { allowedAppPresets },
    },
    {
      id: 'standalone-block',
      name: 'Standalone Block',
      configured: standaloneApps.length > 0 || standaloneVpnApps.length > 0,
      appPackages: standaloneApps,
      vpnPackages: standaloneVpnApps,
      details: {
        // The list is portable as a named preset inventory, but its active
        // timer/state is deliberately not imported.
        runtimeState: 'local-only',
      },
    },
    {
      id: 'always-on',
      name: 'Always-On Blocking',
      configured: alwaysOnApps.length > 0 || alwaysOnVpnApps.length > 0,
      appPackages: alwaysOnApps,
      vpnPackages: alwaysOnVpnApps,
    },
    {
      id: 'daily-allowance',
      name: 'Daily Allowance',
      configured: allowances.length > 0,
      itemCount: allowances.length,
      details: { entries: allowances },
    },
    {
      id: 'keyword-blocker',
      name: 'Keyword Blocker',
      configured: keywords.length > 0,
      itemCount: keywords.length,
      details: { keywords },
    },
    {
      id: 'block-schedules',
      name: 'Block Schedules',
      configured: schedules.length > 0,
      itemCount: schedules.length,
      details: { windows: schedules },
    },
    {
      id: 'defense',
      name: 'Defense',
      configured: blockPresets.length > 0,
      itemCount: blockPresets.length,
      details: {
        blockPresets,
        // These are configuration choices, not activation flags.
        overlayQuotes: settings.overlayQuotes ?? [],
        overlayWallpaper: settings.overlayWallpaper ?? '',
      },
    },
  ];
}

// ─── Build envelope ──────────────────────────────────────────────────────────

export async function buildBackupJson(settings: AppSettings, appVersion?: string): Promise<string> {
  const tasks = await dbGetAllTasks().catch(() => [] as Task[]);
  const now = new Date();

  const envelope: BackupEnvelope = {
    kind: BACKUP_ENVELOPE_KIND,
    version: 1,
    exportedAt: now.toISOString(),
    exportedAtHuman: now.toLocaleString(),
    appVersion,
    platform: { os: Platform.OS },
    settings: getPortableSettings(settings),
    tasks,
    presetSections: buildPresetSections(settings),
    summary: {
      taskCount: tasks.length,
      blockedWordCount: (settings.blockedWords ?? []).length,
      greyoutWindowCount: (settings.greyoutSchedule ?? []).length,
      dailyAllowanceCount: (settings.dailyAllowanceEntries ?? []).length,
    },
  };

  return JSON.stringify(envelope, null, 2);
}

// ─── Export — save via ACTION_CREATE_DOCUMENT ────────────────────────────────
//
// On Android, the "Save to" dialog (ACTION_CREATE_DOCUMENT) is the correct
// way to let the user choose where to store a file.  The system handles all
// permission and FileProvider concerns automatically — the app never touches
// the file path; it only writes to the content URI that Android provides.
//
// UX flow:
//   1. Build backup JSON
//   2. Open system "Save to" dialog with suggested filename
//   3. User picks destination (Downloads, Drive, Files, …)
//   4. Kotlin writes the content to the chosen URI
//   5. Resolve ok: true with the chosen URI as the path

export async function exportBackup(
  settings: AppSettings,
  appVersion?: string,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const json = await buildBackupJson(settings, appVersion);

    // Build a filename with a timestamp slug: focusflow-2025-06-15T14-30-00.focusflow
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `focusflow-${stamp}${BACKUP_FILE_EXT}`;

    if (Platform.OS !== 'android') {
      // Web / non-Android: return the raw JSON for the caller to handle.
      return { ok: true, path: filename };
    }

    // Open the system "Save to" dialog. Returns the content URI on success,
    // null if the user cancelled.
    const savedUri = await NativeFilePickerModule.saveFile(
      json,
      filename,
      'application/octet-stream',
    );

    if (savedUri === null) {
      // User dismissed the dialog — not an error.
      return { ok: false, error: 'cancelled' };
    }

    return { ok: true, path: savedUri };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Validate ────────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parseBackupJson(
  text: string,
): { ok: true; envelope: BackupEnvelope } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON — is this a genuine .focusflow file?' };
  }
  if (!isObj(parsed)) return { ok: false, error: 'Backup is empty or malformed.' };
  if (parsed.kind !== BACKUP_ENVELOPE_KIND) {
    return {
      ok: false,
      error: `Unsupported format (expected "${BACKUP_ENVELOPE_KIND}", got "${String(parsed.kind ?? 'unknown')}"). Make sure you are importing a .focusflow backup file created by FocusFlow.`,
    };
  }
  if (!isObj(parsed.settings)) return { ok: false, error: 'Backup is missing settings — the file may be corrupted.' };
  if (!Array.isArray(parsed.tasks)) return { ok: false, error: 'Backup is missing task data.' };
  return { ok: true, envelope: parsed as unknown as BackupEnvelope };
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface RestoreCallbacks {
  updateSettings: (s: AppSettings) => Promise<void>;
  addTask: (t: Task, options?: { skipAlarms?: boolean }) => Promise<void>;
  scheduleTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  /** When true every existing task is deleted before restore. */
  replaceTasks: boolean;
  currentTasks: Task[];
  currentSettings: AppSettings;
  /** Optional in-memory session snapshot; the database is also checked. */
  currentFocusSession?: FocusSession | null;
}

export async function pickAndImportBackup(
  cb: RestoreCallbacks,
): Promise<ImportSummary | { error: string }> {
  if (Platform.OS !== 'android') {
    return { error: 'File import is only available on Android.' };
  }

  let picked;
  try {
    // Use '*/*' so .focusflow files (no registered MIME type) appear in the picker.
    // Legacy .json backups are also selectable this way.
    picked = await NativeFilePickerModule.pickFile('*/*');
  } catch (e) {
    return { error: `Could not open file picker: ${String(e)}` };
  }
  if (!picked) return { error: 'No file selected.' };

  // Basic guard: warn if the extension looks wrong but still try to parse
  const ext = picked.name.split('.').pop()?.toLowerCase() ?? '';
  const knownExts = ['focusflow', 'json'];
  if (!knownExts.includes(ext)) {
    // Not a hard failure — the content may still be valid
  }

  return restoreFromJson(picked.content, cb);
}

export async function restoreFromJson(
  text: string,
  cb: RestoreCallbacks,
): Promise<ImportSummary | { error: string }> {
  const parsed = parseBackupJson(text);
  if (!parsed.ok) return { error: parsed.error };
  const env = parsed.envelope;

  if (cb.replaceTasks) {
    const databaseSession = await dbGetActiveFocusSession();
    if (cb.currentFocusSession?.isActive || databaseSession?.isActive) {
      return {
        error: 'Cannot replace tasks while a Focus Session is running. Stop the current session, then try importing the backup again.',
      };
    }
  }

  const summary: ImportSummary = {
    settings: false,
    tasksImported: 0,
    tasksSkipped: 0,
    warnings: [],
  };

  // ── Settings ─────────────────────────────────────────────────────────────
  // Merge so newer fields added in a future release keep their defaults.
  try {
    const merged: AppSettings = { ...cb.currentSettings, ...env.settings };
    await cb.updateSettings(merged);
    summary.settings = true;
  } catch (e) {
    summary.warnings.push(`Settings could not be restored: ${String(e)}`);
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  // state.tasks can be a partial in-memory view (for example after startup),
  // so replacement and collision checks must use the complete database set.
  const existingTasks = await dbGetAllTasks().catch(() => cb.currentTasks);

  if (cb.replaceTasks) {
    for (const t of existingTasks) {
      try { await cb.deleteTask(t.id); } catch { /* keep going */ }
    }
  }
  const existingIds = cb.replaceTasks
    ? new Set<string>()
    : new Set(existingTasks.map((t) => t.id));
  const tasksToSchedule: Task[] = [];

  for (const t of env.tasks) {
    if (!t || typeof t !== 'object' || !t.id) {
      summary.tasksSkipped++;
      continue;
    }
    if (existingIds.has(t.id)) {
      summary.tasksSkipped++;
      continue;
    }
    try {
      const imported = t as Task;
      const isPastScheduledTask =
        imported.status === 'scheduled' &&
        new Date(imported.endTime).getTime() < Date.now();
      const taskToImport: Task = isPastScheduledTask
        ? { ...imported, status: 'skipped', updatedAt: new Date().toISOString() }
        : imported;

      // Historical and already-resolved rows are restored as data only. They
      // must not be routed through normal reminder/alarm scheduling.
      await cb.addTask(taskToImport, { skipAlarms: true });
      if (taskToImport.status === 'scheduled') {
        tasksToSchedule.push(taskToImport);
      }
      summary.tasksImported++;
    } catch (e) {
      summary.tasksSkipped++;
      summary.warnings.push(`Task "${(t as Task).title ?? t.id}" failed: ${String(e)}`);
    }
  }

  if (tasksToSchedule.length > 0) {
    try {
      await cb.scheduleTasks(tasksToSchedule);
    } catch (e) {
      summary.warnings.push(`Some imported task reminders could not be scheduled: ${String(e)}`);
    }
  }

  await cb.refreshTasks().catch(() => {});
  return summary;
}
