import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { DataProvider, useData } from '../src/data/DataContext';
import { getTheme } from '../src/theme';
import { localDateISO } from '../src/date';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <AutoExportManager />
        <ThemedStack />
      </DataProvider>
    </SafeAreaProvider>
  );
}

function AutoExportManager() {
  const { loaded, settings, exportData, completeAutoExport } = useData();
  const running = useRef(false);
  const autoExport = settings.autoExport;

  useEffect(() => {
    if (!loaded || !autoExport?.enabled || !autoExport.nextDate || autoExport.nextDate > localDateISO() || running.current) return;
    running.current = true;
    const run = async () => {
      try {
        const timestamp = new Date().toISOString().replaceAll(':', '-');
        const uri = `${FileSystem.documentDirectory}money-sleuth-auto-${timestamp}.json`;
        await FileSystem.writeAsStringAsync(uri, exportData(['all']), { encoding: FileSystem.EncodingType.UTF8 });
        completeAutoExport(uri);
      } finally {
        running.current = false;
      }
    };
    run().catch(console.warn);
  }, [autoExport?.enabled, autoExport?.nextDate, completeAutoExport, exportData, loaded]);

  return null;
}

function ThemedStack() {
  const { settings } = useData();
  const activeTheme = getTheme(settings.themeMode);
  const dark = settings.themeMode === 'dark';
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: activeTheme.colors.bg },
            headerTitleStyle: {
              fontFamily: activeTheme.fonts.display,
              fontSize: 18,
              color: activeTheme.colors.ink,
            },
            headerTintColor: activeTheme.colors.ink,
            contentStyle: { backgroundColor: activeTheme.colors.bg },
          }}
        />
    </>
  );
}
