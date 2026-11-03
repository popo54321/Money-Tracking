/** -1 if a < b, 0 if equal, 1 if a > b (compares x.y.z numerically; anything after a dash is ignored). */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/, '')
    .replace(/-.*/, '')
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
  const pb = b
    .replace(/^v/, '')
    .replace(/-.*/, '')
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
