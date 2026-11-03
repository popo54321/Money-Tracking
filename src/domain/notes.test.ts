import { describe, expect, it } from 'vitest';
import { noteSuggestions } from './notes';
import type { Tx } from './types';

let n = 0;
const tx = (note: string, date: string, amount = 50, kind: Tx['kind'] = 'expense', categoryId = 'c1'): Tx => ({
  id: String(n++),
  profileId: 'p',
  date,
  kind,
  accountId: 'a',
  amount,
  categoryId,
  note,
  value: amount,
  valueCurrency: 'THB',
  createdAt: n,
  updatedAt: n,
});

describe('note suggestions', () => {
  const txs = [
    tx('Car park', '2026-10-01', 40, 'expense', 'car'),
    tx('car park', '2026-10-20', 60, 'expense', 'car'),
    tx('Coffee', '2026-10-02', 65, 'expense', 'coffee'),
    tx('Coffee', '2026-10-03', 65, 'expense', 'coffee'),
    tx('Coffee', '2026-10-04', 70, 'expense', 'coffee'),
    tx('Iced coffee', '2026-10-05', 80),
    tx('Salary', '2026-10-25', 50000, 'income'),
  ];
  it('shows the most used notes first when nothing is typed', () => {
    expect(noteSuggestions(txs, 'expense', '').map((s) => s.note)).toEqual(['Coffee', 'car park', 'Iced coffee']);
  });
  it('matches what is typed, start of the note first, and remembers the last amount and category', () => {
    const s = noteSuggestions(txs, 'expense', 'co');
    expect(s.map((x) => x.note)).toEqual(['Coffee', 'Iced coffee']);
    expect(s[0].last.amount).toBe(70);
    const park = noteSuggestions(txs, 'expense', 'park')[0];
    expect(park.count).toBe(2);
    expect(park.last.amount).toBe(60);
    expect(park.last.categoryId).toBe('car');
  });
  it('keeps income and spending notes apart, and hides an exact match', () => {
    expect(noteSuggestions(txs, 'income', '').map((s) => s.note)).toEqual(['Salary']);
    expect(noteSuggestions(txs, 'expense', 'coffee').map((s) => s.note)).toEqual(['Iced coffee']);
  });
});
