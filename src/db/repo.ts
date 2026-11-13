// Reading and writing app data.
import { todayISO, type ISODate, type MonthKey } from '../domain/dates';
import { unitValue, balanceOf } from '../domain/balances';
import type { RateTable } from '../domain/fx';
import { dueToPost, instalmentEnd } from '../domain/recurring';
import { dueMonths, payDate, payEntries, type Payday } from '../domain/payday';
import type {
  Freq,
  Account,
  BillSplit,
  BudgetPlan,
  Category,
  CategoryKind,
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
import type { IndexableType, Table } from 'dexie';
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
  fromSplits?: { splitId: string; amount: number }[];
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
    // only splits of this account, only spending or moving out
    fromSplits:
      draft.kind === 'expense' || draft.kind === 'transfer'
        ? draft.fromSplits?.filter((f) => f.amount > 0 && account?.splits?.some((x) => x.id === f.splitId))
        : undefined,
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

/**
 * Runs `fn` and remembers what it changed, so it can be put back exactly (Undo after a delete).
 * Settings and price caches are left out: they are not the user's records.
 */
export async function recordChanges(fn: () => Promise<void>): Promise<() => Promise<void>> {
  const before: { table: Table; key: IndexableType; value: unknown }[] = [];
  const offs: (() => void)[] = [];
  for (const t of db.tables) {
    if (t.name === 'kv' || t.name === 'prices') continue;
    const onDelete = (key: IndexableType, obj: unknown) => void before.push({ table: t, key, value: structuredClone(obj) });
    const onUpdate = (_mods: object, key: IndexableType, obj: unknown) =>
      void before.push({ table: t, key, value: structuredClone(obj) });
    const onCreate = (key: IndexableType | undefined, obj: Record<string, unknown>) =>
      void before.push({ table: t, key: key ?? (obj[t.schema.primKey.keyPath as string] as IndexableType), value: undefined });
    t.hook('deleting', onDelete);
    t.hook('updating', onUpdate);
    t.hook('creating', onCreate);
    offs.push(() => {
      t.hook('deleting').unsubscribe(onDelete);
      t.hook('updating').unsubscribe(onUpdate);
      t.hook('creating').unsubscribe(onCreate);
    });
  }
  try {
    await fn();
  } finally {
    offs.forEach((off) => off());
  }
  return async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const b of before.slice().reverse()) {
        if (b.value === undefined) await b.table.delete(b.key);
        else await b.table.put(b.value);
      }
    });
  };
}

/** Saves a new order for accounts or categories: `ids` from first to last. */
export async function reorderRows(table: 'accounts' | 'categories', ids: string[]): Promise<void> {
  const t = table === 'accounts' ? db.accounts : db.categories;
  await db.transaction('rw', t, async () => {
    for (let i = 0; i < ids.length; i++) await t.update(ids[i], { order: i });
  });
}

/** Saves the order of the big headings for one person. */
export async function saveGroupOrder(profileId: string, which: 'account' | 'category', order: string[]): Promise<void> {
  await db.profiles.update(profileId, which === 'account' ? { accountGroupOrder: order } : { categoryGroupOrder: order });
}

/** Renames a category group (moving its categories), keeping its place in the order and its limit. */
export async function renameCategoryGroup(profileId: string, kind: CategoryKind, from: string, to: string): Promise<void> {
  const name = to.trim();
  if (!name || name === from) return;
  await db.transaction('rw', db.categories, db.profiles, async () => {
    await db.categories
      .where('profileId')
      .equals(profileId)
      .filter((c) => c.kind === kind && c.group === from)
      .modify({ group: name });
    const p = await db.profiles.get(profileId);
    if (!p) return;
    const order = (p.categoryGroupOrder ?? []).map((g) => (g === from ? name : g)).filter((g, i, a) => a.indexOf(g) === i);
    const limits = { ...(p.groupLimits ?? {}) };
    if (kind === 'expense' && limits[from] !== undefined) {
      limits[name] = limits[from];
      delete limits[from];
    }
    await db.profiles.update(profileId, { categoryGroupOrder: order, groupLimits: limits });
  });
}

