import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { buildScript, localBuildOf, workspaceRoot as rootOfWorkspace } from './local-build-target.ts';

const execFileAsync = promisify(execFile);
const buildTimeoutMs = 30 * 60_000;
const artifactTtlMs = 6 * 60 * 60_000;
const buildRoot = join(tmpdir(), 'local-ci-releases');
const artifacts = new Map<string, { app: string; file: string; createdAt: number }>();
type BuildControl = { controller: AbortController; pid: number | null; cancelled: boolean };
const running = new Map<string, BuildControl>();

/** Local builds execute inside the dashboard server process. Stop only the tracked process tree. */
export function activeLocalBuilds(): string[] {
  return [...running.keys()];
}

export async function cancelLocalRelease(app: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const control = running.get(app);
  if (!control) return { ok: false, error: 'No local build of this app is running.' };
  if (control.cancelled) return { ok: true };
  control.cancelled = true;
  const pid = control.pid;
  if (pid !== null) {
    // A process that just exited is harmless; abort covers a concurrently started next command.
    await killProcessTree(pid).catch(() => undefined);
  }
  control.controller.abort();
  return { ok: true };
}

export type LocalBuildResult =
  | { ok: true; token: string; fileName: string; commit: string }
  | { ok: false; error: string };

/** Fetches main, builds its APK in a temporary clone, and keeps only the APK for installation. */
export async function buildLocalRelease(app: string): Promise<LocalBuildResult> {
  const target = await localBuildOf(app);
  if (!target) return { ok: false, error: `This app has no ${buildScript} in its repo.` };
  if (running.has(app)) return { ok: false, error: 'A local build of this app is already running.' };
  const control: BuildControl = { controller: new AbortController(), pid: null, cancelled: false };
  running.set(app, control);
  const workspaceRoot = rootOfWorkspace();
  const sourceRepo = resolve(workspaceRoot, target.repo);
  let buildDir: string | null = null;
  try {
    await mkdir(buildRoot, { recursive: true });
    await pruneOldBuilds();
    buildDir = await mkdtemp(join(buildRoot, `${safeName(app)}-`));
    await run('git', ['fetch', '--tags', 'origin', 'main'], sourceRepo, 120_000, control);
    const commit = (await run('git', ['rev-parse', 'FETCH_HEAD'], sourceRepo, 120_000, control)).trim();
    if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Git did not return a commit for main.');
    await run(
      'git',
      ['clone', '--shared', '--no-checkout', sourceRepo, join(buildDir, 'source')],
      workspaceRoot,
      120_000,
      control,
    );
    const checkout = join(buildDir, 'source');
    await run('git', ['checkout', '--detach', commit], checkout, 120_000, control);
    await run('mise', ['x', '--', 'pnpm', 'install', '--frozen-lockfile'], checkout, 120_000, control);
    const script = `${target.dir}/${buildScript}`;
    if (!(await fileExists(join(checkout, script)))) throw new Error(`main has no ${script}.`);
    await run('bash', [script], checkout, buildTimeoutMs, control);
    if (control.cancelled) throw new Error('Local build was cancelled.');
    // Each build script leaves its APK in dist/ beside its scripts/ folder.
    const builtApk = await newestApk(join(checkout, target.dir, 'dist'));
    if (!builtApk) throw new Error(`The build finished without an APK in ${target.dir}/dist.`);

    const token = randomUUID();
    const fileName = `${safeName(app)}-local.apk`;
    const artifactDir = join(buildRoot, 'artifacts', token);
    await mkdir(artifactDir, { recursive: true });
    const file = join(artifactDir, fileName);
    await copyFile(builtApk, file);
    if (control.cancelled) {
      await rm(artifactDir, { recursive: true, force: true });
      throw new Error('Local build was cancelled.');
    }
    artifacts.set(token, { app, file, createdAt: Date.now() });
    return { ok: true, token, fileName, commit };
  } catch (error) {
    return { ok: false, error: control.cancelled ? 'Local build force-stopped.' : errorText(error) };
  } finally {
    // An Expo app keeps gradlew in android/, a native one beside its build script.
    const dir = buildDir && (await localBuildOf(app))?.dir;
    for (const gradleDir of !control.cancelled && dir ? [dir, `${dir}/android`] : []) {
      const path = resolve(buildDir as string, 'source', gradleDir);
      if (await fileExists(join(path, 'gradlew')))
        await run('bash', ['-lc', './gradlew --stop'], path).catch(() => undefined);
    }
    if (buildDir) await rm(buildDir, { recursive: true, force: true }).catch(() => undefined);
    running.delete(app);
  }
}

