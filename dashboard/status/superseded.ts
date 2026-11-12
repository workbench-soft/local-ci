import type { CancelCause } from './cancel-log.ts';
import type { WorkflowRun } from './org-status.ts';
import { activeStatuses } from './placement.ts';

type RunKey = Pick<
  WorkflowRun,
  'id' | 'repo' | 'workflowId' | 'branch' | 'event' | 'status' | 'headSha' | 'pullRequests' | 'conclusion'
>;
const replaceableEvents = new Set(['push', 'workflow_dispatch', 'pull_request', 'pull_request_target']);
const prEvents = new Set(['pull_request', 'pull_request_target']);
const failedConclusions = new Set(['failure', 'timed_out', 'startup_failure']);
const isFailed = (conclusion: string | null) => failedConclusions.has(conclusion ?? '');
// Repos whose release workflow runs its checks as a job of its own.
const integratedChecks: Record<string, { workflow: string; job: RegExp }> = {
  consdr: { workflow: 'Deploy', job: /^checks$/ },
  'guitar-upscale': { workflow: 'CI', job: /^checks$/ },
  spotthecam: { workflow: 'Deploy', job: /^check \/ / },
  'workbench-soft.github.io': { workflow: 'Pages', job: /^checks$/ },
};
// The checks workflow a release follows, by repo and workflow, then by repo. Checks for the rest.
const checksOfRelease: Record<string, string> = {
  'memories/Desktop release': 'Desktop checks',
  'memories/Shuttrix release': 'Shuttrix checks',
};
const checksOfRepo: Record<string, string> = {
  'agent-skills': 'check',
  'agent-skills-private': 'check',
  ci: 'Lint',
  'gh-review-notify': 'shellcheck',
  'git-aliases': 'lint',
};

function groupOf(run: RunKey): string {
  // A fork can call its branch main too; only an identified PR shares that build scope.
  const scope = prEvents.has(run.event)
    ? [run.event, run.pullRequests.length ? run.pullRequests.map((pr) => pr.number).toSorted((a, b) => a - b) : run.id]
    : 'branch';
  return JSON.stringify([run.repo, run.workflowId, run.branch, scope]);
}

/** Only a build of a different commit in the same workflow and branch replaces a run. */
export function replacementRuns<T extends RunKey>(runs: T[]): { run: T; replacement: T }[] {
  return replaced(runs, (run) => activeStatuses.has(run.status));
}

const githubCancelWindowMs = 5 * 60_000;

/** Runs GitHub's concurrency stopped: they ended as cancelled soon after a newer commit started the same build. */
export function cancelledByGitHub<T extends RunKey & Pick<WorkflowRun, 'createdAt' | 'updatedAt'>>(
  runs: T[],
): { run: T; replacement: T }[] {
  return replaced(runs, (run) => run.status === 'completed' && run.conclusion === 'cancelled').filter(
    ({ run, replacement }) => {
      const wait = Date.parse(run.updatedAt) - Date.parse(replacement.createdAt);
      return wait >= 0 && wait <= githubCancelWindowMs;
    },
  );
}

function replaced<T extends RunKey>(runs: T[], stopped: (run: T) => boolean): { run: T; replacement: T }[] {
  const newest = new Map<string, T>();
  for (const run of runs) {
    if (!run.headSha || !replaceableEvents.has(run.event) || run.conclusion === 'skipped') continue;
    const key = groupOf(run);
    if ((newest.get(key)?.id ?? 0) < run.id) newest.set(key, run);
  }
  return runs.flatMap((run) => {
    const replacement = newest.get(groupOf(run));
    return stopped(run) && run.headSha && replacement && replacement.id > run.id && replacement.headSha !== run.headSha
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
      (isFailed(run.conclusion) || run.jobs.some((job) => isFailed(job.conclusion))),
  );
  return runs.flatMap((run) => {
    const stoppedAtGuard =
      run.status === 'completed' &&
      run.conclusion === 'failure' &&
      run.jobs.some((job) => /^Wait for matching checks before publication$/i.test(job.failedStep ?? ''));
    const integrated = integratedChecks[run.repo];
    if (integrated?.workflow === run.workflow && (blocked ? stoppedAtGuard : activeStatuses.has(run.status))) {
      const job = run.jobs.find((item) => integrated.job.test(item.name) && isFailed(item.conclusion));
      if (job && run.headSha) return [{ run, replacement: { ...run, url: job.url } }];
    }
    if (
      !(blocked ? stoppedAtGuard : activeStatuses.has(run.status)) ||
      !run.headSha ||
      !/release|deploy/i.test(run.workflow)
    )
      return [];
    const checkName = checksOfRelease[`${run.repo}/${run.workflow}`] ?? checksOfRepo[run.repo] ?? 'Checks';
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

/** The cancels GitHub refused, by run id: how often, and when the next try is due. */
export type RefusedCancels = Map<number, { failures: number; retryAt: number }>;

const retryBaseMs = 10_000;
const retryMaxMs = 5 * 60_000;

/** A refused cancel waits 20 s, 40 s, 80 s and so on up to 5 min. One run got 2204 tries in 6 hours at 10 s each. */
export function noteRefusedCancel(refused: RefusedCancels, runId: number, now: number): void {
  const failures = (refused.get(runId)?.failures ?? 0) + 1;
  refused.set(runId, { failures, retryAt: now + Math.min(retryBaseMs * 2 ** failures, retryMaxMs) });
}

/** True when the run has no refused cancel, or its wait is over. */
export function cancelIsDue(refused: RefusedCancels, runId: number, now: number): boolean {
  return now >= (refused.get(runId)?.retryAt ?? 0);
}

export function cancelCause(kind: CancelCause['kind'], run: WorkflowRun): CancelCause {
  return { kind, runId: run.id, url: run.url, sha: run.headSha, branch: run.branch, pullRequests: run.pullRequests };
}
