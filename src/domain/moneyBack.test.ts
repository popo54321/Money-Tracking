import { describe, expect, it } from 'vitest';
import { isMoneyBack, moneyBackOn, txDelta } from './balances';
import type { Tx } from './types';

const t = (x: Partial<Tx>): Tx => ({
  id: 'x',
  profileId: 'p',
  date: '2026-12-01',
  kind: 'expense',
  accountId: 'a',
  amount: 0,
  value: 0,
  valueCurrency: 'THB',
  createdAt: 0,
  updatedAt: 0,
  ...x,
});
const cur = (id: string) => ({ a: 'THB', b: 'THB', u: 'USD' })[id];

describe('money back on a spending', () => {
  it('adds to the account and adds up in the spending’s currency', () => {
    const spending = t({ id: 's', amount: 2400, value: 2400 });
    const back1 = t({ amount: -800, value: -800, accountId: 'b', refundOf: 's' });
    // came into a dollar account: counted by its value at the time
    const back2 = t({ amount: -25, value: -825, accountId: 'u', refundOf: 's' });
    expect(isMoneyBack(back1)).toBe(true);
    expect(isMoneyBack(spending)).toBe(false);
    expect(txDelta(back1, 'b')).toBe(800);
    expect(moneyBackOn(spending, [back1, back2], cur)).toBe(1625);
  });
});
