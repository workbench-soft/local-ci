import Link from 'next/link';
import { machinePicks, type MachinePick } from '@/status/machine-filter';
import { kindNames } from '@/status/runner-kind';
import type { Tone } from '@/status/headline';
import { StatusDot } from './status-dot';

/** The machine chips under the tabs. Each link keeps the tab and its other choices. */
export function MachineFilter({ pick, query }: { pick: MachinePick | null; query: Record<string, string> }) {
  const href = (machine: string) => `/?${new URLSearchParams({ ...query, machine })}`;
  return (
    <nav className="chips machine-filter" aria-label="Show one machine">
      <span className="muted small">Machine</span>
      <Link className="chip" href={href('all')} aria-pressed={pick === null}>
        All
      </Link>
      {machinePicks.map((kind) => (
        <Link key={kind} className={`chip machine-chip ${kind}`} href={href(kind)} aria-pressed={pick === kind}>
          {kindNames[kind]}
        </Link>
      ))}
    </nav>
  );
}

const keys: [Tone, string, string][] = [
  ['ok', 'Green', 'it worked'],
  ['bad', 'Red', 'it broke, open it to see why'],
  ['muted', 'Gray', 'stopped or not needed, nothing broke'],
  ['busy', 'Blue', 'it builds now'],
  ['warn', 'Yellow', 'it waits, or a number looks worse'],
];

/** What each color means, in words a new reader gets at once. */
export function ColorKey() {
  return (
    <p className="color-key small" aria-label="What the colors mean">
      {keys.map(([tone, name, text]) => (
        <span key={tone}>
          <StatusDot tone={tone} />
          <strong>{name}</strong> {text}
        </span>
      ))}
    </p>
  );
}
