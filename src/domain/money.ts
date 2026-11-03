// Rounding, formatting and fair splitting of money amounts.

const ZERO_DECIMALS = new Set(['JPY', 'KRW', 'VND', 'IDR', 'LAK', 'KHR', 'MMK', 'CLP', 'ISK', 'HUF', 'TWD', 'UGX', 'PYG']);

export function decimalsFor(currency: string): number {
  if (currency === 'BTC') return 8;
  if (ZERO_DECIMALS.has(currency)) return 0;
  return 2;
}

export function roundTo(x: number, dp: number): number {
  const f = 10 ** dp;
  const r = Math.round(Math.abs(x) * f + 1e-9) / f;
  return x < 0 ? -r : r;
}

const SYMBOLS: Record<string, string> = {
  THB: '฿',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  JPY: '¥',
  KRW: '₩',
  BTC: '₿',
  INR: '₹',
  VND: '₫',
  PHP: '₱',
  LAK: '₭',
  TWD: 'NT$',
  HKD: 'HK$',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
};

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(minDp: number, maxDp: number): Intl.NumberFormat {
  const k = `${minDp}-${maxDp}`;
  let f = nfCache.get(k);
  if (!f) {
    f = new Intl.NumberFormat('en-GB', { minimumFractionDigits: minDp, maximumFractionDigits: maxDp });
    nfCache.set(k, f);
  }
  return f;
}

export function fmtNumber(x: number, dp = 2, minDp = dp): string {
  return nf(minDp, dp).format(roundTo(x, dp) + 0);
}

export interface FmtOpts {
  /** Show + for positive values. */
  sign?: boolean;
  /** Hide decimals for whole numbers. */
  compact?: boolean;
  /** Override decimals. */
  dp?: number;
}

/** '฿1,234.50', '-$12.00', '0.00512345 BTC', '3 GOLD' */
export function fmtMoney(x: number | null | undefined, currency: string, opts: FmtOpts = {}): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const dp = opts.dp ?? decimalsFor(currency);
  const minDp = opts.compact && Math.abs(roundTo(x, dp) % 1) < 1e-9 ? 0 : currency === 'BTC' ? Math.min(dp, 8) : dp;
  const abs = nf(minDp, dp).format(Math.abs(roundTo(x, dp)));
  const neg = roundTo(x, dp) < 0;
  const signStr = neg ? '-' : opts.sign && x > 0 ? '+' : '';
  const sym = SYMBOLS[currency];
  if (currency === 'BTC') return `${signStr}${abs} BTC`;
  if (sym) return `${signStr}${sym}${abs}`;
  return `${signStr}${abs} ${currency}`;
}

/**
 * Split `total` into parts proportional to `weights` so the parts, rounded to `dp` decimals,
 * add up exactly to `total` rounded to `dp` (largest-remainder method).
 * If every weight is 0, the total is split evenly.
 */
export function allocate(total: number, weights: number[], dp = 2): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const unit = 10 ** dp;
  const totalUnits = Math.round(roundTo(total, dp) * unit);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const w = wSum === 0 ? weights.map(() => 1) : weights;
  const sum = wSum === 0 ? n : wSum;
  const raw = w.map((x) => (totalUnits * x) / sum);
  const floors = raw.map((x) => Math.floor(x + 1e-9));
  let rest = totalUnits - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = floors.slice();
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) out[order[k].i] += 1;
  for (let k = 0; rest < 0; k = (k + 1) % n, rest++) out[order[n - 1 - k].i] -= 1;
  return out.map((u) => u / unit);
}

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}
