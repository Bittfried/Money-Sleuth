import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from '../src/data/DataContext';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTitleStyle: {
              fontFamily: theme.fonts.display,
              fontSize: 18,
              color: theme.colors.ink,
            },
            headerTintColor: theme.colors.ink,
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        />
      </DataProvider>
    </SafeAreaProvider>
  );
}
