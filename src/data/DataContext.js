import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { localDateISO, parseLocalDate } from '../date';

const DataContext = createContext(null);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const today = () => localDateISO();
const FUND_TYPES = ['physical', 'online', 'bank'];
const SCHEDULE_FREQUENCIES = ['weekly', 'monthly', 'yearly'];
const BUDGET_PERIODS = ['weekly', 'monthly', 'yearly'];
const BUDGET_MODES = [...BUDGET_PERIODS, 'custom'];
const INCOME_TYPES = ['allowance', 'employed', 'freelance'];
const THEME_MODES = ['light', 'night', 'dark'];
const MIN_SCHEDULE_DATE = '2000-01-01';
const MAX_SCHEDULE_DATE = '2200-12-31';
const MAX_ROLLOVER_DAYS = 3660;
const MAX_SCHEDULE_OCCURRENCES = 5000;
const DEFAULT_RECORD_LIMIT = 50000;
const RECORD_LIMITS = { accounts: 500, people: 10000, recurringPayments: 1000 };
const EXPORT_GROUPS = {
  funds: ['accounts'],
  credits: ['people', 'entries', 'accounts'],
  expenses: ['expenses', 'accounts'],
  income: ['incomes', 'accounts'],
  recurring: ['recurringPayments', 'accounts'],
  piggyBank: ['piggyBankBalance', 'piggyBankTransactions', 'settings'],
  history: ['transactions'],
  settings: ['settings'],
};
const RESTORE_GROUPS = {
  funds: ['accounts'],
  credits: ['people', 'entries'],
  expenses: ['expenses'],
  income: ['incomes'],
  recurring: ['recurringPayments'],
  piggyBank: ['piggyBankBalance', 'piggyBankTransactions'],
  history: ['transactions'],
  settings: ['settings'],
};
const DEFAULT_SETTINGS = {
  currency: '\u20B1',
  incomeType: 'allowance',
  incomeAmount: 0,
  incomeFrequency: 'weekly',
  incomeAccountId: null,
  nextIncomeDate: null,
  budgetMode: null,
  budgets: { daily: null, weekly: null, monthly: null, yearly: null },
  budgetSnapshots: {},
  customBudget: { enabled: false, startDate: null, endDate: null },
  piggyBank: { autoEnabled: false, accountId: null },
  autoExport: { enabled: false, frequency: 'monthly', wipeAfterExport: false, nextDate: null, lastUri: null },
  creditSourcesMigrated: false,
};
const EMPTY_BUDGET_SUMMARY = {
  daily: { configured: null, recurringDue: 0, available: null },
  weekly: { configured: null, recurringDue: 0, available: null },
  monthly: { configured: null, recurringDue: 0, available: null },
  yearly: { configured: null, recurringDue: 0, available: null },
  custom: { configured: null, recurringDue: 0, available: null, startDate: null, endDate: null },
};
let databasePromise;
let writePromise = Promise.resolve();
const getDatabase = () => databasePromise ?? (databasePromise = SQLite.openDatabaseAsync('money-sleuth.db'));
const persistState = (state) => {
  writePromise = writePromise
    .then(async () => {
      const db = await getDatabase();
      await db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(state));
    })
    .catch(console.warn);
  return writePromise;
};

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const shiftMonths = (iso, amount, anchorDay) => {
  const date = parseLocalDate(iso);
  const intendedDay = anchorDay ?? date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  date.setDate(Math.min(intendedDay, daysInMonth(date.getFullYear(), date.getMonth())));
  return localDateISO(date);
};
const advanceDate = (iso, frequency, anchorDay) => {
  if (frequency === 'monthly') return shiftMonths(iso, 1, anchorDay);
  const date = parseLocalDate(iso);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'yearly') {
    const intendedDay = anchorDay ?? date.getDate();
    const month = date.getMonth();
    date.setDate(1);
    date.setFullYear(date.getFullYear() + 1);
    date.setMonth(month);
    date.setDate(Math.min(intendedDay, daysInMonth(date.getFullYear(), month)));
  }
  return localDateISO(date);
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
  return localDateISO(date);
};
const nextFutureDate = (iso, frequency, anchorDay) => {
  let nextDate = advanceNearDate(iso, frequency, today(), anchorDay);
  while (nextDate <= today()) nextDate = advanceDate(nextDate, frequency, anchorDay);
  return nextDate;
};
const addTransaction = (state, fields) => ({
  ...state,
  transactions: [...state.transactions, { id: uid(), date: today(), ...fields }],
});
const hasAccount = (state, accountId) => state.accounts.some((account) => account.id === accountId);
const positiveAmount = (value) => {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
const finiteAmount = (value, fallback = 0) => {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) ? amount : fallback;
};
const nonNegativeAmount = (value, fallback = 0) => Math.max(0, finiteAmount(value, fallback));
const changeAccount = (accounts, accountId, delta) =>
  accounts.map((account) => (account.id === accountId ? { ...account, balance: account.balance + delta } : account));
const invalidateBudget = (state) => {
  state.settings.budgetSnapshots = {};
  return state;
};
const recordAccountMovement = (state, accountId, amount, fields) => {
  state.accounts = changeAccount(state.accounts, accountId, amount);
  return addTransaction(state, { ...fields, amount, accountId });
};
const uniqueById = (items, limit = DEFAULT_RECORD_LIMIT) => {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.size >= limit) return false;
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};
const addDays = (iso, amount) => {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + amount);
  return localDateISO(date);
};
const periodEnd = (period) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (period === 'weekly') date.setDate(date.getDate() + (7 - date.getDay()) % 7);
  if (period === 'monthly') date.setMonth(date.getMonth() + 1, 0);
  return localDateISO(date);
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
  return localDateISO(monday);
};
const endOfCurrentYear = () => `${new Date().getFullYear()}-12-31`;
const daysInclusive = (startDate, endDate) => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
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
  const date = parseLocalDate(iso);
  date.setDate(1);
  return date;
};
const isValidIsoDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return false;
  const date = parseLocalDate(iso);
  return !Number.isNaN(date.getTime()) && localDateISO(date) === iso;
};
const isSafeScheduleDate = (iso) => isValidIsoDate(iso) && iso >= MIN_SCHEDULE_DATE && iso <= MAX_SCHEDULE_DATE;
const monthsInclusive = (start, end) =>
  ((end.getFullYear() - start.getFullYear()) * 12) + end.getMonth() - start.getMonth() + 1;
