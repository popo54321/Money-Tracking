// Restaurant bill split: own items, shared items (split between only the people ticked),
// service charge, VAT and tip in proportion to what each person had, people who are treated
// to the charges, an even-split mode (food shared by all, drinks etc. still by who had them),
// one person paying for others (e.g. for his wife), and rounding that always adds up to the bill.
import { allocate, decimalsFor, roundTo, sum } from './money';
import { settle } from './tripSplit';
import type { BillItem, BillPayment, BillPerson } from './types';

export interface BillInput {
  people: BillPerson[];
  items: BillItem[];
  servicePct: number;
  vatPct: number;
  /** VAT is charged on food + service charge (usual in Thailand) */
  vatOnService: boolean;
  /** tip as a % (0 = none) */
  tipPct?: number;
  /** tip on the whole bill (food + service + VAT) instead of the food only */
  tipOnTotal?: boolean;
  mode: 'itemised' | 'even';
  currency: string;
  /** round each person's share to a whole number */
  roundWhole?: boolean;
}

export interface PersonShare {
  personId: string;
  name: string;
  food: number;
  service: number;
  vat: number;
  tip: number;
  /** exact share before rounding */
  exact: number;
  /** their own share, rounded */
  own: number;
  /** what they pay: their own share plus the people they pay for (0 when someone pays for them) */
  pay: number;
  exempt: boolean;
  /** name of the person who pays for them */
  paidBy?: string;
  /** names of the people they pay for */
  paysFor: string[];
}

export interface BillResult {
  subtotal: number;
  service: number;
  vat: number;
  tip: number;
  total: number;
  shares: PersonShare[];
  /** sum of rounded shares minus the bill total (non-zero only when rounding to whole numbers) */
  roundingDiff: number;
  warnings: string[];
}

export function computeBill(input: BillInput): BillResult {
  const { people, items } = input;
  const dp = decimalsFor(input.currency);
  const warnings: string[] = [];
  const s = (input.servicePct || 0) / 100;
  const v = (input.vatPct || 0) / 100;

  const subtotal = sum(items.map((i) => i.price || 0));
  const service = subtotal * s;
  const vat = (subtotal + (input.vatOnService ? service : 0)) * v;
  const tip = (input.tipOnTotal ? subtotal + service + vat : subtotal) * ((input.tipPct || 0) / 100);
  const total = subtotal + service + vat + tip;

  if (people.length === 0) {
    return { subtotal, service, vat, tip, total, shares: [], roundingDiff: 0, warnings: ['Add at least one person.'] };
  }

  const ids = new Set(people.map((p) => p.id));
  const food = new Map<string, number>(people.map((p) => [p.id, 0]));

  const everyone = people.map((p) => p.id);
  for (const it of items) {
    let who = it.sharedBy.filter((id) => ids.has(id));
    // Split evenly: all the food goes to everyone; only shared items (drinks for some…) keep their people.
    if (input.mode === 'even' && !it.shared) who = everyone;
    if (who.length === 0) {
      if (it.price && it.shared) warnings.push(`"${it.name || 'Item'}" has nobody ticked, so it is split between everyone.`);
      who = everyone;
    }
    const each = (it.price || 0) / who.length;
    for (const id of who) food.set(id, food.get(id)! + each);
  }

  // Service charge and VAT are shared by the people who are not exempt, in proportion to their food.
  let payers = people.filter((p) => !p.exemptCharges);
  if (payers.length === 0) {
    if (service + vat + tip > 0)
      warnings.push('Everyone is excluded from service charge and VAT, so it is split between everyone.');
    payers = people;
  }
  const payerFood = sum(payers.map((p) => food.get(p.id)!));
  const payerIds = new Set(payers.map((p) => p.id));

  const shares: PersonShare[] = people.map((p) => {
    const f = food.get(p.id)!;
    let w = 0;
    if (payerIds.has(p.id)) w = payerFood > 0 ? f / payerFood : 1 / payers.length;
    const sv = service * w;
    const vt = vat * w;
    const tp = tip * w;
    return {
      personId: p.id,
      name: p.name,
      food: f,
      service: sv,
      vat: vt,
      tip: tp,
      exact: f + sv + vt + tp,
      own: 0,
      pay: 0,
      exempt: !!p.exemptCharges,
      paysFor: [],
    };
  });

  const roundDp = input.roundWhole ? 0 : dp;
  const pays = allocate(
    total,
    shares.map((x) => x.exact),
    roundDp,
  );
  shares.forEach((x, i) => (x.own = x.pay = pays[i]));
  const roundingDiff = roundTo(sum(pays) - total, dp);

  // Someone paying for others takes on their whole share (food, service charge and VAT).
  const byId = new Map(shares.map((x) => [x.personId, x]));
  let loop = false;
  for (const x of shares) {
    const target = payerFor(people, x.personId);
    if (target === null) loop = true;
    if (!target) continue;
    const t = byId.get(target)!;
    t.pay = roundTo(t.pay + x.own, dp);
    x.pay = roundTo(x.pay - x.own, dp);
    x.paidBy = t.name;
    t.paysFor.push(x.name);
  }
  if (loop) warnings.push('Some people are set to pay for each other, so they each pay their own share.');

  return { subtotal, service, vat, tip, total, shares, roundingDiff, warnings };
}

