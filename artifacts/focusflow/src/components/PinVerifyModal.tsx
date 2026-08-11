/**
 * PinVerifyModal.tsx
 *
 * A focused overlay modal that asks the user to enter their password and
 * verifies it against the stored SHA-256 hash.
 *
 * Supports two pin types:
 *   'focus'   — checks SessionPinModule (native SharedPreferences)
 *   'defense' — checks SharedPrefsModule key 'defense_pin_hash'
 *
 * onVerified receives the SHA-256 hash of the entered password so callers
 * that need it (e.g. SessionPinModule.clearPin) can use it directly.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hashPassword } from '@/utils/pinCrypto';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  visible: boolean;
  pinType: 'focus' | 'defense';
  title?: string;
  description?: string;
  /** Called with the SHA-256 hex of the entered password on success. */
  onVerified: (passwordHash: string) => void;
  onCancel: () => void;
}

export function PinVerifyModal({
  visible,
  pinType,
  title,
  description,
  onVerified,
  onCancel,
}: Props) {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError('');
      setAttempts(0);
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError('Enter your password to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const hash = await hashPassword(password);
      let correct = false;

      if (pinType === 'focus') {
        correct = await SessionPinModule.verifyPin(hash);
      } else {
        const stored = await SharedPrefsModule.getString('defense_pin_hash');
        correct = !!stored && stored === hash;
      }

      if (correct) {
        setPassword('');
        setAttempts(0);
        onVerified(hash);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setPassword('');
        shake();
        if (next >= 3) {
          setError('Incorrect password. Check where you stored it when you set it up.');
        } else {
          setError(`Incorrect password. ${3 - next} attempt${3 - next !== 1 ? 's' : ''} left before hint.`);
        }
      }
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError('');
    setAttempts(0);
    onCancel();
  };

  const resolvedTitle =
    title ?? (pinType === 'focus' ? 'Focus Session Password' : 'Defense Password');
  const resolvedDesc =
    description ??
    (pinType === 'focus'
      ? 'Enter your focus session password to continue.'
      : 'Enter your defense password to continue.');

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    pinType === 'focus' ? 'hourglass-outline' : 'shield-half-outline';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleCancel}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: theme.card, transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + '1A' }]}>
            <Ionicons name={iconName} size={30} color={COLORS.primary} />
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: theme.text }]}>{resolvedTitle}</Text>
          <Text style={[styles.desc, { color: theme.muted }]}>{resolvedDesc}</Text>

          {/* Password field */}
          <View
            style={[
              styles.inputWrap,
              {
                borderColor: error ? COLORS.red : theme.border,
                backgroundColor: theme.surface ?? theme.background,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text }]}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError('');
              }}
              secureTextEntry={!showPassword}
              placeholder="Enter password"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
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

          {/* Error */}
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel, { borderColor: theme.border }]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: theme.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnConfirm,
                { backgroundColor: COLORS.primary },
                loading && { opacity: 0.6 },
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.btnText, { color: '#fff', fontWeight: '700' }]}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: '100%',
    borderRadius: RADIUS.xl ?? 20,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  title: { fontSize: FONT.lg, fontWeight: '800', textAlign: 'center' },
  desc: { fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  input: {
    flex: 1,
    fontSize: FONT.md,
    padding: 0,
    height: 38,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    width: '100%',
  },
  errorText: { fontSize: FONT.xs, color: COLORS.red, flex: 1, lineHeight: 17 },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnCancel: { borderWidth: 1 },
  btnConfirm: {},
  btnText: { fontSize: FONT.sm },
});
