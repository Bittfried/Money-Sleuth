import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

const LEGACY_STORAGE_KEY = 'owed-to-you:v1';
const DataContext = createContext(null);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const SEED = {
  people: [
    { id: 'p1', name: 'Jordan Diaz', photo: null },
    { id: 'p2', name: 'Maya Reyes', photo: null },
    { id: 'p3', name: 'Tomas Santos', photo: null },
  ],
  entries: [
    { id: 'e1', personId: 'p1', amount: 45000, note: 'Lunch', date: '2026-06-10', status: 'owed' },
    { id: 'e2', personId: 'p1', amount: 30000, note: 'Cab fare', date: '2026-06-05', status: 'owed' },
    { id: 'e3', personId: 'p1', amount: 120000, note: 'Concert ticket', date: '2026-05-28', status: 'owed' },
    { id: 'e4', personId: 'p1', amount: 50000, note: 'Groceries', date: '2026-05-20', status: 'owed' },
    { id: 'e5', personId: 'p1', amount: 60000, note: 'Movie tickets', date: '2026-05-15', status: 'paid' },
    { id: 'e6', personId: 'p1', amount: 35000, note: 'Phone case', date: '2026-05-02', status: 'paid' },
    { id: 'e7', personId: 'p3', amount: 80000, note: 'Borrowed cash', date: '2026-06-01', status: 'owed' },
  ],
};

let databasePromise;

const getDatabase = () => {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync('owed-to-you.db');
  return databasePromise;
};

const rowToEntry = (row) => ({
  id: row.id,
  personId: row.person_id,
  amount: row.amount,
  note: row.note,
  date: row.date,
  status: row.status,
  ...(row.paid_date ? { paidDate: row.paid_date } : {}),
});

async function writePerson(db, person) {
  await db.runAsync(
    `INSERT INTO people (id, name, photo) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, photo = excluded.photo`,
    person.id,
    person.name,
    person.photo ?? null
  );
}

async function writeEntry(db, entry) {
  await db.runAsync(
    `INSERT INTO entries
      (id, person_id, amount, note, date, status, paid_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        person_id = excluded.person_id,
        amount = excluded.amount,
        note = excluded.note,
        date = excluded.date,
        status = excluded.status,
        paid_date = excluded.paid_date`,
    entry.id,
    entry.personId,
    entry.amount,
    entry.note,
    entry.date,
    entry.status,
    entry.paidDate ?? null
  );
}

async function replaceDatabase(people, entries) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM entries');
    await db.runAsync('DELETE FROM people');
    for (const person of people) await writePerson(db, person);
    for (const entry of entries) await writeEntry(db, entry);
  });
}

async function initializeDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      photo TEXT
    );
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('owed', 'paid')),
      paid_date TEXT,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS entries_person_status ON entries(person_id, status);
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const initialized = await db.getFirstAsync("SELECT value FROM metadata WHERE key = 'initialized'");
  if (!initialized) {
    let initialData = SEED;
    try {
      const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed.people) && Array.isArray(parsed.entries)) initialData = parsed;
      }
    } catch {
      // Fall back to seed data when a legacy backup is malformed.
    }
    await replaceDatabase(initialData.people, initialData.entries);
    await db.runAsync("INSERT OR REPLACE INTO metadata (key, value) VALUES ('initialized', '1')");
  }

  const people = await db.getAllAsync('SELECT id, name, photo FROM people ORDER BY rowid');
  const rows = await db.getAllAsync(
    'SELECT id, person_id, amount, note, date, status, paid_date FROM entries ORDER BY rowid'
  );
  return { people, entries: rows.map(rowToEntry) };
}

const persist = (operation) => {
  operation().catch((error) => console.warn('SQLite write failed', error));
};

