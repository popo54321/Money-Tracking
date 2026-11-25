// Example money for the How to use tour: a made-up person ("Alex") with accounts, entries, a dinner bill split,
// a trip, a budget plan, saving targets, investments and debts, so each tour step can point at a real, filled-in
// screen. It is shown read-only (like Family view) and never touches this phone's own data.
import { addDays, monthKey, todayISO } from '../domain/dates';
import type { Account, BillSplit, Category, Profile, Recurring, Trip, Tx } from '../domain/types';
import type { Debt } from '../domain/debts';
import type { Goal } from '../domain/goals';
import { EXPENSE, INCOME, makeBudget, makeCategories } from '../db/seed';
import { closeView, currentView, mainDb, openView, type TableName } from '../db/db';

export const DEMO_ID = 'demo';
const P = 'demo-user';

// what the calculator saved for this phone, put back after the tour
const CALC_KEYS = ['paying-in-stop-v4', 'paying-in-plans-v1'];
let calcSaved: Record<string, string | null> | null = null;

export const isDemo = (): boolean => currentView()?.deviceId === DEMO_ID;

/** Everything the example person has, as backup tables. */
export async function demoData(): Promise<Partial<Record<TableName, unknown[]>>> {
  const today = todayISO();
  const ago = (n: number) => addDays(today, -n);
  const now = Date.now();
  const profile: Profile = { id: P, name: 'Alex (example)', emoji: '🦊', order: 0 };
  const cats: Category[] = makeCategories(P, INCOME, EXPENSE);
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;
  // a spending limit to show on Home
  cats.find((c) => c.name === 'Dinner')!.limit = 5000;
  cats.find((c) => c.name === 'Groceries')!.limit = 6000;

  const acc = (a: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account => ({
    profileId: P,
    currency: 'THB',
    group: 'Bank',
    openingBalance: 0,
    openingDate: ago(60),
    includeInNetWorth: true,
    archived: false,
    order: 0,
    ...a,
  });
  const accounts: Account[] = [
    acc({ id: 'd-bank', name: 'Kbank – Everyday', type: 'bank', openingBalance: 82000, order: 0 }),
    acc({ id: 'd-save', name: 'SCB – Savings', type: 'bank', openingBalance: 150000, order: 1 }),
    acc({ id: 'd-cash', name: 'Wallet', type: 'cash', group: 'Cash', openingBalance: 2500, order: 2 }),
    acc({
      id: 'd-card',
      name: 'Visa card',
      type: 'credit',
      group: 'Credit',
      creditLimit: 60000,
      statementDay: 25,
      dueDay: 10,
      payFromAccountId: 'd-bank',
      order: 3,
    }),
    acc({
      id: 'd-joint',
      name: 'Joint account',
      type: 'bank',
      openingBalance: 30000,
      order: 4,
      shared: { mine: true, ownerDevice: DEMO_ID, ownerName: 'Alex', members: ['partner'] },
    }),
    acc({
      id: 'd-fund',
      name: 'S&P 500 fund',
      type: 'investment',
      group: 'Investments',
      openingBalance: 135000,
      capital: { amount: 110000, setAt: now - 86400000 * 50 },
      order: 5,
    }),
    acc({
      id: 'd-btc',
      name: 'Bitcoin – Bitkub',
      type: 'crypto',
      currency: 'BTC',
      group: 'Investments',
      openingBalance: 0.015,
      costBasis: 32000,
      order: 6,
    }),
  ];

  let n = 0;
  const tx = (t: Partial<Tx> & Pick<Tx, 'kind' | 'accountId' | 'amount'>): Tx => ({
    id: `d-tx-${++n}`,
    profileId: P,
    date: today,
    value: Math.abs(t.amount) * (t.amount < 0 ? -1 : 1),
    valueCurrency: 'THB',
    createdAt: now - 100000 + n,
    updatedAt: now - 100000 + n,
    ...t,
  });
  const txs: Tx[] = [
    tx({ kind: 'income', accountId: 'd-bank', amount: 45000, categoryId: cat('Salary'), date: ago(20), note: 'Pay' }),
    tx({ kind: 'expense', accountId: 'd-cash', amount: 120, categoryId: cat('Lunch'), date: ago(1), note: 'Noodles' }),
    tx({ kind: 'expense', accountId: 'd-bank', amount: 1450, categoryId: cat('Groceries'), date: ago(3), note: 'Big C' }),
    tx({ kind: 'expense', accountId: 'd-cash', amount: 85, categoryId: cat('Coffee'), date: today, note: 'Latte' }),
    tx({
      id: 'demo-dinner',
      kind: 'expense',
      accountId: 'd-bank',
      amount: 2400,
      categoryId: cat('Dinner'),
      date: ago(4),
      note: 'Friday dinner (whole bill)',
    }),
    tx({
      kind: 'expense',
      accountId: 'd-bank',
      amount: -1600,
      categoryId: cat('Dinner'),
      date: ago(2),
      note: 'Ben payback for Friday dinner',
      refundOf: 'demo-dinner',
    }),
    tx({ kind: 'expense', accountId: 'd-card', amount: 3200, categoryId: cat('Clothes'), date: ago(6), note: 'Jacket' }),
    tx({
      kind: 'transfer',
      accountId: 'd-bank',
      toAccountId: 'd-fund',
      amount: 5000,
      toAmount: 5000,
      date: ago(15),
      note: 'Monthly investing',
    }),
    tx({
      kind: 'income',
      accountId: 'd-fund',
      amount: 800,
      categoryId: cat('Investing Dividend'),
      date: ago(10),
      note: 'Dividend',
    }),
    tx({
      kind: 'expense',
      accountId: 'd-joint',
      amount: 2100,
      categoryId: cat('Groceries'),
      date: ago(5),
      note: 'Groceries',
      remoteAuthor: { id: 'partner', name: 'Sam’s phone' },
    }),
  ];

  const rec = (r: Partial<Recurring> & Pick<Recurring, 'id' | 'name' | 'kind' | 'amount' | 'accountId'>): Recurring => ({
    profileId: P,
    freq: 'month',
    every: 1,
    startDate: addDays(today, 6),
    autoPost: true,
    reserve: true,
    active: true,
    createdAt: now,
    ...r,
  });
  const recurring: Recurring[] = [
    rec({ id: 'd-rent', name: 'Rent', kind: 'expense', amount: 12000, accountId: 'd-bank', categoryId: cat('Rent') }),
    rec({
      id: 'd-netflix',
      name: 'Netflix',
      kind: 'expense',
      amount: 419,
      accountId: 'd-card',
      categoryId: cat('Subscriptions'),
      startDate: addDays(today, 9),
    }),
    rec({
      id: 'd-ins',
      name: 'Health insurance',
      kind: 'expense',
      amount: 18000,
      accountId: 'd-bank',
      categoryId: cat('Insurance'),
      freq: 'year',
      startDate: addDays(today, 120),
    }),
  ];

  const goals: Goal[] = [
    {
      id: 'd-goal-phone',
      profileId: P,
      name: 'New phone',
      emoji: '📱',
      price: 40000,
      currency: 'THB',
      source: 'manual',
      saved: 15000,
      accountId: 'd-save',
      monthly: 3000,
      countFrom: today,
      done: false,
      order: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'd-goal-japan',
      profileId: P,
      name: 'Japan trip',
      emoji: '🗾',
      price: 60000,
      currency: 'THB',
      source: 'manual',
      saved: 22000,
      accountId: 'd-save',
      monthly: 5000,
      countFrom: today,
      done: false,
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const debts: Debt[] = [
    {
      id: 'demo-debt-ben',
      profileId: P,
      person: 'Ben',
      direction: 'owedToMe',
      currency: 'THB',
      interestType: 'none',
      ratePct: 0,
      ratePer: 'year',
      events: [
        {
          id: 'bill:demo-bill:ben:in',
          date: ago(4),
          type: 'lend',
          amount: 1600,
          note: 'Ben payback for Friday dinner',
          spentCategoryId: cat('Dinner'),
          spentTxId: 'demo-dinner',
        },
        { id: 'd-repay', date: ago(2), type: 'repay', amount: 1000, txId: undefined },
      ],
      closed: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-debt-mai',
      profileId: P,
      person: 'Mai',
      direction: 'iOwe',
      currency: 'THB',
      interestType: 'none',
      ratePct: 0,
      ratePer: 'year',
      events: [{ id: 'd-mai', date: ago(8), type: 'lend', amount: 500, note: 'Concert ticket' }],
      closed: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const bill: BillSplit = {
    id: 'demo-bill',
    title: 'Friday dinner',
    date: ago(4),
    currency: 'THB',
    people: [
      { id: 'alex', name: 'Alex (example)' },
      { id: 'ben', name: 'Ben' },
      { id: 'mai', name: 'Mai' },
    ],
    items: [
      { id: 'i1', name: 'Tom yum (shared)', price: 360, sharedBy: [], shared: true },
      { id: 'i2', name: 'Pad thai', price: 180, sharedBy: ['alex'], shared: false },
      { id: 'i3', name: 'Green curry', price: 220, sharedBy: ['ben'], shared: false },
      { id: 'i4', name: 'Mango sticky rice', price: 150, sharedBy: ['mai'], shared: false },
      { id: 'i5', name: 'Beers', price: 420, sharedBy: ['alex', 'ben'], shared: false },
    ],
    servicePct: 10,
    vatPct: 7,
    vatOnService: true,
    mode: 'itemised',
    roundWhole: false,
    paidBy: 'alex',
    createdAt: now,
    updatedAt: now,
  };

  const trip: Trip = {
    id: 'demo-trip',
    name: 'Chiang Mai weekend',
    baseCurrency: 'THB',
    rates: { USD: 33 },
    payBackCurrency: 'THB',
    members: [
      { id: 'alex', name: 'Alex (example)' },
      { id: 'ben', name: 'Ben' },
      { id: 'mai', name: 'Mai' },
    ],
    entries: [
      { id: 't1', date: ago(30), payerId: 'alex', bill: 'Hotel', cost: 4500, currency: 'THB', split: 'all' },
      { id: 't2', date: ago(30), payerId: 'ben', bill: 'Khao soi dinner', cost: 900, currency: 'THB', split: 'all' },
      { id: 't3', date: ago(29), payerId: 'mai', bill: 'Songthaew taxi', cost: 600, currency: 'THB', split: 'all' },
      {
        id: 't4',
        date: ago(29),
        payerId: 'alex',
        bill: 'Elephant park',
        cost: 60,
        currency: 'USD',
        split: 'some',
        sharedBy: ['alex', 'mai'],
      },
      { id: 't5', date: ago(29), payerId: 'alex', bill: 'Souvenirs', cost: 800, currency: 'THB', split: 'none' },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const budget = makeBudget(P);
  budget.monthlyIncome = 45000;
  const phase = budget.activePhaseId;
  const bcat = (name: string) => budget.categories.find((c) => c.name === name)!.id;
  budget.amounts[phase] = {
    [bcat('Saving')]: 8000,
    [bcat('Investing')]: 7000,
    [bcat('Living costs')]: 22000,
    [bcat('Fun')]: 5000,
    [bcat('Emergency')]: 3000,
  };
  budget.transfers = [
    {
      id: 'd-tr1',
      fromLabel: 'Kbank',
      toLabel: 'Savings',
      fromAccountId: 'd-bank',
      toAccountId: 'd-save',
      categoryIds: [bcat('Saving'), bcat('Emergency')],
      amounts: {},
    },
    {
      id: 'd-tr2',
      fromLabel: 'Kbank',
      toLabel: 'Fund',
      fromAccountId: 'd-bank',
      toAccountId: 'd-fund',
      categoryIds: [bcat('Investing')],
      amounts: {},
    },
  ];
  budget.checklist = { month: monthKey(today), done: ['d-tr2'], recorded: [] };
  budget.bonus = {
    income: 30000,
    rows: [
      { id: 'b1', name: 'Investment', pct: 0.5 },
      { id: 'b2', name: 'Emergency', pct: 0.3 },
      { id: 'b3', name: 'Travel', pct: 0.2 },
    ],
  };

  // the look and prices of this phone, so the example feels like home
  const settings = (await mainDb.kv.get('settings'))?.value as Record<string, unknown> | undefined;
  const prices = await mainDb.kv.get('prices');
  profile.payday = {
    active: true,
    accountId: 'd-bank',
    incomeCategoryId: cat('Salary'),
    gross: 50000,
    takeHome: 45000,
    deductCategoryId: cat('Tax'),
    extras: [],
    rule: 'day',
    day: 25,
    fromMonth: monthKey(today),
  } as Profile['payday'];
  return {
    profiles: [profile],
    categories: cats,
    accounts,
    txs,
    recurring,
    goals,
    debts,
    bills: [bill],
    trips: [trip],
    budgets: [budget],
    kv: [{ key: 'settings', value: { ...(settings ?? {}), activeProfileId: P, guideSeen: true } }, ...(prices ? [prices] : [])],
  };
}

/** Switch the app onto the example money (read-only) for the tour. */
export async function openDemo(): Promise<void> {
  if (isDemo()) return;
  try {
    calcSaved = Object.fromEntries(CALC_KEYS.map((k) => [k, localStorage.getItem(k)]));
  } catch {
    calcSaved = null;
  }
  await openView({ deviceId: DEMO_ID, name: 'Example money (tour)', updatedAt: Date.now() }, await demoData());
}

/** Back to this phone's own money, and the calculator's own numbers. */
export function closeDemo(): void {
  if (!isDemo()) return;
  closeView();
  restoreCalc();
}

function restoreCalc(): void {
  if (!calcSaved) return;
  try {
    for (const [k, v] of Object.entries(calcSaved)) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  } catch {
    // nothing to put back
  }
  calcSaved = null;
}

/** Example numbers for the built-in calculator (only while the tour shows the example money). */
export const DEMO_CALC: Record<string, string> = {
  start: '170,000',
  monthly: '8,000',
  raise: '3',
  infl: '2',
  growth: '7',
  growth2: '4',
  age: '32',
  retire: '60',
  spend: '30,000',
  sIncome: '45,000',
  sSpend: '28,000',
  sDebt: '0',
  sCash: '90,000',
};
