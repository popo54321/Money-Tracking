import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import {
  AccountPickerButton,
  AmountField,
  CategoryGrid,
  CurrencySheet,
  Field,
  NumberInput,
  Seg,
  Sheet,
  ToggleRow,
  Topbar,
  Sparkle,
  Avatar,
  CalcSheet,
} from '../components/ui';
import { debtStatus, debtSummary, everyoneSummary, paybackNote, type Debt, type DebtEvent } from '../domain/debts';
import { addDays, fmtDate } from '../domain/dates';
import { convert } from '../domain/fx';
import { decimalsFor, fmtMoney, roundTo } from '../domain/money';
import { accountCurrencies } from '../domain/types';
import { copyText } from '../services/platform';
import { db, uid } from '../db/db';
import { deleteDebt, deleteTx, saveDebt, saveTx } from '../db/repo';
import { useApp, useData } from '../state/app';
import { ProfileSwitch } from './Home';
import { holdProps } from '../components/hold';
import { QuickActions } from '../components/QuickActions';

function interestText(d: Debt): string {
  if (d.interestType === 'none' || !d.ratePct) return 'no interest';
  return `${d.ratePct}% per ${d.ratePer}${d.interestType === 'compound' ? ', compounding monthly' : ''}`;
}

export function DebtList() {
  const { profile, go, today, currency, rates, confirm, toast, removeWithUndo } = useApp();
  const [quick, setQuick] = useState<Debt | null>(null);
  const [amountFor, setAmountFor] = useState<{ debt: Debt; type: DebtEvent['type'] } | null>(null);
  const addEvent = async (debt: Debt, type: DebtEvent['type'], amount: number) => {
    if (!amount) return;
    await saveDebt({ ...debt, events: [...debt.events, { id: uid(), date: today, type, amount }] });
    toast(type === 'repay' ? `💰 ${fmtMoney(amount, debt.currency)} paid back` : `💸 ${fmtMoney(amount, debt.currency)} added`);
  };
  const debts = useLiveQuery(() => db.debts.where('profileId').equals(profile.id).toArray(), [profile.id]);
  const [showClosed, setShowClosed] = useState(false);
  const create = async (direction: Debt['direction']) => {
    const d: Debt = {
      id: uid(),
      profileId: profile.id,
      person: '',
      direction,
      currency,
      interestType: 'none',
      ratePct: 0,
      ratePer: 'year',
      events: [],
      closed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveDebt(d);
    go({ name: 'debt', id: d.id });
  };
  const list = (debts ?? []).filter((d) => showClosed || !d.closed);
  const totals = { owedToMe: 0, iOwe: 0 };
  for (const d of debts ?? []) {
    if (d.closed) continue;
    const v = convert(debtStatus(d, today).owed, d.currency, currency, rates) ?? 0;
    totals[d.direction] += v;
  }
  const section = (dir: Debt['direction'], title: string) => {
    const items = list.filter((d) => d.direction === dir);
    if (!items.length) return null;
    return (
      <>
        <div className="section-title">{title}</div>
        <div className="list">
          {items.map((d) => {
            const s = debtStatus(d, today);
            return (
              <button
                key={d.id}
                className="row"
                onClick={() => go({ name: 'debt', id: d.id })}
                {...holdProps(() => setQuick(d))}
                style={{ opacity: d.closed ? 0.55 : 1 }}
              >
                <Avatar name={d.person || '?'} />
                <div className="main">
                  <div className="title">
                    {d.person || 'Someone'} {d.closed ? '✅' : ''}
                  </div>
                  <div className="sub">
                    {s.startDate ? `since ${fmtDate(s.startDate)}` : 'nothing logged yet'} · {interestText(d)}
                    {d.dueDate ? ` · due ${fmtDate(d.dueDate, false)}` : ''}
                  </div>
                </div>
                <div className="end">
                  <div className={`amt ${dir === 'owedToMe' ? 'pos' : 'neg'}`}>{fmtMoney(s.owed, d.currency)}</div>
                  {s.interest > 0.005 && <div className="amt2">incl. {fmtMoney(s.interest, d.currency)} interest</div>}
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  };
  return (
    <>
      <Topbar title="Who owes me 🤝" right={<ProfileSwitch />} />
      <div className="page">
        <div className="hero">
          <Sparkle k="debts" />
          <div className="label">People owe me</div>
          <div className="big">{fmtMoney(totals.owedToMe, currency)}</div>
          <div className="small bold">I owe others {fmtMoney(totals.iOwe, currency)}</div>
        </div>
        {(debts ?? []).some((d) => !d.closed) && (
          <button
            className="btn sky block mb"
            onClick={async () => {
              const ok = await copyText(
                everyoneSummary(
                  debts ?? [],
                  today,
                  (n, c) => fmtMoney(n, c),
                  (x) => fmtDate(x),
                ),
              );
              toast(ok ? '📋 Copied everyone, paste it in the group chat' : 'Could not copy');
            }}
          >
            📋 Summary for everyone
          </button>
        )}
        <div className="btn-row mb" data-tour="debt-add">
          <button className="btn mint" onClick={() => create('owedToMe')}>
            ＋ Someone owes me
          </button>
          <button className="btn pink" onClick={() => create('iOwe')}>
            ＋ I owe someone
          </button>
        </div>
        {debts && debts.length === 0 && (
          <div className="card center small muted">
            <div style={{ fontSize: 40 }}>🤝</div>
            Note down money you lent or borrowed. Add repayments as they come, and interest is worked out for you.
          </div>
        )}
        {section('owedToMe', '💚 They owe me')}
        {section('iOwe', '💗 I owe')}
        {(debts ?? []).some((d) => d.closed) && (
          <button className="btn ghost block" onClick={() => setShowClosed(!showClosed)}>
            {showClosed ? 'Hide settled' : 'Show settled'}
          </button>
        )}
        <div className="tiny muted center mt">
          A record of who owes what. Paybacks can also go into your money (as money back or income) when you add them.
        </div>
      </div>
      {quick && (
        <QuickActions
          title={quick.person || 'Someone'}
          onClose={() => setQuick(null)}
          actions={[
            // the same Paid back sheet as inside the person, so it can be logged in your money too
            { label: '💰 Add repayment', tone: 'mint', run: () => go({ name: 'debt', id: quick.id, repay: true }) },
            {
              label: quick.direction === 'owedToMe' ? '💸 Lent more' : '💸 Borrowed more',
              run: () => setAmountFor({ debt: quick, type: 'lend' }),
            },
            {
              label: quick.closed ? '↩️ Reopen' : '✅ Mark as settled',
              tone: 'sky',
              run: async () => {
                await saveDebt({ ...quick, closed: !quick.closed });
                toast(quick.closed ? '↩️ Reopened' : '✅ Settled');
              },
            },
            { label: '✏️ Open', tone: 'plain', run: () => go({ name: 'debt', id: quick.id }) },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: `Delete ${quick.person || 'this record'}?`, ok: 'Delete', danger: true }))) return;
                await removeWithUndo(() => deleteDebt(quick.id));
              },
            },
          ]}
        />
      )}
      {amountFor && (
        <CalcSheet
          open
          onClose={() => setAmountFor(null)}
          title={
            amountFor.debt.direction === 'owedToMe'
              ? `Lent ${amountFor.debt.person} more`
              : `Borrowed more from ${amountFor.debt.person}`
          }
          currency={amountFor.debt.currency}
          onDone={(v) => addEvent(amountFor.debt, amountFor.type, v)}
        />
      )}
    </>
  );
}

