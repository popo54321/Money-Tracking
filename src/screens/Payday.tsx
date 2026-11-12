// Payday: set up once (full salary, take-home, what is taken off), records itself on the day,
// "Payday's here" records it early (that month then does not record itself again).
import { useState } from 'react';
import { AccountPickerButton, AmountField, Field, NumberInput, Seg, Sheet, ToggleRow, Topbar } from '../components/ui';
import { diffDays, fmtDate, relativeDays, addMonthKey, fmtMonth } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import {
  firstMonthFrom,
  mainDeduction,
  nextPayDate,
  nextPayMonth,
  payDate,
  type PayDeduction,
  type Payday,
} from '../domain/payday';
import type { Category } from '../domain/types';
import { uid } from '../db/db';
import { recordPayday, savePayday, saveRecurring } from '../db/repo';
import { useApp, useData } from '../state/app';

/** "Payday's here" shows from this many days before the pay date. */
export const EARLY_DAYS = 10;

function CategorySelect({
  categories,
  kind,
  value,
  onChange,
  empty = 'Choose…',
}: {
  categories: Category[];
  kind: 'income' | 'expense';
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  empty?: string;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{empty}</option>
      {categories
        .filter((c) => c.kind === kind && (!c.archived || c.id === value))
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji ? `${c.emoji} ` : ''}
            {c.name}
          </option>
        ))}
    </select>
  );
}

