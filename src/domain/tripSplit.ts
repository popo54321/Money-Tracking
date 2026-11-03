// Travel split for any number of people, following the Trip Split sheet:
// each bill has a payer, a cost in any currency (converted at the trip's fixed rates),
// and is either personal, shared by everyone, or shared by the people ticked.
import { roundTo, sum } from './money';
import type { TripEntry, TripMember } from './types';

export interface TripInput {
  members: TripMember[];
  baseCurrency: string;
  /** 1 unit of currency = rate × base currency */
  rates: Record<string, number>;
  entries: TripEntry[];
  payBackCurrency: string;
}

export interface MemberTotals {
  id: string;
  name: string;
  /** what they paid for shared bills */
  paidShared: number;
  /** their share of shared bills */
  share: number;
  /** paidShared − share: positive = others owe them */
  net: number;
  /** personal (unsplit) bills they paid */
  personal: number;
  /** everything they paid */
  paidTotal: number;
}

export interface Settlement {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  /** in base currency */
  amount: number;
  /** in pay-back currency */
  payBack: number;
}

export interface TripResult {
  total: number;
  sharedTotal: number;
  members: MemberTotals[];
  settlements: Settlement[];
  missingRates: string[];
  payBackRate: number | null;
}

export function rateFor(input: Pick<TripInput, 'baseCurrency' | 'rates'>, currency: string): number | null {
  if (currency === input.baseCurrency) return 1;
  const r = input.rates[currency];
  return r && r > 0 ? r : null;
}

export function entryBase(input: Pick<TripInput, 'baseCurrency' | 'rates'>, e: TripEntry): number | null {
  const r = rateFor(input, e.currency);
  return r === null ? null : (e.cost || 0) * r;
}

export function computeTrip(input: TripInput): TripResult {
  const missing = new Set<string>();
  const ids = new Set(input.members.map((m) => m.id));
  const t = new Map<string, MemberTotals>(
    input.members.map((m) => [m.id, { id: m.id, name: m.name, paidShared: 0, share: 0, net: 0, personal: 0, paidTotal: 0 }]),
  );
  let total = 0;
  let sharedTotal = 0;

  for (const e of input.entries) {
    const amt = entryBase(input, e);
    if (amt === null) {
      missing.add(e.currency);
      continue;
    }
    total += amt;
    const payer = t.get(e.payerId);
    if (payer) payer.paidTotal += amt;
    if (e.split === 'none') {
      if (payer) payer.personal += amt;
      continue;
    }
    let who = e.split === 'all' ? input.members.map((m) => m.id) : (e.sharedBy ?? []).filter((id) => ids.has(id));
    if (who.length === 0) who = input.members.map((m) => m.id);
    if (who.length === 0) continue;
    sharedTotal += amt;
    if (payer) payer.paidShared += amt;
    const each = amt / who.length;
    for (const id of who) t.get(id)!.share += each;
  }

  const members = [...t.values()].map((m) => ({ ...m, net: m.paidShared - m.share }));
  const payBackRate = rateFor(input, input.payBackCurrency);
  const settlements = settle(members).map((s) => ({
    ...s,
    payBack: payBackRate ? s.amount / payBackRate : s.amount,
  }));

  return { total, sharedTotal, members, settlements, missingRates: [...missing], payBackRate };
}

/** Fewest payments to square everyone up: the biggest debtor pays the biggest creditor first. */
export function settle(members: { id: string; name: string; net: number }[]): Omit<Settlement, 'payBack'>[] {
  const eps = 0.005;
  const cred = members.filter((m) => m.net > eps).map((m) => ({ ...m, left: m.net })).sort((a, b) => b.left - a.left);
  const debt = members.filter((m) => m.net < -eps).map((m) => ({ ...m, left: -m.net })).sort((a, b) => b.left - a.left);
  const out: Omit<Settlement, 'payBack'>[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].left, cred[j].left);
    if (amt > eps) {
      out.push({ fromId: debt[i].id, fromName: debt[i].name, toId: cred[j].id, toName: cred[j].name, amount: roundTo(amt, 8) });
    }
    debt[i].left -= amt;
    cred[j].left -= amt;
    if (debt[i].left <= eps) i++;
    if (cred[j].left <= eps) j++;
  }
  return out;
}

export function tripTotalCheck(result: TripResult): number {
  return roundTo(sum(result.members.map((m) => m.net)), 6);
}
