import { describe, expect, it } from 'vitest';
import { limitLines, plannedSpending } from './limits';
import { summarise } from './summary';
import type { Account, Category, Recurring, Tx } from './types';

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

describe('limits count spending still to come this month', () => {
  const rates = { perUsd: { USD: 1, THB: 33 } };
  const cats = [cat('transport', 'Transportation', 'Discretionary', 6000), cat('gym', 'Workout', 'Discretionary')];
  const acc = (id: string, currency = 'THB') => ({ id, currency }) as Account;
  const rec = (x: Partial<Recurring>): Recurring => ({
    id: 'r',
    profileId: 'p',
    name: 'Parking fees',
    kind: 'expense',
    amount: 2500,
    accountId: 'bank',
    categoryId: 'transport',
    freq: 'month',
    every: 1,
    startDate: '2026-10-28',
    lastPosted: '2026-10-28',
    autoPost: true,
    reserve: true,
    active: true,
    createdAt: 1,
    ...x,
  });
  const spent = summarise([spend('transport', 1877, '2026-11-12')], cats, '2026-11-01', '2026-11-30', 'THB', rates);

  it('a monthly payment later this month, from any account, counts as coming up', () => {
    const planned = plannedSpending([rec({})], [], [acc('bank')], '2026-11-01', '2026-11-30', 'THB', rates);
    expect(planned.get('transport')).toBe(2500);
    const line = limitLines(spent, cats, undefined, '2026-11-12', '2026-11-30', planned).find((l) => l.key === 'c:transport')!;
    expect(line.spent).toBe(1877);
    expect(line.planned).toBe(2500);
    expect(line.left).toBe(1623);
    // 12 to 30 November = 19 days
    expect(line.perDay).toBeCloseTo(1623 / 19, 6);
  });
  it('once recorded it is spending, not counted twice; next month is not counted', () => {
    const planned = plannedSpending(
      [rec({ lastPosted: '2026-11-28' })],
      [],
      [acc('bank')],
      '2026-11-01',
      '2026-11-30',
      'THB',
      rates,
    );
    expect(planned.get('transport')).toBeUndefined();
  });
  it('weekly payments count every time left in the month; other currencies are converted; future entries count', () => {
    const weekly = rec({ id: 'w', freq: 'week', startDate: '2026-11-02', lastPosted: '2026-11-09', amount: 100 });
    const usd = rec({ id: 'u', accountId: 'usd', categoryId: 'gym', startDate: '2026-11-20', lastPosted: undefined, amount: 10 });
    const later = { ...spend('transport', 300, '2026-11-25') };
    const planned = plannedSpending(
      [weekly, usd],
      [later],
      [acc('bank'), acc('usd', 'USD')],
      '2026-11-01',
      '2026-11-30',
      'THB',
      rates,
    );
    // 16, 23 and 30 November, plus the entry dated 25 November
    expect(planned.get('transport')).toBe(600);
    expect(planned.get('gym')).toBe(330);
  });
  it('paused repeating entries and income do not count', () => {
    const planned = plannedSpending(
      [rec({ active: false }), rec({ id: 'i', kind: 'income' })],
      [],
      [acc('bank')],
      '2026-11-01',
      '2026-11-30',
      'THB',
      rates,
    );
    expect(planned.size).toBe(0);
  });
});
