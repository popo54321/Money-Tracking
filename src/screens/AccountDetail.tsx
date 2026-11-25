import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { debtStatus, type Debt } from '../domain/debts';
import { InstalmentLine } from './Recurring';
import { uid } from '../db/db';
import { saveDebt } from '../db/repo';
import { AmountField, Field, Sheet, Topbar } from '../components/ui';
import { ScheduledList, TxGroups } from '../components/TxRow';
import { SplitsCard } from '../components/SplitsCard';
import { accountValue, walletsValue } from '../domain/balances';
import { investmentStatus, isInvestmentAccount } from '../domain/investments';
import { fmtNumber } from '../domain/money';
import { convert } from '../domain/fx';
import { cardStatus } from '../domain/creditCard';
import { fmtAgo, fmtDate, relativeDays } from '../domain/dates';
import type { AccountClaims } from '../domain/splits';
import { fmtMoney } from '../domain/money';
import type { Account } from '../domain/types';
import { db } from '../db/db';
import { useApp, useData } from '../state/app';
import { accountEmoji } from '../ui/emoji';

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

/** Where an account's money goes, in order: set aside for bills, splits, saving targets, then Free. */
function ClaimsBreakdown({ claims, currency }: { claims: AccountClaims; currency: string }) {
  const parts = [
    { k: '🔒 Set aside', v: claims.setAside, cls: 'pink' },
    { k: '🧩 Splits', v: claims.splits, cls: 'sky' },
    { k: '🎯 Targets', v: claims.targets, cls: 'lav' },
  ].filter((p) => p.v > 0.005);
  const whole = Math.max(claims.balance, claims.setAside + claims.splits + claims.targets, 0.01);
  return (
    <>
      <div className="claims-bar mt" aria-hidden>
        {parts.map((p) => (
          <div key={p.k} className={p.cls} style={{ width: `${(Math.max(0, p.v) / whole) * 100}%` }} />
        ))}
        {claims.free > 0 && <div className="mint" style={{ width: `${(claims.free / whole) * 100}%` }} />}
      </div>
      <div className="stat-row mt" style={{ gridTemplateColumns: `repeat(${parts.length + 1}, 1fr)` }}>
        {parts.map((p) => (
          <div key={p.k} className="stat">
            <div className="k">{p.k}</div>
            <div className="v">{fmtMoney(p.v, currency, { compact: true })}</div>
          </div>
        ))}
        <div className="stat">
          <div className="k">Free</div>
          <div className={`v ${claims.free < 0 ? 'neg' : ''}`}>{fmtMoney(claims.free, currency, { compact: true })}</div>
        </div>
      </div>
    </>
  );
}

