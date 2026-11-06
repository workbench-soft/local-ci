/** Only completed, unsuccessful builds can be retried from the dashboard. */
const failedConclusions = new Set(['failure', 'timed_out', 'startup_failure']);

export function canRetryRun(status: string, conclusion: string | null): boolean {
  return status === 'completed' && failedConclusions.has(conclusion ?? '');
}
