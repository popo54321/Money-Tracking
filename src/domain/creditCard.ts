// Credit card statement cycle: what the last statement says, how much of it is still unpaid and when it is due.
import { addMonthsClamped, dayInMonth, diffDays, parseISO, type ISODate } from './dates';
import { balanceOf, txDelta } from './balances';
import type { Account, Tx } from './types';

/** Most recent statement date on or before `date`. */
export function statementOnOrBefore(date: ISODate, statementDay: number): ISODate {
  const { y, m } = parseISO(date);
  const thisMonth = dayInMonth(y, m, statementDay);
  if (thisMonth <= date) return thisMonth;
  return addMonthsClamped(y, m, statementDay, -1);
}

/** Next statement date strictly after `date`. */
export function statementAfter(date: ISODate, statementDay: number): ISODate {
  const { y, m } = parseISO(date);
  const thisMonth = dayInMonth(y, m, statementDay);
  if (thisMonth > date) return thisMonth;
  return addMonthsClamped(y, m, statementDay, 1);
}

/** Payment due date for a statement: the first `dueDay` after the statement date. */
export function dueDateFor(statementDate: ISODate, dueDay: number): ISODate {
  const { y, m } = parseISO(statementDate);
  const sameMonth = dayInMonth(y, m, dueDay);
  if (sameMonth > statementDate) return sameMonth;
  return addMonthsClamped(y, m, dueDay, 1);
}

export interface CardStatus {
  /** amount owed right now (positive) */
  owedNow: number;
  creditLimit?: number;
  available?: number;
  lastStatement?: ISODate;
  owedAtStatement: number;
  paidSinceStatement: number;
  /** still to pay from the last statement */
  remaining: number;
  dueDate?: ISODate;
  daysToDue?: number;
  overdue: boolean;
  nextStatement?: ISODate;
}

export function cardStatus(card: Account, txs: Tx[], today: ISODate): CardStatus {
  const owedNow = Math.max(0, -balanceOf(card, txs));
  const base: CardStatus = {
    owedNow,
    creditLimit: card.creditLimit,
    available: card.creditLimit ? card.creditLimit - owedNow : undefined,
    owedAtStatement: 0,
    paidSinceStatement: 0,
    remaining: 0,
    overdue: false,
  };
  if (!card.statementDay) return base;
  const last = statementOnOrBefore(today, card.statementDay);
  const owedAtStatement = Math.max(0, -balanceOf(card, txs, last));
  let paid = 0;
  for (const t of txs) {
    if (t.date <= last || t.date > today) continue;
    const d = txDelta(t, card.id);
    if (d > 0) paid += d;
  }
  const remaining = Math.max(0, owedAtStatement - paid);
  const due = card.dueDay ? dueDateFor(last, card.dueDay) : undefined;
  return {
    ...base,
    lastStatement: last,
    owedAtStatement,
    paidSinceStatement: paid,
    remaining,
    dueDate: due,
    daysToDue: due ? diffDays(today, due) : undefined,
    overdue: !!due && due < today && remaining > 0.005,
    nextStatement: statementAfter(today, card.statementDay),
  };
}
