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
import { accountValue, freeLiquid } from './balances';
import { accountClaims } from './splits';
import { buildUp, monthsPerRepeat, nextDateLooksOdd } from './recurring';
import type { Account, Recurring, Tx } from './types';

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

describe('credit card: keep everything owed ready in the paying account', () => {
  const bank = {
    id: 'bank',
    profileId: 'p',
    name: 'Bank',
    type: 'bank',
    group: 'Bank',
    currency: 'THB',
    openingBalance: 50000,
    openingDate: '2026-10-01',
    includeInNetWorth: true,
    archived: false,
    order: 0,
  } as Account;
  const card = {
    ...bank,
    id: 'card',
    name: 'Card',
    type: 'credit',
    group: 'Credit',
    openingBalance: -10000,
    statementDay: 25,
    dueDay: 10,
    payFromAccountId: 'bank',
  } as Account;
  const tx = (id: string, date: string, p: Partial<Tx>): Tx =>
    ({
      id,
      profileId: 'p',
      date,
      kind: 'expense',
      accountId: 'card',
      amount: 0,
      value: 0,
      valueCurrency: 'THB',
      createdAt: 1,
      updatedAt: 1,
      ...p,
    }) as Tx;
  it('statement due plus spending since the statement', async () => {
    const { upcomingItems, reservedByAccount } = await import('./reserve');
    const txs = [tx('s', '2026-11-02', { amount: 2000 })];
    const items = upcomingItems([bank, card], [], txs, '2026-11-07');
    const st = items.find((i) => i.source === 'card')!;
    expect(st.amount).toBe(10000);
    expect(reservedByAccount(items, [bank, card]).get('bank')).toBe(12000);
  });
  it('after the statement is paid, the new spending is still kept ready', async () => {
    const { upcomingItems, reservedByAccount } = await import('./reserve');
    const txs = [
      tx('s', '2026-11-02', { amount: 2000 }),
      tx('pay', '2026-11-05', { kind: 'transfer', accountId: 'bank', toAccountId: 'card', amount: 10000, toAmount: 10000 }),
    ];
    const items = upcomingItems([bank, card], [], txs, '2026-11-07');
    expect(items.find((i) => i.source === 'card')!.label).toBe('Card next statement (so far)');
    expect(reservedByAccount(items, [bank, card]).get('bank')).toBe(2000);
  });
  it('spending after the statement goes on the next one: 4,000 due 10 Nov, then 11,000 due 10 Dec', async () => {
    const { cardStatus } = await import('./creditCard');
    const { upcomingItems } = await import('./reserve');
    const fresh = { ...card, openingBalance: 0 };
    const spends = [
      tx('a', '2026-10-20', { amount: 4000 }), // before the 25 Oct statement
      tx('b', '2026-11-01', { amount: 5000 }), // between the statement and the due day
    ];
    const between = cardStatus(fresh, spends, '2026-11-05');
    expect([between.remaining, between.dueDate]).toEqual([4000, '2026-11-10']);
    expect([between.nextSoFar, between.nextDue]).toEqual([5000, '2026-12-10']);
    const items = upcomingItems([bank, fresh], [], spends, '2026-11-05').filter((i) => i.source === 'card');
    expect(items.map((i) => [i.date, i.amount])).toEqual([
      ['2026-11-10', 4000],
      ['2026-12-10', 5000],
    ]);
    const paid = [
      ...spends,
      tx('pay', '2026-11-09', { kind: 'transfer', accountId: 'bank', toAccountId: 'card', amount: 4000, toAmount: 4000 }),
      tx('c', '2026-11-20', { amount: 6000 }), // before the 25 Nov statement
    ];
    const next = cardStatus(fresh, paid, '2026-11-26');
    expect([next.lastStatement, next.owedAtStatement, next.remaining, next.dueDate]).toEqual([
      '2026-11-25',
      11000,
      11000,
      '2026-12-10',
    ]);
    expect(next.nextSoFar).toBe(0);
  });
  it('paying in more than is owed leaves extra to spend: the limit plus the extra', async () => {
    const { cardStatus } = await import('./creditCard');
    const fresh = { ...card, openingBalance: 0, creditLimit: 50000 };
    const txs = [
      tx('a', '2026-11-01', { amount: 3000 }),
      tx('pay', '2026-11-05', { kind: 'transfer', accountId: 'bank', toAccountId: 'card', amount: 5000, toAmount: 5000 }),
    ];
    const st = cardStatus(fresh, txs, '2026-11-06');
    expect([st.owedNow, st.extraCredit, st.available]).toEqual([0, 2000, 52000]);
    // the next spending uses the extra first
    const later = cardStatus(fresh, [...txs, tx('b', '2026-11-08', { amount: 2500 })], '2026-11-09');
    expect([later.owedNow, later.extraCredit, later.available]).toEqual([500, 0, 49500]);
  });
  it('extra paid into a card counts as free money', async () => {
    const { freeLiquid } = await import('./balances');
    const fresh = { ...card, openingBalance: 0 };
    const free = freeLiquid([fresh], new Map([['card', 2000]]), new Map(), new Map(), { perUsd: { USD: 1, THB: 33 } }, 'THB');
    expect(free).toBe(2000);
  });
  const yearly = (p: Partial<Recurring>): Recurring =>
    ({
      id: 'r',
      profileId: 'p',
      name: 'Yearly',
      kind: 'expense',
      amount: 1200,
      accountId: 'card',
      freq: 'year',
      every: 1,
      startDate: '2026-12-20',
      autoPost: true,
      reserve: true,
      holdInFull: true,
      active: true,
      createdAt: 1,
      ...p,
    }) as Recurring;
  it('a yearly bill paid by card is kept in the paying bank account, never on the card', async () => {
    const { upcomingItems, reservedByAccount } = await import('./reserve');
    const items = upcomingItems([bank, { ...card, openingBalance: 0 }], [yearly({})], [], '2026-11-12');
    const m = reservedByAccount(items, [bank, card]);
    expect(m.get('bank')).toBe(1200);
    expect(m.get('card')).toBeUndefined();
  });
  it('a card with no paying account sets nothing aside (not on the card either)', async () => {
    const { upcomingItems, reservedByAccount } = await import('./reserve');
    const lone = { ...card, openingBalance: 0, payFromAccountId: undefined };
    const items = upcomingItems([bank, lone], [yearly({})], [], '2026-11-12');
    expect(items.find((i) => i.key === 'r:r')!.reserved).toBe(false);
    expect(reservedByAccount(items, [bank, lone]).size).toBe(0);
  });
  it('a small bill set aside 2 months before: nothing until then, the whole amount after', async () => {
    const { upcomingItems } = await import('./reserve');
    const small = yearly({ accountId: 'bank', holdInFull: undefined, aheadMonths: 2 });
    const early = upcomingItems([bank], [small], [], '2026-10-19').find((i) => i.key === 'r:r')!;
    expect(early.reserved).toBe(false);
    expect(early.holdFrom).toBe('2026-10-20');
    const inTime = upcomingItems([bank], [small], [], '2026-10-20').find((i) => i.key === 'r:r')!;
    expect(inTime.reserved).toBe(true);
    expect(inTime.reserveAmount).toBeUndefined();
    expect(inTime.holdFrom).toBeUndefined();
  });
  it('months ahead only counts when the bill comes round less often than that', async () => {
    const { aheadMonths } = await import('./recurring');
    expect(aheadMonths({ freq: 'year', every: 1, startDate: '2026-01-01', aheadMonths: 3 })).toBe(3);
    expect(aheadMonths({ freq: 'year', every: 1, startDate: '2026-01-01', aheadMonths: 0 })).toBe(0);
    expect(aheadMonths({ freq: 'year', every: 1, startDate: '2026-01-01' })).toBeNull();
    expect(aheadMonths({ freq: 'month', every: 2, startDate: '2026-01-01', aheadMonths: 2 })).toBeNull();
    expect(aheadMonths({ freq: 'year', every: 1, startDate: '2026-01-01', aheadMonths: 4 })).toBeNull();
  });
  it('a small bill set aside in the same month: from the 1st of the month it is due', async () => {
    const { upcomingItems } = await import('./reserve');
    const small = yearly({ accountId: 'bank', holdInFull: undefined, aheadMonths: 0 });
    const before = upcomingItems([bank], [small], [], '2026-11-30').find((i) => i.key === 'r:r')!;
    expect(before.reserved).toBe(false);
    expect(before.holdFrom).toBe('2026-12-01');
    const inMonth = upcomingItems([bank], [small], [], '2026-12-01').find((i) => i.key === 'r:r')!;
    expect(inMonth.reserved).toBe(true);
  });
});