/**
 * Removes a category group. Its categories move to `moveTo`, or, with no `moveTo`, are deleted
 * (categories that already have entries are hidden instead, so old entries keep their category).
 */
export async function deleteCategoryGroup(
  profileId: string,
  kind: CategoryKind,
  group: string,
  moveTo: string | null,
): Promise<void> {
  const cats = await db.categories
    .where('profileId')
    .equals(profileId)
    .filter((c) => c.kind === kind && c.group === group)
    .toArray();
  for (const c of cats) {
    if (moveTo) await db.categories.update(c.id, { group: moveTo });
    else if (await categoryInUse(c.id)) await db.categories.update(c.id, { archived: true, group: 'Hidden' });
    else await db.categories.delete(c.id);
  }
  const p = await db.profiles.get(profileId);
  if (p) {
    const limits = { ...(p.groupLimits ?? {}) };
    delete limits[group];
    await db.profiles.update(profileId, {
      categoryGroupOrder: (p.categoryGroupOrder ?? []).filter((g) => g !== group),
      groupLimits: limits,
    });
  }
}

/** Sets or clears (0 / none) the monthly limit of a whole spending group. */
export async function setGroupLimit(profileId: string, group: string, limit: number | null): Promise<void> {
  const p = await db.profiles.get(profileId);
  if (!p) return;
  const limits = { ...(p.groupLimits ?? {}) };
  if (limit && limit > 0) limits[group] = limit;
  else delete limits[group];
  await db.profiles.update(profileId, { groupLimits: limits });
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
  /** an instalment plan: this many monthly payments, then it stops */
  instalments?: number;
}

/**
 * Save a new entry, optionally as the first of a repeating series.
 * An instalment plan is a monthly series that ends after its last payment.
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
    instalments: repeat.instalments,
    endDate: repeat.instalments ? instalmentEnd(draft.date, repeat.instalments) : undefined,
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
 * Record one month's payday: full salary in, deductions out (the account goes up by the take-home pay).
 * Dated `date` (the pay date, or today when "Payday's here" is tapped early). Marks that month as done.
 */
export async function recordPayday(
  profileId: string,
  month: MonthKey,
  date: ISODate,
  rates: RateTable,
  defaultCurrency: string,
  amounts?: { gross: number; takeHome: number },
): Promise<void> {
  const prof = await db.profiles.get(profileId);
  const p = prof?.payday;
  if (!p) return;
  for (const e of payEntries(p, profileId, month, amounts)) {
    if (await db.txs.get(e.id)) continue;
    await saveTx(
      {
        id: e.id,
        profileId,
        date,
        kind: e.kind,
        accountId: e.accountId,
        toAccountId: e.toAccountId,
        amount: e.amount,
        toAmount: e.kind === 'transfer' ? e.amount : undefined,
        categoryId: e.categoryId,
        note: e.note,
      },
      rates,
      defaultCurrency,
    );
  }
  if (!p.paidMonth || p.paidMonth < month) await db.profiles.update(profileId, { payday: { ...p, paidMonth: month } });
}

/** Record every payday that has come (catching up missed months), for every user. */
export async function postDuePaydays(rates: RateTable, defaultCurrency: string, today = todayISO()): Promise<number> {
  let n = 0;
  for (const prof of await db.profiles.toArray()) {
    if (!prof.payday) continue;
    for (const m of dueMonths(prof.payday, today)) {
      await recordPayday(prof.id, m, payDate(prof.payday, m), rates, defaultCurrency);
      n++;
    }
  }
  return n;
}

/** Save (or remove, with undefined) a user's payday. */
export async function savePayday(profileId: string, payday: Payday | undefined): Promise<void> {
  await db.profiles.update(profileId, { payday });
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
