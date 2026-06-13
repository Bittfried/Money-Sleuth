import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SQLite from 'expo-sqlite';

const DataContext = createContext(null);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const today = () => new Date().toISOString().slice(0, 10);
const DEFAULT_SETTINGS = {
  currency: '\u20B1',
  incomeType: 'allowance',
  incomeAmount: 0,
  incomeFrequency: 'weekly',
  incomeAccountId: null,
  nextIncomeDate: null,
  budgetReserve: 0,
  budgetMode: null,
  budgets: { daily: null, weekly: null, monthly: null, yearly: null },
  budgetSnapshots: {},
  customBudget: { enabled: false, startDate: null, endDate: null },
  piggyBank: { enabled: false, amount: 0, frequency: 'monthly', accountId: null, nextDate: null },
};
const EMPTY_BUDGET_SUMMARY = {
  daily: { configured: null, recurringDue: 0, available: null },
  weekly: { configured: null, recurringDue: 0, available: null },
  monthly: { configured: null, recurringDue: 0, available: null },
  yearly: { configured: null, recurringDue: 0, available: null },
  custom: { configured: null, recurringDue: 0, available: null, startDate: null, endDate: null },
};
let databasePromise;
const getDatabase = () => databasePromise ?? (databasePromise = SQLite.openDatabaseAsync('money-sleuth.db'));

const advanceDate = (iso, frequency) => {
  const date = new Date(`${iso}T12:00:00`);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
};
const nextPiggyDate = (frequency) => {
  if (frequency === 'daily') return today();
  if (frequency === 'weekly') return periodEnd('weekly');
  if (frequency === 'monthly') return periodEnd('monthly');
  return endOfCurrentYear();
};
const advancePiggyDate = (iso, frequency) => {
  const date = new Date(`${iso}T12:00:00`);
  if (frequency === 'daily') date.setDate(date.getDate() + 1);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 2, 0);
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1, 11, 31);
  return date.toISOString().slice(0, 10);
};
const nextPeriodStart = (frequency) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (frequency === 'weekly') {
    const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
    date.setDate(date.getDate() + daysUntilMonday);
  }
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1, 1);
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1, 0, 1);
  return date.toISOString().slice(0, 10);
};
const addTransaction = (state, fields) => ({
  ...state,
  transactions: [...state.transactions, { id: uid(), date: today(), ...fields }],
});
const changeAccount = (accounts, accountId, delta) =>
  accounts.map((account) => (account.id === accountId ? { ...account, balance: account.balance + delta } : account));
const periodEnd = (period) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (period === 'weekly') date.setDate(date.getDate() + (7 - date.getDay()) % 7);
  if (period === 'monthly') date.setMonth(date.getMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
};
const recurringDueThrough = (payments, endDate) => payments
  .filter((payment) => payment.active)
  .reduce((total, payment) => {
    let nextDate = payment.nextDate;
    let due = 0;
    while (nextDate <= endDate) {
      due += payment.amount;
      nextDate = advanceDate(nextDate, payment.frequency);
    }
    return total + due;
  }, 0);
const monthlyRecurringReserve = (payments) => {
  const monthStart = new Date();
  monthStart.setHours(12, 0, 0, 0);
  monthStart.setDate(1);
  const monthEnd = periodEnd('monthly');

  return payments.filter((payment) => payment.active).reduce((total, payment) => {
    if (payment.frequency !== 'yearly') {
      return total + recurringDueThrough([payment], monthEnd);
    }

    const dueMonth = new Date(`${payment.nextDate}T12:00:00`);
    dueMonth.setDate(1);
    const savingStart = new Date(dueMonth);
    savingStart.setMonth(savingStart.getMonth() - 5);
    const isSavingMonth = monthStart >= savingStart && monthStart <= dueMonth;
    return total + (isSavingMonth ? Math.ceil(payment.amount / 6) : 0);
  }, 0);
};
const remainingDaysThisMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
};
const periodKey = (period) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  if (period === 'daily') return `${year}-${month}-${day}`;
  if (period === 'monthly') return `${year}-${month}`;
  if (period === 'yearly') return String(year);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
};
const endOfCurrentYear = () => `${new Date().getFullYear()}-12-31`;
const daysInclusive = (startDate, endDate) => {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
};
const budgetRange = (mode, customBudget) => {
  const startDate = today();
  if (mode === 'weekly') return { startDate, endDate: periodEnd('weekly') };
  if (mode === 'monthly') return { startDate, endDate: periodEnd('monthly') };
  if (mode === 'yearly') return { startDate, endDate: endOfCurrentYear() };
  if (mode === 'custom' && isValidIsoDate(customBudget?.endDate) && customBudget.endDate >= startDate) {
    return { startDate: customBudget.startDate > startDate ? customBudget.startDate : startDate, endDate: customBudget.endDate };
  }
  return null;
};
const monthStartFor = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(1);
  return date;
};
const isValidIsoDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return false;
  const date = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
};
const monthsInclusive = (start, end) =>
  ((end.getFullYear() - start.getFullYear()) * 12) + end.getMonth() - start.getMonth() + 1;
