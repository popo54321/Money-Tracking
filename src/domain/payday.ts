// Payday: a fixed salary recorded once a month, as the full salary (income) and what is taken off it
// (spending in a category, or money moved to an account such as a provident fund). The pay account goes up
// by exactly the take-home pay. It records itself on the day; "Payday's here" records it earlier.
import { addMonthKey, monthKey, parseISO, toISO, daysInMonth, type ISODate, type MonthKey } from './dates';

export interface PayDeduction {
  id: string;
  name: string;
  amount: number;
  /** spending category it is recorded in… */
  categoryId?: string;
  /** …or the account it moves to (a provident fund, a savings account) */
  toAccountId?: string;
}

export interface Payday {
  active: boolean;
  /** account the take-home pay arrives in */
  accountId: string;
  incomeCategoryId?: string;
  /** full salary, before anything is taken off */
  gross: number;
  /** what actually arrives in the account */
  takeHome: number;
  /** spending category for what is taken off (after the extra lines), e.g. Tax & Social Security */
  deductCategoryId?: string;
  /** more lines taken off with fixed amounts */
  extras: PayDeduction[];
  /** a fixed day of the month, or the last Friday */
  rule: 'day' | 'lastFriday';
  day: number;
  /** first month to record */
  fromMonth: MonthKey;
  /** the last month already recorded (by itself or with "Payday's here") */
  paidMonth?: MonthKey;
}

/** Last Friday of a month. */
export function lastFriday(y: number, m: number): ISODate {
  const last = daysInMonth(y, m);
  const wd = new Date(Date.UTC(y, m - 1, last)).getUTCDay(); // 0 = Sunday … 5 = Friday
  return toISO(y, m, last - ((wd - 5 + 7) % 7));
}

/** The pay date in a month: the fixed day (the last day in shorter months) or the last Friday. */
export function payDate(p: Pick<Payday, 'rule' | 'day'>, month: MonthKey): ISODate {
  const { y, m } = parseISO(`${month}-01`);
  if (p.rule === 'lastFriday') return lastFriday(y, m);
  return toISO(y, m, Math.min(Math.max(1, Math.round(p.day || 1)), daysInMonth(y, m)));
}

/** The next month still to be recorded. */
export function nextPayMonth(p: Payday): MonthKey {
  if (!p.paidMonth) return p.fromMonth;
  const after = addMonthKey(p.paidMonth, 1);
  return after > p.fromMonth ? after : p.fromMonth;
}

export function nextPayDate(p: Payday): ISODate {
  return payDate(p, nextPayMonth(p));
}

/** Months whose pay date has come and that are not recorded yet (catches up missed months). */
export function dueMonths(p: Payday, today: ISODate): MonthKey[] {
  if (!p.active) return [];
  const out: MonthKey[] = [];
  for (let m = nextPayMonth(p); payDate(p, m) <= today && out.length < 120; m = addMonthKey(m, 1)) out.push(m);
  return out;
}

/** What goes to the main deduction category: full salary − take-home − the extra lines. */
export function mainDeduction(gross: number, takeHome: number, extras: PayDeduction[]): number {
  return round2(gross - takeHome - extras.reduce((s, x) => s + (x.amount || 0), 0));
}

/** Where to start when setting up: this month if its pay date is still ahead, otherwise next month. */
export function firstMonthFrom(p: Pick<Payday, 'rule' | 'day'>, today: ISODate): MonthKey {
  const m = monthKey(today);
  return payDate(p, m) > today ? m : addMonthKey(m, 1);
}

export interface PayEntry {
  id: string;
  kind: 'income' | 'expense' | 'transfer';
  accountId: string;
  toAccountId?: string;
  amount: number;
  categoryId?: string;
  note: string;
}

/**
 * The entries one payday records. Ids are fixed per profile and month, so recording twice never doubles.
 * `amounts` lets "Payday's here" use a different full salary or take-home for that one month.
 */
export function payEntries(
  p: Payday,
  profileId: string,
  month: MonthKey,
  amounts: { gross: number; takeHome: number } = { gross: p.gross, takeHome: p.takeHome },
): PayEntry[] {
  const base = `pay-${profileId}-${month}`;
  const out: PayEntry[] = [
    {
      id: `${base}-salary`,
      kind: 'income',
      accountId: p.accountId,
      amount: amounts.gross,
      categoryId: p.incomeCategoryId,
      note: 'Payday',
    },
  ];
  for (const x of p.extras) {
    if (!(x.amount > 0)) continue;
    if (x.toAccountId)
      out.push({
        id: `${base}-${x.id}`,
        kind: 'transfer',
        accountId: p.accountId,
        toAccountId: x.toAccountId,
        amount: x.amount,
        note: `Payday · ${x.name}`,
      });
    else
      out.push({
        id: `${base}-${x.id}`,
        kind: 'expense',
        accountId: p.accountId,
        amount: x.amount,
        categoryId: x.categoryId,
        note: `Payday · ${x.name}`,
      });
  }
  const rest = mainDeduction(amounts.gross, amounts.takeHome, p.extras);
  if (rest > 0.005)
    out.push({
      id: `${base}-deduct`,
      kind: 'expense',
      accountId: p.accountId,
      amount: rest,
      categoryId: p.deductCategoryId,
      note: 'Payday · taken off',
    });
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
