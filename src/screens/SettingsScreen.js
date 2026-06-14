import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import AccountPicker from '../components/AccountPicker';
import { fmtCurrency, getTheme, theme } from '../theme';
import { localDateISO } from '../date';

const CURRENCIES = ['\u20B1', '$', '\u20AC', '\u00A3', '\u00A5', '\u20B9'];
const INCOME_TYPES = ['allowance', 'employed', 'freelance'];
const FREQUENCIES = ['weekly', 'monthly', 'yearly'];
const BUDGET_MODES = ['weekly', 'monthly', 'yearly', 'custom'];
const VISUAL_MODES = ['light', 'night', 'dark'];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, budgetableSpendable, budgetSummary } = useData();
  const colors = getTheme(settings.themeMode).colors;
  const [customCurrency, setCustomCurrency] = useState('');
  const customBudget = settings.customBudget ?? { enabled: false, startDate: null, endDate: null };
  const piggyBank = settings.piggyBank ?? { autoEnabled: false, accountId: null };
  const selectedSummary = settings.budgetMode ? budgetSummary[settings.budgetMode] : null;
  const currentDate = localDateISO();
  const selectBudget = (budgetMode) => updateSettings({
    budgetMode: settings.budgetMode === budgetMode ? null : budgetMode,
    customBudget: { ...customBudget, enabled: budgetMode === 'custom', startDate: customBudget.startDate ?? currentDate, endDate: customBudget.endDate ?? currentDate },
    budgetSnapshots: {},
  });
  const updateCustomBudget = (patch) => updateSettings({ customBudget: { ...customBudget, ...patch }, budgetSnapshots: {} });
  const updatePiggyBank = (patch) => updateSettings({ piggyBank: { ...piggyBank, ...patch } });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Options' }} />

      <Section title="Income source">
        <Segment options={INCOME_TYPES} value={settings.incomeType} onChange={(incomeType) => updateSettings({ incomeType })} />
        {settings.incomeType !== 'freelance' ? (
          <>
            <Text style={styles.label}>Automatic {settings.incomeType}</Text>
            <MoneyInput value={settings.incomeAmount} onChange={(incomeAmount) => updateSettings({ incomeAmount })} />
            <Segment options={FREQUENCIES} value={settings.incomeFrequency} onChange={(incomeFrequency) => updateSettings({ incomeFrequency })} />
            <AccountPicker value={settings.incomeAccountId} onChange={(incomeAccountId) => updateSettings({ incomeAccountId })} label="Add income to" />
          </>
        ) : <ManageRow label="Open freelance income ledger" onPress={() => router.push('/income')} />}
      </Section>

      <Section title="Automatic budget">
        <Text style={styles.hint}>Choose one period. Its available money is divided across the remaining days.</Text>
        <Segment options={BUDGET_MODES} value={settings.budgetMode} onChange={selectBudget} />
        {settings.budgetMode === 'custom' && (
          <View style={styles.dateRow}>
            <DateField label="Start date" value={customBudget.startDate} onChange={(startDate) => updateCustomBudget({ startDate })} />
            <DateField label="End date" value={customBudget.endDate} onChange={(endDate) => updateCustomBudget({ endDate })} />
          </View>
        )}
        {selectedSummary && (
          <View style={styles.centerSummary}>
            <Text style={styles.label}>Daily budget</Text>
            <Text style={styles.budgetValue}>{fmtCurrency(selectedSummary.available, settings.currency)}</Text>
            <Text style={styles.hint}>Remaining pool: {fmtCurrency(selectedSummary.totalAvailable, settings.currency)} / Payments reserved: {fmtCurrency(selectedSummary.recurringDue, settings.currency)}</Text>
          </View>
        )}
        <Text style={styles.hint}>Money available for budgeting after unpaid debts: {fmtCurrency(budgetableSpendable, settings.currency)}</Text>
      </Section>

      <Section title="Piggybank">
        <View style={styles.switchRow}>
          <View><Text style={styles.rowTitle}>Automatic leftover saving</Text><Text style={styles.hint}>Moves unused daily budget after midnight.</Text></View>
          <Switch value={piggyBank.autoEnabled} onValueChange={(autoEnabled) => updatePiggyBank({ autoEnabled, accountId: piggyBank.accountId ?? settings.incomeAccountId })} trackColor={{ true: theme.colors.accent }} />
        </View>
        {piggyBank.autoEnabled && <AccountPicker value={piggyBank.accountId} onChange={(accountId) => updatePiggyBank({ accountId })} label="Save leftovers from fund" />}
      </Section>

      <Section title="Appearance">
        <Segment options={VISUAL_MODES} value={settings.themeMode ?? 'light'} onChange={(themeMode) => updateSettings({ themeMode })} />
      </Section>

      <Section title="Currency symbol">
        <View style={styles.currencyGrid}>{CURRENCIES.map((currency) => <Pressable key={currency} style={[styles.currency, settings.currency === currency && styles.active]} onPress={() => updateSettings({ currency })}><Text style={[styles.currencyText, settings.currency === currency && styles.activeText]}>{currency}</Text></Pressable>)}</View>
        <View style={styles.custom}><TextInput style={[styles.input, styles.customInput]} value={customCurrency} onChangeText={setCustomCurrency} placeholder="Custom" /><Pressable style={styles.use} onPress={() => { if (customCurrency.trim()) updateSettings({ currency: customCurrency.trim() }); setCustomCurrency(''); }}><Text style={styles.activeText}>Use</Text></Pressable></View>
      </Section>

      <Text style={styles.heading}>Manage</Text>
      <ManageRow label="Fund accounts" onPress={() => router.push('/funds')} />
      <ManageRow label="Recurring payments" onPress={() => router.push('/recurring')} />
      <ManageRow label="Backup & restore" onPress={() => router.push('/backup')} />
    </ScrollView>
  );
}

