// Starting setup taken from the names in Popo's workbook (no amounts).
import { todayISO } from '../domain/dates';
import type { Account, AccountType, BudgetPlan, Category, Profile, Settings } from '../domain/types';
import { db, uid } from './db';

export const DEFAULT_SETTINGS: Settings = {
  defaultCurrency: 'THB',
  favouriteCurrencies: ['THB', 'USD', 'EUR', 'CNY', 'JPY', 'GBP'],
  activeProfileId: 'popo',
  theme: 'system',
  githubRepo: 'popo54321/Money-Tracking',
};

const INCOME = [
  'Salary', 'Investing Dividend', 'Commission Money', 'Investing Income', 'Company Provident',
  'Payback', 'Gifts', 'Interest', 'Other',
];

const EXPENSE: [string, string[]][] = [
  ['Eating Out', ['Breakfast', 'Lunch', 'Dinner', 'Delivery']],
  [
    'Discretionary',
    [
      'Groceries', 'Household', 'Transportation', 'Games', 'Books', 'Qiqi', 'Socialise', 'Gifts', 'Movies',
      'Clothes', 'Luxury Lifestyle', 'Health & Body Care', 'Workout', 'Personal Development', 'Work Expense',
    ],
  ],
  ['Infrequent', ['Tax', 'Travel', 'Large Purchase 1', 'Large Purchase 2']],
  [
    'Fixed',
    [
      'Spotify', 'Adobe', 'YouTube Premium', 'Line Man VIP', 'Gemini', 'Discord', 'Shopee VIP',
      'Health Insurance', 'Claude', 'Tax & Social Security',
    ],
  ],
];

const QIQI_EXPENSE: [string, string[]][] = [
  ['Eating Out', ['Breakfast', 'Lunch', 'Dinner', 'Delivery']],
  ['Discretionary', ['Groceries', 'Household', 'Transportation', 'Clothes', 'Health & Body Care', 'Gifts', 'Socialise']],
  ['Infrequent', ['Travel', 'Large Purchase']],
  ['Fixed', ['Insurance', 'Subscriptions', 'Bills']],
];

type SeedAcc = [name: string, type: AccountType, group: string, currency?: string];

const POPO_ACCOUNTS: SeedAcc[] = [
  ['Cash', 'cash', 'Bank'],
  ['Kbank – Monthly Using', 'bank', 'Bank'],
  ['Kbank – Invest + Trav', 'bank', 'Bank'],
  ['SCB – Car Eme Edu', 'bank', 'Bank'],
  ['SCB – Payroll', 'bank', 'Bank'],
  ['Dime – Cash US', 'bank', 'Bank'],
  ['2 Years Saving', 'bank', 'Bank'],
  ['SCB – SCBS&P500E', 'investment', 'Investments'],
  ['Dime – US Stock', 'investment', 'Investments'],
  ['Bitcoin – Bitkub', 'crypto', 'Investments', 'BTC'],
  ['Bitcoin – Trezor wallet', 'crypto', 'Investments', 'BTC'],
  ['Thai Stock', 'investment', 'Investments'],
  ['Stock Account', 'investment', 'Investments'],
  ['Provident fund (My)', 'investment', 'Investments'],
  ['Provident fund (Comp)', 'investment', 'Investments'],
  ['AIA Insurance', 'insurance', 'Insurance'],
  ['AIA Unit Link', 'insurance', 'Insurance'],
  ['Thailife Insurance', 'insurance', 'Insurance'],
  ['Social Insurance', 'insurance', 'Insurance'],
];

const QIQI_ACCOUNTS: SeedAcc[] = [
  ['Cash', 'cash', 'Bank'],
  ['Saving Account', 'bank', 'Bank'],
  ['Gold', 'units', 'Assets', 'baht-weight'],
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
  const phases = [
    'P1: Living Alone', 'P2: With Qiqi', 'P3: Pregnant Qiqi', 'P4: With Child', 'P5: Car Paid in full',
  ].map((name) => ({ id: uid(), name }));
  const catNames = [
    'Investing', 'Travel', 'Qiqi Insurance', 'Qiqi Expense', 'Popo Expense', 'Household Expense',
    'Car Payment', 'Emergency', 'Child Education',
  ];
  const categories = catNames.map((name) => ({ id: uid(), name }));
  const c = (n: string) => categories.find((x) => x.name === n)!.id;
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
      rows: ['Investment', 'Emergency', 'Car Payment', 'Travel'].map((name) => ({ id: uid(), name, pct: 0 })),
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
    transfers: [
      { id: uid(), fromLabel: 'Payroll', toLabel: 'Emer Edu Car', categoryIds: [c('Car Payment'), c('Emergency'), c('Child Education')], amounts: {} },
      { id: uid(), fromLabel: 'Payroll', toLabel: 'Daily use', amounts: {}, note: 'Everything inside' },
      { id: uid(), fromLabel: 'Daily Use', toLabel: 'Travel Invest', categoryIds: [c('Investing'), c('Travel')], amounts: {} },
      { id: uid(), fromLabel: 'Travel Invest', toLabel: 'Bitkub', amounts: {} },
      { id: uid(), fromLabel: 'Travel Invest', toLabel: 'Dime', amounts: {} },
    ],
    checklist: { month: todayISO().slice(0, 7), done: [] },
    updatedAt: Date.now(),
  };
}

/** Create the starting data on first launch. Safe to call every launch. */
export async function ensureSeeded(): Promise<boolean> {
  const count = await db.profiles.count();
  if (count > 0) return false;
  const profiles: Profile[] = [
    { id: 'popo', name: 'Popo', emoji: '🐻', order: 0 },
    { id: 'qiqi', name: 'Qiqi', emoji: '🐰', order: 1 },
  ];
  await db.transaction('rw', [db.profiles, db.accounts, db.categories, db.budgets, db.kv], async () => {
    await db.profiles.bulkAdd(profiles);
    await db.categories.bulkAdd([
      ...makeCategories('popo', INCOME, EXPENSE),
      ...makeCategories('qiqi', ['Salary', 'Interest', 'Gifts', 'Payback', 'Other'], QIQI_EXPENSE),
    ]);
    await db.accounts.bulkAdd([...makeAccounts('popo', POPO_ACCOUNTS), ...makeAccounts('qiqi', QIQI_ACCOUNTS)]);
    await db.budgets.bulkAdd([makeBudget('popo')]);
    await db.kv.put({ key: 'settings', value: DEFAULT_SETTINGS });
    await db.kv.put({ key: 'needsSetup', value: { popo: true, qiqi: true } });
  });
  return true;
}
