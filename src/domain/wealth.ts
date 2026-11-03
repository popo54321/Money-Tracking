// Wealth preserve: BTC and gold holdings, what they cost (average-cost method) and profit or loss,
// like the BTC Growth sheet (Capital Assets Value, Avg Cost per BTC, Current Profit %).
import { accountValue, txDelta } from './balances';
import type { RateTable } from './fx';
import { txValue } from './summary';
import type { Account, Tx } from './types';

export interface HoldingLine {
  account: Account;
  units: number;
  /** what was paid for what is still held, in the target currency */
  cost: number;
  value: number | null;
}

export interface HoldingStatus {
  units: number;
  cost: number;
  value: number | null;
  avgCost: number | null;
  profit: number | null;
  profitPct: number | null;
  lines: HoldingLine[];
}

export function isBtcAccount(a: Account): boolean {
  return a.currency === 'BTC';
}

export function isGoldAccount(a: Account): boolean {
  return a.type === 'units' && (a.unitPriceSource === 'live-gold' || /baht|บาท|gold|ทอง/i.test(`${a.currency} ${a.name}`));
}

export function holdingStatus(accounts: Account[], txs: Tx[], rates: RateTable, target: string): HoldingStatus {
  const ids = new Set(accounts.map((a) => a.id));
  const units = new Map<string, number>();
  const cost = new Map<string, number>();
  for (const a of accounts) {
    units.set(a.id, a.openingBalance);
    cost.set(a.id, a.costBasis ?? 0);
  }
  const sorted = txs
    .filter((t) => ids.has(t.accountId) || (t.toAccountId !== undefined && ids.has(t.toAccountId)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));

  const add = (id: string, d: number, t: Tx) => {
    const u = units.get(id)!;
    const c = cost.get(id)!;
    if (d > 0) {
      units.set(id, u + d);
      if (t.kind !== 'adjust') cost.set(id, c + (txValue(t, target, rates) ?? 0));
    } else if (d < 0) {
      const frac = u > 0 ? Math.min(1, -d / u) : 0;
      cost.set(id, c - c * frac);
      units.set(id, u + d);
    }
  };

  for (const t of sorted) {
    const fromH = ids.has(t.accountId);
    const toH = t.kind === 'transfer' && t.toAccountId !== undefined && ids.has(t.toAccountId) && t.toAccountId !== t.accountId;
    if (fromH && toH) {
      const from = t.accountId;
      const to = t.toAccountId!;
      const u = units.get(from)!;
      const frac = u > 0 ? Math.min(1, t.amount / u) : 0;
      const moved = cost.get(from)! * frac;
      cost.set(from, cost.get(from)! - moved);
      units.set(from, u - t.amount);
      cost.set(to, cost.get(to)! + moved);
      units.set(to, units.get(to)! + (t.toAmount ?? t.amount));
    } else if (fromH) {
      add(t.accountId, txDelta(t, t.accountId), t);
    } else if (toH) {
      add(t.toAccountId!, txDelta(t, t.toAccountId!), t);
    }
  }

  const lines: HoldingLine[] = accounts.map((a) => ({
    account: a,
    units: units.get(a.id)!,
    cost: cost.get(a.id)!,
    value: accountValue(a, units.get(a.id)!, rates, target),
  }));
  const totalUnits = lines.reduce((s, l) => s + l.units, 0);
  const totalCost = lines.reduce((s, l) => s + l.cost, 0);
  const anyMissing = lines.some((l) => l.value === null && l.units !== 0);
  const value = anyMissing ? null : lines.reduce((s, l) => s + (l.value ?? 0), 0);
  const profit = value === null ? null : value - totalCost;
  return {
    units: totalUnits,
    cost: totalCost,
    value,
    avgCost: totalUnits > 1e-12 && totalCost > 0 ? totalCost / totalUnits : null,
    profit: totalCost > 0 ? profit : null,
    profitPct: totalCost > 0 && profit !== null ? profit / totalCost : null,
    lines,
  };
}