function Section({ title, children }) {
  return <><Text style={styles.heading}>{title}</Text><View style={styles.box}>{children}</View></>;
}
function Segment({ options, value, onChange }) {
  return <View style={styles.segment}>{options.map((item) => <Pressable key={item} style={[styles.segmentItem, value === item && styles.active]} onPress={() => onChange(item)}><Text style={[styles.segmentText, value === item && styles.activeText]}>{item}</Text></Pressable>)}</View>;
}
function MoneyInput({ value, onChange }) {
  return <TextInput style={styles.input} keyboardType="decimal-pad" defaultValue={(value / 100).toString()} onEndEditing={(event) => onChange(Math.max(0, Math.round((parseFloat(event.nativeEvent.text) || 0) * 100)))} />;
}
function ManageRow({ label, onPress }) {
  return <Pressable style={styles.row} onPress={onPress}><Text style={styles.rowTitle}>{label}</Text><Ionicons name="chevron-forward" size={18} color={theme.colors.inkSoft} /></Pressable>;
}
function DateField({ label, value, onChange }) {
  return <View style={styles.dateField}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value ?? ''} onChangeText={onChange} placeholder="YYYY-MM-DD" /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, gap: 10 },
  heading: { fontSize: 12, fontWeight: '700', color: theme.colors.inkSoft, textTransform: 'uppercase', marginTop: 12 },
  box: { backgroundColor: theme.colors.surface, padding: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, gap: 10 },
  hint: { fontSize: 12, color: theme.colors.inkSoft, textAlign: 'center' },
  label: { fontSize: 12, color: theme.colors.inkSoft },
  segment: { flexDirection: 'row', gap: 5 },
  segmentItem: { flex: 1, minWidth: 0, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 6 },
  segmentText: { fontSize: 11, color: theme.colors.inkSoft, textTransform: 'capitalize' },
  active: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  activeText: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: 11, fontSize: 15, color: theme.colors.ink },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateField: { flex: 1, gap: 4 },
  centerSummary: { alignItems: 'center', paddingVertical: 10, gap: 4 },
  budgetValue: { fontSize: 28, fontFamily: theme.fonts.mono, fontWeight: '700', color: theme.colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  rowTitle: { flexShrink: 1, fontWeight: '600', color: theme.colors.ink, textTransform: 'capitalize' },
  currencyGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  currency: { width: 48, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 6, backgroundColor: theme.colors.surface },
  currencyText: { fontSize: 17, color: theme.colors.ink },
  custom: { flexDirection: 'row', gap: 8 },
  customInput: { flex: 1 },
  use: { backgroundColor: theme.colors.accent, paddingHorizontal: 20, justifyContent: 'center', borderRadius: theme.radius.md },
});
