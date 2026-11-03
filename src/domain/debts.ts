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
  const events = [...debt.events].filter((e) => e.amount > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type === 'lend' ? -1 : 1));
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
