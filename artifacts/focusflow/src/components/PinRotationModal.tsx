/**
 * PinRotationModal.tsx
 *
 * Shown whenever a PIN-gated action starts (focus session begin, always-on
 * enforcement toggled off) to enforce periodic password rotation.
 *
 * Three choices on step 1:
 *   "Keep same password"  — available up to MAX_DAILY_REUSES times per day.
 *   "Set new password"    — user types a custom 8+ char password (step 2a).
 *   "Auto-generate"       — a random 16-char password is shown (step 2b).
 *
 * pinType:        'focus'   → stores via SessionPinModule
 *                 'defense' → stores via SharedPrefsModule 'defense_pin_hash'
 * reuseTrackerKey: which daily counter to use ('focus' | 'alwayson')
 *
 * onComplete() is called after the PIN is either kept or updated, so the
 * caller can proceed with the action (start session, disable enforcement).
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
import {
  getPinReuseInfo,
  recordPinReuse,
  MAX_DAILY_REUSES,
  type ReuseTrackerKey,
} from '@/utils/pinReuseTracker';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

type PinType = 'focus' | 'defense';
type Step = 'choose' | 'custom' | 'generate';

interface Props {
  visible: boolean;
  pinType: PinType;
  reuseTrackerKey: ReuseTrackerKey;
  /** Label shown in the header, e.g. "Start Focus Session" */
  actionLabel: string;
  /** Short description of what this PIN gates */
  actionDescription: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function PinRotationModal({
  visible,
  pinType,
  reuseTrackerKey,
  actionLabel,
  actionDescription,
  onComplete,
  onCancel,
}: Props) {
  const { theme } = useTheme();

  const [step, setStep] = useState<Step>('choose');
  const [reuseCount, setReuseCount] = useState(0);
  const [canReuse, setCanReuse] = useState(true);
  const [loadingReuseInfo, setLoadingReuseInfo] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [generated, setGenerated] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStep('choose');
    setPassword('');
    setConfirm('');
    setShowPw(false);
    setShowConfirm(false);
    setGenerated(generateRandomPassword(16));
    setAcknowledged(false);
    setError('');
    setSaving(false);
    setLoadingReuseInfo(true);
    getPinReuseInfo(reuseTrackerKey).then(({ count, canReuse: cr }) => {
      setReuseCount(count);
      setCanReuse(cr);
      setLoadingReuseInfo(false);
    });
  }, [visible, reuseTrackerKey]);

  const saveHash = async (raw: string) => {
    setSaving(true);
    setError('');
    try {
      const hash = await hashPassword(raw);
      if (pinType === 'focus') {
        await SessionPinModule.setPinHash(hash);
      } else {
        await SharedPrefsModule.putString('defense_pin_hash', hash);
      }
      onComplete();
    } catch {
      setError('Failed to save password — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeepSame = async () => {
    setSaving(true);
    try {
      await recordPinReuse(reuseTrackerKey);
      onComplete();
    } catch {
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const strength = getPasswordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const isCommon = COMMON_WEAK_PASSWORDS.has(password.toLowerCase());
  const canSaveCustom =
    strength.valid && !mismatch && password === confirm && !isCommon && !saving;
  const canSaveGenerated = acknowledged && generated.length > 0 && !saving;

  const handleSaveCustom = async () => {
    if (!strength.valid) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (isCommon) { setError('This password is too common — choose something unique.'); return; }
    await saveHash(password);
  };

  const handleSaveGenerated = async () => {
    if (!acknowledged) { setError('Confirm you have saved this password before continuing.'); return; }
    await saveHash(generated);
  };

  const remainingReuses = Math.max(0, MAX_DAILY_REUSES - reuseCount);

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
          <TouchableOpacity onPress={onCancel} style={styles.headerSide}>
            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {actionLabel}
          </Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── STEP: CHOOSE ─────────────────────────────────────────────── */}
          {step === 'choose' && (
            <>
              {/* Context banner */}
              <View style={[styles.banner, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '33' }]}>
                <Ionicons name="shield-half-outline" size={18} color={COLORS.primary} />
                <Text style={[styles.bannerText, { color: theme.text }]}>
                  {actionDescription}
                  {'\n'}
                  <Text style={{ color: theme.muted, fontSize: FONT.xs }}>
                    Choose the password that will protect this action.
                  </Text>
                </Text>
              </View>

              {loadingReuseInfo ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.xl }} />
              ) : (
                <>
                  {/* Keep same */}
                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      !canReuse && styles.optionDisabled,
                    ]}
                    onPress={canReuse ? handleKeepSame : undefined}
                    disabled={!canReuse || saving}
                    activeOpacity={canReuse ? 0.75 : 1}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: COLORS.primary + '1A' }]}>
                      <Ionicons name="refresh-circle-outline" size={24} color={canReuse ? COLORS.primary : theme.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: canReuse ? theme.text : theme.muted }]}>
                        Keep same password
                      </Text>
                      <Text style={[styles.optionDesc, { color: theme.muted }]}>
                        {canReuse
                          ? `${remainingReuses} of ${MAX_DAILY_REUSES} reuse${remainingReuses !== 1 ? 's' : ''} remaining today`
                          : `Daily limit reached — must set a new password`}
                      </Text>
                    </View>
                    {saving && <ActivityIndicator size="small" color={COLORS.primary} />}
                    {canReuse && !saving && (
                      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                    )}
                  </TouchableOpacity>

                  {/* Set new custom */}
                  <TouchableOpacity
                    style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => { setStep('custom'); setError(''); }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: COLORS.orange + '1A' }]}>
                      <Ionicons name="create-outline" size={24} color={COLORS.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>Set new password</Text>
                      <Text style={[styles.optionDesc, { color: theme.muted }]}>
                        Choose your own 8+ character password
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                  </TouchableOpacity>

                  {/* Auto-generate */}
                  <TouchableOpacity
                    style={[styles.optionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => { setStep('generate'); setError(''); }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: COLORS.green + '1A' }]}>
                      <Ionicons name="dice-outline" size={24} color={COLORS.green} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>Auto-generate</Text>
                      <Text style={[styles.optionDesc, { color: theme.muted }]}>
                        A random 16-char password — write it down before continuing
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                  </TouchableOpacity>

                  {/* Daily reuse indicator */}
                  <View style={styles.reuseRow}>
                    {Array.from({ length: MAX_DAILY_REUSES }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.reuseDot,
                          { backgroundColor: i < reuseCount ? COLORS.orange : theme.border },
                        ]}
                      />
                    ))}
                    <Text style={[styles.reuseLabel, { color: theme.muted }]}>
                      {reuseCount}/{MAX_DAILY_REUSES} reuses used today
                    </Text>
                  </View>

                  {/* Skip — always available, PIN is optional */}
                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={onComplete}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.skipText, { color: theme.muted }]}>
                      Skip — proceed without changing password
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* ── STEP: CUSTOM ─────────────────────────────────────────────── */}
          {step === 'custom' && (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => { setStep('choose'); setError(''); }}>
                <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
                <Text style={[styles.backLabel, { color: COLORS.primary }]}>Back</Text>
              </TouchableOpacity>

              {/* Password field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>New password (8+ characters)</Text>
                <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surface ?? theme.background }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPw}
                    placeholder="Enter password"
                    placeholderTextColor={theme.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.muted} />
                  </TouchableOpacity>
                </View>
                {password.length > 0 && (
                  <View style={styles.strengthWrap}>
                    <View style={[styles.strengthBar, { backgroundColor: theme.border }]}>
                      <View style={[styles.strengthFill, { width: `${strength.barWidth}%` as any, backgroundColor: strength.color }]} />
                    </View>
                    {strength.label ? <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text> : null}
                  </View>
                )}
                {isCommon && (
                  <View style={styles.warnRow}>
                    <Ionicons name="warning-outline" size={13} color={COLORS.orange} />
                    <Text style={[styles.warnText, { color: COLORS.orange }]}>Too common — pick something unique.</Text>
                  </View>
                )}
              </View>

              {/* Confirm field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.muted }]}>Confirm password</Text>
                <View style={[styles.inputWrap, { borderColor: mismatch ? COLORS.red : theme.border, backgroundColor: theme.surface ?? theme.background }]}>
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
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.muted} />
                  </TouchableOpacity>
                </View>
                {mismatch && <Text style={[styles.fieldError, { color: COLORS.red }]}>Passwords do not match</Text>}
              </View>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
                  <Text style={[styles.errorText, { color: COLORS.red }]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: COLORS.primary }, !canSaveCustom && { opacity: 0.4 }]}
                onPress={handleSaveCustom}
                disabled={!canSaveCustom}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Set Password & Continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP: GENERATE ───────────────────────────────────────────── */}
          {step === 'generate' && (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => { setStep('choose'); setError(''); }}>
                <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
                <Text style={[styles.backLabel, { color: COLORS.primary }]}>Back</Text>
              </TouchableOpacity>

              <View style={[styles.generateBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.generateHeader}>
                  <Ionicons name="key-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.generateBoxLabel, { color: theme.muted, flex: 1 }]}>Your generated password</Text>
                  <TouchableOpacity
                    onPress={() => { setGenerated(generateRandomPassword(16)); setAcknowledged(false); setError(''); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                <Text selectable={false} style={[styles.generatedText, { color: theme.text }]}>
                  {generated}
                </Text>
                <View style={[styles.generateWarning, { backgroundColor: COLORS.orange + '15', borderColor: COLORS.orange + '44' }]}>
                  <Ionicons name="warning-outline" size={14} color={COLORS.orange} />
                  <Text style={[styles.generateWarningText, { color: COLORS.orange }]}>
                    Write this down now. Only the hash is stored — there is no recovery option.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => { setAcknowledged(v => !v); setError(''); }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, { borderColor: acknowledged ? COLORS.primary : theme.border, backgroundColor: acknowledged ? COLORS.primary : 'transparent' }]}>
                  {acknowledged && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkLabel, { color: theme.text }]}>
                  I have written this password down somewhere safe
                </Text>
              </TouchableOpacity>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
                  <Text style={[styles.errorText, { color: COLORS.red }]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: COLORS.primary }, !canSaveGenerated && { opacity: 0.4 }]}
                onPress={handleSaveGenerated}
                disabled={!canSaveGenerated}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save & Continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Security note */}
          <View style={[styles.secNote, { borderTopColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={13} color={theme.muted} />
            <Text style={[styles.secNoteText, { color: theme.muted }]}>
              Passwords are hashed with SHA-256. The raw password is never stored anywhere on this device.
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
  headerSide: { minWidth: 70 },
  cancelText: { fontSize: FONT.sm },
  headerTitle: { fontSize: FONT.md, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: FONT.sm, lineHeight: 20 },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  optionDisabled: { opacity: 0.45 },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionTitle: { fontSize: FONT.sm, fontWeight: '700', marginBottom: 2 },
  optionDesc: { fontSize: FONT.xs, lineHeight: 16 },

  reuseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
  },
  reuseDot: { width: 10, height: 10, borderRadius: 5 },
  reuseLabel: { fontSize: FONT.xs, marginLeft: SPACING.xs },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  backLabel: { fontSize: FONT.sm, fontWeight: '600' },

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
  strengthBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: FONT.xs, fontWeight: '600' },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  warnText: { fontSize: FONT.xs, lineHeight: 16, flex: 1 },
  fieldError: { fontSize: FONT.xs, fontWeight: '600' },

  generateBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  generateHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  generateBoxLabel: { fontSize: FONT.xs, fontWeight: '600' },
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

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkLabel: { flex: 1, fontSize: FONT.sm, lineHeight: 20 },

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

  secNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: SPACING.sm,
  },
  secNoteText: { flex: 1, fontSize: FONT.xs, lineHeight: 17 },

  skipBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  skipText: {
    fontSize: FONT.xs,
    textDecorationLine: 'underline',
  },
});
