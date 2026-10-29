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
	pull_requests: [{ number: 4 }],
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

// Each test drops the shared store and loads its own copy of the module, so the 20 s cache starts empty.
let copy = 0;
const freshModule = () => import(`./org-status.ts?copy=${++copy}`) as Promise<typeof import('./org-status.ts')>;

beforeEach(() => {
	calls = [];
	route = healthyOrg;
	delete (globalThis as Record<symbol, unknown>)[Symbol.for('local-ci.org-status')];
});

test('two copies of the module, as Next bundles for the page and the sweep, share one cache', async () => {
	const page = await freshModule();
	const sweep = await freshModule();
	await Promise.all([page.fetchOrgStatus(), sweep.fetchOrgStatus()]);
	assert.equal(calls.filter((path) => path.includes('/orgs/workbench-soft/repos')).length, 1);
	sweep.forgetOrgStatus();
	await page.fetchOrgStatus();
	assert.equal(calls.filter((path) => path.includes('/orgs/workbench-soft/repos')).length, 2);
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
	assert.deepEqual(status, {
		ok: false,
		error: 'GitHub answered 401 to GET /orgs/workbench-soft/repos?per_page=100&sort=pushed. The token was refused. Run gh auth login, then dashboard\\install.ps1.',
	});
});

test('a GitHub error carries its status, and a used up rate limit says until when', async () => {
	const realFetch = globalThis.fetch;
	const reset = Math.floor(Date.parse('2026-10-29T15:00:00Z') / 1000);
	globalThis.fetch = (async () =>
		new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } })) as unknown as typeof fetch;
	try {
		const { callGitHub, githubStatus } = await freshModule();
		const error = await callGitHub('/rate').catch((caught: unknown) => caught);
		assert.equal(githubStatus(error), 403);
		assert.equal((error as Error).message, `GitHub answered 403 to GET /rate. The rate limit is used up until ${new Date(reset * 1000).toLocaleTimeString()}.`);
		assert.equal(githubStatus(new Error('GitHub answered 409')), null);
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('tabs that load at the same moment share one set of GitHub calls', async () => {
	const { fetchOrgStatus } = await freshModule();
	await Promise.all([fetchOrgStatus(), fetchOrgStatus(), fetchOrgStatus()]);
	assert.equal(calls.filter((path) => path.includes('/orgs/workbench-soft/repos')).length, 1);
});

test('a failed run names its failed job and step, and releases come from the public repo', async () => {
	route = (path) => {
		if (path.includes('/workbench-soft.github.io/releases')) {
			return { status: 200, body: [{ tag_name: 'good-v1', name: 'Good v1', html_url: 'https://r', created_at: '2025-10-29T12:00:00Z', assets: [] }] };
		}
		if (path.endsWith('/jobs?per_page=100')) {
			return {
				status: 200,
				body: { jobs: [{ id: 7, name: 'build', status: 'completed', conclusion: 'failure', runner_name: 'pc', labels: [], started_at: null, html_url: 'https://job/7', steps: [{ name: 'Checkout', conclusion: 'success' }, { name: 'Test', conclusion: 'failure' }] }] },
			};
		}
		if (path.includes('/actions/runs?')) return { status: 200, body: { workflow_runs: [{ ...apiRun(1), conclusion: 'failure' }] } };
		return healthyOrg(path);
	};
	const { fetchOrgStatus, failureOf } = await freshModule();
	const status = await fetchOrgStatus();
	assert.equal(status.ok, true);
	if (!status.ok) return;
	assert.deepEqual(failureOf(status.runs[0]), { job: 'build', step: 'Test', url: 'https://job/7' });
	assert.deepEqual(status.releases.map((release) => release.tag), ['good-v1']);
	assert.deepEqual(status.runs[0].pullRequests, [{ number: 4, url: 'https://github.com/workbench-soft/good/pull/4' }]);
	assert.equal(status.runs[0].branchUrl, 'https://github.com/workbench-soft/good/tree/main');
});

test('pickRuns keeps the latest 5 runs and every unfinished run past them', async () => {
	const { pickRuns } = await freshModule();
	const statuses = ['queued', 'queued', 'queued', 'queued', 'queued', 'in_progress', 'completed', 'queued', 'completed'];
	const picked = pickRuns(statuses.map((status, index) => ({ status, index })));
	assert.deepEqual(picked.map((run) => run.index), [0, 1, 2, 3, 4, 5, 7]);
});

test('a second load sends the ETag back, and a 304 answer reuses the runs read before', async () => {
	const realFetch = globalThis.fetch;
	const sent: (string | undefined)[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		const path = url.replace('https://api.github.com', '');
		const tag = (init.headers as Record<string, string>)['If-None-Match'];
		if (path.includes('/repos/workbench-soft/good/actions/runs?')) sent.push(tag);
		if (tag) return new Response(null, { status: 304 });
		const { status, body } = healthyOrg(path);
		return new Response(JSON.stringify(body), { status, headers: { etag: `"${path}"` } });
	}) as typeof fetch;
	try {
		const { fetchOrgStatus, forgetOrgStatus } = await freshModule();
		const first = await fetchOrgStatus();
		forgetOrgStatus();
		const second = await fetchOrgStatus();
		assert.deepEqual(sent, [undefined, '"/repos/workbench-soft/good/actions/runs?per_page=30"']);
		assert.deepEqual(second, first);
	} finally {
		globalThis.fetch = realFetch;
	}
});
