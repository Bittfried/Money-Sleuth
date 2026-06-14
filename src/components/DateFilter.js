import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from './Sheet';
import { theme } from '../theme';

const OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: 'day', label: 'This day' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  label: new Date(2024, index, 1).toLocaleDateString('en-US', { month: 'long' }),
}));
const YEARS = Array.from({ length: 12 }, (_, index) => new Date().getFullYear() - index);

export const matchesDateFilter = (iso, filter) => {
  const date = new Date(`${iso}T12:00:00`);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return false;
  if (filter.type === 'all') return true;
  if (filter.type === 'day') return date.toDateString() === now.toDateString();
  if (filter.type === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  }
  if (filter.type === 'month') return date.getMonth() === filter.month && date.getFullYear() === filter.year;
  return date.getFullYear() === filter.year;
};

export default function DateFilter({ value, onChange, right }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const label = OPTIONS.find((item) => item.key === value.type)?.label;

  const chooseType = (type) => {
    if (type === 'month') onChange({ type, month: new Date().getMonth(), year: new Date().getFullYear() });
    else if (type === 'year') onChange({ type, year: new Date().getFullYear() });
    else onChange({ type });
    setFilterOpen(false);
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable style={styles.dropdown} onPress={() => setFilterOpen(true)}>
          <Ionicons name="funnel-outline" size={15} color={theme.colors.inkSoft} />
          <Text style={styles.dropdownText}>{label}</Text>
          <Ionicons name="chevron-down" size={15} color={theme.colors.inkSoft} />
        </Pressable>
        {(value.type === 'month' || value.type === 'year') && (
          <Pressable style={styles.period} onPress={() => setPeriodOpen(true)}>
            <Text style={styles.periodText} numberOfLines={1}>
              {value.type === 'month' ? MONTHS[value.month]?.label ?? 'Choose month' : value.year}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.inkSoft} />
          </Pressable>
        )}
        <View style={styles.spacer} />
        {right}
      </View>
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <Text style={styles.title}>Filter period</Text>
        {OPTIONS.map((item) => (
          <Pressable key={item.key} style={styles.option} onPress={() => chooseType(item.key)}>
            <Text style={styles.optionText}>{item.label}</Text>
            {value.type === item.key && <Ionicons name="checkmark" size={18} color={theme.colors.accent} />}
          </Pressable>
        ))}
      </Sheet>
      <Sheet visible={periodOpen} onClose={() => setPeriodOpen(false)}>
        <Text style={styles.title}>{value.type === 'month' ? 'Choose month' : 'Choose year'}</Text>
        {(value.type === 'month' ? MONTHS : YEARS.map((year) => ({ label: String(year), value: year }))).map((item) => (
          <Pressable key={item.value} style={styles.option} onPress={() => {
            onChange(value.type === 'month' ? { ...value, month: item.value } : { ...value, year: item.value });
            setPeriodOpen(false);
          }}>
            <Text style={styles.optionText}>{item.label}</Text>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing(3), height: 38 },
  dropdownText: { fontSize: 12, color: theme.colors.ink, fontWeight: '600' },
  period: { maxWidth: 130, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing(2), height: 38 },
  periodText: { flexShrink: 1, fontSize: 12, color: theme.colors.inkSoft },
  spacer: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.ink, marginBottom: theme.spacing(3) },
  option: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(3), borderBottomWidth: 1, borderColor: theme.colors.line },
  optionText: { color: theme.colors.ink, fontSize: 15 },
});
