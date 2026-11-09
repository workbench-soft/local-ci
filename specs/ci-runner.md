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
- **Priority** the boot task runs at priority 4, normal. `Runner.Listener`
  and `Runner.Worker` start above normal through their `PerfOptions` key, so
  a busy PC can't starve their GitHub polls.
- **Windows start** each runner gets a boot task. The first is
  `GitHub Actions runner (<org>)`, runner `n` gets
  `GitHub Actions runner (<org> <n>)`.
- **Mac start** each runner gets its own launchd service from `svc.sh`.
- **One download** the archive downloads once and unpacks into each new
  folder. One registration token registers them all.
- **Labels** every runner on a machine has the same labels, so any of them
  takes a job.
- **Clean** before each job `runner/clean-work.ps1` deletes the runner's
  repo checkouts unused for 3 days, and all but the current one under 60 GB
  free. `CLEAN-CI.cmd` runs `windows/clean-ci.ps1`, which empties every work
  folder at once.

## Limits

- **Jobs, not steps** runners speed up only work split into jobs: separate
  jobs, a `matrix`, or runs of several repos.
- **Shared machine** jobs at the same time share ports, the Android emulator
  and the Gradle cache. A test on a fixed port can fail when 2 jobs run it.
- **Disk** each runner keeps its own work folder in `C:\ci\<n>` with
  checkouts and `node_modules`. The job started hook deletes the old ones,
  and `CLEAN-CI.cmd` empties them all.
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

### 2026-10-30 Defender exclusions in one script

- **Why** each Defender exclusion should come from a script in this repo,
  so a new PC gets the same list. A Cargo build under `%LOCALAPPDATA%` was
  scanned, and Defender blocked a langflip test exe there.
- **Changes**
  - **Script** `windows/defender-exclusions.ps1` holds the list and adds it.
    It asks for admin rights when it runs without them, and a rerun is safe.
  - **List** the runner folders, `C:\ci`, `~/.gradle`, the pnpm, npm and mise
    caches, `~/.cargo`, `~/.rustup`, `%LOCALAPPDATA%\media-organizer` for its
    release build, and `DEV_DIR` for local builds.
  - **Runner install** `runner/install.ps1` calls the script.
- **Limits** Windows only. Defender skips the org's own code in these
  folders. Another antivirus switches Defender off, and the script then
  prints the refusal.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.

### 2026-10-30 Android SDK outside AppData

- **Why** Expo release builds failed on every runner with
  `Cannot query the value of this provider because it has no value available`
  on `:app:minifyReleaseWithR8`. AGP found no `android.jar` for platform 37.
  Claude Desktop is a packaged app, so a tool run from a Claude session
  writes `%LOCALAPPDATA%` into
  `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Local`. The SDK parts that
  `runner/install.ps1` installed from a Claude session sat there. The
  runners start from a boot task, outside the package, and saw the real
  `%LOCALAPPDATA%\Android\Sdk` without them. A build from a Claude session
  saw the merged view and passed.
- **Changes**
  - **SDK folder** `C:\Android\Sdk`, outside AppData, so a write from a
    Claude session and a read from a runner meet the same files.
    `ANDROID_HOME` overrides it, unless it points under `%LOCALAPPDATA%`.
  - **Copy** `runner/install.ps1` copies `%LOCALAPPDATA%\Android\Sdk` to
    the SDK folder on the first run, with `robocopy`, and skips `.temp`.
    `sdkmanager` then installs into the SDK folder.
  - **Runner env** each `.env` sets `ANDROID_HOME` and `ANDROID_SDK_ROOT`
    to the SDK folder.
  - **Status page** Install looks for adb in `C:\Android\Sdk` as well.
  - **mise** `jdx/mise-action` exports `mise env` into each job, over the
    runner `.env`. When `~/.config/mise/config.toml` sets `ANDROID_HOME`,
    the script points it at the SDK folder with `mise set --file`.
- **Limits** Android Studio keeps its own SDK setting. Point it at
  `C:\Android\Sdk` by hand, or the two copies drift apart.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.

### 2026-10-30 Heavy lane and the action cache

- **Why** the PC runs 8 runners. Each Gradle, Cargo or Tauri build takes
  every core, so 8 such builds at once crawled: the keeppad release took 50
  minutes, the servohop one 23, where a build alone takes 10. "Set up job"
  also took 1 to 3 minutes per job, downloading `actions/checkout` and the
  other actions again, with retries when GitHub throttled the download.
