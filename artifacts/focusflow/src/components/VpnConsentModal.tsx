/**
 * VpnConsentModal
 *
 * Shown BEFORE the Android system VPN consent dialog so users understand what
 * the VPN actually does — in plain language — rather than being surprised by
 * the scary "This app may monitor all your network traffic" system prompt.
 *
 * Key messages:
 *   • It's a LOCAL null-routing tunnel — nothing is sent externally.
 *   • It's one-time permission that persists until revoked.
 *   • Android only allows one VPN at a time (conflict info).
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function VpnConsentModal({ visible, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.primary} />
            </View>
          </View>

          <Text style={styles.title}>How FocusFlow's VPN works</Text>

          <Text style={styles.intro}>
            FocusFlow uses a <Text style={styles.bold}>local VPN</Text> on your device to
            block selected apps from reaching the internet during a focus session.
          </Text>

          <View style={styles.factRow}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={COLORS.primary}
              style={styles.factIcon}
            />
            <Text style={styles.factText}>
              <Text style={styles.bold}>Nothing leaves your device.</Text> No traffic is
              sent to any external server — packets are silently dropped inside a local
              tunnel that only FocusFlow can see.
            </Text>
          </View>

          <View style={styles.factRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={14}
              color={COLORS.primary}
              style={styles.factIcon}
            />
            <Text style={styles.factText}>
              Android will show its standard VPN consent dialog next. Tap{' '}
              <Text style={styles.bold}>OK</Text> to grant the one-time permission —
              it persists until you manually revoke it.
            </Text>
          </View>

          <View style={styles.noteBox}>
            <Ionicons
              name="information-circle-outline"
              size={13}
              color="#888"
              style={styles.factIcon}
            />
            <Text style={styles.noteText}>
              Android only allows one active VPN at a time. If you use a work or privacy
              VPN, FocusFlow will offer to temporarily take over for the session duration.
            </Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={styles.confirmText}>I understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    backgroundColor: '#14142A',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 440,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600' as const,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  intro: {
    fontSize: 14,
    color: '#B8B8CC',
    lineHeight: 22,
    marginBottom: SPACING.sm + 2,
  },
  bold: {
    fontWeight: '600' as const,
    color: '#E0E0F0',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm + 2,
  },
  factIcon: {
    marginTop: 3,
    marginRight: SPACING.xs + 2,
    flexShrink: 0,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    color: '#B8B8CC',
    lineHeight: 22,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#777788',
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  cancelText: {
    fontWeight: '500' as const,
    fontSize: 14,
    color: '#777788',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmText: {
    fontWeight: '600' as const,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
