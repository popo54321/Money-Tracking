// Account balances worked out from the opening balance plus every entry.
import type { ISODate } from './dates';
import { convert, GOLD_CODE, type RateTable } from './fx';
import { accountCurrencies, type Account, type Tx } from './types';

/**
 * How much an entry changes one wallet of an account: the main wallet (no `pocket`) or another currency it holds.
 * A move between two wallets of the same account takes from one and adds to the other.
 */
export function txDelta(tx: Tx, accountId: string, pocket?: string): number {
  let d = 0;
  if (tx.accountId === accountId && (tx.pocket || undefined) === pocket) {
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
  if (tx.kind === 'transfer' && tx.toAccountId === accountId && (tx.toPocket || undefined) === pocket)
    d += tx.toAmount ?? tx.amount;
  return d;
}

/** The main wallet's balance (for accounts with one currency, the balance). */
export function balanceOf(account: Account, txs: Tx[], asOf?: ISODate): number {
  let b = account.openingBalance;
  for (const t of txs) {
    if (asOf && t.date > asOf) continue;
    if (t.accountId === account.id || t.toAccountId === account.id) b += txDelta(t, account.id);
  }
  return b;
}

/** Main-wallet balances of all accounts in one pass. */
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

/** The other wallets' balances of every account that has them: account → currency → balance. */
export function walletsByAccount(accounts: Account[], txs: Tx[], asOf?: ISODate): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const a of accounts) {
    const extra = accountCurrencies(a).slice(1);
    if (extra.length) out.set(a.id, new Map(extra.map((c) => [c, 0])));
  }
  if (!out.size) return out;
  for (const t of txs) {
    if (asOf && t.date > asOf) continue;
    for (const [id, pocket] of [
      [t.accountId, t.pocket],
      [t.toAccountId, t.toPocket],
    ] as const) {
      if (!id || !pocket) continue;
      const w = out.get(id);
      // each side once: a move between two wallets of one account takes from one and adds to the other
      if (w && w.has(pocket)) w.set(pocket, w.get(pocket)! + txDelta(t, id, pocket));
    }
  }
  return out;
}

/** What an account's other wallets are worth together in `target` (null when one has no rate). */
export function walletsValue(wallets: Map<string, number> | undefined, rates: RateTable, target: string): number | null {
  let total = 0;
  for (const [cur, bal] of wallets ?? []) {
    if (Math.abs(bal) < 1e-9) continue;
    const v = convert(bal, cur, target, rates);
    if (v === null) return null;
    total += v;
  }
  return total;
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
 * A card's debt counts only for the part no paying account has set aside, so it is never taken off twice;
 * extra paid into a card (more than was owed) counts as free.
 */
export function freeLiquid(
  accounts: Account[],
  balances: Map<string, number>,
  free: Map<string, number>,
  cardCovered: Map<string, number>,
  rates: RateTable,
  target: string,
  wallets: Map<string, Map<string, number>> = new Map(),
): number {
  let total = 0;
  for (const a of accounts) {
    if (a.archived || !a.includeInNetWorth || !isLiquid(a)) continue;
    // other currencies held are free money too (nothing is set aside in them)
    total += walletsValue(wallets.get(a.id), rates, target) ?? 0;
    const bal = balances.get(a.id) ?? 0;
    // a card counts its debt only where nothing is set aside for it; extra paid into a card is money to spend
    const own = a.type === 'credit' ? (bal > 0 ? bal : Math.min(0, bal + (cardCovered.get(a.id) ?? 0))) : (free.get(a.id) ?? bal);
    const v = accountValue(a, own, rates, target);
    if (v !== null) total += v;
  }
  return total;
}

export function netWorth(
  accounts: Account[],
  balances: Map<string, number>,
  rates: RateTable,
  target: string,
  wallets: Map<string, Map<string, number>> = new Map(),
): NetWorth {
  let total = 0;
  let liquid = 0;
  const missing: string[] = [];
  const byGroup = new Map<string, number>();
  for (const a of accounts) {
    if (a.archived || !a.includeInNetWorth) continue;
    const main = accountValue(a, balances.get(a.id) ?? 0, rates, target);
    const extra = walletsValue(wallets.get(a.id), rates, target);
    if (main === null || extra === null) {
      if ((balances.get(a.id) ?? 0) !== 0 || extra === null) missing.push(a.name);
      continue;
    }
    const v = main + extra;
    total += v;
    if (isLiquid(a)) liquid += v;
    byGroup.set(a.group, (byGroup.get(a.group) ?? 0) + v);
  }
  return { total, liquid, missing, byGroup };
}

/**
 * Deleting an account together with its moves changes the other accounts: each loses what those moves added (or
 * gets back what they took, fees included). Per other account and currency, the change in its balance.
 */
export function deleteEffects(accountId: string, txs: Tx[]): { accountId: string; currency?: string; change: number }[] {
  const moves = txs.filter(
    (t) => t.kind === 'transfer' && t.accountId !== t.toAccountId && (t.accountId === accountId || t.toAccountId === accountId),
  );
  const ids = new Set(moves.map((t) => t.id));
  const out = new Map<string, { accountId: string; currency?: string; change: number }>();
  const add = (id: string, pocket: string | undefined, v: number) => {
    const k = `${id}|${pocket ?? ''}`;
    const e = out.get(k) ?? { accountId: id, currency: pocket, change: 0 };
    e.change += v;
    out.set(k, e);
  };
  for (const t of moves) {
    if (t.accountId !== accountId) add(t.accountId, t.pocket, t.amount); // the money comes back
    if (t.toAccountId && t.toAccountId !== accountId) add(t.toAccountId, t.toPocket, -(t.toAmount ?? t.amount));
  }
  // fees of those moves are deleted with them: their account gets the fee back
  for (const t of txs) if (t.feeFor && ids.has(t.feeFor) && t.accountId !== accountId) add(t.accountId, t.pocket, t.amount);
  return [...out.values()].filter((e) => Math.abs(e.change) > 1e-9);
}