const customRecurringReserve = (payments, startDate, endDate) => {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) return 0;
  const rangeMonthStart = monthStartFor(startDate);
  const rangeMonthEnd = monthStartFor(endDate);

  return payments.filter((payment) => payment.active).reduce((total, payment) => {
    if (payment.frequency !== 'yearly') {
      let nextDate = payment.nextDate;
      let due = 0;
      while (nextDate <= endDate) {
        if (nextDate >= startDate) due += payment.amount;
        nextDate = advanceDate(nextDate, payment.frequency);
      }
      return total + due;
    }

    let dueMonth = monthStartFor(payment.nextDate);
    let reserved = 0;
    while (true) {
      const savingStart = new Date(dueMonth);
      savingStart.setMonth(savingStart.getMonth() - 5);
      if (savingStart > rangeMonthEnd) break;
      const overlapStart = savingStart > rangeMonthStart ? savingStart : rangeMonthStart;
      const overlapEnd = dueMonth < rangeMonthEnd ? dueMonth : rangeMonthEnd;
      if (overlapStart <= overlapEnd) reserved += Math.ceil(payment.amount / 6) * monthsInclusive(overlapStart, overlapEnd);
      dueMonth = new Date(dueMonth);
      dueMonth.setFullYear(dueMonth.getFullYear() + 1);
    }
    return total + reserved;
  }, 0);
};
const piggyReserveInRange = (piggyBank, startDate, endDate) => {
  if (!piggyBank?.enabled || !piggyBank.amount || !piggyBank.nextDate || startDate > endDate) return 0;
  let nextDate = piggyBank.nextDate;
  let reserve = 0;
  while (nextDate <= endDate) {
    if (nextDate >= startDate) reserve += piggyBank.amount;
    nextDate = advancePiggyDate(nextDate, piggyBank.frequency);
  }
  return reserve;
};

function refreshBudgetSnapshots(input) {
  const state = structuredClone(input);
  state.settings.budgets = { ...DEFAULT_SETTINGS.budgets, ...(state.settings.budgets ?? {}) };
  state.settings.budgetSnapshots = { ...(state.settings.budgetSnapshots ?? {}) };
  if (state.settings.budgetMode === undefined) {
    state.settings.budgetMode = ['weekly', 'monthly', 'yearly'].find((period) => state.settings.budgets[period] != null)
      ?? (state.settings.customBudget?.enabled ? 'custom' : null);
  }
  const outstanding = state.entries.filter((item) => item.status === 'owed').reduce((sum, item) => sum + item.amount, 0);
  const funds = state.accounts.reduce((sum, item) => sum + item.balance, 0);
  const budgetable = Math.max(0, funds - outstanding - Math.max(0, Number(state.settings.budgetReserve) || 0));
  const mode = state.settings.budgetMode;
  const range = budgetRange(mode, state.settings.customBudget);
  state.settings.budgetSnapshots = {};
  if (mode && range) {
    const key = mode === 'custom'
      ? `${range.startDate}:${range.endDate}`
      : periodKey(mode);
    const existing = input.settings?.budgetSnapshots?.[mode];
    if (existing?.key === key) {
      state.settings.budgetSnapshots[mode] = existing;
    } else {
      const recurringDue = customRecurringReserve(state.recurringPayments, range.startDate, range.endDate);
      const piggyDue = piggyReserveInRange(state.settings.piggyBank, range.startDate, range.endDate);
      const totalAvailable = Math.max(0, budgetable - recurringDue - piggyDue);
      state.settings.budgetSnapshots[mode] = {
        key,
        startDate: range.startDate,
        endDate: range.endDate,
        recurringDue,
        piggyDue,
        totalAvailable,
        available: Math.floor(totalAvailable / daysInclusive(range.startDate, range.endDate)),
      };
    }
  }
  return state;
}