export function DataProvider({ children }) {
  const [people, setPeople] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then((data) => {
        setPeople(data.people);
        setEntries(data.entries);
      })
      .catch((error) => console.warn('SQLite initialization failed', error))
      .finally(() => setLoaded(true));
  }, []);

  const addPerson = useCallback((name, photo = null) => {
    const person = { id: uid(), name, photo };
    setPeople((prev) => [...prev, person]);
    persist(async () => writePerson(await getDatabase(), person));
    return person.id;
  }, []);

  const removePerson = useCallback((personId) => {
    setPeople((prev) => prev.filter((person) => person.id !== personId));
    setEntries((prev) => prev.filter((entry) => entry.personId !== personId));
    persist(async () => (await getDatabase()).runAsync('DELETE FROM people WHERE id = ?', personId));
  }, []);

  const updatePerson = useCallback((personId, patch) => {
    setPeople((prev) => {
      const next = prev.map((person) => (person.id === personId ? { ...person, ...patch } : person));
      const updated = next.find((person) => person.id === personId);
      if (updated) persist(async () => writePerson(await getDatabase(), updated));
      return next;
    });
  }, []);

  const addEntry = useCallback((personId, fields) => {
    const entry = { id: uid(), personId, status: 'owed', ...fields };
    setEntries((prev) => [...prev, entry]);
    persist(async () => writeEntry(await getDatabase(), entry));
    return entry.id;
  }, []);

  const updateEntry = useCallback((entryId, patch) => {
    setEntries((prev) => {
      const next = prev.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry));
      const updated = next.find((entry) => entry.id === entryId);
      if (updated) persist(async () => writeEntry(await getDatabase(), updated));
      return next;
    });
  }, []);

  const markPaid = useCallback(
    (entryId) => updateEntry(entryId, { status: 'paid', paidDate: new Date().toISOString().slice(0, 10) }),
    [updateEntry]
  );
  const markOwed = useCallback((entryId) => updateEntry(entryId, { status: 'owed', paidDate: null }), [updateEntry]);
  const editEntry = useCallback((entryId, patch) => updateEntry(entryId, patch), [updateEntry]);

  const deleteEntry = useCallback((entryId) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    persist(async () => (await getDatabase()).runAsync('DELETE FROM entries WHERE id = ?', entryId));
  }, []);

  const balanceFor = useCallback(
    (personId) =>
      entries
        .filter((entry) => entry.personId === personId && entry.status === 'owed')
        .reduce((sum, entry) => sum + entry.amount, 0),
    [entries]
  );

  const entriesFor = useCallback(
    (personId, status) => entries.filter((entry) => entry.personId === personId && entry.status === status),
    [entries]
  );

  const lastActivityFor = useCallback(
    (personId) => {
      const personEntries = entries.filter((entry) => entry.personId === personId);
      if (personEntries.length === 0) return null;
      return personEntries.reduce(
        (latest, entry) => (new Date(entry.date) > new Date(latest) ? entry.date : latest),
        personEntries[0].date
      );
    },
    [entries]
  );

  const exportData = useCallback(
    () => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), people, entries }, null, 2),
    [people, entries]
  );

  const importData = useCallback((json) => {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.entries)) {
      throw new Error('Invalid backup file');
    }
    setPeople(parsed.people);
    setEntries(parsed.entries);
    persist(() => replaceDatabase(parsed.people, parsed.entries));
  }, []);

  const mergeData = useCallback((json) => {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.entries)) {
      throw new Error('Invalid backup file');
    }
    setPeople((prev) => {
      const ids = new Set(prev.map((person) => person.id));
      const next = [...prev, ...parsed.people.filter((person) => !ids.has(person.id))];
      setEntries((currentEntries) => {
        const entryIds = new Set(currentEntries.map((entry) => entry.id));
        const nextEntries = [...currentEntries, ...parsed.entries.filter((entry) => !entryIds.has(entry.id))];
        persist(() => replaceDatabase(next, nextEntries));
        return nextEntries;
      });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      people,
      entries,
      addPerson,
      removePerson,
      updatePerson,
      addEntry,
      markPaid,
      markOwed,
      editEntry,
      deleteEntry,
      balanceFor,
      entriesFor,
      lastActivityFor,
      exportData,
      importData,
      mergeData,
    }),
    [
      loaded,
      people,
      entries,
      addPerson,
      removePerson,
      updatePerson,
      addEntry,
      markPaid,
      markOwed,
      editEntry,
      deleteEntry,
      balanceFor,
      entriesFor,
      lastActivityFor,
      exportData,
      importData,
      mergeData,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
