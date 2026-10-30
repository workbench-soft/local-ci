# Releases

## What it does for the person

Each push to `main` that passes the `Checks` workflow gets a GitHub release
in this repo, such as `v2026.10.30.1`. Its notes list the commits since the
release before, so a reader sees what changed without reading the log.

## User flows

1. A PR merges into `main`.
2. `Checks` runs on the push and passes.
3. Release tags the commit and publishes the notes on the Releases page.

## How it works

- **`.github/workflows/release.yml`** starts when `checks.yml` finishes on a
  push to `main`. It runs on the PC runner `[self-hosted, local]` and costs 0 GitHub minutes.
- **`.github/scripts/next-version.sh`** picks the tag: the date, then the
  number of the release that day.
- **`.github/scripts/release-notes.sh`** writes the notes from the commits
  since the last tag.

## Limits

- **Notes only** the repo builds no file, so the release carries none.
- **Failed check** a red `Checks` run or a PR run starts no release.

## Changes

### 2026-10-30 a release after each passing check

- **Why** the repo had checks and shipped no release, so a merge left no
  tagged point to go back to.
- **Changes** the Release workflow and its two scripts come from the
  `repo-ci` templates. `.gitattributes` keeps LF endings on `*.sh`.
- **Steps** this spec, then the workflow and scripts, then the docs.
- **Docs** `README.md` and `CHANGELOG.md`.
