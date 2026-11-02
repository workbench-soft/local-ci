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
const cloud = ['blacksmith-2vcpu-ubuntu-2404'];
const runs: Run[] = [
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
  run(
    201,
    'keeppad',
    'Checks',
    'fix: keep the topic when a note moves',
    'in_progress',
    2,
    0,
    'blacksmith-2vcpu-ubuntu-2404-x64-4fd2',
    cloud,
    4,
  ),
  run(202, 'keeppad', 'Release', 'feat: share a note by link', 'completed:success', 52, 11, 'BUILD-PC-3', heavy, 11),
  run(
    301,
    'servohop',
    'Checks',
    'feat: 90 day price chart',
    'completed:failure',
    34,
    4,
    'blacksmith-2vcpu-ubuntu-2404-x64-77a1',
    cloud,
    10,
    6,
  ),
  run(
    302,
    'servohop',
    'Checks',
    'docs: link each feature to its spec',
    'completed:success',
    70,
    5,
    'BUILD-PC-4',
    local,
    10,
  ),
  run(401, 'memoire', 'Checks', 'feat: word pictures for own words', 'queued', 1, 0, null, heavy, -1),
  run(402, 'memoire', 'Release', 'feat: a level test in 2 minutes', 'completed:success', 95, 12, 'BUILD-PC', heavy, 11),
  run(
    501,
    'tripforge',
    'Checks',
    'feat: cheaper dates in the calendar',
    'completed:success',
    41,
    3,
    'GitHub Actions 1000000412',
    ['ubuntu-latest'],
    10,
  ),
];

const apiRun = (r: Run) => ({
  id: r.id,
  workflow_id: r.name === 'Checks' ? 1 : 2,
  name: r.name,
  display_title: r.title,
  head_branch: 'main',
  event: 'push',
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
      release('tickalot', 'Tickalot', 130),
      release('keeppad', 'KeepPad', 45),
      release('memoire', 'Memoire', 80),
      release('servohop', 'ServoHop', 300),
    ];
  }
  if (url.pathname.endsWith('/jobs')) {
    const found = runs.find((r) => r.id === Number(parts[5]));
    return { jobs: found ? apiJobs(found) : [] };
  }
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
  return Response.json(answer(url.slice('https://api.github.com'.length)));
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