const advanceNearDate = (iso, frequency, targetIso, anchorDay) => {
  if (iso >= targetIso) return iso;
  if (frequency === 'weekly') {
    const days = Math.floor((parseLocalDate(targetIso) - parseLocalDate(iso)) / 86400000);
    return addDays(iso, Math.max(0, Math.ceil(days / 7) - 1) * 7);
  }
  if (frequency === 'monthly') {
    const date = parseLocalDate(iso);
    const target = parseLocalDate(targetIso);
    const months = ((target.getFullYear() - date.getFullYear()) * 12) + target.getMonth() - date.getMonth();
    return months > 1 ? shiftMonths(iso, months - 1, anchorDay) : iso;
  }
  return iso;
};
const customRecurringReserve = (payments, startDate, endDate) => {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) return 0;
  const rangeMonthStart = monthStartFor(startDate);
  const rangeMonthEnd = monthStartFor(endDate);
  let remainingOccurrences = MAX_SCHEDULE_OCCURRENCES;

  return payments.filter((payment) =>
    payment.active
    && positiveAmount(payment.amount)
    && isSafeScheduleDate(payment.nextDate)
    && SCHEDULE_FREQUENCIES.includes(payment.frequency)
  ).reduce((total, payment) => {
    if (payment.frequency !== 'yearly') {
      let nextDate = advanceNearDate(payment.nextDate, payment.frequency, startDate, payment.anchorDay);
      let due = 0;
      while (nextDate <= endDate && remainingOccurrences > 0) {
        if (nextDate >= startDate) due += payment.amount;
        nextDate = advanceDate(nextDate, payment.frequency, payment.anchorDay);
        remainingOccurrences -= 1;
      }
      return total + due;
    }

    let dueMonth = monthStartFor(payment.nextDate);
    let reserved = 0;
    while (remainingOccurrences > 0) {
      const savingStart = new Date(dueMonth);
      savingStart.setMonth(savingStart.getMonth() - 5);
      if (savingStart > rangeMonthEnd) break;
      const overlapStart = savingStart > rangeMonthStart ? savingStart : rangeMonthStart;
      const overlapEnd = dueMonth < rangeMonthEnd ? dueMonth : rangeMonthEnd;
      if (overlapStart <= overlapEnd) reserved += Math.ceil(payment.amount / 6) * monthsInclusive(overlapStart, overlapEnd);
      dueMonth = new Date(dueMonth);
      dueMonth.setFullYear(dueMonth.getFullYear() + 1);
      remainingOccurrences -= 1;
    }
    return total + reserved;
  }, 0);
};
function refreshBudgetSnapshots(input) {
  const state = structuredClone(input);
  state.settings.budgets = { ...DEFAULT_SETTINGS.budgets, ...(state.settings.budgets ?? {}) };
  state.settings.budgetSnapshots = { ...(state.settings.budgetSnapshots ?? {}) };
  if (state.settings.budgetMode === undefined) {
    state.settings.budgetMode = BUDGET_PERIODS.find((period) => state.settings.budgets[period] != null)
      ?? (state.settings.customBudget?.enabled ? 'custom' : null);
  }
  const funds = state.accounts.reduce((sum, item) => sum + item.balance, 0);
  const unpaidDebts = state.entries.filter((item) => item.direction === 'payable' && item.status === 'owed').reduce((sum, item) => sum + item.amount, 0);
  const budgetable = Math.max(0, funds - unpaidDebts);
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
      const totalAvailable = Math.max(0, budgetable - recurringDue);
      state.settings.budgetSnapshots[mode] = {
        key,
        startDate: range.startDate,
        endDate: range.endDate,
        recurringDue,
        piggyDue: 0,
        totalAvailable,
        available: Math.floor(totalAvailable / daysInclusive(range.startDate, range.endDate)),
        lastProcessedDate: range.startDate,
      };
    }
  }
  return state;
}

function processDailyBudgetRollovers(input) {
  let state = structuredClone(input);
  const mode = state.settings.budgetMode;
  const snapshot = state.settings.budgetSnapshots?.[mode];
  if (!mode || !snapshot?.lastProcessedDate) return state;
  state.piggyBankBalance = Number(state.piggyBankBalance) || 0;
  state.piggyBankTransactions = state.piggyBankTransactions ?? [];
  const piggyBank = { ...DEFAULT_SETTINGS.piggyBank, ...(state.settings.piggyBank ?? {}) };
  const spendingByDate = state.expenses.filter((item) => !item.recurringId).reduce((result, item) => {
    result[item.date] = (result[item.date] ?? 0) + item.amount;
    return result;
  }, {});
  let date = snapshot.lastProcessedDate;
  let processedDays = 0;

  while (date < today() && date <= snapshot.endDate && processedDays < MAX_ROLLOVER_DAYS) {
    const spent = spendingByDate[date] ?? 0;
    const unused = Math.max(0, snapshot.available - spent);
    let consumed = spent;
    if (piggyBank.autoEnabled && hasAccount(state, piggyBank.accountId) && unused > 0) {
      state.accounts = changeAccount(state.accounts, piggyBank.accountId, -unused);
      state.piggyBankBalance += unused;
      state.piggyBankTransactions.push({ id: uid(), type: 'automatic', amount: unused, date, note: 'Unused daily budget' });
      state = addTransaction(state, { type: 'piggy_bank', amount: -unused, note: 'Unused daily budget to Piggybank', accountId: piggyBank.accountId, date });
      consumed += unused;
    }
    snapshot.totalAvailable = Math.max(0, snapshot.totalAvailable - consumed);
    date = addDays(date, 1);
    processedDays += 1;
    snapshot.lastProcessedDate = date;
    snapshot.available = date <= snapshot.endDate
      ? Math.floor(snapshot.totalAvailable / daysInclusive(date, snapshot.endDate))
      : 0;
  }
  return state;
}

