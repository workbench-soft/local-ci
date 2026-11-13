// Next calls register once as the server starts, so the sweep runs with no tab open.
// Only the built server sweeps and routes, so a dev server in a worktree changes no org run or variable.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  const { startCancellingSuperseded } = await import('./status/cancel-superseded.ts');
  startCancellingSuperseded();
  const { startCloudRouter } = await import('./status/cloud-router.ts');
  startCloudRouter();
  const { startRunHistory } = await import('./status/run-history.ts');
  startRunHistory();
}
