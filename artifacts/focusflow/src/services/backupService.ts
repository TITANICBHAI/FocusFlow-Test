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
import { dbGetAllTasks } from '@/data/database';
import { NativeFilePickerModule } from '@/native-modules/NativeFilePickerModule';
import type { AppSettings, Task } from '@/data/types';

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
  /** App version string, e.g. "c1.0.8". */
  appVersion?: string;
  /** Platform info for diagnostics. */
  platform: {
    os: string;
  };
  /** Full app settings including profile, blocking config, and scheduling. */
  settings: AppSettings;
  /** All tasks (scheduled, completed, skipped). */
  tasks: Task[];
  /** Summary counts so a restore preview can be shown without parsing. */
  summary: {
    taskCount: number;
    blockedWordCount: number;
    greyoutWindowCount: number;
    dailyAllowanceCount: number;
  };
}

export interface ImportSummary {
  settings: boolean;
  tasksImported: number;
  tasksSkipped: number;
  warnings: string[];
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
    settings,
    tasks,
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
  addTask: (t: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  /** When true every existing task is deleted before restore. */
  replaceTasks: boolean;
  currentTasks: Task[];
  currentSettings: AppSettings;
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
  if (cb.replaceTasks) {
    for (const t of cb.currentTasks) {
      try { await cb.deleteTask(t.id); } catch { /* keep going */ }
    }
  }
  const existingIds = cb.replaceTasks
    ? new Set<string>()
    : new Set(cb.currentTasks.map((t) => t.id));

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
      await cb.addTask(t as Task);
      summary.tasksImported++;
    } catch (e) {
      summary.tasksSkipped++;
      summary.warnings.push(`Task "${(t as Task).title ?? t.id}" failed: ${String(e)}`);
    }
  }

  await cb.refreshTasks().catch(() => {});
  return summary;
}
