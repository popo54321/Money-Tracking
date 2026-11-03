// Saving targets (wishlist): how far along each one is and when it can be bought.
import { addMonthsClamped, diffDays, parseISO, type ISODate } from './dates';

export interface Goal {
  id: string;
  profileId: string;
  name: string;
  emoji: string;
  price: number;
  currency: string;
  /** manual = saved amount typed in; account = saved amount is a linked account's balance */
  source: 'manual' | 'account';
  saved: number;
  accountId?: string;
  /** planned saving per month */
  monthly: number;
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