export function PaydayEdit() {
  const { profile, today, back, toast, confirm, removeWithUndo } = useApp();
  const data = useData();
  const byName = (kind: 'income' | 'expense', re: RegExp) =>
    data.categories.find((c) => c.kind === kind && !c.archived && re.test(c.name))?.id;
  // an existing repeating salary fills in the form, and is paused on save so salary is not recorded twice
  const salaryRec = data.recurring.find((r) => r.active && r.kind === 'income');
  const [p, setP] = useState<Payday>(
    () =>
      profile.payday ?? {
        active: true,
        accountId:
          salaryRec?.accountId ?? data.accounts.find((a) => a.type === 'bank' && !a.archived)?.id ?? data.accounts[0]?.id ?? '',
        incomeCategoryId: salaryRec?.categoryId ?? byName('income', /salary/i),
        gross: salaryRec?.amount ?? 0,
        takeHome: salaryRec?.amount ?? 0,
        deductCategoryId: byName('expense', /tax/i),
        extras: [],
        rule: 'day',
        day: 25,
        fromMonth: firstMonthFrom({ rule: 'day', day: 25 }, today),
      },
  );
  const set = (x: Partial<Payday>) => setP((o) => ({ ...o, ...x }));
  const acc = data.accountById.get(p.accountId);
  const cur = acc?.currency ?? 'THB';
  const rest = mainDeduction(p.gross, p.takeHome, p.extras);
  const setExtra = (id: string, x: Partial<PayDeduction>) =>
    set({ extras: p.extras.map((e) => (e.id === id ? { ...e, ...x } : e)) });
  const isNew = !profile.payday;
  const otherIncome = data.recurring.filter((r) => r.active && r.kind === 'income' && r.categoryId === p.incomeCategoryId);

  const save = async () => {
    if (!acc) return toast('Choose the account your pay arrives in');
    if (!(p.gross > 0) || !(p.takeHome > 0)) return toast('Enter the full salary and the take-home pay');
    if (rest < -0.005) return toast('The lines taken off add up to more than full salary minus take-home');
    if (rest > 0.005 && !p.deductCategoryId) return toast('Choose a category for what is taken off');
    if (p.extras.some((e) => e.amount > 0 && !e.categoryId && !e.toAccountId))
      return toast('Each extra line needs a category or an account');
    await savePayday(profile.id, p);
    if (isNew && otherIncome.length) {
      const pause = await confirm({
        title: 'Pause your repeating salary?',
        message: `${otherIncome.map((r) => r.name).join(', ')} also records salary every month. Pause it so it is not recorded twice?`,
        ok: 'Pause it',
        cancel: 'Keep both',
      });
      if (pause) for (const r of otherIncome) await saveRecurring({ ...r, active: false });
    }
    toast(isNew ? '💰 Payday set up' : '✨ Saved');
    back();
  };

  return (
    <>
      <Topbar title="💰 Payday" />
      <div className="page">
        <div className="small muted mb">
          Your salary records itself on payday: the full salary as income and what is taken off as spending, so the account goes
          up by your take-home pay. If it comes early, tap “Payday’s here”.
        </div>
        <Field label="Pays into">
          <AccountPickerButton accounts={data.accounts} value={p.accountId} onChange={(v) => set({ accountId: v })} />
        </Field>
        <Field label="Income category">
          <CategorySelect
            categories={data.categories}
            kind="income"
            value={p.incomeCategoryId}
            onChange={(v) => set({ incomeCategoryId: v })}
          />
        </Field>
        <div className="grid2">
          <Field label="Full salary">
            <AmountField value={p.gross || null} onChange={(v) => set({ gross: v })} currency={cur} title="Full salary" />
          </Field>
          <Field label="Take-home pay">
            <AmountField value={p.takeHome || null} onChange={(v) => set({ takeHome: v })} currency={cur} title="Take-home pay" />
          </Field>
        </div>

        <div className="section-title">✂️ Taken off</div>
        <div className="card">
          <Field label={`The rest: ${fmtMoney(Math.max(0, rest), cur)}`} hint="Full salary − take-home − the lines below">
            <CategorySelect
              categories={data.categories}
              kind="expense"
              value={p.deductCategoryId}
              onChange={(v) => set({ deductCategoryId: v })}
              empty="Choose a category (e.g. Tax)…"
            />
          </Field>
          {p.extras.map((x) => (
            <div key={x.id} className="payday-line">
              <div className="grid2">
                <input
                  value={x.name}
                  placeholder="e.g. Provident fund"
                  onChange={(e) => setExtra(x.id, { name: e.target.value })}
                />
                <AmountField value={x.amount || null} onChange={(v) => setExtra(x.id, { amount: v })} currency={cur} compact />
              </div>
              <div className="mt">
                <Seg
                  value={x.toAccountId !== undefined ? 'account' : 'category'}
                  onChange={(v) =>
                    setExtra(x.id, v === 'account' ? { toAccountId: '', categoryId: undefined } : { toAccountId: undefined })
                  }
                  options={[
                    { v: 'category', label: 'Spending' },
                    { v: 'account', label: 'To account' },
                  ]}
                />
                <div className="mt">
                  {x.toAccountId !== undefined ? (
                    <AccountPickerButton
                      accounts={data.accounts}
                      value={x.toAccountId || undefined}
                      onChange={(v) => setExtra(x.id, { toAccountId: v })}
                      exclude={p.accountId}
                    />
                  ) : (
                    <CategorySelect
                      categories={data.categories}
                      kind="expense"
                      value={x.categoryId}
                      onChange={(v) => setExtra(x.id, { categoryId: v })}
                    />
                  )}
                </div>
              </div>
              <button className="btn sm ghost mt" onClick={() => set({ extras: p.extras.filter((e) => e.id !== x.id) })}>
                Remove line
              </button>
            </div>
          ))}
          <button
            className="btn sm ghost mt"
            onClick={() => set({ extras: [...p.extras, { id: uid(), name: '', amount: 0, categoryId: undefined }] })}
          >
            ＋ Add a line
          </button>
          <div className={`small mt ${rest < -0.005 ? 'neg' : 'muted'}`}>
            {fmtMoney(p.gross, cur)} full − {fmtMoney(p.gross - p.takeHome, cur)} taken off = <b>{fmtMoney(p.takeHome, cur)}</b>{' '}
            into {acc?.name ?? 'the account'}
            {rest < -0.005 ? ' · the lines add up to too much' : ''}
          </div>
        </div>

        <div className="section-title">📅 When</div>
        <Seg
          value={p.rule}
          onChange={(v) => set({ rule: v, fromMonth: isNew ? firstMonthFrom({ rule: v, day: p.day }, today) : p.fromMonth })}
          options={[
            { v: 'day', label: 'Fixed day' },
            { v: 'lastFriday', label: 'Last Friday' },
          ]}
        />
        {p.rule === 'day' && (
          <Field label="Day of the month" hint="29, 30 or 31 use the last day in shorter months">
            <NumberInput
              value={p.day}
              onChange={(v) => {
                const day = Math.min(31, Math.max(1, Math.round(v) || 1));
                set({ day, fromMonth: isNew ? firstMonthFrom({ rule: 'day', day }, today) : p.fromMonth });
              }}
            />
          </Field>
        )}
        <Field label="First payday to record">
          <div className="hstack">
            <button className="btn sm ghost" onClick={() => set({ fromMonth: addMonthKey(p.fromMonth, -1) })}>
              ‹
            </button>
            <div className="grow center bold">
              {fmtDate(payDate(p, p.fromMonth))} ({fmtMonth(p.fromMonth)})
            </div>
            <button className="btn sm ghost" onClick={() => set({ fromMonth: addMonthKey(p.fromMonth, 1) })}>
              ›
            </button>
          </div>
        </Field>
        {!isNew && <ToggleRow title="On" desc="Records itself on payday" on={p.active} onChange={(v) => set({ active: v })} />}
        <div className="spacer" />
        <button className="btn primary block" onClick={save}>
          {isNew ? 'Set up payday' : 'Save'}
        </button>
        {!isNew && (
          <button
            className="btn ghost block mt"
            onClick={async () => {
              const ok = await confirm({
                title: 'Remove payday?',
                message: 'Entries already recorded stay.',
                ok: 'Remove',
                danger: true,
              });
              if (!ok) return;
              await removeWithUndo(() => savePayday(profile.id, undefined), '🗑️ Payday removed');
              back();
            }}
          >
            Remove payday
          </button>
        )}
      </div>
    </>
  );
}

