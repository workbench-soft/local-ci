# Self-hosted CI runner

## What it does for the person

`runner/install.ps1` on Windows and `runner/install.sh` on a Mac register the
machine as GitHub Actions runners for `workbench-soft`. CI of the org repos
then builds there for 0 minutes. A runner takes one job at a time, so a
machine with several runners builds several jobs at once.

## User flows

1. The person runs `.\runner\install.ps1` or `./runner/install.sh`.
2. The script downloads the latest runner and checks its SHA256.
3. The script registers each runner that is missing, then starts each one.
4. GitHub hands each queued job to a free runner.

## How it works: modules, files, data

- **Count** `RUNNER_COUNT` sets how many runners the machine gets. On
  Windows the script saves it in `~/actions-runner/runner-count`, and a run
  without `RUNNER_COUNT` reads that file. The default is 4 on Windows and 1
  on a Mac.
- **Count from the page** on Windows the Runners card of the status page
  has a field for the count and the recommended count for this PC. Apply
  writes `runner-count` and starts the task
  `GitHub Actions runner count (<org>)`, which runs the script as admin in a
  window on the desktop.
- **Folders** the first runner sits in `~/actions-runner/<org>`, as before.
  Runner `n` sits in `~/actions-runner/<org>-<n>`.
- **Names** the first runner takes the machine name. Runner `n` takes
  `<machine>-<n>`.
- **Windows start** each runner gets a boot task. The first is
  `GitHub Actions runner (<org>)`, runner `n` gets
  `GitHub Actions runner (<org> <n>)`.
- **Mac start** each runner gets its own launchd service from `svc.sh`.
- **One download** the archive downloads once and unpacks into each new
  folder. One registration token registers them all.
- **Labels** every runner on a machine has the same labels, so any of them
  takes a job.

## Limits

- **Jobs, not steps** runners speed up only work split into jobs: separate
  jobs, a `matrix`, or runs of several repos.
- **Shared machine** jobs at the same time share ports, the Android emulator
  and the Gradle cache. A test on a fixed port can fail when 2 jobs run it.
- **Disk** each runner keeps its own `_work` folder with checkouts and
  `node_modules`.
- **Fewer runners** on Windows a lower count removes the runners numbered
  above it: from GitHub, their boot task and their folder. A runner on a job
  goes once the job ends. On a Mac a lower `RUNNER_COUNT` leaves the extra
  runners in place.
- **Recommendation** 1 runner per 4 logical processors and per 4 GB of
  memory, after 8 GB for Windows and the person's apps. It is a rule of
  thumb: a Gradle build can take more.
- **Page needs a person** the count task opens its window on the desktop of
  the logged on person, so Apply needs someone logged on.

## Changes

### 2025-10-29 Several runners on one machine

- **Why** one runner builds one job at a time, and jobs wait in the queue
  while the PC has 16 cores free.
- **Changes**
  - `runner/install.ps1` installs `RUNNER_COUNT` runners, 4 by default, each
    with its folder, name and boot task.
  - `runner/install.sh` does the same on a Mac, 1 by default.
  - The dashboard shows each runner of this PC in its own row.
- **Steps**
  1. This spec.
  2. Both runner scripts.
  3. The dashboard.
  4. Docs and changelog.
- **Docs** `README.md`, `docs/architecture.md`, `docs/user-flows.md`,
  `docs/features.md`, `CHANGELOG.md`.

### 2026-10-29 Faster jobs on the runners

- **Why** each runner downloads its own copy of node, Java and Python through
  the `setup-*` actions.
- **Changes**
  - **Shared tool cache** both scripts point `RUNNER_TOOL_CACHE` and
    `AGENT_TOOLSDIRECTORY` of each runner at `~/actions-runner/_tool`. A tool
    the `setup-*` actions download once then serves every runner.
  - **Mac rerun** `runner/install.sh` rewrites `.env` of each registered
    runner too, and restarts the runner once its job ends.
- **Left out** Defender exclusions for the runner folders and the package
  caches. The next entry adds them.
- **Limits**
  - **Same tool at once** 2 jobs that download the same new tool version at
    the same moment both download it. The `setup-*` actions mark a finished
    copy, so neither job takes a half written one.
- **Steps**
  1. This spec.
  2. Both runner scripts.
  3. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.

### 2026-10-29 Defender exclusions for the runners

- **Why** Defender scans each file a job writes, and `pnpm install` writes
  tens of thousands of them. The person chose the speed over the scan.
- **Changes** `runner/install.ps1` adds these folders to the Defender
  exclusions:
  - **Runners** `~/actions-runner`, with each `_work` folder and the tool
    cache.
  - **Caches** `~/.gradle`, and `pnpm`, `npm-cache` and `mise` under
    `%LOCALAPPDATA%`.
- **Switch** `RUNNER_DEFENDER_EXCLUSIONS=off` skips the step. Exclusions
  already added stay until `Remove-MpPreference -ExclusionPath` takes them
  out.
- **Limits**
  - **Unscanned code** Defender skips the code jobs check out. The runners
    build only `workbench-soft` repos.
  - **Other antivirus** with Defender switched off, the script prints the
    error and goes on.
- **Steps**
  1. This spec.
  2. `runner/install.ps1`.
  3. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.

### 2026-10-29 One pnpm store for every job

- **Why** `pnpm/action-setup` sets `PNPM_HOME` under the job's `_temp`, and
  pnpm then keeps its store there. The runner wipes `_temp` after each job,
  so every `pnpm install` downloaded all its packages again. guitar-upscale
  logged `reused 0, downloaded 780` and a 13 minute install.
- **Change** the runner `.env` sets `pnpm_config_store_dir` to the machine's
  usual store: `%LOCALAPPDATA%\pnpm\store` on Windows, `~/Library/pnpm/store`
  on a Mac. pnpm 11 reads this name. It ignores `npm_config_store_dir`.
- **Limits** a runner reads `.env` at start, so a rerun of the script applies
  it once the runner is idle.
- **Steps**
  1. This spec.
  2. `runner/install.ps1` and `runner/install.sh`.
  3. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.

### 2026-10-29 Long paths

- **Why** `node_modules` and the `.open-next` cache hold paths over 260
  characters, and git clean on the runner failed on them.
- **Change** `runner/install.ps1` sets `git config --global core.longpaths
  true`, and `LongPathsEnabled` in the registry when it runs as admin.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.

### 2026-10-30 Runner count from the status page

- **Why** the person wants to set the number of runners on the page, and to
  see how many suit this PC's processors.
- **Changes**
  - **Saved count** `runner/install.ps1` reads `RUNNER_COUNT`, then
    `~/actions-runner/runner-count`, then 4, and saves the count it used.
  - **Removal** the script removes each runner numbered above the count.
    It waits for the runner's job, stops it, deletes its boot task,
    unregisters it with a removal token and deletes its folder.
  - **Count task** the script registers `GitHub Actions runner count (<org>)`.
    The task runs the script with admin rights in the logged on person's
    session, so `gh` has its login and no UAC prompt shows.
  - **Page** the Runners card shows the count, the recommended count with
    the processors and memory behind it, and an Apply button. Apply calls a
    server action that writes `runner-count` and starts the count task.
- **Limits** Windows only. The first run of `runner\install.ps1` after this
  change registers the count task, and Apply says so until then.
- **Steps**
  1. This spec.
  2. `runner/install.ps1`.
  3. The recommendation, the server action and the card.
  4. Docs and changelog.
- **Docs** `README.md`, `docs/architecture.md`, `docs/user-flows.md`,
  `docs/features.md`, `CHANGELOG.md`.
