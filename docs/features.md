# Features

## Mac setup

`install.sh` gives a Mac the Homebrew tools, mise, Oh My Zsh, the git config,
the `workbench-soft` repos, the VS Code extensions, the Claude memory and the
MCP config. A second run skips what is already there.

Spec: [mac-setup](../specs/mac-setup.md), [python-setup](../specs/python-setup.md).

## Windows setup

`install.ps1` gets the same tools through winget and npm.

- **Skipped** the Mac only pieces: Oh My Zsh, Maccy, gh-review-notify,
  terminal-notifier and twg.
- **Repos** land in `WBS_ROOT`, by default the folder that holds the
  `local-ci` clone.
- **Python** mise installs 3.15, and `python3` runs it as on the Mac. Without
  that, `python3` reaches the Windows Store stub and fails.
- **Rust cache** sccache wraps rustc, so a new worktree reuses the crates
  another one compiled. The Mac gets it too.

Spec: [windows-local-ci](../specs/windows-local-ci.md), [rust-compile-cache](../specs/rust-compile-cache.md).

## Self-hosted CI runner

`runner/install.sh` and `runner/install.ps1` make the machine a GitHub Actions
runner for `workbench-soft`. Private repos then build on it for 0 minutes.

- **Labels** the Mac gets `macOS, ARM64, android`, and Windows gets
  `Windows, X64`.
- **Shared label** both get `local`, for jobs that can run on either machine.
- **Limit** the Mac runner works only while the user is logged in. The
  Windows runner starts at boot.
- **Several runners** a runner takes one job at a time. `RUNNER_COUNT` sets
  how many runners the machine gets: 4 on Windows and 1 on a Mac by default.
  On Windows the count stays in `~/actions-runner/runner-count` for the next
  run, and a lower count removes the extra runners.
- **Limit** extra runners speed up only work split into jobs. Jobs at the
  same time share ports, the Android emulator and the Gradle cache.
- **Heavy lane** on Windows the first 2 runners also carry the `heavy`
  label. Jobs that build with Gradle, Cargo or Tauri ask for it, so at most
  2 of them run at once and each gets the CPU it needs. `RUNNER_HEAVY_COUNT`
  changes the number.
- **Action cache** the runners share a folder of action zips, filled by
  `runner/cache-actions.ps1` through the GitHub API, so the "Set up job"
  step copies an action in place of downloading it. codeload.github.com gave
  8 runners 10 KB/s and the downloads timed out.
- **Shared tool cache** the runners of a machine keep `setup-*` downloads in
  `~/actions-runner/_tool`. Node of one version downloads once for all of
  them.
- **Shared pnpm store** every job installs from the machine's pnpm store,
  so a package downloads once for all runners and runs. On Windows the runners
  use `C:ci_pnpm-store` and copy from it, so a delete of an old checkout
  can't fail a read with `EBUSY`.
- **Android SDK** on Windows the runners build with the SDK in
  `C:\Android\Sdk`. `runner\install.ps1` copies it there from
  `%LOCALAPPDATA%\Android\Sdk` on the first run and installs the parts the
  apps need. A packaged app such as Claude Desktop writes `%LOCALAPPDATA%`
  into its own folder, so an SDK there is incomplete for the runners.
- **Defender exclusions** on Windows Defender skips the runner folders, the
  repos in `DEV_DIR` and the package caches. `windows\defender-exclusions.ps1`
  holds the list and runs alone. `RUNNER_DEFENDER_EXCLUSIONS=off` skips it.
- **Limit** Defender then skips the code that jobs and local builds write.
- **Install log** on Windows the admin window of `runner\install.ps1`
  stays open on an error, and each run writes `~/actions-runner/install.log`.
  The window that Apply on the status page opens does the same.
- **Long paths** git and Windows accept paths over 260 characters, so a
  checkout can delete a deep `node_modules` or build cache.
- **Work folder clean** before each job a runner deletes its own repo
  checkouts unused for 3 days, and all but the current one when the drive
  has under 60 GB free, so `C:\ci` stops filling the disk.
- **Clean by hand** `CLEAN-CI.cmd` in the repo root empties `C:\ci` at once.
  The runners pause for a few seconds, and the delete runs in the background.

Spec: [ci-runner](../specs/ci-runner.md).

## Start button

`START.cmd` in the repo root runs the newest release of the CI with a double
click, then opens `http://localhost:4280`.

- **Newest release** it runs the same `windows\update.ps1` as the update task.
  On another branch, or when the move fails, it goes on with the code on disk.
