# Releases

## One-pager

- **Problem** a person needs a release on CI or an APK built from the newest `main` and installed on a phone.
- **Fix** the Releases page dispatches supported CI releases, builds locally in an isolated worktree and installs either APK through ADB.
- **How** CI runs target `main`; local builds use each supported app's build script and the latest fetched `main`.
- **Risks** a local build needs its app clone, build script and signing or build secrets on this PC. ADB needs one authorized phone.
- **Next** add release actions and local build support to the Releases page.

## What it does for the person

Each push to `main` that passes the `Checks` workflow gets a GitHub release
in this repo, such as `v2026.10.30.1`. Its notes list the commits since the
release before. From the Releases page, a person can also dispatch an app's
release workflow on `main`, install its published APK over ADB, or build an
APK from the latest `main` in a separate worktree and install that build.

## User flows

1. A PR merges into `main`.
2. `Checks` runs on the push and passes.
3. Release tags the commit and publishes the notes on the Releases page.
4. To release by hand, the person chooses an app and presses **Release on CI**.
   Local CI dispatches its release workflow against `main`.
5. After an APK release appears, the person presses **Install** to download
   that APK and install it on the single ADB device.
6. To build on this PC, the person presses **Build locally**. Local CI fetches
   `origin/main`, builds in an isolated worktree, then offers **Install local**.

## How it works

- **`.github/workflows/release.yml`** starts when `checks.yml` finishes on a
  push to `main`. It runs on `ubuntu-latest`, free for a public repo.
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
- **ADB** installation requires exactly one authorized phone in `adb devices`.
- **CI workflow** manual dispatch is available only for apps with a release
  workflow that accepts `workflow_dispatch`.
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
