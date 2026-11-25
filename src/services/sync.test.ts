import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { packBackup, unpackBackup } from './sync';
import { summarise } from '../domain/summary';
import type { Category, Tx } from '../domain/types';

describe('family backup packing', () => {
  it('squeezes and splits a big backup, and gets it back exactly', async () => {
    const json = JSON.stringify({
      rows: Array.from({ length: 30000 }, (_, i) => ({ id: `tx${i}`, note: 'Coffee beans and a croissant', amount: i * 1.25 })),
    });
    const parts = await packBackup(json);
    expect(parts.join('').length).toBeLessThan(json.length / 3);
    expect(await unpackBackup(parts)).toBe(json);
  });
});

describe('entries from other phones', () => {
  it('count in the shared balance but not in this phone’s income and spending', () => {
    const cat: Category = {
      id: 'food',
      profileId: 'p',
      kind: 'expense',
      name: 'Food',
      group: 'Eating Out',
      order: 0,
      archived: false,
    };
    const t = (x: Partial<Tx>): Tx => ({
      id: String(Math.random()),
      profileId: 'p',
      date: '2026-11-20',
      kind: 'expense',
      accountId: 'joint',
      amount: 300,
      categoryId: 'food',
      value: 300,
      valueCurrency: 'THB',
      createdAt: 1,
      updatedAt: 1,
      ...x,
    });
    const mine = t({});
    const theirs = t({ amount: 500, value: 500, remoteAuthor: { id: 'q', name: 'Qiqi phone' } });
    const s = summarise([mine, theirs], [cat], '2026-11-01', '2026-11-30', 'THB', { perUsd: { USD: 1, THB: 33 } });
    expect(s.expense.total).toBe(300);
  });
});
