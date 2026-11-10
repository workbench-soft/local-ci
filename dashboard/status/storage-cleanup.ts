import { tagPrefix } from './releases.ts';

/** GitHub API snapshots used when planning an explicit storage cleanup. */
export type StoredArtifact = {
  id: number;
  size_in_bytes: number;
  expired: boolean;
  workflow_run?: { id: number } | null;
};

export type StoredRelease = {
  id: number;
  tag_name: string;
  created_at: string;
  published_at?: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string }[];
};

/** A completed workflow's temporary files are safe to remove; an active run's are not. */
export function oldArtifacts(artifacts: StoredArtifact[], activeRunIds: ReadonlySet<number>): StoredArtifact[] {
  return artifacts.filter(
    (artifact) =>
      Number.isSafeInteger(artifact.id) &&
      artifact.id > 0 &&
      !artifact.expired &&
      (!artifact.workflow_run || !activeRunIds.has(artifact.workflow_run.id)),
  );
}

/** APKs in the shared release repository are published as <app>-v<version>. */
export function apkAppOf(release: StoredRelease): string | null {
  if (release.draft || release.prerelease || !release.assets.some((asset) => asset.name.toLowerCase().endsWith('.apk')))
    return null;
  return tagPrefix(release.tag_name);
}

function publishedTime(release: StoredRelease): number {
  return Date.parse(release.published_at || release.created_at) || 0;
}

/**
 * Keep the newest published APK release for EACH app, not the newest in the
 * shared repository. Do not touch releases without an APK, draft releases,
 * prereleases, or tags with an unknown naming convention.
 */
export function obsoleteApkReleases(releases: StoredRelease[]): {
  obsolete: StoredRelease[];
  kept: { app: string; tag: string }[];
} {
  const grouped = new Map<string, StoredRelease[]>();
  for (const release of releases) {
    const app = apkAppOf(release);
    if (!app || !Number.isSafeInteger(release.id) || release.id <= 0) continue;
    const group = grouped.get(app) ?? [];
    group.push(release);
    grouped.set(app, group);
  }
  const obsolete: StoredRelease[] = [];
  const kept: { app: string; tag: string }[] = [];
  for (const [app, group] of grouped) {
    group.sort((a, b) => publishedTime(b) - publishedTime(a) || b.id - a.id);
    kept.push({ app, tag: group[0].tag_name });
    obsolete.push(...group.slice(1));
  }
  return { obsolete, kept: kept.sort((a, b) => a.app.localeCompare(b.app)) };
}
