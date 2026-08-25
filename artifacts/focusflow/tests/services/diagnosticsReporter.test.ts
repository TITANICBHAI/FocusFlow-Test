import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isAvailableAsync, composeAsync, writeAsStringAsync, deleteAsync } = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  composeAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.9' } },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 35 },
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  documentDirectory: '/documents/',
  writeAsStringAsync,
  deleteAsync,
}));

vi.mock('expo-mail-composer', () => ({
  isAvailableAsync,
  composeAsync,
}));

import { sendDiagnosticsReport } from '@/services/diagnosticsReporter';

describe('diagnosticsReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    isAvailableAsync.mockResolvedValue(true);
    composeAsync.mockResolvedValue({ status: 'saved' });
    writeAsStringAsync.mockResolvedValue(undefined);
    deleteAsync.mockResolvedValue(undefined);
  });

  it('sanitizes sensitive values in the user message and attached report', async () => {
    const result = await sendDiagnosticsReport({
      type: 'bug',
      description: 'Visit https://example.com and contact me@example.com. token: abc123',
      logs: 'api_key=private-value\npassword: hunter2\nwww.example.org/path',
    });

    expect(result).toEqual({ ok: true, status: 'saved' });
    expect(writeAsStringAsync).toHaveBeenCalledWith(
      '/cache/focusflow-diagnostic-report.txt',
      expect.stringContaining('[redacted-url]'),
    );
    const report = writeAsStringAsync.mock.calls[0][1] as string;
    expect(report).toContain('[redacted-email]');
    expect(report).toContain('token=[redacted]');
    expect(report).toContain('api_key=[redacted]');
    expect(report).toContain('password=[redacted]');
    expect(report).not.toContain('private-value');
    expect(report).not.toContain('hunter2');

    expect(composeAsync).toHaveBeenCalledWith(expect.objectContaining({
      recipients: ['tbtechsdev@gmail.com'],
      subject: 'FocusFlow issue report',
      attachments: ['/cache/focusflow-diagnostic-report.txt'],
    }));
    expect(deleteAsync).toHaveBeenCalledWith(
      '/cache/focusflow-diagnostic-report.txt',
      { idempotent: true },
    );
  });

  it('does not create an attachment when no diagnostic logs are provided', async () => {
    await sendDiagnosticsReport({
      type: 'feedback',
      description: '  The focus flow is easy to understand.  ',
      logs: '',
    });

    expect(writeAsStringAsync).not.toHaveBeenCalled();
    expect(composeAsync).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'FocusFlow feedback',
      body: expect.stringContaining('The focus flow is easy to understand.'),
    }));
    expect(composeAsync.mock.calls[0][0]).not.toHaveProperty('attachments');
    expect(deleteAsync).toHaveBeenCalledWith(
      '/cache/focusflow-diagnostic-report.txt',
      { idempotent: true },
    );
  });

  it('returns a safe failure and cleans up when opening the email draft fails', async () => {
    composeAsync.mockRejectedValueOnce(new Error('mail app failed'));

    await expect(sendDiagnosticsReport({
      description: 'Something went wrong',
      logs: 'safe log',
    })).resolves.toEqual({
      ok: false,
      error: 'The email draft could not be opened. Please try again or email support manually.',
    });

    expect(deleteAsync).toHaveBeenCalledWith(
      '/cache/focusflow-diagnostic-report.txt',
      { idempotent: true },
    );
  });

  it('does not prepare a report when no email app is available', async () => {
    isAvailableAsync.mockResolvedValueOnce(false);

    await expect(sendDiagnosticsReport({
      description: 'Cannot send',
      logs: 'details',
    })).resolves.toEqual({
      ok: false,
      error: 'No email app is available. Please email tbtechsdev@gmail.com manually.',
    });

    expect(composeAsync).not.toHaveBeenCalled();
    expect(writeAsStringAsync).not.toHaveBeenCalled();
    expect(deleteAsync).not.toHaveBeenCalled();
  });
});