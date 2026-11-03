// Restaurant bill split: own items, shared items (split between only the people ticked),
// service charge and VAT in proportion to what each person had, people who are treated
// to the charges, an even-split mode, and rounding that always adds up to the bill.
import { allocate, decimalsFor, roundTo, sum } from './money';
import type { BillItem, BillPerson } from './types';

export interface BillInput {
  people: BillPerson[];
  items: BillItem[];
  servicePct: number;
  vatPct: number;
  /** VAT is charged on food + service charge (usual in Thailand) */
  vatOnService: boolean;
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
  /** exact share before rounding */
  exact: number;
  /** rounded amount to pay */
  pay: number;
  exempt: boolean;
}

export interface BillResult {
  subtotal: number;
  service: number;
  vat: number;
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
  const total = subtotal + service + vat;

  if (people.length === 0) {
    return { subtotal, service, vat, total, shares: [], roundingDiff: 0, warnings: ['Add at least one person.'] };
  }

  const ids = new Set(people.map((p) => p.id));
  const food = new Map<string, number>(people.map((p) => [p.id, 0]));

  if (input.mode === 'even') {
    for (const p of people) food.set(p.id, subtotal / people.length);
  } else {
    for (const it of items) {
      let who = it.sharedBy.filter((id) => ids.has(id));
      if (who.length === 0) {
        if (it.price) warnings.push(`"${it.name || 'Item'}" has nobody ticked, so it is split between everyone.`);
        who = people.map((p) => p.id);
      }
      const each = (it.price || 0) / who.length;
      for (const id of who) food.set(id, food.get(id)! + each);
    }
  }

  // Service charge and VAT are shared by the people who are not exempt, in proportion to their food.
  let payers = people.filter((p) => !p.exemptCharges);
  if (payers.length === 0) {
    if (service + vat > 0) warnings.push('Everyone is excluded from service charge and VAT, so it is split between everyone.');
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
    return { personId: p.id, name: p.name, food: f, service: sv, vat: vt, exact: f + sv + vt, pay: 0, exempt: !!p.exemptCharges };
  });

  const roundDp = input.roundWhole ? 0 : dp;
  const pays = allocate(total, shares.map((x) => x.exact), roundDp);
  shares.forEach((x, i) => (x.pay = pays[i]));
  const roundingDiff = roundTo(sum(pays) - total, dp);

  return { subtotal, service, vat, total, shares, roundingDiff, warnings };
}

export interface Owing {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
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
