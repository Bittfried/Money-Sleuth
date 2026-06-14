import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import { fmtCurrency, fmtDate, theme } from '../theme';
import Sheet from '../components/Sheet';
import DateFilter, { matchesDateFilter } from '../components/DateFilter';
import AccountPicker from '../components/AccountPicker';
import { localDateISO, parseLocalDate } from '../date';

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { expenses, addExpense, editExpense, deleteExpense, settings, accounts } = useData();
  const [filter, setFilter] = useState({ type: 'all' });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id);

  useEffect(() => {
    if (accounts[0]) setAccountId((current) => current ?? accounts[0].id);
  }, [accounts]);

  const visible = useMemo(
    () => expenses.filter((expense) => matchesDateFilter(expense.date, filter)).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, filter]
  );
  const total = visible.reduce((sum, expense) => sum + expense.amount, 0);

  const close = () => {
    setOpen(false); setEditingId(null); setAmount(''); setNote(''); setDate(new Date()); setShowDate(false);
  };
  const edit = (expense) => {
    setEditingId(expense.id); setAmount((expense.amount / 100).toString()); setNote(expense.note);
    setDate(parseLocalDate(expense.date)); setAccountId(expense.accountId); setOpen(true);
  };
  const save = () => {
    const numeric = Number.parseFloat(amount.replace(',', '.'));
    if (!numeric || numeric <= 0) return;
    if (!accountId) return;
    const fields = { amount: Math.round(numeric * 100), note: note.trim() || 'Expense', date: localDateISO(date), accountId };
    if (editingId) editExpense(editingId, fields); else addExpense(fields);
    close();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
      <Stack.Screen options={{ title: 'Expenses' }} />
      <DateFilter value={filter} onChange={setFilter} right={<Pressable style={styles.add} onPress={() => setOpen(true)}>
          <Ionicons name="add" size={16} color={theme.colors.surface} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>} />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No expenses for this period.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => edit(item)}>
            <View style={styles.info}>
              <Text style={styles.note}>{item.note}</Text>
              <Text style={styles.date}>{fmtDate(item.date)} / {accounts.find((account) => account.id === item.accountId)?.name}{item.recurringId ? ' / recurring' : ''}</Text>
            </View>
            <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{fmtCurrency(item.amount, settings.currency)}</Text>
          </Pressable>
        )}
      />
      <View style={styles.total}>
        <Text style={styles.totalLabel}>Total expenses</Text>
        <Text style={styles.totalValue}>{fmtCurrency(total, settings.currency)}</Text>
      </View>

      <Sheet visible={open} onClose={close}>
        <Text style={styles.sheetTitle}>{editingId ? 'Edit expense' : 'New expense'}</Text>
        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.colors.inkFaint} />
        <Text style={styles.label}>Note</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="What was this for?" placeholderTextColor={theme.colors.inkFaint} />
        <Text style={styles.label}>Date</Text>
        <Pressable style={styles.input} onPress={() => setShowDate(true)}>
          <Text style={styles.dateInput}>{fmtDate(localDateISO(date))}</Text>
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            onValueChange={(_, selected) => {
              if (selected) setDate(selected);
              if (Platform.OS === 'android') setShowDate(false);
            }}
            onDismiss={() => setShowDate(false)}
          />
        )}
        <AccountPicker value={accountId} onChange={setAccountId} label="Deduct from" />
        {editingId && (
          <Pressable style={styles.delete} onPress={() => { deleteExpense(editingId); close(); }}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.owed} />
            <Text style={styles.deleteText}>Delete expense</Text>
          </Pressable>
        )}
        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.ghost]} onPress={close}><Text style={styles.ghostText}>Cancel</Text></Pressable>
          <Pressable style={[styles.button, styles.primary]} onPress={save}><Text style={styles.primaryText}>{editingId ? 'Save changes' : 'Add expense'}</Text></Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing(4) },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.owed, paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(1.5), borderRadius: theme.radius.sm },
  addText: { color: theme.colors.surface, fontSize: 12, fontWeight: '600' },
  list: { gap: theme.spacing(2), paddingBottom: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: theme.spacing(3) },
  info: { flex: 1, minWidth: 0 },
  note: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  date: { fontSize: 12, color: theme.colors.inkSoft, marginTop: 3 },
  amount: { maxWidth: '42%', fontSize: 15, fontFamily: theme.fonts.mono, fontWeight: '600', color: theme.colors.owed },
  empty: { color: theme.colors.inkSoft, textAlign: 'center', paddingTop: theme.spacing(12) },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: theme.colors.line, paddingTop: theme.spacing(3) },
  totalLabel: { fontSize: 13, color: theme.colors.inkSoft },
  totalValue: { fontFamily: theme.fonts.mono, fontWeight: '700', color: theme.colors.owed },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.ink, marginBottom: theme.spacing(4) },
  label: { fontSize: 12, color: theme.colors.inkSoft, marginBottom: theme.spacing(1), fontWeight: '500' },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: theme.spacing(3), fontSize: 16, color: theme.colors.ink, marginBottom: theme.spacing(3) },
  dateInput: { color: theme.colors.ink, fontSize: 16 },
  delete: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), paddingVertical: theme.spacing(2) },
  deleteText: { color: theme.colors.owed, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: theme.spacing(3), marginTop: theme.spacing(2) },
  button: { flex: 1, paddingVertical: theme.spacing(3), borderRadius: theme.radius.md, alignItems: 'center' },
  ghost: { borderWidth: 1, borderColor: theme.colors.line },
  ghostText: { color: theme.colors.inkSoft, fontWeight: '600' },
  primary: { backgroundColor: theme.colors.accent },
  primaryText: { color: theme.colors.surface, fontWeight: '600' },
});
