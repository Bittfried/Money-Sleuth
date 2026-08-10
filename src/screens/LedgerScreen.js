import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useData } from '../data/DataContext';
import { theme, fmtCurrency, fmtDate } from '../theme';
import Sheet from '../components/Sheet';
import DateFilter, { matchesDateFilter } from '../components/DateFilter';
import AccountPicker from '../components/AccountPicker';
import { localDateISO, parseLocalDate } from '../date';

export default function LedgerScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 390;
  const { personId, type = 'owed', direction = 'receivable' } = useLocalSearchParams();
  const { people, entriesFor, addEntry, receiveEntry, receiveEntriesForPerson, markOwed, editEntry, deleteEntry, settings, accounts } = useData();
  const name = people.find((person) => person.id === personId)?.name ?? 'Ledger';
  const payable = direction === 'payable';
  const owedLabel = payable ? 'Owe' : 'Owed';
  const settledLabel = payable ? 'Paid' : 'Returns';
  const bulkLabel = payable ? 'Paid all' : 'Returned all';

  const [filter, setFilter] = useState({ type: 'all' });
  const [payingId, setPayingId] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [paidAccountId, setPaidAccountId] = useState(accounts[0]?.id);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!accounts[0]) return;
    setSourceAccountId((current) => current ?? accounts[0].id);
    setPaidAccountId((current) => current ?? accounts[0].id);
  }, [accounts]);

  const entries = entriesFor(personId, type, direction);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => matchesDateFilter(e.date, filter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, filter]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);
  const bulkEntryIds = useMemo(() => filtered.map((entry) => entry.id), [filtered]);

  const resetForm = () => {
    setAmount('');
    setNote('');
    setDate(new Date());
    setSourceAccountId(accounts[0]?.id);
    setEditingId(null);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setAmount((entry.amount / 100).toString());
    setNote(entry.note);
    setDate(parseLocalDate(entry.date));
    setSourceAccountId(entry.sourceAccountId ?? accounts[0]?.id);
    setAddOpen(true);
  };

  const submitAdd = () => {
    const numeric = parseFloat(amount.replace(',', '.'));
    if (!numeric || numeric <= 0) return;
    if (editingId) {
      editEntry(editingId, {
        amount: Math.round(numeric * 100),
        note: note.trim() || 'Entry',
        date: localDateISO(date),
        sourceAccountId: direction === 'receivable' ? sourceAccountId : null,
      });
    } else {
      addEntry(personId, {
        amount: Math.round(numeric * 100),
        note: note.trim() || 'Entry',
        date: localDateISO(date),
        status: 'owed',
        direction,
        sourceAccountId: direction === 'receivable' ? sourceAccountId : null,
      });
    }
    resetForm();
    setAddOpen(false);
  };

  const removeEntry = () => {
    if (!editingId) return;
    deleteEntry(editingId);
    resetForm();
    setAddOpen(false);
  };
  const confirmBulk = () => {
    if (!paidAccountId || bulkEntryIds.length === 0) return;
    Alert.alert(`${bulkLabel}?`, `${bulkLabel} ${bulkEntryIds.length} entr${bulkEntryIds.length === 1 ? 'y' : 'ies'} for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: bulkLabel,
        onPress: () => {
          receiveEntriesForPerson(personId, direction, paidAccountId, bulkEntryIds);
          setBulkOpen(false);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
      <Stack.Screen options={{ title: `${name} - ${type === 'paid' ? settledLabel : owedLabel}` }} />
      <DateFilter value={filter} onChange={setFilter} right={type === 'owed' && <View style={styles.filterActions}>
        <Pressable style={styles.addChip} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={16} color={theme.colors.surface} />
            <Text style={styles.addChipLabel}>Add</Text>
          </Pressable>
        <Pressable style={[styles.bulkChip, bulkEntryIds.length === 0 && styles.disabled]} onPress={() => setBulkOpen(true)} disabled={bulkEntryIds.length === 0}>
          <Ionicons name="checkmark-done-outline" size={15} color={theme.colors.settled} />
          <Text style={styles.bulkChipLabel}>{bulkLabel}</Text>
        </Pressable>
      </View>} />

      <View style={[styles.table, compact && styles.compactTable]}>
        {!compact && <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.colDate]}>Date</Text>
          <Text style={[styles.headerCell, styles.colNote]}>Note</Text>
          <Text style={[styles.headerCell, styles.colAmount]}>Amount</Text>
          <View style={styles.colAction} />
        </View>}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {type === 'owed' ? `No ${payable ? 'owe' : 'owed'} entries for this period.` : `No ${settledLabel.toLowerCase()} for this period.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={[styles.row, compact && styles.compactRow]} onPress={() => openEdit(item)}>
              <View style={compact ? styles.compactInfo : styles.colDate}>
                {compact && <Text style={styles.compactNote} numberOfLines={2}>{item.note}</Text>}
                <Text style={[styles.cell, !compact && styles.colDate, styles.cellMuted]}>
                  {fmtDate(item.date)}
                  {direction === 'receivable' && item.sourceAccountId ? ` / from ${accounts.find((account) => account.id === item.sourceAccountId)?.name ?? 'Unknown fund'}` : ''}
                  {type === 'paid' && item.paidAccountId ? ` / ${direction === 'payable' ? 'from' : 'to'} ${accounts.find((account) => account.id === item.paidAccountId)?.name ?? 'Unknown fund'}` : ''}
                </Text>
              </View>
              {!compact && <Text style={[styles.cell, styles.colNote]} numberOfLines={1}>{item.note}</Text>}
              <Text
                style={[
                  styles.cell,
                  compact ? styles.compactAmount : styles.colAmount,
                  styles.amountText,
                  type === 'paid' && styles.amountPaid,
                ]}
              >
                {fmtCurrency(item.amount, settings.currency)}
              </Text>
              <View style={compact ? styles.compactAction : styles.colAction}>
                {type === 'owed' ? (
                  <Pressable
                    style={styles.markBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setPayingId(item.id);
                    }}
                  >
                    <Text style={styles.markBtnText}>{payable ? 'Pay' : 'Returned'}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      markOwed(item.id);
                    }}
                    accessibilityLabel={`Move back to ${owedLabel}`}
                  >
                    <Ionicons name="arrow-undo-outline" size={16} color={theme.colors.inkSoft} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
          onScrollBeginDrag={() => {}}
        />
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{type === 'owed' ? `Total ${owedLabel.toLowerCase()}` : `Total ${settledLabel.toLowerCase()}`}</Text>
        <Text style={[styles.totalValue, type === 'owed' ? styles.amountText : styles.amountPaid]}>
          {fmtCurrency(total, settings.currency)}
        </Text>
      </View>

      <Sheet visible={addOpen} onClose={() => { resetForm(); setAddOpen(false); }}>
        <Text style={styles.sheetTitle}>{editingId ? 'Edit entry' : 'New entry'}</Text>

        <Text style={styles.fieldLabel}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={theme.colors.inkFaint}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.fieldLabel}>Note</Text>
        <TextInput
          style={styles.input}
          placeholder="What's this for?"
          placeholderTextColor={theme.colors.inkFaint}
          value={note}
          onChangeText={setNote}
        />

        <Text style={styles.fieldLabel}>Date</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={{ color: theme.colors.ink, fontSize: 16 }}>{fmtDate(localDateISO(date))}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onValueChange={(_, selected) => {
              if (selected) setDate(selected);
              if (Platform.OS === 'android') setShowDatePicker(false);
            }}
            onDismiss={() => setShowDatePicker(false)}
            maximumDate={new Date()}
          />
        )}

        {direction === 'receivable' && <AccountPicker value={sourceAccountId} onChange={setSourceAccountId} label="Taken from" />}

        {editingId && (
          <Pressable style={styles.deleteRow} onPress={removeEntry}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.owed} />
            <Text style={styles.deleteRowText}>Delete entry</Text>
          </Pressable>
        )}

        <View style={styles.sheetActions}>
          <Pressable
            style={[styles.sheetBtn, styles.sheetBtnGhost]}
            onPress={() => { resetForm(); setAddOpen(false); }}
          >
            <Text style={styles.sheetBtnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.sheetBtn, styles.sheetBtnPrimary, (!amount || (direction === 'receivable' && !sourceAccountId)) && styles.sheetBtnDisabled]}
            onPress={submitAdd}
            disabled={!amount || (direction === 'receivable' && !sourceAccountId)}
          >
            <Text style={styles.sheetBtnPrimaryText}>{editingId ? 'Save changes' : 'Add entry'}</Text>
          </Pressable>
        </View>
      </Sheet>
      <Sheet visible={Boolean(payingId)} onClose={() => setPayingId(null)}>
        <Text style={styles.sheetTitle}>{payable ? 'How will you pay this?' : 'Where was this returned?'}</Text>
        <AccountPicker value={paidAccountId} onChange={setPaidAccountId} label={payable ? 'Pay from' : 'Return into'} />
        <Pressable
          style={[styles.sheetBtn, styles.sheetBtnPrimary, !paidAccountId && styles.sheetBtnDisabled]}
          onPress={() => { receiveEntry(payingId, paidAccountId); setPayingId(null); }}
          disabled={!paidAccountId}
        >
          <Text style={styles.sheetBtnPrimaryText}>{payable ? 'Confirm payment' : 'Confirm return'}</Text>
        </Pressable>
      </Sheet>
      <Sheet visible={bulkOpen} onClose={() => setBulkOpen(false)}>
        <Text style={styles.sheetTitle}>{bulkLabel}</Text>
        <AccountPicker value={paidAccountId} onChange={setPaidAccountId} label={payable ? 'Pay from' : 'Return into'} />
        <Pressable style={[styles.sheetBtn, styles.sheetBtnPrimary, (!paidAccountId || bulkEntryIds.length === 0) && styles.sheetBtnDisabled]} onPress={confirmBulk} disabled={!paidAccountId || bulkEntryIds.length === 0}>
          <Text style={styles.sheetBtnPrimaryText}>{bulkLabel}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing(4),
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radius.sm,
  },
  filterActions: {
    flexDirection: 'row',
    gap: theme.spacing(2),
  },
  bulkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.settledSoft,
    borderWidth: 1,
    borderColor: theme.colors.settled,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radius.sm,
  },
  bulkChipLabel: {
    color: theme.colors.settled,
    fontSize: 11,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  addChipLabel: {
    color: theme.colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  table: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    overflow: 'hidden',
  },
  compactTable: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderBottomWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surfaceAlt,
  },
  headerCell: {
    fontSize: 11,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2.5),
    borderBottomWidth: 1,
    borderColor: theme.colors.line,
  },
  compactRow: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing(2),
    paddingVertical: theme.spacing(3),
    gap: theme.spacing(2),
  },
  compactInfo: {
    flex: 1,
    minWidth: 0,
  },
  compactNote: {
    fontSize: 14,
    color: theme.colors.ink,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactAmount: {
    flexShrink: 0,
    textAlign: 'right',
    fontFamily: theme.fonts.mono,
    fontWeight: '600',
  },
  compactAction: {
    width: 48,
    alignItems: 'flex-end',
  },
  cell: {
    fontSize: 13,
    color: theme.colors.ink,
  },
  cellMuted: {
    color: theme.colors.inkSoft,
  },
  colDate: {
    flex: 1.45,
    paddingRight: theme.spacing(2),
  },
  colNote: {
    flex: 1.4,
    paddingRight: theme.spacing(1),
  },
  colAmount: {
    flex: 1.2,
    textAlign: 'right',
    fontFamily: theme.fonts.mono,
    fontWeight: '600',
  },
  colAction: {
    flex: 1,
    alignItems: 'flex-end',
  },
  amountText: {
    color: theme.colors.owed,
  },
  amountPaid: {
    color: theme.colors.settled,
    textDecorationLine: 'line-through',
  },
  markBtn: {
    borderWidth: 1,
    borderColor: theme.colors.settled,
    backgroundColor: theme.colors.settledSoft,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(1),
  },
  markBtnText: {
    color: theme.colors.settled,
    fontSize: 11,
    fontWeight: '600',
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  empty: {
    padding: theme.spacing(8),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(3),
  },
  totalLabel: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  totalValue: {
    fontSize: 16,
    fontFamily: theme.fonts.mono,
    fontWeight: '700',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.ink,
    marginBottom: theme.spacing(4),
  },
  fieldLabel: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    marginBottom: theme.spacing(1),
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: theme.spacing(3),
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: theme.spacing(3),
  },
  sheetActions: {
    flexDirection: 'row',
    gap: theme.spacing(3),
    marginTop: theme.spacing(2),
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  deleteRowText: {
    color: theme.colors.owed,
    fontSize: 14,
    fontWeight: '500',
  },
  sheetBtn: {
    flex: 1,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
  },
  sheetBtnGhost: {
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  sheetBtnGhostText: {
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  sheetBtnPrimary: {
    backgroundColor: theme.colors.accent,
  },
  sheetBtnDisabled: {
    opacity: 0.5,
  },
  sheetBtnPrimaryText: {
    color: theme.colors.surface,
    fontWeight: '600',
  },
});
