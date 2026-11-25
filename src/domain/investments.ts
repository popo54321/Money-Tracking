// Investment accounts: capital (what was put in) against value (the balance now), with the average-cost method:
// every baht in the account is part capital and part profit in the same ratio, so money moved out takes out
// capital and profit in that ratio, and the profit % stays the same.
import { txDelta } from './balances';
import type { ISODate } from './dates';
import type { Account, Category, Tx } from './types';

export interface InvestmentStatus {
  /** in the account's currency */
  capital: number;
  value: number;
  profit: number;
  /** profit ÷ capital (null without capital) */
  profitPct: number | null;
  /** profit that left the account with money moved out */
  takenOut: number;
  /** the last time the value was set by hand (a balance adjustment), or the capital typed */
  updated: ISODate | null;
}

/** Income that is a return (dividends, interest), not new money put in. */
export function isReturnIncome(category: Category | undefined): boolean {
  return !!category && /dividend|interest|investing income|return|ปันผล|ดอกเบี้ย/i.test(category.name);
}

export function isInvestmentAccount(a: Account): boolean {
  return a.type === 'investment' || !!a.showInInvestments;
}

export function investmentStatus(account: Account, txs: Tx[], categories: Map<string, Category>): InvestmentStatus {
  const mark = account.capital;
  let value = account.openingBalance;
  // with no capital typed, the starting balance counts as what was put in
  let capital = mark ? 0 : (account.costBasis ?? account.openingBalance);
  let takenOut = 0;
  let updated: ISODate | null = null;
  const mine = txs
    .filter((t) => t.accountId === account.id || t.toAccountId === account.id)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  const apply = (t: Tx) => {
    const d = txDelta(t, account.id);
    if (d === 0) return;
    const between = t.kind === 'transfer' && t.accountId === t.toAccountId;
    if (t.kind === 'transfer' && !between) {
      if (d > 0) capital += d;
      else {
        // moved out: the same share of capital leaves as of value
        const frac = value > 0 ? Math.min(1, -d / value) : 1;
        const capOut = capital * frac;
        takenOut += -d - capOut;
        capital -= capOut;
      }
    } else if (t.kind === 'income' && d > 0 && !isReturnIncome(categories.get(t.categoryId ?? ''))) {
      capital += d;
    }
    // returns, fees, spending, money back and market changes move the value only
    value += d;
  };
  for (const t of mine) if (t.kind === 'adjust') updated = t.date;
  if (mark) {
    // the capital typed covers everything held when it was typed; only later entries change it
    for (const t of mine) if (t.createdAt <= mark.setAt) value += txDelta(t, account.id);
    capital = mark.amount;
    for (const t of mine) if (t.createdAt > mark.setAt) apply(t);
    if (!updated) updated = new Date(mark.setAt).toISOString().slice(0, 10);
  } else {
    for (const t of mine) apply(t);
  }
  const profit = value - capital;
  return { capital, value, profit, profitPct: capital > 0 ? profit / capital : null, takenOut, updated };
}