function processSchedules(input) {
  let state = structuredClone(input);
  const current = today();
  let remainingOccurrences = MAX_SCHEDULE_OCCURRENCES;
  for (const expense of state.expenses.filter((item) => item.paid === false && item.recurringId && hasAccount(state, item.accountId))) {
    expense.paid = true;
    state.accounts = changeAccount(state.accounts, expense.accountId, -expense.amount);
    state = addTransaction(state, { type: 'expense', amount: -expense.amount, note: expense.note, accountId: expense.accountId, date: expense.date, referenceId: expense.id });
  }
  for (const payment of state.recurringPayments.filter((item) => item.active)) {
    const amount = positiveAmount(payment.amount);
    if (!hasAccount(state, payment.accountId) || !amount || !isSafeScheduleDate(payment.nextDate) || !SCHEDULE_FREQUENCIES.includes(payment.frequency)) continue;
    while (payment.nextDate <= current && remainingOccurrences > 0) {
      const expense = { id: uid(), amount, note: payment.note, date: payment.nextDate, accountId: payment.accountId, recurringId: payment.id, paid: true };
      state.expenses.push(expense);
      state.accounts = changeAccount(state.accounts, payment.accountId, -amount);
      state = addTransaction(state, { type: 'expense', amount: -amount, note: payment.note, accountId: payment.accountId, date: payment.nextDate, referenceId: expense.id });
      payment.nextDate = advanceDate(payment.nextDate, payment.frequency, payment.anchorDay);
      remainingOccurrences -= 1;
    }
    if (payment.nextDate <= current) payment.nextDate = nextFutureDate(payment.nextDate, payment.frequency, payment.anchorDay);
  }
  const settings = state.settings;
  state.settings.piggyBank = { ...DEFAULT_SETTINGS.piggyBank, ...(settings.piggyBank ?? {}) };
  state.piggyBankBalance = Number(state.piggyBankBalance) || 0;
  state.piggyBankTransactions = state.piggyBankTransactions ?? [];
  const scheduledIncome = positiveAmount(settings.incomeAmount);
  if (settings.incomeType !== 'freelance' && scheduledIncome && hasAccount(state, settings.incomeAccountId) && isSafeScheduleDate(settings.nextIncomeDate) && SCHEDULE_FREQUENCIES.includes(settings.incomeFrequency)) {
    let incomeOccurrences = MAX_SCHEDULE_OCCURRENCES;
    while (settings.nextIncomeDate <= current && incomeOccurrences > 0) {
      state.accounts = changeAccount(state.accounts, settings.incomeAccountId, scheduledIncome);
      state.incomes.push({ id: uid(), amount: scheduledIncome, note: settings.incomeType === 'employed' ? 'Salary' : 'Allowance', date: settings.nextIncomeDate, accountId: settings.incomeAccountId, source: settings.incomeType });
      state = addTransaction(state, { type: 'income', amount: scheduledIncome, note: settings.incomeType === 'employed' ? 'Salary' : 'Allowance', accountId: settings.incomeAccountId, date: settings.nextIncomeDate });
      settings.nextIncomeDate = advanceDate(settings.nextIncomeDate, settings.incomeFrequency);
      incomeOccurrences -= 1;
    }
    if (settings.nextIncomeDate <= current) settings.nextIncomeDate = nextFutureDate(settings.nextIncomeDate, settings.incomeFrequency);
  }
  return state;
}

const hasScheduledWork = (state) => {
  const current = today();
  const snapshot = state.settings.budgetSnapshots?.[state.settings.budgetMode];
  if (snapshot?.lastProcessedDate < current) return true;
  if (state.expenses.some((item) => item.paid === false && item.recurringId && hasAccount(state, item.accountId))) return true;
  if (state.recurringPayments.some((item) => item.active && item.nextDate <= current)) return true;
  const settings = state.settings;
  return settings.incomeType !== 'freelance'
    && positiveAmount(settings.incomeAmount)
    && settings.nextIncomeDate <= current;
};

function clearInitialPeople(input) {
  if (input.settings?.initialPeopleCleared) return input;
  return {
    ...input,
    people: [],
    entries: [],
    settings: { ...input.settings, initialPeopleCleared: true },
  };
}

function migrateCreditSources(input) {
  const state = structuredClone(input);
  if (state.settings.creditSourcesMigrated && state.entries.every((entry) => entry.direction === 'payable' || hasAccount(state, entry.sourceAccountId))) return state;
  const fallbackAccountId = state.accounts[0]?.id;
  let migrated = false;
  if (fallbackAccountId) {
    for (const entry of state.entries) {
      if (entry.direction === 'payable' || entry.sourceAccountId) continue;
      migrated = true;
      entry.sourceAccountId = fallbackAccountId;
      state.accounts = changeAccount(state.accounts, fallbackAccountId, -entry.amount);
      state.transactions.push({
        id: uid(),
        type: 'credit_lent',
        amount: -entry.amount,
        note: `Credit source migration: ${entry.note}`,
        accountId: fallbackAccountId,
        referenceId: entry.id,
        date: entry.date,
      });
    }
  }
  state.settings.creditSourcesMigrated = Boolean(fallbackAccountId);
  if (migrated) invalidateBudget(state);
  return state;
}

