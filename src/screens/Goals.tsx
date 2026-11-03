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
import { accountValue } from '../domain/balances';
import { fmtDate, fmtMonth } from '../domain/dates';
import { goalStatus, type Goal } from '../domain/goals';
import { fmtMoney } from '../domain/money';
import { db, uid } from '../db/db';
import { deleteGoal, saveGoal } from '../db/repo';
import { useApp, useData } from '../state/app';
import { EMOJI_CHOICES } from '../ui/emoji';
import { ProfileSwitch } from './Home';

const COLOURS = ['pink', 'mint', 'lav', 'peach', 'butter', 'sky'];

function GoalSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { toast, confirm } = useApp();
  const data = useData();
  const [g, setG] = useState<Goal>(goal);
  const [curOpen, setCurOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
      <Field label="Saved so far comes from">
        <Seg
          value={g.source}
          onChange={(v) => setG({ ...g, source: v })}
          options={[
            { v: 'manual', label: '✍️ I type it' },
            { v: 'account', label: '🔗 An account' },
          ]}
        />
      </Field>
      {g.source === 'manual' ? (
        <Field label="Saved so far">
          <AmountField value={g.saved} onChange={(v) => setG({ ...g, saved: v })} currency={g.currency} />
        </Field>
      ) : (
        <Field label="Linked account" hint="Its balance counts as saved for this target.">
          <AccountPickerButton accounts={data.accounts} value={g.accountId} onChange={(v) => setG({ ...g, accountId: v })} />
        </Field>
      )}
      <Field label="I’ll save each month">
        <AmountField
          value={g.monthly || null}
          onChange={(v) => setG({ ...g, monthly: v })}
          currency={g.currency}
          placeholder="e.g. 3,000"
        />
      </Field>
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
            await deleteGoal(g.id);
            onClose();
          }}
        >
          Delete
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            if (!g.name.trim()) return toast('Give it a name 🎯');
            await saveGoal({ ...g, name: g.name.trim() });
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
  const { profile, today, rates, currency, toast } = useApp();
  const data = useData();
  const goals = useLiveQuery(() => db.goals.where('profileId').equals(profile.id).toArray(), [profile.id]);
  const [edit, setEdit] = useState<Goal | null>(null);
  const [addFor, setAddFor] = useState<Goal | null>(null);
  const [addAmount, setAddAmount] = useState<number | null>(null);
  const list = (goals ?? []).slice().sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);

  const savedFor = (g: Goal): number => {
    if (g.source === 'account' && g.accountId) {
      const a = data.accountById.get(g.accountId);
      if (!a) return 0;
      return accountValue(a, data.balances.get(a.id) ?? 0, rates, g.currency) ?? 0;
    }
    return g.saved;
  };

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
          const acc = g.source === 'account' && g.accountId ? data.accountById.get(g.accountId) : undefined;
          return (
            <div key={g.id} className="card" style={{ opacity: g.done ? 0.6 : 1 }}>
              <button
                style={{ border: 'none', background: 'none', padding: 0, width: '100%', textAlign: 'left' }}
                onClick={() => setEdit(g)}
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
                      {acc ? ` · from ${acc.name}` : ''}
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
              {g.source === 'manual' && !g.done && (
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
                await saveGoal({ ...addFor, saved: addFor.saved + addAmount });
                toast(`🐷 +${fmtMoney(addAmount, addFor.currency)}`);
                setAddFor(null);
              }}
            >
              Add
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
