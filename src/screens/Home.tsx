import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Topbar } from '../components/ui';
import { TxGroups } from '../components/TxRow';
import { netWorth } from '../domain/balances';
import { fmtAgo, fmtDate, monthEnd, monthKey, monthStart, relativeDays } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { rateBetween } from '../domain/fx';
import { summarise } from '../domain/summary';
import { db } from '../db/db';
import { refreshPrices } from '../services/prices';
import { applyWebUpdate, onWebUpdateReady } from '../services/updater';
import { isNative } from '../services/platform';
import { useApp, useData } from '../state/app';

export function ProfileSwitch() {
  const { profiles, profile, setProfile, stackDepth } = useApp();
  if (profiles.length < 2) return null;
  const compact = stackDepth > 1;
  return (
    <div className="profile-switch" role="tablist" aria-label="Whose money">
      {profiles.map((p) => (
        <button
          key={p.id}
          className={p.id === profile.id ? 'on' : ''}
          onClick={() => setProfile(p.id)}
          role="tab"
          aria-selected={p.id === profile.id}
          aria-label={p.name}
          title={p.name}
        >
          {p.emoji ?? '🙂'}
          {compact ? '' : ` ${p.name}`}
        </button>
      ))}
    </div>
  );
}

function PriceChips() {
  const { prices, currency, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const usd = currency === 'USD' ? null : rateBetween('USD', currency, { perUsd: prices.perUsd });
  const btc = prices.btcPrice && prices.btcPriceCurrency
    ? (rateBetween(prices.btcPriceCurrency, currency, { perUsd: prices.perUsd }) ?? 0) * prices.btcPrice
    : null;
  const updated = prices.btcFetchedAt ?? prices.ratesFetchedAt;
  return (
    <div className="card">
      <div className="between">
        <h2 style={{ margin: 0 }}>✨ Live prices</h2>
        <button
          className="btn sm sky"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await refreshPrices(true);
            setBusy(false);
            toast(r.ok ? '🌈 Prices updated' : r.error === 'offline' ? '📴 Offline, using saved prices' : `😿 ${r.error}`);
          }}
        >
          {busy ? '…' : '↻ Refresh'}
        </button>
      </div>
      <div className="chips mt">
        <span className="pill butter">🪙 1 BTC = {fmtMoney(btc, currency, { dp: 0 })}</span>
        {prices.goldBuyThb && <span className="pill peach">🥇 ทอง 1 บาท = {fmtMoney(prices.goldBuyThb, 'THB', { dp: 0 })}</span>}
        {usd && <span className="pill sky">$1 = {fmtMoney(usd, currency)}</span>}
      </div>
      <div className="tiny muted mt">
        {updated ? `Updated ${fmtAgo(updated)}` : 'Using built-in prices from 3 Nov 2026 until the first update'}
        {' · works offline with the last saved prices'}
      </div>
    </div>
  );
}

export function Home() {
  const { profile, currency, rates, go, today, settings } = useApp();
  const data = useData();
  const needsSetup = useLiveQuery(() => db.kv.get('needsSetup'), []);
  const [webUpdate, setWebUpdate] = useState(false);
  useEffect(() => onWebUpdateReady(() => setWebUpdate(true)), []);

  const nw = netWorth(data.accounts, data.balances, rates, currency);
  const m = monthKey(today);
  const sum = summarise(data.txs, data.categories, monthStart(m), monthEnd(m), currency, rates);
  const setupDue = (needsSetup?.value as Record<string, boolean> | undefined)?.[profile.id];
  const backupDays = settings.lastBackupAt ? (Date.now() - settings.lastBackupAt) / 86400000 : Infinity;
  const showBackup = data.txs.length >= 5 && backupDays > (isNative() ? 14 : 7);
  const soon = data.upcoming.filter((u) => u.daysAway <= 31).slice(0, 6);

  return (
    <>
      <Topbar title={`Hi ${profile.name} ${profile.emoji ?? ''}`} right={<ProfileSwitch />} noBack />
      <div className="page">
        {webUpdate && (
          <button className="banner mint" style={{ width: '100%', border: 'none' }} onClick={applyWebUpdate}>
            <span>🎉</span>
            <span className="grow">A new version is ready. Tap to update.</span>
          </button>
        )}
        {setupDue && (
          <button className="banner pink" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => go({ name: 'setup' })}>
            <span>🌱</span>
            <span className="grow">Set your starting balances so totals are right</span>
            <span>›</span>
          </button>
        )}
        {showBackup && (
          <button className="banner" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => go({ name: 'settings' })}>
            <span>💾</span>
            <span className="grow">
              {Number.isFinite(backupDays) ? `Last backup ${Math.floor(backupDays)} days ago.` : 'No backup yet.'} Save one to Drive or Files.
            </span>
            <span>›</span>
          </button>
        )}

        <div className="hero">
          <span className="sparkle">🌸</span>
          <div className="label">Net worth</div>
          <div className="big">{fmtMoney(nw.total, currency)}</div>
          <div className="stat-row">
            <div className="stat">
              <div className="k">In this month</div>
              <div className="v pos">{fmtMoney(sum.income.total, currency, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Spent</div>
              <div className="v neg">{fmtMoney(sum.expense.total, currency, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Left over</div>
              <div className="v">{fmtMoney(sum.surplus, currency, { compact: true })}</div>
            </div>
          </div>
          {nw.missing.length > 0 && <div className="tiny mt">Not counted (no price): {nw.missing.join(', ')}</div>}
        </div>

        <div className="section-title">
          <span>⏰ Coming up</span>
          <span className="grow" />
          <button className="btn sm ghost" onClick={() => go({ name: 'recurring' })}>All ›</button>
        </div>
        {soon.length === 0 ? (
          <div className="card small muted">Nothing due in the next month. Add bills and subscriptions under More → Repeating.</div>
        ) : (
          <div className="list">
            {soon.map((u) => {
              const reserveAcc = u.reserveAccountId ? data.accountById.get(u.reserveAccountId) : undefined;
              return (
                <button
                  key={u.key}
                  className="row"
                  onClick={() => (u.source === 'card' ? go({ name: 'account', id: u.refId }) : go({ name: 'recurringEdit', id: u.refId }))}
                >
                  <div className={`bubble ${u.kind === 'income' ? 'mint' : u.overdue ? 'pink' : 'peach'}`}>
                    {u.kind === 'income' ? '💰' : u.source === 'card' ? '💳' : '🔔'}
                  </div>
                  <div className="main">
                    <div className="title">{u.label}</div>
                    <div className="sub">
                      {fmtDate(u.date, false)} · {u.overdue ? 'overdue!' : relativeDays(today, u.date)}
                      {reserveAcc ? ` · keep in ${reserveAcc.name}` : ''}
                    </div>
                  </div>
                  <div className="end">
                    <div className={`amt ${u.kind === 'income' ? 'pos' : ''}`}>{fmtMoney(u.amount, u.currency)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <PriceChips />

        <div className="section-title">
          <span>🧾 Recent</span>
          <span className="grow" />
          <button className="btn sm ghost" onClick={() => go({ name: 'txList', title: 'All entries' })}>All ›</button>
        </div>
        {data.txs.length === 0 ? (
          <div className="card center">
            <div style={{ fontSize: 40 }}>🐣</div>
            <div className="bold">No entries yet</div>
            <div className="small muted mb">Tap the pink + to log your first spending.</div>
          </div>
        ) : (
          <TxGroups txs={data.txs} limit={12} />
        )}
        <div className="center tiny muted mt">{currency} is your main currency · change it in Settings</div>
      </div>
    </>
  );
}