const STATE_ARRAY_KEYS = ['people', 'entries', 'expenses', 'accounts', 'incomes', 'recurringPayments', 'transactions', 'piggyBankTransactions'];
function normalizeBudgetSnapshots(snapshots) {
  if (!snapshots || typeof snapshots !== 'object') return {};
  return BUDGET_MODES.reduce((result, mode) => {
    const item = snapshots[mode];
    if (!item || typeof item.key !== 'string' || !isSafeScheduleDate(item.startDate) || !isSafeScheduleDate(item.endDate) || !isSafeScheduleDate(item.lastProcessedDate)) return result;
    if (item.startDate > item.endDate || item.lastProcessedDate < item.startDate || item.lastProcessedDate > addDays(item.endDate, 1)) return result;
    result[mode] = {
      ...item,
      recurringDue: nonNegativeAmount(item.recurringDue),
      piggyDue: nonNegativeAmount(item.piggyDue),
      totalAvailable: nonNegativeAmount(item.totalAvailable),
      available: nonNegativeAmount(item.available),
    };
    return result;
  }, {});
}
function normalizeImportedState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('This is not a valid Money Sleuth backup.');
  const state = { ...input };
  for (const key of STATE_ARRAY_KEYS) state[key] = uniqueById(Array.isArray(input[key]) ? input[key] : [], RECORD_LIMITS[key] ?? DEFAULT_RECORD_LIMIT);
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...(input.settings && typeof input.settings === 'object' ? input.settings : {}),
    budgets: { ...DEFAULT_SETTINGS.budgets, ...(input.settings?.budgets ?? {}) },
    customBudget: { ...DEFAULT_SETTINGS.customBudget, ...(input.settings?.customBudget ?? {}) },
    piggyBank: { ...DEFAULT_SETTINGS.piggyBank, ...(input.settings?.piggyBank ?? {}) },
    autoExport: { ...DEFAULT_SETTINGS.autoExport, ...(input.settings?.autoExport ?? {}) },
  };
  state.settings.budgetSnapshots = normalizeBudgetSnapshots(state.settings.budgetSnapshots);
  if (!SCHEDULE_FREQUENCIES.includes(state.settings.incomeFrequency)) state.settings.incomeFrequency = DEFAULT_SETTINGS.incomeFrequency;
  if (!INCOME_TYPES.includes(state.settings.incomeType)) state.settings.incomeType = DEFAULT_SETTINGS.incomeType;
  if (state.settings.budgetMode != null && !BUDGET_MODES.includes(state.settings.budgetMode)) state.settings.budgetMode = null;
  if (!THEME_MODES.includes(state.settings.themeMode)) state.settings.themeMode = 'light';
  state.settings.currency = String(state.settings.currency ?? DEFAULT_SETTINGS.currency).slice(0, 8) || DEFAULT_SETTINGS.currency;
  state.settings.incomeAmount = nonNegativeAmount(state.settings.incomeAmount);
  if (!isSafeScheduleDate(state.settings.nextIncomeDate)) state.settings.nextIncomeDate = null;
  state.settings.piggyBank.autoEnabled = Boolean(state.settings.piggyBank.autoEnabled);
  state.settings.autoExport.enabled = Boolean(state.settings.autoExport.enabled);
  state.settings.autoExport.wipeAfterExport = Boolean(state.settings.autoExport.wipeAfterExport);
  if (!SCHEDULE_FREQUENCIES.includes(state.settings.autoExport.frequency)) state.settings.autoExport.frequency = DEFAULT_SETTINGS.autoExport.frequency;
  if (!isSafeScheduleDate(state.settings.autoExport.nextDate)) state.settings.autoExport.nextDate = null;
  if (typeof state.settings.autoExport.lastUri !== 'string') state.settings.autoExport.lastUri = null;
  state.settings.customBudget.enabled = Boolean(state.settings.customBudget.enabled);
  if (!isSafeScheduleDate(state.settings.customBudget.startDate)) state.settings.customBudget.startDate = null;
  if (!isSafeScheduleDate(state.settings.customBudget.endDate)) state.settings.customBudget.endDate = null;
  if (state.settings.budgetMode === 'custom' && (!state.settings.customBudget.startDate || !state.settings.customBudget.endDate || state.settings.customBudget.startDate > state.settings.customBudget.endDate)) state.settings.budgetMode = null;
  state.piggyBankBalance = Math.max(0, finiteAmount(input.piggyBankBalance));
  state.accounts = state.accounts
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({ ...item, type: FUND_TYPES.includes(item.type) ? item.type : 'physical', balance: finiteAmount(item.balance), name: String(item.name ?? 'Fund').trim() || 'Fund' }));
  const accountIds = new Set(state.accounts.map((item) => item.id));
  if (!accountIds.has(state.settings.incomeAccountId)) state.settings.incomeAccountId = null;
  if (!accountIds.has(state.settings.piggyBank.accountId)) state.settings.piggyBank.accountId = null;
  state.people = state.people
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({ ...item, name: String(item.name ?? 'Person').trim() || 'Person', photo: typeof item.photo === 'string' ? item.photo : null, archived: Boolean(item.archived) }));
  const personIds = new Set(state.people.map((item) => item.id));
  state.entries = state.entries
    .filter((item) => item && typeof item.id === 'string' && personIds.has(item.personId) && positiveAmount(item.amount) && isValidIsoDate(item.date))
    .map((item) => {
      const paid = item.status === 'paid' && accountIds.has(item.paidAccountId);
      const direction = item.direction === 'payable' ? 'payable' : 'receivable';
      return { ...item, direction, note: String(item.note ?? 'Entry'), amount: positiveAmount(item.amount), sourceAccountId: direction === 'receivable' && accountIds.has(item.sourceAccountId) ? item.sourceAccountId : null, status: paid ? 'paid' : 'owed', paidAccountId: paid ? item.paidAccountId : null, paidDate: paid && isValidIsoDate(item.paidDate) ? item.paidDate : null };
    });
  state.expenses = state.expenses
    .filter((item) => item && typeof item.id === 'string' && accountIds.has(item.accountId) && positiveAmount(item.amount) && isValidIsoDate(item.date))
    .map((item) => ({ ...item, note: String(item.note ?? 'Expense'), amount: positiveAmount(item.amount), paid: item.paid !== false }));
  state.incomes = state.incomes
    .filter((item) => item && typeof item.id === 'string' && accountIds.has(item.accountId) && positiveAmount(item.amount) && isValidIsoDate(item.date))
    .map((item) => ({ ...item, note: String(item.note ?? 'Income'), amount: positiveAmount(item.amount) }));
  state.recurringPayments = state.recurringPayments
    .filter((item) => item && typeof item.id === 'string' && accountIds.has(item.accountId) && positiveAmount(item.amount) && isSafeScheduleDate(item.nextDate) && SCHEDULE_FREQUENCIES.includes(item.frequency))
    .map((item) => ({
      ...item,
      note: String(item.note ?? 'Recurring payment'),
      amount: positiveAmount(item.amount),
      anchorDay: Math.min(31, Math.max(1, finiteAmount(item.anchorDay, parseLocalDate(item.nextDate).getDate()))),
    }));
  state.transactions = state.transactions
    .filter((item) => item && typeof item.id === 'string' && Number.isFinite(Number(item.amount)) && isValidIsoDate(item.date))
    .map((item) => ({ ...item, type: String(item.type ?? 'adjustment'), note: String(item.note ?? 'Money movement'), amount: finiteAmount(item.amount) }));
  state.piggyBankTransactions = state.piggyBankTransactions
    .filter((item) => item && typeof item.id === 'string' && Number.isFinite(Number(item.amount)) && isValidIsoDate(item.date))
    .map((item) => ({ ...item, type: String(item.type ?? 'deposit'), note: String(item.note ?? 'Piggybank movement'), amount: finiteAmount(item.amount) }));
  return state;
}

