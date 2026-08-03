import { NativeModules } from 'react-native';

const { Aversions } = NativeModules;

export interface AversionsSettings {
  dimmerEnabled: boolean;
  vibrateEnabled: boolean;
  soundEnabled: boolean;
  weeklyReportEnabled: boolean;
}

const AversionsModule = {
  async getSettings(): Promise<AversionsSettings> {
    if (!Aversions?.getSettings) {
      return {
        dimmerEnabled: false,
        vibrateEnabled: false,
        soundEnabled: false,
        weeklyReportEnabled: false,
      };
    }
    return Aversions.getSettings();
  },

  async setSettings(settings: Partial<AversionsSettings>): Promise<void> {
    if (!Aversions?.setSettings) return;
    return Aversions.setSettings(settings);
  },
};

export { AversionsModule };
