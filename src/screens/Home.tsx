import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Mascot } from '../ui/Mascot';
import { holdProps } from '../components/hold';
import { Sheet, Topbar, Sparkle } from '../components/ui';
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
  const { profiles, profile, setProfile, stackDepth, go } = useApp();
  const [open, setOpen] = useState(false);
  if (profiles.length < 2) return null;
  const compact = stackDepth > 1;
  if (profiles.length > 2 || compact) {
    return (
      <>
        <div className="profile-switch">
          <button className="on" onClick={() => setOpen(true)} aria-label={`User: ${profile.name}. Change user`}>
            {profile.emoji ?? '🙂'}
            {compact ? '' : ` ${profile.name}`} ▾
          </button>
        </div>
        <Sheet open={open} onClose={() => setOpen(false)} title="✨ Whose money?">
          <div className="list">
            {profiles.map((p) => (
              <button
                key={p.id}
                className="row"
                onClick={() => {
                  setProfile(p.id);
                  setOpen(false);
                }}
                {...holdProps(() => {
                  setOpen(false);
                  go({ name: 'settings' });
                })}
              >
                <div className="bubble lav">{p.emoji ?? '🙂'}</div>
                <div className="main">
                  <div className="title">{p.name}</div>
                </div>
                {p.id === profile.id && <div className="end bold">✓</div>}
              </button>
            ))}
          </div>
        </Sheet>
      </>
    );
  }
  return (
    <div className="profile-switch" role="tablist" aria-label="Whose money">
      {profiles.map((p) => (
        <button
          key={p.id}
          className={p.id === profile.id ? 'on' : ''}
          onClick={() => setProfile(p.id)}
          {...holdProps(() => go({ name: 'settings' }))}
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
    <div className="card prices-card">
      <div className="chips">
        <span className="pill butter">BTC {fmtMoney(btc, currency, { dp: 0 })}</span>
        {prices.goldBuyThb && <span className="pill peach">ทอง {fmtMoney(prices.goldBuyThb, 'THB', { dp: 0 })}</span>}
        {usd && <span className="pill sky">$1 = {fmtMoney(usd, currency)}</span>}
      </div>
      <div className="between mt">
        <span className="tiny muted">{updated ? `Prices updated ${fmtAgo(updated)}` : 'Built-in prices until the first update'}</span>
        <button
          className="btn sm ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await refreshPrices(true);
            setBusy(false);
            toast(r.ok ? '✅ Prices updated' : r.error === 'offline' ? '📴 Offline, using saved prices' : `⚠️ ${r.error}`);
          }}
        >
          {busy ? '…' : '↻ Update'}
        </button>
      </div>
    </div>
  );
}

export function Home() {
  const { profile, currency, rates, go, today, settings, skin } = useApp();
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
  const soon = data.upcoming.filter((u) => u.daysAway <= 31).slice(0, 4);

  return (
    <>
      <Topbar title={`${skin.greeting} ${profile.name} ${skin.plain ? '' : profile.emoji ?? ''}`} right={<ProfileSwitch />} noBack />
      <div className="page">
        <HomeBanner
          webUpdate={webUpdate}
          noAccounts={data.accounts.length === 0}
          setupDue={!!setupDue}
          backupDays={showBackup ? backupDays : null}
        />

        <div className="hero">
          <Sparkle k="home" />
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

        <div className="quick-actions">
          <button className="btn pink" onClick={() => go({ name: 'entry', kind: 'expense' })}>
            − Spend
          </button>
          <button className="btn mint" onClick={() => go({ name: 'entry', kind: 'income' })}>
            + Income
          </button>
          <button className="btn" onClick={() => go({ name: 'entry', kind: 'transfer' })}>
            ⇄ Move
          </button>
        </div>

        {soon.length > 0 && (
          <>
        <div className="section-title">
          <span>⏰ Coming up</span>
          <span className="grow" />
          <button className="btn sm ghost" onClick={() => go({ name: 'recurring' })}>All ›</button>
        </div>
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

          </>
        )}

        <div className="section-title">
          <span>🧾 Recent</span>
          <span className="grow" />
          <button className="btn sm ghost" onClick={() => go({ name: 'txList', title: 'All entries' })}>All ›</button>
        </div>
        {data.txs.length === 0 ? (
          <div className="card center">
            {skin.mascot ? <Mascot kind={skin.mascot} pose="happy" size={72} /> : skin.empty && <div style={{ fontSize: 40 }}>{skin.empty}</div>}
            <div className="bold">No entries yet</div>
            <div className="small muted mb">Tap + to log your first spending.</div>
          </div>
        ) : (
          <TxGroups txs={data.txs} limit={8} />
        )}
        <PriceChips />
      </div>
    </>
  );
}

/** Only the most important notice is shown, so the top of Home stays calm. */
function HomeBanner({ webUpdate, noAccounts, setupDue, backupDays }: { webUpdate: boolean; noAccounts: boolean; setupDue: boolean; backupDays: number | null }) {
  const { go } = useApp();
  let b: { cls: string; icon: string; text: string; onClick: () => void } | null = null;
  if (webUpdate) b = { cls: 'mint', icon: '🎉', text: 'A new version is ready. Tap to update.', onClick: applyWebUpdate };
  else if (noAccounts) b = { cls: 'pink', icon: '👛', text: 'Start by adding your first account, card or cash', onClick: () => go({ name: 'accountEdit' }) };
  else if (setupDue) b = { cls: 'pink', icon: '🌱', text: 'Set your starting balances so totals are right', onClick: () => go({ name: 'setup' }) };
  else if (backupDays !== null)
    b = {
      cls: '',
      icon: '💾',
      text: `${Number.isFinite(backupDays) ? `Last backup ${Math.floor(backupDays)} days ago.` : 'No backup yet.'} Save one to Drive or Files.`,
      onClick: () => go({ name: 'settings' }),
    };
  if (!b) return null;
  return (
    <button className={`banner ${b.cls}`} style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={b.onClick}>
      <span>{b.icon}</span>
      <span className="grow">{b.text}</span>
      <span>›</span>
    </button>
  );
}
