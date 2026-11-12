import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Mascot } from '../ui/Mascot';
import { holdProps } from '../components/hold';
import { CurrencySheet, ProgressBar, Sheet, Topbar, Sparkle, useFold } from '../components/ui';
import { limitLines, plannedSpending } from '../domain/limits';
import { categoryEmoji, groupColour, groupEmoji } from '../ui/emoji';
import { QuickActions } from '../components/QuickActions';
import { moveItem } from '../domain/groups';
import { saveTx, updateSettings } from '../db/repo';
import { PaydayCard } from './Payday';
import { ScheduledList, TxGroups } from '../components/TxRow';
import { freeLiquid, netWorth } from '../domain/balances';
import { addMonthKey, fmtAgo, fmtDate, fmtMonth, monthEnd, monthKey, monthStart } from '../domain/dates';
import { fmtMoney } from '../domain/money';
import { rateBetween } from '../domain/fx';
import { summarise } from '../domain/summary';
import { db } from '../db/db';
import { refreshPrices } from '../services/prices';
import { applyWebUpdate, installApk, latestRelease, onWebUpdateReady } from '../services/updater';
import { onNativeUpdateState, tryApplyNative, type NativeUpdateState } from '../services/autoUpdate';
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

/** Currencies on the price strip besides BTC and gold (which are always there). */
export function watchedCurrencies(watch: string[] | undefined, main: string): string[] {
  return (watch ?? ['USD']).filter((c, i, a) => c !== main && a.indexOf(c) === i);
}

function Change({ now, before }: { now: number | null; before: number | null }) {
  if (now === null || before === null || before === 0) return null;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.005) return null;
  return (
    <span className={pct > 0 ? 'up' : 'down'}>
      {' '}
      {pct > 0 ? '▲' : '▼'}
      {Math.abs(pct).toFixed(pct > -1 && pct < 1 ? 2 : 1)}%
    </span>
  );
}

function PriceChips() {
  const { prices, currency, toast, settings, today } = useApp();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  // the last saved prices from before today, for the ▲ ▼ change
  const prev = useLiveQuery(() => db.prices.where('date').below(today).last(), [today]);
  const now = { perUsd: prices.perUsd };
  const was = prev ? { perUsd: prev.perUsd } : null;
  const btcIn = (usd: number | undefined, rates: { perUsd: Record<string, number> } | null) =>
    usd && rates ? (rateBetween('USD', currency, rates) ?? 0) * usd : null;
  const btc =
    prices.btcPrice && prices.btcPriceCurrency
      ? (rateBetween(prices.btcPriceCurrency, currency, now) ?? 0) * prices.btcPrice
      : null;
  const watch = watchedCurrencies(settings.watchCurrencies, currency);
  const setWatch = (list: string[]) => updateSettings({ watchCurrencies: list });
  const updated = prices.btcFetchedAt ?? prices.ratesFetchedAt;
  return (
    <div className="card prices-card">
      <div className="chips">
        <span className="pill butter">
          BTC {fmtMoney(btc, currency, { dp: 0 })}
          <Change now={btc} before={btcIn(prev?.btcUsd, was)} />
        </span>
        {prices.goldBuyThb && (
          <span className="pill peach">
            ทอง {fmtMoney(prices.goldBuyThb, 'THB', { dp: 0 })}
            <Change now={prices.goldBuyThb} before={prev?.goldThb ?? null} />
          </span>
        )}
        {watch.map((c) => {
          const v = rateBetween(c, currency, now);
          return (
            <button key={c} className="pill sky" {...holdProps(() => setQuick(c))} onClick={() => setQuick(c)}>
              1 {c} = {fmtMoney(v, currency, { dp: v !== null && v < 1 ? 4 : 2 })}
              <Change now={v} before={was ? rateBetween(c, currency, was) : null} />
            </button>
          );
        })}
        <button className="pill add" aria-label="Watch another currency" onClick={() => setAdding(true)}>
          ＋
        </button>
      </div>
      <div className="between mt">
        <span className="tiny muted">
          {updated ? `Prices updated ${fmtAgo(updated)}` : 'Built-in prices until the first update'}
          {prev ? ` · ▲▼ since ${fmtDate(prev.date, false)}` : ''}
        </span>
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
      <CurrencySheet
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(c) => {
          if (c === currency) return toast(`${c} is your main currency`);
          setWatch([...watch.filter((x) => x !== c), c]);
          toast(`👀 Watching ${c}`);
        }}
      />
      {quick && (
        <QuickActions
          title={`1 ${quick} = ${fmtMoney(rateBetween(quick, currency, now), currency, { dp: 4 })}`}
          onClose={() => setQuick(null)}
          actions={[
            { label: `🗑️ Stop watching ${quick}`, tone: 'danger', run: () => setWatch(watch.filter((x) => x !== quick)) },
            {
              label: '⬅️ Move left',
              tone: 'plain',
              run: () => setWatch(moveItem(watch, quick, -1)),
            },
          ]}
        />
      )}
    </div>
  );
}

