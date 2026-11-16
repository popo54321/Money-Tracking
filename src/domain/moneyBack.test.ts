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

describe('payback notes', () => {
  it('names the friend and the bill or trip', async () => {
    const { paybackNote } = await import('./debts');
    const d = {
      id: 'd',
      profileId: 'p',
      person: 'Alex',
      direction: 'owedToMe' as const,
      currency: 'THB',
      interestType: 'none' as const,
      ratePct: 0,
      ratePer: 'year' as const,
      closed: false,
      createdAt: 0,
      updatedAt: 0,
      events: [{ id: 'trip:t1:alex:in', date: '2026-11-01', type: 'lend' as const, amount: 500, note: 'Xiamen trip' }],
    };
    expect(paybackNote(d)).toBe('Alex payback for Xiamen trip');
    const newer = { ...d, events: [{ ...d.events[0], note: 'Alex payback for Xiamen trip' }] };
    expect(paybackNote(newer, 'cash')).toBe('Alex payback for Xiamen trip: cash');
    expect(paybackNote({ ...d, events: [{ ...d.events[0], id: 'x' }] })).toBe('Payback from Alex');
  });
});
