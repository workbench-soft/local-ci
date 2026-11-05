import type { CancelCause } from './cancel-log.ts';
import type { WorkflowRun } from './org-status.ts';
import { activeStatuses } from './placement.ts';

type RunKey = Pick<WorkflowRun, 'id' | 'repo' | 'workflowId' | 'branch' | 'event' | 'status' | 'headSha'>;
const replaceableEvents = new Set(['push', 'pull_request', 'pull_request_target']);

/** Only a build of a different commit in the same workflow and branch replaces a run. */
export function replacementRuns<T extends RunKey>(runs: T[]): { run: T; replacement: T }[] {
  const newest = new Map<string, T>();
  for (const run of runs) {
    if (!run.headSha || !replaceableEvents.has(run.event)) continue;
    const key = JSON.stringify([run.repo, run.workflowId, run.branch, run.event]);
    if ((newest.get(key)?.id ?? 0) < run.id) newest.set(key, run);
  }
  return runs.flatMap((run) => {
    const replacement = newest.get(JSON.stringify([run.repo, run.workflowId, run.branch, run.event]));
    return activeStatuses.has(run.status) &&
      run.headSha &&
      replacement &&
      replacement.id > run.id &&
      replacement.headSha !== run.headSha
      ? [{ run, replacement }]
      : [];
  });
}

/** Failed Checks stop only releases building that repo, branch and commit. */
export function failedCheckReleases(
  runs: WorkflowRun[],
  blocked = false,
): { run: WorkflowRun; replacement: WorkflowRun }[] {
  const newest = new Map<string, WorkflowRun>();
  for (const run of runs) {
    if (!run.headSha) continue;
    const key = JSON.stringify([run.repo, run.workflow, run.branch, run.headSha]);
    if ((newest.get(key)?.id ?? 0) < run.id) newest.set(key, run);
  }
  const checks = [...newest.values()].filter(
    (run) =>
      /checks?$|^lint$|^shellcheck$/i.test(run.workflow) &&
      run.headSha &&
      (['failure', 'timed_out', 'startup_failure'].includes(run.conclusion ?? '') ||
        run.jobs.some((job) => ['failure', 'timed_out', 'startup_failure'].includes(job.conclusion ?? ''))),
  );
  return runs.flatMap((run) => {
    const stoppedAtGuard =
      run.status === 'completed' &&
      run.conclusion === 'failure' &&
      run.jobs.some((job) => /^Wait for matching checks before publication$/i.test(job.failedStep ?? ''));
    const integrated = (
      {
        consdr: { workflow: 'Deploy', job: /^checks$/ },
        'guitar-upscale': { workflow: 'CI', job: /^checks$/ },
        spotthecam: { workflow: 'Deploy', job: /^check \/ / },
        'workbench-soft.github.io': { workflow: 'Pages', job: /^checks$/ },
      } as Record<string, { workflow: string; job: RegExp }>
    )[run.repo];
    if (integrated?.workflow === run.workflow && (blocked ? stoppedAtGuard : activeStatuses.has(run.status))) {
      const job = run.jobs.find(
        (item) =>
          integrated.job.test(item.name) && ['failure', 'timed_out', 'startup_failure'].includes(item.conclusion ?? ''),
      );
      if (job && run.headSha) return [{ run, replacement: { ...run, url: job.url } }];
    }
    if (
      !(blocked ? stoppedAtGuard : activeStatuses.has(run.status)) ||
      !run.headSha ||
      !/release|deploy/i.test(run.workflow)
    )
      return [];
    const checkName =
      run.repo === 'memories' && run.workflow === 'Desktop release'
        ? 'Desktop checks'
        : run.repo === 'memories' && run.workflow === 'Shuttrix release'
          ? 'Shuttrix checks'
          : ({
              'agent-skills': 'check',
              'agent-skills-private': 'check',
              ci: 'Lint',
              'gh-review-notify': 'shellcheck',
              'git-aliases': 'lint',
            }[run.repo] ?? 'Checks');
    const replacement = checks.find(
      (check) =>
        check.workflow === checkName &&
        check.repo === run.repo &&
        check.branch === run.branch &&
        check.headSha === run.headSha,
    );
    return replacement ? [{ run, replacement }] : [];
  });
}

export function cancelCause(kind: CancelCause['kind'], run: WorkflowRun): CancelCause {
  return { kind, runId: run.id, url: run.url, sha: run.headSha, branch: run.branch, pullRequests: run.pullRequests };
}
