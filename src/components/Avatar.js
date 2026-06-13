import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { theme, initials } from '../theme';

export default function Avatar({ name, photo, size = 44 }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (photo) {
    return <Image source={{ uri: photo }} style={[styles.image, dim]} />;
  }
  return (
    <View style={[styles.fallback, dim]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  fallback: {
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
});
