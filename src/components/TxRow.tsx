import { useState } from 'react';
import { fmtDate, relativeDays, todayISO, addDays } from '../domain/dates';
import { deleteTx, postOccurrence, skipOccurrence } from '../db/repo';
import type { UpcomingItem } from '../domain/reserve';
import { db } from '../db/db';
import { holdProps } from './hold';
import { QuickActions } from './QuickActions';
import { useFold } from './ui';
import { fmtMoney } from '../domain/money';
import type { Tx } from '../domain/types';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupColour } from '../ui/emoji';

export function TxRow({ tx, contextAccountId, ghost }: { tx: Tx; contextAccountId?: string; ghost?: boolean }) {
  const { go, confirm, removeWithUndo, today } = useApp();
  const [menu, setMenu] = useState(false);
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
  const sub = [
    ghost ? `Scheduled · ${fmtDate(tx.date, false)} (${relativeDays(today, tx.date)})` : '',
    tx.kind === 'transfer' ? '' : acc?.name,
    tx.note,
    tx.recurringId ? '🔁' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const duplicate = () => {
    go({
      name: 'entry',
      kind: tx.kind === 'adjust' ? 'expense' : tx.kind,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId,
      amount: tx.origAmount ?? tx.amount,
      categoryId: tx.categoryId,
      note: tx.note,
    });
  };
  return (
    <>
      <button
        className={`row ${ghost ? 'ghost' : ''}`}
        onClick={() => go({ name: 'entry', id: tx.id })}
        {...holdProps(() => setMenu(true))}
      >
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
      {menu && (
        <QuickActions
          title={`${title} · ${fmtMoney(amount, cur)}`}
          onClose={() => setMenu(false)}
          actions={[
            { label: '✏️ Edit', tone: 'plain', run: () => go({ name: 'entry', id: tx.id }) },
            { label: '📄 Duplicate (log it again today)', tone: 'mint', run: duplicate },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: 'Delete this entry?', ok: 'Delete', danger: true }))) return;
                await removeWithUndo(async () => {
                  await deleteTx(tx.id);
                  if (tx.recurringId) {
                    // keep the repeating entry from recording this date again
                    const r = await db.recurring.get(tx.recurringId);
                    if (r && (!r.lastPosted || r.lastPosted < tx.date)) await db.recurring.update(r.id, { lastPosted: tx.date });
                  }
                });
              },
            },
          ]}
        />
      )}
    </>
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

/**
 * Faded placeholders for what is still to come: entries dated in the future, plus the next payment of
 * each repeating entry and unpaid card statements. Each becomes a normal entry on its day.
 */
