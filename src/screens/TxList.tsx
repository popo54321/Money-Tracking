import { useState } from 'react';
import { Topbar } from '../components/ui';
import { TxGroups } from '../components/TxRow';
import { fmtDate } from '../domain/dates';
import { useData, type Route } from '../state/app';

type R = Extract<Route, { name: 'txList' }>;

export function TxList({ route }: { route: R }) {
  const data = useData();
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
      const cat = t.categoryId ? data.categoryById.get(t.categoryId)?.name ?? '' : '';
      const acc = data.accountById.get(t.accountId)?.name ?? '';
      const hay = `${t.note ?? ''} ${cat} ${acc} ${t.amount}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const title = route.title ?? (route.categoryId ? data.categoryById.get(route.categoryId)?.name ?? 'Entries' : 'Entries');
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
        <div className="small muted mt">{list.length} entries</div>
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
