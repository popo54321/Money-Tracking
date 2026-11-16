import { dueDateFor, statementAfter, statementOnOrBefore } from '../domain/creditCard';
import { useState } from 'react';
import { fmtDate, relativeDays, todayISO, addDays, diffDays } from '../domain/dates';
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
import { moneyBackOn } from '../domain/balances';
import { MoneyBackSheet } from './MoneyBack';

export function TxRow({ tx, contextAccountId, ghost }: { tx: Tx; contextAccountId?: string; ghost?: boolean }) {
  const { go, confirm, removeWithUndo, today } = useApp();
  const [menu, setMenu] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const { accountById, categoryById, moneyBack, allTxs } = useData();
  const isBack = tx.kind === 'expense' && tx.amount < 0;
  const backs = tx.kind === 'expense' && !isBack ? (moneyBack.get(tx.id) ?? []) : [];
  const backTotal = backs.length ? moneyBackOn(tx, backs, (id) => accountById.get(id)?.currency) : 0;
  const canGetBack = tx.kind === 'expense' && !isBack && !tx.feeFor && !ghost;
  const acc = accountById.get(tx.accountId);
  const to = tx.toAccountId ? accountById.get(tx.toAccountId) : undefined;
  const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;

  let emoji = '❔';
  let colour = 'lav';
  let title = '';
  let amount = tx.amount;
  // a wallet other than the account's main one has its own currency
  let cur = tx.pocket ?? acc?.currency ?? '';
  let cls = '';
  if (tx.kind === 'income' || tx.kind === 'expense') {
    emoji = categoryEmoji(cat);
    colour = tx.kind === 'income' ? 'mint' : groupColour(cat?.group ?? '');
    title = cat?.name ?? (tx.kind === 'income' ? 'Income' : 'Spending');
    amount = tx.kind === 'income' ? tx.amount : -tx.amount;
    cls = tx.kind === 'income' ? 'pos' : 'neg';
    if (isBack) {
      // money back: adds to the account, takes off the category's spending
      title = `Money back · ${cat?.name ?? 'Spending'}`;
      colour = 'mint';
      cls = 'pos';
    }
  } else if (tx.kind === 'transfer') {
    emoji = '🔄';
    colour = 'lav';
    title =
      tx.toAccountId === tx.accountId
        ? `${acc?.name ?? '?'}: ${tx.pocket ?? acc?.currency} → ${tx.toPocket ?? acc?.currency}`
        : `${acc?.name ?? '?'} → ${to?.name ?? '?'}`;
    if (contextAccountId && contextAccountId === tx.toAccountId && tx.toAccountId !== tx.accountId) {
      amount = tx.toAmount ?? tx.amount;
      cur = tx.toPocket ?? to?.currency ?? cur;
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
    backTotal > 0.005 ? `💸 ${fmtMoney(backTotal, cur)} back · yours ${fmtMoney(tx.amount - backTotal, cur)}` : '',
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
      // keep what it was typed in: another currency, or a wallet of a cash or top-up card
      currency: tx.origCurrency ?? tx.pocket,
      toAmount: tx.kind === 'transfer' && tx.toAmount !== tx.amount ? tx.toAmount : undefined,
      toWallet: tx.toPocket,
      categoryId: tx.categoryId,
      note: tx.note,
    });
  };
  return (
    <>
      <button
        className={`row ${ghost ? 'ghost' : ''}`}
        // a move's fee opens its move: that is where it is changed or removed
        onClick={() => go({ name: 'entry', id: tx.feeFor ?? tx.id })}
        {...holdProps(() => setMenu(true))}
      >
        <div className={`bubble ${colour}`}>{emoji}</div>
        <div className="main">
          <div className="title">{title}</div>
          <div className="sub">{sub || ' '}</div>
        </div>
        <div className="end">
          <div className={`amt ${cls}`}>{fmtMoney(amount, cur, { sign: tx.kind !== 'transfer' || !!contextAccountId })}</div>
          {tx.origCurrency && tx.origAmount !== undefined ? (
            <div className="amt2">{fmtMoney(Math.abs(tx.origAmount), tx.origCurrency)}</div>
          ) : (
            // an exchange: what arrived, in the other currency
            tx.kind === 'transfer' &&
            tx.toAccountId === tx.accountId && (
              <div className="amt2">→ {fmtMoney(tx.toAmount ?? tx.amount, tx.toPocket ?? acc?.currency ?? '')}</div>
            )
          )}
        </div>
      </button>
      {menu && (
        <QuickActions
          title={`${title} · ${fmtMoney(amount, cur)}`}
          onClose={() => setMenu(false)}
          actions={
            isBack
              ? [
                  { label: '✏️ Edit', tone: 'plain', run: () => go({ name: 'entry', id: tx.id }) },
                  ...(tx.refundOf && allTxs.some((t) => t.id === tx.refundOf)
                    ? [
                        {
                          label: '🧾 Open the spending',
                          tone: 'plain' as const,
                          run: () => go({ name: 'entry', id: tx.refundOf! }),
                        },
                      ]
                    : []),
                  {
                    label: '🗑️ Delete',
                    tone: 'danger',
                    run: async () => {
                      if (!(await confirm({ title: 'Delete this money back?', ok: 'Delete', danger: true }))) return;
                      await removeWithUndo(() => deleteTx(tx.id));
                    },
                  },
                ]
              : tx.feeFor
                ? [
                    {
                      label: '🔄 Open the move (its fee is changed there)',
                      tone: 'plain',
                      run: () => go({ name: 'entry', id: tx.feeFor! }),
                    },
                  ]
                : [
                    ...(canGetBack ? [{ label: '💸 Got money back', tone: 'mint' as const, run: () => setBackOpen(true) }] : []),
                    { label: '✏️ Edit', tone: 'plain', run: () => go({ name: 'entry', id: tx.id }) },
                    { label: '📄 Duplicate (log it again today)', tone: 'plain', run: duplicate },
                    {
                      label: '🗑️ Delete',
                      tone: 'danger',
                      run: async () => {
                        if (!(await confirm({ title: 'Delete this entry?', ok: 'Delete', danger: true }))) return;
                        const alsoBacks = backs.length > 0 && (await askDeleteBacks(confirm, backTotal, cur));
                        await removeWithUndo(async () => {
                          await deleteTx(tx.id);
                          if (alsoBacks) for (const b of backs) await deleteTx(b.id);
                          if (tx.recurringId) {
                            // keep the repeating entry from recording this date again
                            const r = await db.recurring.get(tx.recurringId);
                            if (r && (!r.lastPosted || r.lastPosted < tx.date))
                              await db.recurring.update(r.id, { lastPosted: tx.date });
                          }
                        });
                      },
                    },
                  ]
          }
        />
      )}
      {backOpen && <MoneyBackSheet spending={tx} open={backOpen} onClose={() => setBackOpen(false)} />}
    </>
  );
}

