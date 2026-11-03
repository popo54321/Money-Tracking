import { useEffect, useState } from 'react';
import { Topbar } from '../components/ui';
import { addMonthKey, fmtDate, fmtMonth, monthEnd, monthKey, monthStart } from '../domain/dates';
import { decimalsFor, fmtMoney, fmtNumber, roundTo } from '../domain/money';
import { buildMonthClose, type MonthCloseData } from '../services/monthClose';
import { entriesCsv, shareEntriesCsv, shareMonthXlsx } from '../services/export';
import { copyText } from '../services/platform';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupEmoji } from '../ui/emoji';

function CopyRow({ label, value, dp = 2, cls = '', emoji }: { label: string; value: number | null; dp?: number; cls?: string; emoji?: string }) {
  const { toast } = useApp();
  const text = value === null ? '' : String(roundTo(value, dp));
  return (
    <button
      className={`copy-row ${cls}`}
      onClick={async () => {
        if (value === null) return;
        const ok = await copyText(text);
        toast(ok ? `📋 Copied ${text}` : 'Could not copy');
      }}
    >
      {emoji && <span>{emoji}</span>}
      <span className="grow">{label}</span>
      <span className="v">{value === null ? '—' : fmtNumber(value, dp)}</span>
      <span className="c">📋</span>
    </button>
  );
}

export function MonthClose() {
  const { currency, rates, today, profile, profiles, toast } = useApp();
  const data = useData();
  const [month, setMonth] = useState(() => {
    // after the 20th, default to this month; otherwise the month just finished
    const k = monthKey(today);
    return Number(today.slice(8, 10)) >= 20 ? k : addMonthKey(k, -1);
  });
  const [d, setD] = useState<MonthCloseData | null>(null);
  useEffect(() => {
    let alive = true;
    buildMonthClose(month, data.accounts, data.categories, data.txs, currency, rates).then((x) => alive && setD(x));
    return () => {
      alive = false;
    };
  }, [month, data, currency, rates]);

  const monthTxs = data.txs.filter((t) => t.date >= monthStart(month) && t.date <= monthEnd(month));
  const dp = decimalsFor(currency);

  return (
    <>
      <Topbar title="Month close 📋" />
      <div className="page">
        <div className="between mb">
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonthKey(month, -1))}>
            ‹
          </button>
          <div className="bold" style={{ fontSize: 18 }}>
            {fmtMonth(month)}
          </div>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonthKey(month, 1))}>
            ›
          </button>
        </div>
        <div className="banner sky">
          <span>💡</span>
          <span className="grow">Same order as your year sheet. Tap a number to copy it, then paste it into Excel.</span>
        </div>

        {!d ? (
          <div className="empty">Loading…</div>
        ) : (
          <>
            <div className="card">
              <h2>💰 Income</h2>
              {d.summary.income.cats.map((c) => (
                <CopyRow key={c.category?.id ?? 'x'} emoji={categoryEmoji(c.category)} label={c.name} value={c.total} dp={dp} />
              ))}
              <CopyRow label="Total Income" value={d.summary.income.total} dp={dp} cls="total" />
            </div>

            <div className="card">
              <h2>💸 Spending</h2>
              {d.summary.expense.groups.map((g) => (
                <div key={g.group}>
                  <div className="cat-group-name">
                    {groupEmoji(g.group)} {g.group}
                  </div>
                  {g.cats.map((c) => (
                    <CopyRow key={c.category?.id ?? 'x'} emoji={categoryEmoji(c.category)} label={c.name} value={c.total} dp={dp} cls="sub" />
                  ))}
                  <CopyRow label={`Total ${g.group}`} value={g.total} dp={dp} cls="total" />
                </div>
              ))}
              <CopyRow label="Total Expenses" value={d.summary.expense.total} dp={dp} cls="total" />
              <CopyRow label="Left over (Surplus)" value={d.summary.surplus} dp={dp} cls="total" />
            </div>

            <div className="card">
              <h2>🏦 Month-end balances</h2>
              <div className="tiny muted mb">Values in {currency} on {fmtDate(monthEnd(month))}. Other currencies use the rates saved closest to that date.</div>
              {d.groups.map((g) => (
                <div key={g.group}>
                  <div className="cat-group-name">{g.group}</div>
                  {g.rows.map((r) => (
                    <CopyRow
                      key={r.account.id}
                      label={
                        r.account.currency !== currency && r.balance !== null
                          ? `${r.account.name} (${fmtMoney(r.balance, r.account.currency)})`
                          : r.account.name
                      }
                      value={r.value}
                      dp={dp}
                      cls="sub"
                    />
                  ))}
                  <CopyRow label={`Total ${g.group}`} value={g.total} dp={dp} cls="total" />
                </div>
              ))}
              <CopyRow label="Net worth" value={d.netWorth} dp={dp} cls="total" />
            </div>

            {(d.btc.perAccount.length > 0 || d.gold.perAccount.length > 0) && (
              <div className="card">
                <h2>🪙 Wealth preserve (BTC Growth sheet)</h2>
                {d.btc.perAccount.map((b) => (
                  <CopyRow key={b.name} label={b.name} value={b.amount} dp={8} cls="sub" />
                ))}
                <CopyRow label="Bitcoin amount" value={d.btc.amount} dp={8} cls="total" />
                <CopyRow label={`BTC price at month end (THB)${d.btc.priceDate ? ` · ${fmtDate(d.btc.priceDate, false)}` : ''}`} value={d.btc.price ?? null} dp={2} />
                <CopyRow label="BTC value (THB)" value={d.btc.value ?? null} dp={2} />
                {d.gold.perAccount.length > 0 && (
                  <>
                    <div className="cat-group-name">🥇 Gold (ทอง)</div>
                    {d.gold.perAccount.map((b) => (
                      <CopyRow key={b.name} label={`${b.name} (บาท)`} value={b.amount} dp={4} cls="sub" />
                    ))}
                    <CopyRow label="ทองบาทละ at month end" value={d.gold.price ?? null} dp={2} />
                    <CopyRow label="Gold value (THB)" value={d.gold.value ?? null} dp={2} />
                  </>
                )}
              </div>
            )}

            <div className="btn-row">
              <button
                className="btn mint"
                onClick={async () => {
                  try {
                    await shareMonthXlsx(d, profile.name, monthTxs, data.accounts, data.categories);
                  } catch (e) {
                    toast(`😿 ${(e as Error).message}`);
                  }
                }}
              >
                📗 Excel file
              </button>
              <button
                className="btn sky"
                onClick={async () => {
                  const csv = entriesCsv(monthTxs, data.accounts, data.categories, profiles);
                  await shareEntriesCsv(`${profile.name}-${month}-entries.csv`, csv);
                }}
              >
                📄 CSV
              </button>
            </div>
            <div className="tiny muted center mt">
              {monthTxs.length} entries this month · all stored on this phone
            </div>
          </>
        )}
      </div>
    </>
  );
}