- **Install** when the page or runner code changed, it runs
  `dashboard\install.ps1` or `runner\install.ps1`, which ask for admin.
- **Waits** while the update task installs, so two builds don't run at once.
- **Update task** adds `local-ci update` when it is missing.

- **Starts** each `GitHub Actions runner` task and the `local-ci dashboard`
  task that isn't running.
- **Restarts** each runner GitHub shows offline 10 minutes after its task
  started.
- **Admin** asked for when Windows refuses to start a task, or when a runner
  needs a restart, since ending its listener takes admin.
- **Limits** Windows only. A new PC runs the install scripts first.

Spec: [ci-status-page](../specs/ci-status-page.md).

## Cloud runners first

CI jobs build on Blacksmith, then Oracle, then GitHub runners while their
free minutes last, then on this PC. The PC stays free for work.

- **Light jobs** lint and tests go to Blacksmith 2 vCPU, else to the Oracle
  VM when its runner is online, else to `ubuntu-latest`, else to
  `[self-hosted, local]`.
- **Heavy jobs** Gradle, Cargo and Tauri builds go to Blacksmith 4 vCPU,
  else to `ubuntu-latest`, else to `[self-hosted, heavy]`. They skip Oracle,
  since Google ships no ARM Linux build tools.
- **Windows jobs** go to Blacksmith 2 vCPU Windows, else to
  `windows-latest`, else to `[self-hosted, heavy]`.
- **Switch** the status page server sets `CI_RUNNER`, `CI_HEAVY_RUNNER` and
  `CI_WINDOWS_RUNNER` in each private repo when the route changes, and checks
  every repo each 30 minutes. GitHub Free hides org variables from private
  repos. A workflow that reads them falls back to the PC labels while they
  are unset.
- **Budgets** the page counts the Blacksmith minutes of the month, a job's
  minutes rounded up times its vCPUs over 2, or its full vCPUs on Windows,
  and stops at 2700 of the 3000 free ones. It reads the GitHub minutes of every
  repo from the billing API, Windows x2 and macOS x10, adds the jobs running
  on GitHub now, and stops at 1700, 300 short of the free 2000.
  `BLACKSMITH_BUDGET`, `GITHUB_FREE` and `GITHUB_MARGIN` in
  `dashboard\.env.local` move the stops.
- **Stuck** a job queued on Blacksmith for 5 minutes turns Blacksmith off for
  an hour. Its run gets cancelled and starts again once, on the next runner
  in line.
- **Cloud card** on the status page: the runner of each lane, the Blacksmith
  and GitHub minutes used with a bar each, the Oracle runner state, and when
  the router last checked.
- **Oracle setup** `./runner/oracle.sh ubuntu@<vm address>` installs 2
  runners with the `oracle` label on the VM over SSH. The PC asks GitHub for
  the registration token.
- **Limits** the router runs only while the PC is on, and the variables keep
  their last value. A job that needs the phone, the emulator, files or a login
  on this PC keeps its fixed labels. The GitHub billing API lags by hours, so
  the 300 minute margin and the running jobs cover that. A cloud job starts cold and installs its
  tools each time.

Spec: [cloud-runners](../specs/cloud-runners.md).

## CI status page

`http://localhost:4280` shows the local CI at a glance. `dashboard\install.ps1`
sets it up. The page starts with Windows and opens in the browser after the
install build and at each logon. The tab and the Startup shortcut show its
icon: a white loop arrow round a check on a teal to violet gradient.

- **In the launcher** the CI tab of the Workbench launcher shows the same
  page. Only the launcher on `http://127.0.0.1:47821` may frame it, and other
  sites get a blank frame.

- **Headline** counts jobs on this PC first, then jobs on other runners, then
  jobs waiting on GitHub. Red when a runner of this PC is down, or sits idle
  while a job it fits waits on GitHub over a minute.
- **Running now** the top card, with a blue frame and the count of jobs
  that build. A column per place. Building on this PC lists every runner of
  this PC with the job it builds, or idle, or stopped, and counts busy runners
  out of all. Then the jobs queued on GitHub with the labels they ask for, and
  the jobs on another runner. Each job links to its GitHub log. A column
  longer than 420 px scrolls inside the card. The frame turns red, with a
  line on what to do, when a runner of this PC sits idle while jobs wait.