describe('bill split tip rounding', () => {
  const people = [{ id: 'a', name: 'A' }];
  const items = [{ id: '1', name: 'Food', price: 3848, sharedBy: ['a'], shared: false }];
  const base = {
    people,
    items,
    servicePct: 10,
    vatPct: 7,
    vatOnService: true,
    mode: 'itemised' as const,
    currency: 'THB',
    tipPct: 5,
  };
  it('rounds the tip itself up', () => {
    // 5 % of 3,848 = 192.40 → 200
    expect(computeBill({ ...base, tipRoundTo: 10 }).tip).toBeCloseTo(200, 9);
    expect(computeBill({ ...base, tipRoundTo: 100 }).tip).toBeCloseTo(200, 9);
  });
  it('rounds the whole bill up, the extra goes to the tip', () => {
    const r = computeBill({ ...base, tipRoundTo: 100, tipRoundTotal: true });
    // 3,848 + 384.80 + 296.30 + 192.40 = 4,721.50 → 4,800
    expect(r.total).toBeCloseTo(4800, 9);
    expect(r.tip).toBeCloseTo(270.904, 6);
  });
});

describe('liquid money', () => {
  const a = (id: string, type: Account['type'], openingBalance: number, extra: Partial<Account> = {}) =>
    ({
      id,
      profileId: 'p',
      name: id,
      type,
      group: 'G',
      currency: 'THB',
      openingBalance,
      openingDate: '2026-01-01',
      includeInNetWorth: true,
      archived: false,
      order: 0,
      ...extra,
    }) as Account;
  it('bank, cash and card debt are liquid by default; investments are not; each account can say otherwise', async () => {
    const { netWorth, balancesByAccount } = await import('./balances');
    const accs = [
      a('bank', 'bank', 1000),
      a('cash', 'cash', 200),
      a('card', 'credit', -300),
      a('fund', 'investment', 5000),
      a('saving', 'bank', 4000, { liquid: false }),
    ];
    const nw = netWorth(accs, balancesByAccount(accs, []), { perUsd: { USD: 1, THB: 33 } }, 'THB');
    expect(nw.total).toBe(9900);
    expect(nw.liquid).toBe(900);
  });
});

