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
import Sheet from '../components/Sheet';

const EXPORT_OPTIONS = [
  { key: 'funds', label: 'Fund accounts' },
  { key: 'credits', label: 'Credits and people' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'recurring', label: 'Recurring payments' },
  { key: 'piggyBank', label: 'Piggybank' },
  { key: 'history', label: 'Money history' },
  { key: 'settings', label: 'Settings' },
];
const FREQUENCIES = ['weekly', 'monthly', 'yearly'];

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const { exportData, importData, mergeData, configureAutoExport, settings, people, entries, expenses } = useData();
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState(EXPORT_OPTIONS.map((item) => item.key));
  const autoExport = settings.autoExport ?? {};

  const handleExport = async (groups = selected) => {
    if (groups.length === 0) return;
    setExportOpen(false);
    setBusy(true);
    try {
      const json = exportData(groups);
      const filename = `money-sleuth-backup-${new Date().toISOString().replaceAll(':', '-')}.json`;
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
  const chooseSchedule = (frequency) => {
    Alert.alert('Wipe after each export?', 'Scheduled exports are saved locally when the app is opened on or after the due date. Should the current database be cleared after each successful export to save space?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep data', onPress: () => configureAutoExport(frequency, false) },
      { text: 'Export and wipe', style: 'destructive', onPress: () => configureAutoExport(frequency, true) },
    ]);
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
        'This replaces the parts included in the backup. A full backup replaces all current data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore included data',
            style: 'destructive',
            onPress: () => {
              try {
                importData(json);
                Alert.alert('Restored', 'The included data has been restored from the backup.');
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
        Alert.alert('Merged', 'New record-list items from the backup have been added. Settings and Piggybank totals were left unchanged.');
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
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{expenses.length}</Text>
          <Text style={styles.statLabel}>Expenses</Text>
        </View>
      </View>

      <Pressable style={[styles.actionCard, busy && styles.actionCardDisabled]} onPress={() => setExportOpen(true)} disabled={busy}>
        <View style={styles.actionIcon}>
          <Ionicons name="share-outline" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Export backup</Text>
          <Text style={styles.actionBody}>Choose specific parts or export everything.</Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionCard} onPress={handleMerge}>
        <View style={styles.actionIcon}>
          <Ionicons name="git-merge-outline" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Import and merge</Text>
          <Text style={styles.actionBody}>Add record-list items without changing settings or Piggybank totals.</Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionCard} onPress={handleRestore}>
        <View style={[styles.actionIcon, styles.actionIconDanger]}>
          <Ionicons name="refresh-outline" size={20} color={theme.colors.owed} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Restore from backup</Text>
          <Text style={styles.actionBody}>Replace only the parts included in a backup file.</Text>
        </View>
      </Pressable>

      <Text style={styles.sectionTitle}>Scheduled local export</Text>
      <View style={styles.scheduleBox}>
        <Text style={styles.scheduleHint}>Runs when the app is opened on or after the scheduled date.</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map((frequency) => (
            <Pressable key={frequency} style={[styles.frequency, autoExport.enabled && autoExport.frequency === frequency && styles.frequencyActive]} onPress={() => chooseSchedule(frequency)}>
              <Text style={[styles.frequencyText, autoExport.enabled && autoExport.frequency === frequency && styles.frequencyTextActive]}>{frequency}</Text>
            </Pressable>
          ))}
        </View>
        {autoExport.enabled && (
          <>
            <Text style={styles.scheduleHint}>Next export: {autoExport.nextDate} / {autoExport.wipeAfterExport ? 'wipes after export' : 'keeps current data'}</Text>
            {autoExport.lastUri && <Text style={styles.scheduleHint}>Last saved: {autoExport.lastUri}</Text>}
            <Pressable style={styles.disable} onPress={() => configureAutoExport(null)}><Text style={styles.disableText}>Disable scheduled export</Text></Pressable>
          </>
        )}
      </View>

      <Sheet visible={exportOpen} onClose={() => setExportOpen(false)} variant="center">
        <Text style={styles.sheetTitle}>Choose what to export</Text>
        <Pressable style={styles.selectAll} onPress={() => setSelected(selected.length === EXPORT_OPTIONS.length ? [] : EXPORT_OPTIONS.map((item) => item.key))}>
          <Text style={styles.optionText}>{selected.length === EXPORT_OPTIONS.length ? 'Clear all' : 'Select all'}</Text>
        </Pressable>
        {EXPORT_OPTIONS.map((item) => {
          const checked = selected.includes(item.key);
          return (
            <Pressable key={item.key} style={styles.option} onPress={() => setSelected(checked ? selected.filter((key) => key !== item.key) : [...selected, item.key])}>
              <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={21} color={checked ? theme.colors.accent : theme.colors.inkSoft} />
              <Text style={styles.optionText}>{item.label}</Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.exportButton, selected.length === 0 && styles.actionCardDisabled]} disabled={selected.length === 0} onPress={() => handleExport(selected)}>
          <Ionicons name="share-outline" size={18} color={theme.colors.surface} />
          <Text style={styles.exportButtonText}>{selected.length === EXPORT_OPTIONS.length ? 'Export all data' : 'Export selected'}</Text>
        </Pressable>
      </Sheet>
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
  sectionTitle: { marginTop: theme.spacing(2), fontSize: 12, fontWeight: '700', color: theme.colors.inkSoft, textTransform: 'uppercase' },
  scheduleBox: { gap: theme.spacing(3), backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: theme.spacing(3) },
  scheduleHint: { color: theme.colors.inkSoft, fontSize: 12, textAlign: 'center' },
  frequencyRow: { flexDirection: 'row', gap: theme.spacing(2) },
  frequency: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing(2.5), borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm },
  frequencyActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  frequencyText: { color: theme.colors.inkSoft, textTransform: 'capitalize', fontSize: 12, fontWeight: '600' },
  frequencyTextActive: { color: theme.colors.surface },
  disable: { alignItems: 'center', paddingVertical: theme.spacing(2) },
  disableText: { color: theme.colors.owed, fontWeight: '600', fontSize: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.ink, marginBottom: theme.spacing(2) },
  selectAll: { alignSelf: 'flex-end', paddingVertical: theme.spacing(2) },
  option: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), borderBottomWidth: 1, borderColor: theme.colors.line },
  optionText: { flex: 1, color: theme.colors.ink, fontWeight: '600' },
  exportButton: { marginTop: theme.spacing(4), flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: theme.spacing(2), backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingVertical: theme.spacing(3) },
  exportButtonText: { color: theme.colors.surface, fontWeight: '700' },
});
