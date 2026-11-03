// Starting setup for a new user: generic categories, no accounts and no amounts.
import { todayISO } from '../domain/dates';
import type { Account, AccountType, BudgetPlan, Category, Profile, Settings } from '../domain/types';

export type SeedAcc = [name: string, type: AccountType, group: string, currency?: string];
import { db, uid } from './db';

export const DEFAULT_SETTINGS: Settings = {
  defaultCurrency: 'THB',
  favouriteCurrencies: ['THB', 'USD', 'EUR', 'CNY', 'JPY', 'GBP'],
  activeProfileId: 'user-1',
  theme: 'system',
  githubRepo: 'popo54321/Money-Tracking',
};

const INCOME = ['Salary', 'Bonus', 'Investing Dividend', 'Investing Income', 'Interest', 'Gifts', 'Payback', 'Other'];

const EXPENSE: [string, string[]][] = [
  ['Eating Out', ['Breakfast', 'Lunch', 'Dinner', 'Delivery', 'Coffee']],
  [
    'Discretionary',
    [
      'Groceries', 'Household', 'Transportation', 'Games', 'Books', 'Socialise', 'Gifts', 'Movies', 'Clothes',
      'Health & Body Care', 'Workout', 'Personal Development',
    ],
  ],
  ['Infrequent', ['Tax', 'Travel', 'Large Purchase']],
  ['Fixed', ['Rent', 'Bills', 'Phone', 'Internet', 'Subscriptions', 'Insurance']],
];

export function makeCategories(profileId: string, income: string[], expense: [string, string[]][]): Category[] {
  const out: Category[] = [];
  let order = 0;
  for (const name of income) {
    out.push({ id: uid(), profileId, kind: 'income', name, group: 'Income', order: order++, archived: false });
  }
  for (const [group, names] of expense) {
    for (const name of names) {
      out.push({ id: uid(), profileId, kind: 'expense', name, group, order: order++, archived: false });
    }
  }
  return out;
}

export function makeAccounts(profileId: string, list: SeedAcc[]): Account[] {
  const today = todayISO();
  return list.map(([name, type, group, currency], i) => ({
    id: uid(),
    profileId,
    name,
    type,
    group,
    currency: currency ?? 'THB',
    openingBalance: 0,
    openingDate: today,
    includeInNetWorth: true,
    archived: false,
    order: i,
    ...(type === 'units' ? { unitPriceCurrency: 'THB', unitPriceSource: 'live-gold' as const } : {}),
  }));
}

export function makeBudget(profileId: string): BudgetPlan {
  const phases = ['Phase 1'].map((name) => ({ id: uid(), name }));
  const catNames = ['Saving', 'Investing', 'Living costs', 'Fun', 'Emergency'];
  const categories = catNames.map((name) => ({ id: uid(), name }));
  const amounts: BudgetPlan['amounts'] = {};
  for (const p of phases) amounts[p.id] = {};
  return {
    id: `budget-${profileId}`,
    profileId,
    monthlyIncome: 0,
    currency: 'THB',
    activePhaseId: phases[0].id,
    phases,
    categories,
    amounts,
    bonus: {
      income: 0,
      rows: ['Investment', 'Emergency', 'Travel'].map((name) => ({ id: uid(), name, pct: 0 })),
    },
    surplus: {
      amount: 0,
      threshold: 0,
      belowRows: [{ id: uid(), name: 'Emergency', pct: 1 }],
      aboveRows: [
        { id: uid(), name: 'Investment', pct: 0 },
        { id: uid(), name: 'Travel', pct: 0 },
      ],
    },
    transfers: [],
    checklist: { month: todayISO().slice(0, 7), done: [] },
    updatedAt: Date.now(),
  };
}

const PROFILE_EMOJI = ['🧚', '🦄', '🐰', '🦊', '🐻', '🦋', '🐱', '🐥'];

/** A new, empty user with generic categories and an empty budget plan. */
export async function createProfile(name?: string): Promise<Profile> {
  const all = await db.profiles.toArray();
  let n = all.length + 1;
  while (all.some((p) => p.name === `User ${n}`)) n++;
  const order = Math.max(-1, ...all.map((p) => p.order)) + 1;
  const profile: Profile = { id: all.length === 0 ? 'user-1' : uid(), name: name?.trim() || `User ${n}`, emoji: PROFILE_EMOJI[(n - 1) % PROFILE_EMOJI.length], order };
  await db.transaction('rw', [db.profiles, db.categories, db.budgets], async () => {
    await db.profiles.add(profile);
    await db.categories.bulkAdd(makeCategories(profile.id, INCOME, EXPENSE));
    await db.budgets.put(makeBudget(profile.id));
  });
  return profile;
}

/** Delete a user and everything that belongs to them. */
export async function deleteProfile(id: string): Promise<void> {
  await db.transaction('rw', [db.profiles, db.accounts, db.categories, db.txs, db.recurring, db.budgets, db.debts, db.goals], async () => {
    for (const t of [db.accounts, db.categories, db.txs, db.recurring, db.budgets, db.debts, db.goals]) {
      await (t as typeof db.accounts).where('profileId').equals(id).delete();
    }
    await db.profiles.delete(id);
  });
}

/** One-time tidy-up for installs from 0.1: BTC and gold accounts get their own Wealth preserve group. */
export async function migrate(): Promise<void> {
  const done = await db.kv.get('migratedWealthGroup');
  if (done) return;
  const accs = await db.accounts.toArray();
  for (const a of accs) {
    const wealth = a.currency === 'BTC' || (a.type === 'units' && a.unitPriceSource === 'live-gold');
    if (wealth && (a.group === 'Investments' || a.group === 'Assets')) await db.accounts.update(a.id, { group: 'Wealth preserve' });
  }
  await db.kv.put({ key: 'migratedWealthGroup', value: true });
}

/** First launch: one empty user. Existing installs keep all their data. */
export async function ensureSeeded(): Promise<boolean> {
  const count = await db.profiles.count();
  if (count > 0) return false;
  await createProfile();
  await db.kv.put({ key: 'settings', value: DEFAULT_SETTINGS });
  return true;
}