describe('saving targets share what their account really holds', () => {
  const g = (id: string, saved: number, accountId = 'acc') =>
    ({
      id,
      name: id,
      emoji: '🎯',
      price: 100000,
      currency: 'THB',
      saved,
      monthly: 0,
      accountId,
      done: false,
      countFrom: '2026-11-01',
    }) as Goal;
  it('account holds at least all its targets: each keeps its amount', async () => {
    const { fitToAccounts } = await import('./goals');
    const rows = fitToAccounts([g('a', 20000), g('b', 8000)], '2026-11-10', new Map([['acc', 50000]]));
    expect(rows.map((r) => r.saved)).toEqual([20000, 8000]);
  });
  it('account drops below: every target goes down by the same share, and the records stay', async () => {
    const { fitToAccounts } = await import('./goals');
    const rows = fitToAccounts([g('a', 20000), g('b', 8000), g('c', 0)], '2026-11-10', new Map([['acc', 14000]]));
    expect(rows.map((r) => r.saved)).toEqual([10000, 4000, 0]);
    expect(rows.map((r) => r.recorded)).toEqual([20000, 8000, 0]);
  });
  it('an empty or overdrawn account shows 0, targets in other accounts are untouched', async () => {
    const { fitToAccounts } = await import('./goals');
    const rows = fitToAccounts(
      [g('a', 5000), g('x', 3000, 'other')],
      '2026-11-10',
      new Map([
        ['acc', -200],
        ['other', 9000],
      ]),
    );
    expect(rows.map((r) => r.saved)).toEqual([0, 3000]);
  });
});

describe('many saving targets with money in them: the drop is shared exactly', () => {
  const g = (id: string, saved: number) =>
    ({
      id,
      name: id,
      emoji: '🎯',
      price: 1e6,
      currency: 'THB',
      saved,
      monthly: 0,
      accountId: 'acc',
      done: false,
      countFrom: '2026-11-01',
    }) as Goal;
  const run = async (saved: number[], bal: number) => {
    const { fitToAccounts } = await import('./goals');
    return fitToAccounts(
      saved.map((s, i) => g(String(i), s)),
      '2026-11-10',
      new Map([['acc', bal]]),
    );
  };
  const total = (rows: { saved: number }[]) => Math.round(rows.reduce((x, r) => x + r.saved, 0) * 100) / 100;
  it('30,000 / 15,000 / 5,000 in an account of 35,000 → 70 % each', async () => {
    const rows = await run([30000, 15000, 5000], 35000);
    expect(rows.map((r) => r.saved)).toEqual([21000, 10500, 3500]);
  });
  it('awkward amounts: same share for each, and they add up to exactly the account', async () => {
    for (const [saved, bal] of [
      [[28811.13, 9145, 120000, 0.01], 19666.13],
      [[10000, 10000, 10000], 10000],
      [[1234.56, 789.01, 2.03, 555.55], 1000],
    ] as [number[], number][]) {
      const rows = await run(saved, bal);
      expect(total(rows)).toBe(bal);
      // every target keeps the same share, to within a satang
      for (const r of rows)
        expect(Math.abs(r.saved - (r.recorded * bal) / saved.reduce((a, b) => a + b, 0))).toBeLessThanOrEqual(0.01);
    }
  });
});

