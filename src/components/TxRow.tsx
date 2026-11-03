import { fmtDate, todayISO, addDays } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import type { Tx } from '../domain/types';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupColour } from '../ui/emoji';

export function TxRow({ tx, contextAccountId }: { tx: Tx; contextAccountId?: string }) {
  const { go } = useApp();
  const { accountById, categoryById } = useData();
  const acc = accountById.get(tx.accountId);
  const to = tx.toAccountId ? accountById.get(tx.toAccountId) : undefined;
  const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;

  let emoji = '❔';
  let colour = 'lav';
  let title = '';
  let amount = tx.amount;
  let cur = acc?.currency ?? '';
  let cls = '';
  if (tx.kind === 'income' || tx.kind === 'expense') {
    emoji = categoryEmoji(cat);
    colour = tx.kind === 'income' ? 'mint' : groupColour(cat?.group ?? '');
    title = cat?.name ?? (tx.kind === 'income' ? 'Income' : 'Spending');
    amount = tx.kind === 'income' ? tx.amount : -tx.amount;
    cls = tx.kind === 'income' ? 'pos' : 'neg';
  } else if (tx.kind === 'transfer') {
    emoji = '🔄';
    colour = 'lav';
    title = `${acc?.name ?? '?'} → ${to?.name ?? '?'}`;
    if (contextAccountId && contextAccountId === tx.toAccountId) {
      amount = tx.toAmount ?? tx.amount;
      cur = to?.currency ?? cur;
      cls = 'pos';
    } else {
      amount = contextAccountId ? -tx.amount : tx.amount;
      cls = contextAccountId ? 'neg' : '';
    }
  } else {
    emoji = '🪄';
    colour = 'butter';
    title = 'Balance adjusted';
    cls = tx.amount >= 0 ? 'pos' : 'neg';
  }
  const sub = [tx.kind === 'transfer' ? '' : acc?.name, tx.note, tx.recurringId ? '🔁' : ''].filter(Boolean).join(' · ');
  return (
    <button className="row" onClick={() => go({ name: 'entry', id: tx.id })}>
      <div className={`bubble ${colour}`}>{emoji}</div>
      <div className="main">
        <div className="title">{title}</div>
        <div className="sub">{sub || ' '}</div>
      </div>
      <div className="end">
        <div className={`amt ${cls}`}>{fmtMoney(amount, cur, { sign: tx.kind !== 'transfer' || !!contextAccountId })}</div>
        {tx.origCurrency && tx.origAmount !== undefined && (
          <div className="amt2">{fmtMoney(tx.origAmount, tx.origCurrency)}</div>
        )}
      </div>
    </button>
  );
}

function dayLabel(d: string): string {
  const t = todayISO();
  if (d === t) return 'Today';
  if (d === addDays(t, -1)) return 'Yesterday';
  return fmtDate(d);
}

/** Entries grouped under date headings, newest first. */
export function TxGroups({ txs, contextAccountId, limit }: { txs: Tx[]; contextAccountId?: string; limit?: number }) {
  const sorted = [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const days: { d: string; items: Tx[] }[] = [];
  for (const t of shown) {
    const last = days[days.length - 1];
    if (last && last.d === t.date) last.items.push(t);
    else days.push({ d: t.date, items: [t] });
  }
  return (
    <>
      {days.map((g) => (
        <div key={g.d}>
          <div className="date-head">{dayLabel(g.d)}</div>
          <div className="list">
            {g.items.map((t) => (
              <TxRow key={t.id} tx={t} contextAccountId={contextAccountId} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
