// Account balances worked out from the opening balance plus every entry.
import type { ISODate } from './dates';
import { convert, GOLD_CODE, type RateTable } from './fx';
import type { Account, Tx } from './types';

/** How much `tx` changes the balance of `accountId`, in that account's currency. */
export function txDelta(tx: Tx, accountId: string): number {
  let d = 0;
  if (tx.accountId === accountId) {
    switch (tx.kind) {
      case 'income':
        d += tx.amount;
        break;
      case 'expense':
      case 'transfer':
        d -= tx.amount;
        break;
      case 'adjust':
        d += tx.amount;
        break;
    }
  }
  if (tx.kind === 'transfer' && tx.toAccountId === accountId) d += tx.toAmount ?? tx.amount;
  return d;
}

export function balanceOf(account: Account, txs: Tx[], asOf?: ISODate): number {
  let b = account.openingBalance;
  for (const t of txs) {
    if (asOf && t.date > asOf) continue;
    if (t.accountId === account.id || t.toAccountId === account.id) b += txDelta(t, account.id);
  }
  return b;
}

/** Balances of all accounts in one pass. */
export function balancesByAccount(accounts: Account[], txs: Tx[], asOf?: ISODate): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of accounts) m.set(a.id, a.openingBalance);
  for (const t of txs) {
    if (asOf && t.date > asOf) continue;
    if (m.has(t.accountId)) m.set(t.accountId, m.get(t.accountId)! + txDelta(t, t.accountId));
    if (t.kind === 'transfer' && t.toAccountId && t.toAccountId !== t.accountId && m.has(t.toAccountId)) {
      m.set(t.toAccountId, m.get(t.toAccountId)! + txDelta(t, t.toAccountId));
    }
  }
  return m;
}

/**
 * Value of an account balance in `target` currency.
 * BTC uses the live BTC rate; gold/units use the price typed in on the account.
 */
export function accountValue(account: Account, balance: number, rates: RateTable, target: string): number | null {
  if (account.type === 'units') {
    if (account.unitPriceSource === 'live-gold') {
      const live = convert(balance, GOLD_CODE, target, rates);
      if (live !== null) return live;
    }
    if (!account.unitPrice) return null;
    return convert(balance * account.unitPrice, account.unitPriceCurrency || target, target, rates);
  }
  return convert(balance, account.currency, target, rates);
}

/** Value of one unit of the account's currency in `target`, used to stamp entries. */
export function unitValue(account: Account, rates: RateTable, target: string): number | null {
  return accountValue(account, 1, rates, target);
}

export interface NetWorth {
  total: number;
  /** the part that can be spent now: accounts marked liquid (card debt counts against it) */
  liquid: number;
  missing: string[];
  byGroup: Map<string, number>;
}

/** Bank, cash and card money is liquid unless the account says otherwise; investments, BTC, gold and insurance are not. */
const LIQUID_TYPES = new Set(['bank', 'cash', 'debit', 'topup', 'credit']);
export function isLiquid(a: Account): boolean {
  return a.liquid ?? LIQUID_TYPES.has(a.type);
}

/**
 * The free part of liquid money, in `target`: each liquid account's Free (after bills, splits and targets).
 * A card's debt counts only for the part no paying account has set aside, so it is never taken off twice.
 */
export function freeLiquid(
  accounts: Account[],
  balances: Map<string, number>,
  free: Map<string, number>,
  cardCovered: Map<string, number>,
  rates: RateTable,
  target: string,
): number {
  let total = 0;
  for (const a of accounts) {
    if (a.archived || !a.includeInNetWorth || !isLiquid(a)) continue;
    const bal = balances.get(a.id) ?? 0;
    const own = a.type === 'credit' ? Math.min(0, bal + (cardCovered.get(a.id) ?? 0)) : (free.get(a.id) ?? bal);
    const v = accountValue(a, own, rates, target);
    if (v !== null) total += v;
  }
  return total;
}

export function netWorth(accounts: Account[], balances: Map<string, number>, rates: RateTable, target: string): NetWorth {
  let total = 0;
  let liquid = 0;
  const missing: string[] = [];
  const byGroup = new Map<string, number>();
  for (const a of accounts) {
    if (a.archived || !a.includeInNetWorth) continue;
    const v = accountValue(a, balances.get(a.id) ?? 0, rates, target);
    if (v === null) {
      if ((balances.get(a.id) ?? 0) !== 0) missing.push(a.name);
      continue;
    }
    total += v;
    if (isLiquid(a)) liquid += v;
    byGroup.set(a.group, (byGroup.get(a.group) ?? 0) + v);
  }
  return { total, liquid, missing, byGroup };
}
