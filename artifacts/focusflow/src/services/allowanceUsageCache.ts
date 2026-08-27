import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

export type AllowanceUsageSnapshot = {
  usage: Record<string, {
    mode?: string;
    date?: string;
    count?: number;
    usedMs?: number;
    windowStartMs?: number;
  }>;
  activeSessionPackage: string | null;
  activeSessionEndMs: number;
};

const CACHE_TTL_MS = 10_000;

let cached: { date: string; fetchedAt: number; value: AllowanceUsageSnapshot } | null = null;
let inFlight: Promise<AllowanceUsageSnapshot> | null = null;

export function invalidateAllowanceUsageCache(): void {
  cached = null;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseUsage(raw: string | null, today: string): AllowanceUsageSnapshot['usage'] {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, AllowanceUsageSnapshot['usage'][string]>;
    return Object.fromEntries(
      Object.entries(parsed).map(([pkg, value]) => {
        // Interval allowances use a rolling window that can cross midnight.
        // Their windowStartMs, not the calendar date, determines validity.
        if (value.mode === 'interval') {
          return [pkg, value.windowStartMs ? value : {}];
        }
        return [pkg, value.date === today ? value : {}];
      }),
    );
  } catch {
    return {};
  }
}

/**
 * Reads allowance state once and reuses it briefly while Active is visible.
 * The native service checkpoints usage independently, so the TTL is deliberately
 * short and the date is part of the cache validity check.
 */
export async function getAllowanceUsageSnapshot(force = false): Promise<AllowanceUsageSnapshot> {
  const now = Date.now();
  const today = localDateKey();
  if (!force && cached && cached.date === today && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  if (inFlight) return inFlight;

  inFlight = SharedPrefsModule.getAllowanceSnapshot().then(({ usageJson, activeSessionPackage, activeSessionEndMs }) => {
    const value: AllowanceUsageSnapshot = {
      usage: parseUsage(usageJson, today),
      activeSessionPackage: activeSessionPackage || null,
      activeSessionEndMs: activeSessionEndMs || 0,
    };
    cached = { date: today, fetchedAt: Date.now(), value };
    return value;
  }).finally(() => {
    inFlight = null;
  });

  return inFlight;
}