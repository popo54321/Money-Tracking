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

describe('overall capital for all BTC wallets', async () => {
  const { holdingStatus } = await import('./wealth');
  const rates = { perUsd: { USD: 1, THB: 33, BTC: 1 / 60000 } };
  const acc = (id: string, opening: number) =>
    ({
      id,
      profileId: 'p',
      name: id,
      type: 'crypto',
      currency: 'BTC',
      group: 'Investments',
      openingBalance: opening,
      openingDate: '2026-01-01',
      order: 0,
      archived: false,
    }) as import('./types').Account;
  const accounts = [acc('bitkub', 0.03), acc('trezor', 0.63), acc('bank', 0)].slice(0, 2);
  const tx = (x: Partial<Tx>): Tx => t({ kind: 'transfer', ...x });
  it('starts from the typed total, adds money moved in, ignores moves between wallets', () => {
    const capital = { amount: 500000, setAt: 100 };
    // bought before the capital was typed: already in the 500,000
    const old = tx({
      id: 'o',
      accountId: 'bank',
      toAccountId: 'bitkub',
      amount: 10000,
      toAmount: 0.005,
      value: 10000,
      createdAt: 50,
      date: '2026-10-01',
    });
    const s0 = holdingStatus(accounts, [old], rates, 'THB', capital);
    expect(s0.cost).toBeCloseTo(500000);
    // bought afterwards: added
    const buy = tx({
      id: 'b',
      accountId: 'bank',
      toAccountId: 'bitkub',
      amount: 15500,
      toAmount: 0.0077,
      value: 15500,
      createdAt: 200,
      date: '2026-11-25',
    });
    const move = tx({
      id: 'm',
      accountId: 'bitkub',
      toAccountId: 'trezor',
      amount: 0.02,
      toAmount: 0.02,
      value: 0,
      createdAt: 300,
      date: '2026-11-26',
    });
    const s1 = holdingStatus(accounts, [old, buy, move], rates, 'THB', capital);
    expect(s1.cost).toBeCloseTo(515500);
    expect(s1.lines.reduce((x, l) => x + l.cost, 0)).toBeCloseTo(515500);
  });
});
