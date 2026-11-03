// Data shapes shared by the calculations, the database and the screens.
import type { ISODate, MonthKey } from './dates';

export interface Profile {
  id: string;
  name: string;
  emoji?: string;
  order: number;
}

export type AccountType =
  | 'bank'
  | 'cash'
  | 'debit'
  | 'credit'
  | 'topup'
  | 'investment'
  | 'crypto'
  | 'units'
  | 'insurance'
  | 'other';

export const ACCOUNT_TYPES: { type: AccountType; label: string; defaultGroup: string }[] = [
  { type: 'bank', label: 'Bank account', defaultGroup: 'Bank' },
  { type: 'cash', label: 'Cash', defaultGroup: 'Bank' },
  { type: 'debit', label: 'Debit card', defaultGroup: 'Bank' },
  { type: 'credit', label: 'Credit card', defaultGroup: 'Credit' },
  { type: 'topup', label: 'Top-up card', defaultGroup: 'Bank' },
  { type: 'investment', label: 'Investment', defaultGroup: 'Investments' },
  { type: 'crypto', label: 'Bitcoin (BTC)', defaultGroup: 'Wealth preserve' },
  { type: 'units', label: 'Gold / units', defaultGroup: 'Wealth preserve' },
  { type: 'insurance', label: 'Insurance', defaultGroup: 'Insurance' },
  { type: 'other', label: 'Other', defaultGroup: 'Assets' },
];

/** Groups in the same order as the year sheets, plus credit cards. */
export const ACCOUNT_GROUPS = ['Bank', 'Wealth preserve', 'Investments', 'Assets', 'Insurance', 'Business', 'Credit'];

export interface Account {
  id: string;
  profileId: string;
  name: string;
  type: AccountType;
  group: string;
  /** ISO code, 'BTC' for crypto, or a unit label (e.g. 'baht-weight') for units accounts */
  currency: string;
  /** balance before any entries recorded in the app (credit cards: negative = owed) */
  openingBalance: number;
  openingDate: ISODate;
  includeInNetWorth: boolean;
  archived: boolean;
  order: number;
  note?: string;
  // Gold / units
  unitPrice?: number;
  unitPriceCurrency?: string;
  unitPriceUpdatedAt?: number;
  /** live-gold = valued at the live Thai gold price per baht-weight (96.5% bar) */
  unitPriceSource?: 'manual' | 'live-gold';
  /** what the starting balance cost, in the main currency (BTC and gold profit/loss) */
  costBasis?: number;
  // Credit cards
  creditLimit?: number;
  statementDay?: number;
  dueDay?: number;
  payFromAccountId?: string;
}

export type TxKind = 'income' | 'expense' | 'transfer' | 'adjust';

export interface Tx {
  id: string;
  profileId: string;
  date: ISODate;
  kind: TxKind;
  accountId: string;
  /**
   * In the account's currency. Income/expense/transfer: positive (negative expense = refund).
   * Adjust: signed change to the balance.
   */
  amount: number;
  toAccountId?: string;
  /** transfer: amount arriving, in the destination account's currency */
  toAmount?: number;
  categoryId?: string;
  note?: string;
  /** what was typed, when it was in another currency */
  origAmount?: number;
  origCurrency?: string;
  /** amount in `valueCurrency` at the time of entry, so past months don't move with exchange rates */
  value: number;
  valueCurrency: string;
  recurringId?: string;
  createdAt: number;
  updatedAt: number;
}

export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  profileId: string;
  kind: CategoryKind;
  name: string;
  group: string;
  emoji?: string;
  order: number;
  archived: boolean;
}

export const EXPENSE_GROUPS = ['Eating Out', 'Discretionary', 'Infrequent', 'Fixed'];
export const INCOME_GROUP = 'Income';

export type Freq = 'day' | 'week' | 'month' | 'year';

