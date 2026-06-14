import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import AccountPicker from '../components/AccountPicker';
import Sheet from '../components/Sheet';
import { fmtCurrency, fmtDate, theme } from '../theme';

export default function PiggyBankScreen() {
  const insets = useSafeAreaInsets();
  const { piggyBankBalance, piggyBankTransactions, accounts, settings, depositPiggyBank, withdrawPiggyBank, breakPiggyBank } = useData();
  const [action, setAction] = useState(null);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id);

  useEffect(() => {
    if (accounts[0]) setAccountId((current) => current ?? accounts[0].id);
  }, [accounts]);

  const close = () => { setAction(null); setAmount(''); };
  const submit = () => {
    const value = Math.round((parseFloat(amount) || 0) * 100);
    if (!value || !accountId) return;
    if (action === 'deposit') depositPiggyBank(value, accountId);
    if (action === 'withdrawal') withdrawPiggyBank(value, accountId);
    close();
  };
  const breakBank = () => Alert.alert('Break the bank?', 'All Piggybank savings will return to the selected fund.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Break it', style: 'destructive', onPress: () => { breakPiggyBank(accountId); close(); } },
  ]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Piggybank' }} />
      <View style={styles.total}>
        <Ionicons name="archive-outline" size={28} color={theme.colors.gold} />
        <Text style={styles.label}>Total saved</Text>
        <Text style={styles.value}>{fmtCurrency(piggyBankBalance, settings.currency)}</Text>
      </View>
      <View style={styles.actions}>
        <Action icon="add" label="Deposit" onPress={() => setAction('deposit')} />
        <Action icon="return-down-back-outline" label="Thievery" onPress={() => setAction('withdrawal')} />
        <Action icon="hammer-outline" label="Break bank" onPress={() => setAction('break')} />
      </View>
      <Text style={styles.heading}>History</Text>
      <FlatList
        data={[...piggyBankTransactions].reverse()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        ListEmptyComponent={<Text style={styles.empty}>Nothing in the Piggybank yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}><Text style={styles.note}>{item.note}</Text><Text style={styles.date}>{fmtDate(item.date)} / {item.type}</Text></View>
            <Text style={[styles.amount, item.amount < 0 && styles.out]} numberOfLines={1} adjustsFontSizeToFit>{item.amount > 0 ? '+' : ''}{fmtCurrency(item.amount, settings.currency)}</Text>
          </View>
        )}
      />
      <Sheet visible={Boolean(action)} onClose={close}>
        <Text style={styles.sheetTitle}>{action === 'deposit' ? 'Deposit' : action === 'withdrawal' ? 'Thievery' : 'Break the bank'}</Text>
        {action !== 'break' && <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" />}
        <AccountPicker value={accountId} onChange={setAccountId} label={action === 'deposit' ? 'Take from fund' : 'Return to fund'} />
        <Pressable
          style={[styles.confirm, (!accountId || (action !== 'break' && !amount) || (action === 'break' && piggyBankBalance <= 0)) && styles.disabled]}
          onPress={action === 'break' ? breakBank : submit}
          disabled={!accountId || (action !== 'break' && !amount) || (action === 'break' && piggyBankBalance <= 0)}
        >
          <Text style={styles.confirmText}>{action === 'break' ? 'Break the bank' : 'Confirm'}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

function Action({ icon, label, onPress }) {
  return <Pressable style={styles.action} onPress={onPress}><Ionicons name={icon} size={20} color={theme.colors.accent} /><Text style={styles.actionText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  total: { alignItems: 'center', paddingVertical: 28 },
  label: { color: theme.colors.inkSoft, fontSize: 12, marginTop: 7 },
  value: { color: theme.colors.gold, fontFamily: theme.fonts.mono, fontSize: 34, fontWeight: '700', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  action: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  actionText: { fontSize: 11, fontWeight: '600', color: theme.colors.ink },
  heading: { color: theme.colors.inkSoft, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.line },
  info: { flex: 1 },
  note: { color: theme.colors.ink, fontWeight: '600' },
  date: { color: theme.colors.inkSoft, fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
  amount: { maxWidth: '42%', color: theme.colors.settled, fontFamily: theme.fonts.mono, fontWeight: '700' },
  out: { color: theme.colors.owed },
  empty: { color: theme.colors.inkSoft, textAlign: 'center', paddingTop: 40 },
  sheetTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '600', marginBottom: 14 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: 12, fontSize: 16, marginBottom: 12 },
  confirm: { backgroundColor: theme.colors.accent, padding: 13, borderRadius: theme.radius.md, alignItems: 'center' },
  confirmText: { color: theme.colors.surface, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
