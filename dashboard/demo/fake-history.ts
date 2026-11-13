// Two made up months of finished runs for the Trends tab, in a file of its own, so the shot shows no real repo.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HistoryRun } from '../status/run-history-file.ts';
import type { RunnerKind } from '../status/runner-kind.ts';

const org = 'acme-apps';
const now = Date.now();
const repos = ['tickalot', 'keeppad', 'memoire', 'servohop', 'tripforge', 'pocketbird'];
const machines: RunnerKind[] = ['pc', 'pc', 'oracle', 'github'];
const failures = [
  ['test', 'Unit tests'],
  ['lint', 'Lint'],
  ['android', 'Build the APK'],
];

// The same seed gives the same chart on every run of `mise run demo`.
let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const runs: HistoryRun[] = [];
let id = 50_000;
for (let day = 59; day >= 0; day--) {
  const count = 18 + Math.round(random() * 22) + (day % 7 < 2 ? -10 : 0);
  for (let n = 0; n < count; n++) {
    const created = now - day * 86_400_000 - random() * 86_400_000;
    const release = random() < 0.25;
    const roll = random();
    const conclusion = roll < 0.12 + day / 600 ? 'failure' : roll < 0.22 ? 'cancelled' : 'success';
    // Builds got faster over the month, after the shared pnpm store landed.
    const buildMs = ((release ? 11 : 3.5) + random() * (release ? 9 : 4) + day / 15) * 60_000;
    const waitMs = (3 + random() * 25 + (random() < 0.1 ? 240 : 0)) * 1000;
    const failure = failures[Math.floor(random() * failures.length)];
    const repo = repos[Math.floor(random() * repos.length)];
    id++;
    runs.push({
      id,
      attempt: 1,
      repo,
      workflow: release ? 'Release' : 'Checks',
      branch: 'main',
      event: 'push',
      conclusion,
      createdAt: new Date(created).toISOString(),
      startedAt: new Date(created).toISOString(),
      endedAt: new Date(created + (conclusion === 'success' ? buildMs : buildMs / 3)).toISOString(),
      url: `https://github.com/${org}/${repo}/actions/runs/${id}`,
      jobs: {
        kinds: [machines[Math.floor(random() * machines.length)]],
        failedJob: conclusion === 'failure' ? failure[0] : null,
        failedStep: conclusion === 'failure' ? failure[1] : null,
        failedUrl: conclusion === 'failure' ? `https://github.com/${org}/${repo}/actions/runs/${id}/job/1` : null,
        waitMs,
      },
    });
  }
}

const file = join(tmpdir(), 'local-ci-demo-run-history.json');
writeFileSync(file, JSON.stringify({ backfilledAt: new Date(now).toISOString(), runs: runs.reverse() }));
process.env.RUN_HISTORY_FILE = file;
