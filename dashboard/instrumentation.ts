// Next calls register once as the server starts, so the sweep runs with no tab open.
// Only the built server sweeps, so a dev server in a worktree cancels no org run.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  const { startCancellingSuperseded } = await import('./status/cancel-superseded.ts');
  startCancellingSuperseded();
}
