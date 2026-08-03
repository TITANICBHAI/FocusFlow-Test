/**
 * DiagnosticsModal.tsx
 *
 * Developer-facing diagnostics screen showing the last 100 startup log entries
 * with colour-coded severity. Accessible from Settings.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { clearLogs, formatLogsForShare, getRecentLogs, type LogEntry } from '@/services/startupLogger';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#5AC8FA',
  INFO: '#34C759',
  WARN: '#FF9500',
  ERROR: '#FF3B30',
};

function LogRow({ item, monoFont }: { item: LogEntry; monoFont: string }) {
  const color = LEVEL_COLORS[item.level] ?? '#888';
  const time = item.ts.slice(11, 23);
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.level, { color }]}>{item.level.padEnd(5)}</Text>
      <View style={rowStyles.body}>
        <Text style={[rowStyles.tag, { fontFamily: monoFont }]}>{item.tag}</Text>
        <Text style={[rowStyles.time, { fontFamily: monoFont }]}>{time}</Text>
        <Text style={[rowStyles.msg, { fontFamily: monoFont }]} selectable>{item.message}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    gap: 8,
  },
  level: {
    fontSize: 10,
    fontWeight: '700',
    width: 38,
    paddingTop: 2,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  tag: {
    fontSize: 9,
    color: '#888',
  },
  time: {
    fontSize: 9,
    color: '#888',
  },
  msg: {
    fontSize: 11,
    lineHeight: 16,
  },
});

export default function DiagnosticsModal({ visible, onClose }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getRecentLogs(200);
      setLogs([...entries].reverse());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handleCopy = async () => {
    try {
      const text = await formatLogsForShare();
      await Share.share({ message: text, title: 'FocusFlow Diagnostics' });
    } catch {
      Alert.alert('Error', 'Could not share logs.');
    }
  };

  const handleClear = () => {
    Alert.alert('Clear Logs', 'Delete all diagnostic logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await clearLogs();
          setLogs([]);
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Diagnostics</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={handleCopy} style={styles.headerBtn} accessibilityLabel="Copy all logs">
              <Ionicons name="copy-outline" size={20} color={theme.text} />
            </Pressable>
            <Pressable onPress={handleClear} style={styles.headerBtn} accessibilityLabel="Clear logs">
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </Pressable>
            <Pressable onPress={onClose} style={styles.headerBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.legend, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
          {Object.entries(LEVEL_COLORS).map(([level, color]) => (
            <View key={level} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary ?? '#888' }]}>{level}</Text>
            </View>
          ))}
          <Text style={[styles.legendText, { color: theme.textSecondary ?? '#888', marginLeft: 'auto' }]}>
            {logs.length} entries (newest first)
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <Text style={{ color: theme.text }}>Loading…</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ color: theme.textSecondary ?? '#888' }}>No logs yet.</Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => <LogRow item={item} monoFont={monoFont ?? 'monospace'} />}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            style={{ backgroundColor: theme.background }}
          />
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
          <Pressable onPress={load} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color={theme.text} />
            <Text style={[styles.refreshText, { color: theme.text }]}>Refresh</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
