// The order of the big headings (account groups, spending groups), which each person can change.

/** Puts `groups` in the saved order; groups never arranged keep their usual place after the arranged ones. */
export function orderGroups(groups: string[], saved: string[] = []): string[] {
  const uniq = [...new Set(groups)];
  const rank = (g: string) => {
    const i = saved.indexOf(g);
    return i < 0 ? saved.length + uniq.indexOf(g) : i;
  };
  return uniq.sort((a, b) => rank(a) - rank(b));
}

/** Moves one entry of a list up (-1) or down (+1); returns the list unchanged at either end. */
export function moveItem<T>(list: T[], item: T, dir: -1 | 1): T[] {
  const i = list.indexOf(item);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