describe('one true Free: set aside → splits → targets → Free', () => {
  const acc = {
    id: 'k',
    profileId: 'p',
    name: 'Kbank',
    type: 'bank',
    group: 'Bank',
    currency: 'THB',
    openingBalance: 0,
    openingDate: '2026-01-01',
    includeInNetWorth: true,
    archived: false,
    order: 0,
    splits: [{ id: 's1', name: 'Car', base: 5000 }],
  } as unknown as Account;
  const goal = {
    goal: { id: 'g', accountId: 'k', currency: 'THB', done: false, name: 'Trip', emoji: '🎯' } as Goal,
    saved: 8000,
  };
  it('takes bills, then splits, then targets off the balance', () => {
    const c = accountClaims(acc, 30000, 10000, [], [goal]);
    expect(c).toEqual({ balance: 30000, setAside: 10000, splits: 5000, targets: 8000, free: 7000 });
  });
  it('goes below zero when more is claimed than the account holds', () => {
    expect(accountClaims(acc, 20000, 10000, [], [goal]).free).toBe(-3000);
  });
  it('free liquid never takes a card debt off twice', () => {
    const card = { ...acc, id: 'cc', type: 'credit', splits: [] } as unknown as Account;
    const loose = { ...acc, id: 'cc2', type: 'credit', splits: [] } as unknown as Account;
    const invest = { ...acc, id: 'inv', type: 'investment', splits: [] } as unknown as Account;
    const balances = new Map([
      ['k', 30000],
      ['cc', -4000],
      ['cc2', -500],
      ['inv', 100000],
    ]);
    const free = new Map([['k', 7000]]);
    // the paying account already set aside the 4,000 the first card owes; the second card has no paying account
    const v = freeLiquid(
      [acc, card, loose, invest],
      balances,
      free,
      new Map([['cc', 4000]]),
      { perUsd: { USD: 1, THB: 33 } },
      'THB',
    );
    expect(v).toBe(6500);
  });
});

describe('a next payment date that does not fit the repeat', () => {
  const s = (freq: 'day' | 'week' | 'month' | 'year', startDate: string, every = 1) => ({ freq, every, startDate });
  it('flags a monthly bill whose next date is 11 months away (start date typed with the wrong year)', () => {
    expect(nextDateLooksOdd(s('month', '2027-10-05'), '2027-10-05', '2026-11-12')).toBe(true);
  });
  it('a yearly bill 11 months away, or a monthly one next month, is fine', () => {
    expect(nextDateLooksOdd(s('year', '2026-10-05'), '2027-10-05', '2026-11-12')).toBe(false);
    expect(nextDateLooksOdd(s('month', '2026-10-05'), '2026-12-05', '2026-11-12')).toBe(false);
    expect(nextDateLooksOdd(s('month', '2026-12-12'), '2026-12-12', '2026-11-12')).toBe(false);
  });
  it('weekly bills more than a week away are flagged; past or missing dates are not', () => {
    expect(nextDateLooksOdd(s('week', '2026-12-01'), '2026-12-01', '2026-11-12')).toBe(true);
    expect(nextDateLooksOdd(s('week', '2026-11-01'), null, '2026-11-12')).toBe(false);
  });
});

describe('yearly bills build up month by month', () => {
  const aia = { freq: 'year' as const, every: 1, startDate: '2025-11-26' };
  it('one share straight after paying, one more each month, all of it one month before', () => {
    expect(buildUp(aia, '2026-11-26', '2025-11-26')).toEqual({ months: 1, of: 12 });
    expect(buildUp(aia, '2026-11-26', '2026-04-30')).toEqual({ months: 6, of: 12 });
    expect(buildUp(aia, '2026-11-26', '2026-10-25')).toEqual({ months: 11, of: 12 });
    expect(buildUp(aia, '2026-11-26', '2026-10-26')).toEqual({ months: 12, of: 12 });
  });
  it('monthly bills are always set aside in full; every 3 months builds up in thirds', () => {
    expect(monthsPerRepeat({ freq: 'month', every: 1, startDate: '2026-01-01' })).toBe(0);
    expect(buildUp({ freq: 'month', every: 3, startDate: '2026-11-01' }, '2027-02-01', '2026-12-15')).toEqual({
      months: 2,
      of: 3,
    });
  });
});

describe('instalment plan dates and amounts', () => {
  it('the last payment is n−1 months after the first; month ends clamp', async () => {
    const { instalmentEnd, instalmentAmount } = await import('./recurring');
    expect(instalmentEnd('2026-11-13', 10)).toBe('2027-08-13');
    expect(instalmentEnd('2026-01-31', 2)).toBe('2026-02-28');
    expect(instalmentAmount(10000, 3)).toBe(3333.33);
  });
});