/** A spending with money back is being deleted: delete its money back too? (No keeps them as they are.) */
export async function askDeleteBacks(
  confirm: (o: { title: string; message?: string; ok?: string; cancel?: string; danger?: boolean }) => Promise<boolean>,
  total: number,
  currency: string,
): Promise<boolean> {
  return confirm({
    title: 'Delete its money back too?',
    message: `${fmtMoney(total, currency)} came back for this spending. Delete that as well, or keep it (the money did arrive)?`,
    ok: 'Delete it too',
    cancel: 'Keep it',
    danger: true,
  });
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

function scheduleBucket(date: string, today: string): 'Overdue' | 'This week' | 'Later' {
  if (date < today) return 'Overdue';
  return diffDays(today, date) <= 6 ? 'This week' : 'Later';
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
      // a charge on a card is paid with that card's statement: say when
      let payBy: string | undefined;
      if (u.source === 'recurring' && acc?.type === 'credit' && acc.statementDay && acc.dueDay) {
        const stmt = statementOnOrBefore(u.date, acc.statementDay) === u.date ? u.date : statementAfter(u.date, acc.statementDay);
        payBy = `pay by ${fmtDate(dueDateFor(stmt, acc.dueDay), false)}`;
      }
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
                {[u.overdue ? 'Overdue!' : u.source === 'card' ? `Due ${when}` : when, acc?.name, payBy]
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
        // headings: Overdue, This week (the next 7 days), Later
        (['Overdue', 'This week', 'Later'] as const).map((h) => {
          const part = shown.filter((r) => scheduleBucket(r.date, today) === h);
          return part.length ? (
            <div key={h}>
              <div className="date-head">{h}</div>
              <div className="list">{part.map((r) => r.node)}</div>
            </div>
          ) : null;
        })
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
