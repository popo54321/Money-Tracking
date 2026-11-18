import { useState } from 'react';
import { fmtMoney } from '../domain/money';
import { accountCurrencies, type Account } from '../domain/types';
import { setAccountBalance } from '../db/repo';
import { useApp, useData } from '../state/app';
import { AmountField, CategoryGrid, Field, Sheet } from './ui';

/**
 * Type a new total; choose whether the difference is just an adjustment or real income/spending. Opened from the
 * account's Edit page with the total already typed (`start`), so it goes straight to that choice.
 */
export function BalanceSheet({
  account,
  open,
  onClose,
  start,
}: {
  account: Account;
  open: boolean;
  onClose: () => void;
  /** the new total already typed (as shown: amount owed for a card), in `wallet` */
  start?: { value: number; wallet: string };
}) {
  const { rates, currency, today, toast } = useApp();
  const data = useData();
  const isCard = account.type === 'credit';
  // an account holding several currencies: which one is being corrected
  const held = accountCurrencies(account);
  const [wallet, setWallet] = useState(start?.wallet ?? account.currency);
  const isMain = wallet === account.currency;
  const current = isMain ? (data.balances.get(account.id) ?? 0) : (data.wallets.get(account.id)?.get(wallet) ?? 0);
  const shownCurrent = isCard ? -current : current;
  const [value, setValue] = useState<number | null>(start?.value ?? null);
  const [step, setStep] = useState<'enter' | 'choose'>(start ? 'choose' : 'enter');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [date, setDate] = useState(today);
  // other currencies have no starting balance of their own, so they always record an entry
  const hasEntries = !isMain || data.allTxs.some((t) => t.accountId === account.id || t.toAccountId === account.id);
  const [mode, setMode] = useState<'adjust' | 'log' | 'opening'>(hasEntries ? 'adjust' : 'opening');

  const newBalance = value === null ? null : isCard ? -value : value;
  const delta = newBalance === null ? 0 : newBalance - current;
  const kind = delta > 0 ? 'income' : 'expense';

  const reset = () => {
    setValue(null);
    setStep('enter');
    setMode('adjust');
    setCategoryId(undefined);
    setDate(today);
  };
  const close = () => {
    reset();
    onClose();
  };
  const save = async () => {
    if (newBalance === null) return;
    if (mode === 'log' && !categoryId) {
      toast('Pick a category first 🏷️');
      return;
    }
    await setAccountBalance({
      account,
      newBalance,
      mode,
      categoryId,
      date,
      rates,
      defaultCurrency: currency,
      pocket: isMain ? undefined : wallet,
    });
    toast(mode === 'log' ? (delta > 0 ? '💰 Logged as income' : '💸 Logged as spending') : '🪄 Balance updated');
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={isCard ? 'Set amount owed' : 'Set new balance'}>
      {step === 'enter' && (
        <>
          {held.length > 1 && (
            <Field label="Which currency">
              <div className="chips">
                {held.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip ${wallet === c ? 'on' : ''}`}
                    onClick={() => {
                      setWallet(c);
                      setValue(null);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <div className="card flat small">
            Now: <b>{fmtMoney(shownCurrent, wallet)}</b>
            {isCard ? ' owed' : ''}
          </div>
          <Field
            label={isCard ? 'Amount owed now' : 'New total balance'}
            hint="Type what your bank or app shows. I'll work out the difference."
          >
            <AmountField value={value} onChange={setValue} currency={wallet} title="New total" allowNegative={!isCard} />
          </Field>
          <button
            className="btn primary block"
            disabled={value === null || Math.abs(delta) < 1e-12}
            onClick={() => {
              setMode(hasEntries ? 'adjust' : 'opening');
              setStep('choose');
            }}
          >
            Next
          </button>
        </>
      )}
      {step === 'choose' && newBalance !== null && (
        <>
          <div className="card center">
            <div className="small muted">Difference</div>
            <div className={`bold ${delta > 0 ? 'pos' : 'neg'}`} style={{ fontSize: 26 }}>
              {fmtMoney(isCard ? -delta : delta, wallet, { sign: true })}
            </div>
          </div>
          <div className="vstack">
            {!hasEntries && (
              <button className={`btn block ${mode === 'opening' ? 'primary' : ''}`} onClick={() => setMode('opening')}>
                🌱 Set as starting balance
              </button>
            )}
            <button className={`btn block ${mode === 'adjust' ? 'primary' : ''}`} onClick={() => setMode('adjust')}>
              🪄 Just adjust the balance (not income or spending)
            </button>
            <button
              className={`btn block ${mode === 'log' ? 'primary' : kind === 'income' ? 'mint' : 'pink'}`}
              onClick={() => setMode('log')}
            >
              {kind === 'income' ? '💰 Log the difference as income' : '💸 Log the difference as spending'}
            </button>
          </div>
          {mode === 'log' && (
            <>
              <div className="small muted mt">
                {kind === 'income' ? 'For example Interest or Investing Dividend.' : 'Which category was it?'}
              </div>
              <CategoryGrid categories={data.categories} kind={kind} value={categoryId} onPick={setCategoryId} />
            </>
          )}
          {mode !== 'opening' && (
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} />
            </Field>
          )}
          <div className="btn-row mt">
            <button className="btn ghost" onClick={() => setStep('enter')}>
              Back
            </button>
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
