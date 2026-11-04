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
import { QuickActions } from '../components/QuickActions';
import { moveItem, orderGroups } from '../domain/groups';
import { reorderRows, saveGroupOrder } from '../db/repo';

export function AccountLine({ a }: { a: Account }) {
  const { go, rates, currency, today } = useApp();
  const [quick, setQuick] = useState(false);
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
    if (st.remaining > 0 && st.dueDate)
      sub = `${fmtMoney(st.remaining, a.currency)} due ${fmtDate(st.dueDate, false)}${st.overdue ? ' ⚠️' : ''}`;
    else if (st.available !== undefined) sub = `${fmtMoney(st.available, a.currency, { compact: true })} available`;
    second = null;
  } else if (a.type === 'units') {
    main = `${fmtMoney(bal, a.currency, { compact: true })}`;
    second = value === null ? 'set a price' : fmtMoney(value, currency);
  } else if (reserved > 0) {
    sub = `🔒 ${fmtMoney(reserved, a.currency, { compact: true })} kept for bills · free ${fmtMoney(bal - reserved, a.currency, { compact: true })}`;
  }
  const isCard = a.type === 'credit';
  const nSplits = a.splits?.length ?? 0;
  if (nSplits) sub = `${sub} · 🧩 ${nSplits} ${nSplits === 1 ? 'split' : 'splits'}`;
  return (
    <>
      <button className="row" onClick={() => go({ name: 'account', id: a.id })} {...holdProps(() => setQuick(true))}>
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
      {quick && (
        <QuickActions
          title={a.name}
          onClose={() => setQuick(false)}
          actions={[
            {
              label: isCard ? '💸 Spend on this card' : '💸 Spend from it',
              tone: 'pink',
              run: () => go({ name: 'entry', kind: 'expense', accountId: a.id }),
            },
            ...(isCard
              ? [
                  {
                    label: '💳 Pay the card',
                    tone: 'mint' as const,
                    run: () => go({ name: 'entry', kind: 'transfer', accountId: a.payFromAccountId, toAccountId: a.id }),
                  },
                ]
              : [
                  {
                    label: '💰 Add income',
                    tone: 'mint' as const,
                    run: () => go({ name: 'entry', kind: 'income', accountId: a.id }),
                  },
                ]),
            { label: '🔄 Move money', tone: 'sky', run: () => go({ name: 'entry', kind: 'transfer', accountId: a.id }) },
            { label: '📖 Open', tone: 'plain', run: () => go({ name: 'account', id: a.id }) },
            { label: '✏️ Edit account', tone: 'plain', run: () => go({ name: 'accountEdit', id: a.id }) },
          ]}
        />
      )}
    </>
  );
}

export function Accounts() {
  const { go, rates, currency, profile } = useApp();
  const data = useData();
  const [showArchived, setShowArchived] = useState(false);
  const [arrange, setArrange] = useState(false);
  const visible = data.accounts.filter((a) => showArchived || !a.archived);
  const nw = netWorth(data.accounts, data.balances, rates, currency);
  const groups = orderGroups([...ACCOUNT_GROUPS, ...visible.map((a) => a.group)], profile.accountGroupOrder);
  const shownGroups = groups.filter((g) => visible.some((a) => a.group === g));
  const archivedCount = data.accounts.filter((a) => a.archived).length;

  const moveGroup = (g: string, dir: -1 | 1) =>
    saveGroupOrder(profile.id, 'account', [...moveItem(shownGroups, g, dir), ...groups.filter((x) => !shownGroups.includes(x))]);
  /** Swap an account with its neighbour in the same group, then number every account afresh. */
  const moveAccount = async (a: Account, items: Account[], dir: -1 | 1) => {
    const other = items[items.indexOf(a) + dir];
    if (!other) return;
    const ids = data.accounts.map((x) => x.id);
    const i = ids.indexOf(a.id);
    const j = ids.indexOf(other.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderRows('accounts', ids);
  };

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
                <span
                  key={g}
                  className="pill"
                  style={{ background: 'color-mix(in srgb, var(--card) 70%, transparent)', color: 'var(--ink)' }}
                >
                  {g} {fmtMoney(nw.byGroup.get(g) ?? 0, currency, { compact: true })}
                </span>
              ))}
          </div>
        </div>

        <div className="hstack mb">
          <button className="btn primary grow" onClick={() => go({ name: 'accountEdit' })}>
            ＋ Add account, card or purse
          </button>
          <button className={`btn ${arrange ? 'mint' : ''}`} onClick={() => setArrange(!arrange)}>
            {arrange ? '✓ Done' : '↕️ Arrange'}
          </button>
        </div>
        {arrange && (
          <div className="banner">
            <span>↕️</span>
            <span className="grow small">
              ▲ ▼ next to a group name moves the whole group (e.g. Credit to the top). ▲ ▼ on an account moves it inside its
              group.
            </span>
          </div>
        )}

        {shownGroups.map((g, gi) => {
          const items = visible.filter((a) => a.group === g);
          const total = items.reduce(
            (s, a) =>
              s +
              (a.archived || !a.includeInNetWorth ? 0 : (accountValue(a, data.balances.get(a.id) ?? 0, rates, currency) ?? 0)),
            0,
          );
          return (
            <div key={g}>
              <div className="section-title">
                <span>{g}</span>
                <span className="grow" />
                {arrange ? (
                  <>
                    <button
                      className="btn sm ghost"
                      aria-label={`Move ${g} up`}
                      disabled={gi === 0}
                      onClick={() => moveGroup(g, -1)}
                    >
                      ▲
                    </button>
                    <button
                      className="btn sm ghost"
                      aria-label={`Move ${g} down`}
                      disabled={gi === shownGroups.length - 1}
                      onClick={() => moveGroup(g, 1)}
                    >
                      ▼
                    </button>
                  </>
                ) : (
                  <span className="small">{fmtMoney(total, currency, { compact: true })}</span>
                )}
              </div>
              <div className="list">
                {items.map((a, ai) =>
                  arrange ? (
                    <div key={a.id} className="row">
                      <div className={`bubble ${accountColour(a.type)}`}>{accountEmoji(a.type)}</div>
                      <div className="main">
                        <div className="title">{a.name}</div>
                      </div>
                      <button
                        className="btn sm ghost"
                        aria-label="Move up"
                        disabled={ai === 0}
                        onClick={() => moveAccount(a, items, -1)}
                      >
                        ▲
                      </button>
                      <button
                        className="btn sm ghost"
                        aria-label="Move down"
                        disabled={ai === items.length - 1}
                        onClick={() => moveAccount(a, items, 1)}
                      >
                        ▼
                      </button>
                    </div>
                  ) : (
                    <AccountLine key={a.id} a={a} />
                  ),
                )}
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
