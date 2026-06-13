import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useData } from '../data/DataContext';
import { theme } from '../theme';

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const { exportData, importData, mergeData, people, entries } = useData();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const json = exportData();
      const filename = `owed-to-you-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const uri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save backup',
        });
      } else {
        Alert.alert('Saved', `Backup saved to ${uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const readPickedFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/*', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets?.[0];
    if (!asset) return null;
    return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  };

  const handleRestore = async () => {
    try {
      const json = await readPickedFile();
      if (!json) return;
      Alert.alert(
        'Restore backup',
        'This will replace all current people and entries with the contents of this backup. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace all data',
            style: 'destructive',
            onPress: () => {
              try {
                importData(json);
                Alert.alert('Restored', 'Your data has been restored from the backup.');
              } catch (e) {
                Alert.alert('Restore failed', e.message ?? 'That file could not be read.');
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Restore failed', e.message ?? 'Something went wrong.');
    }
  };

  const handleMerge = async () => {
    try {
      const json = await readPickedFile();
      if (!json) return;
      try {
        mergeData(json);
        Alert.alert('Merged', 'New people and entries from the backup have been added.');
      } catch (e) {
        Alert.alert('Merge failed', e.message ?? 'That file could not be read.');
      }
    } catch (e) {
      Alert.alert('Merge failed', e.message ?? 'Something went wrong.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, theme.spacing(5)) }]}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Backup & restore' }} />
      <View style={styles.intro}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.accent} />
        <Text style={styles.introTitle}>Fully offline</Text>
        <Text style={styles.introBody}>
          Everything you add is stored only on this device, with no account and no internet
          connection needed. Use backups to move your data to a new phone or keep a copy
          somewhere safe.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{people.length}</Text>
          <Text style={styles.statLabel}>People</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{entries.length}</Text>
          <Text style={styles.statLabel}>Entries</Text>
        </View>
      </View>

      <Pressable style={[styles.actionCard, busy && styles.actionCardDisabled]} onPress={handleExport} disabled={busy}>
        <View style={styles.actionIcon}>
          <Ionicons name="share-outline" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Export backup</Text>
          <Text style={styles.actionBody}>Save a JSON file of all people and entries.</Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionCard} onPress={handleMerge}>
        <View style={styles.actionIcon}>
          <Ionicons name="git-merge-outline" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Import and merge</Text>
          <Text style={styles.actionBody}>Add people and entries from a backup without removing what's already here.</Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionCard} onPress={handleRestore}>
        <View style={[styles.actionIcon, styles.actionIconDanger]}>
          <Ionicons name="refresh-outline" size={20} color={theme.colors.owed} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Restore from backup</Text>
          <Text style={styles.actionBody}>Replace everything on this device with a backup file.</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  intro: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  introBody: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing(3),
    marginBottom: theme.spacing(1),
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: theme.fonts.mono,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(3.5),
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDanger: {
    backgroundColor: theme.colors.owedSoft,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  actionBody: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    marginTop: 2,
    lineHeight: 17,
  },
});
