import type { Payday } from './payday';
// Data shapes shared by the calculations, the database and the screens.
import type { ISODate, MonthKey } from './dates';

export interface Profile {
  id: string;
  name: string;
  emoji?: string;
  order: number;
  /** the user's order of the account groups (Bank, Credit…) */
  accountGroupOrder?: string[];
  /** the user's own account groups (none = the starting list) */
  accountGroups?: string[];
  /** the user's order of the spending groups (Eating Out, Fixed…) */
  categoryGroupOrder?: string[];
  /** spending limits on whole groups, by group name (per `groupLimitPeriods`, monthly when missing) */
  groupLimits?: Record<string, number>;
  /** the period of each group's limit (missing = monthly) */
  groupLimitPeriods?: Record<string, LimitPeriod>;
  /** a fixed salary recorded once a month (full salary in, deductions out) */
  payday?: Payday;
  /** Wealth preserve: overall capital typed for all Bitcoin, and for all gold (see holdingStatus) */
  wealthCapital?: { btc?: { amount: number; setAt: number }; gold?: { amount: number; setAt: number } };
}

export type AccountType =
  'bank' | 'cash' | 'debit' | 'credit' | 'topup' | 'investment' | 'crypto' | 'units' | 'insurance' | 'other';

export const ACCOUNT_TYPES: { type: AccountType; label: string; defaultGroup: string }[] = [
  { type: 'bank', label: 'Bank account', defaultGroup: 'Bank' },
  { type: 'cash', label: 'Cash', defaultGroup: 'Cash' },
  { type: 'debit', label: 'Debit card', defaultGroup: 'Bank' },
  { type: 'credit', label: 'Credit card', defaultGroup: 'Credit' },
  { type: 'topup', label: 'Top-up card', defaultGroup: 'Bank' },
  { type: 'investment', label: 'Investment', defaultGroup: 'Investments' },
  { type: 'crypto', label: 'Bitcoin (BTC)', defaultGroup: 'Investments' },
  { type: 'units', label: 'Gold / units', defaultGroup: 'Investments' },
  { type: 'insurance', label: 'Insurance', defaultGroup: 'Insurance' },
  { type: 'other', label: 'Other', defaultGroup: 'Assets' },
];

/** The account groups a new user starts with; each user can add, rename and remove their own. */
export const DEFAULT_ACCOUNT_GROUPS = ['Bank', 'Cash', 'Credit', 'Investments', 'Assets', 'Insurance'];

/** A user's account groups: their own list (or the starting one), plus any group an account is still in. */
export function accountGroupsOf(profile: { accountGroups?: string[] }, accounts: { group: string }[]): string[] {
  const out = [...(profile.accountGroups ?? DEFAULT_ACCOUNT_GROUPS)];
  for (const a of accounts) if (a.group && !out.includes(a.group)) out.push(a.group);
  return out;
}

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
  /** money that can be spent now (counts in the liquid total); unset = by type (bank, cash, cards yes) */
  liquid?: boolean;
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
  /** money earmarked inside this account (a record only; the real balance is unchanged) */
  splits?: AccountSplit[];
  /** name of the last split: the balance not earmarked */
  leftName?: string;
  /**
   * cash and top-up cards: other currencies held besides `currency` (the main wallet), e.g. ['JPY', 'USD'].
   * Bills set aside, splits and targets stay in the main wallet.
   */
  wallets?: string[];
  /**
   * removed by the user but kept so the moves with other accounts stay (their balances don't change): hidden
   * everywhere like an archived account, and not shown with the archived ones either
   */
  removed?: boolean;
}

/** Account types that can hold several currencies (wallets). */
export const WALLET_TYPES = new Set(['cash', 'topup']);

/** Every currency an account holds: its main currency first, then its other wallets. */
export function accountCurrencies(a: Pick<Account, 'currency' | 'wallets' | 'type'>): string[] {
  return WALLET_TYPES.has(a.type) ? [a.currency, ...(a.wallets ?? []).filter((c) => c !== a.currency)] : [a.currency];
}

export interface AccountSplit {
  id: string;
  name: string;
  /** starting amount, plus any amount set or moved by hand */
  base: number;
  /** budget plan category whose monthly amount is added when its transfer is ticked */
  budgetCategoryId?: string;
  /** amounts added by ticked budget transfers, by "month:transfer:category" (unticking removes them) */
  added?: Record<string, number>;
}

export type TxKind = 'income' | 'expense' | 'transfer' | 'adjust';

