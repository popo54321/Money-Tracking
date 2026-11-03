// Calendar dates are kept as 'YYYY-MM-DD' strings in the phone's local time.
// All arithmetic goes through UTC so daylight-saving changes never shift a day.

export type ISODate = string;
export type MonthKey = string; // 'YYYY-MM'

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function toISO(y: number, m: number, d: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function parseISO(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function isValidISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toUTC(s: ISODate): number {
  const { y, m, d } = parseISO(s);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(s: ISODate, n: number): ISODate {
  return fromUTC(toUTC(s) + n * 86400000);
}

/** Days from a to b (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

/** Add n months to (y, m) and place the result on anchorDay, clamped to the month's length. */
export function addMonthsClamped(y: number, m: number, anchorDay: number, n: number): ISODate {
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return toISO(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
}

/** The date in the given month whose day is `day`, clamped to the month's length. */
export function dayInMonth(y: number, m: number, day: number): ISODate {
  return toISO(y, m, Math.min(day, daysInMonth(y, m)));
}

export function monthKey(s: ISODate): MonthKey {
  return s.slice(0, 7);
}

export function monthStart(k: MonthKey): ISODate {
  return `${k}-01`;
}

export function monthEnd(k: MonthKey): ISODate {
  const [y, m] = k.split('-').map(Number);
  return toISO(y, m, daysInMonth(y, m));
}

export function addMonthKey(k: MonthKey, n: number): MonthKey {
  const [y, m] = k.split('-').map(Number);
  return addMonthsClamped(y, m, 1, n).slice(0, 7);
}

export function yearStart(y: number): ISODate {
  return toISO(y, 1, 1);
}

export function yearEnd(y: number): ISODate {
  return toISO(y, 12, 31);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthName(m: number, long = false): string {
  return (long ? MONTHS_LONG : MONTHS_SHORT)[m - 1];
}

export function weekdayName(s: ISODate): string {
  return WEEKDAYS[new Date(toUTC(s)).getUTCDay()];
}

/** '3 Nov 2026' */
export function fmtDate(s: ISODate, withYear = true): string {
  const { y, m, d } = parseISO(s);
  return withYear ? `${d} ${monthName(m)} ${y}` : `${d} ${monthName(m)}`;
}

/** 'November 2026' */
export function fmtMonth(k: MonthKey, long = true): string {
  const [y, m] = k.split('-').map(Number);
  return `${monthName(m, long)} ${y}`;
}

/** 'today', 'tomorrow', 'in 5 days', '2 days ago' */
export function relativeDays(from: ISODate, to: ISODate): string {
  const n = diffDays(from, to);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function fmtAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
