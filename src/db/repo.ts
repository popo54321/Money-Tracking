// Reading and writing app data.
import { todayISO, type ISODate } from '../domain/dates';
import { unitValue, balanceOf } from '../domain/balances';
import type { RateTable } from '../domain/fx';
import { dueToPost } from '../domain/recurring';
import type {
  Freq,
  Account,
  BillSplit,
  BudgetPlan,
  Category,
  PriceCache,
  Recurring,
  Settings,
  Trip,
  Tx,
  TxKind,
} from '../domain/types';
import { FALLBACK_BTC_THB, FALLBACK_GOLD_BUY_THB, FALLBACK_GOLD_SELL_THB, FALLBACK_PER_USD } from '../domain/fx';
import type { Debt } from '../domain/debts';
import type { Goal } from '../domain/goals';
import { db, uid } from './db';
import { DEFAULT_SETTINGS, makeBudget } from './seed';

// ---------- settings ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } });
}

export const FALLBACK_PRICES: PriceCache = {
  perUsd: FALLBACK_PER_USD,
  ratesSource: 'built-in (3 Nov 2026)',
  btcPrice: FALLBACK_BTC_THB,
  btcPriceCurrency: 'THB',
  btcSource: 'built-in (3 Nov 2026)',
  goldBuyThb: FALLBACK_GOLD_BUY_THB,
  goldSellThb: FALLBACK_GOLD_SELL_THB,
  goldSource: 'built-in (3 Nov 2026)',
};

export async function getPriceCache(): Promise<PriceCache> {
  const row = await db.kv.get('prices');
  return (row?.value as PriceCache) ?? FALLBACK_PRICES;
}

export async function setPriceCache(p: PriceCache): Promise<void> {
  await db.kv.put({ key: 'prices', value: p });
}

