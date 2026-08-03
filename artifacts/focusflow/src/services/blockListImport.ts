/**
 * blockListImport.ts
 *
 * Helpers for landing imported app lists from third-party blockers.
 *
 * As of v1.1, imported apps are saved as a NEW BlockPreset rather than being
 * merged straight into the always-on standalone block list. This is safer:
 *   • No alarm / focus session is started.
 *   • The user's current block list, timer, and allowance entries are
 *     untouched.
 *   • The user can pick the new preset from Standalone Block when they're
 *     ready to enforce it (or use it inside a Block Schedule batch).
 *
 * The legacy `mergeIntoStandaloneBlockList` helper is kept as a no-op shim
 * so any old caller still compiles, but it now also routes through the new
 * preset path.
 */

import type { AppSettings, BlockPreset, DailyAllowanceEntry } from '@/data/types';

export interface ImportPresetResult {
  /** Number of packages added to the new preset. */
  added: number;
  /** Packages that were skipped because they were already covered by an
   * existing preset with the same name. */
  duplicates: number;
  /** The newly-created preset. */
  preset: BlockPreset;
  /** The full presets list after the import (use this when persisting). */
  allPresets: BlockPreset[];
}

/**
 * Build a deterministic, human-readable preset name like
 * "Imported (Apr 30, 2:14 PM)". Callers can override via `presetName`.
 */
function defaultImportName(): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `Imported (${date}, ${time})`;
}

function genPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Save `incoming` as a brand-new BlockPreset. Returns the new preset and the
 * full updated list of presets (which the caller persists via updateSettings).
 *
 * IMPORTANT: This function does NOT enable any block, start any timer, or
 * fire any alarm. It only adds a preset to the user's library so they can
 * pick it later from Standalone Block, Block Schedules, or Daily Allowance.
 */
export function mergeIntoBlockPreset(
  incoming: string[],
  settings: AppSettings,
  presetName?: string,
): ImportPresetResult {
  const cleaned = Array.from(new Set(incoming.map((p) => p.trim()).filter(Boolean)));
  const preset: BlockPreset = {
    id: genPresetId(),
    name: presetName ?? defaultImportName(),
    packages: cleaned,
  };
  const allPresets = [...(settings.blockPresets ?? []), preset];
  return {
    added: cleaned.length,
    duplicates: incoming.length - cleaned.length,
    preset,
    allPresets,
  };
}

// ─── Legacy compatibility shim ────────────────────────────────────────────
//
// Older callers used to merge straight into standaloneBlockPackages. Those
// callers should migrate to `mergeIntoBlockPreset` + `updateSettings`. This
// shim keeps them working but now routes to the preset path so behaviour is
// consistent everywhere.

export interface MergeBlockListResult {
  added: number;
  duplicates: number;
  merged: string[];
}

/**
 * @deprecated Use {@link mergeIntoBlockPreset} instead. This shim no longer
 * touches the standalone block list — it just creates a preset and reports
 * the count, leaving enforcement decisions to the user.
 */
export async function mergeIntoStandaloneBlockList(
  incoming: string[],
  settings: AppSettings,
  _setStandaloneBlockAndAllowance: (
    packages: string[],
    untilMs: number | null,
    allowanceEntries: DailyAllowanceEntry[],
  ) => Promise<void>,
): Promise<MergeBlockListResult> {
  const result = mergeIntoBlockPreset(incoming, settings);
  return {
    added: result.added,
    duplicates: result.duplicates,
    merged: result.preset.packages,
  };
}
