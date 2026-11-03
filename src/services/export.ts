// Spreadsheet exports: every entry as CSV, and a month's figures as an Excel file.
import { fmtMonth } from '../domain/dates';
import { decimalsFor, roundTo } from '../domain/money';
import type { Account, Category, Profile, Tx } from '../domain/types';
import type { MonthCloseData } from './monthClose';
import { shareFile } from './platform';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesCsv(txs: Tx[], accounts: Account[], categories: Category[], profiles: Profile[]): string {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const prof = new Map(profiles.map((p) => [p.id, p.name]));
  const header = [
    'Date',
    'Profile',
    'Type',
    'Account',
    'Amount',
    'Currency',
    'To account',
    'Amount received',
    'To currency',
    'Category',
    'Group',
    'Value',
    'Value currency',
    'Note',
    'Typed amount',
    'Typed currency',
    'Repeating',
  ];
  const rows = [...txs]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((t) => {
      const a = acc.get(t.accountId);
      const to = t.toAccountId ? acc.get(t.toAccountId) : undefined;
      const c = t.categoryId ? cat.get(t.categoryId) : undefined;
      const kind = { income: 'Income', expense: 'Expense', transfer: 'Transfer', adjust: 'Balance adjustment' }[t.kind];
      return [
        t.date,
        prof.get(t.profileId) ?? t.profileId,
        kind,
        a?.name ?? '?',
        t.amount,
        a?.currency ?? '',
        to?.name ?? '',
        t.kind === 'transfer' ? (t.toAmount ?? t.amount) : '',
        to?.currency ?? '',
        c?.name ?? '',
        c?.group ?? '',
        roundTo(t.value, decimalsFor(t.valueCurrency)),
        t.valueCurrency,
        t.note ?? '',
        t.origAmount ?? '',
        t.origCurrency ?? '',
        t.recurringId ? 'yes' : '',
      ];
    });
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function shareEntriesCsv(name: string, csv: string): Promise<void> {
  await shareFile(name, csv, 'text/csv');
}

/** An Excel file laid out like the year sheet for one month, plus that month's entries. */
export async function shareMonthXlsx(
  d: MonthCloseData,
  profileName: string,
  monthTxs: Tx[],
  accounts: Account[],
  categories: Category[],
): Promise<void> {
  const XLSX = await import('xlsx');
  const r2 = (x: number | null | undefined) => (x === null || x === undefined ? null : roundTo(x, 2));
  const aoa: (string | number | null)[][] = [];
  aoa.push([`${profileName} – ${fmtMonth(d.month)}`, `Values in ${d.currency}`]);
  aoa.push([]);
  aoa.push(['Income', '']);
  for (const c of d.summary.income.cats) aoa.push([c.name, r2(c.total)]);
  aoa.push(['Total Income:', r2(d.summary.income.total)]);
  aoa.push([]);
  aoa.push(['Spending', '']);
  for (const g of d.summary.expense.groups) {
    aoa.push([g.group.toUpperCase(), null]);
    for (const c of g.cats) aoa.push([c.name, r2(c.total)]);
    aoa.push([`Total ${g.group}`, r2(g.total)]);
  }
  aoa.push(['Total Expenses', r2(d.summary.expense.total)]);
  aoa.push(['Surplus', r2(d.summary.surplus)]);
  aoa.push([]);
  aoa.push(['Month-end balances', 'Balance', 'Currency', `Value (${d.currency})`]);
  for (const g of d.groups) {
    aoa.push([g.group.toUpperCase(), null]);
    for (const r of g.rows) {
      aoa.push([
        r.account.name,
        r.balance === null ? null : roundTo(r.balance, decimalsFor(r.account.currency)),
        r.account.currency,
        r2(r.value),
      ]);
    }
    aoa.push([`Total ${g.group}`, null, null, r2(g.total)]);
  }
  aoa.push(['Net worth', null, null, r2(d.netWorth)]);
  aoa.push([]);
  aoa.push(['BTC', 'Amount', 'Price at month end (THB)']);
  for (const b of d.btc.perAccount) aoa.push([b.name, roundTo(b.amount, 8)]);
  aoa.push(['Total BTC', roundTo(d.btc.amount, 8), r2(d.btc.price)]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Month close');

  const acc = new Map(accounts.map((a) => [a.id, a]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const rows = monthTxs
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => ({
      Date: t.date,
      Type: t.kind,
      Account: acc.get(t.accountId)?.name ?? '',
      Amount: t.amount,
      Currency: acc.get(t.accountId)?.currency ?? '',
      'To account': t.toAccountId ? (acc.get(t.toAccountId)?.name ?? '') : '',
      Category: t.categoryId ? (cat.get(t.categoryId)?.name ?? '') : '',
      Group: t.categoryId ? (cat.get(t.categoryId)?.group ?? '') : '',
      [`Value (${t.valueCurrency})`]: r2(t.value),
      Note: t.note ?? '',
    }));
  const ws2 = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Entries');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  await shareFile(
    `${profileName}-${d.month}.xlsx`.replace(/\s+/g, '-'),
    new Uint8Array(out),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
