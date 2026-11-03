// Budget allocation phases, bonus split, leftover-money rule and the monthly transfer plan.
import { sum } from './money';
import type { BudgetPlan, BudgetRow, BudgetTransfer } from './types';

export interface PhaseCategoryLine {
  categoryId: string;
  name: string;
  amount: number;
  /** share of monthly income, 0–1 */
  pct: number;
}

export interface PhaseTotals {
  lines: PhaseCategoryLine[];
  total: number;
  /** total ÷ monthly income, 0–1 */
  pctOfIncome: number;
  /** monthly income − total (negative = over budget) */
  left: number;
}

export function phaseTotals(plan: BudgetPlan, phaseId: string): PhaseTotals {
  const amounts = plan.amounts[phaseId] ?? {};
  const inc = plan.monthlyIncome || 0;
  const lines = plan.categories.map((c) => {
    const amount = amounts[c.id] ?? 0;
    return { categoryId: c.id, name: c.name, amount, pct: inc ? amount / inc : 0 };
  });
  const total = sum(lines.map((l) => l.amount));
  return { lines, total, pctOfIncome: inc ? total / inc : 0, left: inc - total };
}

export function splitRows(amount: number, rows: BudgetRow[]): { row: BudgetRow; value: number }[] {
  return rows.map((row) => ({ row, value: amount * (row.pct || 0) }));
}

export function pctTotal(rows: BudgetRow[]): number {
  return sum(rows.map((r) => r.pct || 0));
}

/**
 * Leftover-money rule: while the chosen account is below the threshold, use the "below" split;
 * once it is covered, use the "above" split.
 */
export function surplusRule(plan: BudgetPlan, ruleBalance: number | null): { covered: boolean; rows: BudgetRow[] } {
  const covered = ruleBalance !== null && ruleBalance >= plan.surplus.threshold;
  return { covered, rows: covered ? plan.surplus.aboveRows : plan.surplus.belowRows };
}

export function transferAmount(plan: BudgetPlan, t: BudgetTransfer, phaseId: string): number {
  if (t.categoryIds && t.categoryIds.length > 0) {
    const amounts = plan.amounts[phaseId] ?? {};
    return sum(t.categoryIds.map((id) => amounts[id] ?? 0));
  }
  return t.amounts[phaseId] ?? 0;
}
