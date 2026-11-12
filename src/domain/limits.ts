// Monthly limits on a category or a whole group: spent so far, what is left, and about how much a day.
import { addDays, diffDays, type ISODate } from './dates';
import { convert, type RateTable } from './fx';
import { occurrencesBetween } from './recurring';
import { txValue, type Summary } from './summary';
import type { Account, Category, Recurring, Tx } from './types';

export interface LimitLine {
  key: string;
  name: string;
  /** set when the limit is on one category */
  category?: Category;
  group?: string;
  limit: number;
  spent: number;
  /** still to come this month: repeating payments not yet recorded and entries dated later this month */
  planned: number;
  /** limit − spent − planned */
  left: number;
  /** (spent + planned) ÷ limit */
  used: number;
  level: 'ok' | 'warn' | 'over';
  /** days left in the month, today included */
  daysLeft: number;
  /** what is left ÷ days left (none when nothing is left) */
  perDay: number | null;
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

export function limitLines(
  summary: Summary,
  categories: Category[],
  groupLimits: Record<string, number> | undefined,
  today: ISODate,
  monthEnd: ISODate,
  planned: Map<string, number> = new Map(),
): LimitLine[] {
  const daysLeft = Math.max(1, diffDays(today, monthEnd) + 1);
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
      key,
      name,
      limit,
      spent,
      planned: plan,
      left,
      used,
      level: used > 1 + 1e-9 ? 'over' : used >= 0.8 ? 'warn' : 'ok',
      daysLeft,
      perDay: left > 0 ? left / daysLeft : null,
      ...extra,
    };
  };
  const out: LimitLine[] = [];
  for (const [group, limit] of Object.entries(groupLimits ?? {}))
    if (limit > 0)
      out.push(line(`g:${group}`, group, limit, spentByGroup.get(group) ?? 0, plannedByGroup.get(group) ?? 0, { group }));
  for (const c of categories)
    if (c.kind === 'expense' && !c.archived && c.limit && c.limit > 0)
      out.push(
        line(`c:${c.id}`, c.name, c.limit, spentByCat.get(c.id) ?? 0, planned.get(c.id) ?? 0, {
          category: c,
          group: c.group,
        }),
      );
  return out;
}
