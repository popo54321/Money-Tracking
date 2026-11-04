import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import {
  AccountPickerButton,
  AmountField,
  CurrencySheet,
  Field,
  ProgressBar,
  Seg,
  Sheet,
  ToggleRow,
  Topbar,
  Sparkle,
  SkinName,
} from '../components/ui';
import { fmtDate, fmtMonth } from '../domain/dates';
import { goalSaved, goalStatus, type Goal } from '../domain/goals';
import { splitView } from '../domain/splits';
import { fmtMoney } from '../domain/money';
import { db, uid } from '../db/db';
import { deleteGoal, saveGoal } from '../db/repo';
import { useApp, useData } from '../state/app';
import { EMOJI_CHOICES } from '../ui/emoji';
import { ProfileSwitch } from './Home';
import { holdProps } from '../components/hold';
import { QuickActions } from '../components/QuickActions';

const COLOURS = ['pink', 'mint', 'lav', 'peach', 'butter', 'sky'];

function GoalSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { toast, confirm, removeWithUndo } = useApp();
  const data = useData();
  const { today } = useApp();
  const [g, setG] = useState<Goal>(goal);
  const [curOpen, setCurOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const isNew = !data.goals.some((x) => x.goal.id === goal.id);
  const [savedNow, setSavedNow] = useState(() => goalSaved(goal, today));
  const [start, setStart] = useState<'capital' | 'part'>('capital');
  const keptIn = g.accountId ? data.accountById.get(g.accountId) : undefined;
  // what the account holds that is not already in a split or another target
  const free = keptIn
    ? Math.max(
        0,
        splitView(
          keptIn,
          data.balances.get(keptIn.id) ?? 0,
          data.txs,
          data.goals.filter((x) => x.goal.id !== g.id),
        ).left,
      )
    : 0;
  return (
    <Sheet open onClose={onClose} title="Saving target">
      <div className="hstack mb">
        <button
          className="icon-btn"
          style={{ width: 52, height: 52, fontSize: 28 }}
          onClick={() => setEmojiOpen(!emojiOpen)}
          aria-label="Choose emoji"
        >
          {g.emoji}
        </button>
        <input
          value={g.name}
          placeholder="What do you want? e.g. New camera"
          onChange={(e) => setG({ ...g, name: e.target.value })}
        />
      </div>
      {emojiOpen && (
        <div className="chips mb">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              className="chip"
              onClick={() => {
                setG({ ...g, emoji: e });
                setEmojiOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="grid2">
        <Field label="Price">
          <AmountField value={g.price || null} onChange={(v) => setG({ ...g, price: v })} currency={g.currency} />
        </Field>
        <Field label="Currency">
          <button type="button" className="amount-field" onClick={() => setCurOpen(true)}>
            {g.currency} <span className="cur">▾</span>
          </button>
        </Field>
      </div>
      <Field label="Kept in (optional)" hint="The account the money sits in. It shows in that account's split.">
        <div className="hstack">
          <div className="grow">
            <AccountPickerButton
              accounts={data.accounts.filter((a) => a.type !== 'credit')}
              value={g.accountId}
              placeholder="No account"
              onChange={(v) => setG({ ...g, accountId: v })}
            />
          </div>
          {g.accountId && (
            <button type="button" className="btn sm ghost" onClick={() => setG({ ...g, accountId: undefined })}>
              None
            </button>
          )}
        </div>
      </Field>
      {isNew && keptIn && free > 0 && (
        <Field label={`${keptIn.name} already has ${fmtMoney(free, keptIn.currency)} not set aside`}>
          <Seg
            value={start}
            onChange={(v) => {
              setStart(v);
              setG({ ...g, saved: v === 'capital' ? 0 : Math.min(free, g.price || free) });
            }}
            options={[
              { v: 'capital', label: 'Keep it, start from 0' },
              { v: 'part', label: 'Use part of it' },
            ]}
          />
          {start === 'part' && (
            <div className="mt">
              <AmountField
                value={g.saved || null}
                onChange={(v) => setG({ ...g, saved: Math.min(v ?? 0, free, g.price > 0 ? g.price : Infinity) })}
                currency={g.currency}
                title="Use for this target"
              />
              <div className="tiny muted mt">The rest of the account stays as it is.</div>
            </div>
          )}
        </Field>
      )}
      {!(isNew && keptIn && free > 0) && (
        <Field label={isNew ? 'Already saved' : 'Saved so far'} hint="A record only: your real account never changes.">
          <AmountField value={savedNow} onChange={(v) => setSavedNow(v ?? 0)} currency={g.currency} />
        </Field>
      )}
      <div className="grid2">
        <Field label="I’ll save each month">
          <AmountField
            value={g.monthly || null}
            onChange={(v) => setG({ ...g, monthly: v })}
            currency={g.currency}
            placeholder="e.g. 3,000"
          />
        </Field>
        <Field label="Added on day">
          <select value={g.addDay ?? 1} onChange={(e) => setG({ ...g, addDay: Number(e.target.value) })}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 31 ? '31 (or last day)' : d}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {g.monthly > 0 && (
        <div className="tiny muted mb">
          Each month on day {g.addDay ?? 1}, {fmtMoney(g.monthly, g.currency)} is added to this target by itself until it is full.
        </div>
      )}
      <Field label="Want it by (optional)">
        <input type="date" value={g.targetDate ?? ''} onChange={(e) => setG({ ...g, targetDate: e.target.value || undefined })} />
      </Field>
      <Field label="Note">
        <input
          value={g.note ?? ''}
          onChange={(e) => setG({ ...g, note: e.target.value || undefined })}
          placeholder="Link, shop, colour…"
        />
      </Field>
      <ToggleRow title="🎉 Bought it" on={g.done} onChange={(v) => setG({ ...g, done: v })} />
      <div className="btn-row mt">
        <button
          className="btn danger"
          onClick={async () => {
            if (!(await confirm({ title: `Delete ${g.name || 'this target'}?`, ok: 'Delete', danger: true }))) return;
            await removeWithUndo(() => deleteGoal(g.id));
            onClose();
          }}
        >
          Delete
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            if (!g.name.trim()) return toast('Give it a name 🎯');
            // the record restarts from today: what is saved now, then the monthly saving from the next add day
            const fromAccount = isNew && keptIn && free > 0;
            await saveGoal({
              ...g,
              name: g.name.trim(),
              saved: fromAccount ? g.saved : savedNow,
              countFrom: today,
              source: 'manual',
            });
            toast('🎯 Saved');
            onClose();
          }}
        >
          Save
        </button>
      </div>
      <CurrencySheet
        open={curOpen}
        onClose={() => setCurOpen(false)}
        value={g.currency}
        onPick={(c) => setG({ ...g, currency: c })}
      />
    </Sheet>
  );
}

export function Goals() {
  const { profile, today, currency, toast, confirm, removeWithUndo } = useApp();
  const [quick, setQuick] = useState<Goal | null>(null);
  const data = useData();
  const goals = useLiveQuery(() => db.goals.where('profileId').equals(profile.id).toArray(), [profile.id]);
  const [edit, setEdit] = useState<Goal | null>(null);
  const [addFor, setAddFor] = useState<Goal | null>(null);
  const [addAmount, setAddAmount] = useState<number | null>(null);
  const list = (goals ?? []).slice().sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);

  const savedFor = (g: Goal): number => goalSaved(g, today);

  const create = () =>
    setEdit({
      id: uid(),
      profileId: profile.id,
      name: '',
      emoji: '🎁',
      price: 0,
      currency,
      source: 'manual',
      saved: 0,
      monthly: 0,
      done: false,
      order: list.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

  const active = list.filter((g) => !g.done);
  const totalLeft = active.reduce((s, g) => {
    const st = goalStatus(g, savedFor(g), today);
    return s + (g.currency === currency ? st.remaining : 0);
  }, 0);

  return (
    <>
      <Topbar title={<SkinName k="goals" />} right={<ProfileSwitch />} />
      <div className="page">
        <div className="hero">
          <Sparkle k="goals" />
          <div className="label">Still to save for my wishlist</div>
          <div className="big">{fmtMoney(totalLeft, currency)}</div>
          <div className="small bold">
            {active.length} {active.length === 1 ? 'thing' : 'things'} on the list
          </div>
        </div>
        <button className="btn primary block mb" onClick={create}>
          ＋ Add to wishlist
        </button>
        {goals && goals.length === 0 && (
          <div className="card center small muted">
            <div style={{ fontSize: 40 }}>🌠</div>
            Add something you want, its price, and how much you save each month. See when you can buy it.
          </div>
        )}
        {list.map((g, i) => {
          const st = goalStatus(g, savedFor(g), today);
          const colour = COLOURS[i % COLOURS.length];
          const acc = g.accountId ? data.accountById.get(g.accountId) : undefined;
          return (
            <div key={g.id} className="card" style={{ opacity: g.done ? 0.6 : 1 }}>
              <button
                style={{ border: 'none', background: 'none', padding: 0, width: '100%', textAlign: 'left' }}
                onClick={() => setEdit(g)}
                {...holdProps(() => setQuick(g))}
              >
                <div className="hstack">
                  <div className={`bubble ${colour}`} style={{ width: 48, height: 48, fontSize: 26 }}>
                    {g.emoji}
                  </div>
                  <div className="grow">
                    <div className="bold">
                      {g.name} {g.done ? '🎉' : st.reached ? '✨' : ''}
                    </div>
                    <div className="small muted">
                      {fmtMoney(st.saved, g.currency, { compact: true })} of {fmtMoney(g.price, g.currency, { compact: true })}
                      {acc ? ` · kept in ${acc.name}` : ''}
                    </div>
                  </div>
                  <div className="bold">{Math.round(st.progress * 100)}%</div>
                </div>
                <ProgressBar value={st.progress} colour={st.reached ? 'mint' : 'lav'} />
                <div className="small mt">
                  {g.done
                    ? 'Bought! 🎉'
                    : st.reached
                      ? '✨ You can buy it now!'
                      : st.eta
                        ? `🗓️ At ${fmtMoney(g.monthly, g.currency, { compact: true })} a month: ready in ${fmtMonth(st.eta.slice(0, 7))} (${st.monthsLeft} ${st.monthsLeft === 1 ? 'month' : 'months'})`
                        : 'Set a monthly saving to see when you can buy it'}
                </div>
                {g.targetDate && !st.reached && !g.done && st.neededPerMonth !== null && (
                  <div className={`small ${g.monthly >= st.neededPerMonth ? 'pos' : 'neg'}`}>
                    🎯 For {fmtDate(g.targetDate)}: save {fmtMoney(st.neededPerMonth, g.currency, { compact: true })} a month
                  </div>
                )}
              </button>
              {!g.done && (
                <button
                  className="btn sm mint mt"
                  onClick={() => {
                    setAddFor(g);
                    setAddAmount(g.monthly || null);
                  }}
                >
                  ＋ I saved some
                </button>
              )}
            </div>
          );
        })}
      </div>
      {edit && <GoalSheet key={edit.id} goal={edit} onClose={() => setEdit(null)} />}
      <Sheet open={!!addFor} onClose={() => setAddFor(null)} title={`Add to ${addFor?.name ?? ''}`}>
        {addFor && (
          <>
            <Field label="Amount saved">
              <AmountField value={addAmount} onChange={setAddAmount} currency={addFor.currency} />
            </Field>
            <button
              className="btn primary block"
              onClick={async () => {
                if (!addAmount) return;
                await saveGoal({ ...addFor, saved: goalSaved(addFor, today) + addAmount, countFrom: today });
                toast(`🐷 +${fmtMoney(addAmount, addFor.currency)}`);
                setAddFor(null);
              }}
            >
              Add
            </button>
          </>
        )}
      </Sheet>
      {quick && (
        <QuickActions
          title={quick.name}
          onClose={() => setQuick(null)}
          actions={[
            ...(!quick.done
              ? [
                  {
                    label: '🐷 I saved some',
                    tone: 'mint' as const,
                    run: () => {
                      setAddFor(quick);
                      setAddAmount(quick.monthly || null);
                    },
                  },
                ]
              : []),
            {
              label: quick.done ? '↩️ Not bought yet' : '🎉 Mark as bought',
              tone: 'sky',
              run: async () => {
                // bought: keep the amount as it is now; back on the list: monthly savings start again from today
                await saveGoal({ ...quick, saved: goalSaved(quick, today), countFrom: today, done: !quick.done });
                toast(quick.done ? '↩️ Back on the list' : '🎉 Bought!');
              },
            },
            { label: '✏️ Edit', tone: 'plain', run: () => setEdit(quick) },
            {
              label: '🗑️ Delete',
              tone: 'danger',
              run: async () => {
                if (!(await confirm({ title: `Delete ${quick.name}?`, ok: 'Delete', danger: true }))) return;
                await removeWithUndo(() => deleteGoal(quick.id));
              },
            },
          ]}
        />
      )}
    </>
  );
}
