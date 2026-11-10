// Saving targets (wishlist): how far along each one is and when it can be bought.
import { addMonthsClamped, diffDays, parseISO, type ISODate } from './dates';
import { allocate, decimalsFor } from './money';

export interface Goal {
  id: string;
  profileId: string;
  name: string;
  emoji: string;
  price: number;
  currency: string;
  /** kept for old backups; the saved amount is always this target's own record now */
  source: 'manual' | 'account';
  /** saved so far as of `countFrom` (the record; spending from the account never changes it) */
  saved: number;
  /** the account the money is kept in (shown in that account's split); optional */
  accountId?: string;
  /** saving per month, added to `saved` automatically on `addDay` each month until the price is reached */
  monthly: number;
  /** day of the month the monthly saving is added (1–31, default 1; short months use their last day) */
  addDay?: number;
  /** monthly additions count from the day after this date */
  countFrom?: ISODate;
  /** the account fell below its targets and this target was cut: when, and what it had before (for Put back) */
  lowered?: { date: ISODate; from: number };
  targetDate?: ISODate;
  note?: string;
  done: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalStatus {
  saved: number;
  remaining: number;
  /** 0–1 */
  progress: number;
  reached: boolean;
  /** months still needed at the planned monthly saving */
  monthsLeft: number | null;
  /** when it can be bought at the planned monthly saving */
  eta: ISODate | null;
  /** per month needed to reach the target date */
  neededPerMonth: number | null;
  monthsToTarget: number | null;
}

/** How many times `day` of the month falls after `from` and on or before `to`. */
export function monthlyOccurrences(from: ISODate, to: ISODate, day: number): number {
  if (to <= from) return 0;
  const a = parseISO(from);
  const b = parseISO(to);
  let n = 0;
  for (let y = a.y, m = a.m; y < b.y || (y === b.y && m <= b.m); m === 12 ? ((m = 1), y++) : m++) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const date = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
    if (date > from && date <= to) n++;
  }
  return n;
}

/** The saved amount today: the record plus each monthly saving since `countFrom`, never above the price. */
export function goalSaved(goal: Goal, today: ISODate): number {
  if (goal.done || !goal.monthly || !goal.countFrom) return goal.saved;
  const adds = monthlyOccurrences(goal.countFrom, today, goal.addDay ?? 1) * goal.monthly;
  const total = goal.saved + adds;
  return goal.price > 0 ? Math.min(Math.max(goal.price, goal.saved), total) : total;
}

export function goalStatus(goal: Goal, savedNow: number, today: ISODate): GoalStatus {
  const saved = Math.max(0, savedNow);
  const remaining = Math.max(0, goal.price - saved);
  const progress = goal.price > 0 ? Math.min(1, saved / goal.price) : 0;
  const reached = goal.price > 0 && remaining <= 0.005;
  const { y, m, d } = parseISO(today);
  let monthsLeft: number | null = null;
  let eta: ISODate | null = null;
  if (reached) {
    monthsLeft = 0;
    eta = today;
  } else if (goal.monthly > 0) {
    monthsLeft = Math.ceil(remaining / goal.monthly - 1e-9);
    eta = addMonthsClamped(y, m, d, monthsLeft);
  }
  let neededPerMonth: number | null = null;
  let monthsToTarget: number | null = null;
  if (goal.targetDate && !reached) {
    // whole calendar months between today and the target date
    const t = parseISO(goal.targetDate);
    const months = (t.y - y) * 12 + (t.m - m) - (t.d < d ? 1 : 0);
    monthsToTarget = Math.max(0, months);
    neededPerMonth = diffDays(today, goal.targetDate) <= 0 ? remaining : remaining / Math.max(1, monthsToTarget);
  }
  return { saved, remaining, progress, reached, monthsLeft, eta, neededPerMonth, monthsToTarget };
}

export interface GoalRow {
  goal: Goal;
  /** saved amount shown: the record, lowered in proportion when its account holds less than all its targets */
  saved: number;
  /** the target's own record (what it would be with enough money in the account) */
  recorded: number;
}

/**
 * Targets kept in an account share what that account really holds.
 * While the account holds at least the sum of its targets, every target keeps its record.
 * When it holds less, every target goes down in the same proportion. The app then saves the lower amounts:
 * money that left the account is treated as spent, so targets never go back up by themselves.
 * `room`: per account, what is there for targets (balance minus the account's own splits).
 */
export function fitToAccounts(goals: Goal[], today: ISODate, room: Map<string, number>): GoalRow[] {
  const rows = goals.map((g) => ({ goal: g, recorded: goalSaved(g, today), saved: goalSaved(g, today) }));
  const byAccount = new Map<string, GoalRow[]>();
  for (const r of rows) {
    const id = r.goal.accountId;
    if (!id || r.goal.done || !room.has(id)) continue;
    byAccount.set(id, [...(byAccount.get(id) ?? []), r]);
  }
  for (const [id, list] of byAccount) {
    const total = list.reduce((x, r) => x + r.recorded, 0);
    const there = Math.max(0, room.get(id) ?? 0);
    if (total <= there + 1e-9 || total <= 0) continue;
    // the same share for every target, rounded so the amounts add up to exactly what the account holds
    const shares = allocate(
      there,
      list.map((r) => r.recorded),
      decimalsFor(list[0].goal.currency),
    );
    list.forEach((r, i) => (r.saved = shares[i]));
  }
  return rows;
}
