// Notes typed before (car park, coffee…), offered again while typing. Only the words are remembered:
// the same thing is often paid with a different amount, account or card.

/**
 * Past notes that begin with what is typed (or have a word that does), ignoring capitals.
 * "Coffee" and "coffee" are one note, shown as it is spelled most often. Most used first.
 */
export function noteSuggestions(txs: { note?: string; date: string; createdAt: number }[], typed: string, limit = 50): string[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const byNote = new Map<string, { note: string; count: number; date: string; spellings: Map<string, number> }>();
  for (const t of txs) {
    const note = t.note?.trim().replace(/\s+/g, ' ');
    if (!note) continue;
    const key = note.toLowerCase();
    const s = byNote.get(key) ?? { note, count: 0, date: t.date, spellings: new Map<string, number>() };
    s.count++;
    if (t.date > s.date) s.date = t.date;
    s.spellings.set(note, (s.spellings.get(note) ?? 0) + 1);
    byNote.set(key, s);
  }
  // show each note the way it is written most often
  for (const s of byNote.values()) s.note = [...s.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const rank = (key: string) => (key.startsWith(q) ? 0 : key.split(' ').some((w) => w.startsWith(q)) ? 1 : -1);
  return [...byNote.entries()]
    .filter(([key]) => key !== q && rank(key) >= 0)
    .sort(([ka, a], [kb, b]) => rank(ka) - rank(kb) || b.count - a.count || (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map(([, s]) => s.note);
}
