// Notes you have typed before (car park, coffee…), offered again with the category, account and amount used last time.
import type { Tx, TxKind } from './types';

export interface NoteSuggestion {
  note: string;
  count: number;
  /** the most recent entry with this note */
  last: Tx;
}

/** Past notes of this kind: the ones that match what is typed (start of a word first), else the most used. */
export function noteSuggestions(txs: Tx[], kind: TxKind, typed: string, limit = 8): NoteSuggestion[] {
  const byNote = new Map<string, NoteSuggestion>();
  for (const t of txs) {
    const note = t.note?.trim();
    if (!note || t.kind !== kind) continue;
    const key = note.toLowerCase();
    const s = byNote.get(key);
    if (!s) byNote.set(key, { note, count: 1, last: t });
    else {
      s.count++;
      if (t.date > s.last.date || (t.date === s.last.date && t.createdAt > s.last.createdAt)) {
        s.last = t;
        s.note = note;
      }
    }
  }
  const q = typed.trim().toLowerCase();
  let list = [...byNote.values()];
  if (q) {
    list = list.filter((s) => s.note.toLowerCase().includes(q) && s.note.toLowerCase() !== q);
    const rank = (s: NoteSuggestion) => {
      const n = s.note.toLowerCase();
      return n.startsWith(q) ? 0 : n.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : 2;
    };
    list.sort((a, b) => rank(a) - rank(b) || b.count - a.count || (a.last.date < b.last.date ? 1 : -1));
  } else {
    list.sort((a, b) => b.count - a.count || (a.last.date < b.last.date ? 1 : -1));
  }
  return list.slice(0, limit);
}
