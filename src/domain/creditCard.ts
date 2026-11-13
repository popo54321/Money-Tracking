// Credit card statement cycle: what the last statement says, how much of it is still unpaid and when it is due,
// and what has been spent since, which goes on the next statement (due the month after).
// Example, statement day 25, due day 10: 4,000 spent up to 25 Oct is due 10 Nov; 5,000 spent 26 Oct to 9 Nov and
// 6,000 more up to 25 Nov make the 25 Nov statement 11,000, due 10 Dec.
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
  /** paid in more than was owed: the bank keeps it as extra to spend, used up first by the next spending */
  extraCredit: number;
  creditLimit?: number;
  /** what can still be spent: the limit, less what is owed, plus any extra paid in */
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
  /** spent since the last statement (what is owed beyond the part of it still unpaid): on the next statement */
  nextSoFar: number;
  /** when the next statement will be due */
  nextDue?: ISODate;
}

export function cardStatus(card: Account, txs: Tx[], today: ISODate): CardStatus {
  const balance = balanceOf(card, txs);
  const owedNow = Math.max(0, -balance);
  const base: CardStatus = {
    owedNow,
    extraCredit: Math.max(0, balance),
    creditLimit: card.creditLimit,
    available: card.creditLimit ? card.creditLimit + balance : undefined,
    owedAtStatement: 0,
    paidSinceStatement: 0,
    remaining: 0,
    overdue: false,
    nextSoFar: 0,
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
  const nextStatement = statementAfter(today, card.statementDay);
  return {
    ...base,
    lastStatement: last,
    owedAtStatement,
    paidSinceStatement: paid,
    remaining,
    dueDate: due,
    daysToDue: due ? diffDays(today, due) : undefined,
    overdue: !!due && due < today && remaining > 0.005,
    nextStatement,
    nextSoFar: Math.max(0, owedNow - remaining),
    nextDue: card.dueDay ? dueDateFor(nextStatement, card.dueDay) : undefined,
  };
}
