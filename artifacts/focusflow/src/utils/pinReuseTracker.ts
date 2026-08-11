/**
 * pinReuseTracker.ts
 *
 * Tracks how many times today the user has chosen to "keep the same password"
 * at a PIN-rotation prompt. Once the daily cap is hit, the "keep same" option
 * is disabled and the user must set a new custom or auto-generated password.
 *
 * Stored in SharedPreferences:
 *   pin_reuse_count_focus      — reuse count for Focus Session PIN rotations
 *   pin_reuse_date_focus       — ISO date (YYYY-MM-DD) count was last updated
 *   pin_reuse_count_alwayson   — reuse count for Always-On Enforcement PIN
 *   pin_reuse_date_alwayson    — ISO date count was last updated
 */

import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

export const MAX_DAILY_REUSES = 3;

export type ReuseTrackerKey = 'focus' | 'alwayson';

function countKey(k: ReuseTrackerKey) { return `pin_reuse_count_${k}`; }
function dateKey(k: ReuseTrackerKey)  { return `pin_reuse_date_${k}`; }

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns { count, canReuse }.
 * Automatically resets count to 0 if the stored date is not today.
 */
export async function getPinReuseInfo(
  key: ReuseTrackerKey,
): Promise<{ count: number; canReuse: boolean }> {
  const today = todayISO();
  try {
    const [storedDate, storedCount] = await Promise.all([
      SharedPrefsModule.getString(dateKey(key)),
      SharedPrefsModule.getString(countKey(key)),
    ]);
    const count =
      storedDate === today ? Math.max(0, parseInt(storedCount ?? '0', 10) || 0) : 0;
    return { count, canReuse: count < MAX_DAILY_REUSES };
  } catch {
    return { count: 0, canReuse: true };
  }
}

/**
 * Records one "keep same" reuse for today.
 */
export async function recordPinReuse(key: ReuseTrackerKey): Promise<void> {
  const today = todayISO();
  const { count } = await getPinReuseInfo(key);
  await Promise.all([
    SharedPrefsModule.putString(countKey(key), String(count + 1)),
    SharedPrefsModule.putString(dateKey(key), today),
  ]);
}
