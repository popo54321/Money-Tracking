// Monthly limits on a category or a whole group: spent so far, what is left, and about how much a day.
import { diffDays, type ISODate } from './dates';
import type { Summary } from './summary';
import type { Category } from './types';

export interface LimitLine {
  key: string;
  name: string;
  /** set when the limit is on one category */
  category?: Category;
  group?: string;
  limit: number;
  spent: number;
  left: number;
  /** spent ÷ limit */
  used: number;
  level: 'ok' | 'warn' | 'over';
  /** days left in the month, today included */
  daysLeft: number;
  /** what is left ÷ days left (none when nothing is left) */
  perDay: number | null;
}

export function limitLines(
  summary: Summary,
  categories: Category[],
  groupLimits: Record<string, number> | undefined,
  today: ISODate,
  monthEnd: ISODate,
): LimitLine[] {
  const daysLeft = Math.max(1, diffDays(today, monthEnd) + 1);
  const spentByCat = new Map<string, number>();
  const spentByGroup = new Map<string, number>();
  for (const g of summary.expense.groups) {
    spentByGroup.set(g.group, g.total);
    for (const c of g.cats) if (c.category) spentByCat.set(c.category.id, c.total);
  }
  const line = (key: string, name: string, limit: number, spent: number, extra: Partial<LimitLine>): LimitLine => {
    const left = limit - spent;
    const used = limit > 0 ? spent / limit : 0;
    return {
      key,
      name,
      limit,
      spent,
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
    if (limit > 0) out.push(line(`g:${group}`, group, limit, spentByGroup.get(group) ?? 0, { group }));
  for (const c of categories)
    if (c.kind === 'expense' && !c.archived && c.limit && c.limit > 0)
      out.push(line(`c:${c.id}`, c.name, c.limit, spentByCat.get(c.id) ?? 0, { category: c, group: c.group }));
  return out;
}
