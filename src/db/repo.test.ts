// Saving and scheduling entries against a real (in-memory) database.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { postDueRecurring, saveNewEntry, setAccountBalance, type TxDraft } from './repo';
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
