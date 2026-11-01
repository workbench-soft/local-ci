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
  push to `main`. It runs on `ubuntu-latest`, free for a public repo.
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
- **Docs** `README.md`, `CHANGELOG.md` and `docs/features.md`.

### 2026-11-01 public repo on GitHub runners

- **Why** the repo goes public, and a fork PR on the PC runner would run its code on the PC.
- **Changes** Checks runs on `windows-latest` with `jdx/mise-action` for pushes and PRs. Release runs on `ubuntu-latest`. The install job goes, since the update task already runs every 5 minutes. `mise.toml` pins node and pnpm for the hosted runners, and an MIT `LICENSE` comes in.
- **Docs** `README.md`, `CHANGELOG.md`, `docs/architecture.md`, `docs/user-flows.md` and `specs/auto-update.md`.