/**
 * Who finally pays for this person: follows "paid by" (A pays for B, B pays for C → A pays for C).
 * undefined = pays for themselves; null = a loop (they pay for each other), so nobody takes over.
 */
export function payerFor(people: BillPerson[], id: string): string | undefined | null {
  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set([id]);
  let cur = id;
  let target: string | undefined;
  for (;;) {
    const next = byId.get(cur)?.paidById;
    if (!next || !byId.has(next)) return target;
    if (seen.has(next)) return null;
    seen.add(next);
    target = next;
    cur = next;
  }
}

export interface Owing {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface PaymentPlan {
  /** what each person put down, by person id */
  paid: Map<string, number>;
  paidTotal: number;
  /** what still has to be paid at the table (negative = paid too much) */
  missing: number;
  /** fewest payments so everyone ends up paying exactly their share */
  transfers: Owing[];
}

/**
 * One or several people paid the bill (e.g. A paid 60 %, B 40 %). Each person's share is compared with
 * what they put down, and the fewest payments square everyone up.
 */
export function settleBill(
  result: BillResult,
  payments: BillPayment[] | undefined,
  paidBy: string | undefined,
  currency: string,
): PaymentPlan {
  const dp = decimalsFor(currency);
  const owedTotal = sum(result.shares.map((s) => s.pay));
  const ids = new Set(result.shares.map((s) => s.personId));
  let list = (payments ?? []).filter((p) => ids.has(p.personId));
  if (list.length === 0 && paidBy && ids.has(paidBy)) list = [{ personId: paidBy, amount: owedTotal }];

  const amounts = new Map<string, number>();
  const byPct = list.filter((p) => p.pct !== undefined);
  if (byPct.length === list.length && list.length > 0 && Math.abs(sum(byPct.map((p) => p.pct!)) - 1) < 1e-9) {
    // percentages that add up to 100 % cover the bill exactly, to the last satang
    allocate(
      owedTotal,
      byPct.map((p) => p.pct!),
      dp,
    ).forEach((v, i) => amounts.set(byPct[i].personId, v));
  } else {
    for (const p of list)
      amounts.set(
        p.personId,
        (amounts.get(p.personId) ?? 0) + (p.pct !== undefined ? roundTo(owedTotal * p.pct, dp) : p.amount || 0),
      );
  }
  const paidTotal = sum([...amounts.values()]);
  const transfers = settle(
    result.shares.map((s) => ({ id: s.personId, name: s.name, net: (amounts.get(s.personId) ?? 0) - s.pay })),
  )
    .map((t) => ({ fromId: t.fromId, fromName: t.fromName, toId: t.toId, toName: t.toName, amount: roundTo(t.amount, dp) }))
    .filter((t) => t.amount > 0);
  return { paid: amounts, paidTotal, missing: roundTo(owedTotal - paidTotal, dp), transfers };
}

/** When one person paid the whole bill, everyone else owes them their share. */
export function whoOwes(result: BillResult, paidBy: string | undefined): Owing[] {
  if (!paidBy) return [];
  const payer = result.shares.find((s) => s.personId === paidBy);
  if (!payer) return [];
  return result.shares
    .filter((s) => s.personId !== paidBy && s.pay > 0)
    .map((s) => ({ fromId: s.personId, fromName: s.name, toId: payer.personId, toName: payer.name, amount: s.pay }));
}
