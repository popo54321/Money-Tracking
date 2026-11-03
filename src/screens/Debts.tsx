import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { AmountField, CurrencySheet, Field, NumberInput, Seg, Sheet, Topbar, Sparkle, Avatar, CalcSheet } from '../components/ui';
import { debtStatus, type Debt, type DebtEvent } from '../domain/debts';
import { addDays, fmtDate } from '../domain/dates';
import { convert } from '../domain/fx';
import { fmtMoney } from '../domain/money';
import { db, uid } from '../db/db';
import { deleteDebt, saveDebt } from '../db/repo';
import { useApp } from '../state/app';
import { ProfileSwitch } from './Home';
import { holdProps } from '../components/hold';
import { QuickActions } from '../components/QuickActions';

function interestText(d: Debt): string {
  if (d.interestType === 'none' || !d.ratePct) return 'no interest';
  return `${d.ratePct}% per ${d.ratePer}${d.interestType === 'compound' ? ', compounding monthly' : ''}`;
}

export function DebtList() {
  const { profile, go, today, currency, rates, confirm, toast } = useApp();
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
        <div className="btn-row mb">
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
        <div className="tiny muted center mt">Just a record: it doesn’t change your account balances.</div>
      </div>
      {quick && (
        <QuickActions
          title={quick.person || 'Someone'}
          onClose={() => setQuick(null)}
          actions={[
            { label: '💰 Add repayment', tone: 'mint', run: () => setAmountFor({ debt: quick, type: 'repay' }) },
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
                await deleteDebt(quick.id);
                toast('🗑️ Deleted');
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
            amountFor.type === 'repay'
              ? `${amountFor.debt.person} paid back`
              : amountFor.debt.direction === 'owedToMe'
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

export function DebtDetail({ id }: { id: string }) {
  const { today, back, confirm, toast } = useApp();
  const stored = useLiveQuery(() => db.debts.get(id), [id]);
  const [d, setD] = useState<Debt | null>(null);
  const [ev, setEv] = useState<DebtEvent | null>(null);
  const [quickEv, setQuickEv] = useState<DebtEvent | null>(null);
  const [curOpen, setCurOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (stored && !d) setD(stored);
  }, [stored, d]);
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
              await deleteDebt(d.id);
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
              <div className="k">Lent</div>
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
            <div className="btn-row">
              {d.events.some((x) => x.id === ev.id) && (
                <button
                  className="btn danger"
                  onClick={() => {
                    update({ events: d.events.filter((x) => x.id !== ev.id) });
                    setEv(null);
                  }}
                >
                  Delete
                </button>
              )}
              <button
                className="btn primary"
                disabled={!ev.amount}
                onClick={() => {
                  const exists = d.events.some((x) => x.id === ev.id);
                  update({ events: exists ? d.events.map((x) => (x.id === ev.id ? ev : x)) : [...d.events, ev] });
                  setEv(null);
                  toast('✨ Saved');
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
          title={`${quickEv.type === 'repay' ? 'Paid back' : 'Lent'} · ${fmtMoney(quickEv.amount, d.currency)}`}
          onClose={() => setQuickEv(null)}
          actions={[
            { label: '✏️ Edit', tone: 'plain', run: () => setEv(quickEv) },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: 'Delete this line?', ok: 'Delete', danger: true }))) return;
                update({ events: d.events.filter((x) => x.id !== quickEv.id) });
              },
            },
          ]}
        />
      )}
    </>
  );
}
