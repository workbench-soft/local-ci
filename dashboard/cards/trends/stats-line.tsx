import Link from 'next/link';
import { formatDuration } from '@/status/durations';
import type { WorkflowStats } from '@/status/run-stats';

/** One muted line: runs, the failed share and the usual time of a workflow, linked to its repo's trends. */
export function StatsLine({ stats, what = 'runs' }: { stats: WorkflowStats | null | undefined; what?: string }) {
  if (!stats?.runs) return null;
  const parts = [`${stats.days} days: ${stats.runs} ${what}`];
  if (stats.failRate !== null) parts.push(`${Math.round(stats.failRate * 100)}% failed`);
  if (stats.medianMs !== null) parts.push(`usually ${formatDuration(stats.medianMs)}`);
  const bad = stats.failRate !== null && stats.failRate >= 0.25;
  return (
    <Link
      className={`stats-line small${bad ? ' stats-bad' : ''}`}
      href={`/?tab=trends&repo=${encodeURIComponent(stats.repo)}`}
      title="Open the trends of this repo"
    >
      {parts.join(' · ')}
    </Link>
  );
}
