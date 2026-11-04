import { describe, expect, it } from 'vitest';
import { limitLines } from './limits';
import { summarise } from './summary';
import type { Category, Tx } from './types';

const cat = (id: string, name: string, group: string, limit?: number): Category => ({
  id,
  profileId: 'p',
  kind: 'expense',
  name,
  group,
  order: 0,
  archived: false,
  limit,
});
let n = 0;
const spend = (categoryId: string, amount: number, date = '2026-11-03'): Tx => ({
  id: String(n++),
  profileId: 'p',
  date,
  kind: 'expense',
  accountId: 'a',
  amount,
  categoryId,
  value: amount,
  valueCurrency: 'THB',
  createdAt: n,
  updatedAt: n,
});

describe('monthly limits', () => {
  const cats = [cat('lunch', 'Lunch', 'Eating Out', 3000), cat('coffee', 'Coffee', 'Eating Out'), cat('games', 'Games', 'Fun')];
  const txs = [spend('lunch', 2500), spend('coffee', 900), spend('games', 100)];
  const s = summarise(txs, cats, '2026-11-01', '2026-11-30', 'THB', { perUsd: { USD: 1, THB: 33 } });
  it('shows nothing until a limit is set', () => {
    const none = cats.map((c) => ({ ...c, limit: undefined }));
    expect(limitLines(s, none, undefined, '2026-11-11', '2026-11-30')).toEqual([]);
  });
  it('category and group limits: left, amber from 80 %, red when over, and per day', () => {
    const lines = limitLines(s, cats, { 'Eating Out': 3000 }, '2026-11-11', '2026-11-30');
    const group = lines.find((l) => l.key === 'g:Eating Out')!;
    expect(group.spent).toBe(3400);
    expect(group.left).toBe(-400);
    expect(group.level).toBe('over');
    expect(group.perDay).toBeNull();
    const lunch = lines.find((l) => l.key === 'c:lunch')!;
    expect(lunch.left).toBe(500);
    expect(lunch.level).toBe('warn');
    // 11 to 30 November = 20 days, today included
    expect(lunch.daysLeft).toBe(20);
    expect(lunch.perDay).toBe(25);
  });
});
