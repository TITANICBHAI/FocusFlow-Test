import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getString, putString } = vi.hoisted(() => ({
  getString: vi.fn<(key: string) => Promise<string | null>>(),
  putString: vi.fn<(key: string, value: string) => Promise<void>>(),
}));

vi.mock('@/native-modules/SharedPrefsModule', () => ({
  SharedPrefsModule: { getString, putString },
}));

import {
  MAX_DAILY_REUSES,
  getPinReuseInfo,
  recordPinReuse,
} from '@/utils/pinReuseTracker';

describe('pinReuseTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    getString.mockReset();
    putString.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero and allows reuse when native storage is empty', async () => {
    getString.mockResolvedValue(null);

    await expect(getPinReuseInfo('focus')).resolves.toEqual({
      count: 0,
      canReuse: true,
    });
    expect(getString).toHaveBeenCalledWith('pin_reuse_date_focus');
    expect(getString).toHaveBeenCalledWith('pin_reuse_count_focus');
  });

  it('resets a stale local-date count and rejects negative stored counts', async () => {
    getString.mockImplementation(async (key) =>
      key === 'pin_reuse_date_alwayson' ? '2026-08-23' : '-2',
    );

    await expect(getPinReuseInfo('alwayson')).resolves.toEqual({
      count: 0,
      canReuse: true,
    });
  });

  it('disallows reuse at the daily cap', async () => {
    getString.mockImplementation(async (key) =>
      key === 'pin_reuse_date_focus' ? '2026-08-24' : String(MAX_DAILY_REUSES),
    );

    await expect(getPinReuseInfo('focus')).resolves.toEqual({
      count: MAX_DAILY_REUSES,
      canReuse: false,
    });
  });

  it('records the next reuse count and today local date', async () => {
    getString.mockImplementation(async (key) =>
      key === 'pin_reuse_date_focus' ? '2026-08-24' : '2',
    );
    putString.mockResolvedValue(undefined);

    await recordPinReuse('focus');

    expect(putString).toHaveBeenCalledWith('pin_reuse_count_focus', '3');
    expect(putString).toHaveBeenCalledWith('pin_reuse_date_focus', '2026-08-24');
  });

  it('fails conservatively without crashing when native reads reject', async () => {
    getString.mockRejectedValue(new Error('native unavailable'));

    await expect(getPinReuseInfo('focus')).resolves.toEqual({
      count: 0,
      canReuse: true,
    });
  });
});