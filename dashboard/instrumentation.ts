// Next calls register once as the server starts, so the sweep runs with no tab open.
export async function register() {
	if (process.env.NEXT_RUNTIME !== 'nodejs') return;
	const { startCancellingSuperseded } = await import('./status/cancel-superseded.ts');
	startCancellingSuperseded();
}
