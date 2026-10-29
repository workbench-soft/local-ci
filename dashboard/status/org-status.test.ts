import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

process.env.GITHUB_TOKEN = 'test-token';

type Route = (path: string) => { status: number; body?: unknown };
let route: Route;
let calls: string[];

globalThis.fetch = (async (url: string) => {
	const path = url.replace('https://api.github.com', '');
	calls.push(path);
	const { status, body } = route(path);
	return new Response(JSON.stringify(body ?? {}), { status });
}) as typeof fetch;

const apiRun = (id: number) => ({
	id,
	name: 'ci',
	display_title: 'title',
	head_branch: 'main',
	event: 'push',
	status: 'completed',
	conclusion: 'success',
	created_at: '2025-10-29T12:00:00Z',
	updated_at: '2025-10-29T12:00:00Z',
	html_url: `https://github.com/run/${id}`,
});

const repos = [
	{ full_name: 'workbench-soft/good', archived: false },
	{ full_name: 'workbench-soft/broken', archived: false },
	{ full_name: 'workbench-soft/old', archived: true },
];

const healthyOrg: Route = (path) => {
	if (path.includes('/actions/runners')) return { status: 200, body: { runners: [] } };
	if (path.includes('/orgs/workbench-soft/repos')) return { status: 200, body: repos };
	return { status: 200, body: { workflow_runs: [apiRun(1)] } };
};

// Each test loads its own copy of the module, so the 20 s cache starts empty.
let copy = 0;
const freshModule = () => import(`./org-status.ts?copy=${++copy}`) as Promise<typeof import('./org-status.ts')>;

beforeEach(() => {
	calls = [];
	route = healthyOrg;
});

test('a repo whose runs call fails drops out, the other repos still show', async () => {
	route = (path) => (path.includes('/repos/workbench-soft/broken/') ? { status: 404 } : healthyOrg(path));
	const status = await (await freshModule()).fetchOrgStatus();
	assert.equal(status.ok, true);
	assert.deepEqual(status.ok && status.runs.map((run) => run.repo), ['good']);
});

test('a failing repo list still makes the whole status fail', async () => {
	route = (path) => (path.includes('/orgs/workbench-soft/repos') ? { status: 401 } : healthyOrg(path));
	const status = await (await freshModule()).fetchOrgStatus();
	assert.deepEqual(status, { ok: false, error: 'GitHub answered 401 to /orgs/workbench-soft/repos?per_page=100&sort=pushed' });
});

test('tabs that load at the same moment share one set of GitHub calls', async () => {
	const { fetchOrgStatus } = await freshModule();
	await Promise.all([fetchOrgStatus(), fetchOrgStatus(), fetchOrgStatus()]);
	assert.equal(calls.filter((path) => path.includes('/orgs/workbench-soft/repos')).length, 1);
});
