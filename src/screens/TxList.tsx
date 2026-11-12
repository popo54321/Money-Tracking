import { useState } from 'react';
import { Topbar } from '../components/ui';
import { ScheduledList, TxGroups } from '../components/TxRow';
import { fmtDate, relativeDays } from '../domain/dates';
import { plannedItems } from '../domain/limits';
import { fmtMoney } from '../domain/money';
import { categoryEmoji, groupColour } from '../ui/emoji';
import { useApp, useData, type Route } from '../state/app';

type R = Extract<Route, { name: 'txList' }>;

export function TxList({ route }: { route: R }) {
  const data = useData();
  const { today, currency, rates, go } = useApp();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(150);
  const query = q.trim().toLowerCase();
  const list = data.txs.filter((t) => {
    if (route.categoryId !== undefined && (t.categoryId ?? '') !== route.categoryId) return false;
    if (route.categoryId === '' && t.kind !== 'income' && t.kind !== 'expense') return false;
    if (route.accountId && t.accountId !== route.accountId && t.toAccountId !== route.accountId) return false;
    if (route.from && t.date < route.from) return false;
    if (route.to && t.date > route.to) return false;
    if (query) {
      const cat = t.categoryId ? (data.categoryById.get(t.categoryId)?.name ?? '') : '';
      const acc = data.accountById.get(t.accountId)?.name ?? '';
      const hay = `${t.note ?? ''} ${cat} ${acc} ${t.amount}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  // one category over a period that is not over yet: also show what is still to come in it (as limits count it)
  const coming =
    route.categoryId && route.to && route.to > today && !query
      ? plannedItems(
          data.recurring,
          data.scheduled,
          data.accounts,
          route.from && route.from > today ? route.from : today,
          route.to,
          currency,
          rates,
        ).filter((it) => it.categoryId === route.categoryId)
      : [];
  const title = route.title ?? (route.categoryId ? (data.categoryById.get(route.categoryId)?.name ?? 'Entries') : 'Entries');
  return (
    <>
      <Topbar title={title} />
      <div className="page">
        {(route.from || route.to) && (
          <div className="small muted mb">
            {route.from ? fmtDate(route.from) : '…'} – {route.to ? fmtDate(route.to) : '…'}
          </div>
        )}
        <input placeholder="🔍 Search notes, categories, amounts" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="small muted mt">
          {list.length} entries{coming.length ? ` · ${coming.length} coming up` : ''}
        </div>
        {coming.length > 0 && (
          <div>
            <div className="date-head">Coming up</div>
            <div className="list">
              {coming.map((it) => {
                const cat = data.categoryById.get(it.categoryId);
                return (
                  <button
                    key={it.key}
                    className="row ghost"
                    onClick={() => it.recurringId && go({ name: 'recurringEdit', id: it.recurringId })}
                  >
                    <div className={`bubble ${groupColour(cat?.group ?? '')}`}>{categoryEmoji(cat)}</div>
                    <div className="main">
                      <div className="title">{it.label}</div>
                      <div className="sub">
                        {fmtDate(it.date, false)} ({relativeDays(today, it.date)}) ·{' '}
                        {data.accountById.get(it.accountId)?.name ?? '?'}
                      </div>
                    </div>
                    <div className="end">
                      <div className="amt neg">{fmtMoney(-it.amount, it.currency, { sign: true })}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!query && !route.categoryId && !route.from && <ScheduledList accountId={route.accountId} days={62} />}
        <TxGroups txs={list} limit={limit} />
        {list.length > limit && (
          <button className="btn block" onClick={() => setLimit(limit + 300)}>
            Show more
          </button>
        )}
      </div>
    </>
  );
}
