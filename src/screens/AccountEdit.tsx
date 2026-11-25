import { useEffect, useState } from 'react';
import { AccountPickerButton, AmountField, CurrencySheet, Field, NumberInput, Sheet, ToggleRow, Topbar } from '../components/ui';
import { deleteEffects, isLiquid, walletsByAccount } from '../domain/balances';
import { accountGroupsOf, ACCOUNT_TYPES, WALLET_TYPES, type Account, type AccountType } from '../domain/types';
import { fmtMoney, fmtNumber } from '../domain/money';
import { convert } from '../domain/fx';
import { db, uid } from '../db/db';
import {
  accountTxCount,
  changeAccountCurrency,
  deleteAccountCascade,
  pausePaydaysUsing,
  renameAccountGroup,
  saveAccount,
  saveAccountGroups,
  setAccountBalance,
} from '../db/repo';
import { useApp, useData } from '../state/app';
import { accountEmoji } from '../ui/emoji';
import { BalanceSheet } from '../components/BalanceSheet';
import { getLink, loadFamily, shareAccount, type Family } from '../services/sync';

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
  // a new total typed for a saved account: the balance sheet asks what the difference was
  const [newTotal, setNewTotal] = useState<{ value: number; wallet: string } | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
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
  const pickType = async (t: AccountType) => {
    // leaving cash / top-up: other currencies that still hold money would be lost, so ask twice
    if (canWallets && !WALLET_TYPES.has(t)) {
      const held = (a.wallets ?? []).filter((c) => Math.abs(heldIn(c)) > 1e-9);
      if (held.length) {
        const list = held.map((c) => fmtMoney(heldIn(c), c)).join(', ');
        const first = await confirm({
          title: `Change ${a.name || 'this account'} to ${ACCOUNT_TYPES.find((x) => x.type === t)!.label}?`,
          message: `Only cash and top-up cards hold other currencies. ${list} would be recorded as gone.`,
          ok: 'Change it',
          danger: true,
        });
        if (!first) return;
        const sure = await confirm({
          title: 'Are you really sure?',
          message: `${list} will no longer count anywhere.`,
          ok: 'Yes, change it',
          cancel: 'Keep it',
          danger: true,
          swap: true,
        });
        if (!sure) return;
      }
    }
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
    // a statement day without a due day: nothing could be set aside for the card
    if (a.type === 'credit' && a.statementDay && !a.dueDay) {
      toast('Add the payment due day too');
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
      // set elsewhere while this form may be open, so never put back by it: the balance (Balance now saves
      // straight away), splits, what was put in (Investments), and who it is shared with
      ...(stored
        ? {
            openingBalance: stored.openingBalance,
            openingDate: stored.openingDate,
            splits: stored.splits,
            capital: stored.capital,
            costBasis: stored.costBasis,
            unitPrice: a.unitPrice !== existing?.unitPrice ? a.unitPrice : stored.unitPrice,
          }
        : {}),
      shared: stored?.shared,
      wallets: WALLET_TYPES.has(a.type) && a.wallets?.length ? a.wallets.filter((c) => c !== a.currency) : undefined,
    });
    toast(existing ? '✨ Saved' : '🎉 Account added');
    if (existing) back();
    else replace({ name: 'account', id: a.id });
  };

  const [delOpen, setDelOpen] = useState(false);
  const remove = async () => {
    if (!existing) return;
    // moves with other accounts: deleting them would change those accounts, so offer to keep them
    if (deleteEffects(existing.id, data.allTxs).length) return setDelOpen(true);
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
    await removeWithUndo(async () => {
      await deleteAccountCascade(existing.id);
      if (await pausePaydaysUsing(existing.id)) toast('💰 Payday paused: choose another account in Payday');
    });
    tab('accounts');
  };

  const others = data.accounts.filter((x) => x.id !== a.id && x.type !== 'credit');

  // shared with this phone by another: only its owner changes it; entries (and the balance) can be added here
  if (existing?.shared && !existing.shared.mine) {
    const now = data.balances.get(existing.id) ?? 0;
    const shown = existing.type === 'credit' ? -now : now;
    return (
      <>
        <Topbar title="Shared account" />
        <div className="page">
          <div className="banner sky">
            <span>👨‍👩‍👧</span>
            <span className="grow small">
              <b>{existing.name}</b> is shared with you by {existing.shared.ownerName}. Only they can change the account itself.
              You can add entries, and set its balance (that adds an entry).
            </span>
          </div>
          <Field label={existing.type === 'credit' ? 'Amount owed now' : `Balance now (${existing.currency})`}>
            <AmountField
              value={shown}
              onChange={(v) => {
                if (Math.abs(v - shown) > 1e-9) setNewTotal({ value: v, wallet: existing.currency });
              }}
              currency={existing.currency}
              title="New total balance"
              allowNegative={existing.type !== 'credit'}
            />
          </Field>
        </div>
        {newTotal && <BalanceSheet account={existing} open start={newTotal} onClose={() => setNewTotal(null)} />}
      </>
    );
  }

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

        {existing && (
          <div className="card flat">
            {[existing.currency, ...(existing.wallets ?? [])].map((c) => {
              const main = c === existing.currency;
              const cardOwed = main && existing.type === 'credit';
              const now = main ? (data.balances.get(existing.id) ?? 0) : heldIn(c);
              const shown = cardOwed ? -now : now;
              return (
                <Field
                  key={c}
                  label={cardOwed ? 'Amount owed now' : main ? `Balance now (${c})` : `Balance in ${c}`}
                  hint={
                    main
                      ? 'Change it to match your bank or app. You then choose if the difference is just a correction, or income or spending. Saved straight away.'
                      : undefined
                  }
                >
                  <AmountField
                    value={shown}
                    onChange={(v) => {
                      if (Math.abs(v - shown) > 1e-9) setNewTotal({ value: v, wallet: c });
                    }}
                    currency={c}
                    title={cardOwed ? 'Amount owed now' : 'New total balance'}
                    allowNegative={!cardOwed}
                  />
                </Field>
              );
            })}
          </div>
        )}

        {existing && <ShareCard account={existing} />}

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
          <Field
            label="Currency"
            hint={
              hasEntries
                ? 'It has entries: changing it converts every amount in this account at the rate you confirm.'
                : undefined
            }
          >
            <button
              type="button"
              className="amount-field"
              onClick={() => (hasEntries && existing ? setConvertOpen(true) : setCurOpen(true))}
            >
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

        {!['investment', 'crypto', 'units', 'credit', 'cash', 'topup'].includes(a.type) && (
          <ToggleRow
            title="📈 Show in Investments"
            desc="List it on the Investments page with what you put in and its profit (e.g. a unit-linked insurance)"
            on={!!a.showInInvestments}
            onChange={(v) => set({ showInInvestments: v || undefined })}
          />
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
            hint="You can change it any time from ✏️ Edit on the account."
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
        {existing && delOpen && (
          <DeleteSheet account={existing} onClose={() => setDelOpen(false)} onDone={() => tab('accounts')} />
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
      {existing && convertOpen && <ConvertCurrencySheet account={existing} onClose={() => setConvertOpen(false)} />}
      {existing && newTotal && <BalanceSheet account={existing} open start={newTotal} onClose={() => setNewTotal(null)} />}
    </>
  );
}

/**
 * Change the currency of an account that has entries: type what it is worth in the new currency (filled in at
 * today's rate) and every amount in the account is converted at that rate.
 */
function ConvertCurrencySheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const { rates, toast, confirm, back } = useApp();
  const data = useData();
  const [to, setTo] = useState<string | null>(null);
  const [pick, setPick] = useState(true);
  const bal = data.balances.get(account.id) ?? 0;
  const live = to ? convert(1, account.currency, to, rates) : null;
  const [worth, setWorth] = useState<number | null>(null);
  const rate = to ? (bal !== 0 && worth !== null ? worth / bal : live) : null;
  // closed the currency list without picking one: nothing to do
  useEffect(() => {
    if (!pick && !to) onClose();
  }, [pick, to, onClose]);
  const go = async () => {
    if (!to || !rate || !(rate > 0)) return toast('Type what it is worth in the new currency');
    const ok = await confirm({
      title: `Change ${account.name} to ${to}?`,
      message: `Every amount in it is converted at 1 ${account.currency} = ${fmtNumber(rate, 6, 2)} ${to}. Other accounts and past totals stay the same. A safety copy is kept (Settings → Undo).`,
      ok: 'Convert',
    });
    if (!ok) return;
    try {
      await changeAccountCurrency(account.id, to, rate);
    } catch (e) {
      return toast(e instanceof Error ? e.message : String(e));
    }
    toast(`✨ ${account.name} is now in ${to}`);
    onClose();
    back();
  };
  return (
    <>
      <Sheet open={!pick && !!to} onClose={onClose} title={`🔁 Change currency · ${account.name}`}>
        {to && (
          <>
            <div className="card flat small">
              Now: <b>{fmtMoney(bal, account.currency)}</b> in {account.currency}
            </div>
            <Field
              label={`What it is worth in ${to}`}
              hint={
                live
                  ? `Filled in at today’s rate (1 ${account.currency} = ${fmtNumber(live, 6, 2)} ${to}). Type what your app shows to use its rate.`
                  : 'No rate saved for this currency: type what your app shows.'
              }
            >
              <AmountField value={worth} onChange={setWorth} currency={to} title={`Worth in ${to}`} />
            </Field>
            <button className="btn primary block" onClick={go}>
              Convert to {to}
            </button>
            <button className="btn ghost block mt" onClick={() => setPick(true)}>
              Pick another currency
            </button>
          </>
        )}
      </Sheet>
      <CurrencySheet
        open={pick}
        onClose={() => setPick(false)}
        value={to ?? account.currency}
        onPick={(c) => {
          if (c === account.currency) return onClose();
          setTo(c);
          const r = convert(1, account.currency, c, rates);
          setWorth(r ? Math.round(bal * r * 100) / 100 : null);
          setPick(false);
        }}
      />
    </>
  );
}

/** Family sharing: choose which phones in the family see this account (and add entries to it). */
function ShareCard({ account }: { account: Account }) {
  const { toast } = useApp();
  const [fam, setFam] = useState<Family | null | undefined>(undefined);
  const [pick, setPick] = useState<string[]>(account.shared?.members ?? []);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void getLink().then(async (l) => {
      if (!l?.token) return alive && setFam(null);
      try {
        const f = await loadFamily();
        if (alive) setFam(f);
      } catch {
        if (alive) setFam(null);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!fam) return null;
  const others = fam.devices.filter((d) => !d.me);
  if (!others.length) return null;
  const now = account.shared?.members ?? [];
  const changed = pick.length !== now.length || pick.some((x) => !now.includes(x));
  const save = async (members: string[]) => {
    setBusy(true);
    try {
      await shareAccount(account, members);
      toast(
        members.length ? `👨‍👩‍👧 Shared with ${members.length} ${members.length === 1 ? 'phone' : 'phones'}` : 'No longer shared',
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card flat">
      <div className="bold small">👨‍👩‍👧 Share with family</div>
      <div className="tiny muted mb">
        The phones you tick see this account and all its entries, and can add their own. Each person can only change their own
        entries. It counts in full in everyone’s net worth.
      </div>
      {others.map((d) => (
        <ToggleRow
          key={d.id}
          title={d.name}
          on={pick.includes(d.id)}
          onChange={(v) => setPick(v ? [...pick, d.id] : pick.filter((x) => x !== d.id))}
        />
      ))}
      {changed && (
        <button className="btn primary block mt" disabled={busy} onClick={() => save(pick)}>
          {pick.length ? (now.length ? 'Save sharing' : 'Share it') : 'Stop sharing'}
        </button>
      )}
    </div>
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
  // only accounts in use count: archived and removed ones don't stop a group being deleted
  const inUse = (g: string) => data.accounts.filter((x) => x.group === g && !x.archived && !x.removed).length;
  const save = async (next: string[]) => {
    setList(next);
    await saveAccountGroups(profile.id, next);
  };
  const remove = async (g: string) => {
    const next = list.filter((x) => x !== g);
    await save(next);
    // archived or removed accounts still in it move to the first group, so the old one doesn't come back
    const left = data.accounts.filter((x) => x.group === g).map((x) => x.id);
    if (left.length && next[0]) await db.accounts.where('id').anyOf(left).modify({ group: next[0] });
    toast(`🗑️ ${g} deleted`);
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
                <button className="btn sm ghost" aria-label={`Remove ${g}`} onClick={() => void remove(g)}>
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

/**
 * Deleting an account that has moves with other accounts: remove it but keep those moves (other balances stay),
 * or delete it with its moves (saying exactly what changes, and asking twice).
 */
function DeleteSheet({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const { confirm, removeWithUndo } = useApp();
  const data = useData();
  const effects = deleteEffects(account.id, data.allTxs);
  const lines = effects.map((e) => {
    const other = data.accountById.get(e.accountId);
    const cur = e.currency ?? other?.currency ?? '';
    return `${other?.name ?? '?'} ${e.change > 0 ? 'goes up' : 'goes down'} by ${fmtMoney(Math.abs(e.change), cur)}`;
  });
  const keepOthers = async () => {
    await removeWithUndo(async () => {
      await db.accounts.update(account.id, { archived: true, removed: true });
      // nothing repeats into an account that is gone
      await db.recurring
        .filter((r) => r.active && (r.accountId === account.id || r.toAccountId === account.id))
        .modify({ active: false });
      await pausePaydaysUsing(account.id);
    }, `🗑️ ${account.name} removed`);
    onClose();
    onDone();
  };
  const deleteAll = async () => {
    const first = await confirm({
      title: `Delete ${account.name} and all its moves?`,
      message: `${lines.join('. ')}.`,
      ok: 'Delete',
      danger: true,
    });
    if (!first) return;
    const sure = await confirm({
      title: 'Are you really sure?',
      message: 'Those balances change for good.',
      ok: 'Yes, delete',
      cancel: 'Keep it',
      danger: true,
      swap: true,
    });
    if (!sure) return;
    await removeWithUndo(async () => {
      await deleteAccountCascade(account.id);
      await pausePaydaysUsing(account.id);
    }, `🗑️ ${account.name} deleted`);
    onClose();
    onDone();
  };
  return (
    <Sheet open onClose={onClose} title={`Delete ${account.name}?`}>
      <div className="small mb">
        It has moves with other accounts. Deleting those moves would change them: {lines.join('; ')}.
      </div>
      <button className="btn primary block" onClick={keepOthers}>
        Remove it, keep other accounts as they are
      </button>
      <div className="tiny muted mt mb">
        Gone from every list and from net worth. Its moves stay, so other balances don’t change.
      </div>
      <button className="btn danger block" onClick={deleteAll}>
        Delete it and all its moves
      </button>
    </Sheet>
  );
}