export function AccountDetail({ id }: { id: string }) {
  const { go, rates, currency, today, prices } = useApp();
  const data = useData();
  const [priceOpen, setPriceOpen] = useState(false);
  const a = data.accountById.get(id);
  if (!a) return <Topbar title="Account not found" />;
  const bal = data.balances.get(a.id) ?? 0;
  const wallets = [...(data.wallets.get(a.id) ?? [])];
  const mainValue = accountValue(a, bal, rates, currency);
  const extraValue = walletsValue(data.wallets.get(a.id), rates, currency);
  const value = mainValue === null || extraValue === null ? null : mainValue + extraValue;
  const claims = data.claims.get(a.id);
  const txs = data.txs.filter((t) => t.accountId === a.id || t.toAccountId === a.id);
  const isCard = a.type === 'credit';
  const st = isCard ? cardStatus(a, data.txs, today) : null;
  const payFrom = a.payFromAccountId ? data.accountById.get(a.payFromAccountId) : undefined;
  const reservedHere = data.upcoming.filter((u) => u.reserveAccountId === a.id && u.reserved);
  /** instalment plans still to pay on this card */
  const later = data.instalmentsLeft.get(a.id) ?? 0;

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
        {a.shared && (
          <div className="banner sky">
            <span>👨‍👩‍👧</span>
            <span className="grow small">
              {a.shared.mine
                ? `Shared with ${a.shared.members.length} ${a.shared.members.length === 1 ? 'phone' : 'phones'} in your family. Entries from everyone show here.`
                : `Shared with you by ${a.shared.ownerName}. You see everyone’s entries and can add your own.`}
            </span>
          </div>
        )}
        <div data-tour="acct-hero" className="hero">
          <div className="label">
            {isCard
              ? bal > 0.005
                ? 'Extra paid in (yours to spend)'
                : 'Owed on this card'
              : a.type === 'crypto'
                ? 'Bitcoin held'
                : a.unitPriceSource === 'live-gold'
                  ? 'Gold held (baht-weight)'
                  : 'Balance'}
          </div>
          <div className="big">{isCard ? fmtMoney(Math.abs(bal), a.currency) : fmtMoney(bal, a.currency)}</div>
          {isCard && bal > 0.005 && (
            <div className="small mt">
              You paid in more than you owed. Your next spending uses this first
              {a.creditLimit ? `, so you can spend up to ${fmtMoney(a.creditLimit + bal, a.currency)} in all` : ''}.
            </div>
          )}
          {wallets.length > 0 && (
            <div className="chips mt">
              {wallets.map(([c, v]) => (
                <span
                  key={c}
                  className="pill"
                  style={{ background: 'color-mix(in srgb, var(--card) 70%, transparent)', color: 'var(--ink)' }}
                >
                  {fmtMoney(v, c)}
                  {c !== currency && Math.abs(v) > 1e-9
                    ? ` ≈ ${fmtMoney(convert(v, c, currency, rates), currency, { dp: 0 })}`
                    : ''}
                </span>
              ))}
            </div>
          )}
          {(a.currency !== currency || wallets.length > 0) && !isCard && (
            <div className="bold">
              {wallets.length > 0 ? 'All together ' : ''}≈ {value === null ? 'no price yet' : fmtMoney(value, currency)}
            </div>
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
          {claims && !isCard && claims.setAside + claims.splits + claims.targets > 0.005 && (
            <ClaimsBreakdown claims={claims} currency={a.currency} />
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
        {isInvestmentAccount(a) &&
          (() => {
            const st = investmentStatus(a, data.txs, data.categoryById);
            return (
              <button
                className="card flat small"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => go({ name: 'wealth' })}
              >
                📈 Put in <b>{fmtMoney(st.capital, a.currency)}</b> · profit{' '}
                <b className={st.profit >= 0 ? 'pos' : 'neg'}>
                  {fmtMoney(st.profit, a.currency, { sign: true })}
                  {st.profitPct !== null ? ` (${fmtNumber(st.profitPct * 100, 1, 1)}%)` : ''}
                </b>
                <div className="tiny muted">Update its value and capital on the Investments page ›</div>
              </button>
            );
          })()}

        {a.type === 'units' && a.unitPriceSource !== 'live-gold' && (
          <div className="btn-row mb">
            <button className="btn sky" onClick={() => setPriceOpen(true)}>
              🥇 Price
            </button>
          </div>
        )}

        {isCard && st && (
          <div className="card">
            <h2 data-tour="acct-statement">💳 Statement</h2>
            {!a.statementDay ? (
              <div className="small muted">Add the statement day and due day in ✏️ Edit to see what to pay and when.</div>
            ) : (
              <>
                {!a.dueDay && (
                  <div className="banner pink mb">
                    <span>⚠️</span>
                    <span className="grow small">Add the due day in ✏️ Edit so money can be set aside for this card.</span>
                  </div>
                )}
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
                {later > 0.005 && (
                  <table className="t mt">
                    <tbody>
                      <tr>
                        <td>Instalments still to pay</td>
                        <td>{fmtMoney(later, a.currency)}</td>
                      </tr>
                      <tr className="total">
                        <td>Owed incl. instalments</td>
                        <td className="neg">{fmtMoney(Math.max(0, -bal) + later, a.currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
                <table className="t mt">
                  <tbody>
                    <tr>
                      <td>Next statement</td>
                      <td>{st.nextStatement ? fmtDate(st.nextStatement) : '—'}</td>
                    </tr>
                    <tr className="total">
                      <td>Spent since the last statement</td>
                      <td>{fmtMoney(st.nextSoFar, a.currency)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="small muted">
                  {st.nextDue ? `Goes on the next statement, due ${fmtDate(st.nextDue)}` : 'Goes on the next statement'}
                  {a.creditLimit
                    ? ` · limit ${fmtMoney(a.creditLimit, a.currency, { compact: true })} · available ${fmtMoney((st.available ?? 0) - later, a.currency, { compact: true })}`
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

        {isCard && <CardExtras card={a} />}

        {!isCard && <SplitsCard account={a} />}

        {reservedHere.length > 0 && (
          <div className="card">
            <h2 data-tour="acct-reserve">🔒 Set aside for bills</h2>
            {reservedHere.map((u) => (
              <div key={u.key} className="between small" style={{ padding: '4px 0' }}>
                <span>
                  {u.label}
                  {u.reserveAmount !== undefined && u.reserveAmount > u.amount + 0.005 ? ' + spending since' : ''} ·{' '}
                  {fmtDate(u.date, false)}
                  {u.buildUp ? ` · ${u.buildUp.months} of ${u.buildUp.of} months (${fmtMoney(u.amount, u.currency)})` : ''}
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
      {a.type === 'units' && <UnitPriceSheet account={a} open={priceOpen} onClose={() => setPriceOpen(false)} />}
    </>
  );
}

/** A card's instalment plans, and its debt (money carried over with interest), which also shows in Debts. */
function CardExtras({ card }: { card: Account }) {
  const { go, today, profile, toast } = useApp();
  const data = useData();
  const debts = useLiveQuery(() => db.debts.where('profileId').equals(profile.id).toArray(), [profile.id]) ?? [];
  const cardDebts = debts.filter((d) => d.cardId === card.id && !d.closed);
  const plans = data.recurring.filter((r) => r.instalments && r.accountId === card.id && r.active);
  const st = cardStatus(card, data.txs, today);

  const logDebt = async () => {
    // start from what is unpaid: an overdue statement, or else everything owed now
    const amount = st.overdue ? st.remaining : st.owedNow;
    const d: Debt = {
      id: uid(),
      profileId: profile.id,
      person: `💳 ${card.name}`,
      direction: 'iOwe',
      currency: card.currency,
      interestType: 'simple',
      ratePct: 16,
      ratePer: 'year',
      events:
        amount > 0.005
          ? [
              {
                id: uid(),
                date: st.overdue && st.dueDate ? st.dueDate : today,
                type: 'lend',
                amount: Math.round(amount * 100) / 100,
              },
            ]
          : [],
      cardId: card.id,
      note: 'Credit card debt',
      closed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveDebt(d);
    toast('💗 Added to Debts. Check the amount and interest rate.');
    go({ name: 'debt', id: d.id });
  };

  return (
    <>
      <div className="card">
        <h2>🧾 Instalment plans</h2>
        {plans.length === 0 ? (
          <div className="small muted mb">
            Bought something to pay off monthly? Add it here and each payment is recorded on this card until it is paid off.
          </div>
        ) : (
          <div className="list mb">
            {plans.map((r) => (
              <button key={r.id} className="row" onClick={() => go({ name: 'recurringEdit', id: r.id })}>
                <div className="main">
                  <div className="title">{r.name}</div>
                  <InstalmentLine r={r} cur={card.currency} />
                </div>
                <div className="end">
                  <div className="amt">{fmtMoney(r.amount, card.currency)}</div>
                  <div className="amt2">a month</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          className="btn block"
          onClick={() => go({ name: 'entry', kind: 'expense', accountId: card.id, instalments: true })}
        >
          ＋ Add an instalment plan
        </button>
      </div>

      <div className="card">
        <h2>💗 Card debt</h2>
        {cardDebts.length === 0 ? (
          <div className="small muted mb">
            Carrying a balance you can’t pay off in full? Log it as a debt to track the interest and what is left. It also shows
            in Debts under I owe.
          </div>
        ) : (
          <div className="list mb">
            {cardDebts.map((d) => {
              const s = debtStatus(d, today);
              return (
                <button key={d.id} className="row" onClick={() => go({ name: 'debt', id: d.id })}>
                  <div className="main">
                    <div className="title">Owed with interest</div>
                    <div className="sub">
                      {d.interestType === 'none' ? 'no interest' : `${d.ratePct}% a ${d.ratePer}`}
                      {s.startDate ? ` · since ${fmtDate(s.startDate, false)}` : ''}
                    </div>
                  </div>
                  <div className="end">
                    <div className="amt neg">{fmtMoney(s.owed, d.currency)}</div>
                    {s.interest > 0.005 && <div className="amt2">incl. {fmtMoney(s.interest, d.currency)} interest</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {cardDebts.length === 0 && (
          <button className="btn pink block" onClick={logDebt}>
            ＋ Log card debt
          </button>
        )}
      </div>
    </>
  );
}
