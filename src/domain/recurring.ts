// Repeating entries: when they fall due, which ones need recording, and monthly equivalents.
import { addDays, addMonthsClamped, diffDays, parseISO, type ISODate } from './dates';
import type { Freq } from './types';

export interface Schedule {
  freq: Freq;
  every: number;
  startDate: ISODate;
  endDate?: ISODate;
}

const MAX_STEPS = 20000;

/** The n-th occurrence (n = 0 is the start date). Monthly dates keep the start day, clamped to short months. */
export function occurrence(s: Schedule, n: number): ISODate {
  const every = Math.max(1, Math.floor(s.every || 1));
  const { y, m, d } = parseISO(s.startDate);
  switch (s.freq) {
    case 'day':
      return addDays(s.startDate, n * every);
    case 'week':
      return addDays(s.startDate, 7 * n * every);
    case 'month':
      return addMonthsClamped(y, m, d, n * every);
    case 'year':
      return addMonthsClamped(y, m, d, 12 * n * every);
  }
}

/** A starting index guaranteed to be at or before the first occurrence on/after `date`. */
function estimateIndex(s: Schedule, date: ISODate): number {
  const every = Math.max(1, Math.floor(s.every || 1));
  const days = diffDays(s.startDate, date);
  if (days <= 0) return 0;
  const per = s.freq === 'day' ? every : s.freq === 'week' ? 7 * every : s.freq === 'month' ? 31 * every : 366 * every;
  return Math.max(0, Math.floor(days / per) - 1);
}

/** First occurrence on or after `date`, or null if the schedule has ended. */
export function firstOnOrAfter(s: Schedule, date: ISODate): ISODate | null {
  for (let n = estimateIndex(s, date), k = 0; k < MAX_STEPS; n++, k++) {
    const o = occurrence(s, n);
    if (s.endDate && o > s.endDate) return null;
    if (o >= date) return o;
  }
  return null;
}

/** First occurrence strictly after `date`. */
export function firstAfter(s: Schedule, date: ISODate): ISODate | null {
  return firstOnOrAfter(s, addDays(date, 1));
}

/** Occurrences within [from, to], both inclusive. */
export function occurrencesBetween(s: Schedule, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let n = estimateIndex(s, from), k = 0; k < MAX_STEPS; n++, k++) {
    const o = occurrence(s, n);
    if (o > to || (s.endDate && o > s.endDate)) break;
    if (o >= from) out.push(o);
  }
  return out;
}

/** Occurrences that are due (on or before today) and have not been recorded yet. */
export function dueToPost(s: Schedule, lastPosted: ISODate | undefined, today: ISODate): ISODate[] {
  const from = lastPosted ? addDays(lastPosted, 1) : s.startDate;
  if (from > today) return [];
  return occurrencesBetween(s, from, today);
}

/** The next payment still to come: the first occurrence after the last one recorded. */
export function nextUnposted(s: Schedule, lastPosted: ISODate | undefined): ISODate | null {
  return lastPosted ? firstAfter(s, lastPosted) : firstOnOrAfter(s, s.startDate);
}

/**
 * The next payment is more than one repeat away from today (a monthly bill due in 11 months):
 * usually a start date typed with the wrong year, or the wrong "how often".
 */
export function nextDateLooksOdd(s: Schedule, next: ISODate | null, today: ISODate): boolean {
  if (!next || next <= today) return false;
  const every = Math.max(1, Math.floor(s.every || 1));
  const { y, m, d } = parseISO(today);
  const oneRepeat =
    s.freq === 'day'
      ? addDays(today, every)
      : s.freq === 'week'
        ? addDays(today, 7 * every)
        : addMonthsClamped(y, m, d, (s.freq === 'year' ? 12 : 1) * every);
  // a first payment that starts later on purpose is fine for the first time only when it is within one repeat
  return next > addDays(oneRepeat, 1);
}

/** Months in one repeat for bills that repeat less often than monthly (0 for monthly or more often). */
export function monthsPerRepeat(s: Schedule): number {
  const every = Math.max(1, Math.floor(s.every || 1));
  if (s.freq === 'year') return 12 * every;
  if (s.freq === 'month' && every > 1) return every;
  return 0;
}

/** Whole months from `a` to `b` (a day-of-month not yet reached does not count). */
export function wholeMonths(a: ISODate, b: ISODate): number {
  const x = parseISO(a);
  const y = parseISO(b);
  return (y.y - x.y) * 12 + (y.m - x.m) - (y.d < x.d ? 1 : 0);
}

/**
 * How many of a bill's months are set aside today: one share straight after it is paid, one more each month,
 * so the whole amount is there one month before it is due. Monthly (or more often) bills: always all of it.
 */
export function buildUp(s: Schedule, next: ISODate, today: ISODate): { months: number; of: number } {
  const of = monthsPerRepeat(s);
  if (!of || today >= next) return { months: of, of };
  const { y, m, d } = parseISO(next);
  const previous = addMonthsClamped(y, m, d, -of);
  return { months: Math.min(of, Math.max(1, wholeMonths(previous, today) + 1)), of };
}

/** Roughly how much this costs per month, to show how much to set aside. */
export function monthlyEquivalent(amount: number, freq: Freq, every: number): number {
  const e = Math.max(1, every || 1);
  switch (freq) {
    case 'day':
      return (amount * 365.25) / 12 / e;
    case 'week':
      return (amount * 365.25) / 7 / 12 / e;
    case 'month':
      return amount / e;
    case 'year':
      return amount / 12 / e;
  }
}

export function describeSchedule(freq: Freq, every: number): string {
  const e = Math.max(1, every || 1);
  const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[freq];
  if (e === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[freq];
  return `Every ${e} ${unit}s`;
}
