import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useData } from '../data/DataContext';
import { theme, fmtCurrency, fmtDate } from '../theme';
import Sheet from '../components/Sheet';

const FILTERS = [
  { key: 'all', label: 'All time' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

function inFilter(dateIso, filterKey) {
  if (filterKey === 'all') return true;
  const d = new Date(dateIso);
  const now = new Date();
  if (filterKey === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (filterKey === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  }
  return true;
}

export default function LedgerScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { personId, type = 'owed' } = useLocalSearchParams();
  const { people, entriesFor, addEntry, markPaid, markOwed, editEntry, deleteEntry } = useData();
  const name = people.find((person) => person.id === personId)?.name ?? 'Ledger';

  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const entries = entriesFor(personId, type);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => inFilter(e.date, filter))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [entries, filter]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);

  const resetForm = () => {
    setAmount('');
    setNote('');
    setDate(new Date());
    setEditingId(null);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setAmount((entry.amount / 100).toString());
    setNote(entry.note);
    setDate(new Date(entry.date));
    setAddOpen(true);
  };

  const submitAdd = () => {
    const numeric = parseFloat(amount.replace(',', '.'));
    if (!numeric || numeric <= 0) return;
    if (editingId) {
      editEntry(editingId, {
        amount: Math.round(numeric * 100),
        note: note.trim() || 'Entry',
        date: date.toISOString().slice(0, 10),
      });
    } else {
      addEntry(personId, {
        amount: Math.round(numeric * 100),
        note: note.trim() || 'Entry',
        date: date.toISOString().slice(0, 10),
        status: 'owed',
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

  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setDate(selected);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: type === 'paid' ? `${name} · Paid` : `${name} · Owed` }} />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
        {type === 'owed' && (
          <Pressable style={styles.addChip} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={16} color={theme.colors.surface} />
            <Text style={styles.addChipLabel}>Add</Text>
          </Pressable>
        )}
      </View>

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
                {type === 'owed' ? 'No outstanding entries for this period.' : 'No paid entries for this period.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={[styles.row, compact && styles.compactRow]} onPress={() => openEdit(item)}>
              <View style={compact ? styles.compactInfo : styles.colDate}>
                {compact && <Text style={styles.compactNote} numberOfLines={2}>{item.note}</Text>}
                <Text style={[styles.cell, !compact && styles.colDate, styles.cellMuted]}>
                  {fmtDate(item.date)}
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
                {fmtCurrency(item.amount)}
              </Text>
              <View style={compact ? styles.compactAction : styles.colAction}>
                {type === 'owed' ? (
                  <Pressable
                    style={styles.markBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      markPaid(item.id);
                    }}
                  >
                    <Text style={styles.markBtnText}>Paid</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      markOwed(item.id);
                    }}
                    accessibilityLabel="Move back to owed"
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
        <Text style={styles.totalLabel}>{type === 'owed' ? 'Total owed' : 'Total settled'}</Text>
        <Text style={[styles.totalValue, type === 'owed' ? styles.amountText : styles.amountPaid]}>
          {fmtCurrency(total)}
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
          <Text style={{ color: theme.colors.ink, fontSize: 16 }}>{fmtDate(date.toISOString())}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

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
            style={[styles.sheetBtn, styles.sheetBtnPrimary, !amount && styles.sheetBtnDisabled]}
            onPress={submitAdd}
            disabled={!amount}
          >
            <Text style={styles.sheetBtnPrimaryText}>{editingId ? 'Save changes' : 'Add entry'}</Text>
          </Pressable>
        </View>
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  filterLabel: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: theme.colors.surface,
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
    flex: 1.1,
  },
  colNote: {
    flex: 1.6,
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
