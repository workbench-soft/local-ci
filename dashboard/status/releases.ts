import { orgName } from './settings.ts';

/** A release of an org app, with its Android APK when it has one. */
export type Release = {
  tag: string;
  name: string;
  url: string;
  createdAt: string;
  apk: { name: string; url: string } | null;
  /** The release notes as GitHub renders them. GitHub cleans the HTML, so the page shows it as is. */
  notesHtml: string;
};

// The app repos are private, so their release workflows publish to this public repo with the tag <repo>-v<version>.
export const releasesRepo = process.env.RELEASES_REPO || `${orgName}/${orgName}.github.io`;

// The memories repo was memories-mobile and took in media-organizer. Its apps keep the old release names, so installed copies keep updating.
// The TV player of lumiere-player releases as lumiere.
export const releasePrefixes: Record<string, string[]> = {
  memories: ['memories-mobile', 'media-organizer'],
  'lumiere-player': ['lumiere'],
};

// An upload can land a little after GitHub last updates the run.
const slackMs = 60_000;

export type ApiRelease = {
  tag_name: string;
  name: string | null;
  html_url: string;
  created_at: string;
  published_at?: string | null;
  assets: { name: string; browser_download_url: string }[];
  body_html?: string | null;
};

export function toRelease(release: ApiRelease): Release {
  const apk = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    url: release.html_url,
    // created_at is the date of the tagged commit. Every tag in the public repo points at its one commit, so only published_at tells when the release came out.
    createdAt: release.published_at || release.created_at,
    apk: apk ? { name: apk.name, url: apk.browser_download_url } : null,
    // A link in the notes opens a new tab, so the status page stays open.
    notesHtml: (release.body_html ?? '').replaceAll('<a ', '<a target="_blank" rel="noreferrer" '),
  };
}

type RunWindow = { id: number; repo: string; createdAt: string; updatedAt: string };

/** True when GitHub created the release of the run's repo while the run ran. */
function ranDuring(run: RunWindow, release: Release): boolean {
  const at = Date.parse(release.createdAt);
  const prefixes = releasePrefixes[run.repo] ?? [run.repo];
  return (
    prefixes.some((prefix) => release.tag.startsWith(`${prefix}-v`)) &&
    at >= Date.parse(run.createdAt) &&
    at <= Date.parse(run.updatedAt) + slackMs
  );
}

/**
 * The release of each run, by run id. Checks and PR runs of the same repo often run at the same time,
 * so each release goes to one run only: the one whose last update came nearest to it.
 * The Release workflow ends seconds after its upload.
 */
export function releasesByRun(runs: RunWindow[], releases: Release[]): Map<number, Release> {
  const byRun = new Map<number, Release>();
  for (const release of releases) {
    const at = Date.parse(release.createdAt);
    const gap = (run: RunWindow) => Math.abs(Date.parse(run.updatedAt) - at);
    const owner = runs.filter((run) => ranDuring(run, release)).sort((a, b) => gap(a) - gap(b))[0];
    if (owner && !byRun.has(owner.id)) byRun.set(owner.id, release);
  }
  return byRun;
}
