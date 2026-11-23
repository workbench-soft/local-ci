import type { Place } from '@/status/placement';
import {
  Check,
  X,
  Ban,
  ChevronsRight,
  LoaderCircle,
  Clock,
  Monitor,
  Cloud,
  Server,
  Square,
  RotateCcw,
  Trash2,
  Smartphone,
  Package,
} from 'lucide-react';

export type IconName =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'running'
  | 'queued'
  | 'local'
  | 'cloud'
  | 'server'
  | 'stop'
  | 'retry'
  | 'trash'
  | 'phone'
  | 'package';

const icons = {
  success: Check,
  failure: X,
  cancelled: Ban,
  skipped: ChevronsRight,
  running: LoaderCircle,
  queued: Clock,
  local: Monitor,
  cloud: Cloud,
  server: Server,
  stop: Square,
  retry: RotateCcw,
  trash: Trash2,
  phone: Smartphone,
  package: Package,
} as const;

export function Icon({ name, label, className = '' }: { name: IconName; label?: string; className?: string }) {
  const Component = icons[name];
  return (
    <Component
      className={`icon ${name} ${className}`}
      size={24}
      strokeWidth={2.2}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** The label of each place, and a hint on who builds the job there. A finished run has no place. */
export const placeIcons: Record<Exclude<Place, 'done'>, { icon: IconName; text: string; hint: string }> = {
  local: {
    icon: 'local',
    text: 'Building on this PC',
    hint: 'A runner of this PC builds a job of this run right now.',
  },
  waiting: {
    icon: 'cloud',
    text: 'Queued on GitHub',
    hint: 'No runner took the job yet. GitHub holds it until a runner with its labels is free.',
  },
  elsewhere: {
    icon: 'server',
    text: 'Building in the cloud',
    hint: 'Oracle, Blacksmith, a GitHub hosted runner or a runner on another machine builds a job of this run right now.',
  },
};

/** The plain words for each end of a run, with a hover line a new reader understands. */
const ends: Record<string, { icon: IconName; text: string; hint: string }> = {
  success: { icon: 'success', text: 'passed', hint: 'It worked. Every job ended well.' },
  cancelled: {
    icon: 'cancelled',
    text: 'stopped',
    hint: 'Stopped before the end: a newer push took its place, or Stop or Local CI ended it. Nothing broke.',
  },
  skipped: {
    icon: 'skipped',
    text: 'not needed',
    hint: 'GitHub started it, but no job had to run, such as a release the gate held. Nothing broke.',
  },
  neutral: { icon: 'cancelled', text: 'no result', hint: 'It ended without saying passed or failed.' },
  timed_out: { icon: 'failure', text: 'timed out', hint: 'It ran too long, so GitHub stopped it. Open the log.' },
};

/** The icon, the words and the hover line for the result of a run. */
export function resultOf(status: string, conclusion: string | null): { icon: IconName; text: string; hint: string } {
  if (status === 'in_progress') return { icon: 'running', text: 'building', hint: 'A runner builds it right now.' };
  if (status !== 'completed')
    return { icon: 'queued', text: 'waiting', hint: 'It waits for a free runner with the right labels.' };
  return ends[conclusion ?? ''] ?? { icon: 'failure', text: 'failed', hint: 'It broke. Open the log to see why.' };
}
