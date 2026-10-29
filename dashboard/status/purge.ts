/** The calls a purge makes on one run. */
export type RunApi = {
	status(): Promise<string>;
	forceCancel(): Promise<void>;
	remove(): Promise<void>;
};

export type PurgeTiming = { pollMs: number; timeoutMs: number; sleep: (ms: number) => Promise<void> };

const defaultTiming: PurgeTiming = {
	pollMs: 2_000,
	timeoutMs: 60_000,
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Force cancels an unfinished run, waits for GitHub to mark it completed, then deletes it with its logs and artifacts. */
export async function purgeRun(api: RunApi, timing: PurgeTiming = defaultTiming): Promise<void> {
	if ((await api.status()) !== 'completed') {
		try {
			await api.forceCancel();
		} catch (error) {
			// The run may finish between the status read and the cancel, and GitHub then refuses the cancel.
			if ((await api.status()) !== 'completed') throw error;
		}
		const deadline = Date.now() + timing.timeoutMs;
		while ((await api.status()) !== 'completed') {
			if (Date.now() >= deadline) throw new Error(`The run didn't stop within ${timing.timeoutMs / 1000} s. Try Purge again.`);
			await timing.sleep(timing.pollMs);
		}
	}
	// GitHub deletes only a completed run.
	await api.remove();
}
