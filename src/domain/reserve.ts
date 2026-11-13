// Money to keep ready: the next payment of each repeating bill, and everything owed on credit cards
// (the statement due plus what was spent since). Anything paid by card is kept in the card's paying account,
// never on the card itself, so it does not eat into the card's limit.
import { diffDays, type ISODate } from './dates';
import { cardStatus } from './creditCard';
import { aheadMonths, buildUp, holdStart, monthlyEquivalent, nextUnposted } from './recurring';
import type { Account, Recurring, Tx } from './types';

export interface UpcomingItem {
  key: string;
  source: 'recurring' | 'card';
  refId: string;
  label: string;
  kind: 'income' | 'expense' | 'transfer' | 'card';
  date: ISODate;
  daysAway: number;
  /** account the money leaves (or arrives in, for income) */
  accountId: string;
  /** account where the money should be kept ready (a card's paying account for card charges) */
  reserveAccountId?: string;
  amount: number;
  /** amount to keep ready when it differs from `amount` (a card: all that is owed; a yearly bill: what has built up) */
  reserveAmount?: number;
  /** a bill that repeats less often than monthly, building up: months set aside so far, of how many */
  buildUp?: { months: number; of: number };
  /** a small bill set aside only shortly before it is due: nothing yet, the whole amount from this day */
  holdFrom?: ISODate;
  currency: string;
  reserved: boolean;
  perMonth?: number;
  overdue?: boolean;
}

export function upcomingItems(accounts: Account[], recurring: Recurring[], txs: Tx[], today: ISODate): UpcomingItem[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out: UpcomingItem[] = [];

  for (const r of recurring) {
    if (!r.active) continue;
    const next = nextUnposted(r, r.lastPosted);
    if (!next) continue;
    const acc = byId.get(r.accountId);
    if (!acc) continue;
    let reserveAccountId: string | undefined;
    if (r.reserve && r.kind !== 'income') {
      // paid by card: kept in the card's paying account (a card without one has nowhere to keep it)
      reserveAccountId = acc.type === 'credit' ? acc.payFromAccountId : acc.id;
    }
    // small bills: set aside in full only in the last months before they are due
    const ahead = aheadMonths(r);
    const from = ahead !== null ? holdStart(next, ahead) : undefined;
    const waiting = !!from && today < from;
    // yearly (and other longer) bills build up month by month unless held in full
    const grow = !r.holdInFull && ahead === null ? buildUp(r, next, today) : { months: 0, of: 0 };
    const growing = !!reserveAccountId && grow.of > 0 && grow.months < grow.of;
    out.push({
      key: `r:${r.id}`,
      source: 'recurring',
      refId: r.id,
      label: r.name,
      kind: r.kind,
      date: next,
      daysAway: diffDays(today, next),
      accountId: acc.id,
      reserveAccountId,
      amount: r.amount,
      reserveAmount: growing ? Math.round(((r.amount * grow.months) / grow.of) * 100) / 100 : undefined,
      buildUp: growing ? grow : undefined,
      holdFrom: reserveAccountId && waiting ? from : undefined,
      currency: acc.currency,
      reserved: !!reserveAccountId && !waiting,
      perMonth: monthlyEquivalent(r.amount, r.freq, r.every),
    });
  }

  for (const card of accounts) {
    if (card.type !== 'credit' || card.archived || !card.statementDay) continue;
    const st = cardStatus(card, txs, today);
    // the last statement, while some of it is unpaid
    if (st.remaining > 0.005 && st.dueDate) {
      out.push({
        key: `c:${card.id}:${st.lastStatement}`,
        source: 'card',
        refId: card.id,
        label: `${card.name} statement`,
        kind: 'card',
        date: st.dueDate,
        daysAway: diffDays(today, st.dueDate),
        accountId: card.id,
        reserveAccountId: card.payFromAccountId,
        amount: st.remaining,
        currency: card.currency,
        reserved: !!card.payFromAccountId,
        overdue: st.overdue,
      });
    }
    // spent since the statement: on the next statement, due the month after
    if (st.nextSoFar > 0.005 && st.nextStatement && st.nextDue) {
      out.push({
        key: `c:${card.id}:next:${st.nextStatement}`,
        source: 'card',
        refId: card.id,
        label: `${card.name} next statement (so far)`,
        kind: 'card',
        date: st.nextDue,
        daysAway: diffDays(today, st.nextDue),
        accountId: card.id,
        reserveAccountId: card.payFromAccountId,
        amount: st.nextSoFar,
        currency: card.currency,
        reserved: !!card.payFromAccountId,
      });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.label.localeCompare(b.label)));
}

/** Total reserved per account, in each account's own currency (amounts in another currency are skipped). */
export function reservedByAccount(items: UpcomingItem[], accounts: Account[]): Map<string, number> {
  const cur = new Map(accounts.map((a) => [a.id, a.currency]));
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it.reserved || !it.reserveAccountId) continue;
    if (cur.get(it.reserveAccountId) !== it.currency) continue;
    m.set(it.reserveAccountId, (m.get(it.reserveAccountId) ?? 0) + (it.reserveAmount ?? it.amount));
  }
  return m;
}
