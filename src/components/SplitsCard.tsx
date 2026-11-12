// "Inside this account": money earmarked in parts (Car, Emergency, saving targets…) and What's left.
// A record only: the account's real balance never changes.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { AmountField, Field, Sheet } from './ui';
import { fmtMoney } from '../domain/money';
import { splitView } from '../domain/splits';
import type { Account, AccountSplit } from '../domain/types';
import { db, uid } from '../db/db';
import { saveAccount } from '../db/repo';
import { useApp, useData } from '../state/app';

type Edit = { mode: 'add' } | { mode: 'edit'; split: AccountSplit; amount: number } | { mode: 'left' } | null;

export function SplitsCard({ account }: { account: Account }) {
  const { go, toast, profile, removeWithUndo } = useApp();
  const data = useData();
  const plan = useLiveQuery(() => db.budgets.where('profileId').equals(profile.id).first(), [profile.id]);
  const [edit, setEdit] = useState<Edit>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [link, setLink] = useState<string | undefined>();
  const [moveAmount, setMoveAmount] = useState<number | null>(null);
  const [moveTo, setMoveTo] = useState<string>('left');

  const balance = data.balances.get(account.id) ?? 0;
  const view = splitView(account, balance, data.txs, data.goals, data.reserved.get(account.id) ?? 0);
  const cur = account.currency;
  const splits = account.splits ?? [];
  const has = view.rows.some((r) => !r.bills);

  // budget categories whose transfer goes into this account, not yet a split here
  const planCats = plan?.categories ?? [];
  const linked = new Set(splits.map((s) => s.budgetCategoryId).filter(Boolean));
  const suggested = planCats.filter(
    (c) => !linked.has(c.id) && plan?.transfers.some((t) => t.toAccountId === account.id && t.categoryIds?.includes(c.id)),
  );

  const save = (next: AccountSplit[], leftName = account.leftName) => saveAccount({ ...account, splits: next, leftName });
  const openAdd = (preset?: { name: string; link?: string }) => {
    setName(preset?.name ?? '');
    setLink(preset?.link);
    setAmount(null);
    setEdit({ mode: 'add' });
  };
  const openEdit = (split: AccountSplit, now: number) => {
    setName(split.name);
    setLink(split.budgetCategoryId);
    setAmount(now);
    setMoveAmount(null);
    setMoveTo('left');
    setEdit({ mode: 'edit', split, amount: now });
  };

  return (
    <div className="card">
      <h2>🧩 Inside this account</h2>
      {!has ? (
        <>
          <div className="small muted mb">
            Split the balance into parts (Car, Emergency…) to know what each part is for. It is a record only: the real balance
            stays the same.
          </div>
          <button className="btn sky block" onClick={() => openAdd()}>
            ＋ Split this account
          </button>
        </>
      ) : (
        <>
          <div className="list flat-list">
            {view.rows.map((r) => (
              <button
                key={r.key}
                className="row"
                disabled={r.bills}
                onClick={() => (r.split ? openEdit(r.split, r.amount) : r.goal ? go({ name: 'goals' }) : undefined)}
              >
                <div className="main">
                  <div className="title">{r.name}</div>
                  <div className="sub">
                    {r.bills
                      ? 'upcoming bills, listed below'
                      : r.goal
                        ? 'saving target'
                        : r.split?.budgetCategoryId
                          ? '🔗 budget plan'
                          : 'tap to change'}
                  </div>
                </div>
                <div className="end">
                  <div className={`amt ${r.amount < 0 ? 'neg' : ''}`}>{fmtMoney(r.amount, cur)}</div>
                </div>
              </button>
            ))}
            <button
              className="row"
              onClick={() => {
                setName(view.leftName);
                setEdit({ mode: 'left' });
              }}
            >
              <div className="main">
                <div className="title">{view.leftName}</div>
                <div className="sub">the rest of the balance · tap to rename</div>
              </div>
              <div className="end">
                <div className={`amt ${view.left < 0 ? 'neg' : 'pos'}`}>
                  {view.left < 0 ? `${fmtMoney(-view.left, cur)} short` : fmtMoney(view.left, cur)}
                </div>
              </div>
            </button>
          </div>
          {view.left < 0 && (
            <div className="tiny neg mt">More is claimed than the account holds. Lower a split or add money.</div>
          )}
          <div className="btn-row mt">
            <button className="btn sm ghost" onClick={() => openAdd()}>
              ＋ Add split
            </button>
          </div>
        </>
      )}
      {suggested.length > 0 && (
        <div className="mt">
          <div className="tiny muted mb">From your budget plan:</div>
          <div className="chips">
            {suggested.map((c) => (
              <button key={c.id} className="chip mint" onClick={() => openAdd({ name: c.name, link: c.id })}>
                ＋ {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.mode === 'add' ? '🧩 New split' : edit?.mode === 'left' ? 'Rename the rest' : `🧩 ${name}`}
      >
        {edit?.mode === 'left' && (
          <>
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What's left" autoFocus />
            </Field>
            <button
              className="btn primary block"
              onClick={async () => {
                await save(splits, name.trim() || undefined);
                setEdit(null);
              }}
            >
              Save
            </button>
          </>
        )}
        {(edit?.mode === 'add' || edit?.mode === 'edit') && (
          <>
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Car, Emergency" />
            </Field>
            <Field
              label={edit.mode === 'add' ? 'How much of the balance is for it now' : 'Amount now'}
              hint={`The rest stays in ${view.leftName}.`}
            >
              <AmountField value={amount} onChange={setAmount} currency={cur} placeholder="0" title={name || 'Split'} />
            </Field>
            {planCats.length > 0 && (
              <Field
                label="Fill from the budget plan (optional)"
                hint="Ticking that transfer adds the amount; unticking takes it back."
              >
                <div className="chips">
                  <button className={`chip ${!link ? 'on' : ''}`} onClick={() => setLink(undefined)}>
                    None
                  </button>
                  {planCats.map((c) => (
                    <button key={c.id} className={`chip ${link === c.id ? 'on' : ''}`} onClick={() => setLink(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {edit.mode === 'edit' && (
              <Field label="Move money out of it">
                <div className="hstack">
                  <div style={{ width: 130, flex: 'none' }}>
                    <AmountField value={moveAmount} onChange={setMoveAmount} currency={cur} placeholder="Amount" compact />
                  </div>
                  <div className="chips">
                    <button className={`chip ${moveTo === 'left' ? 'on' : ''}`} onClick={() => setMoveTo('left')}>
                      → {view.leftName}
                    </button>
                    {splits
                      .filter((s) => s.id !== edit.split.id)
                      .map((s) => (
                        <button key={s.id} className={`chip ${moveTo === s.id ? 'on' : ''}`} onClick={() => setMoveTo(s.id)}>
                          → {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              </Field>
            )}
            <div className="btn-row mt">
              {edit.mode === 'edit' && (
                <button
                  className="btn danger"
                  onClick={async () => {
                    const id = edit.split.id;
                    setEdit(null);
                    await removeWithUndo(
                      () => save(splits.filter((s) => s.id !== id)),
                      `🗑️ Split removed · its money is in ${view.leftName}`,
                    );
                  }}
                >
                  Delete
                </button>
              )}
              <button
                className="btn primary"
                onClick={async () => {
                  const n = name.trim();
                  if (!n) return toast('Give it a name');
                  if (edit.mode === 'add') {
                    await save([...splits, { id: uid(), name: n, base: amount ?? 0, budgetCategoryId: link }]);
                  } else {
                    const id = edit.split.id;
                    const change = (amount ?? 0) - edit.amount; // set a new amount
                    const moved = moveAmount && moveAmount > 0 ? moveAmount : 0;
                    await save(
                      splits.map((s) =>
                        s.id === id
                          ? { ...s, name: n, budgetCategoryId: link, base: s.base + change - moved }
                          : s.id === moveTo && moved
                            ? { ...s, base: s.base + moved }
                            : s,
                      ),
                    );
                  }
                  toast('🧩 Saved');
                  setEdit(null);
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
