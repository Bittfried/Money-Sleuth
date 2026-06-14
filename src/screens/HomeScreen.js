import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataContext';
import { theme, fmtCurrency } from '../theme';
import Avatar from '../components/Avatar';
import Sheet from '../components/Sheet';
import { parseLocalDate } from '../date';

const SORT_OPTIONS = [
  { key: 'balance', label: 'Highest balance' },
  { key: 'name', label: 'Name (A-Z)' },
  { key: 'recent', label: 'Recent activity' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { people, balanceFor, addPerson, lastActivityFor, settings, totalOutstanding, totalPayable } = useData();
  const [direction, setDirection] = useState('receivable');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('balance');
  const [sortOpen, setSortOpen] = useState(false);

  const total = direction === 'receivable' ? totalOutstanding : totalPayable;

  const lastActivityLabel = (personId) => {
    const date = lastActivityFor(personId, direction);
    if (!date) return 'No activity yet';
    const diffDays = Math.floor((Date.now() - parseLocalDate(date).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Last activity today';
    if (diffDays === 1) return 'Last activity yesterday';
    if (diffDays < 14) return `Last activity ${diffDays} days ago`;
    const weeks = Math.floor(diffDays / 7);
    return `Last activity ${weeks} week${weeks > 1 ? 's' : ''} ago`;
  };

  const visiblePeople = useMemo(() => {
    let list = people;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === 'balance') {
      sorted.sort((a, b) => balanceFor(b.id, direction) - balanceFor(a.id, direction));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const da = lastActivityFor(a.id, direction);
        const db = lastActivityFor(b.id, direction);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      });
    }
    return sorted;
  }, [people, query, sortBy, direction, balanceFor, lastActivityFor]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const submitAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addPerson(trimmed, photo);
    setName('');
    setPhoto(null);
    setAddOpen(false);
  };

  const closeAdd = () => {
    setName('');
    setPhoto(null);
    setAddOpen(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Credits' }} />
      <FlatList
        data={visiblePeople}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.directionTabs}>
              <Pressable style={[styles.directionTab, direction === 'receivable' && styles.directionTabActive]} onPress={() => setDirection('receivable')}>
                <Text style={[styles.directionText, direction === 'receivable' && styles.directionTextActive]}>Owed to you</Text>
              </Pressable>
              <Pressable style={[styles.directionTab, direction === 'payable' && styles.directionTabActive]} onPress={() => setDirection('payable')}>
                <Text style={[styles.directionText, direction === 'payable' && styles.directionTextActive]}>You owe</Text>
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={theme.colors.inkFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search people"
                  placeholderTextColor={theme.colors.inkFaint}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={16} color={theme.colors.inkFaint} />
                  </Pressable>
                )}
              </View>
              <Pressable
                style={styles.sortBtn}
                onPress={() => setSortOpen(true)}
                accessibilityLabel="Sort people"
              >
                <Ionicons name="swap-vertical" size={18} color={theme.colors.inkSoft} />
              </Pressable>
            </View>

            {people.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{direction === 'receivable' ? 'Total owed to you' : 'Total you owe'}</Text>
                <Text
                  style={[styles.totalValue, total > 0 ? styles.owedText : styles.zeroText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmtCurrency(total, settings.currency)}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={query ? 'search-outline' : 'people-outline'}
              size={36}
              color={theme.colors.inkFaint}
            />
            <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No one here yet'}</Text>
            <Text style={styles.emptyBody}>
              {query
                ? `No one named "${query}" yet.`
                : direction === 'receivable' ? 'Add someone to start tracking what they owe you.' : 'Add someone to start tracking what you owe them.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const balance = balanceFor(item.id, direction);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push({ pathname: '/person/[personId]', params: { personId: item.id, direction } })}
            >
              <Avatar name={item.name} photo={item.photo} size={48} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSub}>{lastActivityLabel(item.id)}</Text>
              </View>
              <Text
                style={[styles.cardAmount, balance > 0 ? styles.owedText : styles.zeroText]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtCurrency(balance, settings.currency)}
              </Text>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + theme.spacing(5) }]}
        onPress={() => setAddOpen(true)}
        accessibilityLabel="Add person"
      >
        <Ionicons name="add" size={28} color={theme.colors.surface} />
      </Pressable>

      <Sheet visible={addOpen} onClose={closeAdd} variant="center">
        <Text style={styles.sheetTitle}>Add person</Text>

        <Pressable style={styles.photoPicker} onPress={pickPhoto}>
          <Avatar name={name || '?'} photo={photo} size={64} />
          <Text style={styles.photoPickerLabel}>
            {photo ? 'Change photo' : 'Add photo (optional)'}
          </Text>
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={theme.colors.inkFaint}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submitAdd}
        />

        <View style={styles.sheetActions}>
          <Pressable style={[styles.sheetBtn, styles.sheetBtnGhost]} onPress={closeAdd}>
            <Text style={styles.sheetBtnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.sheetBtn, styles.sheetBtnPrimary, !name.trim() && styles.sheetBtnDisabled]}
            onPress={submitAdd}
            disabled={!name.trim()}
          >
            <Text style={styles.sheetBtnPrimaryText}>Add</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <Text style={styles.sheetTitle}>Sort by</Text>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={styles.sortOption}
            onPress={() => {
              setSortBy(opt.key);
              setSortOpen(false);
            }}
          >
            <Text style={styles.sortOptionLabel}>{opt.label}</Text>
            {sortBy === opt.key && <Ionicons name="checkmark" size={18} color={theme.colors.accent} />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  listContent: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(24),
  },
  directionTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 3,
    marginBottom: theme.spacing(3),
  },
  directionTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
  },
  directionTabActive: {
    backgroundColor: theme.colors.accent,
  },
  directionText: {
    color: theme.colors.inkSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  directionTextActive: {
    color: theme.colors.surface,
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(3),
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.ink,
    paddingVertical: theme.spacing(2.5),
  },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(4),
    borderBottomWidth: 1,
    borderColor: theme.colors.line,
    marginBottom: theme.spacing(3),
  },
  totalLabel: {
    fontSize: 14,
    color: theme.colors.inkSoft,
  },
  totalValue: {
    fontSize: 22,
    fontFamily: theme.fonts.mono,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2.5),
    gap: theme.spacing(3),
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 16,
    fontFamily: theme.fonts.mono,
    fontWeight: '600',
  },
  owedText: {
    color: theme.colors.owed,
  },
  zeroText: {
    color: theme.colors.inkSoft,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing(5),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  empty: {
    alignItems: 'center',
    paddingTop: theme.spacing(20),
    gap: theme.spacing(2),
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  emptyBody: {
    fontSize: 13,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    maxWidth: 220,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.ink,
    marginBottom: theme.spacing(4),
  },
  photoPicker: {
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(4),
  },
  photoPickerLabel: {
    fontSize: 13,
    color: theme.colors.accent,
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
    marginBottom: theme.spacing(4),
  },
  sheetActions: {
    flexDirection: 'row',
    gap: theme.spacing(3),
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
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing(3),
    borderBottomWidth: 1,
    borderColor: theme.colors.line,
  },
  sortOptionLabel: {
    fontSize: 15,
    color: theme.colors.ink,
  },
});
