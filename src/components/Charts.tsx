// Two small charts for Month close: income against spending (bars) and net worth over time (line).
// Plain SVG; tap a month to see its numbers. Colours are the two validated chart colours (--series-1/2).
import { useState } from 'react';
import { fmtMonth, type MonthKey } from '../domain/dates';
import { fmtMoney } from '../domain/money';

const W = 340;
const H = 150;
const PAD = { l: 44, r: 8, t: 10, b: 22 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

function shortMonth(m: MonthKey) {
  return fmtMonth(m).split(' ')[0].slice(0, 3);
}

/** A "nice" top for the scale and three gridlines (0, half, top). */
function niceTop(max: number) {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * mag >= max) return k * mag;
  return 10 * mag;
}

/** Bar with rounded top corners only, standing on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Axis labels: 60k, 1.2M. */
function shortNum(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${sign}${Math.round(a)}`;
}

function Grid({ top, min = 0 }: { top: number; min?: number }) {
  const ticks = [min, (min + top) / 2, top];
  const y = (v: number) => PAD.t + plotH - ((v - min) / (top - min || 1)) * plotH;
  return (
    <g className="viz-grid">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end">
            {shortNum(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

export interface BarMonth {
  month: MonthKey;
  income: number;
  spending: number;
}

export function IncomeSpendingChart({ data, currency }: { data: BarMonth[]; currency: string }) {
  const [sel, setSel] = useState(data.length - 1);
  const top = niceTop(Math.max(0, ...data.flatMap((d) => [d.income, d.spending])));
  const slot = plotW / data.length;
  const bw = Math.min(16, (slot - 10) / 2);
  const h = (v: number) => (Math.max(0, v) / top) * plotH;
  const cur = data[sel];
  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-key">
          <i className="s1" /> Income
        </span>
        <span className="viz-key">
          <i className="s2" /> Spending
        </span>
      </div>
      {cur && (
        <div className="viz-tip">
          <b>{fmtMonth(cur.month)}</b> · In {fmtMoney(cur.income, currency)} · Out {fmtMoney(cur.spending, currency)} · Left{' '}
          {fmtMoney(cur.income - cur.spending, currency)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income and spending for each month">
        <Grid top={top} />
        {data.map((d, i) => {
          const x = PAD.l + i * slot + (slot - (bw * 2 + 2)) / 2;
          const base = PAD.t + plotH;
          return (
            <g key={d.month} className={i === sel ? 'on' : ''}>
              <path className="s1" d={barPath(x, base - h(d.income), bw, h(d.income))} />
              <path className="s2" d={barPath(x + bw + 2, base - h(d.spending), bw, h(d.spending))} />
              <text className="viz-x" x={PAD.l + i * slot + slot / 2} y={H - 6} textAnchor="middle">
                {shortMonth(d.month)}
              </text>
              {/* tap target wider than the bars */}
              <rect
                className="viz-hit"
                x={PAD.l + i * slot}
                y={PAD.t}
                width={slot}
                height={plotH + PAD.b}
                onClick={() => setSel(i)}
                onPointerEnter={() => setSel(i)}
              >
                <title>
                  {fmtMonth(d.month)}: in {fmtMoney(d.income, currency)}, out {fmtMoney(d.spending, currency)}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface LineMonth {
  month: MonthKey;
  value: number | null;
}

export function NetWorthChart({ data, currency }: { data: LineMonth[]; currency: string }) {
  const pts = data.filter((d) => d.value !== null) as { month: MonthKey; value: number }[];
  const [sel, setSel] = useState<MonthKey | null>(null);
  if (pts.length === 0) return <div className="tiny muted">Net worth shows once you have accounts.</div>;
  const vals = pts.map((p) => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  // start from 0 unless everything sits far above it, so small changes stay visible
  const min = rawMin > 0 && rawMin > rawMax * 0.6 ? rawMin * 0.9 : Math.min(0, rawMin);
  const top = min + niceTop(rawMax - min || Math.abs(rawMax) || 1);
  const slot = plotW / data.length;
  const x = (m: MonthKey) => PAD.l + data.findIndex((d) => d.month === m) * slot + slot / 2;
  const y = (v: number) => PAD.t + plotH - ((v - min) / (top - min || 1)) * plotH;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month)},${y(p.value)}`).join('');
  const shown = pts.find((p) => p.month === sel) ?? pts[pts.length - 1];
  const first = pts[0];
  return (
    <div className="viz">
      <div className="viz-tip">
        <b>{fmtMonth(shown.month)}</b> · {fmtMoney(shown.value, currency)}
        {shown !== first && (
          <span className={shown.value >= first.value ? 'pos' : 'neg'}>
            {' '}
            ({shown.value >= first.value ? '▲' : '▼'} {fmtMoney(Math.abs(shown.value - first.value), currency, { compact: true })}{' '}
            since {shortMonth(first.month)})
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net worth at the end of each month">
        <Grid top={top} min={min} />
        <path className="viz-line" d={line} />
        {pts.map((p) => (
          <circle
            key={p.month}
            className={`viz-dot ${p.month === shown.month ? 'on' : ''}`}
            cx={x(p.month)}
            cy={y(p.value)}
            r={4}
          />
        ))}
        {data.map((d, i) => (
          <g key={d.month}>
            {((data.length - 1 - i) % 2 === 0 || data.length <= 6) && (
              <text className="viz-x" x={PAD.l + i * slot + slot / 2} y={H - 6} textAnchor="middle">
                {shortMonth(d.month)}
              </text>
            )}
            {d.value !== null && (
              <rect
                className="viz-hit"
                x={PAD.l + i * slot}
                y={PAD.t}
                width={slot}
                height={plotH + PAD.b}
                onClick={() => setSel(d.month)}
                onPointerEnter={() => setSel(d.month)}
              >
                <title>
                  {fmtMonth(d.month)}: {fmtMoney(d.value, currency)}
                </title>
              </rect>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
