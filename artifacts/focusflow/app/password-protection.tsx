import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';
import { COLORS, FONT, RADIUS, SPACING } from '@/styles/theme';
import { PinSetupModal } from '@/components/PinSetupModal';
import { PinVerifyModal } from '@/components/PinVerifyModal';
import { SessionPinModule } from '@/native-modules/SessionPinModule';
import { SharedPrefsModule } from '@/native-modules/SharedPrefsModule';

type ModalState =
  | { type: 'none' }
  | { type: 'setup'; pinType: 'focus' | 'defense' }
  | { type: 'verify'; pinType: 'focus' | 'defense'; title: string; description: string; action: (hash: string) => void };

export default function PasswordProtectionScreen() {
  const { theme } = useTheme();
  const [focusSet, setFocusSet] = useState(false);
  const [defenseSet, setDefenseSet] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const refresh = useCallback(async () => {
    const [focus, defense] = await Promise.all([
      SessionPinModule.isPinSet().catch(() => false),
      SharedPrefsModule.getString('defense_pin_hash').catch(() => null),
    ]);
    setFocusSet(focus);
    setDefenseSet(Boolean(defense));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const removeFocus = (hash: string) => {
    void SessionPinModule.clearPin(hash).then(() => {
      setModal({ type: 'none' });
      void refresh();
    }).catch(() => Alert.alert('Could not remove password', 'Please try again.'));
  };
  const removeDefense = async (hash: string) => {
    await SharedPrefsModule.putString('defense_pin_hash', '').catch(() => {});
    setModal({ type: 'none' });
    void refresh();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/defense'))} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={[styles.title, { color: theme.text }]}>Password Protection</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Keep your protection settings harder to weaken</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.info, { backgroundColor: COLORS.primary + '0D', borderColor: COLORS.primary + '35' }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            Focus Session Password controls ending a focus session. Defense Password controls disabling protection and removing restrictions.
          </Text>
        </View>
        <PasswordCard
          icon="hourglass-outline"
          title="Focus Session Password"
          description={focusSet ? 'Set — required to end an active focus session' : 'Not set — focus sessions can be ended freely'}
          isSet={focusSet}
          theme={theme}
          onSet={() => setModal({ type: 'setup', pinType: 'focus' })}
          onChange={() => setModal({ type: 'verify', pinType: 'focus', title: 'Verify Current Password', description: 'Enter your current focus session password to change it.', action: async (hash) => { await SessionPinModule.clearPin(hash).catch(() => {}); setModal({ type: 'setup', pinType: 'focus' }); } })}
          onRemove={() => setModal({ type: 'verify', pinType: 'focus', title: 'Remove Focus Session Password', description: 'Enter your current password to remove it.', action: removeFocus })}
        />
        <PasswordCard
          icon="shield-half-outline"
          title="Defense Password"
          description={defenseSet ? 'Set — required before disabling protection' : 'Not set — protection settings can be changed freely'}
          isSet={defenseSet}
          theme={theme}
          onSet={() => setModal({ type: 'setup', pinType: 'defense' })}
          onChange={() => setModal({ type: 'verify', pinType: 'defense', title: 'Verify Current Password', description: 'Enter your current defense password to change it.', action: async () => { await SharedPrefsModule.putString('defense_pin_hash', ''); setModal({ type: 'setup', pinType: 'defense' }); } })}
          onRemove={() => setModal({ type: 'verify', pinType: 'defense', title: 'Remove Defense Password', description: 'Enter your current defense password to remove it.', action: removeDefense })}
        />
      </ScrollView>
      <PinVerifyModal visible={modal.type === 'verify'} pinType={modal.type === 'verify' ? modal.pinType : 'defense'} title={modal.type === 'verify' ? modal.title : undefined} description={modal.type === 'verify' ? modal.description : undefined} onVerified={(hash) => { if (modal.type === 'verify') void modal.action(hash); }} onCancel={() => setModal({ type: 'none' })} />
      <PinSetupModal visible={modal.type === 'setup'} pinType={modal.type === 'setup' ? modal.pinType : 'defense'} onSaved={() => { setModal({ type: 'none' }); void refresh(); }} onCancel={() => setModal({ type: 'none' })} />
    </SafeAreaView>
  );
}

function PasswordCard({ icon, title, description, isSet, theme, onSet, onChange, onRemove }: any) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: isSet ? COLORS.primary + '18' : theme.border + '44' }]}><Ionicons name={icon} size={18} color={isSet ? COLORS.primary : theme.muted} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.cardDesc, { color: isSet ? COLORS.primary : theme.muted }]}>{description}</Text></View>
      </View>
      <View style={styles.actions}>
        {!isSet ? <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]} onPress={onSet}><Text style={styles.primaryText}>Set Password</Text></TouchableOpacity> : <><TouchableOpacity style={[styles.secondaryBtn, { borderColor: COLORS.primary + 'AA' }]} onPress={onChange}><Text style={[styles.secondaryText, { color: COLORS.primary }]}>Change</Text></TouchableOpacity><TouchableOpacity style={[styles.secondaryBtn, { borderColor: COLORS.red + '66' }]} onPress={onRemove}><Text style={[styles.secondaryText, { color: COLORS.red }]}>Remove</Text></TouchableOpacity></>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth }, title: { fontSize: FONT.lg, fontWeight: '800' }, subtitle: { fontSize: FONT.xs, marginTop: 2 }, content: { padding: SPACING.lg, gap: SPACING.md }, info: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1 }, infoText: { flex: 1, fontSize: FONT.sm, lineHeight: 20 }, card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: SPACING.md, gap: SPACING.md }, row: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' }, icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: FONT.sm, fontWeight: '700' }, cardDesc: { fontSize: FONT.xs, lineHeight: 17, marginTop: 2 }, actions: { flexDirection: 'row', gap: SPACING.xs, paddingLeft: 40 }, primaryBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.md }, primaryText: { color: '#fff', fontSize: FONT.xs, fontWeight: '700' }, secondaryBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.md, borderWidth: 1 }, secondaryText: { fontSize: FONT.xs, fontWeight: '700' },
});