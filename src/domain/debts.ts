// "Who owes me": money lent or borrowed, repayments, and interest worked out automatically.
import { addMonthsClamped, diffDays, parseISO, type ISODate } from './dates';

export type InterestType = 'none' | 'simple' | 'compound';

export interface DebtEvent {
  id: string;
  date: ISODate;
  /** lend = more money lent (or borrowed); repay = money paid back */
  type: 'lend' | 'repay';
  amount: number;
  note?: string;
  /** a payback also logged (as income, or as money back): that entry (kept in step when this line changes or is deleted) */
  txId?: string;
  /** lend: money paid for them as part of my spending (a bill or trip), so their payback is money back */
  spentCategoryId?: string;
  /** lend: the spending it was part of, when it was logged */
  spentTxId?: string;
}

export interface Debt {
  id: string;
  profileId: string;
  person: string;
  /** owedToMe = they owe me; iOwe = I owe them */
  direction: 'owedToMe' | 'iOwe';
  currency: string;
  interestType: InterestType;
  /** percentage, e.g. 1.5 means 1.5 % */
  ratePct: number;
  ratePer: 'month' | 'year';
  dueDate?: ISODate;
  note?: string;
  events: DebtEvent[];
  /** a credit card debt: the card it is on (added from the card's page) */
  cardId?: string;
  closed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DebtStatus {
  principal: number;
  interest: number;
  /** principal + unpaid interest */
  owed: number;
  totalLent: number;
  totalRepaid: number;
  totalInterest: number;
  startDate?: ISODate;
  /** what will be owed on the projection date if nothing is paid */
  projected?: number;
}

function dailyRate(d: Pick<Debt, 'ratePct' | 'ratePer'>): number {
  const r = (d.ratePct || 0) / 100;
  return d.ratePer === 'month' ? (r * 12) / 365 : r / 365;
}

/**
 * Work through the events in date order.
 * Simple: interest builds up on the money still owed (not on earlier interest).
 * Compound: unpaid interest is added to the amount owed every month on the start-date anniversary.
 * Repayments clear interest first, then the amount lent.
 */
export function debtStatus(debt: Debt, asOf: ISODate, projectTo?: ISODate): DebtStatus {
  const events = [...debt.events]
    .filter((e) => e.amount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type === 'lend' ? -1 : 1));
  const st: DebtStatus = { principal: 0, interest: 0, owed: 0, totalLent: 0, totalRepaid: 0, totalInterest: 0 };
  if (events.length === 0) return st;
  const start = events[0].date;
  st.startDate = start;
  const rate = debt.interestType === 'none' ? 0 : dailyRate(debt);
  const { y, m, d } = parseISO(start);

  let cursor = start;
  let monthIdx = 1;
  let nextCompound = debt.interestType === 'compound' ? addMonthsClamped(y, m, d, 1) : null;

  const accrueTo = (until: ISODate) => {
    while (cursor < until) {
      let stop = until;
      if (nextCompound && nextCompound <= until) stop = nextCompound;
      const days = diffDays(cursor, stop);
      if (days > 0 && rate > 0 && st.principal > 0) {
        const add = st.principal * rate * days;
        st.interest += add;
        st.totalInterest += add;
      }
      cursor = stop;
      if (nextCompound && stop === nextCompound) {
        st.principal += st.interest;
        st.interest = 0;
        monthIdx++;
        nextCompound = addMonthsClamped(y, m, d, monthIdx);
      }
    }
  };

  for (const e of events) {
    if (e.date > asOf) break;
    accrueTo(e.date);
    if (e.type === 'lend') {
      st.principal += e.amount;
      st.totalLent += e.amount;
    } else {
      st.totalRepaid += e.amount;
      let left = e.amount;
      const fromInterest = Math.min(left, st.interest);
      st.interest -= fromInterest;
      left -= fromInterest;
      st.principal -= left;
    }
  }
  accrueTo(asOf);
  st.owed = st.principal + st.interest;

  if (projectTo && projectTo > asOf) {
    const saved = { ...st };
    accrueTo(projectTo);
    const projected = st.principal + st.interest;
    Object.assign(st, saved);
    st.projected = projected;
  }
  return st;
}

/** Money in a summary: amount and currency (the screen's own formatting). */
type Fmt = (amount: number, currency: string) => string;

/**
 * A debt as text to paste in a chat: who owes whom, each line with its day and note, any interest, and what is
 * still owed.
 */
export function debtSummary(d: Debt, today: ISODate, fmt: Fmt, fmtDay: (d: ISODate) => string): string {
  const s = debtStatus(d, today);
  const theyOwe = d.direction === 'owedToMe';
  const who = d.person.trim() || 'Someone';
  const lines = [theyOwe ? `${who} owes me ${fmt(s.owed, d.currency)}` : `I owe ${who} ${fmt(s.owed, d.currency)}`];
  const events = [...d.events].filter((e) => e.amount > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // each item is just its day, what it was for and the amount; paybacks say so, with a minus
  for (const e of events) {
    const label = e.type === 'repay' ? `Paid back${e.note ? ` (${e.note})` : ''}` : e.note;
    const amount = e.type === 'repay' ? `−${fmt(e.amount, d.currency)}` : fmt(e.amount, d.currency);
    lines.push(`• ${fmtDay(e.date)}${label ? ` · ${label}` : ''}: ${amount}`);
  }
  if (s.totalInterest > 0.005) lines.push(`Interest so far: ${fmt(s.totalInterest, d.currency)}`);
  lines.push(`Still owed: ${fmt(s.owed, d.currency)} (as of ${fmtDay(today)})`);
  return lines.join('\n');
}

/** Everyone at once (open debts only): people who owe me first, then people I owe. */
export function everyoneSummary(debts: Debt[], today: ISODate, fmt: Fmt, fmtDay: (d: ISODate) => string): string {
  const open = debts.filter((d) => !d.closed && Math.abs(debtStatus(d, today).owed) > 0.005);
  const part = (dir: Debt['direction'], title: string) => {
    const list = open.filter((d) => d.direction === dir);
    return list.length ? [title, ...list.map((d) => debtSummary(d, today, fmt, fmtDay))].join('\n\n') : '';
  };
  return (
    [part('owedToMe', `💚 Who owes me (${fmtDay(today)})`), part('iOwe', '💗 Who I owe')].filter(Boolean).join('\n\n') ||
    'Nobody owes anything right now.'
  );
}

/** What a friend's payback is for, from a bill or trip split: "Alex payback for Xiamen trip". */
export function paybackFor(person: string, what: string): string {
  return `${person.trim() || 'Someone'} payback for ${what}`;
}

/**
 * The note for a payback logged in my money: "Alex payback for Xiamen trip" when what they owe came from a bill
 * or trip split, else "Payback from Alex". A note typed on the payback is added after it.
 */
export function paybackNote(d: Debt, typed?: string): string {
  const fromSplit = [...d.events]
    .filter((e) => e.type === 'lend' && (e.spentCategoryId || /^(bill|trip):/.test(e.id)) && e.note)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  const base = fromSplit
    ? paybackFor(d.person, fromSplit.note!.replace(/^.* payback for /, ''))
    : `Payback from ${d.person.trim() || 'someone'}`;
  return typed?.trim() ? `${base}: ${typed.trim()}` : base;
}
