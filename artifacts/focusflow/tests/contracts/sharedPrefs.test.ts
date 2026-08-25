import { beforeEach, describe, expect, it, vi } from 'vitest';

const { nativePrefs } = vi.hoisted(() => ({
  nativePrefs: {
    setFocusActive: vi.fn(),
    setFocusBreak: vi.fn(),
    clearFocusBreak: vi.fn(),
    getFocusBreakUntilMs: vi.fn(),
    setAllowedPackages: vi.fn(),
    setActiveTask: vi.fn(),
    setActiveTaskColor: vi.fn(),
    setActiveTaskStartMs: vi.fn(),
    clearActiveTask: vi.fn(),
    setStandaloneBlock: vi.fn(),
    setAlwaysBlockActive: vi.fn(),
    setDailyAllowanceConfig: vi.fn(),
    setBlockedWords: vi.fn(),
    setNetworkBlockEnabled: vi.fn(),
    setVpnSelectedPackages: vi.fn(),
    setDailyStats: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { SharedPrefs: nativePrefs },
}));

vi.mock('@/services/startupLogger', () => ({
  logger: { error: vi.fn() },
}));

import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

describe('SharedPrefs JS↔Kotlin serialization contract', () => {
  beforeEach(() => {
    for (const mock of Object.values(nativePrefs)) mock.mockReset();
    for (const mock of Object.values(nativePrefs)) mock.mockResolvedValue(undefined);
  });

  it('writes focus state, task identity, timestamps, and the block-all sentinel exactly', async () => {
    await SharedPrefsModule.setFocusActive(true);
    await SharedPrefsModule.setActiveTask(
      'task-1',
      'Deep work',
      1_756_045_200_000,
      null,
    );
    await SharedPrefsModule.setAllowedPackages(['com.focusflow.internal.blockall']);

    expect(nativePrefs.setFocusActive).toHaveBeenCalledWith(true, null);
    expect(nativePrefs.setActiveTask).toHaveBeenCalledWith(
      'task-1',
      'Deep work',
      1_756_045_200_000,
      null,
    );
    expect(nativePrefs.setAllowedPackages).toHaveBeenCalledWith([
      'com.focusflow.internal.blockall',
    ]);
  });

  it('serializes allowance entries as the exact JSON consumed by native enforcement', async () => {
    const entries = [{
      packageName: 'com.example.social',
      mode: 'time_budget' as const,
      countPerDay: 1,
      budgetMinutes: 30,
      intervalMinutes: 5,
      intervalHours: 1,
    }];

    await SharedPrefsModule.setDailyAllowanceConfig(entries);

    expect(nativePrefs.setDailyAllowanceConfig).toHaveBeenCalledWith(JSON.stringify(entries));
  });

  it('serializes blocked and VPN package lists without changing order', async () => {
    await SharedPrefsModule.setBlockedWords(['spoiler', 'headline']);
    await SharedPrefsModule.setVpnSelectedPackages([
      'com.example.video',
      'com.example.social',
    ]);

    expect(nativePrefs.setBlockedWords).toHaveBeenCalledWith(['spoiler', 'headline']);
    expect(nativePrefs.setVpnSelectedPackages).toHaveBeenCalledWith(
      JSON.stringify(['com.example.video', 'com.example.social']),
    );
  });

  it('clamps daily stats to non-negative integers before crossing the bridge', async () => {
    await SharedPrefsModule.setDailyStats(3.9, -2.4, 44.8, -1);

    expect(nativePrefs.setDailyStats).toHaveBeenCalledWith(3, 0, 44, 0);
  });

  it('returns safe defaults when optional native methods are unavailable or reject', async () => {
    nativePrefs.getFocusBreakUntilMs.mockRejectedValue(new Error('bridge unavailable'));
    delete (nativePrefs as Record<string, unknown>).getActiveTask;

    await expect(SharedPrefsModule.getFocusBreakUntilMs()).resolves.toBe(0);
    await expect(SharedPrefsModule.setFocusActive(false)).resolves.toBeUndefined();
  });
});