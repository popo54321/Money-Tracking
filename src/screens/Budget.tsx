import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { AccountPickerButton, AmountField, Field, NumberInput, ProgressBar, Sheet, Topbar, Sparkle, SkinName } from '../components/ui';
import { phaseTotals, pctTotal, splitRows, surplusRule, transferAmount } from '../domain/budget';
import { monthKey } from '../domain/dates';
import { fmtMoney, fmtNumber } from '../domain/money';
import type { BudgetPlan, BudgetRow, BudgetTransfer } from '../domain/types';
import { db, uid } from '../db/db';
import { getOrCreateBudget, saveBudget, saveTx } from '../db/repo';
import { importBudgetFromWorkbook } from '../services/workbookImport';
import { pickBinaryFile } from '../services/platform';
import { useApp, useData } from '../state/app';

function RowsEditor({ rows, onChange, base, currency }: { rows: BudgetRow[]; onChange: (r: BudgetRow[]) => void; base: number; currency: string }) {
  const total = pctTotal(rows);
  return (
    <>
      {splitRows(base, rows).map(({ row, value }, i) => (
        <div key={row.id} className="item-line">
          <input className="inline-input grow" value={row.name} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <div style={{ width: 70 }}>
            <NumberInput className="inline-input" value={Math.round(row.pct * 10000) / 100} onChange={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, pct: v / 100 } : x)))} />
          </div>
          <span className="small">%</span>
          <span className="small bold nowrap" style={{ width: 84, textAlign: 'right' }}>
            {fmtMoney(value, currency, { compact: true })}
          </span>
          <button className="btn sm ghost" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div className="between mt">
        <button className="btn sm" onClick={() => onChange([...rows, { id: uid(), name: 'New', pct: 0 }])}>
          ＋ Row
        </button>
        <span className={`small bold ${Math.abs(total - 1) > 0.0001 ? 'neg' : 'pos'}`}>Total {fmtNumber(total * 100, 2, 0)}%</span>
      </div>
    </>
  );
}

