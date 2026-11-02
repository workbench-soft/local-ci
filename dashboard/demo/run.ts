// Serves the page with `next dev` and the made up runs of demo/fake-github.ts, then takes the shots.
// A dev server starts no sweep and no cloud router, and the fake drops every write to GitHub.
import { execFileSync, spawn } from 'node:child_process';

const step = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit', shell: true });
const server = spawn('pnpm', ['exec', 'next', 'dev', '-H', '127.0.0.1', '-p', '4282'], {
  stdio: 'ignore',
  shell: true,
  env: { ...process.env, NODE_OPTIONS: '--import ./demo/fake-github.ts' },
});
const up = () =>
  fetch('http://127.0.0.1:4282/').then(
    () => true,
    () => false,
  );
try {
  for (let tries = 0; !(await up()); tries++) {
    if (tries > 90) throw new Error('next dev did not start on port 4282.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  step('node', ['--no-warnings', 'demo/capture.ts']);
} finally {
  // next runs under pnpm and node, so Windows needs the whole tree stopped.
  if (process.platform === 'win32') step('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
}
