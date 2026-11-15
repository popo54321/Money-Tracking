import { useState } from 'react';
import { AccountPickerButton, AmountField, CurrencySheet, Field, NumberInput, Sheet, ToggleRow, Topbar } from '../components/ui';
import { isLiquid, walletsByAccount } from '../domain/balances';
import { accountGroupsOf, ACCOUNT_TYPES, WALLET_TYPES, type Account, type AccountType } from '../domain/types';
import { fmtMoney } from '../domain/money';
import { db, uid } from '../db/db';
import {
  accountTxCount,
  deleteAccountCascade,
  renameAccountGroup,
  saveAccount,
  saveAccountGroups,
  setAccountBalance,
} from '../db/repo';
import { useApp, useData } from '../state/app';
import { accountEmoji } from '../ui/emoji';

export function AccountEdit({ id }: { id?: string }) {
  const { profile, back, replace, toast, confirm, today, tab, removeWithUndo, rates, currency } = useApp();
  const data = useData();
  const existing = id ? data.accountById.get(id) : undefined;
  const [a, setA] = useState<Account>(
    () =>
      existing ?? {
        id: uid(),
        profileId: profile.id,
        name: '',
        type: 'bank',
        group: 'Bank',
        currency: 'THB',
        openingBalance: 0,
        openingDate: today,
        includeInNetWorth: true,
        archived: false,
        order: data.accounts.length,
      },
  );
  const [curOpen, setCurOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const canWallets = WALLET_TYPES.has(a.type);
  const heldIn = (c: string) => data.wallets.get(a.id)?.get(c) ?? 0;
  /** Remove a currency: straight away when empty; with money in it, ask twice (buttons swap sides). */
  const removeWallet = async (c: string) => {
    const bal = heldIn(c);
    if (Math.abs(bal) > 1e-9) {
      const first = await confirm({
        title: `Remove ${c}?`,
        message: `${fmtMoney(bal, c)} is still in it. Removing it records that money as gone from ${a.name || 'this account'}.`,
        ok: 'Remove',
        danger: true,
      });
      if (!first) return;
      const sure = await confirm({
        title: 'Are you really sure?',
        message: `${fmtMoney(bal, c)} will no longer count anywhere.`,
        ok: `Yes, remove ${c}`,
        cancel: 'Keep it',
        danger: true,
        swap: true,
      });
      if (!sure) return;
    }
    set({ wallets: (a.wallets ?? []).filter((x) => x !== c) });
  };
  const set = (patch: Partial<Account>) => setA((x) => ({ ...x, ...patch }));
  const isCard = a.type === 'credit';
  const hasEntries = !!existing && data.allTxs.some((t) => t.accountId === a.id || t.toAccountId === a.id);

  const [groupsOpen, setGroupsOpen] = useState(false);
  const groups = accountGroupsOf(profile, [...data.accounts.filter((x) => x.id !== a.id), a]);
  const pickType = (t: AccountType) => {
    const def = ACCOUNT_TYPES.find((x) => x.type === t)!;
    // the type's usual group, if this user has it; otherwise keep the group chosen
    const patch: Partial<Account> = { type: t, group: groups.includes(def.defaultGroup) ? def.defaultGroup : a.group };
    if (t === 'crypto') patch.currency = 'BTC';
    else if (t === 'units') {
      patch.currency = a.currency === 'BTC' || a.currency.length === 3 ? 'baht-weight' : a.currency;
      patch.unitPriceCurrency = a.unitPriceCurrency ?? 'THB';
      patch.unitPriceSource = a.unitPriceSource ?? 'live-gold';
    } else if (a.currency === 'BTC' || a.currency.length !== 3) patch.currency = 'THB';
    set(patch);
  };

  const save = async () => {
    if (!a.name.trim()) {
      toast('Give it a name 🌼');
      return;
    }
    if (a.type === 'units' && !a.currency.trim()) {
      toast('Give the unit a name, e.g. baht-weight');
      return;
    }
    // keep any order change made with the ▲▼ buttons while this form was open
    const stored = existing ? await db.accounts.get(a.id) : undefined;
    // a removed currency that still held money: record it going to 0, so the history explains it
    if (stored) {
      const txs = [
        ...(await db.txs.where('accountId').equals(a.id).toArray()),
        ...(await db.txs.where('toAccountId').equals(a.id).toArray()),
      ];
      const held = walletsByAccount([stored], txs).get(a.id);
      const kept = WALLET_TYPES.has(a.type) ? (a.wallets ?? []) : [];
      for (const [c, bal] of held ?? [])
        if (!kept.includes(c) && Math.abs(bal) > 1e-9)
          await setAccountBalance({
            account: stored,
            pocket: c,
            newBalance: 0,
            mode: 'adjust',
            date: today,
            note: `${c} removed`,
            rates,
            defaultCurrency: currency,
          });
    }
    await saveAccount({
      ...a,
      name: a.name.trim(),
      order: stored?.order ?? a.order,
      wallets: WALLET_TYPES.has(a.type) && a.wallets?.length ? a.wallets.filter((c) => c !== a.currency) : undefined,
    });
    toast(existing ? '✨ Saved' : '🎉 Account added');
    if (existing) back();
    else replace({ name: 'account', id: a.id });
  };

  const remove = async () => {
    if (!existing) return;
    const n = await accountTxCount(existing.id);
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: n
        ? `This also deletes its ${n} ${n === 1 ? 'entry' : 'entries'} and any repeating entries that use it. Archive it instead to keep history.`
        : 'It has no entries.',
      ok: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await removeWithUndo(() => deleteAccountCascade(existing.id));
    tab('accounts');
  };

  const others = data.accounts.filter((x) => x.id !== a.id && x.type !== 'credit');

  return (
    <>
      <Topbar title={existing ? 'Edit account' : 'New account'} />
      <div className="page">
        <Field label="Name">
          <input
            value={a.name}
            placeholder="e.g. Kbank savings"
            onChange={(e) => set({ name: e.target.value })}
            autoFocus={!existing}
          />
        </Field>

        <Field label="Type">
          <div className="chips">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                className={`chip ${a.type === t.type ? 'on' : ''}`}
                onClick={() => pickType(t.type)}
                disabled={hasEntries && (t.type === 'crypto') !== (a.type === 'crypto')}
              >
                {accountEmoji(t.type)} {t.label}
              </button>
            ))}
          </div>
        </Field>

        {a.type === 'units' ? (
          <div className="grid2">
            <Field label="Unit name">
              <input value={a.currency} onChange={(e) => set({ currency: e.target.value })} placeholder="baht-weight" />
            </Field>
            <Field label="Price currency">
              <button type="button" className="amount-field" onClick={() => setCurOpen(true)}>
                {a.unitPriceCurrency || 'THB'} <span className="cur">▾</span>
              </button>
            </Field>
          </div>
        ) : a.type !== 'crypto' ? (
          <Field label="Currency" hint={hasEntries ? 'Currency can’t change once there are entries.' : undefined}>
            <button type="button" className="amount-field" disabled={hasEntries} onClick={() => setCurOpen(true)}>
              {a.currency} <span className="cur">▾</span>
            </button>
          </Field>
        ) : (
          <div className="banner sky">
            <span>🪙</span>
            <span className="grow">Amounts are in BTC. The value uses the live BTC price.</span>
          </div>
        )}

        {canWallets && (
          <Field
            label="Other currencies held"
            hint="For travel money: each currency keeps its own balance. Bills, splits and targets stay in the main one."
          >
            <div className="chips">
              {(a.wallets ?? []).map((c) => (
                <button key={c} type="button" className="chip on" onClick={() => removeWallet(c)} aria-label={`Remove ${c}`}>
                  {c}
                  {existing && Math.abs(heldIn(c)) > 1e-9 ? ` · ${fmtMoney(heldIn(c), c, { compact: true })}` : ''} ✕
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setWalletOpen(true)}>
                ＋ Add currency
              </button>
            </div>
          </Field>
        )}

        {a.type === 'units' && (
          <ToggleRow
            title="🥇 Thai gold, live price (ทองบาทละ)"
            desc="Valued at today’s 96.5% gold bar price per baht-weight"
            on={a.unitPriceSource === 'live-gold'}
            onChange={(v) =>
              set({
                unitPriceSource: v ? 'live-gold' : 'manual',
                ...(v ? { currency: 'baht-weight', unitPriceCurrency: 'THB' } : {}),
              })
            }
          />
        )}
        {a.type === 'units' && a.unitPriceSource !== 'live-gold' && (
          <Field label={`Price of 1 ${a.currency || 'unit'}`} hint="Update it whenever you like from the account page.">
            <AmountField
              value={a.unitPrice ?? null}
              onChange={(v) => set({ unitPrice: v, unitPriceUpdatedAt: Date.now() })}
              currency={a.unitPriceCurrency || 'THB'}
            />
          </Field>
        )}

        {!existing && (
          <Field
            label={isCard ? 'Amount owed now' : `Balance now (${a.currency})`}
            hint="You can change it any time with “Set new balance”."
          >
            <AmountField
              value={isCard ? -a.openingBalance : a.openingBalance}
              onChange={(v) => set({ openingBalance: isCard ? -v : v })}
              currency={a.currency}
              allowNegative={!isCard}
            />
          </Field>
        )}

        {isCard && (
          <div className="card flat">
            <h2>💳 Card details</h2>
            <Field label="Credit limit">
              <AmountField
                value={a.creditLimit ?? null}
                onChange={(v) => set({ creditLimit: v || undefined })}
                currency={a.currency}
              />
            </Field>
            <div className="grid2">
              <Field label="Statement day" hint="Day of month the bill is made">
                <NumberInput
                  value={a.statementDay ?? null}
                  onChange={(v) => set({ statementDay: v ? Math.min(31, Math.max(1, Math.round(v))) : undefined })}
                  placeholder="e.g. 25"
                />
              </Field>
              <Field label="Payment due day" hint="Day of month to pay by">
                <NumberInput
                  value={a.dueDay ?? null}
                  onChange={(v) => set({ dueDay: v ? Math.min(31, Math.max(1, Math.round(v))) : undefined })}
                  placeholder="e.g. 10"
                />
              </Field>
            </div>
            <Field label="Usually paid from" hint="This account sets aside what the card owes until it’s paid.">
              <AccountPickerButton
                accounts={others}
                value={a.payFromAccountId}
                onChange={(v) => set({ payFromAccountId: v })}
                placeholder="Choose account"
              />
            </Field>
          </div>
        )}

        <div className="card flat">
          <h2>Extra details</h2>
          <Field label="Group" hint="Accounts are listed under their group. Add your own or tidy the list.">
            <div className="chips">
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`chip lav ${a.group === g ? 'on' : ''}`}
                  onClick={() => set({ group: g })}
                >
                  {g}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setGroupsOpen(true)}>
                ✏️ Edit groups
              </button>
            </div>
          </Field>
          {groupsOpen && (
            <GroupsSheet
              groups={groups}
              selected={a.group}
              onClose={() => setGroupsOpen(false)}
              onPick={(g) => set({ group: g })}
            />
          )}

          <Field label="Note">
            <input value={a.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="Optional" />
          </Field>
          <ToggleRow title="Count in net worth" on={a.includeInNetWorth} onChange={(v) => set({ includeInNetWorth: v })} />
          <ToggleRow
            title="💧 Liquid money"
            desc="Can be spent now. Counts in the liquid total next to net worth."
            on={isLiquid(a)}
            onChange={(v) => set({ liquid: v })}
          />
          {existing && (
            <ToggleRow
              title="Archived"
              desc="Hidden from lists, history kept"
              on={a.archived}
              onChange={(v) => set({ archived: v })}
            />
          )}
        </div>

        <div className="save-bar">
          <button className="btn primary block" onClick={save}>
            {existing ? 'Save' : 'Add account'}
          </button>
        </div>
        {existing && (
          <button className="btn danger block mt" onClick={remove}>
            Delete account
          </button>
        )}
        {existing && (
          <div className="tiny muted center mt">
            Added {a.openingDate}. Order in lists: <OrderButtons id={a.id} />
          </div>
        )}
      </div>
      <CurrencySheet
        open={curOpen}
        onClose={() => setCurOpen(false)}
        value={a.type === 'units' ? a.unitPriceCurrency : a.currency}
        onPick={(c) => (a.type === 'units' ? set({ unitPriceCurrency: c }) : set({ currency: c }))}
      />
      <CurrencySheet
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        value={undefined}
        onPick={(c) => {
          if (c === a.currency || (a.wallets ?? []).includes(c)) return toast(`${c} is already held`);
          set({ wallets: [...(a.wallets ?? []), c] });
        }}
      />
    </>
  );
}

