// Reading and writing app data.
import { todayISO, type ISODate, type MonthKey } from '../domain/dates';
import { unitValue, balanceOf, walletsByAccount } from '../domain/balances';
import type { RateTable } from '../domain/fx';
import { dueToPost, instalmentEnd, lastInstalment } from '../domain/recurring';
import { dueMonths, payDate, payEntries, type Payday } from '../domain/payday';
import type {
  Freq,
  Account,
  BillSplit,
  BudgetPlan,
  Category,
  CategoryKind,
  LimitPeriod,
  PriceCache,
  Recurring,
  Settings,
  Trip,
  Tx,
  TxKind,
} from '../domain/types';
import {
  convert,
  FALLBACK_BTC_THB,
  FALLBACK_GOLD_BUY_THB,
  FALLBACK_GOLD_SELL_THB,
  FALLBACK_PER_USD,
  withBtc,
} from '../domain/fx';
import { decimalsFor, roundTo } from '../domain/money';
import { paybackFor, type Debt } from '../domain/debts';
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
  /** the account's wallet when not its main one (cash and top-up cards holding several currencies) */
  pocket?: string;
  /** transfer: the destination account's wallet when not its main one */
  toPocket?: string;
  /** a move's fee: the move this spending belongs to */
  feeFor?: string;
  /** money back (negative spending): the spending it came back for */
  refundOf?: string;
}

/** A wallet that is the account's main currency is stored as no wallet. */
function walletOf(account: Account | undefined, pocket: string | undefined): string | undefined {
  return pocket && account && pocket !== account.currency ? pocket : undefined;
}

/** Stamp the entry with its value in the default currency at today's rates. */
export function stampValue(draft: TxDraft, account: Account | undefined, rates: RateTable, defaultCurrency: string) {
  const pocket = walletOf(account, draft.pocket);
  if (pocket) {
    const v = convert(draft.amount, pocket, defaultCurrency, rates);
    return v === null ? { value: draft.amount, valueCurrency: pocket } : { value: v, valueCurrency: defaultCurrency };
  }
  const per = account ? unitValue(account, rates, defaultCurrency) : null;
  if (per === null || !account) {
    return { value: draft.amount, valueCurrency: account?.currency ?? defaultCurrency };
  }
  return { value: draft.amount * per, valueCurrency: defaultCurrency };
}

/**
 * Rates as they were on `date`: the day's saved prices (or the last ones before it) for past days, otherwise the
 * rates given (today's). So an entry for an earlier day is valued at that day's rate.
 */
export async function ratesOn(date: ISODate, current: RateTable): Promise<RateTable> {
  if (date >= todayISO()) return current;
  const snap = await db.prices.where('date').belowOrEqual(date).last();
  return snap ? withBtc(snap.perUsd, snap.btcThb ?? null, 'THB', snap.goldThb ?? null) : current;
}

