// Income and spending by category for a date range, grouped like the year sheets.
import type { ISODate } from './dates';
import { convert, type RateTable } from './fx';
import { sum } from './money';
import { EXPENSE_GROUPS, type Category, type Tx } from './types';

export interface CatLine {
  category: Category | null;
  name: string;
  total: number;
  count: number;
  /** spending only: money back taken off `total` (a positive number) */
  back: number;
}

export interface GroupLine {
  group: string;
  total: number;
  /** money back taken off `total` (a positive number) */
  back: number;
  cats: CatLine[];
}

export interface Summary {
  income: { total: number; cats: CatLine[] };
  expense: { total: number; groups: GroupLine[] };
  surplus: number;
  /** surplus ÷ income, or null when there is no income */
  savingsRate: number | null;
  /** entries whose value could not be converted to the target currency */
  unconverted: number;
}

/** Value of an entry in `target`, using the value stamped when it was entered. */
export function txValue(tx: Tx, target: string, rates: RateTable): number | null {
  if (tx.valueCurrency === target) return tx.value;
  return convert(tx.value, tx.valueCurrency, target, rates);
}

export function summarise(
  txs: Tx[],
  categories: Category[],
  from: ISODate,
  to: ISODate,
  target: string,
  rates: RateTable,
  includeEmpty = false,
): Summary {
  const catById = new Map(categories.map((c) => [c.id, c]));
  type Acc = { total: number; count: number; back: number };
  const incomeTotals = new Map<string, Acc>();
  const expenseTotals = new Map<string, Acc>();
  let unconverted = 0;

  for (const t of txs) {
    if (t.date < from || t.date > to) continue;
    if (t.kind !== 'income' && t.kind !== 'expense') continue;
    // written on another phone in the family: it is their income or spending, not this phone's
    if (t.remoteAuthor) continue;
    const v = txValue(t, target, rates);
    if (v === null) {
      unconverted++;
      continue;
    }
    const key = t.categoryId && catById.has(t.categoryId) ? t.categoryId : '';
    const m = t.kind === 'income' ? incomeTotals : expenseTotals;
    const cur = m.get(key) ?? { total: 0, count: 0, back: 0 };
    cur.total += v;
    cur.count += 1;
    if (t.kind === 'expense' && v < 0) cur.back -= v;
    m.set(key, cur);
  }

  const ordered = [...categories].sort((a, b) => a.order - b.order);
  const line = (c: Category | null, m: Map<string, Acc>): CatLine => {
    const x = m.get(c ? c.id : '') ?? { total: 0, count: 0, back: 0 };
    return { category: c, name: c ? c.name : 'Uncategorised', total: x.total, count: x.count, back: x.back };
  };

  const incomeCats = ordered
    .filter((c) => c.kind === 'income' && (includeEmpty ? !c.archived || incomeTotals.has(c.id) : incomeTotals.has(c.id)))
    .map((c) => line(c, incomeTotals));
  if (incomeTotals.has('')) incomeCats.push(line(null, incomeTotals));

  const groupNames = [...EXPENSE_GROUPS];
  for (const c of ordered) if (c.kind === 'expense' && !groupNames.includes(c.group)) groupNames.push(c.group);
  const groups: GroupLine[] = groupNames
    .map((g) => {
      const cats = ordered
        .filter(
          (c) =>
            c.kind === 'expense' &&
            c.group === g &&
            (includeEmpty ? !c.archived || expenseTotals.has(c.id) : expenseTotals.has(c.id)),
        )
        .map((c) => line(c, expenseTotals));
      return { group: g, total: sum(cats.map((c) => c.total)), back: sum(cats.map((c) => c.back)), cats };
    })
    .filter((g) => g.cats.length > 0);
  if (expenseTotals.has('')) {
    const l = line(null, expenseTotals);
    groups.push({ group: 'Other', total: l.total, back: l.back, cats: [l] });
  }

  const incomeTotal = sum(incomeCats.map((c) => c.total));
  const expenseTotal = sum(groups.map((g) => g.total));
  const surplus = incomeTotal - expenseTotal;
  return {
    income: { total: incomeTotal, cats: incomeCats },
    expense: { total: expenseTotal, groups },
    surplus,
    savingsRate: incomeTotal > 0 ? surplus / incomeTotal : null,
    unconverted,
  };
}
