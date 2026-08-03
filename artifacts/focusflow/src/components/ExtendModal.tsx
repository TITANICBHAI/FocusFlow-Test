import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  visible: boolean;
  taskId: string;
  onClose: () => void;
  onExtend: (taskId: string, extraMinutes: number) => Promise<void>;
}

const OPTIONS = [10, 15, 20, 30, 45, 60];

export default function ExtendModal({ visible, taskId, onClose, onExtend }: Props) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleExtend = async (mins: number) => {
    setLoading(true);
    try {
      await onExtend(taskId, mins);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Need more time?</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Choose how much extra time to add.{'\n'}Subsequent tasks will shift forward.
          </Text>

          <View style={styles.grid}>
            {OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={styles.option}
                onPress={() => handleExtend(m)}
                disabled={loading}
              >
                <Text style={styles.optionText}>+{m}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: FONT.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  option: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  optionText: {
    fontSize: FONT.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    fontSize: FONT.md,
    fontWeight: '600',
  },
});
