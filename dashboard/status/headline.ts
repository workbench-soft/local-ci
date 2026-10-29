import type { OrgStatus, WorkflowRun } from './org-status';
import type { ThisPcStatus } from './this-pc';

/** The color of a status dot: green, blue, amber or red. */
export type Tone = 'ok' | 'busy' | 'warn' | 'bad';

/** Statuses of a run that hasn't finished. */
export const activeStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

const waitingStatuses = new Set(['queued', 'waiting', 'pending']);

/** "12 s ago", "3 min ago", "2 h ago" or "5 d ago". A time ahead of now reads as 0 s. */
export function formatAge(iso: string, now: number): string {
	const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
	if (seconds < 60) return `${seconds} s ago`;
	if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
	if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
	return `${Math.round(seconds / 86400)} d ago`;
}

export function toneOfRun({ status, conclusion }: WorkflowRun): Tone {
	if (waitingStatuses.has(status)) return 'warn';
	if (activeStatuses.has(status)) return 'busy';
	if (conclusion === 'success' || conclusion === 'skipped') return 'ok';
	if (conclusion === 'cancelled' || conclusion === 'neutral') return 'warn';
	return 'bad';
}

/** The headline: the worst problem first, then builds, then the queue. */
export function summarizeCi(pc: ThisPcStatus, org: OrgStatus): { tone: Tone; text: string } {
	if (pc.supported && !pc.listener) return { tone: 'bad', text: 'The runner on this PC is down' };
	if (!org.ok) return { tone: 'warn', text: 'GitHub is out of reach' };
	if (org.runners && !org.runners.some((runner) => runner.status === 'online')) {
		return { tone: 'bad', text: 'No runner is online' };
	}
	const building = org.runs.filter((run) => run.status === 'in_progress').length;
	const queued = org.runs.filter((run) => activeStatuses.has(run.status)).length - building;
	const queue = `${queued} in the queue`;
	if (building) {
		const runs = `Building ${building} run${building > 1 ? 's' : ''}`;
		return { tone: 'busy', text: queued ? `${runs}, ${queue}` : runs };
	}
	if (queued) return { tone: 'warn', text: `No run builds, ${queue}` };
	return { tone: 'ok', text: 'CI is up and idle' };
}
