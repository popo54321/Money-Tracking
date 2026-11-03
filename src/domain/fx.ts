// Currency conversion. Rates are stored as "units of currency per 1 USD", which is how
// the exchange-rate service publishes them. BTC is stored the same way (BTC per 1 USD).

export interface RateTable {
  /** units of each currency per 1 USD; USD itself is 1 */
  perUsd: Record<string, number>;
}

/** How many `to` you get for 1 `from`, or null when a rate is missing. */
export function rateBetween(from: string, to: string, table: RateTable): number | null {
  if (from === to) return 1;
  const a = table.perUsd[from];
  const b = table.perUsd[to];
  if (!a || !b) return null;
  return b / a;
}

export function convert(amount: number, from: string, to: string, table: RateTable): number | null {
  const r = rateBetween(from, to, table);
  return r === null ? null : amount * r;
}

/**
 * Build a rate table from an exchange-rate snapshot plus a BTC price.
 * The BTC rate is derived from its price in `btcPriceCurrency` so that, for example,
 * BTC → THB uses the THB price exactly.
 */
export function withBtc(
  perUsd: Record<string, number>,
  btcPrice: number | null,
  btcPriceCurrency: string,
  goldBahtThb?: number | null,
): RateTable {
  const out: Record<string, number> = { ...perUsd, USD: 1 };
  const c = out[btcPriceCurrency];
  if (btcPrice && btcPrice > 0 && c) out.BTC = c / btcPrice;
  if (goldBahtThb && goldBahtThb > 0 && out.THB) out[GOLD_CODE] = out.THB / goldBahtThb;
  return { perUsd: out };
}

/** Pseudo-currency for 1 baht-weight of 96.5 % Thai gold, so gold converts like any currency. */
export const GOLD_CODE = 'GOLD-BAHT';
/** 1 baht-weight = 15.244 g of 96.5 % gold; a troy ounce is 31.1034768 g. */
export const BAHT_WEIGHT_GRAMS = 15.244;
export const GOLD_OZ_PER_BAHT = (BAHT_WEIGHT_GRAMS * 0.965) / 31.1034768;

/** Currencies most useful to Popo, shown first in pickers. */
export const COMMON_CURRENCIES = ['THB', 'USD', 'EUR', 'CNY', 'JPY', 'GBP', 'SGD', 'HKD', 'KRW', 'TWD', 'AUD', 'MYR'];

/**
 * Built-in fallback rates (units per USD) from open.er-api.com, 3 Nov 2026.
 * Used only until the app downloads fresh rates for the first time.
 */
export const FALLBACK_RATES_DATE = '2026-11-03';
export const FALLBACK_PER_USD: Record<string, number> = {
  USD: 1, THB: 33.740315, EUR: 0.893269, CNY: 6.665393, JPY: 157.896122, GBP: 0.745737, SGD: 1.279119,
  HKD: 7.846694, KRW: 1344.12576, TWD: 32.589181, AUD: 1.427896, CAD: 1.39809, CHF: 0.819466, MYR: 4.070116,
  IDR: 18144.899424, VND: 25743.911696, PHP: 63.433344, INR: 94.928524, NZD: 1.779045, LAK: 22353.304465,
  MMK: 2098.633053, KHR: 4107.367979, AED: 3.6725, SEK: 9.77955, NOK: 9.291419, DKK: 6.667072,
};
/** BTC price in THB on the same date (CoinGecko). */
export const FALLBACK_BTC_THB = 2584489;
/** Thai gold bar price per baht-weight on the same date (Gold Traders Association). */
export const FALLBACK_GOLD_BUY_THB = 62550;
export const FALLBACK_GOLD_SELL_THB = 62750;