- **Changes**
  - **Labels** `Get-Runner` gives the first `RUNNER_HEAVY_COUNT` runners
    (2 by default, at most the count) the extra label `heavy`.
    `Install-Runner` registers with the runner's own labels.
  - **Sync** `Sync-RunnerLabels` lists the org's runners through `gh api`
    and adds or removes `heavy` on GitHub, so an existing registration
    needs no re-run of `config.cmd`. Without `gh` access it says so and
    goes on.
  - **Action cache** `.env` gets `ACTIONS_RUNNER_ACTION_ARCHIVE_CACHE`,
    the shared folder `~/actions-runner/_actions-cache`. The runner reads
    `.env` at start, so the setting reaches the worker. The runner only
    reads the folder, `<owner>_<repo>/<sha>.zip`, and skips it when it is
    missing. `runner/cache-actions.ps1` fills it: it collects the `uses:`
    lines of the workflows under `DEV_DIR` and the actions the runner logs
    name, resolves each tag to its commit with `gh api`, and downloads the
    zip from `api.github.com/repos/<repo>/zipball/<sha>`, which GitHub did
    not throttle (650 KB/s against 10 KB/s from codeload.github.com).
    `install.ps1` runs it before it starts the runners.
  - **Workflows** each repo's Gradle, Cargo and Tauri jobs switch to
    `runs-on: [self-hosted, heavy]`. Lint, test and bundle jobs stay on
    `local`.
- **Limits** a heavy runner also takes light jobs, since it keeps `local`.
  The Mac runner has no heavy label, so a heavy job waits for the PC.
- **Docs** `README.md`, `docs/architecture.md`, `docs/features.md`,
  `CHANGELOG.md`.

### 2026-11-01 Runners keep GitHub while the PC sits at 100% CPU

- **Why** on 2026-11-01 GitHub showed all 8 runners offline while their
  `Runner.Listener` processes kept running. The `_diag` logs show token
  requests taking 20 to 60 s, broker long polls timing out after 100 s and
  jobs failing with 0 steps. The network was fine, and the PC sat at 100% CPU
  with 2 GB of 31 GB free. The boot task had no priority set, so Task
  Scheduler gave it 7: below normal CPU, I/O and memory priority, inherited by
  the listener and the worker. Any desktop app beat them to the CPU.
- **Changes**
  - **Boot task** `Start-Runner` passes priority 4 to `Register-BootTask`,
    as the status page task already does: normal for the CPU, I/O and memory. `start.cmd` and `run.cmd` then
    start at normal, and the listener's pages stop going first under memory
    pressure.
  - **Process priority** a child process gets normal priority from an above
    normal parent, so a task priority alone can't lift the listener.
    `Set-RunnerPriority` writes `CpuPriorityClass` 6 (above normal) under
    `Image File Execution Options\Runner.Listener.exe\PerfOptions` and the
    same for `Runner.Worker.exe` in HKLM. Windows applies it to each start
    of those programs, the worker the listener spawns per job included.
  - **Rerun** `Register-ScheduledTask -Force` rewrites the task of an
    existing runner, and `Start-Runner` restarts its listener once idle, so
    a rerun of the script moves existing runners over.
- **Limits** build steps the worker starts get normal priority, where they
  had below normal through the task before. Builds now compete with the
  desktop on equal terms. The heavy label still caps big builds at 2. The
  setting is per program name, so it reaches any `Runner.Listener.exe` on
  the PC.
- **Docs** `README.md`, `CHANGELOG.md`, `TODO.md`.

### 2026-11-01 A watchdog restarts a runner that stays offline

- **Why** on 2026-11-01 all 8 runners showed offline for 12 hours while
  their tasks showed Running. The listeners from 12:53 wrote their first log
  line 34 minutes after they started, at priority 7 on a PC at 100% CPU.
  `START.cmd` skips a task that runs, so only an admin restart helped. The
  priority fix of the entry above sat unused: the update task's
  `git merge --ff-only` stopped on a `TODO.md` that another session had
  edited in the checkout.
- **Changes**
  - **Watchdog** `windows/runner-watchdog.ps1` asks GitHub for the runners
    of the org. A runner task that runs, started over 10 minutes ago and
    whose runner GitHub shows offline counts as hung. The script stops the
    task, ends its `Runner.Listener` and starts the task again.
  - **Update task** `windows/update.ps1` runs the watchdog on each turn,
    every 5 minutes, ahead of the install lock, since a stuck install held it
    for over an hour on 2026-11-01. The task runs as admin,
    so it can end the listener.
  - **START.cmd** `windows/start.ps1` restarts a hung runner too. When it
    runs without admin rights, it asks for them, as it does for a task
    Windows refused to start.
  - **Local edits** the update merge passes `--autostash`, so an edited
    tracked file no longer blocks a release. When the edit clashes with the
    release, git keeps it in the stash, and `update.log` says so.
