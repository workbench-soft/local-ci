import type { GitHubStatus, Run } from './org-status';
import type { LocalStatus } from './this-pc';

export const active = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

export type Tone = 'ok' | 'busy' | 'warn' | 'bad';

export function ago(iso: string, now: number): string {
	const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
	if (s < 60) return `${s} s ago`;
	if (s < 3600) return `${Math.round(s / 60)} min ago`;
	if (s < 86400) return `${Math.round(s / 3600)} h ago`;
	return `${Math.round(s / 86400)} d ago`;
}

export function runTone(run: Run): Tone {
	if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') return 'warn';
	if (active.has(run.status)) return 'busy';
	if (run.conclusion === 'success' || run.conclusion === 'skipped') return 'ok';
	if (run.conclusion === 'cancelled' || run.conclusion === 'neutral') return 'warn';
	return 'bad';
}

export function verdict(local: LocalStatus, gh: GitHubStatus): { tone: Tone; text: string } {
	if (local.supported && !local.listener) return { tone: 'bad', text: 'The runner on this PC is down' };
	if (!gh.ok) return { tone: 'warn', text: 'GitHub is out of reach' };
	const online = gh.runners?.filter((r) => r.status === 'online');
	if (online && online.length === 0) return { tone: 'bad', text: 'No runner is online' };
	const busy = gh.runs.filter((r) => r.status === 'in_progress').length;
	const queued = gh.runs.filter((r) => active.has(r.status)).length - busy;
	const wait = queued ? `${queued} in the queue` : '';
	if (busy) return { tone: 'busy', text: `Building ${busy} run${busy > 1 ? 's' : ''}${wait ? `, ${wait}` : ''}` };
	if (queued) return { tone: 'warn', text: `No run builds, ${wait}` };
	return { tone: 'ok', text: 'CI is up and idle' };
}
