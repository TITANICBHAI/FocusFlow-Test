import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, changeLanguage } from '@/i18n';
import { useApp } from '@/context/AppContext';

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePickerModal({ visible, onClose }: LanguagePickerModalProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { state, updateSettings } = useApp();

  const currentCode = (i18n.language ?? 'en') as SupportedLanguage;

  const handleSelect = async (code: SupportedLanguage) => {
    await changeLanguage(code);
    await updateSettings({ ...state.settings, language: code });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('settings.language.selectLanguage')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = currentCode.startsWith(lang.code);
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.row,
                    { borderBottomColor: theme.border },
                    isActive && { backgroundColor: COLORS.primary + '14' },
                  ]}
                  onPress={() => void handleSelect(lang.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.nativeLabel, { color: theme.text }]}>
                      {lang.nativeLabel}
                    </Text>
                    <Text style={[styles.engLabel, { color: theme.muted }]}>
                      {lang.label}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.sm,
    maxHeight: '70%',
    ...Platform.select({
      android: { elevation: 8 },
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT.md,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  nativeLabel: {
    fontSize: FONT.md,
    fontWeight: '600',
  },
  engLabel: {
    fontSize: FONT.sm,
  },
});
