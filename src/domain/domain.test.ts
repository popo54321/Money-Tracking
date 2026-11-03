import { describe, expect, it } from 'vitest';
import { evaluate } from './calculator';
import { addMonthKey, monthEnd, relativeDays } from './dates';
import { allocate, fmtMoney, roundTo, sum } from './money';
import { convert, withBtc } from './fx';
import { accountValue, balanceOf, balancesByAccount, netWorth } from './balances';
import { dueToPost, monthlyEquivalent, nextUnposted, occurrence, occurrencesBetween } from './recurring';
import { cardStatus, dueDateFor, statementOnOrBefore } from './creditCard';
import { reservedByAccount, upcomingItems } from './reserve';
import { computeBill, settleBill, whoOwes } from './billSplit';
import { computeTrip } from './tripSplit';
import { phaseTotals, surplusRule, transferAmount } from './budget';
import { summarise } from './summary';
import type { Account, BudgetPlan, Category, Recurring, Tx } from './types';

const acc = (p: Partial<Account> & { id: string }): Account => ({
  profileId: 'popo',
  name: p.id,
  type: 'bank',
  group: 'Bank',
  currency: 'THB',
  openingBalance: 0,
  openingDate: '2026-01-01',
  includeInNetWorth: true,
  archived: false,
  order: 0,
  ...p,
});

