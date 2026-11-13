// Loaded with `node --import` into the demo server: GitHub, `gh` and PowerShell answer from made up
// runs, so the shots show no real repo, run or machine. Writes go nowhere.
import childProcess from 'node:child_process';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const org = 'acme-apps';
process.env.RUNNER_ORG = org;
process.env.GITHUB_TOKEN = 'demo';
const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

// The Releases tab reads the reasons of cancelled runs from a JSONL file, so the demo points that
// read at a file of its own and writes the story of run 301 into it.
const cancelFile = join(tmpdir(), 'local-ci-demo-cancel-reasons.jsonl');
process.env.CANCEL_REASONS_FILE = cancelFile;
writeFileSync(
  cancelFile,
  `${JSON.stringify({ repo: 'servohop', runId: 301, words: 'A newer commit started the same build', at: ago(22), outcome: 'accepted', cause: { kind: 'superseded', runId: 304, url: `https://github.com/${org}/servohop/actions/runs/304`, sha: 'b41c9e07d2' } })}\n`,
);

// Four runners on this PC, in a home folder of their own.
const home = join(tmpdir(), 'local-ci-demo-home');
const runners = ['BUILD-PC', 'BUILD-PC-2', 'BUILD-PC-3', 'BUILD-PC-4'];
const folders = runners.map((_, i) => (i ? `${org}-${i + 1}` : org));
folders.forEach((folder, i) => {
  const diag = join(home, 'actions-runner', folder, '_diag');
  mkdirSync(diag, { recursive: true });
  writeFileSync(join(home, 'actions-runner', folder, '.runner'), JSON.stringify({ agentName: runners[i] }));
  const log = join(diag, 'Worker_1.log');
  writeFileSync(log, '');
  const seen = new Date(now - (i + 1) * 9 * 60_000);
  utimesSync(log, seen, seen);
});
process.env.USERPROFILE = home;

const steps = (names: string[], done: number, failed = -1) =>
  names.map((name, i) => ({
    name,
    status: i < done ? 'completed' : i === done ? 'in_progress' : 'queued',
    conclusion: i < done ? (i === failed ? 'failure' : 'success') : null,
  }));
const checkSteps = [
  'Set up job',
  'Checkout',
  'Set up mise',
  'Install',
  'Lint',
  'Typecheck',
  'Unit tests',
  'Build',
  'Post Checkout',
  'Complete job',
];
const releaseSteps = [
  'Set up job',
  'Checkout',
  'Set up mise',
  'Install',
  'Version',
  'Build web',
  'Build APK',
  'Sign APK',
  'Publish release',
  'Deploy site',
  'Complete job',
];

