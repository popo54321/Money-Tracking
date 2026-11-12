import { describe, expect, it } from 'vitest';
import { dueMonths, firstMonthFrom, lastFriday, mainDeduction, nextPayDate, payDate, payEntries, type Payday } from './payday';

const pay = (x: Partial<Payday> = {}): Payday => ({
  active: true,
  accountId: 'bank',
  incomeCategoryId: 'salary',
  gross: 60000,
  takeHome: 51920,
  deductCategoryId: 'tax',
  extras: [],
  rule: 'day',
  day: 25,
  fromMonth: '2026-11',
  ...x,
});

describe('payday dates', () => {
  it('last Friday of the month', () => {
    expect(lastFriday(2026, 11)).toBe('2026-11-27');
    expect(lastFriday(2027, 2)).toBe('2027-02-26');
    expect(lastFriday(2026, 10)).toBe('2026-10-30');
  });
  it('a fixed day uses the last day in shorter months', () => {
    expect(payDate({ rule: 'day', day: 31 }, '2027-02')).toBe('2027-02-28');
    expect(payDate({ rule: 'day', day: 25 }, '2026-11')).toBe('2026-11-25');
    expect(payDate({ rule: 'lastFriday', day: 1 }, '2026-11')).toBe('2026-11-27');
  });
  it('starts this month if its pay date is still ahead, otherwise next month', () => {
    expect(firstMonthFrom({ rule: 'day', day: 25 }, '2026-11-12')).toBe('2026-11');
    expect(firstMonthFrom({ rule: 'day', day: 10 }, '2026-11-12')).toBe('2026-12');
  });
});

describe('recording payday', () => {
  it('records on the day and catches up missed months', () => {
    expect(dueMonths(pay(), '2026-11-24')).toEqual([]);
    expect(dueMonths(pay(), '2026-11-25')).toEqual(['2026-11']);
    expect(dueMonths(pay(), '2026-12-26')).toEqual(['2026-11', '2026-12']);
  });
  it('after "Payday\'s here" that month is done and does not record itself again', () => {
    const p = pay({ paidMonth: '2026-11' });
    expect(dueMonths(p, '2026-11-25')).toEqual([]);
    expect(nextPayDate(p)).toBe('2026-12-25');
    expect(dueMonths(pay({ active: false }), '2026-12-26')).toEqual([]);
  });
  it('full salary in, deductions out: the account goes up by exactly the take-home pay', () => {
    const p = pay({
      extras: [
        { id: 'pf', name: 'Provident fund', amount: 1800, toAccountId: 'pvd' },
        { id: 'sso', name: 'Social security', amount: 750, categoryId: 'sso' },
      ],
    });
    expect(mainDeduction(p.gross, p.takeHome, p.extras)).toBe(5530);
    const e = payEntries(p, 'popo', '2026-11');
    expect(e.map((x) => [x.id, x.kind, x.amount, x.categoryId ?? x.toAccountId])).toEqual([
      ['pay-popo-2026-11-salary', 'income', 60000, 'salary'],
      ['pay-popo-2026-11-pf', 'transfer', 1800, 'pvd'],
      ['pay-popo-2026-11-sso', 'expense', 750, 'sso'],
      ['pay-popo-2026-11-deduct', 'expense', 5530, 'tax'],
    ]);
    const intoAccount = e.reduce((s, x) => s + (x.kind === 'income' ? x.amount : -x.amount), 0);
    expect(intoAccount).toBe(51920);
  });
  it('one month can use a different full salary and take-home (overtime)', () => {
    const e = payEntries(pay(), 'popo', '2026-11', { gross: 65000, takeHome: 55500 });
    expect(e.map((x) => x.amount)).toEqual([65000, 9500]);
  });
});
