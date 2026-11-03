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
