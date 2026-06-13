import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import { fmtCurrency, fmtDate, theme } from '../theme';
import AccountPicker from '../components/AccountPicker';
import Sheet from '../components/Sheet';

const FREQUENCIES = ['weekly', 'monthly', 'yearly'];

export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  const { recurringPayments, addRecurringPayment, updateRecurringPayment, deleteRecurringPayment, accounts, settings } = useData();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(accounts[0]?.id);

  const save = () => {
    const value = Math.round((parseFloat(amount) || 0) * 100);
    if (!value || !accountId || !/^20\d{2}-\d{2}-\d{2}$/.test(nextDate)) return;
    addRecurringPayment({ amount: value, note: note.trim() || 'Recurring payment', frequency, nextDate, accountId });
    setOpen(false);
    setAmount('');
    setNote('');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Recurring payments' }} />
      <FlatList
        data={recurringPayments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        ListEmptyComponent={<Text style={styles.empty}>No recurring payments.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.note}>{item.note}</Text>
              <Text style={styles.sub}>{item.frequency} / next {fmtDate(item.nextDate)} / {accounts.find((account) => account.id === item.accountId)?.name}</Text>
            </View>
            <Text style={styles.amount}>{fmtCurrency(item.amount, settings.currency)}</Text>
            <Pressable onPress={() => updateRecurringPayment(item.id, { active: !item.active })}>
              <Ionicons name={item.active ? 'pause-circle-outline' : 'play-circle-outline'} size={23} color={theme.colors.accent} />
            </Pressable>
            <Pressable onPress={() => deleteRecurringPayment(item.id)}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.owed} />
            </Pressable>
          </View>
        )}
      />
      <Pressable style={[styles.add, { bottom: insets.bottom + 20 }]} onPress={() => setOpen(true)}>
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.title}>New recurring payment</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" />
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Payment name" />
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.frequencies}>
          {FREQUENCIES.map((item) => (
            <Pressable key={item} style={[styles.frequency, item === frequency && styles.frequencyActive]} onPress={() => setFrequency(item)}>
              <Text style={[styles.frequencyText, item === frequency && styles.frequencyTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>First payment date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={nextDate} onChangeText={setNextDate} />
        <AccountPicker value={accountId} onChange={setAccountId} label="Deduct from" />
        <Pressable style={styles.save} onPress={save}><Text style={styles.saveText}>Save payment</Text></Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  list: { gap: 8 },
  empty: { textAlign: 'center', color: theme.colors.inkSoft, paddingTop: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  info: { flex: 1 },
  note: { fontWeight: '600' },
  sub: { fontSize: 11, color: theme.colors.inkSoft, marginTop: 3 },
  amount: { fontFamily: theme.fonts.mono, color: theme.colors.owed, fontWeight: '600' },
  add: { position: 'absolute', right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 14 },
  input: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: 12, marginBottom: 12, backgroundColor: theme.colors.surface },
  label: { fontSize: 12, color: theme.colors.inkSoft, marginBottom: 5 },
  frequencies: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  frequency: { flex: 1, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 6 },
  frequencyActive: { backgroundColor: theme.colors.accent },
  frequencyText: { fontSize: 11, color: theme.colors.inkSoft },
  frequencyTextActive: { color: '#fff' },
  save: { backgroundColor: theme.colors.accent, padding: 13, borderRadius: theme.radius.md, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
});
