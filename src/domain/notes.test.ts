import { describe, expect, it } from 'vitest';
import { noteSuggestions } from './notes';

let n = 0;
const tx = (note: string, date: string) => ({ note, date, createdAt: n++ });

describe('note suggestions', () => {
  const txs = [
    tx('Car park', '2026-10-01'),
    tx('car park', '2026-10-20'),
    tx('Coffee', '2026-10-02'),
    tx('coffee', '2026-10-03'),
    tx('Coffee', '2026-10-01'),
    tx('Iced coffee', '2026-10-05'),
    tx('Cake', '2026-10-06'),
    tx('Salary', '2026-10-25'),
  ];
  it('shows nothing until something is typed', () => {
    expect(noteSuggestions(txs, '')).toEqual([]);
  });
  it('ignores capitals: one Coffee, spelled the usual way, most used first', () => {
    expect(noteSuggestions(txs, 'c')).toEqual(['Coffee', 'Car park', 'Cake', 'Iced coffee']);
    expect(noteSuggestions(txs, 'CO')).toEqual(['Coffee', 'Iced coffee']);
  });
  it('matches the start of a word, not the middle', () => {
    expect(noteSuggestions(txs, 'park')).toEqual(['Car park']);
    expect(noteSuggestions(txs, 'ffee')).toEqual([]);
  });
  it('hides a note already typed in full', () => {
    expect(noteSuggestions(txs, 'coffee')).toEqual(['Iced coffee']);
  });
});