export async function saveTx(draft: TxDraft, rates: RateTable, defaultCurrency: string): Promise<string> {
  const account = await db.accounts.get(draft.accountId);
  const now = Date.now();
  const existing = draft.id ? await db.txs.get(draft.id) : undefined;
  // an edit keeps the value it was given on the day: the same amount keeps it exactly, a new amount keeps its rate;
  // only a different account, wallet or kind is valued again (at the entry's own date)
  const sameMoney =
    !!existing &&
    existing.accountId === draft.accountId &&
    (existing.pocket || undefined) === walletOf(account, draft.pocket) &&
    existing.kind === draft.kind &&
    existing.amount !== 0;
  const { value, valueCurrency } = sameMoney
    ? {
        value: existing!.amount === draft.amount ? existing!.value : (existing!.value * draft.amount) / existing!.amount,
        valueCurrency: existing!.valueCurrency,
      }
    : stampValue(draft, account, await ratesOn(draft.date, rates), defaultCurrency);
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
    pocket: walletOf(account, draft.pocket),
    toPocket:
      draft.kind === 'transfer' && draft.toPocket
        ? walletOf(
            draft.toAccountId === draft.accountId ? account : await db.accounts.get(draft.toAccountId ?? ''),
            draft.toPocket,
          )
        : undefined,
    feeFor: draft.feeFor ?? existing?.feeFor,
    refundOf: draft.kind === 'expense' && draft.amount < 0 ? (draft.refundOf ?? existing?.refundOf) : undefined,
    // an entry from another phone stays theirs (it is never changed here)
    remoteAuthor: existing?.remoteAuthor,
    remoteNames: existing?.remoteNames,
    categoryName: existing?.categoryName,
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

/** Deletes an entry, and a move's fee with it. */
export async function deleteTx(id: string): Promise<void> {
  await db.transaction('rw', db.txs, async () => {
    // fees are few: found by looking (no index needed)
    await db.txs.filter((t) => t.feeFor === id).delete();
    await db.txs.delete(id);
  });
}

/** The user's hidden "Move fee" category (made the first time a fee is saved). */
export async function moveFeeCategory(profileId: string): Promise<string> {
  const found = await db.categories
    .where('profileId')
    .equals(profileId)
    .filter((c) => c.system === 'moveFee')
    .first();
  if (found) return found.id;
  const count = await db.categories.where('profileId').equals(profileId).count();
  const c: Category = {
    id: `movefee-${profileId}`,
    profileId,
    kind: 'expense',
    name: 'Move fee',
    group: 'Fees',
    emoji: '🏦',
    order: count,
    archived: false,
    system: 'moveFee',
  };
  await db.categories.put(c);
  return c.id;
}

/** One-time tidy-up: fees saved before the Move fee category go into it. */
export async function moveFeesIntoTheirCategory(): Promise<number> {
  const fees = await db.txs.filter((t) => !!t.feeFor).toArray();
  let n = 0;
  for (const t of fees) {
    const cat = await moveFeeCategory(t.profileId);
    if (t.categoryId !== cat) {
      await db.txs.update(t.id, { categoryId: cat });
      n++;
    }
  }
  return n;
}

/**
 * A move's fee, as a spending entry from the same account and wallet, linked to the move, in the hidden Move fee
 * category. A fee of 0 removes it.
 */
export async function saveMoveFee(
  move: { id: string; profileId: string; date: string; accountId: string; pocket?: string; note?: string },
  fee: number,
  rates: RateTable,
  defaultCurrency: string,
): Promise<void> {
  const existing = await db.txs.filter((t) => t.feeFor === move.id).first();
  if (!(fee > 0)) {
    if (existing) await db.txs.delete(existing.id);
    return;
  }
  const categoryId = await moveFeeCategory(move.profileId);
  await saveTx(
    {
      id: existing?.id,
      profileId: move.profileId,
      date: move.date,
      kind: 'expense',
      accountId: move.accountId,
      pocket: move.pocket,
      amount: fee,
      categoryId,
      note: move.note ? `Fee: ${move.note}` : 'Fee',
      feeFor: move.id,
    },
    rates,
    defaultCurrency,
  );
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
  /** one of the account's other wallets (none = the main one) */
  pocket?: string;
}): Promise<void> {
  const { account } = opts;
  const pocket = walletOf(account, opts.pocket);
  const txs = await db.txs.where('accountId').equals(account.id).toArray();
  const incoming = await db.txs.where('toAccountId').equals(account.id).toArray();
  const all = [...txs, ...incoming.filter((t) => t.accountId !== account.id)];
  // entries dated after the chosen day haven't happened yet, so they don't count
  const current = pocket
    ? (walletsByAccount([account], all, opts.date).get(account.id)?.get(pocket) ?? 0)
    : balanceOf(account, all, opts.date);
  const delta = opts.newBalance - current;
  if (Math.abs(delta) < 1e-12) return;
  // other wallets have no starting balance of their own: their changes are always entries
  if (opts.mode === 'opening' && !pocket) {
    await db.accounts.update(account.id, { openingBalance: account.openingBalance + delta });
    return;
  }
  if (opts.mode === 'adjust' || opts.mode === 'opening') {
    await saveTx(
      {
        profileId: account.profileId,
        date: opts.date,
        kind: 'adjust',
        accountId: account.id,
        pocket,
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
      pocket,
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
/** Deletes an account with every entry and repeating entry that uses it (and the fees of moves deleted with it). */
export async function deleteAccountCascade(accountId: string): Promise<void> {
  await db.transaction('rw', [db.accounts, db.txs, db.recurring], async () => {
    const gone = new Set([
      ...(await db.txs.where('accountId').equals(accountId).primaryKeys()),
      ...(await db.txs.where('toAccountId').equals(accountId).primaryKeys()),
    ]);
    await db.txs.filter((t) => !!t.feeFor && gone.has(t.feeFor)).delete();
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
    const periods = { ...(p.groupLimitPeriods ?? {}) };
    if (kind === 'expense' && limits[from] !== undefined) {
      limits[name] = limits[from];
      delete limits[from];
    }
    if (kind === 'expense' && periods[from] !== undefined) {
      periods[name] = periods[from];
      delete periods[from];
    }
    await db.profiles.update(profileId, { categoryGroupOrder: order, groupLimits: limits, groupLimitPeriods: periods });
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
    const periods = { ...(p.groupLimitPeriods ?? {}) };
    delete limits[group];
    delete periods[group];
    await db.profiles.update(profileId, {
      categoryGroupOrder: (p.categoryGroupOrder ?? []).filter((g) => g !== group),
      groupLimits: limits,
      groupLimitPeriods: periods,
    });
  }
}

/** Saves the user's own list of account groups (order kept as given). */
export async function saveAccountGroups(profileId: string, groups: string[]): Promise<void> {
  await db.profiles.update(profileId, { accountGroups: groups.filter((g, i, a) => g.trim() && a.indexOf(g) === i) });
}

/** Renames an account group: in the user's list, its place in the order, and on every account in it. */
export async function renameAccountGroup(profileId: string, from: string, to: string, current: string[]): Promise<void> {
  await db.transaction('rw', [db.accounts, db.profiles], async () => {
    await db.accounts
      .where('profileId')
      .equals(profileId)
      .filter((a) => a.group === from)
      .modify({ group: to });
    const p = await db.profiles.get(profileId);
    const swap = (list: string[]) => list.map((g) => (g === from ? to : g)).filter((g, i, a) => a.indexOf(g) === i);
    await db.profiles.update(profileId, { accountGroups: swap(current), accountGroupOrder: swap(p?.accountGroupOrder ?? []) });
  });
}

/** Sets or clears (0 / none) the limit of a whole spending group, per month (default), quarter or year. */
export async function setGroupLimit(
  profileId: string,
  group: string,
  limit: number | null,
  period: LimitPeriod = 'month',
): Promise<void> {
  const p = await db.profiles.get(profileId);
  if (!p) return;
  const limits = { ...(p.groupLimits ?? {}) };
  const periods = { ...(p.groupLimitPeriods ?? {}) };
  if (limit && limit > 0) {
    limits[group] = limit;
    if (period === 'month') delete periods[group];
    else periods[group] = period;
  } else {
    delete limits[group];
    delete periods[group];
  }
  await db.profiles.update(profileId, { groupLimits: limits, groupLimitPeriods: periods });
}

export async function categoryInUse(id: string): Promise<boolean> {
  const n = await db.txs.filter((t) => t.categoryId === id).count();
  const r = await db.recurring.filter((x) => x.categoryId === id).count();
  // payday's categories are in use too (its entries would lose their category)
  const pay = (await db.profiles.toArray()).some(
    (p) =>
      !!p.payday &&
      (p.payday.incomeCategoryId === id || p.payday.deductCategoryId === id || p.payday.extras.some((e) => e.categoryId === id)),
  );
  return n + r > 0 || pay;
}

/** Payday stops when an account it uses is deleted or removed (it never records into a missing account). */
export async function pausePaydaysUsing(accountId: string): Promise<number> {
  let n = 0;
  for (const p of await db.profiles.toArray()) {
    const pd = p.payday;
    if (!pd || !pd.active) continue;
    if (pd.accountId === accountId || pd.extras.some((e) => e.toAccountId === accountId)) {
      await db.profiles.update(p.id, { payday: { ...pd, active: false } });
      n++;
    }
  }
  return n;
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
  /** its full price (the last payment takes up the rounding) */
  instalmentTotal?: number;
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
    instalmentTotal: repeat.instalments ? repeat.instalmentTotal : undefined,
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
  const dayRates = await ratesOn(date, rates);
  for (const e of payEntries(p, profileId, month, amounts)) {
    if (await db.txs.get(e.id)) continue;
    // a line moved into an account in another currency arrives converted at that day's rate
    let toAmount = e.amount;
    if (e.kind === 'transfer' && e.toAccountId) {
      const [from, to] = [await db.accounts.get(e.accountId), await db.accounts.get(e.toAccountId)];
      if (from && to && from.currency !== to.currency) {
        const v = convert(e.amount, from.currency, to.currency, dayRates);
        if (v !== null) toAmount = roundTo(v, decimalsFor(to.currency));
      }
    }
    await saveTx(
      {
        id: e.id,
        profileId,
        date,
        kind: e.kind,
        accountId: e.accountId,
        toAccountId: e.toAccountId,
        amount: e.amount,
        toAmount: e.kind === 'transfer' ? toAmount : undefined,
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
    // never into an account that is gone or removed
    const used = [prof.payday.accountId, ...prof.payday.extras.map((e) => e.toAccountId).filter((x): x is string => !!x)];
    const accs = await db.accounts.bulkGet(used);
    if (accs.some((a) => !a || a.removed)) continue;
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
        // an instalment plan's last payment takes up the rounding
        amount: r.instalments && r.endDate === date ? lastInstalment(r) : r.amount,
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
  /** I paid it as part of my logged spending: their payback is money back on this category (and spending) */
  spentCategoryId?: string;
  spentTxId?: string;
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
    const event = {
      id: it.key,
      date: it.date,
      type: 'lend' as const,
      amount: it.amount,
      // a friend's share of a bill or trip: "Alex payback for Xiamen trip"
      note: it.direction === 'owedToMe' && /^(bill|trip):/.test(it.key) ? paybackFor(it.person, it.note) : it.note,
      spentCategoryId: it.spentCategoryId,
      spentTxId: it.spentTxId,
    };
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
  // the phone stays in its family (leaving is done in Family sharing)
  // (and what it has already sent, so its old entries on shared accounts don't come back)
  const link = await db.kv.get('syncLink');
  const sent = await db.kv.get('syncState');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
    if (link) await db.kv.put(link);
    if (sent) await db.kv.put(sent);
  });
}

// ---------- changing an account's currency ----------

/**
 * Change an account's currency when it already has entries: every amount kept in its currency (starting balance,
 * its side of each entry, repeating entries, splits, capital, linked saving targets) is multiplied by `rate`
 * (1 old = rate new). The other side of moves and the values stamped in the main currency stay as they were, so
 * other accounts and past months don't change. A safety copy is saved first.
 */
export async function changeAccountCurrency(accountId: string, currency: string, rate: number): Promise<void> {
  const { saveSafetyCopy } = await import('../services/safety');
  await saveSafetyCopy('currency');
  const a = await db.accounts.get(accountId);
  if (!a || !(rate > 0)) return;
  // the other phones hold its entries in the old currency: stop sharing it first
  if (a.shared) throw new Error('This account is shared. Stop sharing it first, change the currency, then share it again.');
  const old = a.currency;
  const x = (n: number) => n * rate;
  await db.transaction('rw', [db.accounts, db.txs, db.recurring, db.goals], async () => {
    await db.accounts.put({
      ...a,
      currency,
      openingBalance: x(a.openingBalance),
      costBasis: a.costBasis,
      capital: a.capital ? { ...a.capital, amount: x(a.capital.amount) } : undefined,
      creditLimit: a.creditLimit !== undefined ? x(a.creditLimit) : undefined,
      splits: a.splits?.map((sp) => ({
        ...sp,
        base: x(sp.base),
        added: sp.added ? Object.fromEntries(Object.entries(sp.added).map(([k, v]) => [k, x(v)])) : undefined,
      })),
    });
    const txs = await db.txs.filter((t) => t.accountId === accountId || t.toAccountId === accountId).toArray();
    for (const t of txs) {
      const next = { ...t };
      const self = t.accountId === accountId && t.toAccountId === accountId;
      if (t.accountId === accountId && !t.pocket) {
        // a move out keeps what arrived on the other side
        if (t.kind === 'transfer' && !self && t.toAmount === undefined) next.toAmount = t.amount;
        next.amount = x(t.amount);
        next.fromSplits = t.fromSplits?.map((f) => ({ ...f, amount: x(f.amount) }));
        if (t.origCurrency === currency) {
          next.origAmount = undefined;
          next.origCurrency = undefined;
        }
      }
      if (t.toAccountId === accountId && !t.toPocket && t.kind === 'transfer') {
        next.toAmount = x(t.toAmount ?? t.amount);
      }
      await db.txs.put(next);
    }
    const recs = await db.recurring.filter((r) => r.accountId === accountId || r.toAccountId === accountId).toArray();
    for (const r of recs) {
      const next = { ...r };
      if (r.accountId === accountId) {
        if (r.kind === 'transfer' && r.toAmount === undefined && r.toAccountId !== accountId) next.toAmount = r.amount;
        next.amount = x(r.amount);
        if (r.instalmentTotal !== undefined) next.instalmentTotal = x(r.instalmentTotal);
      } else if (r.toAccountId === accountId) next.toAmount = x(r.toAmount ?? r.amount);
      await db.recurring.put(next);
    }
    const goals = await db.goals.filter((g) => g.accountId === accountId && g.currency === old).toArray();
    for (const g of goals)
      await db.goals.put({
        ...g,
        currency,
        price: x(g.price),
        saved: x(g.saved),
        monthly: x(g.monthly),
        lowered: g.lowered ? { ...g.lowered, from: x(g.lowered.from) } : undefined,
      });
  });
}
