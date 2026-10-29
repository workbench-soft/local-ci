import type { Tone } from './headline.ts';
import type { OrgRunner } from './org-status.ts';
import type { PcRunner } from './this-pc.ts';

/** One runner, as this PC and GitHub each see it. A side is null when that source lacks the runner. */
export type RunnerRow = {
	name: string;
	here: PcRunner | null;
	github: OrgRunner | null;
	tone: Tone;
	/** Set when the two sides disagree, so the person knows what to check. */
	hint: string | null;
};

export function pcState(runner: PcRunner): 'stopped' | 'busy' | 'idle' {
	if (!runner.listener) return 'stopped';
	return runner.worker ? 'busy' : 'idle';
}

export function githubState(runner: OrgRunner): 'offline' | 'busy' | 'idle' {
	if (runner.status === 'offline') return 'offline';
	return runner.busy ? 'busy' : 'idle';
}

/**
 * Joins the runner folders of this PC with the org runners on GitHub by name.
 * githubRunners is null when GitHub gave no list, so a missing runner there proves nothing.
 */
export function mergeRunners(pcRunners: PcRunner[], githubRunners: OrgRunner[] | null): RunnerRow[] {
	const rows = pcRunners.map((here): RunnerRow => {
		const name = here.name ?? here.folder;
		const github = githubRunners?.find((runner) => runner.name === name) ?? null;
		return { name, here, github, ...judge(here, github, githubRunners !== null) };
	});
	const names = new Set(rows.map((row) => row.name));
	const elsewhere = (githubRunners ?? [])
		.filter((runner) => !names.has(runner.name))
		.map((github): RunnerRow => ({ name: github.name, here: null, github, tone: toneOf(githubState(github)), hint: null }));
	return [...rows, ...elsewhere];
}

function judge(here: PcRunner, github: OrgRunner | null, listed: boolean): { tone: Tone; hint: string | null } {
	const local = pcState(here);
	if (!listed) return { tone: toneOf(local), hint: null };
	if (!github) return { tone: 'warn', hint: 'GitHub has no runner with this name. Register it again with runner\\install.ps1.' };
	const remote = githubState(github);
	if (local !== 'stopped' && remote === 'offline') {
		return { tone: 'warn', hint: 'The process runs here, but GitHub sees it offline. Check the network, or register the runner again.' };
	}
	if (local === 'stopped' && remote !== 'offline') {
		return { tone: 'warn', hint: 'Stopped here, but GitHub sees it online, so a runner with this name runs on another machine.' };
	}
	if (local === 'stopped') return { tone: 'bad', hint: 'Stopped. Start it with START.cmd.' };
	return { tone: toneOf(remote === 'busy' ? 'busy' : local), hint: null };
}

function toneOf(state: 'stopped' | 'offline' | 'busy' | 'idle'): Tone {
	if (state === 'stopped' || state === 'offline') return 'bad';
	return state === 'busy' ? 'busy' : 'ok';
}
