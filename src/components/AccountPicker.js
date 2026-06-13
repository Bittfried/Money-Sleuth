import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../data/DataContext';
import { fmtCurrency, theme } from '../theme';
import Sheet from './Sheet';

export default function AccountPicker({ value, onChange, label = 'Fund source' }) {
  const [open, setOpen] = useState(false);
  const { accounts, settings } = useData();
  const selected = accounts.find((account) => account.id === value);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.inputText}>{selected ? `${selected.name} · ${fmtCurrency(selected.balance, settings.currency)}` : 'Choose fund'}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.inkSoft} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.title}>{label}</Text>
        {accounts.map((account) => (
          <Pressable key={account.id} style={styles.option} onPress={() => { onChange(account.id); setOpen(false); }}>
            <Text style={styles.optionText}>{account.name}</Text>
            <Text style={styles.balance}>{fmtCurrency(account.balance, settings.currency)}</Text>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: theme.colors.inkSoft, marginBottom: theme.spacing(1), fontWeight: '500' },
  input: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: theme.spacing(3), marginBottom: theme.spacing(3) },
  inputText: { color: theme.colors.ink, fontSize: 15 },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.ink, marginBottom: theme.spacing(3) },
  option: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(3), borderBottomWidth: 1, borderColor: theme.colors.line },
  optionText: { color: theme.colors.ink, fontWeight: '600' },
  balance: { color: theme.colors.inkSoft, fontFamily: theme.fonts.mono },
});