function processSchedules(input) {
  let state = structuredClone(input);
  const current = today();
  for (const payment of state.recurringPayments.filter((item) => item.active)) {
    while (payment.nextDate <= current) {
      const expense = { id: uid(), amount: payment.amount, note: payment.note, date: payment.nextDate, accountId: payment.accountId, recurringId: payment.id };
      state.expenses.push(expense);
      state.accounts = changeAccount(state.accounts, payment.accountId, -payment.amount);
      state = addTransaction(state, { type: 'recurring', amount: -payment.amount, note: payment.note, accountId: payment.accountId, date: payment.nextDate });
      payment.nextDate = advanceDate(payment.nextDate, payment.frequency);
    }
  }
  const settings = state.settings;
  const piggyBank = { ...DEFAULT_SETTINGS.piggyBank, ...(settings.piggyBank ?? {}) };
  state.settings.piggyBank = piggyBank;
  state.piggyBankBalance = Number(state.piggyBankBalance) || 0;
  if (piggyBank.enabled && piggyBank.amount > 0 && piggyBank.accountId && piggyBank.nextDate) {
    while (piggyBank.nextDate < current) {
      state.accounts = changeAccount(state.accounts, piggyBank.accountId, -piggyBank.amount);
      state.piggyBankBalance += piggyBank.amount;
      state = addTransaction(state, { type: 'piggy_bank', amount: -piggyBank.amount, note: 'Piggybank saving', accountId: piggyBank.accountId, date: piggyBank.nextDate });
      piggyBank.nextDate = advancePiggyDate(piggyBank.nextDate, piggyBank.frequency);
    }
  }
  if (settings.incomeType !== 'freelance' && settings.incomeAmount > 0 && settings.incomeAccountId && settings.nextIncomeDate) {
    while (settings.nextIncomeDate <= current) {
      state.accounts = changeAccount(state.accounts, settings.incomeAccountId, settings.incomeAmount);
      state.incomes.push({ id: uid(), amount: settings.incomeAmount, note: settings.incomeType === 'employed' ? 'Salary' : 'Allowance', date: settings.nextIncomeDate, accountId: settings.incomeAccountId, source: settings.incomeType });
      state = addTransaction(state, { type: 'income', amount: settings.incomeAmount, note: settings.incomeType === 'employed' ? 'Salary' : 'Allowance', accountId: settings.incomeAccountId, date: settings.nextIncomeDate });
      settings.nextIncomeDate = advanceDate(settings.nextIncomeDate, settings.incomeFrequency);
    }
  }
  return state;
}

function clearInitialPeople(input) {
  if (input.settings?.initialPeopleCleared) return input;
  return {
    ...input,
    people: [],
    entries: [],
    settings: { ...input.settings, initialPeopleCleared: true },
  };
}