async function initialize() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, json TEXT NOT NULL);
  `);
  const row = await db.getFirstAsync('SELECT json FROM app_state WHERE id = 1');
  if (row) return refreshBudgetSnapshots(processDailyBudgetRollovers(processSchedules(migrateCreditSources(clearInitialPeople(normalizeImportedState(JSON.parse(row.json)))))));

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
    piggyBankTransactions: [],
    transactions: Number(oldSettings.capital ?? 0) > 0 ? [{ id: uid(), type: 'starting', amount: Number(oldSettings.capital), note: 'Starting capital', date: today(), accountId }] : [],
    settings: { ...DEFAULT_SETTINGS, currency: oldSettings.currency ?? '\u20B1', incomeAccountId: accountId, initialPeopleCleared: true, creditSourcesMigrated: true },
  };
  await db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(state));
  return refreshBudgetSnapshots(processDailyBudgetRollovers(state));
}

export function DataProvider({ children }) {
  const [state, setState] = useState(null);
  const save = useCallback((next) => {
    setState(next);
    persistState(next);
  }, []);
  const update = useCallback((recipe) => setState((current) => {
    if (!current) return current;
    const next = refreshBudgetSnapshots(processDailyBudgetRollovers(recipe(structuredClone(current))));
    persistState(next);
    return next;
  }), []);

  useEffect(() => { initialize().then(save).catch(console.warn); }, [save]);
  useEffect(() => {
    const interval = setInterval(() => {
      setState((current) => {
        if (!current) return current;
        if (!hasScheduledWork(current)) return current;
        const next = refreshBudgetSnapshots(processDailyBudgetRollovers(processSchedules(current)));
        persistState(next);
        return next;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const api = useMemo(() => {
    if (!state) return { loaded: false, people: [], entries: [], expenses: [], accounts: [], incomes: [], recurringPayments: [], transactions: [], piggyBankTransactions: [], settings: DEFAULT_SETTINGS, totalOutstanding: 0, totalPayable: 0, totalFunds: 0, totalExpenses: 0, spendable: 0, budgetableSpendable: 0, piggyBankBalance: 0, budgetSummary: EMPTY_BUDGET_SUMMARY };
    const addPerson = (name, photo = null) => update((s) => {
      const cleanName = String(name ?? '').trim();
      return cleanName ? { ...s, people: [...s.people, { id: uid(), name: cleanName, photo }] } : s;
    });
    const updatePerson = (id, patch) => update((s) => ({ ...s, people: s.people.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    const removePerson = (id) => update((s) => {
      if (!s.people.some((item) => item.id === id)) return s;
      s.people = s.people.filter((item) => item.id !== id);
      s.entries = s.entries.filter((item) => item.personId !== id);
      return invalidateBudget(s);
    });
    const addEntry = (personId, fields) => update((s) => {
      const amount = positiveAmount(fields?.amount);
      const direction = fields?.direction === 'payable' ? 'payable' : 'receivable';
      if (!amount || !isValidIsoDate(fields?.date) || !s.people.some((item) => item.id === personId) || (direction === 'receivable' && !hasAccount(s, fields?.sourceAccountId))) return s;
      const entry = { id: uid(), personId, ...fields, direction, amount, status: 'owed', sourceAccountId: direction === 'receivable' ? fields.sourceAccountId : null };
      s.entries.push(entry);
      if (direction === 'payable') {
        return invalidateBudget(s);
      }
      return recordAccountMovement(s, entry.sourceAccountId, -amount, { type: 'credit_lent', note: entry.note, date: entry.date, referenceId: entry.id });
    });
    const editEntry = (id, patch) => update((s) => {
      const old = s.entries.find((item) => item.id === id);
      if (!old) return s;
      const amount = patch.amount == null ? old.amount : positiveAmount(patch.amount);
      if (!amount || !isValidIsoDate(patch.date ?? old.date)) return s;
      const next = { ...old, ...patch, amount, direction: old.direction, status: old.status, paidAccountId: old.paidAccountId, paidDate: old.paidDate };
      if (old.direction === 'receivable' && !hasAccount(s, next.sourceAccountId)) return s;
      const moneyChanged = old.amount !== next.amount || old.sourceAccountId !== next.sourceAccountId;
      if (moneyChanged && old.direction === 'receivable') {
        s.accounts = changeAccount(s.accounts, old.sourceAccountId, old.amount);
        s.accounts = changeAccount(s.accounts, next.sourceAccountId, -next.amount);
        s = addTransaction(s, { type: 'adjustment', amount: old.amount, note: `Reversed prior credit: ${old.note}`, accountId: old.sourceAccountId, referenceId: id });
        s = addTransaction(s, { type: 'credit_lent', amount: -next.amount, note: next.note, accountId: next.sourceAccountId, date: next.date, referenceId: id });
      }
      if (moneyChanged && old.status === 'paid' && old.paidAccountId && old.amount !== next.amount) {
        const adjustment = old.direction === 'payable' ? old.amount - next.amount : next.amount - old.amount;
        s.accounts = changeAccount(s.accounts, old.paidAccountId, adjustment);
        s = addTransaction(s, { type: 'adjustment', amount: adjustment, note: `Adjusted paid credit: ${next.note}`, accountId: old.paidAccountId, referenceId: id });
      }
      if (old.direction === 'payable' && old.status === 'owed' && moneyChanged) invalidateBudget(s);
      s.entries = s.entries.map((item) => item.id === id ? next : item);
      return s;
    });
    const receiveEntry = (id, accountId) => update((s) => {
      const entry = s.entries.find((item) => item.id === id);
      if (!entry || entry.status !== 'owed' || !hasAccount(s, accountId)) return s;
      s.entries = s.entries.map((item) => item.id === id ? { ...item, status: 'paid', paidDate: today(), paidAccountId: accountId } : item);
      const amount = entry.direction === 'payable' ? -entry.amount : entry.amount;
      return recordAccountMovement(s, accountId, amount, { type: entry.direction === 'payable' ? 'debt_paid' : 'credit_received', note: entry.note, referenceId: id });
    });
    const markOwed = (id) => update((s) => {
      const entry = s.entries.find((item) => item.id === id);
      if (!entry || entry.status !== 'paid') return s;
      if (entry?.paidAccountId) {
        const amount = entry.direction === 'payable' ? entry.amount : -entry.amount;
        s = recordAccountMovement(s, entry.paidAccountId, amount, { type: 'reversal', note: `Moved back to ${entry.direction === 'payable' ? 'unpaid' : 'owed'}: ${entry.note}`, referenceId: id });
      }
      s.entries = s.entries.map((item) => item.id === id ? { ...item, status: 'owed', paidDate: null, paidAccountId: null } : item);
      return s;
    });
    const deleteEntry = (id) => update((s) => {
      const entry = s.entries.find((item) => item.id === id);
      if (!entry) return s;
      if (entry.direction === 'receivable' && entry.sourceAccountId) {
        s.accounts = changeAccount(s.accounts, entry.sourceAccountId, entry.amount);
        s = addTransaction(s, { type: 'reversal', amount: entry.amount, note: `Deleted credit: ${entry.note}`, accountId: entry.sourceAccountId, referenceId: id });
      }
      if (entry?.status === 'paid' && entry.paidAccountId) {
        const amount = entry.direction === 'payable' ? entry.amount : -entry.amount;
        s.accounts = changeAccount(s.accounts, entry.paidAccountId, amount);
        s = addTransaction(s, { type: 'reversal', amount, note: `Deleted paid credit: ${entry.note}`, accountId: entry.paidAccountId, referenceId: id });
      }
      if (entry.direction === 'payable' && entry.status === 'owed') invalidateBudget(s);
      s.entries = s.entries.filter((item) => item.id !== id);
      return s;
    });
    const addAccount = (fields) => update((s) => {
      const account = { id: uid(), ...fields, type: FUND_TYPES.includes(fields?.type) ? fields.type : 'physical', name: String(fields?.name ?? 'Fund').trim() || 'Fund', balance: finiteAmount(fields?.balance) };
      s.accounts.push(account);
      if (account.balance) s = addTransaction(s, { type: 'starting', amount: account.balance, note: `${account.name} starting balance`, accountId: account.id });
      return s;
    });
    const editAccount = (id, patch) => update((s) => {
      const old = s.accounts.find((item) => item.id === id);
      if (!old) return s;
      patch = { ...patch };
      if (patch.balance != null) patch.balance = finiteAmount(patch.balance, old.balance);
      if (patch.name != null) patch.name = String(patch.name).trim() || old.name;
      if (patch.type != null && !FUND_TYPES.includes(patch.type)) patch.type = old.type;
      s.accounts = s.accounts.map((item) => item.id === id ? { ...item, ...patch } : item);
      if (patch.balance != null && patch.balance !== old.balance) s = addTransaction(s, { type: 'adjustment', amount: patch.balance - old.balance, note: `${old.name} balance adjustment`, accountId: id });
      return s;
    });
    const addExpense = (fields) => update((s) => {
      const amount = positiveAmount(fields?.amount);
      if (!amount || !isValidIsoDate(fields?.date) || !hasAccount(s, fields?.accountId)) return s;
      const expense = { id: uid(), ...fields, amount, paid: true }; s.expenses.push(expense);
      s.accounts = changeAccount(s.accounts, fields.accountId, -amount);
      return addTransaction(s, { type: 'expense', amount: -amount, note: fields.note, accountId: fields.accountId, date: fields.date, referenceId: expense.id });
    });
    const editExpense = (id, fields) => update((s) => {
      const old = s.expenses.find((item) => item.id === id);
      const amount = positiveAmount(fields?.amount);
      if (!old || !amount || !isValidIsoDate(fields?.date) || !hasAccount(s, fields?.accountId)) return s;
      s = recordAccountMovement(s, old.accountId, old.amount, { type: 'reversal', note: `Reversed expense: ${old.note}`, referenceId: id });
      s = recordAccountMovement(s, fields.accountId, -amount, { type: 'expense', note: fields.note, date: fields.date, referenceId: id });
      s.expenses = s.expenses.map((item) => item.id === id ? { ...item, ...fields, amount, paid: true } : item);
      if (old.recurringId) invalidateBudget(s);
      return s;
    });
    const deleteExpense = (id) => update((s) => {
      const expense = s.expenses.find((item) => item.id === id);
      if (!expense) return s;
      s = recordAccountMovement(s, expense.accountId, expense.amount, { type: 'reversal', note: `Deleted expense: ${expense.note}`, referenceId: id });
      s.expenses = s.expenses.filter((item) => item.id !== id);
      if (expense.recurringId) invalidateBudget(s);
      return s;
    });
    const addIncome = (fields) => update((s) => {
      const amount = positiveAmount(fields?.amount);
      if (!amount || !isValidIsoDate(fields?.date) || !hasAccount(s, fields?.accountId)) return s;
      const income = { id: uid(), source: 'freelance', ...fields, amount }; s.incomes.push(income);
      s.accounts = changeAccount(s.accounts, fields.accountId, amount);
      return addTransaction(s, { type: 'income', amount, note: fields.note, accountId: fields.accountId, date: fields.date, referenceId: income.id });
    });
    const addRecurringPayment = (fields) => update((s) => {
      const amount = positiveAmount(fields?.amount);
      if (!amount || !hasAccount(s, fields?.accountId) || !isSafeScheduleDate(fields?.nextDate) || !SCHEDULE_FREQUENCIES.includes(fields?.frequency)) return s;
      s.recurringPayments.push({ id: uid(), active: true, ...fields, amount, anchorDay: parseLocalDate(fields.nextDate).getDate() });
      return invalidateBudget(s);
    });
    const updateRecurringPayment = (id, patch) => update((s) => {
      const old = s.recurringPayments.find((item) => item.id === id);
      if (!old) return s;
      const next = { ...old, ...patch };
      const amount = positiveAmount(next.amount);
      if (!amount || !hasAccount(s, next.accountId) || !isSafeScheduleDate(next.nextDate) || !SCHEDULE_FREQUENCIES.includes(next.frequency)) return s;
      s.recurringPayments = s.recurringPayments.map((item) => item.id === id ? { ...next, amount } : item);
      return invalidateBudget(s);
    });
    const deleteRecurringPayment = (id) => update((s) => {
      if (!s.recurringPayments.some((item) => item.id === id)) return s;
      s.recurringPayments = s.recurringPayments.filter((item) => item.id !== id);
      return invalidateBudget(s);
    });
    const updateSettings = (patch) => update((s) => {
      patch = { ...patch };
      if (patch.incomeFrequency != null && !SCHEDULE_FREQUENCIES.includes(patch.incomeFrequency)) return s;
      if (patch.incomeType != null && !INCOME_TYPES.includes(patch.incomeType)) return s;
      if (patch.budgetMode != null && !BUDGET_MODES.includes(patch.budgetMode)) return s;
      if (patch.themeMode != null && !THEME_MODES.includes(patch.themeMode)) return s;
      if (patch.incomeAccountId != null && !hasAccount(s, patch.incomeAccountId)) return s;
      if (patch.incomeAmount != null) patch.incomeAmount = nonNegativeAmount(patch.incomeAmount);
      if (patch.nextIncomeDate != null && !isSafeScheduleDate(patch.nextIncomeDate)) return s;
      if (patch.currency != null) patch.currency = String(patch.currency).trim().slice(0, 8) || s.settings.currency;
      if (patch.budgetSnapshots != null) patch.budgetSnapshots = normalizeBudgetSnapshots(patch.budgetSnapshots);
      if (patch.piggyBank?.accountId != null && !hasAccount(s, patch.piggyBank.accountId)) return s;
      const scheduleChanged = patch.incomeType != null || patch.incomeFrequency != null;
      s.settings = { ...s.settings, ...patch };
      if (patch.piggyBank) {
        s.settings.piggyBank = { ...DEFAULT_SETTINGS.piggyBank, ...(s.settings.piggyBank ?? {}) };
      }
      const scheduleReady = s.settings.incomeAmount > 0 && s.settings.incomeAccountId;
      if ((scheduleChanged || (scheduleReady && !s.settings.nextIncomeDate)) && s.settings.incomeType !== 'freelance') {
        s.settings.nextIncomeDate = nextPeriodStart(s.settings.incomeFrequency);
      }
      return s;
    });
    const configureAutoExport = (frequency, wipeAfterExport = false) => update((s) => {
      if (frequency == null) {
        s.settings.autoExport = { ...DEFAULT_SETTINGS.autoExport };
        return s;
      }
      if (!SCHEDULE_FREQUENCIES.includes(frequency)) return s;
      s.settings.autoExport = { enabled: true, frequency, wipeAfterExport: Boolean(wipeAfterExport), nextDate: nextPeriodStart(frequency), lastUri: s.settings.autoExport?.lastUri ?? null };
      return s;
    });
    const completeAutoExport = (uri) => update((s) => {
      const autoExport = { ...DEFAULT_SETTINGS.autoExport, ...(s.settings.autoExport ?? {}) };
      const nextDate = nextFutureDate(autoExport.nextDate ?? today(), autoExport.frequency);
      if (!autoExport.wipeAfterExport) {
        s.settings.autoExport = { ...autoExport, nextDate, lastUri: uri };
        return s;
      }
      const accountId = uid();
      return {
        people: [],
        entries: [],
        expenses: [],
        accounts: [{ id: accountId, type: 'physical', name: 'Cash', balance: 0 }],
        incomes: [],
        recurringPayments: [],
        piggyBankBalance: 0,
        piggyBankTransactions: [],
        transactions: [],
        settings: {
          ...s.settings,
          incomeAccountId: accountId,
          nextIncomeDate: null,
          budgetSnapshots: {},
          piggyBank: { ...DEFAULT_SETTINGS.piggyBank },
          autoExport: { ...autoExport, nextDate, lastUri: uri },
        },
      };
    });
    const depositPiggyBank = (amount, accountId, note = 'Piggybank deposit') => update((s) => {
      const value = positiveAmount(amount);
      if (!value || !hasAccount(s, accountId)) return s;
      s.accounts = changeAccount(s.accounts, accountId, -value);
      s.piggyBankBalance = (Number(s.piggyBankBalance) || 0) + value;
      s.piggyBankTransactions = [...(s.piggyBankTransactions ?? []), { id: uid(), type: 'deposit', amount: value, date: today(), note }];
      return addTransaction(s, { type: 'piggy_bank', amount: -value, note, accountId });
    });
    const withdrawPiggyBank = (amount, accountId, note = 'Piggybank thievery') => update((s) => {
      const requested = positiveAmount(amount);
      if (!requested || !hasAccount(s, accountId)) return s;
      const value = Math.min(requested, Number(s.piggyBankBalance) || 0);
      if (!value) return s;
      s.accounts = changeAccount(s.accounts, accountId, value);
      s.piggyBankBalance = Math.max(0, (Number(s.piggyBankBalance) || 0) - value);
      s.piggyBankTransactions = [...(s.piggyBankTransactions ?? []), { id: uid(), type: 'withdrawal', amount: -value, date: today(), note }];
      return addTransaction(s, { type: 'piggy_bank_withdrawal', amount: value, note, accountId });
    });
    const breakPiggyBank = (accountId) => update((s) => {
      const value = Number(s.piggyBankBalance) || 0;
      if (!value || !hasAccount(s, accountId)) return s;
      s.accounts = changeAccount(s.accounts, accountId, value);
      s.piggyBankBalance = 0;
      s.piggyBankTransactions = [...(s.piggyBankTransactions ?? []), { id: uid(), type: 'break', amount: -value, date: today(), note: 'Broke the bank' }];
      return addTransaction(s, { type: 'piggy_bank_withdrawal', amount: value, note: 'Broke the bank', accountId });
    });
    const receivableBalances = new Map();
    const payableBalances = new Map();
    const receivableActivity = new Map();
    const payableActivity = new Map();
    let totalOutstanding = 0;
    let totalPayable = 0;
    for (const entry of state.entries) {
      const balances = entry.direction === 'payable' ? payableBalances : receivableBalances;
      const activity = entry.direction === 'payable' ? payableActivity : receivableActivity;
      if (!activity.has(entry.personId) || activity.get(entry.personId) < entry.date) activity.set(entry.personId, entry.date);
      if (entry.status !== 'owed') continue;
      balances.set(entry.personId, (balances.get(entry.personId) ?? 0) + entry.amount);
      if (entry.direction === 'payable') totalPayable += entry.amount;
      else totalOutstanding += entry.amount;
    }
    const balanceFor = (personId, direction = 'receivable') =>
      (direction === 'payable' ? payableBalances : receivableBalances).get(personId) ?? 0;
    const entriesFor = (personId, status, direction = 'receivable') => state.entries.filter((item) => item.personId === personId && item.direction === direction && item.status === status);
    const lastActivityFor = (personId, direction = 'receivable') =>
      (direction === 'payable' ? payableActivity : receivableActivity).get(personId) ?? null;
    const totalFunds = state.accounts.reduce((sum, item) => sum + item.balance, 0);
    const spendable = totalFunds;
    const budgetableSpendable = Math.max(0, spendable - totalPayable);
    const snapshots = state.settings.budgetSnapshots ?? {};
    const budgetSummary = Object.fromEntries(BUDGET_PERIODS.map((period) => [
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
      loaded: true, ...state, piggyBankBalance: Number(state.piggyBankBalance) || 0, piggyBankTransactions: state.piggyBankTransactions ?? [], people: state.people.filter((item) => !item.archived), totalOutstanding, totalPayable, totalFunds, spendable, budgetableSpendable, budgetSummary,
      totalExpenses: state.expenses.reduce((sum, item) => sum + item.amount, 0),
      addPerson, updatePerson, removePerson, addEntry, editEntry, receiveEntry, markOwed, deleteEntry,
      addAccount, editAccount, addExpense, editExpense, deleteExpense, addIncome, addRecurringPayment, updateRecurringPayment,
      deleteRecurringPayment, updateSettings, configureAutoExport, completeAutoExport, depositPiggyBank, withdrawPiggyBank, breakPiggyBank, balanceFor, entriesFor, lastActivityFor,
      exportData: (groups = ['all']) => {
        const selected = groups.includes('all') ? Object.keys(EXPORT_GROUPS) : groups.filter((group) => EXPORT_GROUPS[group]);
        const data = selected.flatMap((group) => EXPORT_GROUPS[group]).reduce((result, key) => ({ ...result, [key]: state[key] }), {});
        return JSON.stringify({ version: 5, exportedAt: new Date().toISOString(), groups: selected, ...data }, null, 2);
      },
      importData: (json) => {
        const incoming = JSON.parse(json);
        const groups = Array.isArray(incoming.groups) ? [...new Set(incoming.groups.filter((group) => EXPORT_GROUPS[group]))] : Object.keys(EXPORT_GROUPS);
        if (groups.length === Object.keys(EXPORT_GROUPS).length) {
          save(refreshBudgetSnapshots(processDailyBudgetRollovers(processSchedules(migrateCreditSources(normalizeImportedState(incoming))))));
          return;
        }
        const keys = new Set(groups.flatMap((group) => RESTORE_GROUPS[group]));
        update((s) => {
          const replacements = Object.fromEntries([...keys].filter((key) => incoming[key] !== undefined).map((key) => [key, incoming[key]]));
          const dependencyAccounts = groups.includes('funds')
            ? incoming.accounts
            : uniqueById([...(s.accounts ?? []), ...(incoming.accounts ?? [])], RECORD_LIMITS.accounts);
          if (dependencyAccounts) replacements.accounts = dependencyAccounts;
          if (groups.includes('piggyBank') && !groups.includes('settings') && incoming.settings?.piggyBank) {
            replacements.settings = { ...s.settings, piggyBank: incoming.settings.piggyBank };
          }
          return migrateCreditSources(normalizeImportedState({ ...s, ...replacements }));
        });
      },
      mergeData: (json) => {
        const incoming = migrateCreditSources(normalizeImportedState(JSON.parse(json)));
        update((s) => {
          for (const key of STATE_ARRAY_KEYS) {
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
