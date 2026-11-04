import { describe, expect, it } from 'vitest';
import { applyBudgetTick, splitView } from './splits';
import { goalSaved, monthlyOccurrences, type Goal } from './goals';
import type { Account, BudgetPlan, Tx } from './types';

const acc: Account = {
  id: 'scb',
  profileId: 'p',
  name: 'SCB – Car Eme Edu',
  type: 'bank',
  group: 'Bank',
  currency: 'THB',
  openingBalance: 0,
  openingDate: '2026-01-01',
  includeInNetWorth: true,
  archived: false,
  order: 0,
  splits: [
    { id: 'car', name: 'Car', base: 100000, budgetCategoryId: 'bc-car' },
    { id: 'eme', name: 'Emergency', base: 120000, budgetCategoryId: 'bc-eme' },
  ],
};
const plan = {
  activePhaseId: 'p1',
  amounts: { p1: { 'bc-car': 5000, 'bc-eme': 3000, 'bc-edu': 1000 } },
  transfers: [
    {
      id: 't1',
      fromLabel: 'Payroll',
      toLabel: 'SCB',
      toAccountId: 'scb',
      categoryIds: ['bc-car', 'bc-eme', 'bc-edu'],
      amounts: {},
    },
  ],
} as unknown as BudgetPlan;
const spend = (amount: number, fromSplits?: Tx['fromSplits']): Tx => ({
  id: String(amount),
  profileId: 'p',
  date: '2026-11-02',
  kind: 'expense',
  accountId: 'scb',
  amount,
  fromSplits,
  value: amount,
  valueCurrency: 'THB',
  createdAt: 1,
  updatedAt: 1,
});

describe('splits inside an account', () => {
  it("shows each split and What's left, and spending can come from several splits", () => {
    const txs = [spend(3000, [{ splitId: 'car', amount: 2000 }]), spend(500)];
    const v = splitView(acc, 244158, txs, []);
    expect(v.rows.map((r) => [r.name, r.amount])).toEqual([
      ['Car', 98000],
      ['Emergency', 120000],
    ]);
    // 244,158 − 98,000 − 120,000
    expect(v.left).toBe(26158);
    expect(v.leftName).toBe("What's left");
  });
  it('ticking a budget transfer adds its amounts; unticking takes exactly them away; ticking twice never doubles', () => {
    let a = applyBudgetTick(acc, plan, 't1', '2026-11', true);
    a = applyBudgetTick(a, plan, 't1', '2026-11', true);
    expect(splitView(a, 0, [], []).rows.map((r) => r.amount)).toEqual([105000, 123000]);
    a = applyBudgetTick(a, plan, 't1', '2026-11', false);
    expect(splitView(a, 0, [], []).rows.map((r) => r.amount)).toEqual([100000, 120000]);
  });
  it('saving targets kept in the account are part of the split; more earmarked than there shows as short', () => {
    const goal = { id: 'g', name: 'Phone', emoji: '📱', accountId: 'scb', currency: 'THB', done: false } as Goal;
    const v = splitView(acc, 225000, [], [{ goal, saved: 8000 }]);
    expect(v.rows.map((r) => r.amount)).toEqual([100000, 120000, 8000]);
    expect(v.left).toBe(-3000);
  });
});

describe('saving targets as records', () => {
  const g = (p: Partial<Goal>): Goal =>
    ({ id: 'g', name: 'Phone', price: 3000, saved: 2000, monthly: 1000, done: false, countFrom: '2026-11-04', ...p }) as Goal;
  it('adds the monthly saving on the chosen day each month, never above the price', () => {
    expect(goalSaved(g({ saved: 0, price: 50000 }), '2026-11-30')).toBe(0);
    expect(goalSaved(g({ saved: 0, price: 50000 }), '2026-12-01')).toBe(1000);
    expect(goalSaved(g({ saved: 0, price: 50000, addDay: 25 }), '2026-11-25')).toBe(1000);
    expect(goalSaved(g({ saved: 0, price: 50000, addDay: 25 }), '2027-01-24')).toBe(2000);
    expect(goalSaved(g({}), '2027-03-01')).toBe(3000);
  });
  it('the 31st falls on the last day of shorter months', () => {
    expect(monthlyOccurrences('2027-01-31', '2027-02-28', 31)).toBe(1);
    expect(monthlyOccurrences('2027-01-31', '2027-02-27', 31)).toBe(0);
  });
  it('a bought target stays as it was', () => {
    expect(goalSaved(g({ done: true }), '2027-06-01')).toBe(2000);
  });
});
