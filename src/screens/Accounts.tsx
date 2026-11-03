import { useState } from 'react';
import { Topbar, Sparkle, SkinName } from '../components/ui';
import { accountValue, netWorth } from '../domain/balances';
import { cardStatus } from '../domain/creditCard';
import { fmtDate } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { ACCOUNT_GROUPS, type Account } from '../domain/types';
import { useApp, useData } from '../state/app';
import { accountColour, accountEmoji } from '../ui/emoji';
import { ProfileSwitch } from './Home';
import { holdProps } from '../components/hold';

export function AccountLine({ a }: { a: Account }) {
  const { go, rates, currency, today } = useApp();
  const data = useData();
  const bal = data.balances.get(a.id) ?? 0;
  const value = accountValue(a, bal, rates, currency);
  const reserved = data.reserved.get(a.id) ?? 0;
  let sub: string = a.type === 'credit' ? 'Credit card' : a.group;
  let main = fmtMoney(bal, a.currency);
  let second: string | null = a.currency !== currency ? fmtMoney(value, currency) : null;
  let mainCls = bal < 0 ? 'neg' : '';
  if (a.type === 'credit') {
    const st = cardStatus(a, data.txs, today);
    main = st.owedNow > 0 ? `owe ${fmtMoney(st.owedNow, a.currency)}` : fmtMoney(-bal, a.currency);
    mainCls = st.owedNow > 0 ? 'neg' : '';
    if (st.remaining > 0 && st.dueDate) sub = `${fmtMoney(st.remaining, a.currency)} due ${fmtDate(st.dueDate, false)}${st.overdue ? ' ⚠️' : ''}`;
    else if (st.available !== undefined) sub = `${fmtMoney(st.available, a.currency, { compact: true })} available`;
    second = null;
  } else if (a.type === 'units') {
    main = `${fmtMoney(bal, a.currency, { compact: true })}`;
    second = value === null ? 'set a price' : fmtMoney(value, currency);
  } else if (reserved > 0) {
    sub = `🔒 ${fmtMoney(reserved, a.currency, { compact: true })} kept for bills · free ${fmtMoney(bal - reserved, a.currency, { compact: true })}`;
  }
  return (
    <button className="row" onClick={() => go({ name: 'account', id: a.id })} {...holdProps(() => go({ name: 'accountEdit', id: a.id }))}>
      <div className={`bubble ${accountColour(a.type)}`}>{accountEmoji(a.type)}</div>
      <div className="main">
        <div className="title">{a.name}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className="end">
        <div className={`amt ${mainCls}`}>{main}</div>
        {second && <div className="amt2">{second}</div>}
      </div>
    </button>
  );
}

export function Accounts() {
  const { go, rates, currency } = useApp();
  const data = useData();
  const [showArchived, setShowArchived] = useState(false);
  const visible = data.accounts.filter((a) => showArchived || !a.archived);
  const nw = netWorth(data.accounts, data.balances, rates, currency);
  const groups = [...ACCOUNT_GROUPS, ...new Set(visible.map((a) => a.group))].filter((g, i, arr) => arr.indexOf(g) === i);
  const archivedCount = data.accounts.filter((a) => a.archived).length;

  return (
    <>
      <Topbar title={<SkinName k="accounts" />} right={<ProfileSwitch />} noBack />
      <div className="page">
        <div className="hero">
          <Sparkle k="accounts" />
          <div className="label">Total (net worth)</div>
          <div className="big">{fmtMoney(nw.total, currency)}</div>
          <div className="chips">
            {groups
              .filter((g) => nw.byGroup.has(g))
              .map((g) => (
                <span key={g} className="pill" style={{ background: 'color-mix(in srgb, var(--card) 70%, transparent)', color: 'var(--ink)' }}>
                  {g} {fmtMoney(nw.byGroup.get(g) ?? 0, currency, { compact: true })}
                </span>
              ))}
          </div>
        </div>

        <button className="btn primary block mb" onClick={() => go({ name: 'accountEdit' })}>
          ＋ Add account, card or purse
        </button>

        {groups.map((g) => {
          const items = visible.filter((a) => a.group === g);
          if (!items.length) return null;
          const total = items.reduce((s, a) => s + (a.archived || !a.includeInNetWorth ? 0 : accountValue(a, data.balances.get(a.id) ?? 0, rates, currency) ?? 0), 0);
          return (
            <div key={g}>
              <div className="section-title">
                <span>{g}</span>
                <span className="grow" />
                <span className="small">{fmtMoney(total, currency, { compact: true })}</span>
              </div>
              <div className="list">
                {items.map((a) => (
                  <AccountLine key={a.id} a={a} />
                ))}
              </div>
            </div>
          );
        })}
        {archivedCount > 0 && (
          <button className="btn ghost block" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide archived' : `Show ${archivedCount} archived`}
          </button>
        )}
      </div>
    </>
  );
}
