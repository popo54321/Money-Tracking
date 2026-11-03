import { useState } from 'react';
import { AccountPickerButton, AmountField, CurrencySheet, Field, NumberInput, ToggleRow, Topbar } from '../components/ui';
import { ACCOUNT_GROUPS, ACCOUNT_TYPES, type Account, type AccountType } from '../domain/types';
import { db, uid } from '../db/db';
import { accountTxCount, deleteAccountCascade, saveAccount } from '../db/repo';
import { useApp, useData } from '../state/app';
import { accountEmoji } from '../ui/emoji';

export function AccountEdit({ id }: { id?: string }) {
  const { profile, back, replace, toast, confirm, today, tab } = useApp();
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
  const set = (patch: Partial<Account>) => setA((x) => ({ ...x, ...patch }));
  const isCard = a.type === 'credit';
  const hasEntries = !!existing && data.txs.some((t) => t.accountId === a.id || t.toAccountId === a.id);

  const pickType = (t: AccountType) => {
    const def = ACCOUNT_TYPES.find((x) => x.type === t)!;
    const patch: Partial<Account> = { type: t, group: def.defaultGroup };
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
    await saveAccount({ ...a, name: a.name.trim(), order: stored?.order ?? a.order });
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
    await deleteAccountCascade(existing.id);
    toast('🗑️ Deleted');
    tab('accounts');
  };

  const others = data.accounts.filter((x) => x.id !== a.id && x.type !== 'credit');

  return (
    <>
      <Topbar title={existing ? 'Edit account' : 'New account'} />
      <div className="page">
        <Field label="Name">
          <input value={a.name} placeholder="e.g. Kbank savings" onChange={(e) => set({ name: e.target.value })} autoFocus={!existing} />
        </Field>

        <Field label="Type">
          <div className="chips">
            {ACCOUNT_TYPES.map((t) => (
              <button key={t.type} type="button" className={`chip ${a.type === t.type ? 'on' : ''}`} onClick={() => pickType(t.type)} disabled={hasEntries && (t.type === 'crypto') !== (a.type === 'crypto')}>
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

        {a.type === 'units' && (
          <ToggleRow
            title="🥇 Thai gold, live price (ทองบาทละ)"
            desc="Valued at today’s 96.5% gold bar price per baht-weight"
            on={a.unitPriceSource === 'live-gold'}
            onChange={(v) => set({ unitPriceSource: v ? 'live-gold' : 'manual', ...(v ? { currency: 'baht-weight', unitPriceCurrency: 'THB' } : {}) })}
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
          <Field label={isCard ? 'Amount owed now' : `Balance now (${a.currency})`} hint="You can change it any time with “Set new balance”.">
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
              <AmountField value={a.creditLimit ?? null} onChange={(v) => set({ creditLimit: v || undefined })} currency={a.currency} />
            </Field>
            <div className="grid2">
              <Field label="Statement day" hint="Day of month the bill is made">
                <NumberInput value={a.statementDay ?? null} onChange={(v) => set({ statementDay: v ? Math.min(31, Math.max(1, Math.round(v))) : undefined })} placeholder="e.g. 25" />
              </Field>
              <Field label="Payment due day" hint="Day of month to pay by">
                <NumberInput value={a.dueDay ?? null} onChange={(v) => set({ dueDay: v ? Math.min(31, Math.max(1, Math.round(v))) : undefined })} placeholder="e.g. 10" />
              </Field>
            </div>
            <Field label="Usually paid from" hint="This account keeps the statement amount reserved until it’s paid.">
              <AccountPickerButton accounts={others} value={a.payFromAccountId} onChange={(v) => set({ payFromAccountId: v })} placeholder="Choose account" />
            </Field>
          </div>
        )}

        <div className="card flat">
          <h2>Extra details</h2>
          <Field label="Group" hint="Matches the sections of your year sheet.">
            <div className="chips">
              {[...ACCOUNT_GROUPS, ...(ACCOUNT_GROUPS.includes(a.group) ? [] : [a.group])].map((g) => (
                <button key={g} type="button" className={`chip lav ${a.group === g ? 'on' : ''}`} onClick={() => set({ group: g })}>
                  {g}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Note">
            <input value={a.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="Optional" />
          </Field>
          <ToggleRow title="Count in net worth" on={a.includeInNetWorth} onChange={(v) => set({ includeInNetWorth: v })} />
          {existing && (
            <ToggleRow title="Archived" desc="Hidden from lists, history kept" on={a.archived} onChange={(v) => set({ archived: v })} />
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
