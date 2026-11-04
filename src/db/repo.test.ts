// Saving and scheduling entries against a real (in-memory) database.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { postDueRecurring, postOccurrence, recordOwed, saveNewEntry, setAccountBalance, type TxDraft } from './repo';
import { balanceOf } from '../domain/balances';
import type { Account } from '../domain/types';

const rates = { perUsd: { USD: 1, THB: 33.74 } };
const bank: Account = {
  id: 'bank',
  profileId: 'u1',
  name: 'Bank',
  type: 'bank',
  group: 'Bank',
  currency: 'THB',
  openingBalance: 1000,
  openingDate: '2026-11-01',
  includeInNetWorth: true,
  archived: false,
  order: 0,
};
const draft = (date: string): TxDraft => ({
  profileId: 'u1',
  date,
  kind: 'expense',
  accountId: 'bank',
  amount: 209,
  categoryId: 'subs',
  note: 'Spotify',
});
const monthly = { name: 'Spotify', freq: 'month' as const, every: 1, autoPost: true, reserve: true };

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.accounts.put(bank);
});

describe('repeating entries that start in the future', () => {
  it('are only scheduled: nothing is recorded before the first day', async () => {
    const outcome = await saveNewEntry(draft('2026-11-20'), monthly, rates, 'THB', '2026-11-03');
    expect(outcome).toBe('scheduled');
    expect(await db.txs.count()).toBe(0);
    const [r] = await db.recurring.toArray();
    expect(r.startDate).toBe('2026-11-20');
    expect(r.lastPosted).toBeUndefined();
    // the app opening before the day records nothing
    expect(await postDueRecurring(rates, 'THB', '2026-11-19')).toBe(0);
    expect(await db.txs.count()).toBe(0);
  });

  it('are recorded automatically on the day, once', async () => {
    await saveNewEntry(draft('2026-11-20'), monthly, rates, 'THB', '2026-11-03');
    expect(await postDueRecurring(rates, 'THB', '2026-11-20')).toBe(1);
    expect(await postDueRecurring(rates, 'THB', '2026-11-20')).toBe(0);
    const txs = await db.txs.toArray();
    expect(txs.map((t) => t.date)).toEqual(['2026-11-20']);
  });

  it('starting today records the first one now and the next on its day', async () => {
    expect(await saveNewEntry(draft('2026-11-03'), monthly, rates, 'THB', '2026-11-03')).toBe('saved');
    expect(await db.txs.count()).toBe(1);
    expect((await db.recurring.toArray())[0].lastPosted).toBe('2026-11-03');
    expect(await postDueRecurring(rates, 'THB', '2026-12-02')).toBe(0);
    expect(await postDueRecurring(rates, 'THB', '2026-12-03')).toBe(1);
  });

  it('"Record now" on a future payment records it today and not again on the day', async () => {
    await saveNewEntry(draft('2026-11-20'), monthly, rates, 'THB', '2026-11-03');
    const [r] = await db.recurring.toArray();
    await postOccurrence(r, '2026-11-20', rates, 'THB', '2026-11-03');
    expect((await db.txs.toArray()).map((t) => t.date)).toEqual(['2026-11-03']);
    expect(await postDueRecurring(rates, 'THB', '2026-11-20')).toBe(0);
    expect(await db.txs.count()).toBe(1);
  });

  it('a plain entry is saved as it is', async () => {
    expect(await saveNewEntry(draft('2026-11-25'), null, rates, 'THB', '2026-11-03')).toBe('saved');
    expect(await db.txs.count()).toBe(1);
  });
});

describe('set new balance', () => {
  it('ignores entries dated after the chosen day', async () => {
    await saveNewEntry(draft('2026-11-25'), null, rates, 'THB', '2026-11-03');
    // the bank shows 1,100 today; the future 209 hasn't happened yet
    await setAccountBalance({
      account: bank,
      newBalance: 1100,
      mode: 'adjust',
      date: '2026-11-03',
      rates,
      defaultCurrency: 'THB',
    });
    const txs = await db.txs.toArray();
    expect(balanceOf(bank, txs, '2026-11-03')).toBe(1100);
  });
});

describe('adding unpaid bill shares to Who owes me', () => {
  const item = (person: string, amount: number, key = `bill:1:${person}`) => ({
    person,
    direction: 'owedToMe' as const,
    amount,
    currency: 'THB',
    date: '2026-11-03',
    note: 'Dinner',
    key,
  });
  it('creates one record per friend and never doubles when added again', async () => {
    expect(await recordOwed('u1', [item('Ann', 300), item('Ben', 450)])).toBe(2);
    await recordOwed('u1', [item('Ann', 320), item('Ben', 450)]);
    const debts = await db.debts.toArray();
    expect(debts).toHaveLength(2);
    const ann = debts.find((d) => d.person === 'Ann')!;
    expect(ann.events).toHaveLength(1);
    expect(ann.events[0].amount).toBe(320);
  });
  it('adds a new bill to the same open record for that friend', async () => {
    await recordOwed('u1', [item('Ann', 300, 'bill:1:Ann')]);
    await recordOwed('u1', [item('ann', 200, 'bill:2:Ann')]);
    const debts = await db.debts.toArray();
    expect(debts).toHaveLength(1);
    expect(debts[0].events.map((e) => e.amount)).toEqual([300, 200]);
  });
});