export function ScheduledList({
  accountId,
  days = 31,
  limit,
  foldKey,
}: {
  accountId?: string;
  days?: number;
  limit?: number;
  /** when set, the heading folds the list into one line, remembered under this name */
  foldKey?: string;
}) {
  const [open, toggle] = useFold(foldKey ?? 'scheduled', true);
  const { go, today, rates, currency, toast } = useApp();
  const data = useData();
  const [quick, setQuick] = useState<UpcomingItem | null>(null);
  const txRows = data.scheduled
    .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
    .map((t) => ({
      key: `t:${t.id}`,
      date: t.date,
      label: t.note || (t.categoryId ? data.categoryById.get(t.categoryId)?.name : undefined) || 'Entry',
      node: <TxRow key={t.id} tx={t} contextAccountId={accountId} ghost />,
    }));
  const upRows = data.upcoming
    .filter((u) => u.daysAway <= days && (!accountId || u.accountId === accountId || u.reserveAccountId === accountId))
    .map((u) => {
      const r = u.source === 'recurring' ? data.recurring.find((x) => x.id === u.refId) : undefined;
      const cat = r?.categoryId ? data.categoryById.get(r.categoryId) : undefined;
      const acc = data.accountById.get(u.accountId);
      const keep =
        u.reserveAccountId && u.reserveAccountId !== u.accountId ? data.accountById.get(u.reserveAccountId) : undefined;
      const signed = u.kind === 'income' ? u.amount : u.kind === 'transfer' ? u.amount : -u.amount;
      const emoji = u.source === 'card' ? '💳' : u.kind === 'transfer' ? '🔄' : categoryEmoji(cat);
      const when = `${fmtDate(u.date, false)} (${relativeDays(today, u.date)})`;
      return {
        key: u.key,
        date: u.date,
        label: u.label,
        node: (
          <button
            key={u.key}
            className="row ghost"
            onClick={() =>
              u.source === 'card' ? go({ name: 'account', id: u.refId }) : go({ name: 'recurringEdit', id: u.refId })
            }
            {...holdProps(() => setQuick(u))}
          >
            <div className={`bubble ${u.kind === 'income' ? 'mint' : u.overdue ? 'pink' : groupColour(cat?.group ?? '')}`}>
              {emoji}
            </div>
            <div className="main">
              <div className="title">{u.label}</div>
              <div className="sub">
                {[
                  u.overdue ? 'Overdue!' : u.source === 'card' ? `Due ${when}` : `Scheduled · ${when}`,
                  acc?.name,
                  keep ? `keep in ${keep.name}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div className="end">
              <div className={`amt ${u.kind === 'income' ? 'pos' : u.kind === 'transfer' ? '' : 'neg'}`}>
                {fmtMoney(signed, u.currency, { sign: u.kind !== 'transfer' })}
              </div>
              {r && r.autoPost && <div className="amt2">records itself</div>}
            </div>
          </button>
        ),
      };
    });
  const rows = [...txRows, ...upRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (rows.length === 0) return null;
  const shown = limit ? rows.slice(0, limit) : rows;
  const folded = !!foldKey && !open;
  const next = rows[0];
  return (
    <>
      <div className="section-title">
        {foldKey ? (
          <button className="fold-head" aria-expanded={open} onClick={toggle}>
            <span className="fold-arrow">{open ? '▾' : '▸'}</span> 📅 Scheduled
          </button>
        ) : (
          <span>📅 Scheduled</span>
        )}
        <span className="grow" />
        <button className="btn sm ghost" onClick={() => go({ name: 'recurring' })}>
          Repeating ›
        </button>
      </div>
      {folded ? (
        <button className="card fold-line" onClick={toggle}>
          {rows.length} coming up · next: {next.label} {relativeDays(today, next.date)}
        </button>
      ) : (
        <div className="list">{shown.map((r) => r.node)}</div>
      )}
      {quick && (
        <QuickActions
          title={quick.label}
          onClose={() => setQuick(null)}
          actions={(() => {
            if (quick.source === 'card') {
              const card = data.accountById.get(quick.refId);
              return [
                {
                  label: `💳 Pay ${fmtMoney(quick.amount, quick.currency)} now`,
                  tone: 'mint' as const,
                  run: () =>
                    go({
                      name: 'entry',
                      kind: 'transfer',
                      accountId: card?.payFromAccountId,
                      toAccountId: quick.refId,
                      amount: quick.amount,
                      note: `${card?.name ?? 'Card'} payment`,
                    }),
                },
                { label: '📖 Open card', tone: 'plain' as const, run: () => go({ name: 'account', id: quick.refId }) },
              ];
            }
            const r = data.recurring.find((x) => x.id === quick.refId);
            if (!r) return [];
            return [
              {
                label: `✅ Record now (due ${fmtDate(quick.date, false)})`,
                tone: 'mint' as const,
                run: async () => {
                  await postOccurrence(r, quick.date, rates, currency);
                  toast(`✅ Recorded for ${fmtDate(quick.date, false)}`);
                },
              },
              {
                label: `⏭️ Skip ${fmtDate(quick.date, false)}`,
                tone: 'butter' as const,
                run: async () => {
                  await skipOccurrence(r, quick.date);
                  toast(`⏭️ Skipped ${fmtDate(quick.date, false)}`);
                },
              },
              { label: '✏️ Edit repeating entry', tone: 'plain' as const, run: () => go({ name: 'recurringEdit', id: r.id }) },
            ];
          })()}
        />
      )}
    </>
  );
}
