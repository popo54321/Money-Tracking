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

/** This phone's own data. */
export const mainDb = new MoneyDB();

/**
 * The data the app shows: this phone's own, or (Family view) a read-only copy of another phone's. Screens and
 * repo code read and write `db`; sync, backups and recovery always use `mainDb`.
 */
// eslint-disable-next-line import/no-mutable-exports
export let db: MoneyDB = mainDb;

// ---------- Family view ----------

/** Tables a viewer may change in the copy: its own look and prices. Everything else is read-only. */
const VIEW_WRITABLE = new Set(['kv', 'prices']);
export const READ_ONLY = 'Viewing only: changes can’t be saved on someone else’s money.';

export interface Viewing {
  deviceId: string;
  name: string;
  /** when that phone last sent its data */
  updatedAt: number;
}
let viewing: Viewing | null = null;
let viewDb: MoneyDB | null = null;
let importing = false;
const viewListeners = new Set<() => void>();

export const currentView = (): Viewing | null => viewing;
export const isViewing = (): boolean => viewing !== null;
export function onViewChange(l: () => void): () => void {
  viewListeners.add(l);
  return () => viewListeners.delete(l);
}

function viewDatabase(): MoneyDB {
  if (viewDb) return viewDb;
  const v = new MoneyDB('money-tracking-view');
  for (const t of v.tables) {
    if (VIEW_WRITABLE.has(t.name)) continue;
    const stop = () => {
      if (!importing) throw new Error(READ_ONLY);
    };
    t.hook('creating', stop);
    t.hook('updating', stop);
    t.hook('deleting', stop);
  }
  viewDb = v;
  return v;
}

/** Show another phone's data (from its family backup), read-only. */
export async function openView(who: Viewing, data: Partial<Record<TableName, unknown[]>>): Promise<void> {
  const v = viewDatabase();
  importing = true;
  try {
    await v.transaction('rw', v.tables, async () => {
      for (const t of TABLES) {
        await v.table(t).clear();
        const rows = data[t];
        if (rows?.length) await v.table(t).bulkPut(rows);
      }
    });
  } finally {
    importing = false;
  }
  viewing = who;
  db = v;
  viewListeners.forEach((l) => l());
}

/** Back to this phone's own money. */
export function closeView(): void {
  viewing = null;
  db = mainDb;
  viewListeners.forEach((l) => l());
}

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
