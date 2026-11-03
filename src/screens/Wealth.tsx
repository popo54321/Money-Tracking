import { useState } from 'react';
import { AmountField, Field, Seg, Sheet, Topbar } from '../components/ui';
import { fmtAgo } from '../domain/dates';
import { BAHT_WEIGHT_GRAMS } from '../domain/fx';
import { fmtMoney, fmtNumber } from '../domain/money';
import type { Account } from '../domain/types';
import { holdingStatus, isBtcAccount, isGoldAccount, type HoldingStatus } from '../domain/wealth';
import { db } from '../db/db';
import { updateSettings } from '../db/repo';
import { refreshPrices } from '../services/prices';
import { useApp, useData } from '../state/app';
import { ProfileSwitch } from './Home';

function CostSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const { currency, toast } = useApp();
  const [v, setV] = useState<number | null>(account.costBasis ?? null);
  return (
    <Sheet open onClose={onClose} title={`What the starting amount cost`}>
      <div className="small muted mb">
        {account.name} started with {fmtMoney(account.openingBalance, account.currency)}. How much did you pay for it in total? (Your “Capital Assets
        Value”.) Later buys are added automatically from your Move entries.
      </div>
      <Field label={`Cost in ${currency}`}>
        <AmountField value={v} onChange={setV} currency={currency} />
      </Field>
      <button
        className="btn primary block"
        onClick={async () => {
          await db.accounts.update(account.id, { costBasis: v ?? undefined });
          toast('✨ Saved');
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}

function HoldingCard({
  title,
  emoji,
  colour,
  status,
  unit,
  unitDp,
  priceLine,
  extra,
  onBuy,
  onCost,
}: {
  title: string;
  emoji: string;
  colour: string;
  status: HoldingStatus;
  unit: string;
  unitDp: number;
  priceLine: React.ReactNode;
  extra?: React.ReactNode;
  onBuy: () => void;
  onCost: (a: Account) => void;
}) {
  const { currency, go } = useApp();
  const pl = status.profit;
  return (
    <div className="card">
      <div className="between">
        <h2 style={{ margin: 0 }}>
          {emoji} {title}
        </h2>
        <span className={`pill ${colour}`}>{priceLine}</span>
      </div>
      <div className="stat-row mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat" style={{ background: 'var(--bg2)' }}>
          <div className="k">Holding</div>
          <div className="v">
            {fmtNumber(status.units, unitDp, Math.min(unitDp, 2))} {unit}
          </div>
        </div>
        <div className="stat" style={{ background: 'var(--bg2)' }}>
          <div className="k">Worth now</div>
          <div className="v">{fmtMoney(status.value, currency, { compact: true })}</div>
        </div>
        <div className="stat" style={{ background: 'var(--bg2)' }}>
          <div className="k">Paid (capital)</div>
          <div className="v">{status.cost > 0 ? fmtMoney(status.cost, currency, { compact: true }) : '—'}</div>
        </div>
        <div className="stat" style={{ background: 'var(--bg2)' }}>
          <div className="k">Profit / loss</div>
          <div className={`v ${pl === null ? '' : pl >= 0 ? 'pos' : 'neg'}`}>
            {pl === null ? '—' : `${fmtMoney(pl, currency, { compact: true, sign: true })} (${fmtNumber((status.profitPct ?? 0) * 100, 1, 1)}%)`}
          </div>
        </div>
      </div>
      {status.avgCost !== null && (
        <div className="small muted mt">
          Average cost {fmtMoney(status.avgCost, currency, { dp: 0 })} per {unit === 'BTC' ? 'BTC' : 'baht-weight'}
        </div>
      )}
      {extra}
      {status.lines.length > 0 && (
        <div className="mt">
          {status.lines.map((l) => (
            <div key={l.account.id} className="item-line">
              <button className="grow" style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0 }} onClick={() => go({ name: 'account', id: l.account.id })}>
                <div className="bold small">{l.account.name}</div>
                <div className="tiny muted">
                  {fmtNumber(l.units, unitDp, Math.min(unitDp, 2))} {unit} · paid {l.cost > 0 ? fmtMoney(l.cost, currency, { compact: true }) : '—'}
                </div>
              </button>
              <span className="small bold nowrap">{fmtMoney(l.value, currency, { compact: true })}</span>
              {l.account.openingBalance !== 0 && (
                <button className="btn sm ghost" onClick={() => onCost(l.account)} aria-label="Set starting cost">
                  ✏️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <button className={`btn ${colour} block mt`} onClick={onBuy}>
        ＋ Buy {title === 'Bitcoin' ? 'BTC' : 'gold'}
      </button>
    </div>
  );
}

export function Wealth() {
  const { rates, currency, prices, settings, go, toast } = useApp();
  const data = useData();
  const [busy, setBusy] = useState(false);
  const [costFor, setCostFor] = useState<Account | null>(null);
  const live = data.accounts.filter((a) => !a.archived);
  const btcAccounts = live.filter(isBtcAccount);
  const goldAccounts = live.filter(isGoldAccount);
  const btc = holdingStatus(btcAccounts, data.txs, rates, currency);
  const gold = holdingStatus(goldAccounts, data.txs, rates, currency);
  const total = (btc.value ?? 0) + (gold.value ?? 0);
  const side = settings.goldPriceSide ?? 'buy';
  const btcPrice = rates.perUsd.BTC ? (rates.perUsd[currency] ?? 0) / rates.perUsd.BTC : null;
  const goldPrice = side === 'sell' ? prices.goldSellThb : prices.goldBuyThb;
  const bank = live.find((a) => a.type === 'bank' || a.type === 'cash');

  return (
    <>
      <Topbar title="Wealth preserve 🪙" right={<ProfileSwitch />} />
      <div className="page">
        <div className="hero">
          <span className="sparkle">🏺</span>
          <div className="label">BTC + gold worth now</div>
          <div className="big">{fmtMoney(total, currency)}</div>
          <div className="small bold">
            {[btc.cost + gold.cost > 0 ? `paid ${fmtMoney(btc.cost + gold.cost, currency, { compact: true })}` : '', btc.profit !== null || gold.profit !== null ? `profit ${fmtMoney((btc.profit ?? 0) + (gold.profit ?? 0), currency, { compact: true, sign: true })}` : '']
              .filter(Boolean)
              .join(' · ') ||
              (btcAccounts.length + goldAccounts.length === 0
                ? 'Add a Bitcoin or Gold account to see it here'
                : 'Tap ✏️ next to an account to add what you paid, to see profit')}
          </div>
        </div>

        <HoldingCard
          title="Bitcoin"
          emoji="🪙"
          colour="butter"
          status={btc}
          unit="BTC"
          unitDp={8}
          priceLine={<>1 BTC = {fmtMoney(btcPrice, currency, { dp: 0 })}</>}
          extra={<div className="tiny muted">{prices.btcFetchedAt ? `${prices.btcSource}, ${fmtAgo(prices.btcFetchedAt)}` : 'built-in price until first update'}</div>}
          onBuy={() =>
            btcAccounts[0]
              ? go({ name: 'entry', kind: 'transfer', accountId: bank?.id, toAccountId: btcAccounts[0].id, note: 'Buy BTC' })
              : go({ name: 'accountEdit' })
          }
          onCost={setCostFor}
        />

        <HoldingCard
          title="Gold"
          emoji="🥇"
          colour="peach"
          status={gold}
          unit="บาท"
          unitDp={4}
          priceLine={<>ทองบาทละ {fmtMoney(goldPrice ?? null, 'THB', { dp: 0 })}</>}
          extra={
            <>
              <div className="small mt">
                Gold bar 96.5%: shop buys {fmtMoney(prices.goldBuyThb ?? null, 'THB', { dp: 0 })} · sells {fmtMoney(prices.goldSellThb ?? null, 'THB', { dp: 0 })} per baht
                {gold.units ? ` · you hold ${fmtNumber(gold.units * BAHT_WEIGHT_GRAMS, 2)} g` : ''}
              </div>
              <div className="tiny muted">
                {prices.goldFetchedAt ? `${prices.goldSource}, ${fmtAgo(prices.goldFetchedAt)}` : prices.goldSource ?? 'built-in price'}
                {prices.goldIsEstimate ? ' (estimate)' : ''}
              </div>
              <div className="mt">
                <Seg
                  value={side}
                  onChange={(v) => updateSettings({ goldPriceSide: v })}
                  options={[
                    { v: 'buy', label: 'Value at shop’s buy price' },
                    { v: 'sell', label: 'at sell price' },
                  ]}
                />
              </div>
            </>
          }
          onBuy={() =>
            goldAccounts[0]
              ? go({ name: 'entry', kind: 'transfer', accountId: bank?.id, toAccountId: goldAccounts[0].id, note: 'Buy gold' })
              : go({ name: 'accountEdit' })
          }
          onCost={setCostFor}
        />

        <button
          className="btn sky block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await refreshPrices(true);
            setBusy(false);
            toast(r.ok ? '🌈 Prices updated' : r.error === 'offline' ? '📴 Offline, using saved prices' : `😿 ${r.error}`);
          }}
        >
          ↻ Update BTC & gold prices
        </button>
        <div className="tiny muted center mt">
          Buy with “Move”: money out of your bank, BTC or baht-weight into the holding account. Costs are averaged, so selling part keeps your average cost.
        </div>
      </div>
      {costFor && <CostSheet account={costFor} onClose={() => setCostFor(null)} />}
    </>
  );
}