type Run = {
  id: number;
  repo: string;
  name: string;
  title: string;
  status: string;
  conclusion: string | null;
  event: string;
  minutes: number;
  took: number;
  runner: string | null;
  labels: string[];
  done: number;
  failed?: number;
};
const run = (
  id: number,
  repo: string,
  name: string,
  title: string,
  state: string,
  minutes: number,
  took: number,
  runner: string | null,
  labels: string[],
  done: number,
  failed?: number,
): Run => {
  const [status, conclusion] = state.includes(':') ? (state.split(':') as [string, string]) : [state, null];
  return {
    id,
    repo,
    name,
    title,
    status,
    conclusion,
    // A Release workflow starts from another one, so its runs come as workflow_run.
    event: name === 'Release' ? 'workflow_run' : 'push',
    minutes,
    took,
    runner,
    labels,
    done,
    ...(failed !== undefined && { failed }),
  };
};
const heavy = ['self-hosted', 'heavy'];
const local = ['self-hosted', 'local'];
const cloud = ['blacksmith-2vcpu-ubuntu-2404-x64-4fd2'];
const runs: Run[] = [
  // tickalot: the Release run builds on this PC, with run 103 as the usual length.
  run(101, 'tickalot', 'Release', 'feat: sort the weekly shop by aisle', 'in_progress', 7, 0, 'BUILD-PC', heavy, 6),
  run(
    102,
    'tickalot',
    'Checks',
    'feat: sort the weekly shop by aisle',
    'completed:success',
    15,
    6,
    'BUILD-PC-2',
    local,
    10,
  ),
  run(103, 'tickalot', 'Release', 'feat: the weekly shop list', 'completed:success', 130, 12, 'BUILD-PC', heavy, 11),
  // keeppad: Checks failed at Unit tests after the last release.
  run(
    201,
    'keeppad',
    'Checks',
    'fix: keep the topic when a note moves',
    'completed:failure',
    12,
    8,
    cloud[0],
    ['blacksmith-2vcpu-ubuntu-2404'],
    10,
    6,
  ),
  run(202, 'keeppad', 'Release', 'feat: share a note by link', 'completed:success', 52, 11, 'BUILD-PC-3', heavy, 11),
  // servohop: the Release run was cancelled, and the reason sits in the cancel log.
  run(301, 'servohop', 'Release', 'feat: 90 day price chart', 'completed:cancelled', 26, 4, 'BUILD-PC-4', heavy, 4),
  run(302, 'servohop', 'Checks', 'feat: 90 day price chart', 'completed:success', 34, 5, 'BUILD-PC-4', local, 10),
  run(303, 'servohop', 'Release', 'feat: the price chart', 'completed:success', 310, 40, 'BUILD-PC', heavy, 11),
  // memoire: the Release run waits for a heavy runner.
  // pocketbird: the PC turned off while the Release built, so GitHub lost its runner.
  run(701, 'pocketbird', 'Release', 'feat: bird songs offline', 'completed:failure', 64, 9, 'BUILD-PC-2', heavy, 5, 5),
  run(703, 'pocketbird', 'Release', 'feat: the bird list', 'completed:success', 400, 40, 'BUILD-PC', heavy, 11),
  run(401, 'memoire', 'Release', 'feat: word pictures for own words', 'queued', 1, 0, null, heavy, -1),
  run(402, 'memoire', 'Checks', 'feat: word pictures for own words', 'completed:success', 18, 6, 'BUILD-PC', local, 10),
  run(403, 'memoire', 'Release', 'feat: a level test in 2 minutes', 'completed:success', 90, 10, 'BUILD-PC', heavy, 11),
  // tripforge: the Release workflow skipped, so the gate holds it for an open PR.
  run(
    501,
    'tripforge',
    'Checks',
    'feat: cheaper dates in the calendar',
    'completed:success',
    41,
    6,
    'BUILD-PC-3',
    local,
    10,
  ),
  run(502, 'tripforge', 'Release', 'feat: cheaper dates in the calendar', 'completed:skipped', 40, 0, null, heavy, -1),
  run(503, 'tripforge', 'Release', 'feat: spots near the route', 'completed:success', 210, 40, 'BUILD-PC', heavy, 11),
  // spotthecam: a new repo, its first release queued behind its first checks.
  run(
    601,
    'spotthecam',
    'Checks',
    'feat: warn about the next camera',
    'in_progress',
    2,
    0,
    'GitHub Actions 1000000412',
    ['ubuntu-latest'],
    4,
  ),
  run(602, 'spotthecam', 'Release', 'feat: warn about the next camera', 'queued', 1, 0, null, heavy, -1),
  run(603, 'spotthecam', 'Release', 'chore: the first build', 'completed:success', 20, 11, 'BUILD-PC', heavy, 11),
];

const apiRun = (r: Run) => ({
  id: r.id,
  workflow_id: r.name === 'Checks' ? 1 : 2,
  name: r.name,
  display_title: r.title,
  head_branch: 'main',
  event: r.event,
  status: r.status,
  conclusion: r.conclusion,
  created_at: ago(r.minutes),
  run_started_at: ago(r.minutes),
  updated_at: ago(r.status === 'completed' ? r.minutes - r.took : 0),
  html_url: `https://github.com/${org}/${r.repo}/actions/runs/${r.id}`,
  pull_requests: [],
});
const apiJobs = (r: Run) => [
  {
    id: r.id * 10,
    name: r.name === 'Checks' ? 'checks' : 'release',
    status: r.status,
    conclusion: r.conclusion,
    runner_name: r.runner,
    labels: r.labels,
    started_at: r.status === 'queued' ? null : ago(r.minutes),
    completed_at: r.status === 'completed' ? ago(r.minutes - r.took) : null,
    html_url: `https://github.com/${org}/${r.repo}/actions/runs/${r.id}/job/${r.id * 10}`,
    steps: steps(r.name === 'Checks' ? checkSteps : releaseSteps, r.done, r.failed),
  },
];
const release = (app: string, name: string, minutes: number) => ({
  tag_name: `${app}-v2026.11.02.1`,
  name: `${name} v2026.11.02.1`,
  html_url: `https://github.com/${org}/${org}.github.io/releases/tag/${app}-v2026.11.02.1`,
  created_at: ago(minutes),
  published_at: ago(minutes),
  assets: [
    { name: `${name.replace(' ', '')}-2026.11.02.1-android.apk`, browser_download_url: 'https://example.com/app.apk' },
  ],
  body_html: '<ul><li>New: sort the weekly shop by aisle</li></ul>',
});

