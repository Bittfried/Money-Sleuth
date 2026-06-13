import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '../data/DataContext';
import { theme, fmtCurrency } from '../theme';
import Avatar from '../components/Avatar';

export default function PersonScreen() {
  const router = useRouter();
  const { personId } = useLocalSearchParams();
  const { people, balanceFor, entriesFor, removePerson } = useData();
  const person = people.find((p) => p.id === personId);

  const balance = balanceFor(personId);
  const owedCount = entriesFor(personId, 'owed').length;
  const paidCount = entriesFor(personId, 'paid').length;

  if (!person) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: person.name,
          headerRight: () => (
            <Pressable
              onPress={() => {
                Alert.alert('Remove person', `Remove ${person.name} and all their entries?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                      removePerson(personId);
                      router.back();
                    },
                  },
                ]);
              }}
              style={{ padding: theme.spacing(1) }}
              accessibilityLabel="Remove person"
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.inkSoft} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.profileCard}>
        <Avatar name={person.name} photo={person.photo} size={88} />
        <Text style={styles.name}>{person.name}</Text>

        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Currently owed</Text>
          <Text
            style={[styles.balanceValue, balance > 0 ? styles.owedText : styles.zeroText]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmtCurrency(balance)}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, styles.owedBtn]}
            onPress={() => router.push({ pathname: '/ledger/[personId]', params: { personId, type: 'owed' } })}
          >
            <Ionicons name="receipt-outline" size={20} color={theme.colors.owed} />
            <Text style={[styles.actionLabel, styles.owedText]}>Owed</Text>
            <Text style={styles.actionCount}>{owedCount} entr{owedCount === 1 ? 'y' : 'ies'}</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.paidBtn]}
            onPress={() => router.push({ pathname: '/ledger/[personId]', params: { personId, type: 'paid' } })}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.settled} />
            <Text style={[styles.actionLabel, styles.settledText]}>Paid</Text>
            <Text style={styles.actionCount}>{paidCount} entr{paidCount === 1 ? 'y' : 'ies'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(8),
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(6),
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.ink,
    marginTop: theme.spacing(1),
    textAlign: 'center',
  },
  balanceBlock: {
    alignItems: 'center',
    marginVertical: theme.spacing(5),
  },
  balanceLabel: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    marginBottom: theme.spacing(1),
  },
  balanceValue: {
    fontSize: 32,
    fontFamily: theme.fonts.mono,
    fontWeight: '700',
  },
  owedText: {
    color: theme.colors.owed,
  },
  settledText: {
    color: theme.colors.settled,
  },
  zeroText: {
    color: theme.colors.inkSoft,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing(3),
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  owedBtn: {
    backgroundColor: theme.colors.owedSoft,
    borderColor: theme.colors.owed,
  },
  paidBtn: {
    backgroundColor: theme.colors.settledSoft,
    borderColor: theme.colors.settled,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionCount: {
    fontSize: 11,
    color: theme.colors.inkSoft,
  },
});
