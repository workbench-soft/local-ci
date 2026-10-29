import { orgName } from './settings.ts';

/** A release of an org app, with its Android APK when it has one. */
export type Release = {
	tag: string;
	name: string;
	url: string;
	createdAt: string;
	apk: { name: string; url: string } | null;
};

// The app repos are private, so their release workflows publish to this public repo with the tag <repo>-v<version>.
export const releasesRepo = process.env.RELEASES_REPO || `${orgName}/${orgName}.github.io`;

// An upload can land a little after GitHub last updates the run.
const slackMs = 60_000;

export type ApiRelease = {
	tag_name: string;
	name: string | null;
	html_url: string;
	created_at: string;
	assets: { name: string; browser_download_url: string }[];
};

export function toRelease(release: ApiRelease): Release {
	const apk = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
	return {
		tag: release.tag_name,
		name: release.name || release.tag_name,
		url: release.html_url,
		createdAt: release.created_at,
		apk: apk ? { name: apk.name, url: apk.browser_download_url } : null,
	};
}

type RunWindow = { id: number; repo: string; createdAt: string; updatedAt: string };

/** True when GitHub created the release of the run's repo while the run ran. */
function ranDuring(run: RunWindow, release: Release): boolean {
	const at = Date.parse(release.createdAt);
	return release.tag.startsWith(`${run.repo}-v`) && at >= Date.parse(run.createdAt) && at <= Date.parse(run.updatedAt) + slackMs;
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
