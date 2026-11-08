'use server';

import { revalidatePath } from 'next/cache';
import { installApkFile, type InstallResult } from './install-apk.ts';
import { buildLocalRelease, cancelLocalRelease, forgetLocalArtifact, localArtifact, type LocalBuildResult } from './local-build-runner.ts';

/** Builds the latest main of a supported Android app in a temporary checkout. */
export async function buildLatestMain(app: string): Promise<LocalBuildResult> {
  if (typeof app !== 'string') return { ok: false, error: 'Unknown app.' };
  const result = await buildLocalRelease(app);
  revalidatePath('/');
  return result;
}

/** Force-stops the process tree of an active local APK build. */
export async function cancelLocalBuild(app: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof app !== 'string') return { ok: false, error: 'Unknown app.' };
  const result = await cancelLocalRelease(app);
  revalidatePath('/');
  return result;
}

/** Installs a local APK issued by this dashboard process. */
export async function installLocalBuild(token: string): Promise<InstallResult> {
  const artifact = await localArtifact(token);
  if (!artifact) return { ok: false, error: 'This local build expired. Build it again.' };
  const result = await installApkFile(artifact.file);
  if (result.ok) await forgetLocalArtifact(token);
  revalidatePath('/');
  return result;
}