/** Returns the temporary APK for a token issued by this server process. */
export async function localArtifact(token: string): Promise<{ app: string; file: string } | null> {
  if (!isLocalArtifactToken(token)) return null;
  const artifact = artifacts.get(token);
  if (!artifact) return null;
  if (Date.now() - artifact.createdAt > artifactTtlMs || !(await fileExists(artifact.file))) {
    artifacts.delete(token);
    await rm(dirname(artifact.file), { recursive: true, force: true }).catch(() => undefined);
    return null;
  }
  return artifact;
}

export function isLocalArtifactToken(token: unknown): token is string {
  return typeof token === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(token);
}

export async function forgetLocalArtifact(token: string): Promise<void> {
  const artifact = artifacts.get(token);
  artifacts.delete(token);
  if (artifact) await rm(dirname(artifact.file), { recursive: true, force: true }).catch(() => undefined);
}

async function pruneOldBuilds(): Promise<void> {
  const cutoff = Date.now() - artifactTtlMs;
  const entries = await readdir(buildRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'artifacts') continue;
    const path = join(buildRoot, entry.name);
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs < cutoff) await rm(path, { recursive: true, force: true }).catch(() => undefined);
  }
  const artifactDirs = await readdir(join(buildRoot, 'artifacts'), { withFileTypes: true }).catch(() => []);
  for (const entry of artifactDirs) {
    if (!entry.isDirectory()) continue;
    const path = join(buildRoot, 'artifacts', entry.name);
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs < cutoff) await rm(path, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function killProcessTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    // Windows taskkill /T stops bash, Gradle, Java and all other descendants.
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 10_000, windowsHide: true });
  } else {
    // Each spawned command has its own process group on Unix.
    process.kill(-pid, 'SIGKILL');
  }
}

async function run(
  command: string,
  args: string[],
  cwd: string,
  timeout = 120_000,
  control?: BuildControl,
): Promise<string> {
  if (control?.cancelled) throw new Error('Local build was cancelled.');
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      detached: process.platform !== 'win32',
      signal: control?.controller.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (control) control.pid = child.pid ?? null;

    let output = '';
    let timedOut = false;
    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      // Keep enough of the command log to report a useful failure without unbounded memory use.
      if (output.length > 24 * 1024 * 1024) output = output.slice(-24 * 1024 * 1024);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) void killProcessTree(child.pid).catch(() => child.kill());
      else child.kill();
    }, timeout);
    const finish = () => {
      clearTimeout(timer);
      if (control && control.pid === child.pid) control.pid = null;
    };

    child.on('error', (error) => {
      finish();
      reject(new Error(output.slice(-4000) || error.message));
    });
    child.on('close', (code) => {
      finish();
      if (control?.cancelled) reject(new Error('Local build was cancelled.'));
      else if (timedOut) reject(new Error(`Build command timed out after ${timeout}ms. ${output.slice(-4000)}`));
      else if (code !== 0) reject(new Error(output.slice(-4000) || `${command} exited with status ${code}`));
      else resolve(output);
    });
  });
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

async function newestApk(dir: string): Promise<string | null> {
  const files = (await readdir(dir).catch(() => [] as string[])).filter((name) => name.toLowerCase().endsWith('.apk'));
  const dated = await Promise.all(
    files.map(async (name) => ({ path: join(dir, name), at: (await stat(join(dir, name))).mtimeMs })),
  );
  return dated.toSorted((a, b) => b.at - a.at)[0]?.path ?? null;
}

async function fileExists(path: string): Promise<boolean> {
  return stat(path)
    .then((item) => item.isFile())
    .catch(() => false);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
