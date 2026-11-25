import { describe, expect, it } from 'vitest';
import { investmentStatus } from './investments';
import type { Account, Category, Tx } from './types';

const fund = {
  id: 'f',
  profileId: 'p',
  name: 'S&P500',
  type: 'investment',
  currency: 'THB',
  group: 'Investments',
  openingBalance: 100000,
  openingDate: '2026-01-01',
  order: 0,
  archived: false,
} as Account;
let n = 0;
const t = (x: Partial<Tx>): Tx => ({
  id: String(++n),
  profileId: 'p',
  date: '2026-02-01',
  kind: 'transfer',
  accountId: 'bank',
  amount: 0,
  value: 0,
  valueCurrency: 'THB',
  createdAt: n,
  updatedAt: n,
  ...x,
});
const cats = new Map<string, Category>([
  ['div', { id: 'div', profileId: 'p', kind: 'income', name: 'Investing Dividend', group: 'Income', order: 0, archived: false }],
]);

describe('investment capital and value', () => {
  it('money moved out takes capital out in the same share as value', () => {
    // capital 100,000; the market lifts it to 150,000; then 30,000 (20%) moves out
    const txs = [
      t({ kind: 'adjust', accountId: 'f', amount: 50000, date: '2026-03-01' }),
      t({ accountId: 'f', toAccountId: 'bank', amount: 30000, toAmount: 30000, date: '2026-04-01' }),
    ];
    const s = investmentStatus(fund, txs, cats);
    expect(s.value).toBe(120000);
    expect(s.capital).toBeCloseTo(80000);
    expect(s.takenOut).toBeCloseTo(10000);
    expect(s.profitPct).toBeCloseTo(0.5);
    expect(s.updated).toBe('2026-03-01');
  });
  it('money in adds to both; dividends add to value only', () => {
    const txs = [
      t({ toAccountId: 'f', amount: 20000, toAmount: 20000 }),
      t({ kind: 'income', accountId: 'f', amount: 1500, categoryId: 'div' }),
    ];
    const s = investmentStatus(fund, txs, cats);
    expect(s.capital).toBe(120000);
    expect(s.value).toBe(121500);
  });
  it('a typed capital covers what was there; later money adds to it', () => {
    const before = t({ toAccountId: 'f', amount: 5000, toAmount: 5000, createdAt: 10 });
    const after = t({ toAccountId: 'f', amount: 7000, toAmount: 7000, createdAt: 30 });
    const s = investmentStatus({ ...fund, capital: { amount: 90000, setAt: 20 } }, [before, after], cats);
    expect(s.capital).toBe(97000);
    expect(s.value).toBe(112000);
  });
});
