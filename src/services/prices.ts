// Live exchange rates and BTC price. Fetched when online; the last values are kept for offline use.
import { todayISO } from '../domain/dates';
import { GOLD_OZ_PER_BAHT } from '../domain/fx';
import type { PriceCache } from '../domain/types';
import { db } from '../db/db';
import { getPriceCache, setPriceCache } from '../db/repo';

const TIMEOUT_MS = 10000;
/** Don't refetch more often than this when the app is reopened. */
export const STALE_MS = 60 * 60 * 1000;

async function getJson(url: string): Promise<unknown> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const res = await Promise.race([
      fetch(url, { signal: ctrl?.signal, headers: { Accept: 'application/json' } }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS + 500)),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRates(): Promise<{ perUsd: Record<string, number>; source: string }> {
  try {
    const d = (await getJson('https://open.er-api.com/v6/latest/USD')) as { result?: string; rates?: Record<string, number> };
    if (d.result === 'success' && d.rates && d.rates.THB) return { perUsd: { ...d.rates, USD: 1 }, source: 'open.er-api.com' };
    throw new Error('bad response');
  } catch {
    const d = (await getJson('https://api.frankfurter.dev/v1/latest?base=USD')) as { rates?: Record<string, number> };
    if (d.rates && d.rates.THB) return { perUsd: { ...d.rates, USD: 1 }, source: 'frankfurter.dev' };
    throw new Error('No exchange-rate source answered');
  }
}

/** PAX Gold (1 token = 1 troy ounce of gold) in THB, kept for the gold estimate. */
let lastPaxgThb: number | undefined;

async function fetchBtc(perUsd: Record<string, number>): Promise<{ thb: number; usd: number; source: string }> {
  try {
    const d = (await getJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,pax-gold&vs_currencies=thb,usd')) as {
      bitcoin?: { thb?: number; usd?: number };
      'pax-gold'?: { thb?: number };
    };
    lastPaxgThb = d['pax-gold']?.thb;
    if (d.bitcoin?.thb && d.bitcoin?.usd) return { thb: d.bitcoin.thb, usd: d.bitcoin.usd, source: 'CoinGecko' };
    throw new Error('bad response');
  } catch {
    const d = (await getJson('https://api.bitkub.com/api/v3/market/ticker?sym=BTC_THB')) as { last?: string }[];
    const thb = Number(d?.[0]?.last);
    if (thb > 0) return { thb, usd: thb / (perUsd.THB || 1), source: 'Bitkub' };
    throw new Error('No BTC price source answered');
  }
}

function parseThb(x: unknown): number {
  return Number(String(x ?? '').replace(/,/g, '')) || 0;
}

/** Thai gold bar (96.5 %) price per baht-weight from the Gold Traders Association, or an estimate from world gold. */
async function fetchGold(): Promise<{ buy: number; sell: number; source: string; estimate: boolean }> {
  try {
    const d = (await getJson('https://api.chnwt.dev/thai-gold-api/latest')) as {
      status?: string;
      response?: { price?: { gold_bar?: { buy?: string; sell?: string } } };
    };
    const buy = parseThb(d.response?.price?.gold_bar?.buy);
    const sell = parseThb(d.response?.price?.gold_bar?.sell);
    if (buy > 1000 && sell > 1000) return { buy, sell, source: 'Gold Traders Association (via chnwt.dev)', estimate: false };
    throw new Error('bad response');
  } catch {
    if (!lastPaxgThb) throw new Error('No gold price source answered');
    const mid = lastPaxgThb * GOLD_OZ_PER_BAHT;
    // Thai shops buy about 0.2 % under and sell about 0.2 % over the middle price
    return { buy: Math.round((mid * 0.998) / 50) * 50, sell: Math.round((mid * 1.002) / 50) * 50, source: 'estimate from world gold price', estimate: true };
  }
}

let inFlight: Promise<{ ok: boolean; error?: string }> | null = null;

/** Download fresh rates and BTC price. Quietly does nothing when offline. */
export function refreshPrices(force = false): Promise<{ ok: boolean; error?: string }> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' };
      const cache = await getPriceCache();
      const fresh = cache.ratesFetchedAt && Date.now() - cache.ratesFetchedAt < STALE_MS;
      if (!force && fresh) return { ok: true };
      const next: PriceCache = { ...cache };
      const errors: string[] = [];
      try {
        const r = await fetchRates();
        next.perUsd = r.perUsd;
        next.ratesFetchedAt = Date.now();
        next.ratesSource = r.source;
      } catch (e) {
        errors.push(`Exchange rates: ${(e as Error).message}`);
      }
      try {
        const b = await fetchBtc(next.perUsd);
        next.btcPrice = b.thb;
        next.btcPriceCurrency = 'THB';
        next.btcUsd = b.usd;
        next.btcFetchedAt = Date.now();
        next.btcSource = b.source;
      } catch (e) {
        errors.push(`BTC price: ${(e as Error).message}`);
      }
      try {
        const g = await fetchGold();
        next.goldBuyThb = g.buy;
        next.goldSellThb = g.sell;
        next.goldSource = g.source;
        next.goldIsEstimate = g.estimate;
        next.goldFetchedAt = Date.now();
      } catch (e) {
        errors.push(`Gold price: ${(e as Error).message}`);
      }
      await setPriceCache(next);
      if (next.ratesFetchedAt || next.btcFetchedAt || next.goldFetchedAt) {
        await db.prices.put({ date: todayISO(), btcThb: next.btcPrice, btcUsd: next.btcUsd, goldThb: next.goldBuyThb, perUsd: next.perUsd });
      }
      return errors.length ? { ok: false, error: errors.join('; ') } : { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    } finally {
      setTimeout(() => (inFlight = null), 0);
    }
  })();
  return inFlight;
}

/** BTC price on or before a date (for month-end figures), falling back to the latest known. */
export async function btcPriceOn(date: string): Promise<{ thb?: number; usd?: number; date?: string }> {
  const snap = await db.prices.where('date').belowOrEqual(date).last();
  if (snap) return { thb: snap.btcThb, usd: snap.btcUsd, date: snap.date };
  const cache = await getPriceCache();
  return { thb: cache.btcPriceCurrency === 'THB' ? cache.btcPrice : undefined, usd: cache.btcUsd };
}