- **Progress** a running job gets a bar with its step, such as
  `step 4 of 9: Build`, and `about 3 min left`. The time comes from the
  same job in the 10 latest finished runs of its workflow. A successful job
  counts its full time. A cancelled or failed one counts as at least the time
  it ran, so 3 jobs cancelled at 10 min give 10 min. Each new run pushes the
  oldest out, so more fast runs lower the time and more slow ones raise it. A
  job past that time turns yellow and says how long over. A workflow with no
  finished run yet fills the bar by finished steps.
- **Runners** a full width card with one entry per runner of the org, in
  columns at least 240 px wide. Each entry says whether the
  runner lives on this PC or another machine, and its state on each side:
  `this PC` from the runner folder and processes, `GitHub` from the API. An entry
  whose sides disagree turns yellow, with a hint on what to check. Runners of
  this PC also show their boot task and when their last job started. The
  list stops at 420 px and scrolls. Each entry names the job its runner
  builds, linked to the log, or says `No job`.
- **Runner count** on Windows the top of the Runners card has a field for
  the number of runners and the count this PC suits, such as
  `16 logical processors and 31 GB of memory suit 4 runners`. Use 4 fills the
  field with it. Apply runs `runner\install.ps1` as admin in a window on the
  desktop, which adds or removes runners. A runner on a job leaves once the
  job ends. The suggestion is 1 runner per 4 logical processors and per
  4 GB of memory past 8 GB, and heavy Gradle builds may want fewer.
- **Limit** Apply needs a person logged on, and one run of
  `runner\install.ps1` after this change to add the task it starts. Mac
  runners change only through `RUNNER_COUNT`.
- **Machine** each run names the machines of its jobs: This PC, Oracle,
  Blacksmith or GitHub, each in its own color. A queued run names the machine
  it waits for, and the hover says built, builds or waits. The Cloud filter
  picks runs with a cloud job, and search finds a machine name. The live
  jobs say `Blacksmith: <runner>` or `waits for This PC: self-hosted, heavy`.
- **Runs** the latest 5 runs of each org repo and every unfinished one, with
  an icon for the result and for the place. An unfinished run says where it builds: Building on this
  PC, Queued on GitHub or Building in the cloud. A finished run shows
  only its result. Each place label and chip explains itself on hover.
  Filter chips pick one of those places, failed or passed. A search box
  matches repo, workflow and branch. A click on a column head sorts by it. The
  table stops at 70% of the window height and scrolls, with its head row
  pinned.
- **Took** how long the run took, from its start on GitHub to its end. A run
  that builds counts up to now, and a queued one says "in queue". The time
  includes the wait for a runner after the start. A click on the time opens
  a row with each job and step, its time and a bar in scale with the longest
  step. The row of an unfinished run updates on each refresh.
- **Stop and Purge** buttons on each run and each live job. Stop cancels the
  run on GitHub. The button reads Stopping at once, then Stopped when GitHub
  ends the run, and stays disabled the whole time. Purge asks to confirm, force cancels the run and deletes it
  with its logs and artifacts. A finished run gets Purge only. A job's
  buttons act on its whole run, since GitHub cancels runs only.
- **Stop or Purge** Stop force cancels: the run ends as cancelled and stays
  in the history. It skips steps with `if: always()`, so the runner takes the
  next job as soon as the run ends. A queued run gets Stop too, so it leaves
  the queue before a runner takes it. Purge is for a run you want gone: it
  force cancels, then deletes the run with its logs and artifacts. Its row
  turns gray the moment Purge starts.
- **Purge all** a button in the Latest runs toolbar with the count of runs
  the filter and search match, past the 60 rows the table shows too. It asks
  to confirm, grays each row it purges, and purges 5 at a time. The table
  holds the latest 5 runs of a repo, so it goes on with the older runs that
  show next, until the filter and search match none. Then it shows how many
  it purged and the first error. A run that won't stop within 60 seconds
  stays.
- **Old runs die** the page server stops replaced runs and releases whose
  Checks failed. The Build cancellation section below has the rules.
- **Stale page** when refreshes hang for 45 seconds, the line under the
  headline turns red and says when the page last updated. A stopped server
  shows the browser's error page instead, since Next reloads the tab. A
  hidden tab skips its refreshes.
- **Localhost only** the page answers on `localhost`, `127.0.0.1` and `[::1]`
  and refuses any other host name with 421. Other sites can't frame it.
- **Release and Install** the Release column links to the release a run
  published, on the one run of its repo that ended nearest to it. Install
  Release puts its APK on the phone plugged in over USB through adb. adb's
  error shows in a red box under the button. Needs exactly one phone in
  `adb devices`.