- **Limits** the watchdog needs the `gh` login with `admin:org`. Without an
  answer from GitHub it leaves every runner alone. The update task runs only
  while the person is logged in. A restart can't help while the PC starves
  the listener, so the priority fix above still matters.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `CHANGELOG.md`, `TODO.md`.

### 2026-11-05 Each runner cleans its own work folder

- **Why** on 2026-11-05 `C:\ci` held 64.7 GB in `C:\ci\1` alone, and C:
  had 33 GB free of 932 GB. Each of the 8 runners keeps a checkout and its
  `node_modules` of every repo it ever built, and a repo that stopped
  getting jobs stays there. Emptying `C:\ci` by hand meant stopping all 8
  runners, since only the runner itself knows when it is idle.
- **Changes**
  - **Hook** `runner/clean-work.ps1` runs as the runner's job started hook,
    through `ACTIONS_RUNNER_HOOK_JOB_STARTED` in `.env`. The runner runs it
    before the first step, so its own folder is free to clean, and the
    other 7 runners stay untouched.
  - **Folder** the hook takes the runner's work folder from the parent of
    `RUNNER_WORKSPACE`, such as `C:\ci\3`, and the current repo from its
    leaf. `_actions`, `_temp`, `_tool` and `_PipelineMapping` stay.
  - **Last use** the hook sets the current repo folder's last write time to
    now, since a checkout leaves the top folder's time as it was.
  - **Old repos** a repo folder unused for `RUNNER_CLEAN_DAYS` days, 3 by
    default, goes.
  - **Low disk** with less than `RUNNER_CLEAN_MIN_FREE_GB` free on the
    work drive, 60 by default, every repo folder but the current one goes.
  - **Fast start** the hook renames each folder to `_trash-<time>` on the
    same drive, which is instant, and a detached `robocopy /MIR` from an
    empty folder deletes it after. `robocopy` handles paths over 260
    characters. The next hook run also deletes a `_trash-*` folder a
    reboot left behind. The hook clears `RUNNER_TRACKING_ID` first, since
    the runner ends the processes a job leaves with that id.
  - **Keep in step** `AGENTS.md` lists the changes that MUST update both
    clean scripts, and `dashboard/status/clean-sync.test.ts` checks that
    they read the work root, the org and the task names as
    `runner/install.ps1` sets them.
  - **Safe fail** the hook catches each error, prints it to the job log and
    exits 0, so a locked file can't fail a build.
  - **Install** `runner/install.ps1` copies the hook to
    `~/actions-runner/hooks/clean-work.ps1`, so a move of this repo keeps
    the path valid, and writes the hook and both settings into each `.env`.
    A rerun applies them once each runner is idle, as for the other `.env`
    settings.
  - **By hand** `CLEAN-CI.cmd` in the repo root runs
    `windows/clean-ci.ps1` as admin. It waits up to 10 minutes for a gap
    between jobs, stops the runners, moves each work folder to
    `C:\ci-trash-<time>`, starts the runners on empty folders, then deletes
    the trash at idle priority, 4 folders at a time. Only an admin can stop
    the listeners, so the script asks for the rights.
- **Limits**
  - **Cold builds** the first job of a repo after a clean checks it out and
    installs its packages again. The shared pnpm store and Gradle cache keep
    the download small.
  - **Copies per runner** 8 runners still keep up to 8 copies of an active
    repo. The low disk rule caps them when space runs short.
  - **Idle runner** a runner that gets no job cleans nothing. The low disk
    rule then waits for its next job.
  - **Windows only** the Mac runner keeps one runner and its `_work`
    folder as before.
  - **Other folders** the Claude worktrees, the leftover git worktrees
    beside the repos, `%TEMP%` and the package caches stay out of this
    change.
- **Steps**
  1. This spec.
  2. `runner/clean-work.ps1` with a test that runs it on a temp work
     folder.
  3. `runner/install.ps1`: the copy and the `.env` lines.
  4. `CLEAN-CI.cmd` and `windows/clean-ci.ps1`.
  5. Docs and changelog, and the top sections of this spec.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `CHANGELOG.md`.
