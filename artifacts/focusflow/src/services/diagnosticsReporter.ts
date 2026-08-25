import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';

const SUPPORT_EMAIL = 'tbtechsdev@gmail.com';
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_LOG_LENGTH = 18_000;

export type DiagnosticsReportType = 'bug' | 'feedback' | 'review';

export type DiagnosticsReportInput = {
  description: string;
  logs: string;
  type?: DiagnosticsReportType;
};

function sanitize(value: string, maxLength: number): string {
  return value
    .replace(/\bhttps?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\bwww\.\S+/gi, '[redacted-url]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, maxLength);
}

function buildReport(input: DiagnosticsReportInput): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const type = input.type ?? 'bug';
  const description = sanitize(input.description.trim(), MAX_DESCRIPTION_LENGTH) || '(no description provided)';
  const logs = sanitize(input.logs, MAX_LOG_LENGTH);
  const typeLabel = type === 'review' ? 'App review' : type === 'feedback' ? 'Feedback / opinion' : 'Bug report';

  return [
    'FocusFlow diagnostic report',
    '',
    `Report type: ${typeLabel}`,
    `App version: ${version}`,
    `Platform: ${Platform.OS}`,
    `OS version: ${String(Platform.Version)}`,
    '',
    'User description:',
    description,
    '',
    ...(logs ? ['Diagnostic details:', logs, ''] : []),
  ].join('\n');
}

export async function sendDiagnosticsReport(
  input: DiagnosticsReportInput,
): Promise<
  | { ok: true; status: MailComposer.MailComposerResult['status'] }
  | { ok: false; error: string }
> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      error: `Please email ${SUPPORT_EMAIL} from a phone to attach the diagnostic file.`,
    };
  }

  const available = await MailComposer.isAvailableAsync();
  if (!available) {
    return {
      ok: false,
      error: `No email app is available. Please email ${SUPPORT_EMAIL} manually.`,
    };
  }

  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  const sanitizedLogs = sanitize(input.logs, MAX_LOG_LENGTH);
  if (sanitizedLogs && !directory) {
    return {
      ok: false,
      error: 'FocusFlow could not create the diagnostic attachment on this device.',
    };
  }

  const attachmentUri = `${directory}focusflow-diagnostic-report.txt`;
  const subject =
    input.type === 'review'
      ? 'FocusFlow app review'
      : input.type === 'feedback'
        ? 'FocusFlow feedback'
        : 'FocusFlow issue report';
  const messageIntro =
    input.type === 'review'
      ? 'I would like to share a review of FocusFlow.'
      : input.type === 'feedback'
        ? 'I would like to share feedback about FocusFlow.'
        : 'I am reporting an issue with FocusFlow.';

  try {
    const attachments: string[] = [];
    if (sanitizedLogs) {
      await FileSystem.writeAsStringAsync(attachmentUri, buildReport(input));
      attachments.push(attachmentUri);
    }
    const userMessage = sanitize(input.description.trim(), MAX_DESCRIPTION_LENGTH);
    const result = await MailComposer.composeAsync({
      recipients: [SUPPORT_EMAIL],
      subject,
      body: [
        'Hello FocusFlow team,',
        '',
        messageIntro,
        '',
        'User message:',
        userMessage || '(no description provided)',
        ...(sanitizedLogs
          ? ['', 'Sanitized diagnostic logs are attached as a .txt file for additional context.']
          : []),
        '',
        'Please review this draft and tap Send when you are ready.',
      ].join('\n'),
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    return { ok: true, status: result.status };
  } catch (error) {
    console.error('Could not prepare diagnostic email:', error);
    return {
      ok: false,
      error: 'The email draft could not be opened. Please try again or email support manually.',
    };
  } finally {
    await FileSystem.deleteAsync(attachmentUri, { idempotent: true }).catch(() => undefined);
  }
}