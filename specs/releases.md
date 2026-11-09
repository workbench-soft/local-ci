# Releases

## One-pager

- **Problem** a person needs a release on CI or an APK built from the newest `main` and installed on a phone.
- **Fix** the Releases page dispatches supported CI releases, builds locally in an isolated worktree and installs either APK through ADB.
- **How** CI runs target `main`; local builds use each supported app's build script and the latest fetched `main`.
- **Risks** a local build needs its app clone, build script and signing or build secrets on this PC. ADB needs one authorized phone.
- **Next** add release actions and local build support to the Releases page, plus a confirmed GitHub storage cleanup control.

## What it does for the person

Each push to `main` starts Release alongside the `Checks` workflow. Publication
waits for successful Checks of the same commit and branch. A passing commit gets a GitHub release
in this repo, such as `v2026.10.30.1`. Its notes list the commits since the
release before. From the Releases page, a person can also dispatch an app's
release workflow on `main`, install its published APK over ADB, or build an
APK from the latest `main` in a separate worktree and install that build.

## User flows

1. A PR merges into `main`.
2. `Checks` and Release start on the push. Release builds while Checks runs.
3. Release tags the commit and publishes the notes on the Releases page.
4. To release by hand, the person chooses an app and presses **Release on CI**.
   Local CI dispatches its release workflow against `main`. While it is queued
   or running, the button is gray and disabled. A second dispatch is also
   rejected server-side if the workflow is already active.
5. After an APK release appears, the person presses **Install** to download
   that APK and install it on the single ADB device.
6. An active release or CI build exposes **Force stop**, which confirms and requests
   GitHub's force-cancel. Local builds offer **Force stop local build**, which
   terminates the spawned process tree and marks the build as cancelled.
7. To build on this PC, the person presses **Build locally**. Local CI fetches
    `origin/main`, builds in an isolated worktree, then offers **Install local**.

## How it works

- **`.github/workflows/release.yml`** starts on `workflow_run` once Checks
  pass on a push to `main`.
  It runs on `ubuntu-latest`, free for a public repo.
- **`.github/scripts/next-version.sh`** picks the tag: the date, then the
  number of the release that day.
- **`.github/scripts/release-notes.sh`** writes the notes from the commits
  since the last tag.
- **Release actions** the dashboard dispatches a supported app release
  workflow on its default branch and reports the GitHub run.
- **Local build** the dashboard builds supported Android projects from the
  latest `main` in a temporary worktree, then passes the resulting APK to the
  existing ADB installer.

## Limits

- **Local build setup** an app needs a local clone, a `scripts/build-apk.sh`
  entry point and any signing or build secrets on this PC.
- **Supported local apps** memories-mobile, Shuttrix, Tick-a-Lot, SkyAltar,
  Memoire, Shuttrix Legacy and SpotTheCam have a local build entry point.
- **ADB** installation requires exactly one authorized phone in `adb devices`.
- **CI workflow** manual dispatch is available only for apps with a release
  workflow that accepts `workflow_dispatch`.
- **Temporary files** the build clone is removed after each run. The APK stays
  in the OS temp folder until install, or up to 6 hours; the next local build
  clears expired folders.
- **Failed check** a red `Checks` run or a PR run starts no release.

## Changes

### 2026-11-09 Release starts after Checks

- **Why** a Release that waited in `wait-for-checks.sh` held one of the 8 PC
  runners, so Checks starved and releases timed out.
- **Changes** Release starts on `workflow_run` once Checks pass on `main`. A
  run from the page's Release button checks Checks of the commit once and
  stops unless they passed. The script and its test go.

### 2026-11-07 clean up GitHub Actions storage

- **Why** GitHub can block APK artifact uploads after the shared Actions storage quota fills.
- **Changes** Releases offers a preview and confirmation before deleting completed-run artifacts in all unarchived org repos and all but the latest published APK-bearing release per app. The shared release repo also holds desktop and web assets, which remain untouched. Drafts and prereleases are excluded.
- **Protection** active workflow artifacts are skipped; the dashboard does not cancel or delete runs. Inventory is paginated fully before any deletion; errors and counts are shown. Each delete request uses the server-side GitHub token.
- **Permissions** GitHub token needs Actions write for artifact deletion and Contents write in the shared release repo for release deletion. GitHub can take time to refresh its quota accounting.
- **Files** `dashboard/status/storage-cleanup*.ts` and `dashboard/cards/storage-cleanup-button.tsx`.

### 2026-11-05 build releases alongside Checks

- **Why** waiting for Checks and unrelated open PRs delays the release build.
- **Changes** push starts both workflows; only publication waits for matching Checks.
- **Docs** README, architecture, features, user flows and changelog.

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

### 2026-11-05 manually release and build an app

- **Why** the person needs a manual CI release and a local build from the
  latest `main`, with both APKs installable on the phone over ADB.
- **Changes** the Releases page dispatches app release workflows on `main`,
  starts a local Android build in a separate worktree and installs its APK
  through ADB. Existing published APK installation stays available.
- **Steps** spec, release controls and server actions, app build runner,
  release documentation.
- **Docs** `README.md`, `CHANGELOG.md`, `docs/features.md`,
  `docs/user-flows.md` and `docs/architecture.md`.

### 2026-11-09 one release at a time

- **Why** the 2026-11-05 change dropped the `release` concurrency group, so two
  pushes close together could pick the same version tag and the second failed.
- **Changes** the release job holds the `release` group again, with
  `cancel-in-progress: false`, so a later push waits in line and keeps its
  Checks wait. `wait-for-checks.sh` gets its run bit and the shell lint.
