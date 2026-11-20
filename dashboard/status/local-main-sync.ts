'use server';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { workspaceRoot } from './local-build-target.ts';
import { orgName } from './settings.ts';

const exec = promisify(execFile);
const active = new Set<string>();
type FileChange = { path: string; state: string; diff: string };
export type SyncInspection = { ok: true; repo: string; branch: string; local: string; remote: string; changes: FileChange[]; diverged: boolean; snapshot: string } | { ok: false; error: string };
export type SyncResult = { ok: true; commit: string; stash?: string } | { ok: false; error: string; stash?: string };

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await exec('git', args, { cwd, timeout: 45000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  return stdout.trimEnd();
}

async function directory(repo: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(repo) || repo.includes('..')) throw Error('Invalid repository.');
  const root = await realpath(workspaceRoot());
  const path = await realpath(join(root, repo));
  if (relative(root, path).startsWith('..' + sep) || relative(root, path) === '..') throw Error('Repository outside workspace.');
  if (!(await stat(path)).isDirectory() || (await git(path, 'rev-parse', '--show-toplevel')).toLowerCase() !== path.toLowerCase()) throw Error('Not a repository checkout.');
  const remote = await git(path, 'remote', 'get-url', 'origin');
  const valid = new RegExp('^(?:https://github\\.com/|git@github\\.com:|ssh://git@github\\.com/)' + orgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/' + repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\.git)?/?$', 'i');
  if (!valid.test(remote)) throw Error('Origin does not match the expected organization repository.');
  return path;
}
const hash = (parts: string[]) => createHash('sha256').update(parts.join('\0')).digest('hex');

async function inspect(repo: string): Promise<SyncInspection> {
  const cwd = await directory(repo);
  await git(cwd, 'fetch', '--no-tags', 'origin', 'main');
  const branch = await git(cwd, 'branch', '--show-current');
  const local = await git(cwd, 'rev-parse', 'HEAD');
  const remote = await git(cwd, 'rev-parse', 'refs/remotes/origin/main');
  const porcelain = await git(cwd, 'status', '--porcelain=v1', '-uall');
  const names = porcelain ? porcelain.split(/\r?\n/) : [];
  const changes: FileChange[] = [];
  for (const line of names.slice(0, 100)) {
    const state = line.slice(0, 2);
    const path = line.slice(3);
    // Git's default quoted filenames can contain escaped characters; never pass these through a shell.
    const diff = state === '??' ? 'Untracked file (not yet in Git).' : await git(cwd, 'diff', 'HEAD', '--', path).catch(() => 'Diff unavailable.');
    changes.push({ path, state, diff: diff.slice(0, 16000) });
  }
  const diverged = (await git(cwd, 'rev-list', '--count', 'origin/main..HEAD')) !== '0';
  return { ok: true, repo, branch, local, remote, changes, diverged, snapshot: hash([local, remote, porcelain]) };
}

export async function inspectLocalMain(repo: string): Promise<SyncInspection> {
  try { return await inspect(repo); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function syncLocalMain(repo: string, snapshot: string, stash: boolean): Promise<SyncResult> {
  if (typeof repo !== 'string' || typeof snapshot !== 'string' || typeof stash !== 'boolean') return { ok: false, error: 'Invalid request.' };
  if (active.has(repo)) return { ok: false, error: 'Update already in progress.' };
  active.add(repo);
  let stashRef: string | undefined;
  try {
    const before = await inspect(repo);
    if (!before.ok) return before;
    if (before.snapshot !== snapshot) return { ok: false, error: 'Checkout changed. Review the changes again.' };
    if (before.branch !== 'main') return { ok: false, error: 'Switch to main manually before updating; current branch: ' + before.branch };
    if (before.diverged) return { ok: false, error: 'Local commits diverge from origin/main. Resolve them manually; stash cannot save commits.' };
    if (before.changes.length && !stash) return { ok: false, error: 'Local changes require explicit stash confirmation.' };
    const cwd = await directory(repo);
    if (before.changes.length) {
      await git(cwd, 'stash', 'push', '--include-untracked', '-m', 'Local CI before main sync ' + new Date().toISOString());
      stashRef = await git(cwd, 'rev-parse', 'refs/stash');
      if (await git(cwd, 'status', '--porcelain=v1', '-uall')) return { ok: false, error: 'Checkout is not clean after stash. Update cancelled.', stash: stashRef };
    }
    await git(cwd, 'merge', '--ff-only', 'refs/remotes/origin/main');
    return { ok: true, commit: await git(cwd, 'rev-parse', 'HEAD'), stash: stashRef };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), stash: stashRef };
  } finally { active.delete(repo); }
}
