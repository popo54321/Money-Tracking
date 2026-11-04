import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { AmountField, CurrencySheet, Field, NumberInput, Seg, Sheet, Topbar, Sparkle, Avatar } from '../components/ui';
import { computeTrip, entryBase, type TripResult } from '../domain/tripSplit';
import { rateBetween } from '../domain/fx';
import { fmtMoney, roundTo } from '../domain/money';
import type { Trip, TripEntry, TripMember } from '../domain/types';
import { db, uid } from '../db/db';
import { deleteTrip, recordOwed, saveTrip, type OwedItem } from '../db/repo';
import { todayISO } from '../domain/dates';
import { copyText } from '../services/platform';
import { holdProps } from '../components/hold';
import { QuickActions } from '../components/QuickActions';
import { useApp } from '../state/app';

export function TripList() {
  const { go, profiles, settings, rates, confirm, removeWithUndo } = useApp();
  const [quick, setQuick] = useState<Trip | null>(null);
  const trips = useLiveQuery(() => db.trips.orderBy('updatedAt').reverse().toArray(), []);
  const create = async () => {
    const base = settings.defaultCurrency;
    const rate = (c: string) => roundTo(rateBetween(c, base, rates) ?? 0, 4);
    const t: Trip = {
      id: uid(),
      name: 'New trip',
      baseCurrency: base,
      rates: Object.fromEntries(['CNY', 'EUR', 'USD', 'JPY'].filter((c) => c !== base).map((c) => [c, rate(c)])),
      payBackCurrency: base,
      members: profiles.map((p) => ({ id: uid(), name: p.name })),
      entries: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveTrip(t);
    go({ name: 'trip', id: t.id });
  };
  return (
    <>
      <Topbar title="Travel split 🧳" />
      <div className="page">
        <button className="btn primary block mb" onClick={create}>
          ＋ New trip
        </button>
        {trips && trips.length === 0 && (
          <div className="card center small muted">
            <div style={{ fontSize: 40 }}>✈️</div>
            Log who paid for what in any currency. Mark each bill as shared or personal, and see who pays whom at the end.
          </div>
        )}
        {trips && trips.length > 0 && (
          <div className="list">
            {trips.map((t) => {
              const r = computeTrip(t);
              const s = r.settlements[0];
              return (
                <button
                  key={t.id}
                  className="row"
                  onClick={() => go({ name: 'trip', id: t.id })}
                  {...holdProps(() => setQuick(t))}
                >
                  <div className="bubble butter">🧳</div>
                  <div className="main">
                    <div className="title">{t.name}</div>
                    <div className="sub">
                      {t.members.map((m) => m.name).join(', ')} · {t.entries.length} bills
                      {s ? ` · ${s.fromName} pays ${s.toName}` : r.total ? ' · settled' : ''}
                    </div>
                  </div>
                  <div className="end">
                    <div className="amt">{fmtMoney(r.total, t.baseCurrency, { compact: true })}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {quick && (
        <QuickActions
          title={quick.name || 'Trip'}
          onClose={() => setQuick(null)}
          actions={[
            { label: '✏️ Open', tone: 'plain', run: () => go({ name: 'trip', id: quick.id }) },
            {
              label: '🧳 New trip with the same people',
              tone: 'mint',
              run: async () => {
                const copy: Trip = {
                  ...quick,
                  id: uid(),
                  name: 'New trip',
                  entries: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await saveTrip(copy);
                go({ name: 'trip', id: copy.id });
              },
            },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: `Delete ${quick.name || 'this trip'}?`, ok: 'Delete', danger: true }))) return;
                await removeWithUndo(() => deleteTrip(quick.id));
              },
            },
          ]}
        />
      )}
    </>
  );
}

function EntrySheet({
  trip,
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  trip: Trip;
  entry: TripEntry | null;
  onSave: (e: TripEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [e, setE] = useState<TripEntry | null>(entry);
  const [curOpen, setCurOpen] = useState(false);
  useEffect(() => setE(entry), [entry]);
  if (!e) return null;
  const isNew = !trip.entries.some((x) => x.id === e.id);
  const base = entryBase(trip, e);
  const sharedBy = e.sharedBy ?? [];
  return (
    <Sheet open={!!entry} onClose={onClose} title={isNew ? 'Add bill' : 'Edit bill'}>
      <Field label="What for">
        <input value={e.bill} placeholder="e.g. Hotel, Xiamen" onChange={(x) => setE({ ...e, bill: x.target.value })} />
      </Field>
      <Field label="Who paid">
        <div className="chips">
          {trip.members.map((m) => (
            <button key={m.id} className={`chip ${e.payerId === m.id ? 'on' : ''}`} onClick={() => setE({ ...e, payerId: m.id })}>
              {m.name}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid2">
        <Field label="Cost">
          <AmountField value={e.cost || null} onChange={(v) => setE({ ...e, cost: v })} currency={e.currency} />
        </Field>
        <Field label="Currency">
          <button type="button" className="amount-field" onClick={() => setCurOpen(true)}>
            {e.currency} <span className="cur">▾</span>
          </button>
        </Field>
      </div>
      <div className="tiny muted mb">
        {base === null ? `Add a rate for ${e.currency} in the trip’s rates.` : `= ${fmtMoney(base, trip.baseCurrency)}`}
      </div>
      <Field label="Split">
        <Seg
          value={e.split}
          onChange={(v) =>
            setE({
              ...e,
              split: v,
              sharedBy: v === 'some' ? (sharedBy.length ? sharedBy : trip.members.map((m) => m.id)) : undefined,
            })
          }
          options={[
            { v: 'all', label: '👯 Everyone' },
            { v: 'some', label: '☑️ Some' },
            { v: 'none', label: '🙋 Personal' },
          ]}
        />
      </Field>
      {e.split === 'some' && (
        <div className="chips mb">
          {trip.members.map((m) => {
            const on = sharedBy.includes(m.id);
            return (
              <button
                key={m.id}
                className={`chip mint ${on ? 'on' : ''}`}
                onClick={() => setE({ ...e, sharedBy: on ? sharedBy.filter((x) => x !== m.id) : [...sharedBy, m.id] })}
              >
                {on ? '✓ ' : ''}
                {m.name}
              </button>
            );
          })}
        </div>
      )}
      <Field label="Date (optional)">
        <input type="date" value={e.date ?? ''} onChange={(x) => setE({ ...e, date: x.target.value || undefined })} />
      </Field>
      <div className="btn-row">
        {!isNew && (
          <button className="btn danger" onClick={() => onDelete(e.id)}>
            Delete
          </button>
        )}
        <button className="btn primary" onClick={() => onSave(e)} disabled={!e.cost}>
          Save
        </button>
      </div>
      <CurrencySheet
        open={curOpen}
        onClose={() => setCurOpen(false)}
        value={e.currency}
        onPick={(c) => setE({ ...e, currency: c })}
        extra={Object.keys(trip.rates)}
      />
    </Sheet>
  );
}

/** Put what friends still owe me from this trip (or what I owe them) into Who owes me. */
function TripOwedButton({ t, settlements }: { t: Trip; settlements: TripResult['settlements'] }) {
  const { profile, toast, go } = useApp();
  const guess = t.members.find((m) => m.name.trim().toLowerCase() === profile.name.trim().toLowerCase())?.id;
  const [meId, setMeId] = useState<string | undefined>(guess);
  const [added, setAdded] = useState(false);
  if (settlements.length === 0) return null;
  const mine: OwedItem[] = meId
    ? settlements
        .filter((s) => s.toId === meId || s.fromId === meId)
        .map((s) => {
          const theyOweMe = s.toId === meId;
          return {
            person: theyOweMe ? s.fromName : s.toName,
            direction: theyOweMe ? ('owedToMe' as const) : ('iOwe' as const),
            amount: roundTo(s.payBack, 2),
            currency: t.payBackCurrency,
            date: todayISO(),
            note: t.name || 'Trip',
            key: `trip:${t.id}:${theyOweMe ? s.fromId : s.toId}:${theyOweMe ? 'in' : 'out'}`,
          };
        })
    : [];
  return (
    <div className="card">
      <div className="field">
        <div className="label">Which one is you?</div>
        <div className="chips">
          {t.members.map((m) => (
            <button
              key={m.id}
              className={`chip ${meId === m.id ? 'on' : ''}`}
              onClick={() => {
                setMeId(m.id);
                setAdded(false);
              }}
            >
              {m.name}
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
    </div>
  );
}

export function TripEdit({ id }: { id: string }) {
  const { back, confirm, toast, rates, removeWithUndo } = useApp();
  const stored = useLiveQuery(() => db.trips.get(id), [id]);
  const [t, setT] = useState<Trip | null>(null);
  const [entry, setEntry] = useState<TripEntry | null>(null);
  const [quickEntry, setQuickEntry] = useState<TripEntry | null>(null);
  const [newName, setNewName] = useState('');
  const [member, setMember] = useState<TripMember | null>(null);
  const [rateCur, setRateCur] = useState(false);
  const [payCur, setPayCur] = useState(false);
  const [baseCur, setBaseCur] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (stored && !t) setT(stored);
  }, [stored, t]);
  if (!t) return <Topbar title="Trip" />;

  const update = (patch: Partial<Trip>) => {
    const next = { ...t, ...patch };
    setT(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveTrip(next), 300);
  };
  const r = computeTrip(t);
  const base = t.baseCurrency;
  const pay = t.payBackCurrency;
  const nameOf = (mid: string) => t.members.find((m) => m.id === mid)?.name ?? '?';

  const addMember = () => {
    const name = newName.trim();
    if (!name) return;
    update({ members: [...t.members, { id: uid(), name }] });
    setNewName('');
  };

  const liveRate = (c: string) => roundTo(rateBetween(c, base, rates) ?? 0, 4);

  return (
    <>
      <Topbar
        title={t.name || 'Trip'}
        right={
          <button
            className="icon-btn"
            aria-label="Delete trip"
            onClick={async () => {
              if (!(await confirm({ title: `Delete ${t.name}?`, ok: 'Delete', danger: true }))) return;
              await removeWithUndo(() => deleteTrip(t.id));
              back();
            }}
          >
            🗑️
          </button>
        }
      />
      <div className="page">
        <Field label="Trip name">
          <input value={t.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Xiamen / China" />
        </Field>

        <div className="section-title">👯 Travellers ({t.members.length})</div>
        <div className="chips mb">
          {t.members.map((m) => (
            <button key={m.id} className="chip" onClick={() => setMember(m)}>
              <Avatar name={m.name} /> {m.name}
            </button>
          ))}
        </div>
        <div className="hstack mb">
          <input
            placeholder="Add a traveller"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
          />
          <button className="btn" onClick={addMember}>
            ＋
          </button>
        </div>

        <div className="card">
          <div className="between">
            <h2 style={{ margin: 0 }}>💱 Rates → {base}</h2>
            <button className="btn sm ghost" onClick={() => setBaseCur(true)}>
              Change {base}
            </button>
          </div>
          <div className="tiny muted mb">
            Fixed for this trip so totals don’t move. Filled from live rates; change them to match your card.
          </div>
          {Object.entries(t.rates).map(([c, v]) => (
            <div key={c} className="item-line">
              <span className="bold" style={{ width: 52 }}>
                1 {c}
              </span>
              <span>=</span>
              <div className="grow">
                <NumberInput className="inline-input" value={v} onChange={(x) => update({ rates: { ...t.rates, [c]: x } })} />
              </div>
              <span className="small">{base}</span>
              <button
                className="btn sm ghost"
                aria-label="Use live rate"
                onClick={() => update({ rates: { ...t.rates, [c]: liveRate(c) } })}
              >
                ↻
              </button>
              <button
                className="btn sm ghost"
                aria-label="Remove currency"
                onClick={() => {
                  const next = { ...t.rates };
                  delete next[c];
                  update({ rates: next });
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn sm mt" onClick={() => setRateCur(true)}>
            ＋ Currency
          </button>
        </div>

        <div className="section-title">
          🧾 Bills ({t.entries.length}) <span className="grow" />
          <span className="small">{fmtMoney(r.total, base)}</span>
        </div>
        {t.entries.length > 0 && (
          <div className="list">
            {t.entries.map((e) => {
              const amt = entryBase(t, e);
              const splitText =
                e.split === 'none'
                  ? 'personal'
                  : e.split === 'all'
                    ? 'shared by all'
                    : `shared by ${(e.sharedBy ?? []).map(nameOf).join(', ')}`;
              return (
                <button key={e.id} className="row" onClick={() => setEntry(e)} {...holdProps(() => setQuickEntry(e))}>
                  <Avatar name={nameOf(e.payerId)} />
                  <div className="main">
                    <div className="title">{e.bill || 'Bill'}</div>
                    <div className="sub">
                      {nameOf(e.payerId)} paid · {splitText}
                    </div>
                  </div>
                  <div className="end">
                    <div className="amt">{fmtMoney(e.cost, e.currency)}</div>
                    {e.currency !== base && <div className="amt2">{amt === null ? 'no rate' : fmtMoney(amt, base)}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <button
          className="btn primary block mb"
          disabled={t.members.length === 0}
          onClick={() =>
            setEntry({
              id: uid(),
              payerId: t.members[0]?.id ?? '',
              bill: '',
              cost: 0,
              currency: t.entries[t.entries.length - 1]?.currency ?? base,
              split: 'all',
            })
          }
        >
          ＋ Add bill
        </button>

        {r.missingRates.length > 0 && (
          <div className="banner pink">
            <span>⚠️</span>
            <span className="grow">No rate for {r.missingRates.join(', ')}; those bills are left out.</span>
          </div>
        )}

        <div className="hero">
          <Sparkle k="trips" />
          <div className="label">Settle up</div>
          {r.settlements.length === 0 ? (
            <div className="big" style={{ fontSize: 24 }}>
              All settled ✨
            </div>
          ) : (
            r.settlements.map((s) => (
              <div key={`${s.fromId}-${s.toId}`} className="bold" style={{ fontSize: 20, margin: '4px 0' }}>
                {s.fromName} pays {s.toName} {fmtMoney(s.payBack, pay)}
              </div>
            ))
          )}
          <button className="btn sm mt" onClick={() => setPayCur(true)}>
            Pay back in {pay} ▾
          </button>
        </div>
        <TripOwedButton t={t} settlements={r.settlements} />

        <div className="card">
          <table className="t">
            <tbody>
              <tr>
                <td>Trip total</td>
                <td>{fmtMoney(r.total, base)}</td>
              </tr>
              <tr>
                <td>Shared total</td>
                <td>{fmtMoney(r.sharedTotal, base)}</td>
              </tr>
            </tbody>
          </table>
          <table className="t mt">
            <thead>
              <tr>
                <th>Who</th>
                <th>Paid shared</th>
                <th>Their share</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {r.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{fmtMoney(m.paidShared, base, { compact: true })}</td>
                  <td>{fmtMoney(m.share, base, { compact: true })}</td>
                  <td className={m.net > 0.005 ? 'pos' : m.net < -0.005 ? 'neg' : ''}>
                    {fmtMoney(m.net, base, { compact: true, sign: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted mt">
            Personal (not split): {r.members.map((m) => `${m.name} ${fmtMoney(m.personal, base, { compact: true })}`).join(' · ')}
          </div>
        </div>
        <button
          className="btn sky block"
          onClick={async () => {
            const lines = [`🧳 ${t.name}`, `Total ${fmtMoney(r.total, base)} · shared ${fmtMoney(r.sharedTotal, base)}`];
            for (const s of r.settlements) lines.push(`${s.fromName} pays ${s.toName} ${fmtMoney(s.payBack, pay)}`);
            if (!r.settlements.length) lines.push('All settled ✨');
            const ok = await copyText(lines.join('\n'));
            toast(ok ? '📋 Copied' : 'Could not copy');
          }}
        >
          📋 Copy summary
        </button>
      </div>

      <EntrySheet
        trip={t}
        entry={entry}
        onClose={() => setEntry(null)}
        onSave={(e) => {
          const exists = t.entries.some((x) => x.id === e.id);
          const rates2 =
            !e.currency || e.currency === base || t.rates[e.currency]
              ? t.rates
              : { ...t.rates, [e.currency]: liveRate(e.currency) };
          update({ entries: exists ? t.entries.map((x) => (x.id === e.id ? e : x)) : [...t.entries, e], rates: rates2 });
          setEntry(null);
        }}
        onDelete={(eid) => {
          update({ entries: t.entries.filter((x) => x.id !== eid) });
          setEntry(null);
        }}
      />
      <Sheet open={!!member} onClose={() => setMember(null)} title="Traveller">
        {member && (
          <>
            <Field label="Name">
              <input value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} />
            </Field>
            <div className="btn-row">
              <button
                className="btn danger"
                onClick={async () => {
                  const used = t.entries.some((e) => e.payerId === member.id);
                  if (
                    used &&
                    !(await confirm({
                      title: `Remove ${member.name}?`,
                      message: 'Bills they paid will be removed too.',
                      ok: 'Remove',
                      danger: true,
                    }))
                  )
                    return;
                  update({
                    members: t.members.filter((m) => m.id !== member.id),
                    entries: t.entries
                      .filter((e) => e.payerId !== member.id)
                      .map((e) => ({ ...e, sharedBy: e.sharedBy?.filter((x) => x !== member.id) })),
                  });
                  setMember(null);
                }}
              >
                Remove
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  update({
                    members: t.members.map((m) => (m.id === member.id ? { ...member, name: member.name.trim() || m.name } : m)),
                  });
                  setMember(null);
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </Sheet>
      <CurrencySheet
        open={rateCur}
        onClose={() => setRateCur(false)}
        onPick={(c) => c !== base && update({ rates: { ...t.rates, [c]: liveRate(c) } })}
      />
      <CurrencySheet
        open={payCur}
        onClose={() => setPayCur(false)}
        value={pay}
        onPick={(c) =>
          update({ payBackCurrency: c, rates: c === base || t.rates[c] ? t.rates : { ...t.rates, [c]: liveRate(c) } })
        }
      />
      <CurrencySheet
        open={baseCur}
        onClose={() => setBaseCur(false)}
        value={base}
        onPick={(c) => {
          if (c === base) return;
          // re-express every rate in the new main currency
          const next: Record<string, number> = {};
          for (const k of new Set([...Object.keys(t.rates), base])) if (k !== c) next[k] = liveRate2(k, c);
          update({ baseCurrency: c, rates: next });
          function liveRate2(from: string, to: string) {
            return roundTo(rateBetween(from, to, rates) ?? 0, 4);
          }
        }}
      />
      {quickEntry && (
        <QuickActions
          title={quickEntry.bill || 'Bill'}
          onClose={() => setQuickEntry(null)}
          actions={[
            { label: '✏️ Edit', tone: 'plain', run: () => setEntry(quickEntry) },
            { label: '📄 Duplicate', tone: 'mint', run: () => update({ entries: [...t.entries, { ...quickEntry, id: uid() }] }) },
            {
              label: quickEntry.split === 'none' ? '👯 Make it shared by everyone' : '🙋 Make it personal',
              tone: 'sky',
              run: () =>
                update({
                  entries: t.entries.map((x) =>
                    x.id === quickEntry.id ? { ...x, split: x.split === 'none' ? 'all' : 'none', sharedBy: undefined } : x,
                  ),
                }),
            },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: `Delete ${quickEntry.bill || 'this bill'}?`, ok: 'Delete', danger: true }))) return;
                update({ entries: t.entries.filter((x) => x.id !== quickEntry.id) });
              },
            },
          ]}
        />
      )}
    </>
  );
}
