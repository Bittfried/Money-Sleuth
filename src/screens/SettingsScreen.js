import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import AccountPicker from '../components/AccountPicker';
import { fmtCurrency, theme } from '../theme';

const CURRENCIES = ['\u20B1', '$', '\u20AC', '\u00A3', '\u00A5', '\u20B9'];
const INCOME_TYPES = ['allowance', 'employed', 'freelance'];
const FREQUENCIES = ['weekly', 'monthly', 'yearly'];
const PIGGY_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
const BUDGETS = ['weekly', 'monthly', 'yearly'];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, spendable, budgetReserve, budgetableSpendable, budgetSummary, piggyBankBalance } = useData();
  const [custom, setCustom] = useState('');
  const customBudget = settings.customBudget ?? { enabled: false, startDate: null, endDate: null };
  const piggyBank = settings.piggyBank ?? { enabled: false, amount: 0, frequency: 'monthly', accountId: null, nextDate: null };
  const updateCustomBudget = (patch) => updateSettings({ customBudget: { ...customBudget, ...patch } });
  const updatePiggyBank = (patch) => updateSettings({ piggyBank: { ...piggyBank, ...patch } });
  const changeBudget = (key, enabled) => updateSettings({ budgetMode: enabled ? key : null, customBudget: { ...customBudget, enabled: false } });
  const changeCustomBudget = (enabled) => {
    const currentDate = new Date().toISOString().slice(0, 10);
    updateSettings({
      budgetMode: enabled ? 'custom' : null,
      customBudget: { ...customBudget, enabled, startDate: customBudget.startDate ?? currentDate, endDate: customBudget.endDate ?? currentDate },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Options' }} />

      <Text style={styles.heading}>Income source</Text>
      <View style={styles.segment}>
        {INCOME_TYPES.map((item) => <Choice key={item} item={item} active={settings.incomeType === item} onPress={() => updateSettings({ incomeType: item })} />)}
      </View>
      {settings.incomeType !== 'freelance' && (
        <View style={styles.box}>
          <Text style={styles.label}>Automatic {settings.incomeType}</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" defaultValue={(settings.incomeAmount / 100).toString()} onEndEditing={(event) => updateSettings({ incomeAmount: Math.round((parseFloat(event.nativeEvent.text) || 0) * 100) })} />
          <View style={styles.segment}>{FREQUENCIES.map((item) => <Choice key={item} item={item} active={settings.incomeFrequency === item} onPress={() => updateSettings({ incomeFrequency: item })} />)}</View>
          <AccountPicker value={settings.incomeAccountId} onChange={(incomeAccountId) => updateSettings({ incomeAccountId })} label="Add income to" />
        </View>
      )}
      {settings.incomeType === 'freelance' && <ManageRow label="Open freelance income ledger" onPress={() => router.push('/income')} />}

      <Text style={styles.heading}>Automatic budget</Text>
      <Text style={styles.hint}>Choose one period. Available money is divided across its remaining days and fixed until the next period.</Text>
      <View style={styles.box}>
        <Text style={styles.label}>Money on reserve</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" defaultValue={(budgetReserve / 100).toString()} onEndEditing={(event) => updateSettings({ budgetReserve: Math.max(0, Math.round((parseFloat(event.nativeEvent.text) || 0) * 100)) })} />
        <Text style={styles.hint}>Budgetable: {fmtCurrency(budgetableSpendable, settings.currency)} of {fmtCurrency(spendable, settings.currency)}</Text>
      </View>
      {BUDGETS.map((key) => (
        <BudgetOption key={key} label={`${key} plan`} enabled={settings.budgetMode === key} summary={budgetSummary[key]} currency={settings.currency} onChange={(enabled) => changeBudget(key, enabled)} />
      ))}
      <View style={styles.budget}>
        <View style={styles.budgetTop}>
          <View><Text style={styles.rowTitle}>Custom date range</Text>{settings.budgetMode === 'custom' && <Text style={styles.budgetAmount}>{fmtCurrency(budgetSummary.custom.available, settings.currency)} / day</Text>}</View>
          <Switch value={settings.budgetMode === 'custom'} onValueChange={changeCustomBudget} trackColor={{ true: theme.colors.accent }} />
        </View>
        {settings.budgetMode === 'custom' && (
          <>
            <View style={styles.dateRow}>
              <DateField label="Start date" value={customBudget.startDate} onChange={(startDate) => updateCustomBudget({ startDate })} />
              <DateField label="End date" value={customBudget.endDate} onChange={(endDate) => updateCustomBudget({ endDate })} />
            </View>
            <BudgetDetails summary={budgetSummary.custom} currency={settings.currency} />
          </>
        )}
      </View>

      <Text style={styles.heading}>Piggybank</Text>
      <View style={styles.box}>
        <View style={styles.budgetTop}>
          <View>
            <Text style={styles.rowTitle}>Automatic saving</Text>
            <Text style={styles.budgetAmount}>{fmtCurrency(piggyBankBalance, settings.currency)}</Text>
          </View>
          <Switch value={piggyBank.enabled} onValueChange={(enabled) => updatePiggyBank({ enabled, accountId: piggyBank.accountId ?? settings.incomeAccountId })} trackColor={{ true: theme.colors.accent }} />
        </View>
        {piggyBank.enabled && (
          <>
            <Text style={styles.label}>Amount to save</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" defaultValue={(piggyBank.amount / 100).toString()} onEndEditing={(event) => updatePiggyBank({ amount: Math.max(0, Math.round((parseFloat(event.nativeEvent.text) || 0) * 100)) })} />
            <View style={styles.segment}>{PIGGY_FREQUENCIES.map((item) => <Choice key={item} item={item} active={piggyBank.frequency === item} onPress={() => updatePiggyBank({ frequency: item, nextDate: null })} />)}</View>
            <AccountPicker value={piggyBank.accountId} onChange={(accountId) => updatePiggyBank({ accountId })} label="Save from fund" />
            <Text style={styles.hint}>Next saving date: {piggyBank.nextDate ?? 'Not scheduled'}. Scheduled savings are reserved by your budget.</Text>
          </>
        )}
      </View>

      <Text style={styles.heading}>Currency symbol</Text>
      <View style={styles.currencyGrid}>{CURRENCIES.map((currency) => <Pressable key={currency} style={[styles.currency, settings.currency === currency && styles.active]} onPress={() => updateSettings({ currency })}><Text style={[styles.currencyText, settings.currency === currency && styles.activeText]}>{currency}</Text></Pressable>)}</View>
      <View style={styles.custom}><TextInput style={[styles.input, styles.customInput]} value={custom} onChangeText={setCustom} placeholder="Custom" /><Pressable style={styles.use} onPress={() => { if (custom.trim()) updateSettings({ currency: custom.trim() }); setCustom(''); }}><Text style={styles.activeText}>Use</Text></Pressable></View>

      <Text style={styles.heading}>Manage</Text>
      <ManageRow label="Fund accounts" onPress={() => router.push('/funds')} />
      <ManageRow label="Recurring payments" onPress={() => router.push('/recurring')} />
      <ManageRow label="Backup & restore" onPress={() => router.push('/backup')} />
    </ScrollView>
  );
}

function Choice({ item, active, onPress }) {
  return <Pressable style={[styles.segmentItem, active && styles.active]} onPress={onPress}><Text style={[styles.segmentText, active && styles.activeText]}>{item}</Text></Pressable>;
}
function ManageRow({ label, onPress }) {
  return <Pressable style={styles.row} onPress={onPress}><Text style={styles.rowTitle}>{label}</Text><Ionicons name="chevron-forward" size={18} /></Pressable>;
}
function BudgetOption({ label, enabled, summary, currency, onChange }) {
  return <View style={styles.budget}><View style={styles.budgetTop}><View><Text style={styles.rowTitle}>{label}</Text>{enabled && <Text style={styles.budgetAmount}>{fmtCurrency(summary.available, currency)} / day</Text>}</View><Switch value={enabled} onValueChange={onChange} trackColor={{ true: theme.colors.accent }} /></View>{enabled && <BudgetDetails summary={summary} currency={currency} />}</View>;
}
function BudgetDetails({ summary, currency }) {
  return <Text style={styles.hint}>Total available: {fmtCurrency(summary.totalAvailable, currency)} / Payments: {fmtCurrency(summary.recurringDue, currency)} / Piggybank: {fmtCurrency(summary.piggyDue ?? 0, currency)}</Text>;
}
function DateField({ label, value, onChange }) {
  return <View style={styles.dateField}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value ?? ''} onChangeText={onChange} placeholder="YYYY-MM-DD" /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, gap: 10 },
  heading: { fontSize: 12, fontWeight: '700', color: theme.colors.inkSoft, textTransform: 'uppercase', marginTop: 12 },
  hint: { fontSize: 12, color: theme.colors.inkSoft },
  segment: { flexDirection: 'row', gap: 5 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 6 },
  segmentText: { fontSize: 11, color: theme.colors.inkSoft, textTransform: 'capitalize' },
  active: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  activeText: { color: '#fff', fontWeight: '600' },
  box: { backgroundColor: theme.colors.surface, padding: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, gap: 8 },
  label: { fontSize: 12, color: theme.colors.inkSoft },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: 11, fontSize: 15, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  rowTitle: { fontWeight: '600', color: theme.colors.ink, textTransform: 'capitalize' },
  budget: { padding: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, gap: 7 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetAmount: { fontSize: 18, fontFamily: theme.fonts.mono, fontWeight: '700', color: theme.colors.accent, marginTop: 4 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateField: { flex: 1 },
  currencyGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  currency: { width: 48, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 6, backgroundColor: theme.colors.surface },
  currencyText: { fontSize: 17 },
  custom: { flexDirection: 'row', gap: 8 },
  customInput: { flex: 1, marginBottom: 0 },
  use: { backgroundColor: theme.colors.accent, paddingHorizontal: 20, justifyContent: 'center', borderRadius: theme.radius.md },
});
