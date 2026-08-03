import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

interface Props {
  visible: boolean;
  words: string[];
  locked?: boolean;
  /**
   * When true and a defense PIN is set, any removal (individual or clear-all)
   * requires the user to enter the defense password first.
   * Has no effect when `locked` is true (existing block-active lock takes precedence).
   */
  requireDefensePin?: boolean;
  onSave: (words: string[]) => void | Promise<void>;
  onClose: () => void;
}

/**
 * BlockedWordsModal
 *
 * A dedicated full-screen modal for managing the keyword block list.
 * Words typed here are checked against on-screen text during any active block;
 * if matched, the service redirects the user home.
 */
export function BlockedWordsModal({
  visible,
  words,
  locked = false,
  requireDefensePin = false,
  onSave,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const [localWords, setLocalWords] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Defense PIN verify state
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);
  const pendingRemoveWordRef = useRef<string | 'all' | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLocalWords([...words]);
    setInput('');
  }, [visible]);

  const handleAdd = () => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    if (localWords.includes(trimmed)) {
      Alert.alert('Already added', `"${trimmed}" is already in the list.`);
      return;
    }
    setLocalWords((prev) => [...prev, trimmed]);
    setInput('');
    inputRef.current?.focus();
  };

  /**
   * Checks if defense PIN is needed before calling `action`.
   * Runs action directly only if requireDefensePin is false or no hash is stored.
   * `locked` does NOT bypass the PIN check here — locked items are blocked
   * from removal at the callsite before this function is reached.
   */
  const withDefensePin = (pendingKey: string | 'all', action: () => void) => {
    if (!requireDefensePin) {
      action();
      return;
    }
    SharedPrefsModule.getString('defense_pin_hash')
      .then((hash) => {
        if (!hash) {
          action();
        } else {
          pendingRemoveWordRef.current = pendingKey;
          setPinVerifyVisible(true);
        }
      })
      .catch(() => action());
  };

  const doRemoveWord = (word: string) => {
    setLocalWords((prev) => prev.filter((w) => w !== word));
  };

  const doRemoveAll = () => {
    setLocalWords([]);
  };

  const handleRemove = (word: string) => {
    withDefensePin(word, () => doRemoveWord(word));
  };

  const handleClearAll = () => {
    withDefensePin('all', () => {
      Alert.alert(
        'Clear All Keywords',
        'Remove all blocked keywords?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear All', style: 'destructive', onPress: doRemoveAll },
        ]
      );
    });
  };

  const handlePinVerified = () => {
    setPinVerifyVisible(false);
    const pending = pendingRemoveWordRef.current;
    pendingRemoveWordRef.current = null;
    if (pending === 'all') {
      Alert.alert(
        'Clear All Keywords',
        'Remove all blocked keywords?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear All', style: 'destructive', onPress: doRemoveAll },
        ]
      );
    } else if (pending) {
      doRemoveWord(pending);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localWords);
      onClose();
    } catch (e) {
      console.error('[BlockedWordsModal] save failed', e);
      Alert.alert('Error', 'Failed to save keyword list. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: string }) => (
    <View style={[styles.chip, { backgroundColor: COLORS.red + '12', borderColor: COLORS.red + '40' }]}>
      <Text style={[styles.chipText, { color: COLORS.red }]}>{item}</Text>
      {locked ? (
        <Ionicons name="lock-closed" size={14} color={COLORS.red + '60'} />
      ) : (
        <TouchableOpacity
          onPress={() => handleRemove(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={17} color={COLORS.red} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Ionicons name="text" size={15} color={COLORS.red} />
              <Text style={[styles.title, { color: theme.text }]}>Blocked Keywords</Text>
            </View>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
              <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Lock banner — shown when a block is active */}
          {locked && (
            <View style={[styles.banner, { backgroundColor: COLORS.orange + '18', borderBottomColor: COLORS.orange + '40' }]}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.orange} />
              <Text style={[styles.bannerText, { color: COLORS.orange }]}>
                Block is active — existing keywords are locked. You can add new keywords but cannot remove them until the block expires.
              </Text>
            </View>
          )}

          {/* Defense PIN notice */}
          {requireDefensePin && !locked && (
            <View style={[styles.banner, { backgroundColor: COLORS.primary + '10', borderBottomColor: COLORS.primary + '28' }]}>
              <Ionicons name="shield-half-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.bannerText, { color: COLORS.primary }]}>
                Removing keywords requires your defense password.
              </Text>
            </View>
          )}

          {/* Info banner */}
          <View style={[styles.banner, { backgroundColor: COLORS.red + '10', borderBottomColor: COLORS.red + '28' }]}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.red} />
            <Text style={[styles.bannerText, { color: COLORS.red }]}>
              If any of these words appear on screen during an active block, you are immediately redirected home.
            </Text>
          </View>

          {/* Word input */}
          <View style={[styles.inputRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface ?? theme.background }]}
              placeholder="e.g. youtube, tiktok, shorts"
              placeholderTextColor={theme.muted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!input.trim()}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Word chips list */}
          <FlatList
            data={localWords}
            keyExtractor={(item) => item}
            renderItem={renderItem}
            contentContainerStyle={styles.chipList}
            ListHeaderComponent={
              localWords.length > 0 ? (
                <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
                  {localWords.length} keyword{localWords.length !== 1 ? 's' : ''} — blocked in URLs, searches & on-screen text
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="text-outline" size={40} color={COLORS.border} />
                <Text style={[styles.emptyText, { color: theme.muted }]}>No keywords yet</Text>
                <Text style={[styles.emptyHint, { color: theme.muted }]}>
                  Add a word above and it will be checked against app content during blocking.
                </Text>
              </View>
            }
            ListFooterComponent={
              localWords.length > 1 && !locked ? (
                <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
                  <Ionicons name="trash-outline" size={15} color={COLORS.muted} />
                  <Text style={styles.clearText}>Clear All Keywords</Text>
                </TouchableOpacity>
              ) : null
            }
            keyboardShouldPersistTaps="handled"
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Defense PIN verify */}
      <PinVerifyModal
        visible={pinVerifyVisible}
        pinType="defense"
        title="Defense Password Required"
        description="Enter your defense password to remove keywords from the block list."
        onVerified={handlePinVerified}
        onCancel={() => {
          setPinVerifyVisible(false);
          pendingRemoveWordRef.current = null;
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerBtn: { minWidth: 60, alignItems: 'center', paddingVertical: SPACING.xs },
  cancelText: { fontSize: FONT.sm, color: COLORS.muted },
  saveText: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary, textAlign: 'right' },
  title: { fontSize: FONT.md, fontWeight: '700' },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: FONT.xs,
    lineHeight: 16,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.sm,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: COLORS.primaryLight,
  },

  chipList: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  countLabel: {
    fontSize: FONT.xs,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    marginBottom: SPACING.xs,
  },
  chipText: {
    fontSize: FONT.sm,
    fontWeight: '600',
  },

  emptyWrap: {
    paddingTop: SPACING.xl * 2,
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  emptyText: { fontSize: FONT.md, fontWeight: '600' },
  emptyHint: { fontSize: FONT.xs, textAlign: 'center', lineHeight: 18 },

  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  clearText: { fontSize: FONT.sm, color: COLORS.muted },
});
