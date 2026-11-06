'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus, githubStatus } from './org-status.ts';
import { releasesRepo } from './releases.ts';
import { orgName } from './settings.ts';
import {
  obsoleteApkReleases,
  oldArtifacts,
  type StoredArtifact,
  type StoredRelease,
} from './storage-cleanup.ts';

type RepoInfo = { name: string; archived: boolean };
type ActionRun = { id: number };
type CleanupItem = { kind: 'artifact'; repo: string; id: number } | { kind: 'release'; id: number };
type CleanupPlan = {
  createdAt: number;
  items: CleanupItem[];
  next: number;
  busy: boolean;
  deletedArtifacts: number;
  deletedReleases: number;
  failed: number;
  firstError: string | null;
};

export type CleanupPreview =
  | {
      ok: true;
      planId: string;
      artifacts: number;
      releases: number;
      artifactBytes: number;
      keptApps: number;
      protectedArtifacts: number;
      skippedArchivedRepos: number;
    }
  | { ok: false; error: string };

export type CleanupProgress =
  | {
      ok: true;
      done: boolean;
      deletedArtifacts: number;
      deletedReleases: number;
      failed: number;
      remaining: number;
      error: string | null;
    }
  | { ok: false; error: string };

const planLifetimeMs = 30 * 60_000;
const batchSize = 15;
const maxPages = 100;
const pageSize = 100;

// Next may bundle a server action in a separate module; keep preview plans shared
// across requests in the local dashboard process. Nothing is sent to GitHub yet.
const plans: Map<string, CleanupPlan> = ((globalThis as Record<symbol, Map<string, CleanupPlan> | undefined>)[
  Symbol.for('local-ci.cleanup-plans')
] ??= new Map());

/** Read every page before deciding what to delete; a truncated list could delete an app's latest APK. */
async function listAll<T>(path: string, key?: string): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${path}${path.includes('?') ? '&' : '?'}per_page=${pageSize}&page=${page}`;
    const payload = (await (await callGitHub(url)).json()) as Record<string, unknown> | T[];
    const items = key ? (payload as Record<string, unknown>)[key] : payload;
    if (!Array.isArray(items)) throw new Error(`Unexpected GitHub response for ${path}`);
    result.push(...(items as T[]));
    if (items.length < pageSize) return result;
  }
  throw new Error(`Too many GitHub pages at ${path}; nothing has been deleted.`);
}

/** Limit inventory requests to avoid GitHub's secondary rate limit. */
async function collectArtifacts(repos: RepoInfo[]): Promise<{
  items: CleanupItem[];
  bytes: number;
  protectedArtifacts: number;
}> {
  const items: CleanupItem[] = [];
  let bytes = 0;
  let protectedArtifacts = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < repos.length) {
      const repo = repos[cursor++].name;
      if (!/^[a-z\d_.-]+$/i.test(repo)) throw new Error('Invalid GitHub repository name.');
      const base = `/repos/${orgName}/${repo}/actions`;
      let artifacts: StoredArtifact[];
      try {
        artifacts = await listAll<StoredArtifact>(`${base}/artifacts`, 'artifacts');
      } catch (error) {
        // Some org repos have Actions disabled, so GitHub has no artifacts for them.
        if (githubStatus(error) === 404) continue;
        throw new Error(`Cannot list ${repo} artifacts: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!artifacts.length) continue;
      const active = await Promise.all(
        ['in_progress', 'queued'].map((status) =>
          listAll<ActionRun>(`${base}/runs?status=${status}`, 'workflow_runs'),
        ),
      );
      const activeIds = new Set(active.flat().map((run) => run.id));
      const eligible = oldArtifacts(artifacts, activeIds);
      protectedArtifacts += artifacts.filter((artifact) => !artifact.expired).length - eligible.length;
      for (const artifact of eligible) {
        items.push({ kind: 'artifact', repo, id: artifact.id });
        bytes += Math.max(0, artifact.size_in_bytes || 0);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, repos.length) }, worker));
  return { items, bytes, protectedArtifacts };
}

/** Prepare a server-owned cleanup plan. This only READS GitHub and never deletes anything. */
export async function previewStorageCleanup(): Promise<CleanupPreview> {
  try {
    for (const [id, plan] of plans) if (Date.now() - plan.createdAt > planLifetimeMs) plans.delete(id);
    const repositoryList = await listAll<RepoInfo>(`/orgs/${orgName}/repos?type=all`);
    const activeRepos = repositoryList.filter((repo) => !repo.archived);
    const [artifacts, releaseList] = await Promise.all([
      collectArtifacts(activeRepos),
      listAll<StoredRelease>(`/repos/${releasesRepo}/releases`),
    ]);
    const { obsolete, kept } = obsoleteApkReleases(releaseList);
    const items: CleanupItem[] = [
      ...artifacts.items,
      ...obsolete.map((release): CleanupItem => ({ kind: 'release', id: release.id })),
    ];
    const planId = randomUUID();
    plans.set(planId, {
      createdAt: Date.now(),
      items,
      next: 0,
      busy: false,
      deletedArtifacts: 0,
      deletedReleases: 0,
      failed: 0,
      firstError: null,
    });
    return {
      ok: true,
      planId,
      artifacts: artifacts.items.length,
      releases: obsolete.length,
      artifactBytes: artifacts.bytes,
      keptApps: kept.length,
      protectedArtifacts: artifacts.protectedArtifacts,
      skippedArchivedRepos: repositoryList.length - activeRepos.length,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Delete a short batch, so the browser can show progress and GitHub throttling is less likely. */
export async function runStorageCleanupBatch(planId: string): Promise<CleanupProgress> {
  if (typeof planId !== 'string' || !/^[0-9a-f-]{36}$/.test(planId))
    return { ok: false, error: 'Invalid cleanup plan.' };
  const plan = plans.get(planId);
  if (!plan || Date.now() - plan.createdAt > planLifetimeMs)
    return { ok: false, error: 'Cleanup preview expired. Start again to refresh the counts.' };
  if (plan.busy) return { ok: false, error: 'Cleanup is already running in another tab.' };
  plan.busy = true;
  try {
    const batch = plan.items.slice(plan.next, plan.next + batchSize);
    for (const item of batch) {
      const path =
        item.kind === 'artifact'
          ? `/repos/${orgName}/${item.repo}/actions/artifacts/${item.id}`
          : `/repos/${releasesRepo}/releases/${item.id}`;
      try {
        await callGitHub(path, 'DELETE');
        if (item.kind === 'artifact') plan.deletedArtifacts++;
        else plan.deletedReleases++;
      } catch (error) {
        const status = githubStatus(error);
        if (status === 404) {
          // Another cleanup already deleted it.
          continue;
        }
        plan.failed++;
        plan.firstError ??= error instanceof Error ? error.message : String(error);
        // Permission and rate-limit errors are not transient per item.
        if (status === 401 || status === 403 || status === 429) {
          return { ok: false, error: plan.firstError ?? 'GitHub refused deletion.' };
        }
      } finally {
        plan.next++;
      }
    }
    const done = plan.next >= plan.items.length;
    if (done) {
      forgetOrgStatus();
      revalidatePath('/');
    }
    return {
      ok: true,
      done,
      deletedArtifacts: plan.deletedArtifacts,
      deletedReleases: plan.deletedReleases,
      failed: plan.failed,
      remaining: plan.items.length - plan.next,
      error: plan.firstError,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    plan.busy = false;
  }
}
