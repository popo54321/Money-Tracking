// Money to keep ready: the next payment of each repeating bill, and unpaid credit card statements.
import { diffDays, type ISODate } from './dates';
import { cardStatus } from './creditCard';
import { monthlyEquivalent, nextUnposted } from './recurring';
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
      reserveAccountId = acc.type === 'credit' && acc.payFromAccountId ? acc.payFromAccountId : acc.id;
    }
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
      currency: acc.currency,
      reserved: !!reserveAccountId,
      perMonth: monthlyEquivalent(r.amount, r.freq, r.every),
    });
  }

  for (const card of accounts) {
    if (card.type !== 'credit' || card.archived || !card.statementDay) continue;
    const st = cardStatus(card, txs, today);
    if (st.remaining <= 0.005 || !st.dueDate) continue;
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

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.label.localeCompare(b.label)));
}

/** Total reserved per account, in each account's own currency (amounts in another currency are skipped). */
export function reservedByAccount(items: UpcomingItem[], accounts: Account[]): Map<string, number> {
  const cur = new Map(accounts.map((a) => [a.id, a.currency]));
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it.reserved || !it.reserveAccountId) continue;
    if (cur.get(it.reserveAccountId) !== it.currency) continue;
    m.set(it.reserveAccountId, (m.get(it.reserveAccountId) ?? 0) + it.amount);
  }
  return m;
}