/** "💧 Liquid ฿… · Free ฿…": liquid money, and the part of it nothing is set aside for (bills, splits, targets). */
export function LiquidLine({ liquid }: { liquid: number }) {
  const { rates, currency } = useApp();
  const data = useData();
  const free = freeLiquid(
    data.accounts,
    data.balances,
    new Map([...data.claims].map(([id, c]) => [id, c.free])),
    data.cardCovered,
    rates,
    currency,
  );
  return (
    <div className="small bold mt">
      💧 Liquid {fmtMoney(liquid, currency)} · Free <span className={free < 0 ? 'neg' : ''}>{fmtMoney(free, currency)}</span>
    </div>
  );
}

/** Monthly limits you have set (none set = nothing shown): what is left and about how much a day. */
function LimitsCard() {
  const { currency, rates, today, profile, go } = useApp();
  const data = useData();
  const [open, toggle] = useFold('home.limits', true);
  const m = monthKey(today);
  const s = summarise(data.txs, data.categories, monthStart(m), monthEnd(m), currency, rates);
  const planned = plannedSpending(data.recurring, data.scheduled, data.accounts, monthStart(m), monthEnd(m), currency, rates);
  const lines = limitLines(s, data.categories, profile.groupLimits, today, monthEnd(m), planned);
  if (lines.length === 0) return null;
  const over = lines.filter((l) => l.level === 'over').length;
  return (
    <>
      <div className="section-title">
        <button className="fold-head" aria-expanded={open} onClick={toggle}>
          <span className="fold-arrow">{open ? '▾' : '▸'}</span> 🎯 Limits this month
        </button>
      </div>
      {!open ? (
        <button className="card fold-line" onClick={toggle}>
          {lines.length} {lines.length === 1 ? 'limit' : 'limits'}
          {over ? ` · ${over} over` : ' · all within'}
        </button>
      ) : (
        <div className="list">
          {lines.map((l) => (
            <button
              key={l.key}
              className="row"
              style={{ alignItems: 'flex-start' }}
              onClick={() =>
                l.category
                  ? go({ name: 'txList', categoryId: l.category.id, from: monthStart(m), to: monthEnd(m), title: l.name })
                  : go({ name: 'summary' })
              }
            >
              <div className={`bubble ${groupColour(l.group ?? '')}`}>
                {l.category ? categoryEmoji(l.category) : groupEmoji(l.name)}
              </div>
              <div className="main">
                <div className="between">
                  <span className="title">{l.name}</span>
                  <span className={`amt ${l.level === 'over' ? 'neg' : ''}`}>
                    {l.left >= 0 ? `${fmtMoney(l.left, currency)} left` : `${fmtMoney(-l.left, currency)} over`}
                  </span>
                </div>
                <div className="sub">
                  {fmtMoney(l.spent, currency)} of {fmtMoney(l.limit, currency)}
                  {l.planned > 0 && ` · ${fmtMoney(l.planned, currency)} coming up`}
                  {l.perDay !== null &&
                    ` · about ${fmtMoney(l.perDay, currency, { dp: 0 })} a day for ${l.daysLeft} ${l.daysLeft === 1 ? 'day' : 'days'}`}
                </div>
                <ProgressBar
                  value={l.limit > 0 ? l.spent / l.limit : 0}
                  planned={l.limit > 0 ? l.planned / l.limit : 0}
                  colour={l.level === 'ok' ? 'mint' : l.level}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Every entry of one month, newest day first, with ‹ › to look at other months. */
function MonthEntries() {
  const { today, currency, rates, go, skin } = useApp();
  const data = useData();
  const [month, setMonth] = useState(monthKey(today));
  const from = monthStart(month);
  const to = monthEnd(month);
  const list = data.txs.filter((t) => t.date >= from && t.date <= to);
  const sum = summarise(list, data.categories, from, to, currency, rates);
  const isNow = month === monthKey(today);
  return (
    <>
      <div className="section-title month-nav">
        <button className="btn sm ghost" aria-label="Previous month" onClick={() => setMonth(addMonthKey(month, -1))}>
          ‹
        </button>
        <span className="grow center">🧾 {fmtMonth(month)}</span>
        <button className="btn sm ghost" aria-label="Next month" disabled={isNow} onClick={() => setMonth(addMonthKey(month, 1))}>
          ›
        </button>
        <button className="btn sm ghost" onClick={() => go({ name: 'txList', title: 'All entries' })}>
          All ›
        </button>
      </div>
      {list.length > 0 && (
        <div className="small muted mb month-totals">
          In <b className="pos">{fmtMoney(sum.income.total, currency)}</b> · Out{' '}
          <b className="neg">{fmtMoney(sum.expense.total, currency)}</b> · {list.length} {list.length === 1 ? 'entry' : 'entries'}
        </div>
      )}
      {data.txs.length === 0 ? (
        <div className="card center">
          {skin.mascot ? (
            <Mascot kind={skin.mascot} pose="happy" size={72} />
          ) : (
            skin.empty && <div style={{ fontSize: 40 }}>{skin.empty}</div>
          )}
          <div className="bold">No entries yet</div>
          <div className="small muted mb">Tap + to log your first spending.</div>
        </div>
      ) : list.length === 0 ? (
        <div className="card center small muted">No entries in {fmtMonth(month)}.</div>
      ) : (
        <TxGroups txs={list} />
      )}
    </>
  );
}

/** The guide opens by itself at most once per app start (closing it must not bring it straight back). */
let guideAutoShown = false;

export function Home() {
  const { profile, currency, rates, go, today, settings, skin } = useApp();
  const data = useData();
  const needsSetup = useLiveQuery(() => db.kv.get('needsSetup'), []);
  const [webUpdate, setWebUpdate] = useState(false);
  const [nativeUpdate, setNativeUpdate] = useState<NativeUpdateState>('none');
  useEffect(() => onWebUpdateReady(() => setWebUpdate(true)), []);
  // someone new (nothing set up yet) sees the guide once; it can be reopened from More
  const isNew = !settings.guideSeen && data.accounts.length === 0;
  useEffect(() => {
    if (isNew && !guideAutoShown) {
      guideAutoShown = true;
      go({ name: 'guide' });
    }
  }, [isNew, go]);
  useEffect(() => onNativeUpdateState(setNativeUpdate), []);

  const nw = netWorth(data.accounts, data.balances, rates, currency);
  const m = monthKey(today);
  const sum = summarise(data.txs, data.categories, monthStart(m), monthEnd(m), currency, rates);
  const setupDue = (needsSetup?.value as Record<string, boolean> | undefined)?.[profile.id];
  const backupDays = settings.lastBackupAt ? (Date.now() - settings.lastBackupAt) / 86400000 : Infinity;
  const showBackup = data.txs.length >= 5 && backupDays > (isNative() ? 14 : 7);

  return (
    <>
      <Topbar
        title={`${skin.greeting} ${profile.name} ${skin.plain ? '' : (profile.emoji ?? '')}`}
        right={<ProfileSwitch />}
        noBack
      />
      <div className="page">
        <HomeBanner
          webUpdate={webUpdate}
          nativeUpdate={nativeUpdate}
          noAccounts={data.accounts.length === 0}
          setupDue={!!setupDue}
          backupDays={showBackup ? backupDays : null}
        />
        <OverdueCards />

        <div className="hero">
          <Sparkle k="home" />
          <div className="label">Net worth</div>
          <div className="big">{fmtMoney(nw.total, currency)}</div>
          <LiquidLine liquid={nw.liquid} />
          <div className="stat-row">
            <div className="stat">
              <div className="k">Income</div>
              <div className="v pos">{fmtMoney(sum.income.total, currency, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Spent</div>
              <div className="v neg">{fmtMoney(sum.expense.total, currency, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="k">Left over so far</div>
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

        <PaydayCard />
        <LimitsCard />
        <ScheduledList foldKey="home.scheduled" />
        <PriceChips />
        <MonthEntries />
      </div>
    </>
  );
}

/** Card statements past their due date: Pay opens the payment; Already paid records it in one tap (with Undo). */
function OverdueCards() {
  const { go, rates, currency, removeWithUndo, profile } = useApp();
  const data = useData();
  const overdue = data.upcoming.filter((u) => u.source === 'card' && u.overdue);
  if (overdue.length === 0) return null;
  return (
    <>
      {overdue.map((u) => {
        const card = data.accountById.get(u.refId);
        const from = card?.payFromAccountId ? data.accountById.get(card.payFromAccountId) : undefined;
        const pay = () =>
          go({
            name: 'entry',
            kind: 'transfer',
            accountId: card?.payFromAccountId,
            toAccountId: u.refId,
            amount: u.amount,
            note: `${card?.name ?? 'Card'} payment`,
          });
        // one tap only when the paying account is known and in the same currency; otherwise open the payment
        const quick = !!from && from.currency === u.currency;
        return (
          <div key={u.key} className="banner pink overdue">
            <span>💳</span>
            <span className="grow">
              {card?.name}: {fmtMoney(u.amount, u.currency)} was due {fmtDate(u.date, false)}
            </span>
            <span className="overdue-actions">
              <button className="btn sm" onClick={pay}>
                Pay
              </button>
              <button
                className="btn sm ghost"
                onClick={() =>
                  quick
                    ? void removeWithUndo(
                        () =>
                          saveTx(
                            {
                              profileId: profile.id,
                              date: u.date,
                              kind: 'transfer',
                              accountId: from!.id,
                              toAccountId: u.refId,
                              amount: u.amount,
                              toAmount: u.amount,
                              note: `${card?.name ?? 'Card'} payment`,
                            },
                            rates,
                            currency,
                          ).then(() => undefined),
                        `✅ Recorded: paid from ${from!.name} on ${fmtDate(u.date, false)}`,
                      )
                    : pay()
                }
              >
                Already paid
              </button>
            </span>
          </div>
        );
      })}
    </>
  );
}

/** Only the most important notice is shown, so the top of Home stays calm. */
function HomeBanner({
  webUpdate,
  nativeUpdate,
  noAccounts,
  setupDue,
  backupDays,
}: {
  webUpdate: boolean;
  nativeUpdate: NativeUpdateState;
  noAccounts: boolean;
  setupDue: boolean;
  backupDays: number | null;
}) {
  const { go, settings, toast } = useApp();
  let b: { cls: string; icon: string; text: string; onClick: () => void } | null = null;
  // Updates normally switch in by themselves; these show only if that had to wait.
  if (webUpdate) b = { cls: 'mint', icon: '🎉', text: 'A new version is ready. Tap to update now.', onClick: applyWebUpdate };
  else if (nativeUpdate === 'ready')
    b = { cls: 'mint', icon: '🎉', text: 'A new version is downloaded. Tap to switch now.', onClick: () => tryApplyNative(true) };
  else if (nativeUpdate === 'needsApk')
    b = {
      cls: 'mint',
      icon: '📲',
      text: 'A new Android app version is out. Tap to install it (your data stays).',
      onClick: async () => {
        toast('⬇️ Downloading…');
        try {
          await installApk(await latestRelease(settings.githubRepo), (s) => s && toast(s));
        } catch (e) {
          toast(`😿 ${(e as Error).message}`);
        }
      },
    };
  else if (noAccounts)
    b = {
      cls: 'pink',
      icon: '👛',
      text: 'Start by adding your first account, card or cash',
      onClick: () => go({ name: 'accountEdit' }),
    };
  else if (setupDue)
    b = { cls: 'pink', icon: '🌱', text: 'Set your starting balances so totals are right', onClick: () => go({ name: 'setup' }) };
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
