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
} from '../components/ui';
import { computeBill, whoOwes } from '../domain/billSplit';
import { fmtDate } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import type { BillItem, BillPerson, BillSplit } from '../domain/types';
import { db, uid } from '../db/db';
import { deleteBill, saveBill, saveTx } from '../db/repo';
import { copyText } from '../services/platform';
import { useApp, useData } from '../state/app';

export function BillList() {
  const { go, profile, today, settings } = useApp();
  const bills = useLiveQuery(() => db.bills.orderBy('updatedAt').reverse().toArray(), []);
  const create = async () => {
    const me: BillPerson = { id: uid(), name: profile.name };
    const b: BillSplit = {
      id: uid(),
      title: 'Eating out',
      date: today,
      currency: settings.defaultCurrency,
      people: [me],
      items: [],
      servicePct: 10,
      vatPct: 7,
      vatOnService: true,
      mode: 'itemised',
      roundWhole: false,
      paidBy: me.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveBill(b);
    go({ name: 'bill', id: b.id });
  };
  return (
    <>
      <Topbar title="Bill split 🍽️" />
      <div className="page">
        <button className="btn primary block mb" onClick={create}>
          ＋ New bill
        </button>
        {bills && bills.length === 0 && (
          <div className="card center small muted">
            <div style={{ fontSize: 40 }}>🍜</div>
            Add who ate, what they ordered and shared dishes or drinks. Service charge and VAT are shared fairly.
          </div>
        )}
        {bills && bills.length > 0 && (
          <div className="list">
            {bills.map((b) => {
              const r = computeBill(b);
              return (
                <button key={b.id} className="row" onClick={() => go({ name: 'bill', id: b.id })}>
                  <div className="bubble peach">🍽️</div>
                  <div className="main">
                    <div className="title">{b.title}</div>
                    <div className="sub">
                      {fmtDate(b.date)} · {b.people.length} people
                    </div>
                  </div>
                  <div className="end">
                    <div className="amt">{fmtMoney(r.total, b.currency)}</div>
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

function ItemLine({
  item,
  currency,
  onChange,
  onRemove,
}: {
  item: BillItem;
  currency: string;
  onChange: (i: BillItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="item-line">
      <input
        className="inline-input grow"
        placeholder="Dish or drink"
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
      />
      <div style={{ width: 120, flex: 'none' }}>
        <AmountField
          value={item.price || null}
          onChange={(v) => onChange({ ...item, price: v })}
          currency={currency}
          placeholder="Price"
          title={item.name || 'Price'}
        />
      </div>
      <button className="btn sm ghost" aria-label="Remove item" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function LogShareSheet({ bill, open, onClose }: { bill: BillSplit; open: boolean; onClose: () => void }) {
  const { profile, rates, currency, toast } = useApp();
  const data = useData();
  const r = computeBill(bill);
  const guessMe = bill.people.find((p) => p.name.trim().toLowerCase() === profile.name.toLowerCase())?.id ?? bill.people[0]?.id;
  const [me, setMe] = useState(guessMe);
  const [what, setWhat] = useState<'share' | 'full'>('share');
  const dinner = data.categories.find((c) => c.kind === 'expense' && c.name.toLowerCase() === 'dinner')?.id;
  const [categoryId, setCategoryId] = useState<string | undefined>(dinner);
  const [accountId, setAccountId] = useState<string | undefined>(
    data.accounts.find((a) => a.type === 'cash' || a.type === 'bank')?.id,
  );
  const share = r.shares.find((s) => s.personId === me)?.pay ?? 0;
  const amount = what === 'share' ? share : r.total;
  const acc = accountId ? data.accountById.get(accountId) : undefined;
  const save = async () => {
    if (!acc || !categoryId) return toast('Choose an account and a category');
    const sameCur = acc.currency === bill.currency;
    await saveTx(
      {
        profileId: profile.id,
        date: bill.date,
        kind: 'expense',
        accountId: acc.id,
        amount: sameCur ? amount : amount * ((rates.perUsd[acc.currency] ?? 1) / (rates.perUsd[bill.currency] ?? 1)),
        origAmount: sameCur ? undefined : amount,
        origCurrency: sameCur ? undefined : bill.currency,
        categoryId,
        note: `${bill.title}${what === 'full' ? ' (whole bill)' : ''}`,
      },
      rates,
      currency,
    );
    toast('🌸 Logged');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log in my spending">
      <Field label="Which one is me?">
        <div className="chips">
          {bill.people.map((p) => (
            <button key={p.id} className={`chip ${me === p.id ? 'on' : ''}`} onClick={() => setMe(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </Field>
      <Seg
        value={what}
        onChange={setWhat}
        options={[
          { v: 'share', label: `My share ${fmtMoney(share, bill.currency)}` },
          { v: 'full', label: `Whole bill ${fmtMoney(r.total, bill.currency)}` },
        ]}
      />
      <div className="tiny muted mt">
        Paid the whole bill? Log the whole bill, then log money friends pay back as income (Payback).
      </div>
      <Field label="Paid with">
        <AccountPickerButton accounts={data.accounts} value={accountId} onChange={setAccountId} />
      </Field>
      <CategoryGrid categories={data.categories} kind="expense" value={categoryId} onPick={setCategoryId} />
      <button className="btn primary block mt" onClick={save}>
        Log {fmtMoney(amount, bill.currency)}
      </button>
    </Sheet>
  );
}

export function BillEdit({ id }: { id: string }) {
  const { back, toast, confirm } = useApp();
  const stored = useLiveQuery(() => db.bills.get(id), [id]);
  const [b, setB] = useState<BillSplit | null>(null);
  const [newName, setNewName] = useState('');
  const [personEdit, setPersonEdit] = useState<BillPerson | null>(null);
  const [curOpen, setCurOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (stored && !b) setB(stored);
  }, [stored, b]);

  if (!b) return <Topbar title="Bill split" />;

  const update = (patch: Partial<BillSplit>) => {
    const next = { ...b, ...patch };
    setB(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveBill(next), 300);
  };
  const r = computeBill(b);
  const owes = whoOwes(r, b.paidBy);
  const cur = b.currency;

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    update({ people: [...b.people, { id: uid(), name }] });
    setNewName('');
  };
  const removePerson = (pid: string) => {
    update({
      people: b.people.filter((p) => p.id !== pid),
      items: b.items
        .filter((i) => i.shared || i.sharedBy[0] !== pid)
        .map((i) => ({ ...i, sharedBy: i.sharedBy.filter((x) => x !== pid) })),
      paidBy: b.paidBy === pid ? b.people.find((p) => p.id !== pid)?.id : b.paidBy,
    });
  };
  const setItem = (item: BillItem) => update({ items: b.items.map((i) => (i.id === item.id ? item : i)) });
  const removeItem = (iid: string) => update({ items: b.items.filter((i) => i.id !== iid) });
  const shared = b.items.filter((i) => i.shared);

  const summaryText = () => {
    const lines = [`🍽️ ${b.title} · ${fmtDate(b.date)}`];
    for (const s of r.shares) lines.push(`${s.name}: ${fmtMoney(s.pay, cur)}${s.exempt ? ' (treated to service & VAT)' : ''}`);
    lines.push(`Total ${fmtMoney(r.total, cur)} (service ${b.servicePct}%, VAT ${b.vatPct}%)`);
    const payer = b.people.find((p) => p.id === b.paidBy);
    if (payer) lines.push(`Please pay ${payer.name} 🙏`);
    return lines.join('\n');
  };

  return (
    <>
      <Topbar
        title={b.title || 'Bill'}
        right={
          <button
            className="icon-btn"
            aria-label="Delete bill"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this bill?', ok: 'Delete', danger: true }))) return;
              await deleteBill(b.id);
              back();
            }}
          >
            🗑️
          </button>
        }
      />
      <div className="page">
        <div className="grid2">
          <Field label="Name">
            <input value={b.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" value={b.date} onChange={(e) => update({ date: e.target.value || b.date })} />
          </Field>
        </div>

        <div className="section-title">
          👯 People ({b.people.length}) <span className="grow" />
          <button className="btn sm ghost" onClick={() => setCurOpen(true)}>
            {cur} ▾
          </button>
        </div>
        <div className="chips mb">
          {b.people.map((p) => (
            <button key={p.id} className="chip" onClick={() => setPersonEdit(p)}>
              <Avatar name={p.name} /> {p.name} {p.exemptCharges ? '🎁' : ''}
            </button>
          ))}
        </div>
        <div className="hstack mb">
          <input
            placeholder="Add a person"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerson()}
          />
          <button className="btn" onClick={addPerson}>
            ＋
          </button>
        </div>

        <Seg
          value={b.mode}
          onChange={(m) => update({ mode: m })}
          options={[
            { v: 'itemised', label: '🧾 By what they had' },
            { v: 'even', label: '➗ Split evenly' },
          ]}
        />
        {b.mode === 'even' && (
          <div className="tiny muted mt">Everyone pays the same share of the food. Items below only make the total.</div>
        )}

        <div className="section-title">🍜 Own orders</div>
        {b.people.map((p) => {
          const own = b.items.filter((i) => !i.shared && i.sharedBy[0] === p.id);
          return (
            <div key={p.id} className="person-card">
              <div className="hstack">
                <Avatar name={p.name} />
                <span className="bold grow">{p.name}</span>
                <span className="small muted">
                  {fmtMoney(
                    own.reduce((s, i) => s + (i.price || 0), 0),
                    cur,
                  )}
                </span>
              </div>
              {own.map((i) => (
                <ItemLine key={i.id} item={i} currency={cur} onChange={setItem} onRemove={() => removeItem(i.id)} />
              ))}
              <button
                className="btn sm ghost"
                onClick={() =>
                  update({ items: [...b.items, { id: uid(), name: '', price: 0, sharedBy: [p.id], shared: false }] })
                }
              >
                ＋ Add order
              </button>
            </div>
          );
        })}

        <div className="section-title">🍻 Shared items (split between the people ticked)</div>
        {shared.map((i) => (
          <div key={i.id} className="person-card">
            <ItemLine item={i} currency={cur} onChange={setItem} onRemove={() => removeItem(i.id)} />
            <div className="between mt">
              <span className="tiny muted">
                Shared by {i.sharedBy.length || 'everyone'} ·{' '}
                {fmtMoney(i.sharedBy.length ? (i.price || 0) / i.sharedBy.length : 0, cur)} each
              </span>
              <span className="hstack">
                <button className="btn sm ghost" onClick={() => setItem({ ...i, sharedBy: b.people.map((p) => p.id) })}>
                  All
                </button>
                <button className="btn sm ghost" onClick={() => setItem({ ...i, sharedBy: [] })}>
                  None
                </button>
              </span>
            </div>
            <div className="chips">
              {b.people.map((p) => {
                const on = i.sharedBy.includes(p.id);
                return (
                  <button
                    key={p.id}
                    className={`chip mint ${on ? 'on' : ''}`}
                    onClick={() => setItem({ ...i, sharedBy: on ? i.sharedBy.filter((x) => x !== p.id) : [...i.sharedBy, p.id] })}
                  >
                    {on ? '✓ ' : ''}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button
          className="btn block mb"
          onClick={() =>
            update({ items: [...b.items, { id: uid(), name: '', price: 0, sharedBy: b.people.map((p) => p.id), shared: true }] })
          }
        >
          ＋ Shared item (drinks, dishes for the table…)
        </button>

        <div className="card">
          <h2>🧾 Service charge & VAT</h2>
          <div className="chips mb">
            <button className="chip" onClick={() => update({ servicePct: 10, vatPct: 7, vatOnService: true })}>
              10% + 7%
            </button>
            <button className="chip" onClick={() => update({ servicePct: 0, vatPct: 7 })}>
              VAT 7% only
            </button>
            <button className="chip" onClick={() => update({ servicePct: 0, vatPct: 0 })}>
              None
            </button>
          </div>
          <div className="grid2">
            <Field label="Service charge %">
              <NumberInput value={b.servicePct} onChange={(v) => update({ servicePct: v })} />
            </Field>
            <Field label="VAT %">
              <NumberInput value={b.vatPct} onChange={(v) => update({ vatPct: v })} />
            </Field>
          </div>
          <ToggleRow
            title="VAT on top of service charge"
            desc="Usual in Thailand"
            on={b.vatOnService}
            onChange={(v) => update({ vatOnService: v })}
          />
          <ToggleRow title="Round to whole numbers" on={b.roundWhole} onChange={(v) => update({ roundWhole: v })} />
          <div className="tiny muted">
            Tap a person above and turn on “Treat to service & VAT” to have the others cover their share.
          </div>
        </div>

        <div className="hero">
          <Sparkle k="bills" />
          <div className="label">Total bill</div>
          <div className="big">{fmtMoney(r.total, cur)}</div>
          <div className="small bold">
            Food {fmtMoney(r.subtotal, cur)} · service {fmtMoney(r.service, cur)} · VAT {fmtMoney(r.vat, cur)}
          </div>
        </div>
        {r.warnings.map((w) => (
          <div key={w} className="banner">
            <span>⚠️</span>
            <span className="grow">{w}</span>
          </div>
        ))}
        <div className="list">
          {r.shares.map((s) => (
            <div key={s.personId} className="row">
              <Avatar name={s.name} />
              <div className="main">
                <div className="title">
                  {s.name} {s.exempt ? '🎁' : ''}
                </div>
                <div className="sub">
                  food {fmtMoney(s.food, cur)} · service {fmtMoney(s.service, cur)} · VAT {fmtMoney(s.vat, cur)}
                </div>
              </div>
              <div className="end">
                <div className="amt">{fmtMoney(s.pay, cur)}</div>
              </div>
            </div>
          ))}
        </div>
        {r.roundingDiff !== 0 && (
          <div className="tiny muted mb">
            Rounding: shares add up to {fmtMoney(r.roundingDiff, cur, { sign: true })} versus the bill.
          </div>
        )}

        <Field label="Who paid the bill?">
          <div className="chips">
            {b.people.map((p) => (
              <button key={p.id} className={`chip ${b.paidBy === p.id ? 'on' : ''}`} onClick={() => update({ paidBy: p.id })}>
                {p.name}
              </button>
            ))}
          </div>
        </Field>
        {owes.length > 0 && (
          <div className="card">
            <h2>💌 Pay back</h2>
            {owes.map((o) => (
              <div key={o.fromId} className="between small" style={{ padding: '4px 0' }}>
                <span>
                  {o.fromName} → {o.toName}
                </span>
                <b>{fmtMoney(o.amount, cur)}</b>
              </div>
            ))}
          </div>
        )}
        <div className="btn-row">
          <button
            className="btn sky"
            onClick={async () => {
              const ok = await copyText(summaryText());
              toast(ok ? '📋 Copied, paste it in the group chat' : 'Could not copy');
            }}
          >
            📋 Copy summary
          </button>
          <button className="btn pink" onClick={() => setLogOpen(true)}>
            💸 Log my spending
          </button>
        </div>
      </div>

      <Sheet open={!!personEdit} onClose={() => setPersonEdit(null)} title="Person">
        {personEdit && (
          <>
            <Field label="Name">
              <input value={personEdit.name} onChange={(e) => setPersonEdit({ ...personEdit, name: e.target.value })} />
            </Field>
            <ToggleRow
              title="🎁 Treat to service & VAT"
              desc="They pay only for their food; the others cover their service charge and VAT"
              on={!!personEdit.exemptCharges}
              onChange={(v) => setPersonEdit({ ...personEdit, exemptCharges: v })}
            />
            <div className="btn-row mt">
              <button
                className="btn danger"
                onClick={() => {
                  removePerson(personEdit.id);
                  setPersonEdit(null);
                }}
              >
                Remove
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  update({
                    people: b.people.map((p) =>
                      p.id === personEdit.id ? { ...personEdit, name: personEdit.name.trim() || p.name } : p,
                    ),
                  });
                  setPersonEdit(null);
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </Sheet>
      <CurrencySheet open={curOpen} onClose={() => setCurOpen(false)} value={cur} onPick={(c) => update({ currency: c })} />
      {logOpen && <LogShareSheet bill={b} open={logOpen} onClose={() => setLogOpen(false)} />}
    </>
  );
}
