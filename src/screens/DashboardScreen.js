import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import Sheet from '../components/Sheet';
import { fmtCurrency, fmtDate, getTheme, theme } from '../theme';

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { settings, totalOutstanding, totalExpenses, spendable, totalFunds, transactions, accounts, budgetSummary, piggyBankBalance } = useData();
  const colors = getTheme(settings.themeMode).colors;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing(6) }]}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: 'Money Sleuth',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push('/piggybank')} style={styles.headerButton} accessibilityLabel="Piggybank">
                <MaterialCommunityIcons name="piggy-bank-outline" size={22} color={colors.gold} />
              </Pressable>
              <Pressable onPress={() => router.push('/settings')} style={styles.headerButton} accessibilityLabel="Settings">
                <Ionicons name="settings-outline" size={21} color={colors.inkSoft} />
              </Pressable>
            </View>
          ),
        }}
      />

      <Pressable style={styles.balanceBand} onPress={() => setHistoryOpen(true)}>
        <Text style={[styles.eyebrow, { color: colors.inkSoft }]}>Current money</Text>
        <Text style={[styles.heroValue, { color: colors.accent }, spendable < 0 && { color: colors.owed }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmtCurrency(spendable, settings.currency)}
        </Text>
        <Text style={[styles.explanation, { color: colors.inkSoft }]}>Money currently available across all your funds</Text>
      </Pressable>

      <Pressable style={[styles.capitalRow, { backgroundColor: colors.surface, borderColor: colors.line }]} onPress={() => router.push('/funds')}>
        <View>
          <Text style={[styles.rowLabel, { color: colors.inkSoft }]}>Funds</Text>
          <Text style={[styles.rowValue, { color: colors.ink }]}>{fmtCurrency(totalFunds, settings.currency)}</Text>
        </View>
        <Ionicons name="create-outline" size={20} color={theme.colors.accent} />
      </Pressable>

      <View style={[styles.breakdown, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.inkSoft }]}>Outstanding</Text>
          <Text style={[styles.metricValue, styles.negative]}>{fmtCurrency(totalOutstanding, settings.currency)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.inkSoft }]}>Expenses</Text>
          <Text style={[styles.metricValue, { color: colors.ink }]}>{fmtCurrency(totalExpenses, settings.currency)}</Text>
        </View>
      </View>
      {(settings.budgetMode != null || piggyBankBalance > 0) && (
        <View style={[styles.planBand, { backgroundColor: colors.goldSoft }]}>
          <Pressable style={styles.planItem} onPress={() => router.push('/piggybank')}>
            <Text style={[styles.metricLabel, { color: colors.inkSoft }]}>Piggybank</Text>
            <Text style={styles.planValue}>{fmtCurrency(piggyBankBalance, settings.currency)}</Text>
          </Pressable>
          <View style={[styles.planDivider, { backgroundColor: colors.line }]} />
          <View style={styles.planItem}>
            <Text style={[styles.metricLabel, { color: colors.inkSoft }]}>
              {settings.budgetMode ? `${settings.budgetMode} budget / day` : 'Daily budget'}
            </Text>
            <Text style={styles.planValue}>
              {fmtCurrency(settings.budgetMode ? budgetSummary[settings.budgetMode]?.available ?? 0 : 0, settings.currency)}
            </Text>
            {(budgetSummary[settings.budgetMode]?.recurringDue ?? 0) > 0 && (
              <Text style={styles.reserved}>{fmtCurrency(budgetSummary[settings.budgetMode].recurringDue, settings.currency)} reserved</Text>
            )}
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.inkSoft }]}>Investigate</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.creditAction, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]} onPress={() => router.push('/credits')}>
          <View style={[styles.actionIcon, styles.creditIcon]}>
            <Ionicons name="people-outline" size={25} color={theme.colors.accent} />
          </View>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, { color: colors.ink }]}>Credits</Text>
            <Text style={[styles.actionBody, { color: colors.inkSoft }]}>Track money owed in either direction</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.inkFaint} />
        </Pressable>
        <Pressable style={[styles.action, styles.expenseAction, { backgroundColor: colors.owedSoft, borderColor: colors.owed }]} onPress={() => router.push('/expenses')}>
          <View style={[styles.actionIcon, styles.expenseIcon]}>
            <Ionicons name="receipt-outline" size={25} color={theme.colors.owed} />
          </View>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, { color: colors.ink }]}>Expenses</Text>
            <Text style={[styles.actionBody, { color: colors.inkSoft }]}>Record what leaves your capital</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.inkFaint} />
        </Pressable>
        <Pressable style={[styles.action, { borderColor: colors.line, backgroundColor: colors.surface }]} onPress={() => router.push(settings.incomeType === 'freelance' ? '/income' : '/settings')}>
          <View style={[styles.actionIcon, styles.creditIcon]}><Ionicons name="wallet-outline" size={25} color={theme.colors.gold} /></View>
          <View style={styles.actionText}><Text style={[styles.actionTitle, { color: colors.ink }]}>{settings.incomeType === 'freelance' ? 'Freelance income' : settings.incomeType === 'employed' ? 'Employed income' : 'Allowance'}</Text><Text style={[styles.actionBody, { color: colors.inkSoft }]}>Manage your current source of income</Text></View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.inkFaint} />
        </Pressable>
        <Pressable style={[styles.action, { borderColor: colors.line, backgroundColor: colors.surface }]} onPress={() => router.push('/recurring')}>
          <View style={[styles.actionIcon, styles.expenseIcon]}><Ionicons name="repeat-outline" size={25} color={theme.colors.owed} /></View>
          <View style={styles.actionText}><Text style={[styles.actionTitle, { color: colors.ink }]}>Recurring payments</Text><Text style={[styles.actionBody, { color: colors.inkSoft }]}>Weekly, monthly, and yearly deductions</Text></View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.inkFaint} />
        </Pressable>
      </View>
      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)}>
        <Text style={styles.sheetTitle}>Current money history</Text>
        {[...transactions].reverse().map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={styles.historyInfo}>
              <Text style={styles.historyNote}>{item.note}</Text>
              <Text style={styles.historyMeta}>
                {fmtDate(item.date)} / {accounts.find((account) => account.id === item.accountId)?.name ?? 'Unknown fund'} / {item.type.replaceAll('_', ' ')}
              </Text>
            </View>
            <Text style={[styles.historyAmount, item.amount < 0 ? styles.negative : styles.income]}>
              {item.amount > 0 ? '+' : ''}{fmtCurrency(item.amount, settings.currency)}
            </Text>
          </View>
        ))}
        {transactions.length === 0 && <Text style={styles.emptyHistory}>No money movements yet.</Text>}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(4), gap: theme.spacing(4) },
  headerButton: { padding: theme.spacing(1) },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  balanceBand: { paddingVertical: theme.spacing(5), alignItems: 'center' },
  eyebrow: { fontSize: 13, color: theme.colors.inkSoft, marginBottom: theme.spacing(2) },
  heroValue: { fontSize: 38, fontFamily: theme.fonts.mono, fontWeight: '700', color: theme.colors.accent, maxWidth: '100%' },
  explanation: { fontSize: 12, color: theme.colors.inkSoft, textAlign: 'center', marginTop: theme.spacing(2) },
  negative: { color: theme.colors.owed },
  capitalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing(4), borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md },
  rowLabel: { fontSize: 12, color: theme.colors.inkSoft },
  rowValue: { fontSize: 20, fontFamily: theme.fonts.mono, fontWeight: '700', color: theme.colors.ink, marginTop: 3 },
  breakdown: { flexDirection: 'row', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing(4) },
  planBand: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: theme.colors.goldSoft, borderRadius: theme.radius.md, padding: theme.spacing(3) },
  planItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing(2) },
  planDivider: { width: 1, minHeight: 44 },
  planValue: { fontSize: 14, fontFamily: theme.fonts.mono, fontWeight: '700', color: theme.colors.gold, marginTop: 3, textTransform: 'capitalize' },
  reserved: { fontSize: 10, color: theme.colors.inkSoft, marginTop: 2 },
  metric: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: theme.colors.line },
  metricLabel: { fontSize: 12, color: theme.colors.inkSoft, marginBottom: theme.spacing(1) },
  metricValue: { fontSize: 15, fontFamily: theme.fonts.mono, fontWeight: '600', color: theme.colors.ink },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.inkSoft, textTransform: 'uppercase' },
  actions: { gap: theme.spacing(3) },
  action: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(4), borderRadius: theme.radius.md, borderWidth: 1 },
  creditAction: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  expenseAction: { backgroundColor: theme.colors.owedSoft, borderColor: theme.colors.owed },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  creditIcon: { backgroundColor: theme.colors.surface },
  expenseIcon: { backgroundColor: theme.colors.surface },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  actionBody: { fontSize: 12, color: theme.colors.inkSoft, marginTop: 2 },
  dialogTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.ink, marginBottom: theme.spacing(4) },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: theme.spacing(3), fontSize: 18, color: theme.colors.ink, marginBottom: theme.spacing(4) },
  dialogActions: { flexDirection: 'row', gap: theme.spacing(3) },
  button: { flex: 1, paddingVertical: theme.spacing(3), alignItems: 'center', borderRadius: theme.radius.md },
  ghost: { borderWidth: 1, borderColor: theme.colors.line },
  ghostText: { color: theme.colors.inkSoft, fontWeight: '600' },
  primary: { backgroundColor: theme.colors.accent },
  primaryText: { color: theme.colors.surface, fontWeight: '600' },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.ink, marginBottom: theme.spacing(3) },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(3), borderBottomWidth: 1, borderColor: theme.colors.line },
  historyInfo: { flex: 1, minWidth: 0 },
  historyNote: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  historyMeta: { fontSize: 11, color: theme.colors.inkSoft, marginTop: 3, textTransform: 'capitalize' },
  historyAmount: { fontFamily: theme.fonts.mono, fontWeight: '700' },
  income: { color: theme.colors.settled },
  emptyHistory: { color: theme.colors.inkSoft, textAlign: 'center', paddingVertical: theme.spacing(8) },
});
