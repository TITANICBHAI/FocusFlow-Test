import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { formatLogsForShare } from '@/services/startupLogger';
import {
  sendDiagnosticsReport,
  type DiagnosticsReportType,
} from '@/services/diagnosticsReporter';

type Props = {
  visible: boolean;
  onClose: () => void;
  error?: Error | null;
};

export default function ReportIssueModal({ visible, onClose, error }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState('');
  const [reportType, setReportType] = useState<DiagnosticsReportType>('bug');
  const [includeLogs, setIncludeLogs] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setStatus(null);
    setDescription('');
    setReportType('bug');
    setIncludeLogs(true);
    void formatLogsForShare().then(setLogs).catch(() => setLogs('(logs unavailable)'));
  }, [visible]);

  const handleOpenDraft = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);

    const errorDetails = error
      ? `Error screen message: ${error.message}\nStack trace:\n${error.stack ?? '(unavailable)'}\n\n`
      : '';
    const result = await sendDiagnosticsReport({
      description,
      logs: includeLogs ? `${errorDetails}${logs}` : '',
      type: reportType,
    });

    setBusy(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    if (result.status === 'sent') {
      setStatus('Email composer closed. If you tapped Send, the email was sent; otherwise nothing was sent.');
    } else if (result.status === 'saved') {
      setStatus('Draft saved in your email app. Nothing was sent until you chose Send.');
    } else if (result.status === 'cancelled') {
      setStatus('Email draft cancelled. Nothing was sent.');
    } else {
      setStatus('Email draft closed. Check your email app to review or send it.');
    }
    setDescription('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitle}>
              <Ionicons name="paper-plane-outline" size={20} color="#6366F1" />
              <Text style={[styles.title, { color: theme.text }]}>Report this issue</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close report form">
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: isDark ? 'rgba(99,102,241,0.14)' : '#EEF2FF',
                  borderColor: isDark ? 'rgba(129,140,248,0.35)' : '#C7D2FE',
                },
              ]}
            >
              <Ionicons name="information-circle-outline" size={21} color="#6366F1" />
              <Text style={[styles.noticeText, { color: theme.text }]}>
                This opens your email app with a draft addressed to tbtechsdev@gmail.com and a sanitized .txt attachment. Review it and tap Send yourself—nothing is sent automatically.
              </Text>
            </View>

            <Text style={[styles.label, { color: theme.text }]}>What would you like to share?</Text>
            <View style={styles.typeOptions}>
              {([
                ['bug', 'Bug report', 'alert-circle-outline'],
                ['feedback', 'Feedback / opinion', 'chatbubble-ellipses-outline'],
                ['review', 'App review', 'star-outline'],
              ] as const).map(([value, label, icon]) => {
                const selected = reportType === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setReportType(value)}
                    style={[
                      styles.typeOption,
                      {
                        backgroundColor: selected
                          ? isDark
                            ? 'rgba(99,102,241,0.2)'
                            : '#EEF2FF'
                          : isDark
                            ? '#1C1C1E'
                            : '#F2F2F7',
                        borderColor: selected ? '#6366F1' : theme.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                  >
                    <Ionicons
                      name={icon}
                      size={16}
                      color={selected ? '#6366F1' : theme.textSecondary ?? '#888'}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        { color: selected ? '#6366F1' : theme.text },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>
              {reportType === 'bug' ? 'What happened?' : 'What would you like to share?'}
            </Text>
            <Text style={[styles.helper, { color: theme.textSecondary ?? '#888' }]}>
              {reportType === 'bug'
                ? 'Tell us what you were doing and how the error appeared. This is optional, but it helps us reproduce the problem.'
                : 'Your message is optional, but it helps us understand your experience and improve FocusFlow.'}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="For example: I opened Settings, tapped Manage Permissions, and the app showed an error."
              placeholderTextColor={theme.muted ?? '#888'}
              multiline
              maxLength={2_000}
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                  borderColor: theme.border,
                },
              ]}
            />

            <Pressable
              style={styles.logsOption}
              onPress={() => setIncludeLogs((current) => !current)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: includeLogs }}
            >
              <View style={[styles.checkbox, includeLogs && styles.checkboxChecked]}>
                {includeLogs && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <View style={styles.logsOptionCopy}>
                <Text style={[styles.logsOptionTitle, { color: theme.text }]}>
                  Include diagnostic logs
                </Text>
                <Text style={[styles.logsOptionDescription, { color: theme.textSecondary ?? '#888' }]}>
                  Add recent sanitized logs as an attachment when available.
                </Text>
              </View>
            </Pressable>

            <Text style={[styles.included, { color: theme.textSecondary ?? '#888' }]}>
              Your message stays in the email for easy review. If selected and available, sanitized diagnostic logs are attached separately. Personal files, contacts, installed-app lists, and location are not included.
            </Text>

            {status ? (
              <View style={styles.statusRow}>
                <Ionicons
                  name={
                    status.startsWith('Email composer closed') || status.startsWith('Draft saved')
                      ? 'checkmark-circle'
                      : 'alert-circle'
                  }
                  size={18}
                  color={
                    status.startsWith('Email composer closed') || status.startsWith('Draft saved')
                      ? '#34C759'
                      : '#FF9500'
                  }
                />
                <Text style={[styles.statusText, { color: theme.text }]}>{status}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleOpenDraft}
              disabled={busy}
              style={({ pressed }) => [
                styles.sendButton,
                { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open email draft with diagnostic report"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
              <Text style={styles.sendText}>{busy ? 'Preparing draft…' : 'Open email draft'}</Text>
            </Pressable>

            <Pressable onPress={onClose} disabled={busy} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: theme.textSecondary ?? '#888' }]}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    gap: 12,
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -5,
  },
  input: {
    minHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  logsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#A1A1AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  logsOptionCopy: { flex: 1, gap: 2 },
  logsOptionTitle: { fontSize: 14, fontWeight: '600' },
  logsOptionDescription: { fontSize: 12, lineHeight: 17 },
  included: {
    fontSize: 12,
    lineHeight: 17,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 2,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sendButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  sendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});