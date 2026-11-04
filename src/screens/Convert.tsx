// Currency converter: any amount, any two currencies (and BTC), plus a list in other currencies.
// Works offline with the last saved rates.
import { useState } from 'react';
import { AmountField, CurrencySheet, Topbar } from '../components/ui';
import { fmtAgo } from '../domain/dates';
import { convert, GOLD_CODE, rateBetween } from '../domain/fx';
import { decimalsFor, fmtMoney, roundTo } from '../domain/money';
import { refreshPrices } from '../services/prices';
import { copyText } from '../services/platform';
import { useApp } from '../state/app';
import { watchedCurrencies } from './Home';

const KEY = 'convert.last';

function load(main: string): { amount: number; from: string; to: string } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.from === 'string' && typeof v.to === 'string') return v;
  } catch {
    // first time
  }
  return { amount: 100, from: main === 'USD' ? 'EUR' : 'USD', to: main };
}

/** A friendly number of decimals for a rate: more for tiny ones (e.g. 1 JPY = 0.2271 THB). */
function rateDp(v: number | null) {
  if (v === null) return 2;
  const a = Math.abs(v);
  return a >= 10 ? 2 : a >= 0.01 ? 4 : 8;
}

function show(v: number | null, cur: string) {
  if (cur === GOLD_CODE)
    return v === null ? '—' : `${roundTo(v, 4).toLocaleString('en-GB', { maximumFractionDigits: 4 })} baht-weight gold`;
  return fmtMoney(v, cur, { dp: cur === 'BTC' ? 8 : Math.max(decimalsFor(cur), v !== null && Math.abs(v) < 1 ? 4 : 0) });
}

export function Convert() {
  const { rates, prices, currency, settings, toast } = useApp();
  const [state, setState] = useState(() => load(currency));
  const [pick, setPick] = useState<'from' | 'to' | null>(null);
  const [busy, setBusy] = useState(false);
  const { amount, from, to } = state;
  const set = (patch: Partial<typeof state>) => {
    const next = { ...state, ...patch };
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // not remembered, still works
    }
  };

  const result = convert(amount, from, to, rates);
  const rate = rateBetween(from, to, rates);
  const back = rateBetween(to, from, rates);
  const others = [
    ...new Set([
      currency,
      ...watchedCurrencies(settings.watchCurrencies, currency),
      ...settings.favouriteCurrencies,
      'BTC',
      GOLD_CODE,
    ]),
  ].filter((c) => c !== from && c !== to && rates.perUsd[c]);
  const updated = prices.ratesFetchedAt;

  return (
    <>
      <Topbar title="Currency converter 💱" />
      <div className="page">
        <div className="card">
          <div className="cat-group-name">Amount</div>
          <div className="hstack">
            <div className="grow">
              <AmountField value={amount || null} onChange={(v) => set({ amount: v ?? 0 })} currency={from} title="Amount" />
            </div>
            <button className="btn" onClick={() => setPick('from')} aria-label="Convert from">
              {from} ▾
            </button>
          </div>
          <div className="center" style={{ margin: '8px 0' }}>
            <button className="btn sm ghost" aria-label="Swap currencies" onClick={() => set({ from: to, to: from })}>
              ⇅ Swap
            </button>
          </div>
          <div className="cat-group-name">In</div>
          <div className="hstack">
            <button
              className="grow convert-result"
              onClick={async () => {
                if (result === null) return;
                const ok = await copyText(String(roundTo(result, decimalsFor(to))));
                toast(ok ? `📋 Copied ${show(result, to)}` : 'Could not copy');
              }}
              aria-label="Copy the result"
            >
              {result === null ? 'No rate yet' : show(result, to)}
            </button>
            <button className="btn" onClick={() => setPick('to')} aria-label="Convert to">
              {to} ▾
            </button>
          </div>
          <div className="small muted mt">
            1 {from} = {rate === null ? '—' : show(rate, to).replace(/ baht-weight gold$/, ' baht-weight')}
            {to !== GOLD_CODE && from !== GOLD_CODE && back !== null && (
              <>
                {' '}
                · 1 {to} = {fmtMoney(back, from, { dp: rateDp(back) })}
              </>
            )}
          </div>
          <div className="tiny muted">Tap the result to copy it.</div>
        </div>

        {others.length > 0 && (
          <>
            <div className="section-title">Also in</div>
            <div className="list">
              {others.map((c) => {
                const v = convert(amount, from, c, rates);
                return (
                  <button key={c} className="row" onClick={() => set({ to: c })}>
                    <div className="main">
                      <div className="title">{c === GOLD_CODE ? 'ทอง Gold' : c}</div>
                      <div className="sub">tap to convert into {c === GOLD_CODE ? 'gold' : c}</div>
                    </div>
                    <div className="end">
                      <div className="amt">{show(v, c)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="between mt">
          <span className="tiny muted">
            {updated
              ? `Rates updated ${fmtAgo(updated)} · works offline`
              : 'Built-in rates until the first update · works offline'}
          </span>
          <button
            className="btn sm ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await refreshPrices(true);
              setBusy(false);
              toast(r.ok ? '✅ Rates updated' : r.error === 'offline' ? '📴 Offline, using saved rates' : `⚠️ ${r.error}`);
            }}
          >
            {busy ? '…' : '↻ Update'}
          </button>
        </div>
      </div>
      <CurrencySheet
        open={pick !== null}
        onClose={() => setPick(null)}
        value={pick === 'from' ? from : to}
        extra={['BTC']}
        onPick={(c) => (pick === 'from' ? set({ from: c }) : set({ to: c }))}
      />
    </>
  );
}