export interface Tx {
  id: string;
  profileId: string;
  date: ISODate;
  kind: TxKind;
  accountId: string;
  /**
   * In the account's currency. Income/expense/transfer: positive (negative expense = money back).
   * Adjust: signed change to the balance.
   */
  amount: number;
  toAccountId?: string;
  /** transfer: amount arriving, in the destination account's currency (or its wallet's) */
  toAmount?: number;
  /** a wallet other than the account's main one: `amount` is in this currency (cash and top-up cards) */
  pocket?: string;
  /** transfer: the wallet of the destination account the money arrives in (not its main one) */
  toPocket?: string;
  /** a fee charged on a move: the spending entry is linked to the move it belongs to */
  feeFor?: string;
  /**
   * Money back: spending with a negative amount (it adds to the account and takes off the category's spending in
   * the month it arrives). The spending it came back for, when known.
   */
  refundOf?: string;
  categoryId?: string;
  note?: string;
  /** what was typed, when it was in another currency */
  origAmount?: number;
  origCurrency?: string;
  /** amount in `valueCurrency` at the time of entry, so past months don't move with exchange rates */
  value: number;
  valueCurrency: string;
  recurringId?: string;
  /** spending or moving from an account with splits: how much came from each split (the rest from What's left) */
  fromSplits?: { splitId: string; amount: number }[];
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
  /** spending limit in the main currency (none = no limit), per `limitPeriod` */
  limit?: number;
  /** how often the limit starts again: each month (default), each quarter or each year */
  limitPeriod?: LimitPeriod;
  /** made and used by the app itself (moveFee: fees on moves); hidden from pickers and the Categories page */
  system?: 'moveFee';
}

/** A spending limit's period: calendar months, quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) or years. */
export type LimitPeriod = 'month' | 'quarter' | 'year';

export const EXPENSE_GROUPS = ['Eating Out', 'Discretionary', 'Infrequent', 'Fixed'];

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
  /**
   * bills that repeat less often than monthly build up month by month (all of it one month before it is due);
   * true sets the whole amount aside straight away
   */
  holdInFull?: boolean;
  /**
   * for small bills: nothing is set aside until this many months (1 to 3) before it is due, or from the start of
   * the month it is due (0), then the whole amount; takes the place of building up or holding in full
   */
  aheadMonths?: number;
  /** an instalment plan: this many monthly payments in all, then it stops (endDate is set to the last one) */
  instalments?: number;
  /** an instalment plan's full price: the last payment takes up the rounding so the payments add up to it */
  instalmentTotal?: number;
  active: boolean;
  createdAt: number;
}

// ---------- Bill split ----------

export interface BillPerson {
  id: string;
  name: string;
  /** does not pay service charge or VAT; the others cover it */
  exemptCharges?: boolean;
  /** someone else pays this person's whole share (e.g. a friend pays for his wife) */
  paidById?: string;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  /** who shares this item; one person = their own item; nobody = food for the whole table */
  sharedBy: string[];
  /** shown in the Shared items section */
  shared: boolean;
}

export interface BillPayment {
  personId: string;
  /** amount paid */
  amount: number;
  /** when set, this payer covers this share of the bill (0–1) and the amount follows the total */
  pct?: number;
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
  /** tip as a % (0 or none = no tip), shared like the service charge */
  tipPct?: number;
  /** tip on the whole bill (food + service + VAT) instead of the food only */
  tipOnTotal?: boolean;
  /** round up to this step (e.g. 10, 100); 0 or none = exact */
  tipRoundTo?: number;
  /** true: round the whole bill up (the extra is tip); false: round the tip itself up */
  tipRoundTotal?: boolean;
  /** even = the food is shared equally by everyone; shared items still go only to the people ticked */
  mode: 'itemised' | 'even';
  roundWhole: boolean;
  /** one person paid the whole bill */
  paidBy?: string;
  /** several people paid part of the bill each (used instead of paidBy when set) */
  payments?: BillPayment[];
  /** made from a trip's bill (that bill is settled here, not in the trip) */
  fromTrip?: { tripId: string; tripName: string; entryId: string };
  /** everyone has paid: hidden from the list until Show settled */
  settled?: boolean;
  /** what I paid was logged as my spending (the whole bill, or what I paid): friends' paybacks are money back on it */
  logged?: { txId: string; categoryId: string };
  createdAt: number;
  updatedAt: number;
}

// ---------- Trip split ----------

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
  /** worked out in a bill split (its id): left out of the trip's settle-up until brought back */
  inBillSplit?: string;
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
  /** everyone has paid: hidden from the list until Show settled */
  settled?: boolean;
  /**
   * The bills I paid were logged as my spending, one entry per bill on its day (`byEntry`: bill → entry). Friends'
   * paybacks are money back on this category. (`txId`: one entry for the whole trip, from 1.23.0.)
   */
  logged?: { txId?: string; categoryId: string; byEntry?: Record<string, string> };
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
  /** this month's ticks, and the transfers already recorded as moves this month (recorded once only) */
  checklist: { month: MonthKey; done: string[]; recorded?: string[] };
  updatedAt: number;
}

// ---------- Settings & prices ----------

export interface Settings {
  defaultCurrency: string;
  favouriteCurrencies: string[];
  activeProfileId: string;
  theme: 'system' | 'light' | 'dark';
  /** look: financial (the default), queenbee, fantasy, dino, wildlife or space (cute, frog and cat move to queenbee or wildlife) */
  skin?: string;
  lastBackupAt?: number;
  lastAutoBackupAt?: number;
  githubRepo: string;
  /** value gold at the shop's buying price (what you'd get) or selling price */
  goldPriceSide?: 'buy' | 'sell';
  /** currencies shown on Home's price strip next to BTC and gold (default: USD) */
  watchCurrencies?: string[];
  /** buzz on key presses (default on) */
  vibrate?: boolean;
  /** the “How to use this app” guide has been read (or skipped) */
  guideSeen?: boolean;
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