function OrderButtons({ id }: { id: string }) {
  const data = useData();
  const move = async (dir: -1 | 1) => {
    const list = data.accounts.slice();
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.transaction('rw', db.accounts, async () => {
      for (let k = 0; k < list.length; k++) await db.accounts.update(list[k].id, { order: k });
    });
  };
  return (
    <>
      <button className="btn sm ghost" onClick={() => move(-1)}>
        ▲ up
      </button>
      <button className="btn sm ghost" onClick={() => move(1)}>
        ▼ down
      </button>
    </>
  );
}

/** Add, rename and remove account groups. A group with accounts in it can be renamed but not removed. */
function GroupsSheet({
  groups,
  selected,
  onClose,
  onPick,
}: {
  groups: string[];
  selected: string;
  onClose: () => void;
  onPick: (g: string) => void;
}) {
  const { profile, toast } = useApp();
  const data = useData();
  const [list, setList] = useState(groups);
  const [names, setNames] = useState<Record<string, string>>({});
  const [added, setAdded] = useState('');
  const inUse = (g: string) => data.accounts.filter((x) => x.group === g).length;
  const save = async (next: string[]) => {
    setList(next);
    await saveAccountGroups(profile.id, next);
  };
  return (
    <Sheet open onClose={onClose} title="✏️ Account groups">
      <div className="list mb">
        {list.map((g) => {
          const real = inUse(g);
          const n = real + (g === selected && real === 0 ? 1 : 0);
          const typed = names[g] ?? g;
          return (
            <div key={g} className="row" style={{ gap: 8 }}>
              <input
                className="grow"
                value={typed}
                onChange={(e) => setNames({ ...names, [g]: e.target.value })}
                onBlur={async () => {
                  const to = typed.trim();
                  if (!to || to === g) return setNames({ ...names, [g]: g });
                  if (list.includes(to)) {
                    toast('That group already exists');
                    return setNames({ ...names, [g]: g });
                  }
                  await renameAccountGroup(profile.id, g, to, list);
                  setList(list.map((x) => (x === g ? to : x)));
                  if (selected === g) onPick(to);
                  setNames({});
                }}
                aria-label={`Rename ${g}`}
              />
              {n > 0 ? (
                <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                  {real === 0 ? 'this account' : `${n} ${n === 1 ? 'account' : 'accounts'}`}
                </span>
              ) : (
                <button className="btn sm ghost" aria-label={`Remove ${g}`} onClick={() => save(list.filter((x) => x !== g))}>
                  🗑️
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="hstack">
        <input className="grow" value={added} onChange={(e) => setAdded(e.target.value)} placeholder="New group, e.g. Savings" />
        <button
          className="btn primary"
          onClick={async () => {
            const g = added.trim();
            if (!g) return;
            if (list.includes(g)) return toast('That group already exists');
            await save([...list, g]);
            onPick(g);
            setAdded('');
          }}
        >
          ＋ Add
        </button>
      </div>
      <div className="tiny muted mt">A group with accounts in it can be renamed here; move its accounts to remove it.</div>
    </Sheet>
  );
}