/** "Payday's here": record this month's pay now, with this month's amounts (overtime, a changed tax amount). */
export function PaydaySheet({ onClose }: { onClose: () => void }) {
  const { profile, today, rates, currency, removeWithUndo } = useApp();
  const data = useData();
  const p = profile.payday!;
  const cur = data.accountById.get(p.accountId)?.currency ?? currency;
  const [gross, setGross] = useState(p.gross);
  const [takeHome, setTakeHome] = useState(p.takeHome);
  const month = nextPayMonth(p);
  const rest = mainDeduction(gross, takeHome, p.extras);
  return (
    <Sheet open onClose={onClose} title="💰 Payday’s here">
      <div className="small muted mb">
        Records {fmtMonth(month)}’s pay today. It will not record itself again on {fmtDate(payDate(p, month), false)}.
      </div>
      <div className="grid2">
        <Field label="Full salary">
          <AmountField value={gross} onChange={setGross} currency={cur} title="Full salary" />
        </Field>
        <Field label="Take-home pay">
          <AmountField value={takeHome} onChange={setTakeHome} currency={cur} title="Take-home pay" />
        </Field>
      </div>
      <div className={`small mb ${rest < -0.005 ? 'neg' : 'muted'}`}>
        {rest < -0.005
          ? 'Take-home is more than full salary minus the lines taken off.'
          : `Taken off: ${fmtMoney(gross - takeHome, cur)}`}
      </div>
      <button
        className="btn primary block"
        disabled={rest < -0.005 || !(gross > 0)}
        onClick={async () => {
          await removeWithUndo(
            () => recordPayday(profile.id, month, today, rates, currency, { gross, takeHome }),
            `💰 Payday recorded: ${fmtMoney(takeHome, cur)} into ${data.accountById.get(p.accountId)?.name ?? 'the account'}`,
          );
          onClose();
        }}
      >
        Record {fmtMoney(takeHome, cur)} now
      </button>
    </Sheet>
  );
}

/** Home: the next payday, bills due before it, and "Payday's here" when it is close. */
export function PaydayCard() {
  const { profile, today, currency, go } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const p = profile.payday;
  if (!p || !p.active) return null;
  const next = nextPayDate(p);
  const days = diffDays(today, next);
  const acc = data.accountById.get(p.accountId);
  // bills that fall due on or before payday (in the main currency)
  const before = data.upcoming
    .filter((u) => (u.kind === 'expense' || u.kind === 'card') && u.date <= next && u.currency === currency)
    .reduce((s, u) => s + u.amount, 0);
  return (
    <>
      <button className="card payday-card" onClick={() => go({ name: 'payday' })}>
        <div className="between">
          <b>💰 Payday {fmtDate(next, false)}</b>
          <span className="small muted">{relativeDays(today, next)}</span>
        </div>
        <div className="small mt">
          {fmtMoney(p.takeHome, acc?.currency ?? currency)} take-home into {acc?.name ?? '?'}
        </div>
        {before > 0 && <div className="small muted">Bills due before payday: {fmtMoney(before, currency)}</div>}
        {days <= EARLY_DAYS && (
          <span
            role="button"
            tabIndex={0}
            className="btn mint block mt"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            Payday’s here
          </span>
        )}
      </button>
      {open && <PaydaySheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** Repeating page: the payday at the top (or a prompt to set it up). */
export function PaydayRow() {
  const { profile, today, go } = useApp();
  const data = useData();
  const p = profile.payday;
  if (!p)
    return (
      <button className="row" onClick={() => go({ name: 'payday' })} style={{ marginBottom: 12 }}>
        <div className="bubble mint">💰</div>
        <div className="main">
          <div className="title">Set up your payday</div>
          <div className="sub">Full salary, take-home and what is taken off, recorded by itself</div>
        </div>
        <div className="end">›</div>
      </button>
    );
  const acc = data.accountById.get(p.accountId);
  const next = nextPayDate(p);
  return (
    <div className="list mb">
      <button className="row" onClick={() => go({ name: 'payday' })} style={{ opacity: p.active ? 1 : 0.55 }}>
        <div className="bubble mint">💰</div>
        <div className="main">
          <div className="title">Payday</div>
          <div className="sub">
            {p.rule === 'lastFriday' ? 'Last Friday' : `Day ${p.day}`} · {acc?.name ?? '?'}
            {p.active ? ` · next ${fmtDate(next, false)} (${relativeDays(today, next)})` : ' · paused'}
          </div>
        </div>
        <div className="end">
          <div className="amt pos">{fmtMoney(p.takeHome, acc?.currency ?? 'THB')}</div>
          <div className="amt2">full {fmtMoney(p.gross, acc?.currency ?? 'THB', { compact: true })}</div>
        </div>
      </button>
    </div>
  );
}
