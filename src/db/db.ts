import Dexie, { type Table } from 'dexie';
import type { Account, BillSplit, BudgetPlan, Category, PriceSnapshot, Profile, Recurring, Trip, Tx } from '../domain/types';
import type { Debt } from '../domain/debts';
import type { Goal } from '../domain/goals';

export interface KV {
  key: string;
  value: unknown;
}

export class MoneyDB extends Dexie {
  profiles!: Table<Profile, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  txs!: Table<Tx, string>;
  recurring!: Table<Recurring, string>;
  bills!: Table<BillSplit, string>;
  trips!: Table<Trip, string>;
  budgets!: Table<BudgetPlan, string>;
  kv!: Table<KV, string>;
  prices!: Table<PriceSnapshot, string>;
  debts!: Table<Debt, string>;
  goals!: Table<Goal, string>;

  constructor(name = 'money-tracking') {
    super(name);
    // Bump the version and add an upgrade step whenever the shape changes, so data on phones is kept.
    this.version(1).stores({
      profiles: 'id',
      accounts: 'id, profileId',
      categories: 'id, profileId',
      txs: 'id, profileId, date, accountId, toAccountId, recurringId',
      recurring: 'id, profileId',
      bills: 'id, updatedAt',
      trips: 'id, updatedAt',
      budgets: 'id, profileId',
      kv: 'key',
      prices: 'date',
      debts: 'id, profileId',
      goals: 'id, profileId',
    });
  }
}

export const db = new MoneyDB();

export const TABLES = [
  'profiles',
  'accounts',
  'categories',
  'txs',
  'recurring',
  'bills',
  'trips',
  'budgets',
  'kv',
  'prices',
  'debts',
  'goals',
] as const;

export type TableName = (typeof TABLES)[number];

export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
