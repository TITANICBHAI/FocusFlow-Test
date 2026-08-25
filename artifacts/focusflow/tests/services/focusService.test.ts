import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dbStartFocusSession,
  dbEndFocusSession,
  startService,
  stopService,
  requestBatteryOptimizationExemption,
  goHome,
  setFocusActive,
  setActiveTask,
  setActiveTaskColor,
  setAllowedPackages,
  clearActiveTask,
  dismissPersistentNotification,
  addEventListener,
  remove,
} = vi.hoisted(() => {
  const remove = vi.fn();
  return {
    dbStartFocusSession: vi.fn(),
    dbEndFocusSession: vi.fn(),
    startService: vi.fn(),
    stopService: vi.fn(),
    requestBatteryOptimizationExemption: vi.fn(),
    goHome: vi.fn(),
    setFocusActive: vi.fn(),
    setActiveTask: vi.fn(),
    setActiveTaskColor: vi.fn(),
    setAllowedPackages: vi.fn(),
    clearActiveTask: vi.fn(),
    dismissPersistentNotification: vi.fn(),
    addEventListener: vi.fn(() => ({ remove })),
    remove,
  };
});

vi.mock('react-native', () => ({
  AppState: { addEventListener },
}));

vi.mock('@/data/database', () => ({
  dbStartFocusSession,
  dbEndFocusSession,
}));

vi.mock('@/native-modules/ForegroundServiceModule', () => ({
  ForegroundServiceModule: {
    startService,
    stopService,
    requestBatteryOptimizationExemption,
  },
}));

vi.mock('@/native-modules/ForegroundLaunchModule', () => ({
  ForegroundLaunchModule: { goHome },
}));

vi.mock('@/native-modules/SharedPrefsModule', () => ({
  SharedPrefsModule: {
    setFocusActive,
    setActiveTask,
    setActiveTaskColor,
    setAllowedPackages,
    clearActiveTask,
  },
}));

vi.mock('@/services/notificationService', () => ({
  dismissPersistentNotification,
}));

import {
  getCurrentFocusTask,
  isFocusActive,
  startFocusMode,
  stopFocusMode,
} from '@/services/focusService';
import { task } from '../helpers/task';

describe('focusService orchestration', () => {
  const activeTask = task(
    'focus-1',
    '2026-08-24T10:00:00.000Z',
    '2026-08-24T11:00:00.000Z',
    { title: 'Deep work' },
  );
  const nextTask = task(
    'next-1',
    '2026-08-24T12:00:00.000Z',
    '2026-08-24T12:30:00.000Z',
    { title: 'Email' },
  );

  beforeEach(async () => {
    if (isFocusActive()) await stopFocusMode();
    vi.clearAllMocks();
    for (const mock of [
      dbStartFocusSession,
      dbEndFocusSession,
      startService,
      stopService,
      requestBatteryOptimizationExemption,
      goHome,
      setFocusActive,
      setActiveTask,
      setActiveTaskColor,
      setAllowedPackages,
      clearActiveTask,
      dismissPersistentNotification,
    ]) {
      mock.mockResolvedValue(undefined);
    }
    addEventListener.mockReturnValue({ remove });
  });

  afterEach(async () => {
    if (isFocusActive()) await stopFocusMode();
  });

  it('starts a session and synchronizes database, native service, preferences, and home navigation', async () => {
    vi.setSystemTime(new Date('2026-08-24T10:05:00.000Z'));

    await startFocusMode(
      activeTask,
      ['com.android.dialer', 'not-a-package', 'com.example.allowed'],
      undefined,
      {},
      [activeTask, nextTask],
    );

    expect(dbStartFocusSession).toHaveBeenCalledWith({
      taskId: 'focus-1',
      startedAt: '2026-08-24T10:05:00.000Z',
      isActive: true,
      allowedPackages: ['com.android.dialer', 'not-a-package', 'com.example.allowed'],
    });
    expect(startService).toHaveBeenCalledWith(
      'focus-1',
      'Deep work',
      new Date(activeTask.startTime).getTime(),
      new Date(activeTask.endTime).getTime(),
      'Email',
    );
    expect(requestBatteryOptimizationExemption).toHaveBeenCalledOnce();
    expect(goHome).toHaveBeenCalledOnce();
    expect(setFocusActive).toHaveBeenCalledWith(true);
    expect(setActiveTask).toHaveBeenCalledWith(
      'focus-1',
      'Deep work',
      new Date(activeTask.endTime).getTime(),
      'Email',
    );
    expect(setActiveTaskColor).toHaveBeenCalledWith('#6366f1');
    expect(setAllowedPackages).toHaveBeenCalledWith([
      'com.android.dialer',
      'com.example.allowed',
    ]);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(isFocusActive()).toBe(true);
    expect(getCurrentFocusTask()).toBe(activeTask);
  });

  it('uses the block-all sentinel and can skip home navigation', async () => {
    await startFocusMode(activeTask, ['invalid'], undefined, { skipGoHome: true });

    expect(setAllowedPackages).toHaveBeenCalledWith(['com.focusflow.internal.blockall']);
    expect(goHome).not.toHaveBeenCalled();
  });

  it('stops a real session and clears every native state layer', async () => {
    await startFocusMode(activeTask, [], undefined, { skipGoHome: true });
    vi.clearAllMocks();

    await stopFocusMode();

    expect(stopService).toHaveBeenCalledWith(null);
    expect(setFocusActive).toHaveBeenCalledWith(false, null);
    expect(setAllowedPackages).toHaveBeenCalledWith([]);
    expect(clearActiveTask).toHaveBeenCalledOnce();
    expect(dbEndFocusSession).toHaveBeenCalledWith('focus-1');
    expect(dismissPersistentNotification).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(isFocusActive()).toBe(false);
    expect(getCurrentFocusTask()).toBeNull();
  });

  it('cleans up a native zombie session without creating a database end row', async () => {
    await stopFocusMode('hashed-pin');

    expect(stopService).toHaveBeenCalledWith('hashed-pin');
    expect(setFocusActive).toHaveBeenCalledWith(false, 'hashed-pin');
    expect(setAllowedPackages).toHaveBeenCalledWith([]);
    expect(clearActiveTask).toHaveBeenCalledOnce();
    expect(dbEndFocusSession).not.toHaveBeenCalled();
    expect(dismissPersistentNotification).not.toHaveBeenCalled();
  });
});