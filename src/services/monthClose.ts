// The numbers to copy into the workbook at month end, in the year sheet's row order.
import { accountValue, balancesByAccount } from '../domain/balances';
import { monthEnd, monthStart, type MonthKey } from '../domain/dates';
import { withBtc, type RateTable } from '../domain/fx';
import { summarise, type Summary } from '../domain/summary';
import { ACCOUNT_GROUPS, type Account, type Category, type Tx } from '../domain/types';
import { isGoldAccount } from '../domain/wealth';
import { db } from '../db/db';
import { getPriceCache } from '../db/repo';

export interface CloseAccountRow {
  account: Account;
  /** null when the account was added after this month */
  balance: number | null;
  value: number | null;
}

export interface MonthCloseData {
  month: MonthKey;
  currency: string;
  summary: Summary;
  groups: { group: string; rows: CloseAccountRow[]; total: number }[];
  netWorth: number;
  btc: { amount: number; price?: number; priceDate?: string; value?: number; perAccount: { name: string; amount: number }[] };
  gold: { amount: number; price?: number; priceDate?: string; value?: number; perAccount: { name: string; amount: number }[] };
}

/** Rates as they were at the end of the month when a snapshot exists, otherwise today's. */
async function ratesAt(
  date: string,
  current: RateTable,
): Promise<{ table: RateTable; btcThb?: number; goldThb?: number; date?: string }> {
  const snap = await db.prices.where('date').belowOrEqual(date).last();
  if (!snap) {
    const c = await getPriceCache();
    return { table: current, btcThb: c.btcPriceCurrency === 'THB' ? c.btcPrice : undefined, goldThb: c.goldBuyThb };
  }
  return {
    table: withBtc(snap.perUsd, snap.btcThb ?? null, 'THB', snap.goldThb ?? null),
    btcThb: snap.btcThb,
    goldThb: snap.goldThb,
    date: snap.date,
  };
}

export async function buildMonthClose(
  month: MonthKey,
  accounts: Account[],
  categories: Category[],
  txs: Tx[],
  currency: string,
  currentRates: RateTable,
): Promise<MonthCloseData> {
  const end = monthEnd(month);
  const summary = summarise(txs, categories, monthStart(month), end, currency, currentRates, true);
  const at = await ratesAt(end, currentRates);
  const visible = accounts.filter((a) => !a.archived).sort((a, b) => a.order - b.order);
  const balances = balancesByAccount(visible, txs, end);

  const groupNames = [...ACCOUNT_GROUPS];
  for (const a of visible) if (!groupNames.includes(a.group)) groupNames.push(a.group);

  let netWorth = 0;
  const groups = groupNames
    .map((group) => {
      const rows: CloseAccountRow[] = visible
        .filter((a) => a.group === group)
        .map((account) => {
          if (account.openingDate > end) return { account, balance: null, value: null };
          const balance = balances.get(account.id) ?? 0;
          const value = accountValue(account, balance, at.table, currency);
          return { account, balance, value };
        });
      let total = 0;
      for (const r of rows) {
        if (r.value !== null) {
          total += r.value;
          if (r.account.includeInNetWorth) netWorth += r.value;
        }
      }
      return { group, rows, total };
    })
    .filter((g) => g.rows.length > 0);

  const btcAccounts = visible.filter((a) => a.currency === 'BTC');
  const perAccount = btcAccounts.map((a) => ({ name: a.name, amount: a.openingDate > end ? 0 : (balances.get(a.id) ?? 0) }));
  const amount = perAccount.reduce((s, x) => s + x.amount, 0);
  const goldAccounts = visible.filter(isGoldAccount);
  const goldPer = goldAccounts.map((a) => ({ name: a.name, amount: a.openingDate > end ? 0 : (balances.get(a.id) ?? 0) }));
  const goldAmount = goldPer.reduce((s, x) => s + x.amount, 0);
  return {
    gold: {
      amount: goldAmount,
      price: at.goldThb,
      priceDate: at.date,
      value: at.goldThb ? goldAmount * at.goldThb : undefined,
      perAccount: goldPer,
    },
    month,
    currency,
    summary,
    groups,
    netWorth,
    btc: {
      amount,
      price: at.btcThb,
      priceDate: at.date,
      value: at.btcThb ? amount * at.btcThb : undefined,
      perAccount,
    },
  };
}
