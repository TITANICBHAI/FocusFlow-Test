import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Appearance: { getColorScheme: vi.fn(() => 'light') },
}));

import { DEFAULT_SETTINGS } from '@/data/defaultSettings';

describe('canonical default settings', () => {
  it('keeps protection defaults explicit and consistent', () => {
    expect(DEFAULT_SETTINGS.autoCopyToAlwaysOn).toBe(false);
    expect(DEFAULT_SETTINGS.keepFocusActiveUntilTaskEnd).toBe(true);
    expect(DEFAULT_SETTINGS.vpnSelfHealEnabled).toBe(false);
  });

  it('contains the core settings needed for a fresh database', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      focusModeEnabled: true,
      dailyAllowanceEntries: [],
      alwaysOnPackages: [],
      standaloneBlockPackages: [],
      vpnBlockEnabled: false,
    });
  });
});