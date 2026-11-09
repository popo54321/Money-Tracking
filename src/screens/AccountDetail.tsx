import { useState } from 'react';
import { AmountField, CategoryGrid, Field, Sheet, Topbar } from '../components/ui';
import { ScheduledList, TxGroups } from '../components/TxRow';
import { SplitsCard } from '../components/SplitsCard';
import { accountValue } from '../domain/balances';
import { cardStatus } from '../domain/creditCard';
import { fmtAgo, fmtDate, relativeDays } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import type { Account } from '../domain/types';
import { db } from '../db/db';
import { setAccountBalance } from '../db/repo';
import { useApp, useData } from '../state/app';
import { accountEmoji } from '../ui/emoji';

/** Type a new total; choose whether the difference is just an adjustment or real income/spending. */
function BalanceSheet({ account, open, onClose }: { account: Account; open: boolean; onClose: () => void }) {
  const { rates, currency, today, toast } = useApp();
  const data = useData();
  const isCard = account.type === 'credit';
  const current = data.balances.get(account.id) ?? 0;
  const shownCurrent = isCard ? -current : current;
  const [value, setValue] = useState<number | null>(null);
  const [step, setStep] = useState<'enter' | 'choose'>('enter');
  const [mode, setMode] = useState<'adjust' | 'log' | 'opening'>('adjust');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [date, setDate] = useState(today);
  const hasEntries = data.allTxs.some((t) => t.accountId === account.id || t.toAccountId === account.id);

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
    await setAccountBalance({ account, newBalance, mode, categoryId, date, rates, defaultCurrency: currency });
    toast(mode === 'log' ? (delta > 0 ? '💰 Logged as income' : '💸 Logged as spending') : '🪄 Balance updated');
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={isCard ? 'Set amount owed' : 'Set new balance'}>
      {step === 'enter' && (
        <>
          <div className="card flat small">
            Now: <b>{fmtMoney(shownCurrent, account.currency)}</b>
            {isCard ? ' owed' : ''}
          </div>
          <Field
            label={isCard ? 'Amount owed now' : 'New total balance'}
            hint="Type what your bank or app shows. I'll work out the difference."
          >
            <AmountField
              value={value}
              onChange={setValue}
              currency={account.currency}
              title="New total"
              allowNegative={!isCard}
            />
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
              {fmtMoney(isCard ? -delta : delta, account.currency, { sign: true })}
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

function UnitPriceSheet({ account, open, onClose }: { account: Account; open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [price, setPrice] = useState<number | null>(account.unitPrice ?? null);
  return (
    <Sheet open={open} onClose={onClose} title={`Price per ${account.currency}`}>
      <Field label={`Price of 1 ${account.currency} in ${account.unitPriceCurrency || 'THB'}`}>
        <AmountField value={price} onChange={setPrice} currency={account.unitPriceCurrency || 'THB'} />
      </Field>
      <button
        className="btn primary block"
        onClick={async () => {
          await db.accounts.update(account.id, { unitPrice: price ?? undefined, unitPriceUpdatedAt: Date.now() });
          toast('🥇 Price saved');
          onClose();
        }}
      >
        Save price
      </button>
    </Sheet>
  );
}

export function AccountDetail({ id }: { id: string }) {
  const { go, rates, currency, today, prices } = useApp();
  const data = useData();
  const [balOpen, setBalOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const a = data.accountById.get(id);
  if (!a) return <Topbar title="Account not found" />;
  const bal = data.balances.get(a.id) ?? 0;
  const value = accountValue(a, bal, rates, currency);
  const reserved = data.reserved.get(a.id) ?? 0;
  const txs = data.txs.filter((t) => t.accountId === a.id || t.toAccountId === a.id);
  const isCard = a.type === 'credit';
  const st = isCard ? cardStatus(a, data.txs, today) : null;
  const payFrom = a.payFromAccountId ? data.accountById.get(a.payFromAccountId) : undefined;
  const reservedHere = data.upcoming.filter((u) => u.reserveAccountId === a.id && u.reserved);

  return (
    <>
      <Topbar
        title={`${accountEmoji(a.type)} ${a.name}`}
        right={
          <button className="icon-btn" aria-label="Edit account" onClick={() => go({ name: 'accountEdit', id: a.id })}>
            ✏️
          </button>
        }
      />
      <div className="page">
        <div className="hero">
          <div className="label">
            {isCard
              ? 'Owed on this card'
              : a.type === 'crypto'
                ? 'Bitcoin held'
                : a.unitPriceSource === 'live-gold'
                  ? 'Gold held (baht-weight)'
                  : 'Balance'}
          </div>
          <div className="big">{isCard ? fmtMoney(Math.max(0, -bal), a.currency) : fmtMoney(bal, a.currency)}</div>
          {a.currency !== currency && !isCard && (
            <div className="bold">≈ {value === null ? 'no price yet' : fmtMoney(value, currency)}</div>
          )}
          {a.type === 'crypto' && prices.btcPrice && (
            <div className="small mt">
              1 BTC = {fmtMoney(prices.btcPrice, prices.btcPriceCurrency, { dp: 0 })}
              {prices.btcFetchedAt ? ` · ${fmtAgo(prices.btcFetchedAt)}` : ' · built-in price'}
            </div>
          )}
          {a.type === 'units' && a.unitPriceSource === 'live-gold' && (
            <div className="small mt">
              ทองบาทละ {fmtMoney(prices.goldBuyThb ?? null, 'THB', { dp: 0 })} (shop buys) ·{' '}
              {fmtMoney(prices.goldSellThb ?? null, 'THB', { dp: 0 })} (sells)
              {prices.goldFetchedAt ? ` · ${fmtAgo(prices.goldFetchedAt)}` : ' · built-in price'}
            </div>
          )}
          {a.type === 'units' && a.unitPriceSource !== 'live-gold' && (
            <div className="small mt">
              {a.unitPrice ? `1 ${a.currency} = ${fmtMoney(a.unitPrice, a.unitPriceCurrency || 'THB')}` : 'No price set yet'}
              {a.unitPriceUpdatedAt ? ` · set ${fmtAgo(a.unitPriceUpdatedAt)}` : ''}
            </div>
          )}
          {reserved > 0 && !isCard && (
            <div className="stat-row mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat">
                <div className="k">🔒 Keep for bills</div>
                <div className="v">{fmtMoney(reserved, a.currency, { compact: true })}</div>
              </div>
              <div className="stat">
                <div className="k">Free to use</div>
                <div className="v">{fmtMoney(bal - reserved, a.currency, { compact: true })}</div>
              </div>
            </div>
          )}
        </div>

        <div className="btn-row mb">
          <button className="btn pink" onClick={() => go({ name: 'entry', kind: 'expense', accountId: a.id })}>
            💸 Spend
          </button>
          <button className="btn mint" onClick={() => go({ name: 'entry', kind: 'income', accountId: a.id })}>
            💰 Income
          </button>
          <button className="btn" onClick={() => go({ name: 'entry', kind: 'transfer', accountId: a.id })}>
            🔄 Move
          </button>
        </div>
        <div className="btn-row mb">
          <button className="btn butter" onClick={() => setBalOpen(true)}>
            🪄 {isCard ? 'Set amount owed' : 'Set new balance'}
          </button>
          {a.type === 'units' && a.unitPriceSource !== 'live-gold' && (
            <button className="btn sky" onClick={() => setPriceOpen(true)}>
              🥇 Price
            </button>
          )}
        </div>

        {isCard && st && (
          <div className="card">
            <h2>💳 Statement</h2>
            {!a.statementDay ? (
              <div className="small muted">Add the statement day and due day in ✏️ Edit to see what to pay and when.</div>
            ) : (
              <>
                <table className="t">
                  <tbody>
                    <tr>
                      <td>Last statement</td>
                      <td>{st.lastStatement ? fmtDate(st.lastStatement) : '—'}</td>
                    </tr>
                    <tr>
                      <td>Statement amount</td>
                      <td>{fmtMoney(st.owedAtStatement, a.currency)}</td>
                    </tr>
                    <tr>
                      <td>Paid since</td>
                      <td>{fmtMoney(st.paidSinceStatement, a.currency)}</td>
                    </tr>
                    <tr className="total">
                      <td>Still to pay</td>
                      <td className={st.remaining > 0 ? 'neg' : 'pos'}>{fmtMoney(st.remaining, a.currency)}</td>
                    </tr>
                  </tbody>
                </table>
                {st.dueDate && (
                  <div className={`banner ${st.overdue ? 'pink' : st.remaining > 0 ? '' : 'mint'} mt`}>
                    <span>{st.overdue ? '⚠️' : st.remaining > 0 ? '📅' : '✅'}</span>
                    <span className="grow">
                      {st.remaining > 0
                        ? `Due ${fmtDate(st.dueDate)} (${relativeDays(today, st.dueDate)})`
                        : 'This statement is paid. Well done!'}
                    </span>
                  </div>
                )}
                <div className="small muted">
                  Next statement {st.nextStatement ? fmtDate(st.nextStatement) : '—'}
                  {a.creditLimit
                    ? ` · limit ${fmtMoney(a.creditLimit, a.currency, { compact: true })} · available ${fmtMoney(st.available ?? 0, a.currency, { compact: true })}`
                    : ''}
                </div>
                {payFrom && <div className="small muted">Paid from {payFrom.name}</div>}
              </>
            )}
            <button
              className="btn primary block mt"
              onClick={() =>
                go({
                  name: 'entry',
                  kind: 'transfer',
                  accountId: a.payFromAccountId,
                  toAccountId: a.id,
                  amount: st.remaining > 0 ? st.remaining : st.owedNow || undefined,
                  note: `${a.name} payment`,
                })
              }
            >
              💸 Pay now {st.remaining > 0 ? fmtMoney(st.remaining, a.currency) : ''}
            </button>
          </div>
        )}

        {!isCard && <SplitsCard account={a} />}

        {reservedHere.length > 0 && (
          <div className="card">
            <h2>🔒 Keeping ready in this account</h2>
            {reservedHere.map((u) => (
              <div key={u.key} className="between small" style={{ padding: '4px 0' }}>
                <span>
                  {u.label}
                  {u.reserveAmount !== undefined && u.reserveAmount > u.amount + 0.005 ? ' + spending since' : ''} ·{' '}
                  {fmtDate(u.date, false)}
                </span>
                <b>{fmtMoney(u.reserveAmount ?? u.amount, u.currency)}</b>
              </div>
            ))}
          </div>
        )}

        <ScheduledList accountId={a.id} days={62} />

        <div className="section-title">🧾 Entries</div>
        {txs.length === 0 ? (
          <div className="card small muted center">No entries in this account yet.</div>
        ) : (
          <TxGroups txs={txs} contextAccountId={a.id} limit={200} />
        )}
        <div className="center tiny muted">
          Starting balance {fmtMoney(isCard ? -a.openingBalance : a.openingBalance, a.currency)} on {fmtDate(a.openingDate)}
        </div>
      </div>
      <BalanceSheet account={a} open={balOpen} onClose={() => setBalOpen(false)} />
      {a.type === 'units' && <UnitPriceSheet account={a} open={priceOpen} onClose={() => setPriceOpen(false)} />}
    </>
  );
}