export interface Recurring {
  id: string;
  profileId: string;
  name: string;
  kind: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string;
  toAccountId?: string;
  toAmount?: number;
  categoryId?: string;
  note?: string;
  freq: Freq;
  every: number;
  startDate: ISODate;
  endDate?: ISODate;
  /** last occurrence that has been recorded as an entry */
  lastPosted?: ISODate;
  /** record automatically on the due day */
  autoPost: boolean;
  /** keep the next payment reserved in the paying account */
  reserve: boolean;
  active: boolean;
  createdAt: number;
}

// ---------- Bill split ----------

export interface BillPerson {
  id: string;
  name: string;
  /** does not pay service charge or VAT; the others cover it */
  exemptCharges?: boolean;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  /** who shares this item; one person = their own item */
  sharedBy: string[];
  /** shown in the Shared items section */
  shared: boolean;
}

export interface BillSplit {
  id: string;
  title: string;
  date: ISODate;
  currency: string;
  people: BillPerson[];
  items: BillItem[];
  servicePct: number;
  vatPct: number;
  vatOnService: boolean;
  mode: 'itemised' | 'even';
  roundWhole: boolean;
  paidBy?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------- Travel split ----------

export interface TripMember {
  id: string;
  name: string;
}

export interface TripEntry {
  id: string;
  date?: ISODate;
  payerId: string;
  bill: string;
  cost: number;
  currency: string;
  /** all = everyone shares, none = payer's own, some = only `sharedBy` */
  split: 'all' | 'none' | 'some';
  sharedBy?: string[];
}

export interface Trip {
  id: string;
  name: string;
  baseCurrency: string;
  /** 1 unit of currency = rate × baseCurrency */
  rates: Record<string, number>;
  payBackCurrency: string;
  members: TripMember[];
  entries: TripEntry[];
  createdAt: number;
  updatedAt: number;
}

// ---------- Budget allocation ----------

export interface BudgetRow {
  id: string;
  name: string;
  pct: number;
}

export interface BudgetTransfer {
  id: string;
  fromLabel: string;
  toLabel: string;
  fromAccountId?: string;
  toAccountId?: string;
  /** when set, the amount is the sum of these budget categories in the phase */
  categoryIds?: string[];
  /** typed amount per phase (used when no categories are linked) */
  amounts: Record<string, number>;
  note?: string;
}

export interface BudgetPlan {
  id: string;
  profileId: string;
  monthlyIncome: number;
  currency: string;
  activePhaseId: string;
  phases: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  /** amounts[phaseId][categoryId] */
  amounts: Record<string, Record<string, number>>;
  bonus: { income: number; rows: BudgetRow[] };
  surplus: {
    amount: number;
    ruleAccountId?: string;
    threshold: number;
    belowRows: BudgetRow[];
    aboveRows: BudgetRow[];
  };
  transfers: BudgetTransfer[];
  checklist: { month: MonthKey; done: string[] };
  updatedAt: number;
}

// ---------- Settings & prices ----------

export interface Settings {
  defaultCurrency: string;
  favouriteCurrencies: string[];
  activeProfileId: string;
  theme: 'system' | 'light' | 'dark';
  lastBackupAt?: number;
  lastAutoBackupAt?: number;
  githubRepo: string;
  /** value gold at the shop's buying price (what you'd get) or selling price */
  goldPriceSide?: 'buy' | 'sell';
}

export interface PriceCache {
  perUsd: Record<string, number>;
  ratesFetchedAt?: number;
  ratesSource: string;
  btcPrice?: number;
  btcPriceCurrency: string;
  btcUsd?: number;
  btcFetchedAt?: number;
  btcSource?: string;
  /** Thai gold bar 96.5 %, THB per baht-weight: what shops pay (buy) and charge (sell) */
  goldBuyThb?: number;
  goldSellThb?: number;
  goldFetchedAt?: number;
  goldSource?: string;
  goldIsEstimate?: boolean;
}

export interface PriceSnapshot {
  date: ISODate;
  btcThb?: number;
  btcUsd?: number;
  goldThb?: number;
  perUsd: Record<string, number>;
}
