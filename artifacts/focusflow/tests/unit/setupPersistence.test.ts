import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getItem, setItem, getString, putString } = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  getString: vi.fn<(key: string) => Promise<string | null>>(),
  putString: vi.fn<(key: string, value: string) => Promise<void>>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem, setItem },
}));

vi.mock('@/native-modules/SharedPrefsModule', () => ({
  SharedPrefsModule: { getString, putString },
}));

import {
  persistSetupBackups,
  readSetupBackups,
} from '@/services/setupPersistence';

describe('setupPersistence', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    getString.mockReset();
    putString.mockReset();
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
    getString.mockResolvedValue(null);
    putString.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mirrors critical setup state to native preferences and AsyncStorage', async () => {
    await persistSetupBackups({
      privacyAccepted: true,
      onboardingComplete: false,
      protectionMode: 'iron',
    });

    expect(putString).toHaveBeenCalledWith('privacy_accepted', 'true');
    expect(putString).toHaveBeenCalledWith('onboarding_complete', 'false');
    expect(putString).toHaveBeenCalledWith('protection_mode', 'iron');
    expect(setItem).toHaveBeenCalledWith(
      '@focusflow/setup-state',
      JSON.stringify({
        privacyAccepted: true,
        onboardingComplete: false,
        protectionMode: 'iron',
      }),
    );
    expect(setItem).toHaveBeenCalledWith('@focusflow/privacy-accepted', 'true');
    expect(setItem).toHaveBeenCalledWith('@focusflow/onboarding-complete', 'false');
  });

  it('defaults an absent protection mode to standard', async () => {
    await persistSetupBackups({
      privacyAccepted: false,
      onboardingComplete: true,
      protectionMode: undefined,
    });

    expect(putString).toHaveBeenCalledWith('protection_mode', 'standard');
    expect(setItem).toHaveBeenCalledWith(
      '@focusflow/setup-state',
      expect.stringContaining('"protectionMode":"standard"'),
    );
  });

  it('combines native and AsyncStorage markers when reading recovery state', async () => {
    getString.mockImplementation(async (key) => {
      if (key === 'privacy_accepted') return 'true';
      if (key === 'protection_mode') return 'iron';
      return null;
    });
    getItem.mockImplementation(async (key) => {
      if (key === '@focusflow/onboarding-complete') return 'true';
      return null;
    });

    await expect(readSetupBackups()).resolves.toEqual({
      privacyAccepted: true,
      onboardingComplete: true,
      protectionMode: 'iron',
    });
  });

  it('ignores malformed combined data and falls back to individual markers', async () => {
    getItem.mockImplementation(async (key) => {
      if (key === '@focusflow/setup-state') return '{not-json';
      if (key === '@focusflow/privacy-accepted') return 'true';
      return null;
    });
    getString.mockResolvedValue(null);

    await expect(readSetupBackups()).resolves.toEqual({
      privacyAccepted: true,
      onboardingComplete: false,
      protectionMode: undefined,
    });
  });

  it('survives rejected storage reads and returns safe defaults', async () => {
    getItem.mockRejectedValue(new Error('AsyncStorage unavailable'));
    getString.mockRejectedValue(new Error('native unavailable'));

    await expect(readSetupBackups()).resolves.toEqual({
      privacyAccepted: false,
      onboardingComplete: false,
      protectionMode: undefined,
    });
  });

  it('does not reject when one or more mirrored writes fail', async () => {
    putString.mockRejectedValueOnce(new Error('native write failed'));
    setItem.mockRejectedValueOnce(new Error('async write failed'));

    await expect(
      persistSetupBackups({
        privacyAccepted: true,
        onboardingComplete: true,
        protectionMode: 'standard',
      }),
    ).resolves.toBeUndefined();
  });
});