async function initialize() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, json TEXT NOT NULL);
  `);
  const row = await db.getFirstAsync('SELECT json FROM app_state WHERE id = 1');
  if (row) return refreshBudgetSnapshots(processSchedules(clearInitialPeople(JSON.parse(row.json))));

  const expenses = await db.getAllAsync('SELECT id, amount, note, date FROM expenses ORDER BY rowid').catch(() => []);
  const settingsRows = await db.getAllAsync('SELECT key, value FROM settings').catch(() => []);
  const oldSettings = settingsRows.reduce((result, item) => ({ ...result, [item.key]: item.value }), {});
  const accountId = uid();
  const state = {
    people: [],
    entries: [],
    expenses: expenses.map((item) => ({ ...item, accountId })),
    accounts: [{ id: accountId, type: 'physical', name: 'Cash', balance: Number(oldSettings.capital ?? 0) }],
    incomes: [],
    recurringPayments: [],
    piggyBankBalance: 0,
    transactions: Number(oldSettings.capital ?? 0) > 0 ? [{ id: uid(), type: 'starting', amount: Number(oldSettings.capital), note: 'Starting capital', date: today(), accountId }] : [],
    settings: { ...DEFAULT_SETTINGS, currency: oldSettings.currency ?? '\u20B1', incomeAccountId: accountId, initialPeopleCleared: true },
  };
  await db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(state));
  return refreshBudgetSnapshots(state);
}

export function DataProvider({ children }) {
  const [state, setState] = useState(null);
  const save = useCallback((next) => {
    setState(next);
    getDatabase().then((db) => db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(next))).catch(console.warn);
  }, []);
  const update = useCallback((recipe) => setState((current) => {
    const next = refreshBudgetSnapshots(recipe(structuredClone(current)));
    getDatabase().then((db) => db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(next))).catch(console.warn);
    return next;
  }), []);

  useEffect(() => { initialize().then(save).catch(console.warn); }, [save]);
  useEffect(() => {
    const interval = setInterval(() => {
      setState((current) => {
        if (!current) return current;
        const next = refreshBudgetSnapshots(processSchedules(current));
        if (JSON.stringify(next) === JSON.stringify(current)) return current;
        getDatabase().then((db) => db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(next))).catch(console.warn);
        return next;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const api = useMemo(() => {
    if (!state) return { loaded: false, people: [], entries: [], expenses: [], accounts: [], incomes: [], recurringPayments: [], transactions: [], settings: DEFAULT_SETTINGS, spendable: 0, budgetReserve: 0, budgetableSpendable: 0, piggyBankBalance: 0, budgetSummary: EMPTY_BUDGET_SUMMARY };
    const addPerson = (name, photo = null) => update((s) => ({ ...s, people: [...s.people, { id: uid(), name, photo }] }));
    const updatePerson = (id, patch) => update((s) => ({ ...s, people: s.people.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    const removePerson = (id) => update((s) => ({
      ...s,
      people: s.people.map((item) => item.id === id ? { ...item, archived: true } : item),
    }));
    const addEntry = (personId, fields) => update((s) => ({ ...s, entries: [...s.entries, { id: uid(), personId, status: 'owed', ...fields }] }));
    const editEntry = (id, patch) => update((s) => {
      const old = s.entries.find((item) => item.id === id);
      if (old?.status === 'paid' && old.paidAccountId && patch.amount != null && patch.amount !== old.amount) {
        const difference = patch.amount - old.amount;
        s.accounts = changeAccount(s.accounts, old.paidAccountId, difference);
        s = addTransaction(s, { type: 'adjustment', amount: difference, note: `Adjusted paid credit: ${patch.note ?? old.note}`, accountId: old.paidAccountId, referenceId: id });
      }
      s.entries = s.entries.map((item) => item.id === id ? { ...item, ...patch } : item);
      return s;
    });
    const receiveEntry = (id, accountId) => update((s) => {
      const entry = s.entries.find((item) => item.id === id);
      s.entries = s.entries.map((item) => item.id === id ? { ...item, status: 'paid', paidDate: today(), paidAccountId: accountId } : item);
      s.accounts = changeAccount(s.accounts, accountId, entry.amount);
      return addTransaction(s, { type: 'credit_received', amount: entry.amount, note: entry.note, accountId, referenceId: id });
    });
    const markOwed = (id) => update((s) => {
      const entry = s.entries.find((item) => item.id === id);
      if (entry?.paidAccountId) {
        s.accounts = changeAccount(s.accounts, entry.paidAccountId, -entry.amount);
        s = addTransaction(s, { type: 'reversal', amount: -entry.amount, note: `Moved back to owed: ${entry.note}`, accountId: entry.paidAccountId, referenceId: id });
      }
      s.entries = s.entries.map((item) => item.id === id ? { ...item, status: 'owed', paidDate: null, paidAccountId: null } : item);
      return s;
    });
    const deleteEntry = (id) => update((s) => {
      const entry = s.entries.find((item) => item.id === id);
      if (entry?.status === 'paid' && entry.paidAccountId) {
        s.accounts = changeAccount(s.accounts, entry.paidAccountId, -entry.amount);
        s = addTransaction(s, { type: 'reversal', amount: -entry.amount, note: `Deleted paid credit: ${entry.note}`, accountId: entry.paidAccountId, referenceId: id });
      }
      s.entries = s.entries.filter((item) => item.id !== id);
      return s;
    });
    const addAccount = (fields) => update((s) => {
      const account = { id: uid(), balance: 0, ...fields };
      s.accounts.push(account);
      if (account.balance) s = addTransaction(s, { type: 'starting', amount: account.balance, note: `${account.name} starting balance`, accountId: account.id });
      return s;
    });
    const editAccount = (id, patch) => update((s) => {
      const old = s.accounts.find((item) => item.id === id);
      s.accounts = s.accounts.map((item) => item.id === id ? { ...item, ...patch } : item);
      if (patch.balance != null && patch.balance !== old.balance) s = addTransaction(s, { type: 'adjustment', amount: patch.balance - old.balance, note: `${old.name} balance adjustment`, accountId: id });
      return s;
    });
    const addExpense = (fields) => update((s) => {
      const expense = { id: uid(), ...fields }; s.expenses.push(expense);
      s.accounts = changeAccount(s.accounts, fields.accountId, -fields.amount);
      return addTransaction(s, { type: 'expense', amount: -fields.amount, note: fields.note, accountId: fields.accountId, date: fields.date, referenceId: expense.id });
    });
    const editExpense = (id, fields) => update((s) => {
      const old = s.expenses.find((item) => item.id === id);
      s.accounts = changeAccount(s.accounts, old.accountId, old.amount);
      s.accounts = changeAccount(s.accounts, fields.accountId, -fields.amount);
      s.expenses = s.expenses.map((item) => item.id === id ? { ...item, ...fields } : item);
      return s;
    });
    const deleteExpense = (id) => update((s) => {
      const expense = s.expenses.find((item) => item.id === id);
      s.accounts = changeAccount(s.accounts, expense.accountId, expense.amount);
      s.expenses = s.expenses.filter((item) => item.id !== id);
      return s;
    });
    const addIncome = (fields) => update((s) => {
      const income = { id: uid(), source: 'freelance', ...fields }; s.incomes.push(income);
      s.accounts = changeAccount(s.accounts, fields.accountId, fields.amount);
      return addTransaction(s, { type: 'income', amount: fields.amount, note: fields.note, accountId: fields.accountId, date: fields.date, referenceId: income.id });
    });
    const addRecurringPayment = (fields) => update((s) => ({ ...s, recurringPayments: [...s.recurringPayments, { id: uid(), active: true, ...fields }] }));
    const updateRecurringPayment = (id, patch) => update((s) => ({ ...s, recurringPayments: s.recurringPayments.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    const deleteRecurringPayment = (id) => update((s) => ({ ...s, recurringPayments: s.recurringPayments.filter((item) => item.id !== id) }));
    const updateSettings = (patch) => update((s) => {
      const scheduleChanged = patch.incomeType != null || patch.incomeFrequency != null;
      const previousPiggy = { ...DEFAULT_SETTINGS.piggyBank, ...(s.settings.piggyBank ?? {}) };
      s.settings = { ...s.settings, ...patch };
      if (patch.piggyBank) {
        s.settings.piggyBank = { ...DEFAULT_SETTINGS.piggyBank, ...(s.settings.piggyBank ?? {}) };
        const piggyScheduleChanged = !previousPiggy.enabled || previousPiggy.frequency !== s.settings.piggyBank.frequency;
        if (s.settings.piggyBank.enabled && (!s.settings.piggyBank.nextDate || piggyScheduleChanged)) {
          s.settings.piggyBank.nextDate = nextPiggyDate(s.settings.piggyBank.frequency);
        }
        s.settings.budgetSnapshots = {};
      }
      const scheduleReady = s.settings.incomeAmount > 0 && s.settings.incomeAccountId;
      if ((scheduleChanged || (scheduleReady && !s.settings.nextIncomeDate)) && s.settings.incomeType !== 'freelance') {
        s.settings.nextIncomeDate = nextPeriodStart(s.settings.incomeFrequency);
      }
      return s;
    });
    const balanceFor = (personId) => state.entries.filter((item) => item.personId === personId && item.status === 'owed').reduce((sum, item) => sum + item.amount, 0);
    const entriesFor = (personId, status) => state.entries.filter((item) => item.personId === personId && item.status === status);
    const lastActivityFor = (personId) => state.entries.filter((item) => item.personId === personId).sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date ?? null;
    const totalOutstanding = state.entries.filter((item) => item.status === 'owed').reduce((sum, item) => sum + item.amount, 0);
    const totalFunds = state.accounts.reduce((sum, item) => sum + item.balance, 0);
    const spendable = totalFunds - totalOutstanding;
    const budgetReserve = Math.max(0, Number(state.settings.budgetReserve) || 0);
    const budgetableSpendable = Math.max(0, spendable - budgetReserve);
    const snapshots = state.settings.budgetSnapshots ?? {};
    const budgetSummary = Object.fromEntries(['weekly', 'monthly', 'yearly'].map((period) => [
      period,
      {
        configured: state.settings.budgetMode === period ? true : null,
        recurringDue: snapshots[period]?.recurringDue ?? 0,
        available: state.settings.budgetMode === period ? snapshots[period]?.available ?? 0 : null,
        totalAvailable: snapshots[period]?.totalAvailable ?? 0,
        piggyDue: snapshots[period]?.piggyDue ?? 0,
        startDate: snapshots[period]?.startDate,
        endDate: snapshots[period]?.endDate,
      },
    ]));
    const customBudget = state.settings.customBudget ?? DEFAULT_SETTINGS.customBudget;
    const customRecurringDue = customBudget.enabled
      ? customRecurringReserve(state.recurringPayments, customBudget.startDate, customBudget.endDate)
      : 0;
    const customSnapshot = snapshots.custom;
    budgetSummary.custom = {
      configured: state.settings.budgetMode === 'custom' ? true : null,
      recurringDue: customSnapshot?.recurringDue ?? customRecurringDue,
      available: state.settings.budgetMode === 'custom' ? customSnapshot?.available ?? 0 : null,
      totalAvailable: customSnapshot?.totalAvailable ?? 0,
      piggyDue: customSnapshot?.piggyDue ?? 0,
      startDate: customSnapshot?.startDate ?? customBudget.startDate,
      endDate: customSnapshot?.endDate ?? customBudget.endDate,
    };
    return {
      loaded: true, ...state, piggyBankBalance: Number(state.piggyBankBalance) || 0, people: state.people.filter((item) => !item.archived), totalOutstanding, totalFunds, spendable, budgetReserve, budgetableSpendable, budgetSummary,
      totalExpenses: state.expenses.reduce((sum, item) => sum + item.amount, 0),
      addPerson, updatePerson, removePerson, addEntry, editEntry, receiveEntry, markPaid: receiveEntry, markOwed, deleteEntry,
      addAccount, editAccount, addExpense, editExpense, deleteExpense, addIncome, addRecurringPayment, updateRecurringPayment,
      deleteRecurringPayment, updateSettings, balanceFor, entriesFor, lastActivityFor,
      exportData: () => JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), ...state }, null, 2),
      importData: (json) => save(processSchedules(JSON.parse(json))),
      mergeData: (json) => {
        const incoming = JSON.parse(json);
        update((s) => {
          for (const key of ['people', 'entries', 'expenses', 'accounts', 'incomes', 'recurringPayments', 'transactions']) {
            const ids = new Set(s[key].map((item) => item.id)); s[key].push(...(incoming[key] ?? []).filter((item) => !ids.has(item.id)));
          }
          return s;
        });
      },
    };
  }, [save, state, update]);
  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used within DataProvider');
  return value;
};
