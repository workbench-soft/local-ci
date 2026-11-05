import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { releaseTargetFor } from './release-config.ts';

const execFileAsync = promisify(execFile);
const buildTimeoutMs = 30 * 60_000;
const artifactTtlMs = 6 * 60 * 60_000;
const buildRoot = join(tmpdir(), 'local-ci-releases');
const artifacts = new Map<string, { app: string; file: string; createdAt: number }>();
const running = new Set<string>();

export type LocalBuildResult =
  | { ok: true; token: string; fileName: string; commit: string }
  | { ok: false; error: string };

/** Fetches main, builds its APK in a temporary clone, and keeps only the APK for installation. */
export async function buildLocalRelease(app: string): Promise<LocalBuildResult> {
  const target = releaseTargetFor(app);
  if (!target?.build) return { ok: false, error: 'This app has no local Android build configured.' };
  if (running.has(app)) return { ok: false, error: 'A local build of this app is already running.' };
  running.add(app);
  const workspaceRoot = process.env.WBS_ROOT || resolve(process.cwd(), '../..');
  const sourceRepo = resolve(workspaceRoot, target.repo);
  let buildDir: string | null = null;
  try {
    await mkdir(buildRoot, { recursive: true });
    await pruneOldBuilds();
    buildDir = await mkdtemp(join(buildRoot, `${safeName(app)}-`));
    await run('git', ['fetch', '--tags', 'origin', 'main'], sourceRepo);
    const commit = (await run('git', ['rev-parse', 'FETCH_HEAD'], sourceRepo)).trim();
    if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Git did not return a commit for main.');
    await run('git', ['clone', '--shared', '--no-checkout', sourceRepo, join(buildDir, 'source')], workspaceRoot);
    const checkout = join(buildDir, 'source');
    await run('git', ['checkout', '--detach', commit], checkout);
    await run('mise', ['x', '--', 'pnpm', 'install', '--frozen-lockfile'], checkout);
    await run('bash', [target.build.script], checkout, undefined, buildTimeoutMs);
    const builtApk = resolve(checkout, target.build.apk);
    if (!(await fileExists(builtApk))) throw new Error(`The build finished without producing ${target.build.apk}.`);

    const token = randomUUID();
    const fileName = `${safeName(app)}-local.apk`;
    const artifactDir = join(buildRoot, 'artifacts', token);
    await mkdir(artifactDir, { recursive: true });
    const file = join(artifactDir, fileName);
    await copyFile(builtApk, file);
    artifacts.set(token, { app, file, createdAt: Date.now() });
    return { ok: true, token, fileName, commit };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  } finally {
    const config = releaseTargetFor(app)?.build;
    if (buildDir && config?.gradleDir) {
      const gradleDir = resolve(buildDir, 'source', config.gradleDir);
      if (await fileExists(join(gradleDir, 'gradlew'))) {
        await run('bash', ['-lc', './gradlew --stop'], gradleDir).catch(() => undefined);
      }
    }
    if (buildDir) await rm(buildDir, { recursive: true, force: true }).catch(() => undefined);
    running.delete(app);
  }
}

/** Returns the temporary APK for a token issued by this server process. */
export async function localArtifact(token: string): Promise<{ app: string; file: string } | null> {
  if (typeof token !== 'string' || !/^[da-f-]{36}$/i.test(token)) return null;
  const artifact = artifacts.get(token);
  if (!artifact) return null;
  if (Date.now() - artifact.createdAt > artifactTtlMs || !(await fileExists(artifact.file))) {
    artifacts.delete(token);
    await rm(dirname(artifact.file), { recursive: true, force: true }).catch(() => undefined);
    return null;
  }
  return artifact;
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

async function run(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeout = 120_000,
): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      maxBuffer: 24 * 1024 * 1024,
      windowsHide: true,
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    const output = `${detail.stdout ?? ''}\n${detail.stderr ?? ''}`.trim();
    throw new Error(output.slice(-4000) || detail.message || String(error));
  }
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

async function fileExists(path: string): Promise<boolean> {
  return stat(path)
    .then((item) => item.isFile())
    .catch(() => false);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
