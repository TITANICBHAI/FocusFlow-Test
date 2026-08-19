import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const LOGO = require('@/assets/focusflow-logo.png');

type Props = {
  size?: number;
  glow?: boolean;
};

export default function FocusFlowLogo({ size = 52, glow = false }: Props) {
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        glow && styles.glow,
      ]}
    >
      <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glow: {
    shadowColor: '#4F8EF7',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
