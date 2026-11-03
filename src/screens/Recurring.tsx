import { useState } from 'react';
import { AccountPickerButton, AmountField, CategoryGrid, Field, NumberInput, Seg, ToggleRow, Topbar, Sparkle } from '../components/ui';
import { fmtDate, relativeDays } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { describeSchedule, dueToPost, monthlyEquivalent, nextUnposted } from '../domain/recurring';
import type { Freq, Recurring } from '../domain/types';
import { db, uid } from '../db/db';
import { deleteRecurring, postOccurrence, saveRecurring, skipOccurrence } from '../db/repo';
import { useApp, useData } from '../state/app';
import { categoryEmoji } from '../ui/emoji';

export function RecurringList() {
  const { go, today, currency } = useApp();
  const data = useData();
  const list = data.recurring.slice().sort((a, b) => {
    const na = nextUnposted(a, a.lastPosted) ?? '9999';
    const nb = nextUnposted(b, b.lastPosted) ?? '9999';
    return Number(b.active) - Number(a.active) || (na < nb ? -1 : na > nb ? 1 : 0);
  });
  const monthlyOut = data.recurring
    .filter((r) => r.active && r.kind === 'expense')
    .reduce((s, r) => s + (data.accountById.get(r.accountId)?.currency === currency ? monthlyEquivalent(r.amount, r.freq, r.every) : 0), 0);
  const reservedTotal = [...data.reserved.entries()].reduce(
    (s, [id, v]) => s + (data.accountById.get(id)?.currency === currency ? v : 0),
    0,
  );

  return (
    <>
      <Topbar
        title="Repeating 🔁"
        right={
          <button className="icon-btn" aria-label="Add repeating entry" onClick={() => go({ name: 'recurringEdit' })}>
            ＋
          </button>
        }
      />
      <div className="page">
        <div className="hero">
          <Sparkle k="recurring" />
          <div className="label">Fixed spending, per month</div>
          <div className="big">{fmtMoney(monthlyOut, currency)}</div>
          <div className="small">
            🔒 Keeping {fmtMoney(reservedTotal, currency)} ready for the next payments
          </div>
        </div>
        {list.length === 0 ? (
          <div className="card center">
            <div style={{ fontSize: 40 }}>🔁</div>
            <div className="bold">No repeating entries yet</div>
            <div className="small muted mb">Add salary, rent, Spotify, insurance… They record themselves on the day.</div>
            <button className="btn primary" onClick={() => go({ name: 'recurringEdit' })}>
              ＋ Add one
            </button>
          </div>
        ) : (
          <div className="list">
            {list.map((r) => {
              const next = nextUnposted(r, r.lastPosted);
              const acc = data.accountById.get(r.accountId);
              const cat = r.categoryId ? data.categoryById.get(r.categoryId) : undefined;
              return (
                <button key={r.id} className="row" onClick={() => go({ name: 'recurringEdit', id: r.id })} style={{ opacity: r.active ? 1 : 0.55 }}>
                  <div className={`bubble ${r.kind === 'income' ? 'mint' : r.kind === 'transfer' ? 'lav' : 'peach'}`}>
                    {r.kind === 'transfer' ? '🔄' : categoryEmoji(cat)}
                  </div>
                  <div className="main">
                    <div className="title">{r.name}</div>
                    <div className="sub">
                      {describeSchedule(r.freq, r.every)} · {acc?.name ?? '?'}
                      {!r.active ? ' · paused' : next ? ` · next ${fmtDate(next, false)} (${relativeDays(today, next)})` : ' · finished'}
                    </div>
                  </div>
                  <div className="end">
                    <div className={`amt ${r.kind === 'income' ? 'pos' : ''}`}>{fmtMoney(r.amount, acc?.currency ?? currency)}</div>
                    {r.freq !== 'month' && r.kind === 'expense' && (
                      <div className="amt2">≈ {fmtMoney(monthlyEquivalent(r.amount, r.freq, r.every), acc?.currency ?? currency, { compact: true })}/month</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export function RecurringEdit({ id }: { id?: string }) {
  const { profile, today, back, toast, confirm, rates, currency } = useApp();
  const data = useData();
  const existing = id ? data.recurring.find((r) => r.id === id) : undefined;
  const firstAccount = data.accounts.find((a) => !a.archived && (a.type === 'bank' || a.type === 'cash'))?.id ?? data.accounts[0]?.id ?? '';
  const [r, setR] = useState<Recurring>(
    () =>
      existing ?? {
        id: uid(),
        profileId: profile.id,
        name: '',
        kind: 'expense',
        amount: 0,
        accountId: firstAccount,
        freq: 'month',
        every: 1,
        startDate: today,
        autoPost: true,
        reserve: true,
        active: true,
        createdAt: Date.now(),
      },
  );
  const set = (p: Partial<Recurring>) => setR((x) => ({ ...x, ...p }));
  const acc = data.accountById.get(r.accountId);
  const next = nextUnposted(r, r.lastPosted);

  const save = async () => {
    if (!r.amount) return toast('Type an amount 🧮');
    if (!acc) return toast('Choose an account 👛');
    if (r.kind !== 'transfer' && !r.categoryId) return toast('Pick a category 🏷️');
    if (r.kind === 'transfer' && (!r.toAccountId || r.toAccountId === r.accountId)) return toast('Choose where the money goes');
    const cat = r.categoryId ? data.categoryById.get(r.categoryId) : undefined;
    const name = r.name.trim() || cat?.name || 'Repeating';
    const toAcc = r.toAccountId ? data.accountById.get(r.toAccountId) : undefined;
    // "Record now" / "Skip" may have moved lastPosted while this form was open
    const stored = existing ? await db.recurring.get(r.id) : undefined;
    let lastPosted = stored?.lastPosted ?? r.lastPosted;
    if (!existing && r.autoPost) {
      const past = dueToPost(r, undefined, today);
      if (past.length > 0) {
        const all = await confirm({
          title: `Record ${past.length} past ${past.length === 1 ? 'date' : 'dates'} too?`,
          message: `The first date is ${fmtDate(r.startDate)}. Choose “Only from now on” if those are already logged.`,
          ok: 'Record them',
          cancel: 'Only from now on',
        });
        if (!all) lastPosted = past[past.length - 1];
      }
    }
    await saveRecurring({
      ...r,
      lastPosted,
      name,
      toAmount: r.kind === 'transfer' ? (toAcc && toAcc.currency !== acc.currency ? r.toAmount ?? r.amount : r.amount) : undefined,
      reserve: r.kind === 'income' ? false : r.reserve,
    });
    toast(existing ? '✨ Saved' : '🔁 Repeating entry added');
    back();
  };

  return (
    <>
      <Topbar title={existing ? 'Edit repeating' : 'New repeating'} />
      <div className="page">
        <Seg
          value={r.kind}
          onChange={(k) => set({ kind: k, categoryId: undefined })}
          options={[
            { v: 'expense', label: '💸 Bill', cls: 'expense' },
            { v: 'income', label: '💰 Income', cls: 'income' },
            { v: 'transfer', label: '🔄 Move', cls: 'transfer' },
          ]}
        />
        <div className="spacer" />
        <Field label="Name">
          <input value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Spotify, Rent, Salary" />
        </Field>
        <Field label="Amount">
          <AmountField value={r.amount || null} onChange={(v) => set({ amount: v })} currency={acc?.currency ?? currency} />
        </Field>
        <Field label={r.kind === 'income' ? 'Into account' : r.kind === 'transfer' ? 'From' : 'Paid from'}>
          <AccountPickerButton accounts={data.accounts} value={r.accountId} onChange={(v) => set({ accountId: v })} />
        </Field>
        {r.kind === 'transfer' && (
          <Field label="To">
            <AccountPickerButton accounts={data.accounts} value={r.toAccountId} onChange={(v) => set({ toAccountId: v })} exclude={r.accountId} />
          </Field>
        )}
        {r.kind === 'transfer' && r.toAccountId && data.accountById.get(r.toAccountId)?.currency !== acc?.currency && (
          <Field label={`Arrives as (${data.accountById.get(r.toAccountId)?.currency})`}>
            <AmountField value={r.toAmount ?? null} onChange={(v) => set({ toAmount: v })} currency={data.accountById.get(r.toAccountId)?.currency ?? ''} />
          </Field>
        )}
        {r.kind !== 'transfer' && (
          <>
            <div className="section-title">🏷️ Category</div>
            <CategoryGrid categories={data.categories} kind={r.kind} value={r.categoryId} onPick={(v) => set({ categoryId: v })} />
            <div className="spacer" />
          </>
        )}
        <div className="grid2">
          <Field label="Every">
            <NumberInput value={r.every} onChange={(v) => set({ every: Math.max(1, Math.round(v) || 1) })} />
          </Field>
          <Field label="Unit">
            <select value={r.freq} onChange={(e) => set({ freq: e.target.value as Freq })}>
              <option value="day">day(s)</option>
              <option value="week">week(s)</option>
              <option value="month">month(s)</option>
              <option value="year">year(s)</option>
            </select>
          </Field>
        </div>
        <div className="grid2">
          <Field label="First date">
            <input type="date" value={r.startDate} onChange={(e) => set({ startDate: e.target.value || r.startDate })} />
          </Field>
          <Field label="End date (optional)">
            <input type="date" value={r.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || undefined })} />
          </Field>
        </div>
        <div className="small muted mb">
          {describeSchedule(r.freq, r.every)}
          {next ? ` · next ${fmtDate(next)}` : ' · no more dates'}
          {r.kind === 'expense' && r.amount ? ` · ≈ ${fmtMoney(monthlyEquivalent(r.amount, r.freq, r.every), acc?.currency ?? currency)} a month` : ''}
        </div>
        <Field label="Note">
          <input value={r.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="Optional" />
        </Field>
        <ToggleRow title="Record automatically on the day" desc="Otherwise it just reminds you" on={r.autoPost} onChange={(v) => set({ autoPost: v })} />
        {r.kind !== 'income' && (
          <ToggleRow title="🔒 Keep the next payment ready" desc="Shown as reserved in the paying account" on={r.reserve} onChange={(v) => set({ reserve: v })} />
        )}
        {existing && <ToggleRow title="Active" on={r.active} onChange={(v) => set({ active: v })} />}

        <div className="save-bar">
          <button className="btn primary block" onClick={save}>
            {existing ? 'Save' : 'Add repeating entry'}
          </button>
        </div>

        {existing && next && (
          <div className="btn-row mt">
            <button
              className="btn mint"
              onClick={async () => {
                await postOccurrence(existing, next, rates, currency);
                toast(`✅ Recorded for ${fmtDate(next, false)}`);
              }}
            >
              ✅ Record {fmtDate(next, false)} now
            </button>
            <button
              className="btn butter"
              onClick={async () => {
                await skipOccurrence(existing, next);
                toast(`⏭️ Skipped ${fmtDate(next, false)}`);
              }}
            >
              ⏭️ Skip it
            </button>
          </div>
        )}
        {existing && (
          <button
            className="btn danger block mt"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete “${existing.name}”?`,
                message: 'Entries it already recorded stay. Only future ones stop.',
                ok: 'Delete',
                danger: true,
              });
              if (!ok) return;
              await deleteRecurring(existing.id, false);
              toast('🗑️ Deleted');
              back();
            }}
          >
            Delete repeating entry
          </button>
        )}
      </div>
    </>
  );
}
