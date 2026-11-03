import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import {
  AccountPickerButton,
  AmountField,
  Avatar,
  CategoryGrid,
  CurrencySheet,
  Field,
  NumberInput,
  Seg,
  Sheet,
  Sparkle,
  ToggleRow,
  Topbar,
} from '../components/ui';
import { computeBill, settleBill, type BillResult, type PaymentPlan } from '../domain/billSplit';
import { fmtDate } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import type { BillItem, BillPayment, BillPerson, BillSplit } from '../domain/types';
import { db, uid } from '../db/db';
import { deleteBill, recordOwed, saveBill, saveTx, type OwedItem } from '../db/repo';
import { copyText } from '../services/platform';
import { holdProps } from '../components/hold';
import { QuickActions } from '../components/QuickActions';
import { useApp, useData } from '../state/app';

export function BillList() {
  const { go, profile, today, settings, confirm, toast } = useApp();
  const [quick, setQuick] = useState<BillSplit | null>(null);
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
                <button
                  key={b.id}
                  className="row"
                  onClick={() => go({ name: 'bill', id: b.id })}
                  {...holdProps(() => setQuick(b))}
                >
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
      {quick && (
        <QuickActions
          title={quick.title || 'Bill'}
          onClose={() => setQuick(null)}
          actions={[
            { label: '✏️ Open', tone: 'plain', run: () => go({ name: 'bill', id: quick.id }) },
            {
              label: '📄 Duplicate for today',
              tone: 'mint',
              run: async () => {
                const copy: BillSplit = {
                  ...quick,
                  id: uid(),
                  title: `${quick.title} (copy)`,
                  date: today,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await saveBill(copy);
                go({ name: 'bill', id: copy.id });
              },
            },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: `Delete ${quick.title || 'this bill'}?`, ok: 'Delete', danger: true }))) return;
                await deleteBill(quick.id);
                toast('🗑️ Deleted');
              },
            },
          ]}
        />
      )}
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
  const [what, setWhat] = useState<'share' | 'full' | 'paid'>('share');
  const plan = settleBill(r, bill.payments, bill.paidBy, bill.currency);
  const dinner = data.categories.find((c) => c.kind === 'expense' && c.name.toLowerCase() === 'dinner')?.id;
  const [categoryId, setCategoryId] = useState<string | undefined>(dinner);
  const [accountId, setAccountId] = useState<string | undefined>(
    data.accounts.find((a) => a.type === 'cash' || a.type === 'bank')?.id,
  );
  const share = r.shares.find((s) => s.personId === me)?.pay ?? 0;
  const myPaid = me ? (plan.paid.get(me) ?? 0) : 0;
  const amount = what === 'share' ? share : what === 'paid' ? myPaid : r.total;
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
        note: `${bill.title}${what === 'full' ? ' (whole bill)' : what === 'paid' ? ' (what I paid)' : ''}`,
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
          ...(myPaid > 0 && Math.abs(myPaid - r.total) > 0.005
            ? [{ v: 'paid' as const, label: `What I paid ${fmtMoney(myPaid, bill.currency)}` }]
            : []),
          { v: 'full', label: `Whole bill ${fmtMoney(r.total, bill.currency)}` },
        ]}
      />
      <div className="tiny muted mt">
        Paid for others? Log what you paid, then log money friends pay back as income (Payback), or add them to Who owes me below.
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

