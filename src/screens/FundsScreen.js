import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import { fmtCurrency, theme } from '../theme';
import Sheet from '../components/Sheet';

const TYPES = [{ key: 'physical', label: 'Physical' }, { key: 'online', label: 'Online bank' }, { key: 'bank', label: 'Bank' }];
export default function FundsScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, addAccount, editAccount, settings } = useData();
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState('physical'); const [balance, setBalance] = useState('');
  const close = () => { setTypeOpen(false); setOpen(false); setEditing(null); setName(''); setType('physical'); setBalance(''); };
  const startEdit = (item) => { setEditing(item.id); setName(item.name); setType(item.type); setBalance((item.balance / 100).toString()); setOpen(true); };
  const save = () => {
    const fields = { name: name.trim() || TYPES.find((item) => item.key === type).label, type, balance: Math.round((Number.parseFloat(balance) || 0) * 100) };
    if (editing) editAccount(editing, fields); else addAccount(fields); close();
  };
  return <View style={styles.container}>
    <Stack.Screen options={{ title: 'Fund accounts' }} />
    <FlatList data={accounts} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 72 }]} renderItem={({ item }) => (
      <Pressable style={styles.row} onPress={() => startEdit(item)}>
        <View style={styles.icon}><Ionicons name={item.type === 'physical' ? 'cash-outline' : item.type === 'online' ? 'phone-portrait-outline' : 'business-outline'} size={20} color={theme.colors.accent} /></View>
        <View style={styles.info}><Text style={styles.name}>{item.name}</Text><Text style={styles.type}>{TYPES.find((typeItem) => typeItem.key === item.type)?.label}</Text></View>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{fmtCurrency(item.balance, settings.currency)}</Text>
      </Pressable>
    )} />
    <Pressable style={[styles.add, { bottom: insets.bottom + 20 }]} onPress={() => setOpen(true)}><Ionicons name="add" size={20} color={theme.colors.surface} /><Text style={styles.addText}>Add fund</Text></Pressable>
    <Sheet visible={open} onClose={close}>
      <Text style={styles.title}>{editing ? 'Edit fund' : 'Add fund'}</Text>
      <Text style={styles.label}>Type</Text>
      <Pressable style={styles.selector} onPress={() => setTypeOpen(true)}>
        <Text style={styles.selectorText}>{TYPES.find((item) => item.key === type)?.label}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.inkSoft} />
      </Pressable>
      <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="GCash, wallet, savings..." placeholderTextColor={theme.colors.inkFaint} />
      <Text style={styles.label}>Current balance</Text><TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.colors.inkFaint} />
      <View style={styles.actions}><Pressable style={[styles.button, styles.ghost]} onPress={close}><Text>Cancel</Text></Pressable><Pressable style={[styles.button, styles.primary]} onPress={save}><Text style={styles.primaryText}>Save</Text></Pressable></View>
    </Sheet>
    <Sheet visible={typeOpen} onClose={() => setTypeOpen(false)} variant="center">
      <Text style={styles.title}>Choose fund type</Text>
      <View style={styles.typeOptions}>
        {TYPES.map((item) => (
          <Pressable key={item.key} style={[styles.typeOption, type === item.key && styles.typeOptionActive]} onPress={() => { setType(item.key); setTypeOpen(false); }}>
            <Ionicons name={item.key === 'physical' ? 'cash-outline' : item.key === 'online' ? 'phone-portrait-outline' : 'business-outline'} size={20} color={type === item.key ? theme.colors.surface : theme.colors.accent} />
            <Text style={[styles.typeOptionText, type === item.key && styles.typeOptionTextActive]}>{item.label}</Text>
            {type === item.key && <Ionicons name="checkmark" size={20} color={theme.colors.surface} />}
          </Pressable>
        ))}
      </View>
    </Sheet>
  </View>;
}
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:theme.colors.bg,padding:theme.spacing(4)},list:{gap:theme.spacing(2)},row:{flexDirection:'row',alignItems:'center',gap:theme.spacing(3),backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.line,borderRadius:theme.radius.md,padding:theme.spacing(3)},icon:{width:40,height:40,borderRadius:20,backgroundColor:theme.colors.accentSoft,alignItems:'center',justifyContent:'center'},info:{flex:1,minWidth:0},name:{fontWeight:'600',color:theme.colors.ink},type:{fontSize:12,color:theme.colors.inkSoft,marginTop:2},amount:{maxWidth:'42%',fontFamily:theme.fonts.mono,fontWeight:'700',color:theme.colors.ink},add:{position:'absolute',right:20,flexDirection:'row',gap:6,alignItems:'center',backgroundColor:theme.colors.accent,paddingHorizontal:16,height:48,borderRadius:24},addText:{color:theme.colors.surface,fontWeight:'600'},title:{fontSize:18,fontWeight:'600',marginBottom:16,color:theme.colors.ink},label:{fontSize:12,color:theme.colors.inkSoft,marginBottom:4},selector:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:theme.colors.line,backgroundColor:theme.colors.surface,borderRadius:theme.radius.md,padding:12,marginBottom:12},selectorText:{fontSize:15,color:theme.colors.ink},typeOptions:{gap:8},typeOption:{minHeight:48,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:theme.colors.line,borderRadius:theme.radius.md,paddingHorizontal:14},typeOptionActive:{backgroundColor:theme.colors.accent,borderColor:theme.colors.accent},typeOptionText:{flex:1,fontWeight:'600',color:theme.colors.ink},typeOptionTextActive:{color:theme.colors.surface},input:{color:theme.colors.ink,borderWidth:1,borderColor:theme.colors.line,backgroundColor:theme.colors.surface,borderRadius:theme.radius.md,padding:12,fontSize:15,marginBottom:12},actions:{flexDirection:'row',gap:12},button:{flex:1,alignItems:'center',paddingVertical:12,borderRadius:theme.radius.md},ghost:{borderWidth:1,borderColor:theme.colors.line},primary:{backgroundColor:theme.colors.accent},primaryText:{color:theme.colors.surface,fontWeight:'600'}
});
