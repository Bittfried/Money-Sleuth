import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '../data/DataContext';
import { theme, fmtCurrency } from '../theme';
import Avatar from '../components/Avatar';

export default function PersonScreen() {
  const router = useRouter();
  const { personId, direction = 'receivable' } = useLocalSearchParams();
  const { people, balanceFor, entriesFor, removePerson, updatePerson, settings } = useData();
  const person = people.find((p) => p.id === personId);

  const balance = balanceFor(personId, direction);
  const owedCount = entriesFor(personId, 'owed', direction).length;
  const paidCount = entriesFor(personId, 'paid', direction).length;

  if (!person) return null;

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change this profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const photo = result.assets[0].uri;
    Alert.alert('Change profile picture?', `Use this new picture for ${person.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change', onPress: () => updatePerson(personId, { photo }) },
    ]);
  };

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
                Alert.alert('Remove person', `Remove ${person.name} and their credit entries? Past money movements stay in history, and current money will not change.`, [
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
        <Pressable onPress={choosePhoto} style={styles.avatarButton} accessibilityLabel="Change profile picture">
          <Avatar name={person.name} photo={person.photo} size={88} />
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color={theme.colors.surface} />
          </View>
        </Pressable>
        <Text style={styles.name}>{person.name}</Text>

        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>{direction === 'payable' ? 'You currently owe' : 'Currently owes you'}</Text>
          <Text
            style={[styles.balanceValue, balance > 0 ? styles.owedText : styles.zeroText]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmtCurrency(balance, settings.currency)}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, styles.owedBtn]}
            onPress={() => router.push({ pathname: '/ledger/[personId]', params: { personId, type: 'owed', direction } })}
          >
            <Ionicons name="receipt-outline" size={20} color={theme.colors.owed} />
            <Text style={[styles.actionLabel, styles.owedText]}>{direction === 'payable' ? 'Unpaid' : 'Owed'}</Text>
            <Text style={styles.actionCount}>{owedCount} entr{owedCount === 1 ? 'y' : 'ies'}</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.paidBtn]}
            onPress={() => router.push({ pathname: '/ledger/[personId]', params: { personId, type: 'paid', direction } })}
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
  avatarButton: {
    position: 'relative',
    padding: theme.spacing(1),
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
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
