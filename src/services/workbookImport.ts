// Read the Budget Allocation sheet from the user's workbook (picked on the phone), so the amounts
// never need to be typed again or stored in the code.
import type { BudgetPlan, BudgetRow, BudgetTransfer } from '../domain/types';
import { uid } from '../db/db';

type Cell = { v?: unknown; f?: string };
type Sheet = Record<string, Cell | unknown>;

function colName(c: number): string {
  let s = '';
  c += 1;
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}

export async function importBudgetFromWorkbook(data: ArrayBuffer, plan: BudgetPlan): Promise<{ plan: BudgetPlan; notes: string[] }> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array', cellFormula: true });
  const name = wb.SheetNames.find((n) => n.trim().toLowerCase() === 'budget allocation');
  if (!name) throw new Error('No “Budget Allocation” sheet in this file.');
  const ws = wb.Sheets[name] as Sheet;
  const ref = (ws['!ref'] as string) || 'A1:K40';
  const range = XLSX.utils.decode_range(ref);
  const cell = (r: number, c: number): Cell | undefined => ws[`${colName(c)}${r + 1}`] as Cell | undefined;
  const val = (r: number, c: number) => cell(r, c)?.v;
  const text = (r: number, c: number) => String(val(r, c) ?? '').trim();
  const num = (r: number, c: number) => {
    const v = val(r, c);
    return typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, '')) || 0;
  };
  const find = (pred: (t: string) => boolean, startRow = range.s.r): { r: number; c: number } | null => {
    for (let r = startRow; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) if (pred(text(r, c).toLowerCase())) return { r, c };
    return null;
  };
  const notes: string[] = [];
  const next: BudgetPlan = structuredClone(plan);

  // monthly income
  const inc = find((t) => t === 'monthly income');
  if (inc) next.monthlyIncome = num(inc.r, inc.c + 1);

  // phases and category amounts: the first "Category" header followed by phase names
  // the "Category" heading with phase names (P1, P2…) to its right
  let head: { r: number; c: number } | null = null;
  for (let from = range.s.r; from <= range.e.r; ) {
    const h = find((t) => t === 'category', from);
    if (!h) break;
    if (/^p\d/i.test(text(h.r, h.c + 1))) {
      head = h;
      break;
    }
    // keep looking to the right on the same row, then further down
    let alt: { r: number; c: number } | null = null;
    for (let c = h.c + 1; c <= range.e.c; c++) {
      if (text(h.r, c).toLowerCase() === 'category' && /^p\d/i.test(text(h.r, c + 1))) {
        alt = { r: h.r, c };
        break;
      }
    }
    if (alt) {
      head = alt;
      break;
    }
    from = h.r + 1;
  }
  if (!head) head = find((t) => t === 'category');
  if (!head) throw new Error('Could not find the phases table.');
  const phases: { id: string; name: string; col: number }[] = [];
  for (let c = head.c + 1; c <= range.e.c && text(head.r, c); c++) phases.push({ id: uid(), name: text(head.r, c), col: c });
  if (phases.length === 0) throw new Error('No phases found next to “Category”.');
  const cats: { id: string; name: string; row: number }[] = [];
  for (let r = head.r + 1; r <= range.e.r && text(r, head.c); r++) cats.push({ id: uid(), name: text(r, head.c), row: r });
  next.phases = phases.map(({ id, name }) => ({ id, name }));
  next.categories = cats.map(({ id, name }) => ({ id, name }));
  next.amounts = {};
  for (const p of phases) {
    next.amounts[p.id] = {};
    for (const c of cats) next.amounts[p.id][c.id] = num(c.row, p.col);
  }
  const keepActive = phases.find((p) => plan.phases.find((x) => x.id === plan.activePhaseId)?.name === p.name);
  next.activePhaseId = (keepActive ?? phases[0]).id;
  notes.push(`${phases.length} phases, ${cats.length} categories`);

  // helper: read a Category / Allocation table under a heading cell
  const readRows = (r0: number, c0: number): BudgetRow[] => {
    const rows: BudgetRow[] = [];
    for (let r = r0; r <= range.e.r && text(r, c0); r++) rows.push({ id: uid(), name: text(r, c0), pct: num(r, c0 + 1) });
    return rows;
  };

  const bonus = find((t) => t === 'bonus income');
  if (bonus) {
    next.bonus.income = num(bonus.r, bonus.c + 1);
    const h = find((t) => t === 'category', bonus.r + 1);
    if (h && h.c === bonus.c) next.bonus.rows = readRows(h.r + 1, h.c);
  }
  const surplus = find((t) => t === 'surplus money');
  if (surplus) next.surplus.amount = num(surplus.r, surplus.c + 1);
  const below = find((t) => t.startsWith('if emergency below'));
  if (below) {
    const m = text(below.r, below.c).replace(/,/g, '').match(/(\d+(\.\d+)?)/);
    if (m) next.surplus.threshold = Number(m[1]);
    next.surplus.belowRows = readRows(below.r + 2, below.c);
  }
  const covered = find((t) => t.startsWith('if emergency is covered'));
  if (covered) next.surplus.aboveRows = readRows(covered.r + 2, covered.c);

  // transfer plan: rows under "From Account"
  const from = find((t) => t === 'from account');
  if (from) {
    const transfers: BudgetTransfer[] = [];
    for (let r = from.r + 1; r <= range.e.r && text(r, from.c); r++) {
      const t: BudgetTransfer = {
        id: uid(),
        fromLabel: text(r, from.c).replace(/^from\s+/i, ''),
        toLabel: text(r, from.c + 1).replace(/^to\s+/i, ''),
        amounts: {},
      };
      // a formula such as =C12+C13+C14 links the transfer to those categories
      const f = cell(r, phases[0].col)?.f;
      if (f && /^[A-Z]+\d+(\+[A-Z]+\d+)*$/.test(f.replace(/\$/g, ''))) {
        const rowsRef = f.replace(/\$/g, '').split('+').map((x) => Number(x.replace(/^[A-Z]+/, '')) - 1);
        const linked = rowsRef.map((rr) => cats.find((c) => c.row === rr)?.id).filter(Boolean) as string[];
        if (linked.length === rowsRef.length) t.categoryIds = linked;
      }
      for (const p of phases) {
        const v = val(r, p.col);
        if (typeof v === 'number') t.amounts[p.id] = v;
        else if (typeof v === 'string' && v.trim()) t.note = v.trim();
      }
      transfers.push(t);
    }
    if (transfers.length) next.transfers = transfers;
  }
  return { plan: next, notes };
}
