import type { OrgStatus, WorkflowRun } from './org-status.ts';
import { activeStatuses, type LiveJob } from './placement.ts';
import type { ThisPcStatus } from './this-pc.ts';

/** The color of a status dot: green, blue, amber or red. */
export type Tone = 'ok' | 'busy' | 'warn' | 'bad';

const waitingStatuses = new Set(['queued', 'waiting', 'pending']);

/** "12 s ago", "3 min ago", "2 h ago" or "5 d ago". A time ahead of now reads as 0 s. */
export function formatAge(iso: string, now: number): string {
	const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
	if (seconds < 60) return `${seconds} s ago`;
	if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
	if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
	return `${Math.round(seconds / 86400)} d ago`;
}

export function toneOfRun({ status, conclusion }: Pick<WorkflowRun, 'status' | 'conclusion'>): Tone {
	if (waitingStatuses.has(status)) return 'warn';
	if (activeStatuses.has(status)) return 'busy';
	if (conclusion === 'success' || conclusion === 'skipped') return 'ok';
	if (conclusion === 'cancelled' || conclusion === 'neutral') return 'warn';
	return 'bad';
}

const jobs = (count: number) => `${count} job${count === 1 ? '' : 's'}`;

/** The headline: the worst problem first, then jobs on this PC, then other runners, then the GitHub queue. */
export function summarizeCi(pc: ThisPcStatus, org: OrgStatus, live: LiveJob[], idle: string[] = []): { tone: Tone; text: string } {
	if (pc.supported) {
		const total = pc.runners.length;
		const down = pc.runners.filter((runner) => !runner.listener).length;
		if (!total) return { tone: 'bad', text: 'No runner is installed on this PC' };
		if (total === 1 && down) return { tone: 'bad', text: 'The runner on this PC is down' };
		if (down) return { tone: 'bad', text: `${down} of ${total} runners on this PC are down` };
	}
	if (!org.ok) return { tone: 'warn', text: 'GitHub is out of reach' };
	if (org.runners && !org.runners.some((runner) => runner.status === 'online')) {
		return { tone: 'bad', text: 'No runner is online' };
	}
	const count = (place: LiveJob['place']) => live.filter((job) => job.place === place).length;
	const [local, elsewhere, waiting] = [count('local'), count('elsewhere'), count('waiting')];
	if (idle.length) {
		const who = idle.length === 1 ? `${idle[0]} sits` : `${idle.length} runners on this PC sit`;
		return { tone: 'bad', text: `${who} idle while ${jobs(waiting)} ${waiting === 1 ? 'waits' : 'wait'} on GitHub` };
	}
	const queue = waiting ? [`${waiting} waiting on GitHub`] : [];
	if (local) {
		const others = elsewhere ? [`${elsewhere} on other runners`] : [];
		return { tone: 'busy', text: [`Building ${jobs(local)} on this PC`, ...others, ...queue].join(', ') };
	}
	if (elsewhere) return { tone: 'busy', text: [`${jobs(elsewhere)} on other runners`, ...queue].join(', ') };
	if (waiting) return { tone: 'warn', text: `${jobs(waiting)} waiting on GitHub for a runner` };
	return { tone: 'ok', text: 'CI is up and idle' };
}
