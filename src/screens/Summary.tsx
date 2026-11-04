import { useState } from 'react';
import { ProgressBar, Seg, Topbar, Sparkle, SkinName } from '../components/ui';
import { addMonthKey, fmtMonth, monthEnd, monthKey, monthStart, yearEnd, yearStart } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { summarise, type CatLine } from '../domain/summary';
import { orderGroups } from '../domain/groups';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupColour, groupEmoji } from '../ui/emoji';
import { ProfileSwitch } from './Home';
import { holdProps } from '../components/hold';
import { CategoryEditor } from '../components/CategoryEditor';
import type { Category } from '../domain/types';

type Mode = 'month' | 'year' | 'custom';

export function Summary() {
  const { currency, rates, today, go, profile } = useApp();
  const data = useData();
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(monthKey(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [from, setFrom] = useState(monthStart(monthKey(today)));
  const [to, setTo] = useState(today);
  const [editing, setEditing] = useState<Category | null>(null);

  const range =
    mode === 'month'
      ? { from: monthStart(month), to: monthEnd(month), label: fmtMonth(month) }
      : mode === 'year'
        ? { from: yearStart(year), to: yearEnd(year), label: String(year) }
        : { from, to, label: 'Custom dates' };
  const s = summarise(data.txs, data.categories, range.from, range.to, currency, rates);
  // the whole previous month (or year) to compare with
  const prevRange =
    mode === 'month'
      ? {
          from: monthStart(addMonthKey(month, -1)),
          to: monthEnd(addMonthKey(month, -1)),
          label: fmtMonth(addMonthKey(month, -1)),
        }
      : mode === 'year'
        ? { from: yearStart(year - 1), to: yearEnd(year - 1), label: String(year - 1) }
        : null;
  const ps = prevRange ? summarise(data.txs, data.categories, prevRange.from, prevRange.to, currency, rates) : null;
  const prevCat = new Map<string, number>();
  const prevGroup = new Map<string, number>();
  if (ps) {
    for (const c of ps.income.cats) prevCat.set(c.category?.id ?? 'in:none', c.total);
    for (const g of ps.expense.groups) {
      prevGroup.set(g.group, g.total);
      for (const c of g.cats) prevCat.set(c.category?.id ?? 'out:none', c.total);
    }
  }
  const hasPrev = !!ps && (ps.income.total !== 0 || ps.expense.total !== 0);
  const delta = (now: number, before: number | undefined, kind: 'income' | 'expense') => {
    if (!hasPrev) return null;
    const b = before ?? 0;
    const diff = now - b;
    if (Math.abs(diff) < 0.005) return <span className="delta same"> · same as {prevRange!.label}</span>;
    const good = kind === 'income' ? diff > 0 : diff < 0;
    const pct = b > 0 ? ` (${Math.round((Math.abs(diff) / b) * 100)}%)` : '';
    return (
      <span className={`delta ${good ? 'good' : 'bad'}`}>
        {' '}
        · {diff > 0 ? '▲' : '▼'} {fmtMoney(Math.abs(diff), currency, { compact: true })}
        {pct}
      </span>
    );
  };
  // spending groups in the order chosen on the Categories page
  const expenseGroups = orderGroups(
    s.expense.groups.map((g) => g.group),
    profile.categoryGroupOrder,
  ).map((name) => s.expense.groups.find((g) => g.group === name)!);
  const maxExpense = Math.max(1, ...s.expense.groups.flatMap((g) => g.cats.map((c) => c.total)));
  const maxIncome = Math.max(1, ...s.income.cats.map((c) => c.total));

  const step = (n: number) => (mode === 'month' ? setMonth(addMonthKey(month, n)) : setYear(year + n));

  const catRow = (c: CatLine, max: number, colour: string, kind: 'income' | 'expense') => (
    <button
      key={c.category?.id ?? 'none'}
      className="row"
      onClick={() => go({ name: 'txList', categoryId: c.category?.id ?? '', from: range.from, to: range.to, title: c.name })}
      {...holdProps(() => c.category && setEditing(c.category))}
      style={{ alignItems: 'flex-start' }}
    >
      <div className={`bubble ${kind === 'income' ? 'mint' : colour}`}>{categoryEmoji(c.category)}</div>
      <div className="main">
        <div className="between">
          <span className="title">{c.name}</span>
          <span className={`amt ${kind === 'income' ? 'pos' : ''}`}>{fmtMoney(c.total, currency)}</span>
        </div>
        <div className="sub">
          {c.count} {c.count === 1 ? 'entry' : 'entries'}
          {kind === 'expense' && s.expense.total > 0 ? ` · ${Math.round((c.total / s.expense.total) * 100)}% of spending` : ''}
          {delta(c.total, prevCat.get(c.category?.id ?? (kind === 'income' ? 'in:none' : 'out:none')), kind)}
        </div>
        <ProgressBar value={c.total / max} colour={kind === 'income' ? 'mint' : ''} />
      </div>
    </button>
  );

  return (
    <>
      <Topbar title={<SkinName k="summary" />} right={<ProfileSwitch />} noBack />
      <div className="page">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { v: 'month', label: 'Month' },
            { v: 'year', label: 'Year' },
            { v: 'custom', label: 'Dates' },
          ]}
        />
        {mode !== 'custom' ? (
          <div className="between mt mb">
            <button className="icon-btn" aria-label="Previous" onClick={() => step(-1)}>
              ‹
            </button>
            <div className="bold" style={{ fontSize: 18 }}>
              {range.label}
            </div>
            <button className="icon-btn" aria-label="Next" onClick={() => step(1)}>
              ›
            </button>
          </div>
        ) : (
          <div className="grid2 mt">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value || from)} aria-label="From" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value || to)} aria-label="To" />
          </div>
        )}

        <div className="hero">
          <Sparkle k="summary" />
          <div className="label">Left over</div>
          <div className="big">{fmtMoney(s.surplus, currency)}</div>
          <div className="stat-row">
            <div className="stat">
              <div className="k">Income</div>
              <div className="v pos">{fmtMoney(s.income.total, currency, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Spending</div>
              <div className="v neg">{fmtMoney(s.expense.total, currency, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Kept</div>
              <div className="v">{s.savingsRate === null ? '—' : `${Math.round(s.savingsRate * 100)}%`}</div>
            </div>
          </div>
        </div>
        {hasPrev && (
          <div className="tiny muted center mb">
            ▲ ▼ compared with all of {prevRange!.label}: spending {delta(s.expense.total, ps!.expense.total, 'expense')}
          </div>
        )}
        {s.unconverted > 0 && (
          <div className="banner">
            <span>⚠️</span>
            <span className="grow">{s.unconverted} entries have no exchange rate and are not included.</span>
          </div>
        )}

        <div className="section-title">
          💰 Income <span className="grow" /> <span className="small pos">{fmtMoney(s.income.total, currency)}</span>
        </div>
        {s.income.cats.length === 0 ? (
          <div className="card small muted center">No income in this period.</div>
        ) : (
          <div className="list">{s.income.cats.map((c) => catRow(c, maxIncome, 'mint', 'income'))}</div>
        )}

        <div className="section-title">
          💸 Spending <span className="grow" /> <span className="small neg">{fmtMoney(s.expense.total, currency)}</span>
        </div>
        {s.expense.groups.length === 0 && <div className="card small muted center">No spending in this period. 🐣</div>}
        {expenseGroups.map((g) => (
          <div key={g.group}>
            <div className="between" style={{ padding: '8px 6px 6px' }}>
              <span className="bold small">
                {groupEmoji(g.group)} {g.group}
              </span>
              <span className="bold small">
                {fmtMoney(g.total, currency)}
                {delta(g.total, prevGroup.get(g.group), 'expense')}
              </span>
            </div>
            <div className="list">{g.cats.map((c) => catRow(c, maxExpense, groupColour(g.group), 'expense'))}</div>
          </div>
        ))}
        <div className="tiny muted mt center">Tip: press and hold a category to edit it.</div>
        {editing && <CategoryEditor category={editing} onClose={() => setEditing(null)} />}
        <button className="btn sky block mt" onClick={() => go({ name: 'monthClose' })}>
          📋 Month close (numbers for my workbook)
        </button>
      </div>
    </>
  );
}
