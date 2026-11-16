// Money back: money that comes back for something you paid (friends paying their share, a refund). It is saved as
// spending with a negative amount in a spending category, so it adds to the account and takes off that category's
// spending in the month it arrives. It is not income.
import { useState } from 'react';
import { moneyBackOn } from '../domain/balances';
import { fmtDate } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { accountCurrencies, WALLET_TYPES, type Tx } from '../domain/types';
import { deleteTx, saveTx } from '../db/repo';
import { useApp, useData } from '../state/app';
import { AccountPickerButton, AmountField, CategoryGrid, Field, NoteInput, Sheet } from './ui';

export function MoneyBackForm({
  spending,
  existing,
  onDone,
}: {
  /** the spending it comes back for (none: just a category) */
  spending?: Tx;
  /** a money back entry being changed */
  existing?: Tx;
  onDone: () => void;
}) {
  const { profile, rates, currency, today, toast, confirm } = useApp();
  const data = useData();
  const usable = data.accounts.filter((a) => !a.archived || a.id === existing?.accountId);
  const spendCur = spending ? (spending.pocket ?? data.accountById.get(spending.accountId)?.currency) : undefined;
  const [accountId, setAccountId] = useState<string | undefined>(
    existing?.accountId ??
      (spending && data.accountById.get(spending.accountId)?.type !== 'credit' ? spending.accountId : undefined) ??
      usable.find((a) => a.type === 'bank' || a.type === 'cash')?.id,
  );
  const [amount, setAmount] = useState<number | null>(existing ? -existing.amount : null);
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [categoryId, setCategoryId] = useState<string | undefined>(spending?.categoryId ?? existing?.categoryId);
  const acc = accountId ? data.accountById.get(accountId) : undefined;
  // a cash purse or top-up card holding the spending's currency takes it in that wallet
  const pocket =
    acc && spendCur && spendCur !== acc.currency && WALLET_TYPES.has(acc.type) && accountCurrencies(acc).includes(spendCur)
      ? spendCur
      : existing?.accountId === acc?.id
        ? existing?.pocket
        : undefined;
  const cur = pocket ?? acc?.currency ?? currency;
  const curOf = (id: string) => data.accountById.get(id)?.currency;
  const others = spending ? (data.moneyBack.get(spending.id) ?? []).filter((t) => t.id !== existing?.id) : [];
  const backSoFar = spending ? moneyBackOn(spending, others, curOf) : 0;
  const rest = spending ? spending.amount - backSoFar : 0;
  const cat = categoryId ? data.categoryById.get(categoryId) : undefined;

  const save = async () => {
    if (!amount || amount <= 0) return toast('Type how much came back 🧮');
    if (!acc) return toast('Choose the account it came into 👛');
    if (!categoryId) return toast('Pick a category 🏷️');
    if (spending && cur === spendCur && amount - rest > 0.005) {
      const ok = await confirm({
        title: 'More than you spent?',
        message: `${fmtMoney(amount, cur)} is more than the ${fmtMoney(Math.max(0, rest), cur)} still to come back. Save it anyway?`,
        ok: 'Save',
      });
      if (!ok) return;
    }
    await saveTx(
      {
        id: existing?.id,
        profileId: profile.id,
        date,
        kind: 'expense',
        accountId: acc.id,
        pocket,
        amount: -amount,
        categoryId,
        note: note.trim() || undefined,
        refundOf: spending?.id ?? existing?.refundOf,
      },
      rates,
      currency,
    );
    toast(`💸 ${fmtMoney(amount, cur)} back${cat ? ` · ${cat.name} spending goes down` : ''}`);
    onDone();
  };

  return (
    <>
      {spending && (
        <div className="card flat small">
          <b>{spending.note || data.categoryById.get(spending.categoryId ?? '')?.name || 'Spending'}</b>
          <span className="muted"> · {fmtDate(spending.date)}</span>
          <div className="mt">
            Spent {fmtMoney(spending.amount, spendCur ?? '')}
            {backSoFar > 0.005 && ` · ${fmtMoney(backSoFar, spendCur ?? '')} back so far`}
          </div>
        </div>
      )}
      <Field label="How much came back">
        <AmountField value={amount} onChange={setAmount} currency={cur} title="Money back" />
      </Field>
      {spending && cur === spendCur && rest > 0.005 && amount !== rest && (
        <button type="button" className="btn sm ghost mb" onClick={() => setAmount(Math.round(rest * 100) / 100)}>
          All the rest: {fmtMoney(rest, cur)}
        </button>
      )}
      <Field label="Came into">
        <AccountPickerButton accounts={usable} value={accountId} onChange={setAccountId} />
      </Field>
      <Field label="Date" hint="It counts in this date's month: that month's spending goes down, and its limit has more room.">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} />
      </Field>
      <Field label="Note">
        <NoteInput value={note} onChange={setNote} placeholder="e.g. Ben paid his share" />
      </Field>
      {!spending && (
        <>
          <div className="small bold mb">Which spending is it for?</div>
          <CategoryGrid categories={data.categories} kind="expense" value={categoryId} onPick={setCategoryId} />
        </>
      )}
      <div className="btn-row mt">
        {existing && (
          <button
            className="btn danger"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this money back?', ok: 'Delete', danger: true }))) return;
              await deleteTx(existing.id);
              toast('Deleted');
              onDone();
            }}
          >
            Delete
          </button>
        )}
        <button className="btn primary grow" onClick={save}>
          {existing ? 'Save changes' : 'Save money back'}
        </button>
      </div>
      <div className="tiny muted mt">
        Money back isn’t income: it takes the amount off this category’s spending. If more comes back than was spent that month,
        the extra raises the limit for that month only.
      </div>
    </>
  );
}

export function MoneyBackSheet({ spending, open, onClose }: { spending: Tx; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="💸 Got money back">
      {open && <MoneyBackForm spending={spending} onDone={onClose} />}
    </Sheet>
  );
}

/** The money back on one spending, for its edit page: each entry, and a button to add one. */
export function MoneyBackList({ spending }: { spending: Tx }) {
  const { go } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const backs = (data.moneyBack.get(spending.id) ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const spendCur = spending.pocket ?? data.accountById.get(spending.accountId)?.currency ?? '';
  const total = moneyBackOn(spending, backs, (id) => data.accountById.get(id)?.currency);
  return (
    <div className="card flat">
      <div className="between">
        <b className="small">💸 Money back</b>
        {backs.length > 0 && (
          <span className="small">
            yours: <b>{fmtMoney(spending.amount - total, spendCur)}</b>
          </span>
        )}
      </div>
      <div className="tiny muted mb">
        Paid for others, or got a refund? Add what came back: it takes it off this category’s spending in the month it arrives.
      </div>
      {backs.map((b) => (
        <button key={b.id} className="between small row-plain" onClick={() => go({ name: 'entry', id: b.id })}>
          <span>
            {fmtDate(b.date)} · {data.accountById.get(b.accountId)?.name}
            {b.note ? ` · ${b.note}` : ''}
          </span>
          <b className="pos">+{fmtMoney(-b.amount, b.pocket ?? data.accountById.get(b.accountId)?.currency ?? '')}</b>
        </button>
      ))}
      <button className="btn mint block mt" onClick={() => setOpen(true)}>
        ＋ Got money back
      </button>
      <MoneyBackSheet spending={spending} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