describe('cash gets its own group', () => {
  it('moves cash out of Bank once, and leaves bank accounts alone', async () => {
    const { migrate } = await import('./seed');
    const base = {
      profileId: 'p',
      currency: 'THB',
      openingBalance: 0,
      openingDate: '2026-11-01',
      includeInNetWorth: true,
      archived: false,
      order: 0,
    };
    await db.kv.delete('migratedCashGroup');
    await db.accounts.bulkPut([
      { ...base, id: 'm1', name: 'Cash', type: 'bank', group: 'Bank' },
      { ...base, id: 'm2', name: 'Wallet', type: 'cash', group: 'Bank' },
      { ...base, id: 'm3', name: 'Kbank', type: 'bank', group: 'Bank' },
    ] as Account[]);
    await migrate();
    expect((await db.accounts.bulkGet(['m1', 'm2', 'm3'])).map((a) => a!.group)).toEqual(['Cash', 'Cash', 'Bank']);
    // a later move back to Bank by the user is kept
    await db.accounts.update('m2', { group: 'Bank' });
    await migrate();
    expect((await db.accounts.get('m2'))!.group).toBe('Bank');
  });
});

describe('undo after deleting', () => {
  it('puts back an account with all its entries and repeating entries exactly', async () => {
    const { recordChanges, deleteAccountCascade } = await import('./repo');
    const base = {
      profileId: 'p',
      currency: 'THB',
      openingBalance: 100,
      openingDate: '2026-11-01',
      includeInNetWorth: true,
      archived: false,
      order: 0,
    };
    await db.accounts.put({ ...base, id: 'u1', name: 'Undo me', type: 'bank', group: 'Bank' } as Account);
    await db.txs.bulkPut(
      [1, 2, 3].map((i) => ({
        id: `ut${i}`,
        profileId: 'p',
        date: '2026-11-02',
        kind: 'expense' as const,
        accountId: 'u1',
        amount: i,
        value: i,
        valueCurrency: 'THB',
        createdAt: i,
        updatedAt: i,
      })),
    );
    await db.recurring.put({
      id: 'ur',
      profileId: 'p',
      name: 'Gym',
      kind: 'expense',
      amount: 9,
      accountId: 'u1',
      freq: 'month',
      every: 1,
      startDate: '2026-11-01',
      autoPost: true,
      reserve: false,
      active: true,
      createdAt: 1,
    });
    const before = JSON.stringify([
      await db.accounts.get('u1'),
      await db.txs.where('accountId').equals('u1').sortBy('id'),
      await db.recurring.get('ur'),
    ]);
    const undo = await recordChanges(() => deleteAccountCascade('u1'));
    expect(await db.accounts.get('u1')).toBeUndefined();
    expect(await db.txs.where('accountId').equals('u1').count()).toBe(0);
    await undo();
    const after = JSON.stringify([
      await db.accounts.get('u1'),
      await db.txs.where('accountId').equals('u1').sortBy('id'),
      await db.recurring.get('ur'),
    ]);
    expect(after).toBe(before);
  });
  it('undoes changes too, and removes anything the action created', async () => {
    const { recordChanges } = await import('./repo');
    await db.debts.put({ id: 'ud', profileId: 'p', person: 'Ann' } as never);
    const undo = await recordChanges(async () => {
      await db.debts.update('ud', { person: 'Changed' });
      await db.debts.put({ id: 'ud2', profileId: 'p', person: 'New' } as never);
    });
    await undo();
    expect((await db.debts.get('ud'))?.person).toBe('Ann');
    expect(await db.debts.get('ud2')).toBeUndefined();
  });
});

describe('category groups', () => {
  it('rename keeps the place and the limit; delete moves categories or removes unused ones', async () => {
    const { renameCategoryGroup, deleteCategoryGroup } = await import('./repo');
    await db.profiles.put({ id: 'gp', name: 'G', order: 0, categoryGroupOrder: ['Fixed', 'Fun'], groupLimits: { Fun: 500 } });
    const c = (id: string, group: string, kind: 'income' | 'expense' = 'expense') =>
      ({ id, profileId: 'gp', kind, name: id, group, order: 0, archived: false }) as const;
    await db.categories.bulkPut([c('g1', 'Fun'), c('g2', 'Fun'), c('g3', 'Fixed'), c('g4', 'Side jobs', 'income')]);
    await db.txs.put({
      id: 'gt',
      profileId: 'gp',
      date: '2026-11-01',
      kind: 'expense',
      accountId: 'a',
      amount: 1,
      categoryId: 'g2',
      value: 1,
      valueCurrency: 'THB',
      createdAt: 1,
      updatedAt: 1,
    });
    await renameCategoryGroup('gp', 'expense', 'Fun', 'Hobbies');
    expect((await db.categories.bulkGet(['g1', 'g2'])).map((x) => x!.group)).toEqual(['Hobbies', 'Hobbies']);
    let p = await db.profiles.get('gp');
    expect(p!.categoryGroupOrder).toEqual(['Fixed', 'Hobbies']);
    expect(p!.groupLimits).toEqual({ Hobbies: 500 });
    // income groups work the same way
    await renameCategoryGroup('gp', 'income', 'Side jobs', 'Extra');
    expect((await db.categories.get('g4'))!.group).toBe('Extra');
    // delete without moving: unused category goes, used one is hidden
    await deleteCategoryGroup('gp', 'expense', 'Hobbies', null);
    expect(await db.categories.get('g1')).toBeUndefined();
    expect((await db.categories.get('g2'))!.archived).toBe(true);
    p = await db.profiles.get('gp');
    expect(p!.groupLimits).toEqual({});
    // delete with moving
    await deleteCategoryGroup('gp', 'expense', 'Fixed', 'Other');
    expect((await db.categories.get('g3'))!.group).toBe('Other');
  });
});
