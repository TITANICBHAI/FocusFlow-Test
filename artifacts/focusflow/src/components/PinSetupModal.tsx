/**
 * PinSetupModal.tsx
 *
 * Full-screen modal for setting a new password.
 * Two tabs:
 *   "I'll choose"    — user types their own 8+ char password + confirm field + strength bar
 *   "Generate for me" — 16-char random string shown in a non-selectable Text (not TextInput),
 *                       user must check "I've saved this" before saving
 *
 * Handles both pin types:
 *   'focus'   — stores hash via SessionPinModule.setPinHash()
 *   'defense' — stores hash via SharedPrefsModule.putString('defense_pin_hash', hash)
 *
 * This modal only SETS a new password. Verifying/clearing the old one before
 * opening this modal is the caller's responsibility.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  hashPassword,
  generateRandomPassword,
  getPasswordStrength,
  COMMON_WEAK_PASSWORDS,
} from '@/utils/pinCrypto';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  visible: boolean;
  pinType: 'focus' | 'defense';
  onSaved: () => void;
  onCancel: () => void;
}

type Tab = 'choose' | 'generate';

export function PinSetupModal({ visible, pinType, onSaved, onCancel }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>('choose');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [generated, setGenerated] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const strength = getPasswordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const isCommon = COMMON_WEAK_PASSWORDS.has(password.toLowerCase());

  useEffect(() => {
    if (visible) {
      setTab('choose');
      setPassword('');
      setConfirm('');
      setShowPassword(false);
      setShowConfirm(false);
      setGenerated(generateRandomPassword(16));
      setAcknowledged(false);
      setError('');
    }
  }, [visible]);

  const handleRefreshGenerated = () => {
    setGenerated(generateRandomPassword(16));
    setAcknowledged(false);
    setError('');
  };

  const saveHash = async (rawPassword: string) => {
    setSaving(true);
    setError('');
    try {
      const hash = await hashPassword(rawPassword);
      if (pinType === 'focus') {
        await SessionPinModule.setPinHash(hash);
      } else {
        await SharedPrefsModule.putString('defense_pin_hash', hash);
      }
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to save — ${msg || 'please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChoose = async () => {
    if (!strength.valid) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (isCommon) { setError('This password is too common — choose something unique.'); return; }
    await saveHash(password);
  };

  const handleSaveGenerate = async () => {
    if (!acknowledged) { setError('Confirm you have saved this password before continuing.'); return; }
    await saveHash(generated);
  };

  const pinLabel = pinType === 'focus' ? 'Focus Session' : 'Defense';
  const pinDesc =
    pinType === 'focus'
      ? 'Required to end any active focus session. Store it somewhere you can find it mid-session.'
      : 'Shared gate for disabling protections, removing keywords, and modifying always-on blocks.';

  const canSaveChoose = strength.valid && !mismatch && password === confirm && !isCommon && !saving;
  const canSaveGenerate = acknowledged && generated.length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Set {pinLabel} Password
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <View
            style={[
              styles.infoBanner,
              { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '33' },
            ]}
          >
            <Ionicons
              name={pinType === 'focus' ? 'hourglass-outline' : 'shield-half-outline'}
              size={18}
              color={COLORS.primary}
            />
            <Text style={[styles.infoText, { color: theme.text }]}>{pinDesc}</Text>
          </View>

          {/* Tab switcher */}
          <View style={[styles.tabRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'choose' && { backgroundColor: COLORS.primary }]}
              onPress={() => { setTab('choose'); setError(''); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={tab === 'choose' ? '#fff' : theme.muted}
              />
              <Text style={[styles.tabLabel, { color: tab === 'choose' ? '#fff' : theme.muted }]}>
                I'll choose
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'generate' && { backgroundColor: COLORS.primary }]}
              onPress={() => { setTab('generate'); setError(''); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="dice-outline"
                size={15}
                color={tab === 'generate' ? '#fff' : theme.muted}
              />
              <Text style={[styles.tabLabel, { color: tab === 'generate' ? '#fff' : theme.muted }]}>
                Generate for me
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Choose tab ─────────────────────────────────────────── */}
          {tab === 'choose' && (
            <>
              {/* Password field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                  Password (8+ characters)
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface ?? theme.background,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                    placeholderTextColor={theme.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.muted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Strength bar */}
                {password.length > 0 && (
                  <View style={styles.strengthWrap}>
                    <View style={[styles.strengthBar, { backgroundColor: theme.border }]}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: `${strength.barWidth}%` as any,
                            backgroundColor: strength.color,
                          },
                        ]}
                      />
                    </View>
                    {strength.label ? (
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>
                        {strength.label}
                      </Text>
                    ) : null}
                  </View>
                )}

                {isCommon && (
                  <View style={styles.warnRow}>
                    <Ionicons name="warning-outline" size={13} color={COLORS.orange} />
                    <Text style={[styles.warnText, { color: COLORS.orange }]}>
                      This password is too common — choose something more unique.
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>Confirm password</Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: mismatch ? COLORS.red : theme.border,
                      backgroundColor: theme.surface ?? theme.background,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={confirm}
                    onChangeText={(t) => { setConfirm(t); setError(''); }}
                    secureTextEntry={!showConfirm}
                    placeholder="Repeat password"
                    placeholderTextColor={theme.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirm((v) => !v)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.muted}
                    />
                  </TouchableOpacity>
                </View>
                {mismatch && (
                  <Text style={[styles.fieldError, { color: COLORS.red }]}>
                    Passwords do not match
                  </Text>
                )}
              </View>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
                  <Text style={[styles.errorText, { color: COLORS.red }]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: COLORS.primary },
                  !canSaveChoose && { opacity: 0.4 },
                ]}
                onPress={handleSaveChoose}
                disabled={!canSaveChoose}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Set Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ── Generate tab ───────────────────────────────────────── */}
          {tab === 'generate' && (
            <>
              {/* Generated password box */}
              <View
                style={[
                  styles.generateBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.generateHeader}>
                  <Ionicons name="key-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.generateBoxLabel, { color: theme.muted }]}>
                    Your generated password
                  </Text>
                  <TouchableOpacity
                    onPress={handleRefreshGenerated}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {/* Non-selectable text — intentionally not a TextInput */}
                <Text
                  selectable={false}
                  style={[styles.generatedText, { color: theme.text }]}
                >
                  {generated}
                </Text>

                <View
                  style={[
                    styles.generateWarning,
                    {
                      backgroundColor: COLORS.orange + '15',
                      borderColor: COLORS.orange + '44',
                    },
                  ]}
                >
                  <Ionicons name="warning-outline" size={14} color={COLORS.orange} />
                  <Text style={[styles.generateWarningText, { color: COLORS.orange }]}>
                    Write this down now. Once saved, this password is gone — only the hash is
                    stored. There is no recovery option.
                  </Text>
                </View>
              </View>

              {/* Regenerate hint */}
              <Text style={[styles.regenerateHint, { color: theme.muted }]}>
                Tap the refresh icon to get a different password before saving.
              </Text>

              {/* Acknowledgement checkbox */}
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => { setAcknowledged((v) => !v); setError(''); }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: acknowledged ? COLORS.primary : theme.border,
                      backgroundColor: acknowledged ? COLORS.primary : 'transparent',
                    },
                  ]}
                >
                  {acknowledged && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkLabel, { color: theme.text }]}>
                  I have written this password down somewhere safe and won't lose it
                </Text>
              </TouchableOpacity>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
                  <Text style={[styles.errorText, { color: COLORS.red }]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: COLORS.primary },
                  !canSaveGenerate && { opacity: 0.4 },
                ]}
                onPress={handleSaveGenerate}
                disabled={!canSaveGenerate}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Generated Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Security note */}
          <View style={[styles.secNote, { borderTopColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={13} color={theme.muted} />
            <Text style={[styles.secNoteText, { color: theme.muted }]}>
              Your password is hashed with SHA-256 before being stored. The raw password is never
              saved anywhere on this device.
            </Text>
          </View>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 70, alignItems: 'flex-start', paddingVertical: SPACING.xs },
  cancelText: { fontSize: FONT.sm },
  headerTitle: { fontSize: FONT.md, fontWeight: '800' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: FONT.xs, lineHeight: 18 },

  tabRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm ?? 6,
  },
  tabLabel: { fontSize: FONT.sm, fontWeight: '600' },

  fieldGroup: { gap: SPACING.xs },
  fieldLabel: { fontSize: FONT.xs, fontWeight: '600', letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  input: { flex: 1, fontSize: FONT.md, padding: 0, height: 38 },

  strengthWrap: { gap: 4, marginTop: 2 },
  strengthBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: FONT.xs, fontWeight: '600' },

  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  warnText: { fontSize: FONT.xs, lineHeight: 16, flex: 1 },

  fieldError: { fontSize: FONT.xs, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  errorText: { fontSize: FONT.xs, flex: 1, lineHeight: 17 },

  saveBtn: {
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
    minHeight: 50,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.md, fontWeight: '700' },

  generateBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  generateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  generateBoxLabel: { flex: 1, fontSize: FONT.xs, fontWeight: '600' },
  generatedText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    fontFamily: 'monospace',
  },
  generateWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm ?? 6,
    borderWidth: 1,
  },
  generateWarningText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },
  regenerateHint: { fontSize: FONT.xs, textAlign: 'center' },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkLabel: { flex: 1, fontSize: FONT.sm, lineHeight: 20 },

  secNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
  },
  secNoteText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },
});
