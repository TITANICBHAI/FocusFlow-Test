import { NativeModules } from 'react-native';

const { Greyout } = NativeModules;

export interface GreyoutWindow {
  pkg: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  days: number[];
}

export interface TemptationEntry {
  pkg: string;
  appName: string;
  timestamp: number;
}

const GreyoutModule = {
  async getSchedule(): Promise<GreyoutWindow[]> {
    if (!Greyout?.getSchedule) return [];
    const json: string = await Greyout.getSchedule();
    try { return JSON.parse(json) as GreyoutWindow[]; } catch { return []; }
  },

  async setSchedule(windows: GreyoutWindow[]): Promise<void> {
    if (!Greyout?.setSchedule) return;
    return Greyout.setSchedule(JSON.stringify(windows));
  },

  async getTemptationLog(): Promise<TemptationEntry[]> {
    if (!Greyout?.getTemptationLog) return [];
    const json: string = await Greyout.getTemptationLog();
    try { return JSON.parse(json) as TemptationEntry[]; } catch { return []; }
  },

  async clearTemptationLog(): Promise<void> {
    if (!Greyout?.clearTemptationLog) return;
    return Greyout.clearTemptationLog();
  },

  async getWeeklySummary(): Promise<string> {
    if (!Greyout?.getWeeklySummary) return '';
    return Greyout.getWeeklySummary();
  },
};

export { GreyoutModule };
