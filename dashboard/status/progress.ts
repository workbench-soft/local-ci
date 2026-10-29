/** How far a job got through its steps, as GitHub lists them. */
export type StepCount = { done: number; total: number; current: string | null };

/** The bar under a running job: how full it is and what its text says. */
export type JobProgress = { fraction: number; step: string | null; time: string | null; over: boolean };

/** Past jobs stay this far below full, since a job near its usual time may still have work left. */
const maxFraction = 0.99;

export function countSteps(steps: { name: string; status: string }[] | undefined): StepCount {
	const list = steps ?? [];
	return {
		done: list.filter((step) => step.status === 'completed').length,
		total: list.length,
		current: list.find((step) => step.status === 'in_progress')?.name ?? null,
	};
}

/** The median time of the finished jobs with this name, or null when none finished. */
export function typicalDuration(name: string, past: { name: string; startedAt: string | null; completedAt: string | null }[]): number | null {
	const times = past
		.filter((job) => job.name === name && job.startedAt && job.completedAt)
		.map((job) => Date.parse(job.completedAt as string) - Date.parse(job.startedAt as string))
		.filter((ms) => ms > 0)
		.sort((a, b) => a - b);
	if (!times.length) return null;
	const middle = Math.floor(times.length / 2);
	return times.length % 2 ? times[middle] : Math.round((times[middle - 1] + times[middle]) / 2);
}

/** Fills by time when a past run gives the usual length, else by finished steps. */
export function jobProgress(steps: StepCount, typicalMs: number | null, startedAt: string, now: number): JobProgress {
	const step = steps.total ? `step ${Math.min(steps.done + 1, steps.total)} of ${steps.total}${steps.current ? `: ${steps.current}` : ''}` : null;
	if (typicalMs) {
		const elapsed = Math.max(0, now - Date.parse(startedAt));
		const left = typicalMs - elapsed;
		const over = left < 0;
		const time = over ? `${formatMinutes(-left)} over the usual ${formatMinutes(typicalMs)}` : `about ${formatMinutes(left)} left`;
		return { fraction: Math.min(elapsed / typicalMs, maxFraction), step, time, over };
	}
	return { fraction: steps.total ? steps.done / steps.total : 0, step, time: null, over: false };
}

function formatMinutes(ms: number): string {
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds} s`;
	return `${Math.round(seconds / 60)} min`;
}
