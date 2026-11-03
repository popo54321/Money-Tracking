import { useMemo, useState } from 'react';
import {
  AccountPickerButton,
  AmountField,
  CategoryGrid,
  CurrencySheet,
  Field,
  Keypad,
  NumberInput,
  Seg,
  ToggleRow,
  Topbar,
  fmtExpr,
  useCalc,
} from '../components/ui';
import { unitValue } from '../domain/balances';
import { convert } from '../domain/fx';
import { decimalsFor, fmtMoney, roundTo } from '../domain/money';
import { describeSchedule } from '../domain/recurring';
import { fmtDate } from '../domain/dates';
import type { Freq, TxKind } from '../domain/types';
import { db } from '../db/db';
import { deleteTx, saveNewEntry, saveTx } from '../db/repo';
import { useApp, useData, type Route } from '../state/app';

type EntryRoute = Extract<Route, { name: 'entry' }>;

function lastAccountKey(profileId: string, kind: string) {
  return `mt:last:${profileId}:${kind}`;
}
function readLast(profileId: string, kind: string): string | undefined {
  try {
    return localStorage.getItem(lastAccountKey(profileId, kind)) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeLast(profileId: string, kind: string, id: string) {
  try {
    localStorage.setItem(lastAccountKey(profileId, kind), id);
  } catch {
    // fine
  }
}

export function Entry({ route }: { route: EntryRoute }) {
  const { profile, rates, currency, today, back, toast, confirm } = useApp();
  const data = useData();
  const existing = route.id ? data.allTxs.find((t) => t.id === route.id) : undefined;
  const usable = data.accounts.filter((a) => !a.archived || a.id === existing?.accountId || a.id === existing?.toAccountId);

  const initialKind: Exclude<TxKind, 'adjust'> =
    existing && existing.kind !== 'adjust' ? existing.kind : ((route.kind as Exclude<TxKind, 'adjust'>) ?? 'expense');
  const [kind, setKind] = useState<Exclude<TxKind, 'adjust'> | 'adjust'>(existing?.kind ?? initialKind);

  const defaultAccount = (k: string) => {
    const last = readLast(profile.id, k);
    if (last && usable.some((a) => a.id === last)) return last;
    return (usable.find((a) => a.type === 'cash' || a.type === 'bank') ?? usable[0])?.id;
  };

  const [accountId, setAccountId] = useState<string | undefined>(
    existing?.accountId ?? route.accountId ?? defaultAccount(initialKind),
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(existing?.toAccountId ?? route.toAccountId);
  const acc = accountId ? data.accountById.get(accountId) : undefined;
  const toAcc = toAccountId ? data.accountById.get(toAccountId) : undefined;

  const startAmount = existing ? (existing.origAmount ?? Math.abs(existing.amount)) : route.amount;
  const calc = useCalc(startAmount ? String(roundTo(startAmount, 8)) : '');
  const [typedCurrency, setTypedCurrency] = useState<string>(existing?.origCurrency ?? acc?.currency ?? currency);
  const [chargedOverride, setChargedOverride] = useState<number | null>(existing?.origCurrency ? existing.amount : null);
  const [toAmountOverride, setToAmountOverride] = useState<number | null>(existing?.toAmount ?? null);
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId ?? route.categoryId);
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? route.note ?? '');
  const [showPad, setShowPad] = useState(!existing);
  const [curOpen, setCurOpen] = useState(false);

  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState<Freq>('month');
  const [every, setEvery] = useState(1);
  const [autoPost, setAutoPost] = useState(true);
  const [reserve, setReserve] = useState(true);

  const amount = calc.value;
  const accCur = acc?.currency ?? currency;
  const foreign = !!acc && acc.type !== 'units' && typedCurrency !== accCur;
  const autoCharged = foreign && amount !== null ? convert(amount, typedCurrency, accCur, rates) : null;
  const charged = foreign ? (chargedOverride ?? autoCharged) : amount;

  const transferCross = kind === 'transfer' && !!toAcc && !!acc && toAcc.currency !== accCur;
  const autoTo = useMemo(() => {
    if (!transferCross || charged === null || !acc || !toAcc) return null;
    const v1 = unitValue(acc, rates, 'USD');
    const v2 = unitValue(toAcc, rates, 'USD');
    if (v1 === null || v2 === null || v2 === 0) return null;
    return roundTo((charged * v1) / v2, decimalsFor(toAcc.currency));
  }, [transferCross, charged, acc, toAcc, rates]);
  const toAmount = transferCross ? (toAmountOverride ?? autoTo) : charged;

  const switchKind = (k: Exclude<TxKind, 'adjust'>) => {
    setKind(k);
    setCategoryId(undefined);
    if (!existing && !route.accountId) {
      const d = defaultAccount(k);
      if (d) {
        setAccountId(d);
        setTypedCurrency(data.accountById.get(d)?.currency ?? currency);
      }
    }
  };

  const pickAccount = (id: string) => {
    setAccountId(id);
    const a = data.accountById.get(id);
    if (a && a.type !== 'units') setTypedCurrency(a.currency);
    setChargedOverride(null);
    setToAmountOverride(null);
  };

  const save = async () => {
    if (amount === null || amount === 0) {
      toast('Type an amount first 🧮');
      setShowPad(true);
      return;
    }
    if (!acc) {
      toast('Choose an account 👛');
      return;
    }
    if (kind === 'transfer') {
      if (!toAcc) return toast('Choose where the money goes 👛');
      if (toAcc.id === acc.id) return toast('Pick two different accounts');
      if (toAmount === null) return toast('Type how much arrives');
    } else if ((kind === 'income' || kind === 'expense') && !categoryId) {
      toast('Pick a category 🏷️');
      return;
    }
    if (charged === null) {
      toast(`No exchange rate for ${typedCurrency}. Type the amount charged.`);
      return;
    }
    const draft = {
      id: existing?.id,
      profileId: profile.id,
      date,
      kind,
      accountId: acc.id,
      amount: kind === 'adjust' ? (existing && existing.amount < 0 ? -Math.abs(amount) : amount) : charged,
      toAccountId: kind === 'transfer' ? toAcc?.id : undefined,
      toAmount: kind === 'transfer' ? (toAmount ?? charged) : undefined,
      categoryId,
      note,
      origAmount: foreign ? amount : undefined,
      origCurrency: foreign ? typedCurrency : undefined,
    };
    const repeatOpts =
      repeat && !existing && kind !== 'adjust'
        ? {
            name:
              note.trim() ||
              data.categoryById.get(categoryId ?? '')?.name ||
              (kind === 'transfer' ? `${acc.name} → ${toAcc?.name}` : 'Repeating'),
            freq,
            every,
            autoPost,
            reserve,
          }
        : null;
    const outcome = existing
      ? (await saveTx(draft, rates, currency), 'saved')
      : await saveNewEntry(draft, repeatOpts, rates, currency, today);
    if (kind !== 'adjust') writeLast(profile.id, kind, acc.id);
    if (outcome === 'scheduled') {
      toast(`📅 Scheduled for ${fmtDate(date)}. It's recorded on the day.`);
      back();
      return;
    }
    toast(existing ? '✨ Saved' : kind === 'income' ? '💰 Income saved' : kind === 'transfer' ? '🔄 Move saved' : '🌸 Saved');
    back();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({ title: 'Delete this entry?', ok: 'Delete', danger: true });
    if (!ok) return;
    await deleteTx(existing.id);
    if (existing.recurringId) {
      // keep the repeating entry from re-creating this occurrence
      const r = await db.recurring.get(existing.recurringId);
      if (r && (!r.lastPosted || r.lastPosted < existing.date)) await db.recurring.update(r.id, { lastPosted: existing.date });
    }
    toast('🗑️ Deleted');
    back();
  };

  const kindCls = kind === 'income' ? 'income' : kind === 'transfer' || kind === 'adjust' ? 'transfer' : '';
  const shownValue =
    amount === null ? (calc.expr ? fmtExpr(calc.expr) : fmtMoney(0, typedCurrency)) : fmtMoney(amount, typedCurrency);

  return (
    <>
      <Topbar
        title={existing ? 'Edit entry' : 'New entry'}
        right={
          existing && (
            <button className="icon-btn" aria-label="Delete entry" onClick={remove}>
              🗑️
            </button>
          )
        }
      />
      <div className="page">
        {kind === 'adjust' ? (
          <div className="banner">
            <span>🪄</span>
            <span className="grow">Balance adjustment (not counted as income or spending)</span>
          </div>
        ) : (
          <Seg
            value={kind}
            onChange={switchKind}
            options={[
              { v: 'expense', label: '💸 Spend', cls: 'expense' },
              { v: 'income', label: '💰 Income', cls: 'income' },
              { v: 'transfer', label: '🔄 Move', cls: 'transfer' },
            ]}
          />
        )}

        <div className={`amount-display ${kindCls}`} onClick={() => setShowPad(true)} role="button" tabIndex={0}>
          {acc && acc.type !== 'units' && kind !== 'adjust' && (
            <button
              className="curbtn"
              onClick={(e) => {
                e.stopPropagation();
                setCurOpen(true);
              }}
            >
              {typedCurrency} ▾
            </button>
          )}
          <div className="expr">{calc.showResult ? fmtExpr(calc.expr) : ' '}</div>
          <div className="val">{shownValue}</div>
        </div>
        {showPad && (
          <Keypad
            okLabel={calc.showResult ? '=' : '✓'}
            onKey={(k) => {
              if (k === '=' && !calc.showResult) setShowPad(false);
              else calc.press(k);
            }}
          />
        )}

        {foreign && (
          <Field
            label={`Charged to ${acc?.name} (${accCur})`}
            hint={
              autoCharged === null
                ? 'No rate saved for this currency. Type the amount charged.'
                : 'Worked out with the latest rate. Tap to type the real amount from your bank.'
            }
          >
            <AmountField value={charged} onChange={setChargedOverride} currency={accCur} />
          </Field>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <>
            <div className="section-title">🏷️ Category</div>
            <CategoryGrid
              categories={data.categories}
              kind={kind}
              value={categoryId}
              onPick={(id) => {
                setCategoryId(id);
                setShowPad(false);
              }}
            />
          </>
        )}

        <div className="spacer" />
        <Field label={kind === 'transfer' ? 'From' : kind === 'income' ? 'Into account' : 'Paid with'}>
          <AccountPickerButton accounts={usable} value={accountId} onChange={pickAccount} />
        </Field>
        {kind === 'transfer' && (
          <Field label="To">
            <AccountPickerButton
              accounts={usable}
              value={toAccountId}
              onChange={(id) => {
                setToAccountId(id);
                setToAmountOverride(null);
              }}
              exclude={accountId}
            />
          </Field>
        )}
        {transferCross && toAcc && (
          <Field
            label={`Arrives as (${toAcc.currency})`}
            hint={
              toAcc.currency === 'BTC'
                ? 'Type the exact BTC you received.'
                : 'Estimated from the latest rate. Tap to type the real amount.'
            }
          >
            <AmountField value={toAmount} onChange={setToAmountOverride} currency={toAcc.currency} />
          </Field>
        )}

        <div className="grid2">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} />
          </Field>
          <Field label="Note">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        {!existing && kind !== 'adjust' && (
          <div className="card flat">
            <ToggleRow title="🔁 Repeat this" desc="For salary, bills and subscriptions" on={repeat} onChange={setRepeat} />
            {repeat && (
              <>
                <div className="grid2">
                  <Field label="Every">
                    <NumberInput value={every} onChange={(v) => setEvery(Math.max(1, Math.round(v) || 1))} />
                  </Field>
                  <Field label="Unit">
                    <select value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
                      <option value="day">day(s)</option>
                      <option value="week">week(s)</option>
                      <option value="month">month(s)</option>
                      <option value="year">year(s)</option>
                    </select>
                  </Field>
                </div>
                <div className="small muted">
                  {describeSchedule(freq, every)}, starting {date}. This entry is the first one.
                </div>
                <ToggleRow title="Record automatically on the day" on={autoPost} onChange={setAutoPost} />
                {kind !== 'income' && (
                  <ToggleRow
                    title="🔒 Keep the next payment ready"
                    desc="Shows it as reserved in the paying account"
                    on={reserve}
                    onChange={setReserve}
                  />
                )}
              </>
            )}
          </div>
        )}

        <div className="save-bar">
          <button className="btn primary block" onClick={save}>
            {existing ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
      <CurrencySheet
        open={curOpen}
        onClose={() => setCurOpen(false)}
        value={typedCurrency}
        onPick={(c) => {
          setTypedCurrency(c);
          setChargedOverride(null);
        }}
      />
    </>
  );
}