const notes: Record<number, string[]> = {
  2010: ['Process completed with exit code 1.'],
  3010: ['The run was canceled forcefully by @acme-bot.'],
  7010: [
    'The self-hosted runner: BUILD-PC-2 lost communication with the server. Verify the machine is running and has a healthy network connection.',
  ],
};
const logs: Record<number, string> = {
  2010: [
    '##[group]Run mise run test',
    'mise run test',
    '##[endgroup]',
    '[test] $ pnpm exec vitest run',
    ' ✓ src/notes/list.test.ts (12 tests) 41ms',
    ' ✗ src/notes/move.test.ts > keeps the topic when a note moves',
    "TypeError: Cannot read properties of undefined (reading 'topic')",
    '    at moveNote (src/notes/move.ts:28:17)',
    '    at Object.<anonymous> (src/notes/move.test.ts:14:5)',
    ' Test Files  1 failed | 11 passed (12)',
    '[test] ERROR task failed',
    '##[error]Process completed with exit code 1.',
  ]
    .map((line) => `2026-11-02T10:00:00.0000000Z ${line}`)
    .join('\n'),
};

function answer(path: string): unknown {
  const url = new URL(path, 'https://api.github.com');
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.pathname.endsWith('/actions/runners')) {
    return {
      runners: runners.map((name, i) => ({
        id: i + 1,
        name,
        os: 'Windows',
        status: 'online',
        busy: name === 'BUILD-PC',
        labels: [{ name: 'self-hosted' }, { name: i ? 'local' : 'heavy' }],
      })),
    };
  }
  if (url.pathname === `/orgs/${org}/repos`) {
    return [...new Set(runs.map((r) => r.repo))].map((repo) => ({
      name: repo,
      full_name: `${org}/${repo}`,
      archived: false,
    }));
  }
  if (url.pathname.endsWith('/releases')) {
    return [
      release('tickalot', 'Tick-a-Lot', 130),
      release('keeppad', 'KeepPad', 45),
      release('memoire', 'Memoire', 80),
      release('servohop', 'ServoHop', 300),
      release('tripforge', 'TripForge', 200),
      release('pocketbird', 'PocketBird', 360),
    ];
  }
  // The annotations and the log say why a job failed or stopped.
  if (url.pathname.endsWith('/annotations')) return (notes[Number(parts[4])] ?? []).map((message) => ({ message }));
  if (url.pathname.endsWith('/logs')) return logs[Number(parts[5])] ?? '';
  if (url.pathname.endsWith('/jobs')) {
    const found = runs.find((r) => r.id === Number(parts[5]));
    return { jobs: found ? apiJobs(found) : [] };
  }
  // Each repo has a deploy workflow, so the Sites card lists them all.
  if (parts[4] === 'workflows' && parts.length === 5) {
    return { workflows: [{ id: 900, name: 'Deploy', path: '.github/workflows/deploy.yml', state: 'active' }] };
  }
  if (parts[3] === 'contents')
    return 'on:\n  workflow_dispatch:\njobs:\n  d:\n    steps:\n      - run: mise run deploy\n';
  if (parts[4] === 'workflows') {
    return { workflow_runs: runs.filter((r) => r.repo === parts[2] && r.status === 'completed').map(apiRun) };
  }
  if (url.pathname.endsWith('/actions/runs')) {
    return { workflow_runs: runs.filter((r) => r.repo === parts[2]).map(apiRun) };
  }
  return {};
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('https://api.github.com')) return realFetch(input, init);
  // Any write, such as a cancel or a variable, stops here.
  if ((init?.method ?? 'GET') !== 'GET') return new Response(null, { status: 204 });
  const body = answer(url.slice('https://api.github.com'.length));
  // A workflow file comes back raw, as the contents API sends it.
  return typeof body === 'string' ? new Response(body) : Response.json(body);
}) as typeof fetch;

// `gh auth token` and the PowerShell read of the runner tasks and logs.
const snapshot = {
  tasks: folders.map((_, i) => ({ name: `GitHub Actions runner (${org}${i ? ` ${i + 1}` : ''})`, state: 'Running' })),
  logs: folders.map((folder, i) => ({ folder, listener: true, worker: i === 0 })),
};
const fake = async (file: string) => ({
  stdout: file === 'powershell' ? JSON.stringify(snapshot) : file === 'gh' ? 'demo\n' : '',
  stderr: '',
});
const realExecFile = childProcess.execFile;
const execFile = ((file: string, ...rest: unknown[]) => {
  if (file !== 'powershell' && file !== 'gh') return (realExecFile as (...args: unknown[]) => unknown)(file, ...rest);
  const callback = rest.find((arg) => typeof arg === 'function') as ((...args: unknown[]) => void) | undefined;
  void fake(file).then(({ stdout, stderr }) => callback?.(null, stdout, stderr));
  return undefined;
}) as typeof childProcess.execFile;
Object.assign(execFile, { [promisify.custom]: fake });
childProcess.execFile = execFile;
syncBuiltinESMExports();
