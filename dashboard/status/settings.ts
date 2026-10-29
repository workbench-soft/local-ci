// The runner scripts read the same variable, so the page and the runner agree on the org.
export const orgName = process.env.RUNNER_ORG || 'workbench-soft';
