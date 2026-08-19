import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '@/data/types';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

export type ProtectionMode = 'standard' | 'iron';

const ASYNC_BACKUP_KEY = '@focusflow/setup-state';
const ASYNC_PRIVACY_KEY = '@focusflow/privacy-accepted';
const ASYNC_ONBOARDING_KEY = '@focusflow/onboarding-complete';

type SetupBackup = {
  privacyAccepted: boolean;
  onboardingComplete: boolean;
  protectionMode: ProtectionMode;
};

function isProtectionMode(value: unknown): value is ProtectionMode {
  return value === 'standard' || value === 'iron';
}

/**
 * Critical first-run state is mirrored outside SQLite. This is deliberately
 * kept small so an old/corrupt settings row cannot send a returning user back
 * through privacy and onboarding.
 */
export async function persistSetupBackups(settings: Pick<
  AppSettings,
  'privacyAccepted' | 'onboardingComplete' | 'protectionMode'
>): Promise<void> {
  const backup: SetupBackup = {
    privacyAccepted: Boolean(settings.privacyAccepted),
    onboardingComplete: Boolean(settings.onboardingComplete),
    protectionMode: settings.protectionMode ?? 'standard',
  };

  await Promise.allSettled([
    SharedPrefsModule.putString('privacy_accepted', String(backup.privacyAccepted)),
    SharedPrefsModule.putString('onboarding_complete', String(backup.onboardingComplete)),
    SharedPrefsModule.putString('protection_mode', backup.protectionMode),
    AsyncStorage.setItem(ASYNC_BACKUP_KEY, JSON.stringify(backup)),
    // Keep individual AsyncStorage markers as well as the combined record.
    // This preserves compatibility with partial/corrupt setup-state writes.
    AsyncStorage.setItem(ASYNC_PRIVACY_KEY, String(backup.privacyAccepted)),
    AsyncStorage.setItem(ASYNC_ONBOARDING_KEY, String(backup.onboardingComplete)),
  ]);
}

export async function readSetupBackups(): Promise<Partial<SetupBackup>> {
  const results = await Promise.allSettled([
    SharedPrefsModule.getString('privacy_accepted'),
    SharedPrefsModule.getString('onboarding_complete'),
    SharedPrefsModule.getString('protection_mode'),
    AsyncStorage.getItem(ASYNC_BACKUP_KEY),
    AsyncStorage.getItem(ASYNC_PRIVACY_KEY),
    AsyncStorage.getItem(ASYNC_ONBOARDING_KEY),
  ]);
  const valueAt = (index: number): string | null => {
    const result = results[index];
    return result?.status === 'fulfilled' ? result.value : null;
  };
  const privacyAccepted = valueAt(0);
  const onboardingComplete = valueAt(1);
  const protectionMode = valueAt(2);
  const asyncBackup = valueAt(3);
  const asyncPrivacyAccepted = valueAt(4);
  const asyncOnboardingComplete = valueAt(5);

  let parsed: Partial<SetupBackup> = {};
  if (asyncBackup) {
    try {
      const candidate = JSON.parse(asyncBackup) as Partial<SetupBackup>;
      parsed = {
        privacyAccepted: candidate.privacyAccepted === true,
        onboardingComplete: candidate.onboardingComplete === true,
        protectionMode: isProtectionMode(candidate.protectionMode)
          ? candidate.protectionMode
          : undefined,
      };
    } catch {
      // The native SharedPreferences values below remain available.
    }
  }

  return {
    privacyAccepted:
      privacyAccepted === 'true' ||
      asyncPrivacyAccepted === 'true' ||
      parsed.privacyAccepted === true,
    onboardingComplete:
      onboardingComplete === 'true' ||
      asyncOnboardingComplete === 'true' ||
      parsed.onboardingComplete === true,
    protectionMode: isProtectionMode(protectionMode)
      ? protectionMode
      : parsed.protectionMode,
  };
}