function TransferSheet({
  plan,
  t,
  phaseId,
  onSave,
  onDelete,
  onClose,
}: {
  plan: BudgetPlan;
  t: BudgetTransfer | null;
  phaseId: string;
  onSave: (t: BudgetTransfer) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const data = useData();
  const [x, setX] = useState<BudgetTransfer | null>(t);
  useEffect(() => setX(t), [t]);
  if (!x) return null;
  const linked = x.categoryIds ?? [];
  return (
    <Sheet open={!!t} onClose={onClose} title="Transfer">
      <div className="grid2">
        <Field label="From">
          <input value={x.fromLabel} onChange={(e) => setX({ ...x, fromLabel: e.target.value })} />
        </Field>
        <Field label="To">
          <input value={x.toLabel} onChange={(e) => setX({ ...x, toLabel: e.target.value })} />
        </Field>
      </div>
      <Field label="From account (to record it)">
        <AccountPickerButton accounts={data.accounts} value={x.fromAccountId} onChange={(v) => setX({ ...x, fromAccountId: v })} placeholder="Optional" />
      </Field>
      <Field label="To account">
        <AccountPickerButton accounts={data.accounts} value={x.toAccountId} onChange={(v) => setX({ ...x, toAccountId: v })} placeholder="Optional" exclude={x.fromAccountId} />
      </Field>
      <Field label="Amount = sum of these budget lines" hint="Leave all off to type an amount per phase instead.">
        <div className="chips">
          {plan.categories.map((c) => (
            <button
              key={c.id}
              className={`chip mint ${linked.includes(c.id) ? 'on' : ''}`}
              onClick={() => setX({ ...x, categoryIds: linked.includes(c.id) ? linked.filter((i) => i !== c.id) : [...linked, c.id] })}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Field>
      {linked.length === 0 && (
        <Field label={`Amount in ${plan.phases.find((p) => p.id === phaseId)?.name}`}>
          <AmountField value={x.amounts[phaseId] ?? null} onChange={(v) => setX({ ...x, amounts: { ...x.amounts, [phaseId]: v } })} currency={plan.currency} />
        </Field>
      )}
      <Field label="Note">
        <input value={x.note ?? ''} onChange={(e) => setX({ ...x, note: e.target.value || undefined })} placeholder="e.g. Everything inside" />
      </Field>
      <div className="btn-row">
        <button className="btn danger" onClick={() => onDelete(x.id)}>
          Delete
        </button>
        <button className="btn primary" onClick={() => onSave(x)}>
          Save
        </button>
      </div>
    </Sheet>
  );
}

export function Budget() {
  const { profile, toast, confirm, today, rates, currency } = useApp();
  const data = useData();
  const stored = useLiveQuery(() => db.budgets.get(`budget-${profile.id}`), [profile.id]);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [phaseId, setPhaseId] = useState<string>('');
  const [edit, setEdit] = useState(false);
  const [tEdit, setTEdit] = useState<BudgetTransfer | null>(null);

  useEffect(() => {
    if (stored === undefined) {
      getOrCreateBudget(profile.id);
      return;
    }
    setPlan((p) => (p && p.id === stored.id && p.updatedAt >= stored.updatedAt ? p : stored));
  }, [stored, profile.id]);
  useEffect(() => {
    if (plan && !plan.phases.some((p) => p.id === phaseId)) setPhaseId(plan.activePhaseId);
  }, [plan, phaseId]);

  if (!plan) return <Topbar title="Budget plan" />;
  const update = (p: BudgetPlan) => {
    const next = { ...p, updatedAt: Date.now() };
    setPlan(next);
    saveBudget(next);
  };
  const phase = plan.phases.find((p) => p.id === phaseId) ?? plan.phases[0];
  if (!phase) return <Topbar title="Budget plan" />;
  const totals = phaseTotals(plan, phase.id);
  const cur = plan.currency;
  const ruleAcc = plan.surplus.ruleAccountId ? data.accountById.get(plan.surplus.ruleAccountId) : undefined;
  const ruleBal = ruleAcc ? data.balances.get(ruleAcc.id) ?? 0 : null;
  const rule = surplusRule(plan, ruleBal);
  const month = monthKey(today);
  const done = plan.checklist.month === month ? plan.checklist.done : [];
  const isActive = phase.id === plan.activePhaseId;

  const toggleDone = (id: string) => {
    const list = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    update({ ...plan, checklist: { month, done: list } });
  };

  const recordTicked = async () => {
    let n = 0;
    for (const t of plan.transfers) {
      if (!done.includes(t.id) || !t.fromAccountId || !t.toAccountId) continue;
      const amt = transferAmount(plan, t, plan.activePhaseId);
      if (!amt) continue;
      const fromAcc = data.accountById.get(t.fromAccountId);
      const toAcc = data.accountById.get(t.toAccountId);
      if (!fromAcc || !toAcc || fromAcc.currency !== toAcc.currency) continue;
      await saveTx(
        { profileId: profile.id, date: today, kind: 'transfer', accountId: t.fromAccountId, toAccountId: t.toAccountId, amount: amt, toAmount: amt, note: `Budget: ${t.fromLabel} → ${t.toLabel}` },
        rates,
        currency,
      );
      n++;
    }
    toast(n ? `🔄 Recorded ${n} transfers` : 'Tick transfers that have accounts linked first');
  };

  const importWorkbook = async () => {
    const f = await pickBinaryFile('.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (!f) return;
    try {
      const res = await importBudgetFromWorkbook(f.data, plan);
      const ok = await confirm({ title: 'Replace the budget plan?', message: `Found ${res.notes.join(', ')} in ${f.name}.`, ok: 'Import' });
      if (!ok) return;
      update(res.plan);
      setPhaseId(res.plan.activePhaseId);
      toast('📥 Imported from workbook');
    } catch (e) {
      toast(`😿 ${(e as Error).message}`);
    }
  };

  return (
    <>
      <Topbar
        title={<SkinName k="budget" />}
        right={
          <button className={`btn sm ${edit ? 'primary' : ''}`} onClick={() => setEdit(!edit)}>
            {edit ? 'Done' : '✏️ Edit'}
          </button>
        }
      />
      <div className="page">
        {plan.monthlyIncome === 0 && Object.values(plan.amounts).every((a) => Object.values(a).every((v) => !v)) && (
          <button className="banner sky" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={importWorkbook}>
            <span>📥</span>
            <span className="grow">Import your Budget Allocation sheet from the workbook (.xlsx) instead of typing it</span>
            <span>›</span>
          </button>
        )}
        <div className="chips scroll mb">
          {plan.phases.map((p) => (
            <button key={p.id} className={`chip ${p.id === phase.id ? 'on' : ''}`} onClick={() => setPhaseId(p.id)}>
              {p.id === plan.activePhaseId ? '⭐ ' : ''}
              {p.name}
            </button>
          ))}
          {edit && (
            <button
              className="chip"
              onClick={() => {
                const id = uid();
                update({ ...plan, phases: [...plan.phases, { id, name: `P${plan.phases.length + 1}: New phase` }], amounts: { ...plan.amounts, [id]: { ...(plan.amounts[phase.id] ?? {}) } } });
                setPhaseId(id);
              }}
            >
              ＋ Phase
            </button>
          )}
        </div>

        {edit && (
          <div className="card flat">
            <Field label="Phase name">
              <input value={phase.name} onChange={(e) => update({ ...plan, phases: plan.phases.map((p) => (p.id === phase.id ? { ...p, name: e.target.value } : p)) })} />
            </Field>
            <div className="btn-row">
              <button
                className="btn danger"
                disabled={plan.phases.length < 2}
                onClick={async () => {
                  if (!(await confirm({ title: `Delete ${phase.name}?`, ok: 'Delete', danger: true }))) return;
                  const phases = plan.phases.filter((p) => p.id !== phase.id);
                  update({ ...plan, phases, activePhaseId: plan.activePhaseId === phase.id ? phases[0].id : plan.activePhaseId });
                  setPhaseId(phases[0].id);
                }}
              >
                Delete phase
              </button>
              <button className="btn sky" onClick={importWorkbook}>
                📥 Import workbook
              </button>
            </div>
          </div>
        )}

        <div className="hero">
          <Sparkle k="budget" override={isActive ? '⭐' : undefined} />
          <div className="label">{phase.name}</div>
          <div className="big">{fmtMoney(totals.total, cur)}</div>
          <div className="small bold">
            {Math.round(totals.pctOfIncome * 1000) / 10}% of {fmtMoney(plan.monthlyIncome, cur, { compact: true })} income ·{' '}
            {totals.left >= 0 ? `${fmtMoney(totals.left, cur, { compact: true })} not planned` : `${fmtMoney(-totals.left, cur, { compact: true })} over`}
          </div>
          <ProgressBar value={totals.pctOfIncome} colour={totals.left < 0 ? '' : 'mint'} />
          {!isActive && (
            <button className="btn sm mt" onClick={() => update({ ...plan, activePhaseId: phase.id })}>
              ⭐ Make this my current phase
            </button>
          )}
        </div>

        <Field label="Monthly income (take-home)">
          <AmountField value={plan.monthlyIncome} onChange={(v) => update({ ...plan, monthlyIncome: v })} currency={cur} />
        </Field>

        <div className="card">
          <h2>💗 Where the money goes</h2>
          <table className="t">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((l) => (
                <tr key={l.categoryId}>
                  <td>
                    {edit ? (
                      <div className="hstack">
                        <input className="inline-input" value={l.name} onChange={(e) => update({ ...plan, categories: plan.categories.map((c) => (c.id === l.categoryId ? { ...c, name: e.target.value } : c)) })} />
                        <button className="btn sm ghost" aria-label="Remove" onClick={() => update({ ...plan, categories: plan.categories.filter((c) => c.id !== l.categoryId) })}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      l.name
                    )}
                  </td>
                  <td style={{ width: 130 }}>
                    <AmountField
                      value={l.amount}
                      currency={cur}
                      title={l.name}
                      onChange={(v) => update({ ...plan, amounts: { ...plan.amounts, [phase.id]: { ...(plan.amounts[phase.id] ?? {}), [l.categoryId]: v } } })}
                    />
                  </td>
                  <td className="small">{Math.round(l.pct * 1000) / 10}%</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{fmtMoney(totals.total, cur, { compact: true })}</td>
                <td>{Math.round(totals.pctOfIncome * 1000) / 10}%</td>
              </tr>
            </tbody>
          </table>
          {edit && (
            <button className="btn sm mt" onClick={() => update({ ...plan, categories: [...plan.categories, { id: uid(), name: 'New line' }] })}>
              ＋ Budget line
            </button>
          )}
        </div>

        <div className="card">
          <h2>🔄 Monthly transfers {isActive ? `· ${month}` : ''}</h2>
          {isActive && <div className="tiny muted mb">Tick each one as you do it. The ticks reset every month.</div>}
          {plan.transfers.map((t) => {
            const amt = transferAmount(plan, t, phase.id);
            const ticked = done.includes(t.id);
            return (
              <div key={t.id} className="item-line">
                {isActive && <input type="checkbox" checked={ticked} onChange={() => toggleDone(t.id)} aria-label="Done" />}
                <button className="grow" style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0 }} onClick={() => setTEdit(t)}>
                  <div className="bold small" style={{ textDecoration: ticked ? 'line-through' : 'none' }}>
                    {t.fromLabel} → {t.toLabel}
                  </div>
                  <div className="tiny muted">
                    {t.categoryIds?.length ? plan.categories.filter((c) => t.categoryIds!.includes(c.id)).map((c) => c.name).join(' + ') : t.note ?? 'Typed amount'}
                    {t.fromAccountId && t.toAccountId ? ' · 🔗 accounts linked' : ''}
                  </div>
                </button>
                <span className="bold small nowrap">{amt ? fmtMoney(amt, cur, { compact: true }) : t.note ? '—' : fmtMoney(0, cur)}</span>
              </div>
            );
          })}
          <div className="btn-row mt">
            <button
              className="btn sm"
              onClick={() => {
                const t: BudgetTransfer = { id: uid(), fromLabel: 'From', toLabel: 'To', amounts: {} };
                update({ ...plan, transfers: [...plan.transfers, t] });
                setTEdit(t);
              }}
            >
              ＋ Transfer
            </button>
            {isActive && (
              <button className="btn sm mint" onClick={recordTicked}>
                ✅ Record ticked
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <h2>🎁 Bonus split</h2>
          <Field label="Bonus income">
            <AmountField value={plan.bonus.income} onChange={(v) => update({ ...plan, bonus: { ...plan.bonus, income: v } })} currency={cur} />
          </Field>
          <RowsEditor rows={plan.bonus.rows} base={plan.bonus.income} currency={cur} onChange={(rows) => update({ ...plan, bonus: { ...plan.bonus, rows } })} />
        </div>

        <div className="card">
          <h2>🍀 Leftover money rule</h2>
          <Field label="Leftover each month">
            <AmountField value={plan.surplus.amount} onChange={(v) => update({ ...plan, surplus: { ...plan.surplus, amount: v } })} currency={cur} />
          </Field>
          <div className="grid2">
            <Field label="Watch account">
              <AccountPickerButton accounts={data.accounts} value={plan.surplus.ruleAccountId} onChange={(v) => update({ ...plan, surplus: { ...plan.surplus, ruleAccountId: v } })} placeholder="e.g. Emergency" />
            </Field>
            <Field label="Covered at">
              <AmountField value={plan.surplus.threshold} onChange={(v) => update({ ...plan, surplus: { ...plan.surplus, threshold: v } })} currency={cur} />
            </Field>
          </div>
          <div className={`banner ${rule.covered ? 'mint' : ''}`}>
            <span>{rule.covered ? '✅' : '🛟'}</span>
            <span className="grow">
              {ruleAcc
                ? `${ruleAcc.name} has ${fmtMoney(ruleBal ?? 0, ruleAcc.currency, { compact: true })}: ${rule.covered ? 'covered, so use the “covered” split' : 'below target, so use the “below” split'}`
                : 'Pick the account to watch (e.g. your emergency fund).'}
            </span>
          </div>
          <div className="cat-group-name">While below {fmtMoney(plan.surplus.threshold, cur, { compact: true })}</div>
          <RowsEditor rows={plan.surplus.belowRows} base={plan.surplus.amount} currency={cur} onChange={(rows) => update({ ...plan, surplus: { ...plan.surplus, belowRows: rows } })} />
          <div className="cat-group-name">Once covered</div>
          <RowsEditor rows={plan.surplus.aboveRows} base={plan.surplus.amount} currency={cur} onChange={(rows) => update({ ...plan, surplus: { ...plan.surplus, aboveRows: rows } })} />
        </div>

        {!edit && (
          <button className="btn ghost block" onClick={importWorkbook}>
            📥 Import from my workbook (.xlsx)
          </button>
        )}
      </div>
      <TransferSheet
        plan={plan}
        t={tEdit}
        phaseId={phase.id}
        onClose={() => setTEdit(null)}
        onSave={(t) => {
          update({ ...plan, transfers: plan.transfers.map((x) => (x.id === t.id ? t : x)) });
          setTEdit(null);
        }}
        onDelete={(id) => {
          update({ ...plan, transfers: plan.transfers.filter((x) => x.id !== id) });
          setTEdit(null);
        }}
      />
    </>
  );
}