export async function getFlag<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setFlag(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

// ---------- entries ----------

export interface TxDraft {
  id?: string;
  profileId: string;
  date: ISODate;
  kind: TxKind;
  accountId: string;
  amount: number;
  toAccountId?: string;
  toAmount?: number;
  categoryId?: string;
  note?: string;
  origAmount?: number;
  origCurrency?: string;
  recurringId?: string;
}

/** Stamp the entry with its value in the default currency at today's rates. */
export function stampValue(draft: TxDraft, account: Account | undefined, rates: RateTable, defaultCurrency: string) {
  const per = account ? unitValue(account, rates, defaultCurrency) : null;
  if (per === null || !account) {
    return { value: draft.amount, valueCurrency: account?.currency ?? defaultCurrency };
  }
  return { value: draft.amount * per, valueCurrency: defaultCurrency };
}

export async function saveTx(draft: TxDraft, rates: RateTable, defaultCurrency: string): Promise<string> {
  const account = await db.accounts.get(draft.accountId);
  const now = Date.now();
  const { value, valueCurrency } = stampValue(draft, account, rates, defaultCurrency);
  const existing = draft.id ? await db.txs.get(draft.id) : undefined;
  const tx: Tx = {
    id: draft.id ?? uid(),
    profileId: draft.profileId,
    date: draft.date,
    kind: draft.kind,
    accountId: draft.accountId,
    amount: draft.amount,
    toAccountId: draft.kind === 'transfer' ? draft.toAccountId : undefined,
    toAmount: draft.kind === 'transfer' ? draft.toAmount : undefined,
    categoryId: draft.kind === 'income' || draft.kind === 'expense' ? draft.categoryId : undefined,
    note: draft.note?.trim() || undefined,
    origAmount: draft.origAmount,
    origCurrency: draft.origCurrency,
    value,
    valueCurrency,
    recurringId: draft.recurringId ?? existing?.recurringId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.txs.put(tx);
  return tx.id;
}

export async function deleteTx(id: string): Promise<void> {
  await db.txs.delete(id);
}

/**
 * Change an account's total. With no entries yet, the starting balance is simply replaced.
 * Otherwise the difference is recorded as an adjustment, income or spending.
 */
export async function setAccountBalance(opts: {
  account: Account;
  newBalance: number;
  mode: 'adjust' | 'log' | 'opening';
  categoryId?: string;
  date: ISODate;
  note?: string;
  rates: RateTable;
  defaultCurrency: string;
}): Promise<void> {
  const { account } = opts;
  const txs = await db.txs.where('accountId').equals(account.id).toArray();
  const incoming = await db.txs.where('toAccountId').equals(account.id).toArray();
  const all = [...txs, ...incoming.filter((t) => t.accountId !== account.id)];
  // entries dated after the chosen day haven't happened yet, so they don't count
  const current = balanceOf(account, all, opts.date);
  const delta = opts.newBalance - current;
  if (Math.abs(delta) < 1e-12) return;
  if (opts.mode === 'opening') {
    await db.accounts.update(account.id, { openingBalance: account.openingBalance + delta });
    return;
  }
  if (opts.mode === 'adjust') {
    await saveTx(
      {
        profileId: account.profileId,
        date: opts.date,
        kind: 'adjust',
        accountId: account.id,
        amount: delta,
        note: opts.note || 'Balance adjusted',
      },
      opts.rates,
      opts.defaultCurrency,
    );
    return;
  }
  await saveTx(
    {
      profileId: account.profileId,
      date: opts.date,
      kind: delta > 0 ? 'income' : 'expense',
      accountId: account.id,
      amount: Math.abs(delta),
      categoryId: opts.categoryId,
      note: opts.note,
    },
    opts.rates,
    opts.defaultCurrency,
  );
}

// ---------- accounts ----------

export async function saveAccount(a: Account): Promise<void> {
  await db.accounts.put(a);
}

export async function accountTxCount(accountId: string): Promise<number> {
  const a = await db.txs.where('accountId').equals(accountId).count();
  const b = await db.txs.where('toAccountId').equals(accountId).count();
  return a + b;
}

/** Delete an account and every entry and repeating entry that uses it. */
export async function deleteAccountCascade(accountId: string): Promise<void> {
  await db.transaction('rw', [db.accounts, db.txs, db.recurring], async () => {
    await db.txs.where('accountId').equals(accountId).delete();
    await db.txs.where('toAccountId').equals(accountId).delete();
    await db.recurring.filter((r) => r.accountId === accountId || r.toAccountId === accountId).delete();
    await db.accounts.delete(accountId);
  });
}

// ---------- categories ----------

export async function saveCategory(c: Category): Promise<void> {
  await db.categories.put(c);
}

export async function categoryInUse(id: string): Promise<boolean> {
  const n = await db.txs.filter((t) => t.categoryId === id).count();
  const r = await db.recurring.filter((x) => x.categoryId === id).count();
  return n + r > 0;
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id);
}

// ---------- repeating entries ----------

export interface RepeatOptions {
  name: string;
  freq: Freq;
  every: number;
  autoPost: boolean;
  reserve: boolean;
}

/**
 * Save a new entry, optionally as the first of a repeating series.
 * A series whose first date is in the future is only scheduled: nothing is recorded until that day,
 * when postDueRecurring records it like any other occurrence.
 */
export async function saveNewEntry(
  draft: TxDraft,
  repeat: RepeatOptions | null,
  rates: RateTable,
  defaultCurrency: string,
  today = todayISO(),
): Promise<'saved' | 'scheduled'> {
  if (!repeat || draft.kind === 'adjust') {
    await saveTx(draft, rates, defaultCurrency);
    return 'saved';
  }
  const kind = draft.kind;
  const r: Recurring = {
    id: uid(),
    profileId: draft.profileId,
    name: repeat.name,
    kind,
    amount: draft.amount,
    accountId: draft.accountId,
    toAccountId: kind === 'transfer' ? draft.toAccountId : undefined,
    toAmount: kind === 'transfer' ? (draft.toAmount ?? draft.amount) : undefined,
    categoryId: draft.categoryId,
    note: draft.note?.trim() || undefined,
    freq: repeat.freq,
    every: Math.max(1, Math.floor(repeat.every || 1)),
    startDate: draft.date,
    autoPost: repeat.autoPost,
    reserve: kind !== 'income' && repeat.reserve,
    active: true,
    createdAt: Date.now(),
  };
  if (draft.date > today) {
    await saveRecurring(r);
    return 'scheduled';
  }
  await saveTx({ ...draft, recurringId: r.id }, rates, defaultCurrency);
  await saveRecurring({ ...r, lastPosted: draft.date });
  return 'saved';
}

export async function saveRecurring(r: Recurring): Promise<void> {
  await db.recurring.put(r);
}

export async function deleteRecurring(id: string, alsoEntries: boolean): Promise<void> {
  await db.transaction('rw', [db.recurring, db.txs], async () => {
    if (alsoEntries) await db.txs.where('recurringId').equals(id).delete();
    await db.recurring.delete(id);
  });
}

/**
 * Record every repeating entry that has fallen due (catching up missed days).
 * Entry ids are fixed per occurrence, so running this twice never records one twice.
 */
export async function postDueRecurring(rates: RateTable, defaultCurrency: string, today = todayISO()): Promise<number> {
  const list = await db.recurring.toArray();
  let posted = 0;
  for (const r of list) {
    if (!r.active || !r.autoPost) continue;
    const dates = dueToPost(r, r.lastPosted, today);
    if (dates.length === 0) continue;
    for (const d of dates) {
      await postOccurrence(r, d, rates, defaultCurrency, today);
      posted++;
    }
  }
  return posted;
}

/** Record one occurrence now (also used by "Record now" for manual repeating entries). */
export async function postOccurrence(
  r: Recurring,
  date: ISODate,
  rates: RateTable,
  defaultCurrency: string,
  today = todayISO(),
): Promise<void> {
  const id = `rec-${r.id}-${date}`;
  const exists = await db.txs.get(id);
  if (!exists) {
    await saveTx(
      {
        id,
        profileId: r.profileId,
        // recording a future payment early ("Record now") counts it from today
        date: date > today ? today : date,
        kind: r.kind,
        accountId: r.accountId,
        amount: r.amount,
        toAccountId: r.toAccountId,
        toAmount: r.toAmount,
        categoryId: r.categoryId,
        note: r.note || r.name,
        recurringId: r.id,
      },
      rates,
      defaultCurrency,
    );
  }
  const fresh = await db.recurring.get(r.id);
  if (fresh && (!fresh.lastPosted || fresh.lastPosted < date)) await db.recurring.update(r.id, { lastPosted: date });
}

/** Skip an occurrence without recording it. */
export async function skipOccurrence(r: Recurring, date: ISODate): Promise<void> {
  if (!r.lastPosted || r.lastPosted < date) await db.recurring.update(r.id, { lastPosted: date });
}

// ---------- bill split, trips, budgets ----------

export async function saveBill(b: BillSplit): Promise<void> {
  await db.bills.put({ ...b, updatedAt: Date.now() });
}

export async function deleteBill(id: string): Promise<void> {
  await db.bills.delete(id);
}

export async function saveTrip(t: Trip): Promise<void> {
  await db.trips.put({ ...t, updatedAt: Date.now() });
}

export async function deleteTrip(id: string): Promise<void> {
  await db.trips.delete(id);
}

export async function getOrCreateBudget(profileId: string): Promise<BudgetPlan> {
  const id = `budget-${profileId}`;
  const b = await db.budgets.get(id);
  if (b) return b;
  const fresh = makeBudget(profileId);
  await db.budgets.put(fresh);
  return fresh;
}

export async function saveBudget(b: BudgetPlan): Promise<void> {
  await db.budgets.put({ ...b, updatedAt: Date.now() });
}

// ---------- who owes me, saving targets ----------

export async function saveDebt(d: Debt): Promise<void> {
  await db.debts.put({ ...d, updatedAt: Date.now() });
}

export async function deleteDebt(id: string): Promise<void> {
  await db.debts.delete(id);
}

export async function saveGoal(g: Goal): Promise<void> {
  await db.goals.put({ ...g, updatedAt: Date.now() });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}

export interface OwedItem {
  person: string;
  /** owedToMe = they owe me; iOwe = I owe them */
  direction: Debt['direction'];
  amount: number;
  currency: string;
  date: ISODate;
  note: string;
  /** the same key (e.g. bill + person) always updates the same line, so adding twice never doubles it */
  key: string;
}

/**
 * Put unpaid amounts from a bill or trip into "Who owes me". Adds to an open record for the same person
 * (same direction and currency) or starts a new one.
 */
export async function recordOwed(profileId: string, items: OwedItem[]): Promise<number> {
  const debts = await db.debts.where('profileId').equals(profileId).toArray();
  let n = 0;
  for (const it of items) {
    if (!(it.amount > 0) || !it.person.trim()) continue;
    const event = { id: it.key, date: it.date, type: 'lend' as const, amount: it.amount, note: it.note };
    const same = (d: Debt) =>
      !d.closed &&
      d.direction === it.direction &&
      d.currency === it.currency &&
      d.person.trim().toLowerCase() === it.person.trim().toLowerCase();
    const existing = debts.find((d) => d.events.some((e) => e.id === it.key)) ?? debts.find(same);
    let next: Debt;
    if (existing) {
      const has = existing.events.some((e) => e.id === it.key);
      next = {
        ...existing,
        events: has ? existing.events.map((e) => (e.id === it.key ? { ...e, ...event } : e)) : [...existing.events, event],
        updatedAt: Date.now(),
      };
      debts.splice(debts.indexOf(existing), 1, next);
    } else {
      next = {
        id: uid(),
        profileId,
        person: it.person.trim(),
        direction: it.direction,
        currency: it.currency,
        interestType: 'none',
        ratePct: 0,
        ratePer: 'year',
        events: [event],
        closed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      debts.push(next);
    }
    await db.debts.put(next);
    n++;
  }
  return n;
}

// ---------- reset ----------

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
