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

/** The release of the run's repo that GitHub created while the run ran. */
export function releaseOfRun(run: { repo: string; createdAt: string; updatedAt: string }, releases: Release[]): Release | null {
	const from = Date.parse(run.createdAt);
	const to = Date.parse(run.updatedAt) + slackMs;
	return (
		releases.find((release) => {
			const at = Date.parse(release.createdAt);
			return release.tag.startsWith(`${run.repo}-v`) && at >= from && at <= to;
		}) ?? null
	);
}
