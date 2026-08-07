import { runWithDb, runWithDbOr } from './connection';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS, migrateSettings } from './schema';

export async function dbGetSettings(): Promise<AppSettings> {
  return runWithDbOr('dbGetSettings', DEFAULT_SETTINGS, async (database) => {
    const row = await database.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'app_settings'`,
    );
    if (!row) return DEFAULT_SETTINGS;
    try {
      const raw = JSON.parse(row.value) as Partial<AppSettings> & { dailyAllowancePackages?: string[] };
      const migrated = migrateSettings(raw);
      return { ...DEFAULT_SETTINGS, ...migrated };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
}

export async function dbSaveSettings(settings: AppSettings): Promise<void> {
  const stamped = settings.schemaVersion === 1
    ? settings
    : { ...settings, schemaVersion: 1 };
  return runWithDb('dbSaveSettings', (database) => database.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)`,
    [JSON.stringify(stamped)],
  ).then(() => undefined));
}