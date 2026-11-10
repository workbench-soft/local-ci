import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { repoOfApp } from './latest-releases.ts';

/** Where an app's APK build sits in its repo: the folder that holds scripts/build-apk.sh and gets dist/. */
export type LocalBuildTarget = { repo: string; dir: string };

export const buildScript = 'scripts/build-apk.sh';

/** The folder that holds the clone of each org repo on this PC. */
export function workspaceRoot(): string {
  return process.env.WBS_ROOT || resolve(process.cwd(), '../..');
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * The APK build of an app, found by the repo layout. A repo with several apps keeps each in apps/<dir>,
 * where <dir> is the app or the app without its repo prefix, such as memories-mobile in apps/mobile.
 * A build script at the repo root serves every app of the repo.
 */
export async function localBuildOf(app: string, root = workspaceRoot()): Promise<LocalBuildTarget | null> {
  if (!/^[\w.-]+$/.test(app) || app.includes('..')) return null;
  const repo = repoOfApp(app);
  const clone = join(root, repo);
  const apps = await readdir(join(clone, 'apps')).catch(() => [] as string[]);
  const own = apps.find((dir) => dir === app || `${repo}-${dir}` === app);
  for (const dir of own ? [`apps/${own}`, '.'] : ['.'])
    if (await exists(join(clone, dir, buildScript))) return { repo, dir };
  return null;
}