- **Releases tab** opens by default at `/`, with Status one click away at
  `/?tab=status`. Each app gets a colored chip with the state of its release:
  released, building (with the machine it builds on), queued, errored,
  cancelled, held, or no release yet. Held means the release run skipped,
  since its gate held it or its Checks failed. The apps sort by state, then
  by name, with the ones in flight on top.
- **Release progress** a building row gets a bar from the usual time of
  past runs of the same workflow, and says how long is left or how far over
  it already is. The jobs of the run show under it with their own bars. A
  queued row says it waits for a runner.
- **Cancel reason** a cancelled row says why and when, such as
  `A newer commit started the same build · 22 min ago`, with links to the
  causing run, commit and PR. The reasons come from
  `dashboard\cancel-reasons.jsonl`, where each force cancel lands with its
  words, from Stop and Purge or from the sweep.
- **Release list** the tab title counts the apps on their way and the errored
  ones. The newest release of each app sits beside its chip with its age, and
  its notes under Changes. An app with no release yet shows from its repo's
  runs. Tick apps, or All with an APK, and press Install: the APKs go on the
  phone one by one, and each row shows Installed or adb's error.
- **Limits** a release with several APKs installs the first. A run on `main`
  counts toward a release when a push, a dispatch or a finished workflow
  started it, so Dependabot runs stay out. The tab shows only the newest
  release of each app.
- **Failed step** a failed run names its failed job and step under the
  result, linked to that job's log.
- **PR and branch** the branch of a run is a link. The PR column links each
  PR of the run by its number, sorts by it, and search finds `#number`.
  GitHub gives no PR for pushes to the default branch or for PRs from forks.
- **Limits** a job counts as local when its runner name matches a runner
  folder of this PC, so the this PC checks need Windows. After a new gh login,
  run the install script again.

Spec: [ci-status-page](../specs/ci-status-page.md).

## Build cancellation

Every 10 seconds the page server stops runs that no longer ship anything.

- **Replaced** an unfinished push, dispatch or PR run stops when a newer run
  of the same repo, workflow and branch builds a different commit. Each PR
  keeps its own scope, so a fork with the same branch name stops no build.
- **Failed Checks** a failed Checks run, or a failed checks job inside a
  release workflow, stops the releases of the same repo, branch and commit.
- **Kept** a closed PR, a rerun of the same commit, and `workflow_run` and
  `schedule` runs keep building.
- **History** each cancel is saved to `dashboard\cancel-reasons.jsonl` before
  the GitHub call, with the causing run, commit and PR. Cancellation history
  on both tabs links them with the result of the request.
- **Off** `CANCEL_SUPERSEDED=off` in `dashboard\.env.local` turns it off, and
  a rerun of the install script keeps that line. `pnpm dev` doesn't cancel.

Spec: [build-cancellation](../specs/build-cancellation.md).

## Releases

- **This repo** a tagged release follows each push to `main` once its Checks
  pass, on the [Releases page](https://github.com/workbench-soft/local-ci/releases).
- **Release on CI** on the Releases tab, a person dispatches the release
  workflow of a supported app on `main`. The button stays gray while that
  release runs, and the server refuses a second dispatch.
- **Build locally** builds the APK of the latest `main` of a supported
  Android app on this PC, in a temporary clone, then Install local puts it on
  the phone. Force stop and Force stop local build end a release on CI or on
  this PC.
- **Install Dev** installs the published APK, then sends the app's unlock link
  over adb so its developer settings show. Every app tag gets the button, with
  the app id read from the tag. The key comes from `WORKBENCH_DEV_KEY` on this
  PC and stays off the browser.
- **Storage cleanup** Clean old APK releases & artifacts previews, then deletes
  after a confirm, finished Actions artifacts and all but the newest APK
  release of each app.
- **Limits** local builds need a local app clone, its `scripts/build-apk.sh`
  and any app signing key on this PC. ADB needs one authorized phone.

Spec: [releases](../specs/releases.md).

## Updates by themselves

- **What it gives** the Windows PC installs each release within minutes of the merge. The status page and the runners get the new code with no `git pull` by hand.
- **Where** the `local-ci update` task in Task Scheduler, added by the first double click on `START.cmd`. `~/.local-ci/update.log` lists each install.
- **Limits** it runs only while the person is logged in, and only on the default branch. An edited file such as `TODO.md` waits in the stash during the move. The task also restarts each runner GitHub shows offline 10 minutes after its task started. The Mac and the dev tools of the root `install.ps1` still update by hand.

Spec: [auto-update](../specs/auto-update.md).
