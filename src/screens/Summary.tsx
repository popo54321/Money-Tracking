import { useState } from 'react';
import { ProgressBar, Seg, Topbar, Sparkle, SkinName } from '../components/ui';
import { addMonthKey, fmtMonth, monthEnd, monthKey, monthStart, yearEnd, yearStart } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { summarise, type CatLine } from '../domain/summary';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupColour, groupEmoji } from '../ui/emoji';
import { ProfileSwitch } from './Home';

type Mode = 'month' | 'year' | 'custom';

export function Summary() {
  const { currency, rates, today, go } = useApp();
  const data = useData();
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(monthKey(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [from, setFrom] = useState(monthStart(monthKey(today)));
  const [to, setTo] = useState(today);

  const range =
    mode === 'month'
      ? { from: monthStart(month), to: monthEnd(month), label: fmtMonth(month) }
      : mode === 'year'
        ? { from: yearStart(year), to: yearEnd(year), label: String(year) }
        : { from, to, label: 'Custom dates' };
  const s = summarise(data.txs, data.categories, range.from, range.to, currency, rates);
  const maxExpense = Math.max(1, ...s.expense.groups.flatMap((g) => g.cats.map((c) => c.total)));
  const maxIncome = Math.max(1, ...s.income.cats.map((c) => c.total));

  const step = (n: number) => (mode === 'month' ? setMonth(addMonthKey(month, n)) : setYear(year + n));

  const catRow = (c: CatLine, max: number, colour: string, kind: 'income' | 'expense') => (
    <button
      key={c.category?.id ?? 'none'}
      className="row"
      onClick={() => go({ name: 'txList', categoryId: c.category?.id ?? '', from: range.from, to: range.to, title: c.name })}
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
        {s.expense.groups.map((g) => (
          <div key={g.group}>
            <div className="between" style={{ padding: '8px 6px 6px' }}>
              <span className="bold small">
                {groupEmoji(g.group)} {g.group}
              </span>
              <span className="bold small">{fmtMoney(g.total, currency)}</span>
            </div>
            <div className="list">{g.cats.map((c) => catRow(c, maxExpense, groupColour(g.group), 'expense'))}</div>
          </div>
        ))}
        <button className="btn sky block mt" onClick={() => go({ name: 'monthClose' })}>
          📋 Month close (numbers for my workbook)
        </button>
      </div>
    </>
  );
}