export function DebtDetail({ id, repay }: { id: string; repay?: boolean }) {
  const { today, replace, back, confirm, toast, removeWithUndo, profile, rates, currency } = useApp();
  const data = useData();
  const stored = useLiveQuery(() => db.debts.get(id), [id]);
  const [d, setD] = useState<Debt | null>(null);
  const [ev, setEv] = useState<DebtEvent | null>(null);
  const [quickEv, setQuickEv] = useState<DebtEvent | null>(null);
  const [curOpen, setCurOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // a payback can also be logged as income: into which account, as which category
  const [logIncome, setLogIncome] = useState(false);
  // logged as money back (takes it off a spending category, e.g. a dinner you paid for them) or as income
  const [logAs, setLogAs] = useState<'back' | 'income'>('income');
  const [incAcc, setIncAcc] = useState<string | undefined>();
  const [incCat, setIncCat] = useState<string | undefined>();
  const [backCat, setBackCat] = useState<string | undefined>();
  // the latest thing lent as part of my spending (a bill or trip): its category, and the spending when logged
  const spentLend = d
    ? [...d.events].filter((x) => x.type === 'lend' && x.spentCategoryId).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
    : undefined;
  useEffect(() => {
    if (!ev || !d) return;
    const tx = ev.txId ? data.allTxs.find((t) => t.id === ev.txId) : undefined;
    const isNewLine = !d.events.some((x) => x.id === ev.id);
    setLogIncome(!!tx || (isNewLine && d.direction === 'owedToMe'));
    setLogAs(tx ? (tx.kind === 'expense' ? 'back' : 'income') : spentLend ? 'back' : 'income');
    setIncAcc(tx?.accountId ?? data.accounts.find((a) => !a.archived && (a.type === 'bank' || a.type === 'cash'))?.id);
    setIncCat(
      (tx?.kind === 'income' ? tx.categoryId : undefined) ??
        data.categories.find((c) => c.kind === 'income' && !c.archived && /pay ?back|repay/i.test(c.name))?.id,
    );
    setBackCat((tx?.kind === 'expense' ? tx.categoryId : undefined) ?? spentLend?.spentCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id]);
  useEffect(() => {
    if (stored && !d) setD(stored);
  }, [stored, d]);
  // opened from "Add repayment" on the list: start with the Paid back sheet, filled with what is owed
  const repayOpened = useRef(false);
  useEffect(() => {
    if (!repay || !d || repayOpened.current) return;
    repayOpened.current = true;
    // once opened, it shouldn't open again if this screen is shown afresh
    replace({ name: 'debt', id });
    const owed = debtStatus(d, today).owed;
    setEv({ id: uid(), date: today, type: 'repay', amount: owed > 0 ? Math.round(owed * 100) / 100 : 0 });
  }, [repay, d, today, replace, id]);
  if (!d) return <Topbar title="Who owes me" />;
  const update = (patch: Partial<Debt>) => {
    const next = { ...d, ...patch };
    setD(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDebt(next), 300);
  };
  const s = debtStatus(d, today, addDays(today, 30));
  const atDue = d.dueDate && d.dueDate > today ? debtStatus(d, today, d.dueDate).projected : undefined;
  const cur = d.currency;
  const events = [...d.events].sort((a, b) => (a.date < b.date ? 1 : -1));
  const theyOwe = d.direction === 'owedToMe';

  return (
    <>
      <Topbar
        title={d.person || (theyOwe ? 'Someone owes me' : 'I owe someone')}
        right={
          <button
            className="icon-btn"
            aria-label="Delete"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this record?', ok: 'Delete', danger: true }))) return;
              clearTimeout(saveTimer.current);
              await removeWithUndo(() => deleteDebt(d.id));
              back();
            }}
          >
            🗑️
          </button>
        }
      />
      <div className="page">
        <Field label={theyOwe ? 'Who owes you' : 'Who you owe'}>
          <input value={d.person} placeholder="Name" onChange={(e) => update({ person: e.target.value })} autoFocus={!d.person} />
        </Field>
        <Seg
          value={d.direction}
          onChange={(v) => update({ direction: v })}
          options={[
            { v: 'owedToMe', label: '💚 They owe me' },
            { v: 'iOwe', label: '💗 I owe them' },
          ]}
        />

        <div className="hero mt">
          <Sparkle k="debts" override={theyOwe ? '💚' : '💗'} />
          <div className="label">{theyOwe ? 'They owe you now' : 'You owe now'}</div>
          <div className="big">{fmtMoney(s.owed, cur)}</div>
          <div className="stat-row">
            <div className="stat">
              <div className="k">{theyOwe ? 'Lent' : 'Borrowed'}</div>
              <div className="v">{fmtMoney(s.totalLent, cur, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Paid back</div>
              <div className="v">{fmtMoney(s.totalRepaid, cur, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Interest so far</div>
              <div className="v">{fmtMoney(s.totalInterest, cur, { compact: true })}</div>
            </div>
          </div>
          {d.interestType !== 'none' && d.ratePct > 0 && s.projected !== undefined && (
            <div className="small bold mt">
              In 30 days: {fmtMoney(s.projected, cur)}
              {atDue !== undefined ? ` · on ${fmtDate(d.dueDate!, false)}: ${fmtMoney(atDue, cur)}` : ''}
            </div>
          )}
        </div>

        <div className="btn-row mb">
          <button className="btn" onClick={() => setEv({ id: uid(), date: today, type: 'lend', amount: 0 })}>
            ＋ {theyOwe ? 'Lent more' : 'Borrowed more'}
          </button>
          <button
            className="btn mint"
            onClick={() =>
              setEv({ id: uid(), date: today, type: 'repay', amount: s.owed > 0 ? Math.round(s.owed * 100) / 100 : 0 })
            }
          >
            ＋ Paid back
          </button>
        </div>

        <div className="section-title">📒 History</div>
        {events.length === 0 ? (
          <div className="card small muted center">Add how much was {theyOwe ? 'lent' : 'borrowed'} and when.</div>
        ) : (
          <div className="list">
            {events.map((e) => (
              <button key={e.id} className="row" onClick={() => setEv(e)} {...holdProps(() => setQuickEv(e))}>
                <div className={`bubble ${e.type === 'lend' ? 'peach' : 'mint'}`}>{e.type === 'lend' ? '💸' : '💰'}</div>
                <div className="main">
                  <div className="title">{e.type === 'lend' ? (theyOwe ? 'Lent' : 'Borrowed') : 'Paid back'}</div>
                  <div className="sub">
                    {fmtDate(e.date)}
                    {e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <div className="end">
                  <div className={`amt ${e.type === 'repay' ? 'pos' : ''}`}>{fmtMoney(e.amount, cur)}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="card">
          <h2>📈 Interest</h2>
          <Seg
            value={d.interestType}
            onChange={(v) => update({ interestType: v })}
            options={[
              { v: 'none', label: 'None' },
              { v: 'simple', label: 'Simple' },
              { v: 'compound', label: 'Compound' },
            ]}
          />
          {d.interestType !== 'none' && (
            <>
              <div className="grid2 mt">
                <Field label="Rate %">
                  <NumberInput value={d.ratePct} onChange={(v) => update({ ratePct: v })} />
                </Field>
                <Field label="Per">
                  <Seg
                    value={d.ratePer}
                    onChange={(v) => update({ ratePer: v })}
                    options={[
                      { v: 'month', label: 'month' },
                      { v: 'year', label: 'year' },
                    ]}
                  />
                </Field>
              </div>
              <div className="tiny muted">
                {d.interestType === 'simple'
                  ? 'Interest grows day by day on the money still owed. Repayments clear interest first.'
                  : 'Unpaid interest is added to the amount owed every month, so it earns interest too.'}
              </div>
            </>
          )}
        </div>

        <div className="grid2">
          <Field label="Currency">
            <button type="button" className="amount-field" onClick={() => setCurOpen(true)}>
              {cur} <span className="cur">▾</span>
            </button>
          </Field>
          <Field label="Due date (optional)">
            <input type="date" value={d.dueDate ?? ''} onChange={(e) => update({ dueDate: e.target.value || undefined })} />
          </Field>
        </div>
        <Field label="Note">
          <input value={d.note ?? ''} onChange={(e) => update({ note: e.target.value || undefined })} placeholder="Optional" />
        </Field>
        <button
          className="btn sky block mb"
          onClick={async () => {
            const ok = await copyText(
              debtSummary(
                d,
                today,
                (n, c) => fmtMoney(n, c),
                (x) => fmtDate(x),
              ),
            );
            toast(ok ? '📋 Copied, paste it in the chat' : 'Could not copy');
          }}
        >
          📋 Copy summary
        </button>
        <button className={`btn block ${d.closed ? '' : 'mint'}`} onClick={() => update({ closed: !d.closed })}>
          {d.closed ? '↩️ Reopen' : '✅ Mark as settled'}
        </button>
      </div>

      <Sheet open={!!ev} onClose={() => setEv(null)} title={ev?.type === 'repay' ? 'Paid back' : theyOwe ? 'Lent' : 'Borrowed'}>
        {ev && (
          <>
            <Seg
              value={ev.type}
              onChange={(v) => setEv({ ...ev, type: v })}
              options={[
                { v: 'lend', label: theyOwe ? '💸 Lent' : '💸 Borrowed' },
                { v: 'repay', label: '💰 Paid back' },
              ]}
            />
            <div className="spacer" />
            <Field label="Amount">
              <AmountField value={ev.amount || null} onChange={(v) => setEv({ ...ev, amount: v })} currency={cur} />
            </Field>
            <Field label="Date">
              <input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value || today })} />
            </Field>
            <Field label="Note">
              <input
                value={ev.note ?? ''}
                onChange={(e) => setEv({ ...ev, note: e.target.value || undefined })}
                placeholder="Optional"
              />
            </Field>
            {ev.type === 'repay' && theyOwe && (
              <div className="card flat">
                <ToggleRow
                  title="💰 Also log it in my money"
                  desc="Adds the money to the account it came into"
                  on={logIncome}
                  onChange={setLogIncome}
                />
                {logIncome && (
                  <>
                    <Seg
                      value={logAs}
                      onChange={setLogAs}
                      options={[
                        { v: 'back', label: '💸 Money back', cls: 'expense' },
                        { v: 'income', label: '💰 Income', cls: 'income' },
                      ]}
                    />
                    <div className="tiny muted mt mb">
                      {logAs === 'back'
                        ? 'For something you paid for them: takes it off that spending category this month (if more comes back than you spent, the limit is raised for this month only).'
                        : 'For money that is new to you, like interest on a loan.'}
                    </div>
                    <Field label="Came into">
                      <AccountPickerButton accounts={data.accounts} value={incAcc} onChange={setIncAcc} />
                    </Field>
                    <div className="small bold mb">{logAs === 'back' ? 'Which spending was it for?' : 'Category'}</div>
                    {logAs === 'back' ? (
                      <CategoryGrid categories={data.categories} kind="expense" value={backCat} onPick={setBackCat} />
                    ) : (
                      <CategoryGrid categories={data.categories} kind="income" value={incCat} onPick={setIncCat} />
                    )}
                  </>
                )}
              </div>
            )}
            <div className="btn-row">
              {d.events.some((x) => x.id === ev.id) && (
                <button
                  className="btn danger"
                  onClick={async () => {
                    if (ev.txId) await deleteTx(ev.txId);
                    update({ events: d.events.filter((x) => x.id !== ev.id) });
                    setEv(null);
                    if (ev.txId) toast('Deleted, with its entry in your money');
                  }}
                >
                  Delete
                </button>
              )}
              <button
                className="btn primary"
                disabled={!ev.amount}
                onClick={async () => {
                  let line = ev;
                  if (ev.type === 'repay' && theyOwe && logIncome) {
                    // the payback is income in the account it came into (its own currency, or a wallet holding it)
                    const acc = incAcc ? data.accountById.get(incAcc) : undefined;
                    if (!acc) return toast('Choose the account it came into');
                    const asBack = logAs === 'back';
                    const catId = asBack ? backCat : incCat;
                    if (!catId) return toast('Pick a category 🏷️');
                    // money back points at the spending it was part of, when that was logged
                    const spentTx =
                      asBack && spentLend?.spentTxId && spentLend.spentCategoryId === catId
                        ? data.allTxs.find((t) => t.id === spentLend.spentTxId)
                        : undefined;
                    const inWallet = acc.currency !== cur && accountCurrencies(acc).includes(cur);
                    const same = acc.currency === cur || inWallet;
                    const amount = same ? ev.amount : (convert(ev.amount, cur, acc.currency, rates) ?? ev.amount);
                    const txId = await saveTx(
                      {
                        id: ev.txId,
                        profileId: profile.id,
                        date: ev.date,
                        kind: asBack ? 'expense' : 'income',
                        accountId: acc.id,
                        pocket: inWallet ? cur : undefined,
                        amount: (asBack ? -1 : 1) * roundTo(amount, decimalsFor(acc.currency)),
                        origAmount: same ? undefined : (asBack ? -1 : 1) * ev.amount,
                        origCurrency: same ? undefined : cur,
                        categoryId: catId,
                        refundOf: spentTx?.id,
                        note: paybackNote(d, ev.note),
                      },
                      rates,
                      currency,
                    );
                    line = { ...ev, txId };
                  } else if (ev.txId) {
                    await deleteTx(ev.txId);
                    line = { ...ev, txId: undefined };
                  }
                  const exists = d.events.some((x) => x.id === line.id);
                  update({ events: exists ? d.events.map((x) => (x.id === line.id ? line : x)) : [...d.events, line] });
                  setEv(null);
                  toast(
                    line.txId
                      ? logAs === 'back'
                        ? '💸 Saved, and logged as money back'
                        : '💰 Saved, and logged as income'
                      : '✨ Saved',
                  );
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </Sheet>
      <CurrencySheet open={curOpen} onClose={() => setCurOpen(false)} value={cur} onPick={(c) => update({ currency: c })} />
      {quickEv && (
        <QuickActions
          title={`${quickEv.type === 'repay' ? 'Paid back' : theyOwe ? 'Lent' : 'Borrowed'} · ${fmtMoney(quickEv.amount, d.currency)}`}
          onClose={() => setQuickEv(null)}
          actions={[
            { label: '✏️ Edit', tone: 'plain', run: () => setEv(quickEv) },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (
                  !(await confirm({
                    title: 'Delete this line?',
                    message: quickEv.txId ? 'Its entry in your money is deleted too.' : undefined,
                    ok: 'Delete',
                    danger: true,
                  }))
                )
                  return;
                if (quickEv.txId) await deleteTx(quickEv.txId);
                update({ events: d.events.filter((x) => x.id !== quickEv.id) });
              },
            },
          ]}
        />
      )}
    </>
  );
}