let n = 0;
const tx = (p: Partial<Tx> & Pick<Tx, 'kind' | 'accountId' | 'amount' | 'date'>): Tx => ({
  id: `t${n++}`,
  profileId: 'popo',
  value: p.amount,
  valueCurrency: 'THB',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('calculator', () => {
  it('does arithmetic with precedence and brackets', () => {
    expect(evaluate('120+35*2')).toBe(190);
    expect(evaluate('(120+35)×2')).toBe(310);
    expect(evaluate('1000÷4')).toBe(250);
    expect(evaluate('−50+20')).toBe(-30);
    expect(evaluate('0.1+0.2')).toBe(0.3);
    expect(evaluate('1,250.50+49.50')).toBe(1300);
    expect(evaluate('2(3+4')).toBe(14);
  });
  it('rejects invalid input', () => {
    expect(evaluate('')).toBeNull();
    expect(evaluate('5/0')).toBeNull();
    expect(evaluate('5+')).toBeNull();
    expect(evaluate('1..2')).toBeNull();
    expect(evaluate('abc')).toBeNull();
  });
});

describe('money', () => {
  it('rounds and formats', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(fmtMoney(1234.5, 'THB')).toBe('฿1,234.50');
    expect(fmtMoney(-12, 'USD')).toBe('-$12.00');
    expect(fmtMoney(0.0051, 'BTC')).toBe('0.00510000 BTC');
    expect(fmtMoney(3, 'baht-weight')).toBe('3.00 baht-weight');
  });
  it('allocates so the parts add up exactly', () => {
    const parts = allocate(100, [1, 1, 1], 2);
    expect(sum(parts)).toBeCloseTo(100, 10);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(allocate(10, [0, 0], 2)).toEqual([5, 5]);
  });
});

describe('dates', () => {
  it('handles month keys and relative days', () => {
    expect(addMonthKey('2026-12', 1)).toBe('2027-01');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    expect(relativeDays('2026-11-03', '2026-11-04')).toBe('tomorrow');
  });
});

describe('exchange rates', () => {
  const table = withBtc({ USD: 1, THB: 33.74, EUR: 0.8933 }, 2584489, 'THB');
  it('converts between currencies', () => {
    expect(convert(100, 'USD', 'THB', table)).toBeCloseTo(3374, 6);
    expect(convert(36, 'THB', 'THB', table)).toBe(36);
    expect(convert(1, 'XYZ', 'THB', table)).toBeNull();
  });
  it('values BTC at the THB price exactly', () => {
    expect(convert(0.5, 'BTC', 'THB', table)).toBeCloseTo(1292244.5, 4);
  });
  it('values gold by the price typed on the account', () => {
    const gold = acc({ id: 'gold', type: 'units', currency: 'baht-weight', unitPrice: 62000, unitPriceCurrency: 'THB' });
    expect(accountValue(gold, 10, table, 'THB')).toBe(620000);
  });
});

describe('balances', () => {
  const bank = acc({ id: 'bank', openingBalance: 1000 });
  const usd = acc({ id: 'usd', currency: 'USD', openingBalance: 0 });
  const txs = [
    tx({ kind: 'expense', accountId: 'bank', amount: 200, date: '2026-11-01' }),
    tx({ kind: 'income', accountId: 'bank', amount: 50, date: '2026-11-02' }),
    tx({ kind: 'transfer', accountId: 'bank', amount: 337.4, toAccountId: 'usd', toAmount: 10, date: '2026-11-03' }),
    tx({ kind: 'adjust', accountId: 'bank', amount: -12.6, date: '2026-11-04' }),
  ];
  it('adds up entries, transfers in two currencies and adjustments', () => {
    expect(balanceOf(bank, txs)).toBeCloseTo(500, 9);
    expect(balanceOf(usd, txs)).toBe(10);
    expect(balanceOf(bank, txs, '2026-11-02')).toBe(850);
    const m = balancesByAccount([bank, usd], txs);
    expect(m.get('bank')).toBeCloseTo(500, 9);
    expect(m.get('usd')).toBe(10);
  });
  it('works out net worth in the default currency', () => {
    const nw = netWorth([bank, usd], balancesByAccount([bank, usd], txs), { perUsd: { USD: 1, THB: 33.74 } }, 'THB');
    expect(nw.total).toBeCloseTo(500 + 337.4, 6);
  });
});

describe('repeating entries', () => {
  it('keeps the 31st, falling on the last day of short months', () => {
    const s = { freq: 'month' as const, every: 1, startDate: '2026-01-31' };
    expect([0, 1, 2, 3].map((i) => occurrence(s, i))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('handles leap years for yearly entries', () => {
    const s = { freq: 'year' as const, every: 1, startDate: '2024-02-29' };
    expect(occurrence(s, 1)).toBe('2025-02-28');
    expect(occurrence(s, 4)).toBe('2028-02-29');
  });
  it('handles weekly and every-N schedules', () => {
    const s = { freq: 'week' as const, every: 2, startDate: '2026-11-02' };
    expect(occurrencesBetween(s, '2026-11-01', '2026-12-01')).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
  });
  it('catches up missed days and never records one twice', () => {
    const s = { freq: 'day' as const, every: 1, startDate: '2026-11-01' };
    expect(dueToPost(s, undefined, '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(dueToPost(s, '2026-11-03', '2026-11-03')).toEqual([]);
    expect(dueToPost({ ...s, endDate: '2026-11-02' }, undefined, '2026-11-05')).toEqual(['2026-11-01', '2026-11-02']);
    expect(nextUnposted(s, '2026-11-03')).toBe('2026-11-04');
  });
  it('gives a monthly set-aside amount', () => {
    expect(monthlyEquivalent(63766, 'year', 1)).toBeCloseTo(5313.83, 2);
    expect(monthlyEquivalent(209, 'month', 1)).toBe(209);
  });
});

describe('credit cards', () => {
  it('finds statement and due dates across month ends', () => {
    expect(statementOnOrBefore('2026-11-03', 25)).toBe('2026-10-25');
    expect(statementOnOrBefore('2026-11-25', 25)).toBe('2026-11-25');
    expect(statementOnOrBefore('2026-03-01', 31)).toBe('2026-02-28');
    expect(dueDateFor('2026-10-25', 10)).toBe('2026-11-10');
    expect(dueDateFor('2026-10-05', 25)).toBe('2026-10-25');
  });
  it('tracks the unpaid part of the last statement', () => {
    const card = acc({
      id: 'card',
      type: 'credit',
      group: 'Credit',
      statementDay: 25,
      dueDay: 10,
      payFromAccountId: 'bank',
      creditLimit: 50000,
    });
    const txs = [
      tx({ kind: 'expense', accountId: 'card', amount: 3000, date: '2026-10-20' }),
      tx({ kind: 'expense', accountId: 'card', amount: 500, date: '2026-10-28' }),
      tx({ kind: 'transfer', accountId: 'bank', toAccountId: 'card', amount: 1000, toAmount: 1000, date: '2026-11-01' }),
    ];
    const st = cardStatus(card, txs, '2026-11-03');
    expect(st.lastStatement).toBe('2026-10-25');
    expect(st.owedAtStatement).toBe(3000);
    expect(st.remaining).toBe(2000);
    expect(st.owedNow).toBe(2500);
    expect(st.available).toBe(47500);
    expect(st.dueDate).toBe('2026-11-10');
    expect(st.daysToDue).toBe(7);
    expect(st.overdue).toBe(false);
    expect(cardStatus(card, txs, '2026-11-12').overdue).toBe(true);
  });
});

describe('reserves', () => {
  it('reserves the next payment, moving card charges to the paying account', () => {
    const bank = acc({ id: 'bank', openingBalance: 20000 });
    const card = acc({ id: 'card', type: 'credit', group: 'Credit', payFromAccountId: 'bank' });
    const rec = (p: Partial<Recurring>): Recurring => ({
      id: 'r',
      profileId: 'popo',
      name: 'x',
      kind: 'expense',
      amount: 0,
      accountId: 'bank',
      freq: 'month',
      every: 1,
      startDate: '2026-01-05',
      autoPost: true,
      reserve: true,
      active: true,
      createdAt: 0,
      ...p,
    });
    const items = upcomingItems(
      [bank, card],
      [
        rec({ id: 'spotify', name: 'Spotify', amount: 209, accountId: 'card', lastPosted: '2026-11-05' }),
        rec({ id: 'gemini', name: 'Gemini', amount: 750, lastPosted: '2026-10-05' }),
        rec({ id: 'salary', name: 'Salary', kind: 'income', amount: 55000, lastPosted: '2026-10-05' }),
        rec({ id: 'ins', name: 'Health Insurance', amount: 63766, freq: 'year', startDate: '2026-11-20', reserve: false }),
      ],
      [],
      '2026-11-03',
    );
    expect(items.map((i) => i.label)).toEqual(['Gemini', 'Salary', 'Health Insurance', 'Spotify']);
    const r = reservedByAccount(items, [bank, card]);
    expect(r.get('bank')).toBe(959);
    expect(r.has('card')).toBe(false);
  });
});

describe('bill split', () => {
  const people = [
    { id: 'a', name: 'Popo' },
    { id: 'b', name: 'Qiqi' },
    { id: 'c', name: 'Ann' },
  ];
  it('splits own food, shared drinks between only the ticked people, and charges by share', () => {
    const r = computeBill({
      people,
      items: [
        { id: '1', name: 'Pad thai', price: 100, sharedBy: ['a'], shared: false },
        { id: '2', name: 'Steak', price: 300, sharedBy: ['b'], shared: false },
        { id: '3', name: 'Salad', price: 200, sharedBy: ['c'], shared: false },
        { id: '4', name: 'Beer tower', price: 400, sharedBy: ['a', 'b'], shared: true },
      ],
      servicePct: 10,
      vatPct: 7,
      vatOnService: true,
      mode: 'itemised',
      currency: 'THB',
    });
    expect(r.subtotal).toBe(1000);
    expect(r.service).toBeCloseTo(100, 9);
    expect(r.vat).toBeCloseTo(77, 9);
    expect(r.total).toBeCloseTo(1177, 9);
    expect(r.shares.map((s) => s.food)).toEqual([300, 500, 200]);
    expect(r.shares.map((s) => s.pay)).toEqual([353.1, 588.5, 235.4]);
    expect(sum(r.shares.map((s) => s.pay))).toBeCloseTo(1177, 9);
  });
  it('lets the others cover service charge and VAT for someone being treated', () => {
    const r = computeBill({
      people: [people[0], people[1], { ...people[2], exemptCharges: true }],
      items: [
        { id: '1', name: 'A', price: 100, sharedBy: ['a'], shared: false },
        { id: '2', name: 'B', price: 300, sharedBy: ['b'], shared: false },
        { id: '3', name: 'C', price: 200, sharedBy: ['c'], shared: false },
      ],
      servicePct: 10,
      vatPct: 7,
      vatOnService: true,
      mode: 'itemised',
      currency: 'THB',
    });
    // charges = 600 × 0.177 = 106.2, shared 1:3 between Popo and Qiqi
    expect(r.shares[2].pay).toBe(200);
    expect(r.shares[0].pay).toBeCloseTo(126.55, 2);
    expect(r.shares[1].pay).toBeCloseTo(379.65, 2);
    expect(sum(r.shares.map((s) => s.pay))).toBeCloseTo(706.2, 9);
  });
  it('splits evenly and rounds to whole numbers on request', () => {
    const r = computeBill({
      people,
      items: [{ id: '1', name: 'All', price: 1000, sharedBy: [], shared: true }],
      servicePct: 0,
      vatPct: 0,
      vatOnService: true,
      mode: 'even',
      currency: 'THB',
      roundWhole: true,
    });
    expect(r.shares.map((s) => s.pay)).toEqual([334, 333, 333]);
    expect(whoOwes(r, 'a').map((o) => o.amount)).toEqual([333, 333]);
  });
});

describe('bill split with several payers', () => {
  const seven = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => ({ id: n, name: n }));
  const bill = computeBill({
    people: seven,
    items: [{ id: 'x', name: 'Dinner', price: 7000, sharedBy: [], shared: true }],
    servicePct: 0,
    vatPct: 0,
    vatOnService: true,
    mode: 'even',
    currency: 'THB',
  });
  it('A pays 60 % and B 40 %: the other five pay them back their share', () => {
    const plan = settleBill(
      bill,
      [
        { personId: 'A', amount: 0, pct: 0.6 },
        { personId: 'B', amount: 0, pct: 0.4 },
      ],
      undefined,
      'THB',
    );
    expect(plan.paid.get('A')).toBe(4200);
    expect(plan.paid.get('B')).toBe(2800);
    expect(plan.missing).toBe(0);
    const toA = sum(plan.transfers.filter((t) => t.toId === 'A').map((t) => t.amount));
    const toB = sum(plan.transfers.filter((t) => t.toId === 'B').map((t) => t.amount));
    expect(toA).toBe(3200);
    expect(toB).toBe(1800);
    for (const p of ['C', 'D', 'E', 'F', 'G'])
      expect(sum(plan.transfers.filter((t) => t.fromId === p).map((t) => t.amount))).toBe(1000);
    expect(plan.transfers.length).toBeLessThanOrEqual(6);
  });
  it('typed amounts work too, and say what is still missing', () => {
    const plan = settleBill(
      bill,
      [
        { personId: 'A', amount: 5000 },
        { personId: 'C', amount: 1500 },
      ],
      undefined,
      'THB',
    );
    expect(plan.paidTotal).toBe(6500);
    expect(plan.missing).toBe(500);
  });
  it('one payer still works like before', () => {
    const plan = settleBill(bill, undefined, 'A', 'THB');
    expect(plan.transfers).toHaveLength(6);
    expect(plan.transfers.every((t) => t.toId === 'A' && t.amount === 1000)).toBe(true);
  });
});

describe('travel split', () => {
  const members = [
    { id: 'popo', name: 'Popo' },
    { id: 'qiqi', name: 'Qiqi' },
  ];
  const rates = { CNY: 5, EUR: 36, USD: 35 };
  it('matches the Xiamen example in the Trip Split sheet', () => {
    const r = computeTrip({
      members,
      baseCurrency: 'THB',
      rates,
      payBackCurrency: 'THB',
      entries: [
        { id: '1', payerId: 'popo', bill: 'Flight To Xiamen', cost: 4190, currency: 'THB', split: 'none' },
        { id: '2', payerId: 'qiqi', bill: 'Flight To Xiamen', cost: 420, currency: 'EUR', split: 'all' },
        { id: '3', payerId: 'popo', bill: 'Hotel, Xiamen', cost: 4280.82, currency: 'THB', split: 'all' },
      ],
    });
    expect(r.total).toBeCloseTo(23590.82, 6);
    expect(r.sharedTotal).toBeCloseTo(19400.82, 6);
    const popo = r.members.find((m) => m.id === 'popo')!;
    const qiqi = r.members.find((m) => m.id === 'qiqi')!;
    expect(popo.share).toBeCloseTo(9700.41, 6);
    expect(popo.paidShared).toBeCloseTo(4280.82, 6);
    expect(popo.net).toBeCloseTo(-5419.59, 6);
    expect(qiqi.net).toBeCloseTo(5419.59, 6);
    expect(popo.personal).toBe(4190);
    expect(r.settlements).toHaveLength(1);
    expect(r.settlements[0].fromName).toBe('Popo');
    expect(r.settlements[0].toName).toBe('Qiqi');
    expect(Math.round(r.settlements[0].payBack)).toBe(5420);
  });
  it('pays back in another currency and handles more people and partial sharing', () => {
    const r = computeTrip({
      members: [...members, { id: 'ann', name: 'Ann' }],
      baseCurrency: 'THB',
      rates,
      payBackCurrency: 'EUR',
      entries: [
        { id: '1', payerId: 'ann', bill: 'Dinner', cost: 90, currency: 'EUR', split: 'all' },
        { id: '2', payerId: 'popo', bill: 'Taxi', cost: 600, currency: 'CNY', split: 'some', sharedBy: ['popo', 'qiqi'] },
      ],
    });
    // dinner 3240 THB → 1080 each; taxi 3000 THB → 1500 each for Popo & Qiqi
    const by = Object.fromEntries(r.members.map((m) => [m.id, m.net]));
    expect(by.ann).toBeCloseTo(2160, 6);
    expect(by.popo).toBeCloseTo(420, 6);
    expect(by.qiqi).toBeCloseTo(-2580, 6);
    expect(r.settlements.map((s) => [s.fromName, s.toName, Math.round(s.payBack * 100) / 100])).toEqual([
      ['Qiqi', 'Ann', 60],
      ['Qiqi', 'Popo', 11.67],
    ]);
  });
});

describe('budget allocation', () => {
  const plan: BudgetPlan = {
    id: 'b',
    profileId: 'popo',
    monthlyIncome: 51920,
    currency: 'THB',
    activePhaseId: 'p1',
    phases: [
      { id: 'p1', name: 'P1' },
      { id: 'p3', name: 'P3' },
    ],
    categories: [
      { id: 'inv', name: 'Investing' },
      { id: 'trav', name: 'Travel' },
      { id: 'car', name: 'Car Payment' },
      { id: 'emer', name: 'Emergency' },
      { id: 'edu', name: 'Child Education' },
      { id: 'qins', name: 'Qiqi Insurance' },
      { id: 'qexp', name: 'Qiqi Expense' },
      { id: 'pexp', name: 'Popo Expense' },
      { id: 'house', name: 'Household Expense' },
    ],
    amounts: {
      p1: { inv: 16920, trav: 20000, pexp: 15000 },
      p3: { inv: 13000, trav: 2596, qins: 2596, qexp: 10384, pexp: 10384, house: 5192, car: 10384, emer: 0, edu: 2596 },
    },
    bonus: { income: 30000, rows: [] },
    surplus: {
      amount: 4000,
      threshold: 300000,
      belowRows: [{ id: 'e', name: 'Emergency', pct: 1 }],
      aboveRows: [
        { id: 'i', name: 'Investment', pct: 0.7 },
        { id: 't', name: 'Travel', pct: 0.3 },
      ],
    },
    transfers: [{ id: 't1', fromLabel: 'Payroll', toLabel: 'Emer Edu Car', categoryIds: ['car', 'emer', 'edu'], amounts: {} }],
    checklist: { month: '2026-11', done: [] },
    updatedAt: 0,
  };
  it('matches the Budget Allocation sheet percentages', () => {
    const p1 = phaseTotals(plan, 'p1');
    expect(p1.lines[0].pct).toBeCloseTo(0.325886, 6);
    expect(p1.total).toBe(51920);
    const p3 = phaseTotals(plan, 'p3');
    expect(p3.total).toBe(57132);
    expect(p3.pctOfIncome).toBeCloseTo(1.1004, 4);
    expect(p3.left).toBe(-5212);
    expect(transferAmount(plan, plan.transfers[0], 'p3')).toBe(12980);
  });
  it('applies the leftover-money rule', () => {
    expect(surplusRule(plan, 244000).rows[0].name).toBe('Emergency');
    expect(surplusRule(plan, 300000).covered).toBe(true);
  });
});

describe('summary', () => {
  const cats: Category[] = [
    { id: 'sal', profileId: 'popo', kind: 'income', name: 'Salary', group: 'Income', order: 1, archived: false },
    { id: 'int', profileId: 'popo', kind: 'income', name: 'Interest', group: 'Income', order: 2, archived: false },
    { id: 'lunch', profileId: 'popo', kind: 'expense', name: 'Lunch', group: 'Eating Out', order: 3, archived: false },
    { id: 'spot', profileId: 'popo', kind: 'expense', name: 'Spotify', group: 'Fixed', order: 4, archived: false },
  ];
  it('totals by category and group with savings rate', () => {
    const txs = [
      tx({ kind: 'income', accountId: 'bank', amount: 55000, categoryId: 'sal', date: '2026-11-01' }),
      tx({ kind: 'expense', accountId: 'bank', amount: 120, categoryId: 'lunch', date: '2026-11-02' }),
      tx({ kind: 'expense', accountId: 'bank', amount: 80, categoryId: 'lunch', date: '2026-11-03' }),
      tx({ kind: 'expense', accountId: 'bank', amount: 209, categoryId: 'spot', date: '2026-11-05' }),
      tx({
        kind: 'expense',
        accountId: 'bank',
        amount: 10,
        valueCurrency: 'USD',
        value: 10,
        categoryId: 'lunch',
        date: '2026-11-06',
      }),
      tx({ kind: 'expense', accountId: 'bank', amount: 999, categoryId: 'lunch', date: '2026-12-01' }),
      tx({ kind: 'adjust', accountId: 'bank', amount: 999, date: '2026-11-02' }),
    ];
    const s = summarise(txs, cats, '2026-11-01', '2026-11-30', 'THB', { perUsd: { USD: 1, THB: 33.74 } });
    expect(s.income.total).toBe(55000);
    expect(s.income.cats.map((c) => c.name)).toEqual(['Salary']);
    expect(s.expense.groups.map((g) => [g.group, roundTo(g.total, 2)])).toEqual([
      ['Eating Out', 537.4],
      ['Fixed', 209],
    ]);
    expect(s.surplus).toBeCloseTo(55000 - 746.4, 6);
    expect(s.savingsRate).toBeCloseTo((55000 - 746.4) / 55000, 6);
  });
});
