// Splits inside an account: money earmarked for things (Car, Emergency, a saving target…).
// A record only: the account's real balance never changes. What is not earmarked is "What's left".
import { sum } from './money';
import type { Account, AccountSplit, BudgetPlan, Tx } from './types';
import type { Goal } from './goals';

/** A split today: its base, plus ticked budget transfers, minus what entries took from it. */
export function splitAmount(split: AccountSplit, txs: Tx[]): number {
  const added = sum(Object.values(split.added ?? {}));
  const used = sum(txs.flatMap((t) => (t.fromSplits ?? []).filter((f) => f.splitId === split.id).map((f) => f.amount)));
  return split.base + added - used;
}

export interface SplitRow {
  key: string;
  name: string;
  amount: number;
  split?: AccountSplit;
  goal?: Goal;
  /** the row for money set aside for upcoming bills */
  bills?: boolean;
}

export interface SplitView {
  rows: SplitRow[];
  /** balance minus bills set aside (when given), every split and saving target (negative = more is claimed than is there) */
  left: number;
  leftName: string;
}

/**
 * Everything that claims money in one account, in order: bills set aside (when `setAside` is given),
 * its splits, the saving targets kept in it, then What's left (= Free).
 */
export function splitView(
  account: Account,
  balance: number,
  txs: Tx[],
  goals: { goal: Goal; saved: number }[],
  setAside = 0,
): SplitView {
  const own = txs.filter((t) => t.accountId === account.id);
  const rows: SplitRow[] = [];
  if (setAside > 0.005) rows.push({ key: 'bills', name: '🔒 Set aside for bills', amount: setAside, bills: true });
  for (const s of account.splits ?? []) rows.push({ key: `s:${s.id}`, name: s.name, amount: splitAmount(s, own), split: s });
  for (const g of goals)
    if (g.goal.accountId === account.id && !g.goal.done && g.goal.currency === account.currency)
      rows.push({ key: `g:${g.goal.id}`, name: `${g.goal.emoji} ${g.goal.name}`, amount: g.saved, goal: g.goal });
  return { rows, left: balance - sum(rows.map((r) => r.amount)), leftName: account.leftName || "What's left" };
}

export interface AccountClaims {
  balance: number;
  /** money set aside for upcoming bills */
  setAside: number;
  /** the account's own splits */
  splits: number;
  /** saving targets kept in the account */
  targets: number;
  /** what nothing claims: balance − set aside − splits − targets (negative = short) */
  free: number;
}

/** One order for every account: bills set aside first, then splits, then saving targets; the rest is Free. */
export function accountClaims(
  account: Account,
  balance: number,
  setAside: number,
  txs: Tx[],
  goals: { goal: Goal; saved: number }[],
): AccountClaims {
  const v = splitView(account, balance, txs, goals, setAside);
  const part = (f: (r: SplitRow) => boolean) => sum(v.rows.filter(f).map((r) => r.amount));
  return {
    balance,
    setAside: part((r) => !!r.bills),
    splits: part((r) => !!r.split),
    targets: part((r) => !!r.goal),
    free: v.left,
  };
}

/** Accounts with splits or saving targets in them show the split view. */
export function hasSplits(account: Account, goals: Goal[]): boolean {
  return (account.splits?.length ?? 0) > 0 || goals.some((g) => g.accountId === account.id && !g.done);
}

/** The amounts a ticked budget transfer adds to splits linked to its categories, by split id. */
export function budgetTickAdds(
  plan: BudgetPlan,
  transferId: string,
  account: Account,
): { splitId: string; key: string; amount: number }[] {
  const t = plan.transfers.find((x) => x.id === transferId);
  if (!t || t.toAccountId !== account.id || !t.categoryIds?.length) return [];
  const amounts = plan.amounts[plan.activePhaseId] ?? {};
  const out: { splitId: string; key: string; amount: number }[] = [];
  for (const catId of t.categoryIds) {
    const split = account.splits?.find((s) => s.budgetCategoryId === catId);
    const amount = amounts[catId] ?? 0;
    if (split && amount) out.push({ splitId: split.id, key: `${t.id}:${catId}`, amount });
  }
  return out;
}

/** Tick (add) or untick (remove exactly what was added) a budget transfer's amounts in its account's splits. */
export function applyBudgetTick(account: Account, plan: BudgetPlan, transferId: string, month: string, on: boolean): Account {
  const adds = budgetTickAdds(plan, transferId, account);
  const prefix = `${month}:${transferId}:`;
  const splits = (account.splits ?? []).map((s) => {
    const added = { ...(s.added ?? {}) };
    for (const k of Object.keys(added)) if (k.startsWith(prefix)) delete added[k];
    if (on) for (const a of adds) if (a.splitId === s.id) added[`${month}:${a.key}`] = a.amount;
    return { ...s, added };
  });
  return { ...account, splits };
}
