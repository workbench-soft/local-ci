import type { ReactNode } from 'react';
import { formatDuration } from '@/status/durations';
import type { Spread, TrendDay } from '@/status/trends';

const width = 720;
const height = 200;
const pad = { top: 12, right: 8, bottom: 24, left: 44 };
const plotW = width - pad.left - pad.right;
const plotH = height - pad.top - pad.bottom;

/** The smallest of 1, 2 or 5 times a power of ten at or above the value. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((step) => step * power).find((step) => step >= value) ?? 10 * power;
}

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

/** A column with a rounded data end, square at the baseline. */
function topRounded(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function Frame({
  days,
  max,
  tick,
  children,
}: {
  days: TrendDay[];
  max: number;
  tick: (v: number) => string;
  children: ReactNode;
}) {
  const band = plotW / days.length;
  const every = Math.ceil(days.length / 8);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      {[0, max / 2, max].map((value) => {
        const y = pad.top + plotH - (value / max) * plotH;
        return (
          <g key={value}>
            <line className={value ? 'grid-line' : 'base-line'} x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
            <text className="axis" x={pad.left - 6} y={y + 4} textAnchor="end">
              {tick(value)}
            </text>
          </g>
        );
      })}
      {days.map((day, i) =>
        (days.length - 1 - i) % every === 0 ? (
          <text key={day.key} className="axis" x={pad.left + band * (i + 0.5)} y={height - 6} textAnchor="middle">
            {dayLabel(day.key)}
          </text>
        ) : null,
      )}
      {children}
    </svg>
  );
}

const parts = [
  { key: 'failure', label: 'failed' },
  { key: 'success', label: 'passed' },
  { key: 'cancelled', label: 'cancelled' },
] as const;

/** Runs a day, stacked from the baseline: failed, passed, cancelled. */
export function OutcomeColumns({ days }: { days: TrendDay[] }) {
  const max = niceMax(Math.max(...days.map((day) => day.success + day.failure + day.cancelled)));
  const band = plotW / days.length;
  const barW = Math.min(24, band * 0.7);
  const scale = plotH / max;
  return (
    <Frame days={days} max={max} tick={(value) => String(value)}>
      {days.map((day, i) => {
        const x = pad.left + band * i + (band - barW) / 2;
        let y = pad.top + plotH;
        const shown = parts.filter((part) => day[part.key] > 0);
        return (
          <g key={day.key}>
            {shown.map((part, index) => {
              const h = day[part.key] * scale;
              y -= h;
              // A 2 px gap of the card colour splits the parts of a stack.
              const gap = index ? 2 : 0;
              const drawn = Math.max(0, h - gap);
              return index === shown.length - 1 ? (
                <path key={part.key} className={`mark-${part.key}`} d={topRounded(x, y, barW, drawn)} />
              ) : (
                <rect key={part.key} className={`mark-${part.key}`} x={x} y={y} width={barW} height={drawn} />
              );
            })}
            <rect className="hit" x={pad.left + band * i} y={pad.top} width={band} height={plotH}>
              <title>{`${dayLabel(day.key)}: ${parts.map((part) => `${day[part.key]} ${part.label}`).join(', ')}`}</title>
            </rect>
          </g>
        );
      })}
    </Frame>
  );
}

const minutes = (ms: number) => (ms ? `${Math.round(ms / 60_000)} min` : '0');

/** The median and the p90 of a time each day, as two lines on one axis. A day with no run leaves a gap. */
export function SpreadLines({ days, pick }: { days: TrendDay[]; pick: (day: TrendDay) => Spread }) {
  const values = days.flatMap((day) => [pick(day).median ?? 0, pick(day).p90 ?? 0]);
  const peak = Math.max(...values);
  // Minutes on the axis, or seconds while every value stays under 2 minutes.
  const unit = peak >= 120_000 ? 60_000 : 1000;
  const max = niceMax(peak / unit) * unit;
  const tick = unit === 60_000 ? minutes : (ms: number) => (ms ? `${Math.round(ms / 1000)} s` : '0');
  const band = plotW / days.length;
  const point = (i: number, ms: number) => [pad.left + band * (i + 0.5), pad.top + plotH - (ms / max) * plotH] as const;
  const line = (key: 'median' | 'p90') => {
    const segments: string[] = [];
    const dots: [number, number][] = [];
    days.forEach((day, i) => {
      const ms = pick(day)[key];
      if (ms == null) return;
      const [x, y] = point(i, ms);
      const joined = i > 0 && pick(days[i - 1])[key] != null;
      segments.push(`${joined ? 'L' : 'M'}${x},${y}`);
      const alone = !joined && (i === days.length - 1 || pick(days[i + 1])[key] == null);
      if (alone || i === days.length - 1) dots.push([x, y]);
    });
    return (
      <g className={`line-${key}`}>
        <path d={segments.join('')} />
        {dots.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={4} />
        ))}
      </g>
    );
  };
  return (
    <Frame days={days} max={max} tick={tick}>
      {line('p90')}
      {line('median')}
      {days.map((day, i) => {
        const { median, p90 } = pick(day);
        const text =
          median == null
            ? 'no run'
            : `median ${formatDuration(median)}, slowest tenth ${formatDuration(p90 ?? median)}`;
        return (
          <rect key={day.key} className="hit" x={pad.left + band * i} y={pad.top} width={band} height={plotH}>
            <title>{`${dayLabel(day.key)}: ${text}`}</title>
          </rect>
        );
      })}
    </Frame>
  );
}

/** The legend above a chart: a swatch beside each name. */
export function Legend({ items }: { items: { mark: string; label: string }[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.mark}>
          <span className={`swatch ${item.mark}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export { dayLabel };
