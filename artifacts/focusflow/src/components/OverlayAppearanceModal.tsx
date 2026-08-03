import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeImagePickerModule } from '@/native-modules/NativeImagePickerModule';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function OverlayAppearanceModal({ visible, onClose }: Props) {
  const { state, updateSettings } = useApp();
  const { settings } = state;
  const { theme } = useTheme();

  const [quotes, setQuotes] = useState<string[]>([]);
  const [draftQuote, setDraftQuote] = useState('');
  const [wallpaperPath, setWallpaperPath] = useState('');

  useEffect(() => {
    if (!visible) return;
    setQuotes(settings.overlayQuotes ?? []);
    setWallpaperPath(settings.overlayWallpaper ?? '');
    setDraftQuote('');
  }, [visible]);

  const syncQuotes = async (newQuotes: string[]) => {
    setQuotes(newQuotes);
    await updateSettings({ ...settings, overlayQuotes: newQuotes });
    await SharedPrefsModule.putString(
      'block_overlay_quotes',
      newQuotes.length ? JSON.stringify(newQuotes) : '',
    );
  };

  const syncWallpaper = async (path: string) => {
    setWallpaperPath(path);
    await updateSettings({ ...settings, overlayWallpaper: path });
    await SharedPrefsModule.putString('block_overlay_wallpaper', path);
  };

  const handlePickImage = async () => {
    try {
      const uri = await NativeImagePickerModule.pickImage();
      if (uri) {
        const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
        await syncWallpaper(path);
      }
    } catch {
      Alert.alert(
        'Could Not Pick Image',
        'Please grant photo library access in Settings, then try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleRemoveWallpaper = async () => {
    await syncWallpaper('');
  };

  const handleAddQuote = async () => {
    const trimmed = draftQuote.trim();
    if (!trimmed) return;
    if (quotes.includes(trimmed)) {
      Alert.alert('Duplicate', 'This quote is already in your list.');
      return;
    }
    await syncQuotes([...quotes, trimmed]);
    setDraftQuote('');
  };

  const handleRemoveQuote = async (index: number) => {
    await syncQuotes(quotes.filter((_, i) => i !== index));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Overlay Appearance</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Background section ─────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>BACKGROUND IMAGE</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionDesc, { color: theme.muted }]}>
              Pick an image from your gallery to use as the overlay background. Leave empty to keep the built-in dark gradient.
            </Text>

            {wallpaperPath ? (
              <View style={[styles.pathRow, { borderTopColor: theme.border }]}>
                <Ionicons name="image-outline" size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
                <Text style={[styles.pathText, { color: theme.text }]} numberOfLines={3}>
                  {wallpaperPath}
                </Text>
                <TouchableOpacity onPress={handleRemoveWallpaper} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.noWallpaperRow, { borderTopColor: theme.border }]}>
                <Ionicons name="color-palette-outline" size={16} color={theme.muted} />
                <Text style={[styles.noWallpaperText, { color: theme.muted }]}>
                  Using built-in gradient background
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionRow, { borderTopColor: theme.border }]}
              onPress={handlePickImage}
            >
              <Ionicons name="images-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.actionText, { color: COLORS.primary }]}>
                {wallpaperPath ? 'Change Image' : 'Pick from Gallery'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Quotes section ─────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>CUSTOM QUOTES</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionDesc, { color: theme.muted }]}>
              These rotate randomly on the overlay. Leave empty to use the 15 built-in focus quotes.
            </Text>

            <View style={[styles.addRow, { borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
                placeholder="Type a motivating quote…"
                placeholderTextColor={theme.muted}
                value={draftQuote}
                onChangeText={setDraftQuote}
                onSubmitEditing={handleAddQuote}
                returnKeyType="done"
                multiline
              />
              <TouchableOpacity
                style={[styles.addBtn, !draftQuote.trim() && styles.addBtnDisabled]}
                onPress={handleAddQuote}
                disabled={!draftQuote.trim()}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {quotes.length === 0 ? (
              <View style={[styles.emptyRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.muted }]}>
                  No custom quotes — built-in pool active
                </Text>
              </View>
            ) : (
              quotes.map((q, i) => (
                <View key={i} style={[styles.quoteRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.quoteText, { color: theme.text }]} numberOfLines={4}>
                    {`\u201C${q}\u201D`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveQuote(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={COLORS.red} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <Text style={[styles.hint, { color: theme.muted }]}>
            Changes apply immediately — next time a block overlay appears it will use the settings above.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: FONT.lg, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: 48 },
  sectionTitle: {
    fontSize: FONT.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionDesc: {
    fontSize: FONT.xs,
    lineHeight: 18,
    padding: SPACING.md,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    gap: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pathText: { flex: 1, fontSize: FONT.xs, lineHeight: 16 },
  noWallpaperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noWallpaperText: { fontSize: FONT.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionText: { fontSize: FONT.sm, fontWeight: '600' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: FONT.sm,
    minHeight: 44,
    maxHeight: 120,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.35 },
  emptyRow: {
    padding: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  emptyText: { fontSize: FONT.sm },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
  },
  quoteText: {
    flex: 1,
    fontSize: FONT.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  hint: {
    fontSize: FONT.xs,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 16,
  },
});