/** Who put money down (one person, or several by amount or %), the fewest payments to settle, and a link to Who owes me. */
function PayersSection({
  b,
  r,
  plan,
  update,
}: {
  b: BillSplit;
  r: BillResult;
  plan: PaymentPlan;
  update: (patch: Partial<BillSplit>) => void;
}) {
  const { profile, toast, go } = useApp();
  const cur = b.currency;
  const several = b.payments !== undefined;
  const guessMe = b.people.find((p) => p.name.trim().toLowerCase() === profile.name.trim().toLowerCase())?.id;
  const [meId, setMeId] = useState<string | undefined>(guessMe);
  const [added, setAdded] = useState(false);
  const [paysFor, setPaysFor] = useState<{ payer?: string; who: string[] } | null>(null);
  const owedTotal = r.shares.reduce((x, s) => x + s.pay, 0);
  const nameOf = (id?: string) => b.people.find((p) => p.id === id)?.name ?? '?';
  const covered = b.people.filter((p) => p.paidById && b.people.some((x) => x.id === p.paidById));
  const setPaidById = (ids: string[], payer: string | undefined) =>
    update({ people: b.people.map((p) => (ids.includes(p.id) ? { ...p, paidById: payer } : p)) });

  const setPayment = (personId: string, patch: Partial<BillPayment>) => {
    const list = b.payments ?? [];
    const next = list.some((p) => p.personId === personId)
      ? list.map((p) => (p.personId === personId ? { ...p, ...patch } : p))
      : [...list, { personId, amount: 0, ...patch }];
    update({ payments: next });
  };

  const mine: OwedItem[] = meId
    ? plan.transfers
        .filter((t) => t.toId === meId || t.fromId === meId)
        .map((t) => {
          const theyOweMe = t.toId === meId;
          const otherId = theyOweMe ? t.fromId : t.toId;
          return {
            person: theyOweMe ? t.fromName : t.toName,
            direction: theyOweMe ? ('owedToMe' as const) : ('iOwe' as const),
            amount: t.amount,
            currency: cur,
            date: b.date,
            note: b.title || 'Bill split',
            key: `bill:${b.id}:${otherId}:${theyOweMe ? 'in' : 'out'}`,
          };
        })
    : [];

  return (
    <div className="card">
      <h2>💳 Who paid?</h2>
      <Seg
        value={several ? 'several' : 'one'}
        onChange={(v) =>
          update(
            v === 'one' ? { payments: undefined } : { payments: b.paidBy ? [{ personId: b.paidBy, amount: 0, pct: 1 }] : [] },
          )
        }
        options={[
          { v: 'one', label: 'One person' },
          { v: 'several', label: 'Several people' },
        ]}
      />
      {!several ? (
        <div className="chips mt">
          {b.people.map((p) => (
            <button key={p.id} className={`chip ${b.paidBy === p.id ? 'on' : ''}`} onClick={() => update({ paidBy: p.id })}>
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="tiny muted mt mb">Type what each person paid, or a % of the bill. Leave the rest at 0.</div>
          {b.people.map((p) => {
            const pay = (b.payments ?? []).find((x) => x.personId === p.id);
            const amount = plan.paid.get(p.id) ?? 0;
            const pct = pay?.pct !== undefined ? pay.pct * 100 : owedTotal > 0 ? (amount / owedTotal) * 100 : 0;
            return (
              <div key={p.id} className="item-line">
                <Avatar name={p.name} />
                <span className="grow small bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <div style={{ width: 92, flex: 'none' }}>
                  <AmountField
                    compact
                    value={amount || null}
                    onChange={(v) => setPayment(p.id, { amount: v, pct: undefined })}
                    currency={cur}
                    placeholder="0"
                    title={`${p.name} paid`}
                  />
                </div>
                <div style={{ width: 54, flex: 'none' }}>
                  <NumberInput
                    className="inline-input"
                    value={Math.round(pct * 100) / 100}
                    onChange={(v) => setPayment(p.id, { pct: v / 100, amount: 0 })}
                  />
                </div>
                <span className="tiny">%</span>
                <button
                  className="btn sm ghost"
                  title="Pay the rest"
                  onClick={() => setPayment(p.id, { amount: Math.max(0, amount + plan.missing), pct: undefined })}
                >
                  rest
                </button>
              </div>
            );
          })}
          <div className={`small mt ${Math.abs(plan.missing) > 0.005 ? 'neg' : 'pos'}`}>
            Paid {fmtMoney(plan.paidTotal, cur)} of {fmtMoney(owedTotal, cur)}
            {plan.missing > 0.005
              ? ` · ${fmtMoney(plan.missing, cur)} still to pay`
              : plan.missing < -0.005
                ? ` · ${fmtMoney(-plan.missing, cur)} too much`
                : ' ✓'}
          </div>
        </>
      )}

      <div className="cat-group-name">🤝 Paying for someone else</div>
      {covered.length === 0 ? (
        <div className="tiny muted">E.g. a friend pays for his wife: her share is added to his.</div>
      ) : (
        covered.map((p) => (
          <div key={p.id} className="between small" style={{ padding: '2px 0' }}>
            <span>
              {nameOf(p.paidById)} pays for {p.name}
            </span>
            <button
              className="btn sm ghost"
              aria-label={`${p.name} pays their own`}
              onClick={() => setPaidById([p.id], undefined)}
            >
              ✕
            </button>
          </div>
        ))
      )}
      {b.people.length > 1 && (
        <button className="btn sky block mt" onClick={() => setPaysFor({ who: [] })}>
          ＋ Someone pays for another person
        </button>
      )}

      {plan.transfers.length > 0 && (
        <>
          <div className="cat-group-name">💌 Settle up</div>
          {plan.transfers.map((t) => (
            <div key={`${t.fromId}-${t.toId}`} className="between small" style={{ padding: '4px 0' }}>
              <span>
                {t.fromName} → {t.toName}
              </span>
              <b>{fmtMoney(t.amount, cur)}</b>
            </div>
          ))}
          <div className="field mt">
            <div className="label">Which one is you?</div>
            <div className="chips">
              {b.people.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${meId === p.id ? 'on' : ''}`}
                  onClick={() => {
                    setMeId(p.id);
                    setAdded(false);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          {added ? (
            <button className="btn mint block" onClick={() => go({ name: 'debts' })}>
              ✓ Added · open Who owes me ›
            </button>
          ) : (
            <button
              className="btn sky block"
              disabled={mine.length === 0}
              onClick={async () => {
                const n = await recordOwed(profile.id, mine);
                setAdded(true);
                toast(`🦉 ${n} added to Who owes me`);
              }}
            >
              🦉 {mine.length ? `Add ${mine.length} to Who owes me` : 'Nothing between you and others'}
            </button>
          )}
          <div className="tiny muted mt">Adding again after changes updates the amounts; it never counts twice.</div>
        </>
      )}
      <Sheet open={!!paysFor} onClose={() => setPaysFor(null)} title="🤝 Who pays for whom?">
        {paysFor && (
          <>
            <Field label="Who pays?">
              <div className="chips">
                {b.people.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${paysFor.payer === p.id ? 'on' : ''}`}
                    onClick={() => setPaysFor({ payer: p.id, who: paysFor.who.filter((x) => x !== p.id) })}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </Field>
            {paysFor.payer && (
              <Field label={`${nameOf(paysFor.payer)} pays for`}>
                <div className="chips">
                  {b.people
                    .filter((p) => p.id !== paysFor.payer)
                    .map((p) => {
                      const on = paysFor.who.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          className={`chip mint ${on ? 'on' : ''}`}
                          onClick={() =>
                            setPaysFor({ ...paysFor, who: on ? paysFor.who.filter((x) => x !== p.id) : [...paysFor.who, p.id] })
                          }
                        >
                          {on ? '✓ ' : ''}
                          {p.name}
                        </button>
                      );
                    })}
                </div>
              </Field>
            )}
            <button
              className="btn primary block mt"
              disabled={!paysFor.payer || paysFor.who.length === 0}
              onClick={() => {
                setPaidById(paysFor.who, paysFor.payer);
                setPaysFor(null);
              }}
            >
              Save
            </button>
          </>
        )}
      </Sheet>
    </div>
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
  const plan = settleBill(r, b.payments, b.paidBy, b.currency);
  const cur = b.currency;

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    update({ people: [...b.people, { id: uid(), name }] });
    setNewName('');
  };
  const removePerson = (pid: string) => {
    update({
      people: b.people.filter((p) => p.id !== pid).map((p) => (p.paidById === pid ? { ...p, paidById: undefined } : p)),
      items: b.items
        .filter((i) => i.shared || i.sharedBy[0] !== pid)
        .map((i) => ({ ...i, sharedBy: i.sharedBy.filter((x) => x !== pid) })),
      paidBy: b.paidBy === pid ? b.people.find((p) => p.id !== pid)?.id : b.paidBy,
      payments: b.payments?.filter((x) => x.personId !== pid),
    });
  };
  const setItem = (item: BillItem) => update({ items: b.items.map((i) => (i.id === item.id ? item : i)) });
  const removeItem = (iid: string) => update({ items: b.items.filter((i) => i.id !== iid) });
  const shared = b.items.filter((i) => i.shared);
  /** even split: every dish that isn't "only for some" */
  const food = b.items.filter((i) => !i.shared);
  const foodTotal = food.reduce((x, i) => x + (i.price || 0), 0);
  /** by what they had: dishes that belong to nobody (added in even split) */
  const tableItems = food.filter((i) => !b.people.some((p) => p.id === i.sharedBy[0]));

  const summaryText = () => {
    const lines = [`🍽️ ${b.title} · ${fmtDate(b.date)}`];
    for (const s of r.shares)
      lines.push(
        `${s.name}: ${s.paidBy ? `paid by ${s.paidBy}` : fmtMoney(s.pay, cur)}${
          s.paysFor.length ? ` (incl. ${s.paysFor.join(', ')})` : ''
        }${s.exempt ? ' (treated to service & VAT)' : ''}`,
      );
    lines.push(`Total ${fmtMoney(r.total, cur)} (service ${b.servicePct}%, VAT ${b.vatPct}%)`);
    for (const t of plan.transfers) lines.push(`${t.fromName} → ${t.toName}: ${fmtMoney(t.amount, cur)}`);
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
              {p.paidById ? '🤝' : ''}
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
          <div className="tiny muted mt">
            Food is shared equally by everyone. Items under “Only for some” (drinks…) are shared only by the people ticked.
          </div>
        )}

        {b.mode === 'even' ? (
          <>
            <div className="section-title">🍜 Food for everyone</div>
            <div className="person-card">
              {food.map((i) => (
                <ItemLine key={i.id} item={i} currency={cur} onChange={setItem} onRemove={() => removeItem(i.id)} />
              ))}
              <div className="between">
                <button
                  className="btn sm ghost"
                  onClick={() => update({ items: [...b.items, { id: uid(), name: '', price: 0, sharedBy: [], shared: false }] })}
                >
                  ＋ Add dish
                </button>
                <span className="tiny muted">
                  {fmtMoney(foodTotal, cur)} ÷ {b.people.length} ={' '}
                  {fmtMoney(b.people.length ? foodTotal / b.people.length : 0, cur)} each
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="section-title">🍜 Own orders</div>
            {tableItems.length > 0 && (
              <div className="person-card">
                <div className="bold">🍽️ For the whole table (shared by everyone)</div>
                {tableItems.map((i) => (
                  <ItemLine key={i.id} item={i} currency={cur} onChange={setItem} onRemove={() => removeItem(i.id)} />
                ))}
              </div>
            )}
          </>
        )}
        {b.mode === 'itemised' &&
          b.people.map((p) => {
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

        <div className="section-title">
          {b.mode === 'even'
            ? '🍻 Only for some (drinks…, split between the people ticked)'
            : '🍻 Shared items (split between the people ticked)'}
        </div>
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
          {b.mode === 'even' ? '＋ Item only some people had' : '＋ Shared item (drinks, dishes for the table…)'}
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
                  {s.paysFor.length > 0 && ` · 🤝 pays for ${s.paysFor.join(', ')}`}
                </div>
              </div>
              <div className="end">
                <div className="amt">{s.paidBy ? '—' : fmtMoney(s.pay, cur)}</div>
                {s.paidBy ? (
                  <div className="amt2">🤝 {s.paidBy} pays</div>
                ) : (
                  s.paysFor.length > 0 && <div className="amt2">own {fmtMoney(s.own, cur)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {r.roundingDiff !== 0 && (
          <div className="tiny muted mb">
            Rounding: shares add up to {fmtMoney(r.roundingDiff, cur, { sign: true })} versus the bill.
          </div>
        )}

        <PayersSection b={b} r={r} plan={plan} update={update} />

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
            <Field label="🤝 Who pays for them?">
              <div className="chips">
                <button
                  className={`chip ${!personEdit.paidById ? 'on' : ''}`}
                  onClick={() => setPersonEdit({ ...personEdit, paidById: undefined })}
                >
                  They pay their own
                </button>
                {b.people
                  .filter((p) => p.id !== personEdit.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      className={`chip ${personEdit.paidById === p.id ? 'on' : ''}`}
                      onClick={() => setPersonEdit({ ...personEdit, paidById: p.id })}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
              <div className="tiny muted mt">
                E.g. a friend pays for his wife: her whole share is added to his, and she owes nobody.
              </div>
            </Field>
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
