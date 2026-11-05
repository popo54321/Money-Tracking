import { describe, expect, it } from 'vitest';
import { debtStatus, type Debt } from './debts';
import { goalStatus, type Goal } from './goals';
import { computeBill } from './billSplit';

const debt = (p: Partial<Debt>): Debt => ({
  id: 'd',
  profileId: 'popo',
  person: 'Ann',
  direction: 'owedToMe',
  currency: 'THB',
  interestType: 'none',
  ratePct: 0,
  ratePer: 'year',
  events: [],
  closed: false,
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('who owes me', () => {
  it('adds lending and subtracts repayments without interest', () => {
    const s = debtStatus(
      debt({
        events: [
          { id: '1', date: '2026-01-01', type: 'lend', amount: 10000 },
          { id: '2', date: '2026-02-01', type: 'repay', amount: 3000 },
          { id: '3', date: '2026-03-01', type: 'lend', amount: 500 },
        ],
      }),
      '2026-11-03',
    );
    expect(s.owed).toBe(7500);
    expect(s.totalLent).toBe(10500);
    expect(s.totalRepaid).toBe(3000);
  });
  it('works out simple interest per year on the amount still owed', () => {
    const s = debtStatus(
      debt({
        interestType: 'simple',
        ratePct: 10,
        ratePer: 'year',
        events: [{ id: '1', date: '2025-01-01', type: 'lend', amount: 10000 }],
      }),
      '2026-01-01',
    );
    expect(s.interest).toBeCloseTo(1000, 6);
    expect(s.owed).toBeCloseTo(11000, 6);
  });
  it('uses repayments for interest first', () => {
    const s = debtStatus(
      debt({
        interestType: 'simple',
        ratePct: 10,
        ratePer: 'year',
        events: [
          { id: '1', date: '2025-01-01', type: 'lend', amount: 10000 },
          { id: '2', date: '2026-01-01', type: 'repay', amount: 1500 },
        ],
      }),
      '2026-01-01',
    );
    expect(s.interest).toBeCloseTo(0, 6);
    expect(s.principal).toBeCloseTo(9500, 6);
  });
  it('compounds monthly interest', () => {
    const s = debtStatus(
      debt({
        interestType: 'compound',
        ratePct: 1,
        ratePer: 'month',
        events: [{ id: '1', date: '2026-01-15', type: 'lend', amount: 10000 }],
      }),
      '2026-03-15',
      '2026-04-15',
    );
    // two months at 1 % per month (by days): roughly 10000 × 1.01 × 1.01
    expect(s.owed).toBeGreaterThan(10190);
    expect(s.owed).toBeLessThan(10215);
    expect(s.projected!).toBeGreaterThan(s.owed);
  });
});

describe('saving targets', () => {
  const goal = (p: Partial<Goal>): Goal => ({
    id: 'g',
    profileId: 'popo',
    name: 'Camera',
    emoji: '📷',
    price: 30000,
    currency: 'THB',
    source: 'manual',
    saved: 0,
    monthly: 0,
    done: false,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  });
  it('works out progress and when it can be bought', () => {
    const s = goalStatus(goal({ monthly: 5000 }), 12000, '2026-11-03');
    expect(s.progress).toBeCloseTo(0.4, 6);
    expect(s.remaining).toBe(18000);
    expect(s.monthsLeft).toBe(4);
    expect(s.eta).toBe('2027-03-03');
  });
  it('says how much is needed per month for a target date', () => {
    const s = goalStatus(goal({ targetDate: '2027-05-03' }), 0, '2026-11-03');
    expect(s.neededPerMonth).toBe(5000);
  });
  it('is reached when saved covers the price', () => {
    expect(goalStatus(goal({}), 30000, '2026-11-03').reached).toBe(true);
  });
});

import { holdingStatus } from './wealth';
import { withBtc, GOLD_OZ_PER_BAHT } from './fx';
import { accountValue } from './balances';
import type { Account, Tx } from './types';

describe('wealth preserve', () => {
  const base: Omit<Account, 'id' | 'name' | 'type' | 'currency'> = {
    profileId: 'popo',
    group: 'Investments',
    openingBalance: 0,
    openingDate: '2026-01-01',
    includeInNetWorth: true,
    archived: false,
    order: 0,
  };
  const bitkub: Account = { ...base, id: 'bk', name: 'Bitkub', type: 'crypto', currency: 'BTC' };
  const trezor: Account = { ...base, id: 'tz', name: 'Trezor', type: 'crypto', currency: 'BTC' };
  let k = 0;
  const t = (p: Partial<Tx> & Pick<Tx, 'kind' | 'accountId' | 'amount' | 'date' | 'value'>): Tx => ({
    id: `w${k++}`,
    profileId: 'popo',
    valueCurrency: 'THB',
    createdAt: k,
    updatedAt: 0,
    ...p,
  });
  const rates = withBtc({ USD: 1, THB: 33.74 }, 2500000, 'THB', 62550);

  it('tracks average cost, moves between wallets and sales', () => {
    const txs = [
      t({
        kind: 'transfer',
        accountId: 'bank',
        toAccountId: 'bk',
        amount: 12500,
        toAmount: 0.005,
        value: 12500,
        date: '2026-02-01',
      }),
      t({
        kind: 'transfer',
        accountId: 'bank',
        toAccountId: 'bk',
        amount: 12500,
        toAmount: 0.004,
        value: 12500,
        date: '2026-03-01',
      }),
      t({ kind: 'transfer', accountId: 'bk', toAccountId: 'tz', amount: 0.006, toAmount: 0.006, value: 0, date: '2026-04-01' }),
      t({
        kind: 'transfer',
        accountId: 'tz',
        toAccountId: 'bank',
        amount: 0.003,
        toAmount: 7000,
        value: 7000,
        date: '2026-05-01',
      }),
    ];
    const s = holdingStatus([bitkub, trezor], txs, rates, 'THB');
    expect(s.units).toBeCloseTo(0.006, 12);
    // bought 0.009 for 25,000; sold a third of the coins → two-thirds of the cost remains
    expect(s.cost).toBeCloseTo(25000 * (2 / 3), 6);
    expect(s.avgCost).toBeCloseTo(25000 / 0.009, 3);
    expect(s.value).toBeCloseTo(15000, 6);
    expect(s.profit).toBeCloseTo(15000 - 16666.6667, 3);
  });

  it('values gold at the live Thai price per baht-weight', () => {
    const gold: Account = {
      ...base,
      id: 'g',
      name: 'Gold',
      type: 'units',
      currency: 'baht-weight',
      unitPriceSource: 'live-gold',
      openingBalance: 10,
      costBasis: 454614.2,
    };
    expect(accountValue(gold, 10, rates, 'THB')).toBeCloseTo(625500, 4);
    const s = holdingStatus([gold], [], rates, 'THB');
    expect(s.profit).toBeCloseTo(625500 - 454614.2, 4);
    expect(GOLD_OZ_PER_BAHT).toBeCloseTo(0.47295, 4);
  });
});

describe('bill split tips', () => {
  const people = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ];
  const items = [
    { id: '1', name: 'Steak', price: 300, sharedBy: ['a'], shared: false },
    { id: '2', name: 'Salad', price: 100, sharedBy: ['b'], shared: false },
  ];
  const base = { people, items, servicePct: 10, vatPct: 7, vatOnService: true, mode: 'itemised' as const, currency: 'THB' };
  it('tip % on the food only, shared by what each person had', () => {
    const r = computeBill({ ...base, tipPct: 10 });
    expect(r.tip).toBeCloseTo(40, 9);
    expect(r.total).toBeCloseTo(400 + 40 + 30.8 + 40, 9);
    expect(r.shares.map((s) => s.tip)).toEqual([30, 10]);
    expect(r.shares.reduce((x, s) => x + s.pay, 0)).toBeCloseTo(r.total, 9);
  });
  it('tip on the whole bill, and nobody pays tip for someone being treated', () => {
    const r = computeBill({ ...base, tipPct: 10, tipOnTotal: true, people: [people[0], { ...people[1], exemptCharges: true }] });
    expect(r.tip).toBeCloseTo(47.08, 9);
    expect(r.shares[1].tip).toBe(0);
    expect(r.shares[1].pay).toBe(100);
  });
  it('no tip by default', () => {
    expect(computeBill(base).tip).toBe(0);
  });
});
