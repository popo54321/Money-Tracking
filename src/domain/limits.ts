// Limits on a category or a whole group, per month, quarter or year: spent so far, what is left, and about how much
// a day (or a month, for quarters and years).
import { addDays, diffDays, monthEnd, parseISO, type ISODate } from './dates';
import { convert, type RateTable } from './fx';
import { occurrencesBetween } from './recurring';
import { txValue, type Summary } from './summary';
import type { Account, Category, LimitPeriod, Recurring, Tx } from './types';

/** The calendar month, quarter or year that `today` falls in. */
export function periodRange(period: LimitPeriod, today: ISODate): { from: ISODate; to: ISODate } {
  const { y, m } = parseISO(today);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (period === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (period === 'quarter') {
    const first = Math.floor((m - 1) / 3) * 3 + 1;
    return { from: `${y}-${pad(first)}-01`, to: monthEnd(`${y}-${pad(first + 2)}`) };
  }
  return { from: `${y}-${pad(m)}-01`, to: monthEnd(`${y}-${pad(m)}`) };
}

export const PERIOD_WORD: Record<LimitPeriod, string> = { month: 'month', quarter: 'quarter', year: 'year' };

export interface LimitLine {
  key: string;
  name: string;
  /** set when the limit is on one category */
  category?: Category;
  group?: string;
  limit: number;
  period: LimitPeriod;
  /** the dates the limit covers now */
  from: ISODate;
  to: ISODate;
  spent: number;
  /** still to come in the period: repeating payments not yet recorded and entries dated later this month */
  planned: number;
  /** limit − spent − planned */
  left: number;
  /** (spent + planned) ÷ limit */
  used: number;
  level: 'ok' | 'warn' | 'over';
  /** days left in the period, today included */
  daysLeft: number;
  /** what is left ÷ days left (none when nothing is left) */
  perDay: number | null;
  /** months left in the period, this one included (quarters and years) */
  monthsLeft: number;
  /** what is left ÷ months left (none when nothing is left) */
  perMonth: number | null;
}

export interface PlannedItem {
  key: string;
  date: ISODate;
  label: string;
  categoryId: string;
  accountId: string;
  /** in the account's currency */
  amount: number;
  currency: string;
  /** in `target` (null when it cannot be converted) */
  value: number | null;
  recurringId?: string;
}

/**
 * Spending still to come between `from` and `to`: each repeating expense occurrence not yet recorded
 * (any account) and each entry dated after today. Sorted by date.
 */
export function plannedItems(
  recurring: Recurring[],
  scheduled: Tx[],
  accounts: Account[],
  from: ISODate,
  to: ISODate,
  target: string,
  rates: RateTable,
): PlannedItem[] {
  const out: PlannedItem[] = [];
  const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
  for (const r of recurring) {
    if (!r.active || r.kind !== 'expense' || !r.categoryId) continue;
    const cur = currencyOf.get(r.accountId);
    if (!cur) continue;
    let start = r.lastPosted ? addDays(r.lastPosted, 1) : r.startDate;
    if (start < from) start = from;
    if (start > to) continue;
    for (const date of occurrencesBetween(r, start, to))
      out.push({
        key: `r:${r.id}:${date}`,
        date,
        label: r.name,
        categoryId: r.categoryId,
        accountId: r.accountId,
        amount: r.amount,
        currency: cur,
        value: convert(r.amount, cur, target, rates),
        recurringId: r.id,
      });
  }
  for (const t of scheduled)
    if (t.kind === 'expense' && t.categoryId && t.date >= from && t.date <= to)
      out.push({
        key: `t:${t.id}`,
        date: t.date,
        label: t.note || 'Entry',
        categoryId: t.categoryId,
        accountId: t.accountId,
        amount: t.amount,
        currency: currencyOf.get(t.accountId) ?? t.valueCurrency,
        value: txValue(t, target, rates),
      });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Spending still to come in the rest of this month, per category, in `target` (see plannedItems). */
export function plannedSpending(
  recurring: Recurring[],
  scheduled: Tx[],
  accounts: Account[],
  monthFrom: ISODate,
  monthEnd: ISODate,
  target: string,
  rates: RateTable,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of plannedItems(recurring, scheduled, accounts, monthFrom, monthEnd, target, rates))
    if (it.value !== null) out.set(it.categoryId, (out.get(it.categoryId) ?? 0) + it.value);
  return out;
}

/**
 * The limits of one period (month, quarter or year): `summary` and `planned` must cover that period (periodRange).
 * Limits set for other periods are left out, so call this once per period.
 */
export function limitLines(
  summary: Summary,
  categories: Category[],
  groupLimits: Record<string, number> | undefined,
  today: ISODate,
  periodEnd: ISODate,
  planned: Map<string, number> = new Map(),
  period: LimitPeriod = 'month',
  groupPeriods: Record<string, LimitPeriod> = {},
): LimitLine[] {
  const daysLeft = Math.max(1, diffDays(today, periodEnd) + 1);
  const t = parseISO(today);
  const e = parseISO(periodEnd);
  const monthsLeft = Math.max(1, (e.y - t.y) * 12 + (e.m - t.m) + 1);
  const from = periodRange(period, today).from;
  const spentByCat = new Map<string, number>();
  const spentByGroup = new Map<string, number>();
  for (const g of summary.expense.groups) {
    spentByGroup.set(g.group, g.total);
    for (const c of g.cats) if (c.category) spentByCat.set(c.category.id, c.total);
  }
  const plannedByGroup = new Map<string, number>();
  for (const c of categories)
    if (planned.has(c.id)) plannedByGroup.set(c.group, (plannedByGroup.get(c.group) ?? 0) + (planned.get(c.id) ?? 0));
  const line = (key: string, name: string, limit: number, spent: number, plan: number, extra: Partial<LimitLine>): LimitLine => {
    const left = limit - spent - plan;
    const used = limit > 0 ? (spent + plan) / limit : 0;
    return {
      key: `${period}:${key}`,
      name,
      limit,
      period,
      from,
      to: periodEnd,
      spent,
      planned: plan,
      left,
      used,
      level: used > 1 + 1e-9 ? 'over' : used >= 0.8 ? 'warn' : 'ok',
      daysLeft,
      perDay: left > 0 ? left / daysLeft : null,
      monthsLeft,
      perMonth: left > 0 ? left / monthsLeft : null,
      ...extra,
    };
  };
  const out: LimitLine[] = [];
  for (const [group, limit] of Object.entries(groupLimits ?? {}))
    if (limit > 0 && (groupPeriods[group] ?? 'month') === period)
      out.push(line(`g:${group}`, group, limit, spentByGroup.get(group) ?? 0, plannedByGroup.get(group) ?? 0, { group }));
  for (const c of categories)
    if (c.kind === 'expense' && !c.archived && c.limit && c.limit > 0 && (c.limitPeriod ?? 'month') === period)
      out.push(
        line(`c:${c.id}`, c.name, c.limit, spentByCat.get(c.id) ?? 0, planned.get(c.id) ?? 0, {
          category: c,
          group: c.group,
        }),
      );
  return out;
}
