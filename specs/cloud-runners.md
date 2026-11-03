# Cloud runners first, this PC last

## What it does for the person

CI jobs build on free cloud runners while their free minutes last, and fall
back to the runners of this PC after that. The PC stays free for work. The
status page shows where each job built: this PC, Oracle, Blacksmith or
GitHub.

## User flows

1. A push starts a workflow. Each job asks for the runner in the repo
   variable `CI_RUNNER` (light jobs), `CI_HEAVY_RUNNER` (Gradle, Cargo,
   Tauri builds) or `CI_WINDOWS_RUNNER` (jobs that build on Windows).
2. The router on the status page server sets the variables once a minute,
   in the order Blacksmith, Oracle, GitHub, this PC:
   - **Light** Blacksmith 2 vCPU while its minutes last, else the Oracle
     runner when it is online, else `ubuntu-latest` while the GitHub minutes
     last, else `[self-hosted, local]`.
   - **Heavy** Blacksmith 4 vCPU, else `ubuntu-latest`, else
     `[self-hosted, heavy]`. Oracle is skipped: Android doesn't build on ARM.
   - **Windows** Blacksmith 2 vCPU Windows, else `windows-latest`, else
     `[self-hosted, heavy]`.
3. A job that waits on Blacksmith for over 5 minutes means Blacksmith is
   missing or down. The router turns Blacksmith off for an hour, sends both
   lanes to this PC, cancels the run and starts it again.
4. The Runs table and the Running now card name the machine of each job.
   The Cloud card shows the routes, the Blacksmith and GitHub minutes of the
   month and the Oracle runner state.

## How it works: modules, files, data

- **Variables** `CI_RUNNER` and `CI_HEAVY_RUNNER` hold a JSON label list in
  each private repo. GitHub Free hides org variables from private repos, so
  the router writes a copy into each one when the route changes and checks
  them every 30 minutes. A workflow reads one with a fallback, so a repo
  builds on this PC until the router sets them:
  `runs-on: ${{ fromJSON(vars.CI_HEAVY_RUNNER || '["self-hosted","heavy"]') }}`.
- **Where a job ran** `status/runner-kind.ts` reads the job's runner name and
  labels: a runner folder of this PC, `oracle`, `blacksmith-*`,
  `GitHub Actions *`, or another self-hosted runner.
- **Blacksmith minutes** `status/blacksmith-usage.ts` reads each finished run
  of the month once and keeps the counted minutes in
  `dashboard/cloud-usage.json`. A job counts its minutes rounded up, times
  its vCPU count over 2, as Blacksmith bills. The file starts over each
  month.
- **Blacksmith on** the router uses Blacksmith only when the Blacksmith app is
  installed in the org, seen through `GET /orgs/{org}/installations`.
- **Budget** `BLACKSMITH_BUDGET` in `.env.local`, 2700 of the 3000 free
  minutes by default. Blacksmith bills past 3000, so the margin covers jobs
  still running at the switch.
- **Oracle** `runner/oracle.sh <user@host>` installs a runner on an Oracle
  Always Free ARM VM over SSH, with the labels `self-hosted, Linux, ARM64,
  oracle`. The PC asks GitHub for the registration token, so the VM needs
  no GitHub login.
- **Router** `status/cloud-route.ts` picks the routes from the state, and
  `status/cloud-router.ts` runs it each minute beside the cancel sweep, sets
  the variables that changed and logs each switch to `dashboard.log`.

## Limits

- **Jobs that stay** a job that needs Windows, the phone, the emulator, the
  NAS or files on this PC keeps its fixed labels.
- **Android on Oracle** Google ships no ARM Linux build tools, so Android
  builds take the heavy lane, which skips Oracle.
- **Count lag** a job counts once its run finishes. Several long jobs at the
  switch can go a few minutes past the budget, which the margin absorbs.
- **Oracle signup** needs a card and a free VM, which a person creates.
- **Cold runners** a cloud job starts without the PC caches, so it installs
  its tools and packages each time.

## Changes

### 2026-11-02 Route builds to Oracle and Blacksmith first

- **Why** local builds load the PC. The person asked to build on Blacksmith
  or Oracle while their free limit lasts, then on this PC, and to see in the
  launcher where each build runs.
- **Changes** `status/runner-kind.ts`, `status/cloud-route.ts`,
  `status/blacksmith-usage.ts`, `status/cloud-router.ts`, a Cloud card, a
  machine name on each run and live job, jobs read for finished runs too,
  `runner/oracle.sh`.
- **Steps** this spec, the runner kinds and the Where column, the router and
  its card, the Oracle script, then the docs.
- **Docs** `docs/features.md`, `docs/architecture.md`, `README.md`,
  `CHANGELOG.md`.

### 2026-11-02 Repo variables in place of org variables

- **Why** the first Blacksmith run still built on the PC. GitHub Free hides
  org variables from private repos, so `vars.CI_RUNNER` read empty and the
  fallback won.
- **Changes** `status/cloud-router.ts` writes both variables into each
  private repo that isn't archived, on a route change and every 30 minutes.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `CHANGELOG.md`.

### 2026-11-03 Blacksmith, Oracle, GitHub, then the PC, for every pipeline

- **Why** the person asked for one order across all projects: Blacksmith,
  then Oracle, then the GitHub runners, and the PC only once all of them run
  out. Blacksmith used 2059 of its 2700 minutes in two days.
- **Changes** `status/cloud-route.ts` picks three lanes in the new order,
  `status/github-usage.ts` counts the GitHub minutes of the private repos
  from the billing API (Linux 1x, Windows 2x, macOS 10x) and stops at
  `GITHUB_BUDGET`, 1800 of 2000 by default. `status/blacksmith-usage.ts`
  counts a Windows job at its full vCPU count. The router writes
  `CI_WINDOWS_RUNNER`, and the Cloud card shows the third lane and the
  GitHub minutes.
- **Workflows** the jobs held on the PC move to a lane: the Android builds
  of lumiere-player and guitar-upscale to the heavy lane, the Windows builds
  of reddit-desk and memories and the check of agent-skills-private to the
  Windows lane. `translate` of guitar-upscale stays on the PC, since it runs
  the Claude Code login there.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `CHANGELOG.md`.
