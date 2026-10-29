import { callGitHub, fetchOrgStatus, forgetOrgStatus, type WorkflowRun } from './org-status.ts';
import { orgName } from './settings.ts';
import { type OpenPrBranches, prListsToRead, reposWithPrRuns, supersededRuns } from './superseded.ts';

const sweepMs = 10_000;
const openPrTtlMs = 60_000;
let started = false;
const openPrCache = new Map<string, { at: number; branches: Set<string> }>();

/** Every 10 s force cancels each unfinished run that a newer run replaced or whose PR is closed. */
export function startCancellingSuperseded(): void {
	if (started || process.env.CANCEL_SUPERSEDED === 'off') return;
	started = true;
	let busy = false;
	setInterval(async () => {
		// A slow GitHub must not stack sweeps on top of each other.
		if (busy) return;
		busy = true;
		try {
			await cancelSuperseded();
		} catch (error) {
			console.error(`Couldn't check for replaced runs: ${error}`);
		} finally {
			busy = false;
		}
	}, sweepMs).unref();
}

async function cancelSuperseded(): Promise<void> {
	const status = await fetchOrgStatus();
	if (!status.ok) return;
	const doomed = supersededRuns(status.runs, await readOpenPrBranches(status.runs));
	if (doomed.length === 0) return;
	// force-cancel also stops steps with if: always(), so the runner is free at once.
	const results = await Promise.allSettled(
		doomed.map((run) => callGitHub(`/repos/${orgName}/${run.repo}/actions/runs/${run.id}/force-cancel`, 'POST')),
	);
	results.forEach((result, index) => {
		const run = doomed[index];
		const what = `${run.repo} ${run.workflow} on ${run.branch}, run ${run.id}`;
		// GitHub answers 409 to a run that finished meanwhile, so that one needs no line.
		if (result.status === 'fulfilled') console.log(`Cancelled ${what}: a newer run replaced it, or its PR is closed.`);
		else if (!String(result.reason).includes(' 409 ')) console.error(`Couldn't cancel ${what}: ${result.reason}`);
	});
	forgetOrgStatus();
}

// PRs close rarely, so each repo's list is kept for a minute, unless a PR run started after the read.
// A repo whose list fails or fills a whole page drops out, so none of its PR runs counts as closed.
async function readOpenPrBranches(runs: WorkflowRun[]): Promise<OpenPrBranches> {
	const now = Date.now();
	const readAt = new Map([...openPrCache].map(([repo, entry]) => [repo, entry.at]));
	await Promise.all(
		prListsToRead(runs, readAt, now, openPrTtlMs).map(async (repo) => {
			try {
				const pulls = (await (await callGitHub(`/repos/${orgName}/${repo}/pulls?state=open&per_page=100`)).json()) as { head: { ref: string } }[];
				if (pulls.length >= 100) throw new Error('100 open PRs or more, so the list may be cut off');
				openPrCache.set(repo, { at: now, branches: new Set(pulls.map((pull) => pull.head.ref)) });
			} catch (error) {
				openPrCache.delete(repo);
				console.error(`Couldn't read the open PRs of ${repo}, so its PR runs stay: ${error}`);
			}
		}),
	);
	return new Map(
		reposWithPrRuns(runs).flatMap((repo) => {
			const entry = openPrCache.get(repo);
			return entry ? [[repo, entry.branches] as const] : [];
		}),
	);
}
