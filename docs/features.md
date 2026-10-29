# Features

## Mac setup

`install.sh` gives a Mac the Homebrew tools, mise, Oh My Zsh, the git config,
the `workbench-soft` repos, the VS Code extensions, the Claude memory and the
MCP config. A second run skips what is already there.

## Windows setup

`install.ps1` gets the same tools through winget and npm.

- **Skipped** the Mac only pieces: Oh My Zsh, Maccy, gh-review-notify,
  terminal-notifier and twg.
- **Repos** land in `C:\Programming\WorkbenchSoft`, or in `DEV_DIR`.
- **Python** mise installs 3.15, and `python3` runs it as on the Mac. Without
  that, `python3` reaches the Windows Store stub and fails.

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
- **Limit** extra runners speed up only work split into jobs. Jobs at the
  same time share ports, the Android emulator and the Gradle cache.
- **Shared tool cache** the runners of a machine keep `setup-*` downloads in
  `~/actions-runner/_tool`. Node of one version downloads once for all of
  them.
- **Shared pnpm store** every job installs from the machine's pnpm store,
  so a package downloads once for all runners and runs.
- **Defender exclusions** on Windows Defender skips the runner folders and
  the package caches. `RUNNER_DEFENDER_EXCLUSIONS=off` skips the step.
- **Limit** Defender then skips the code that jobs check out.
- **Long paths** git and Windows accept paths over 260 characters, so a
  checkout can delete a deep `node_modules` or build cache.

## Start button

`START.cmd` in the repo root runs the latest version of the CI with a double
click, then opens `http://localhost:4280`.

- **Latest code** it pulls the default branch first. On another branch, or
  when the pull fails, it goes on with the code on disk.
- **Rebuild** when the page code changed since the last build, it runs
  `dashboardinstall.ps1`, which asks for admin and restarts the page.

- **Starts** each `GitHub Actions runner` task and the `local-ci dashboard`
  task that isn't running.
- **Admin** asked for only when Windows refuses to start a task.
- **Limits** Windows only. A new PC runs the install scripts first.

## CI status page

`http://localhost:4280` shows the local CI at a glance. `dashboard\install.ps1`
sets it up. The page starts with Windows and opens in the browser after the
install build and at each logon. The tab and the Startup shortcut show its
icon: a white loop arrow around a green play sign on blue.

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
- **Runs** the latest 5 runs of each org repo and every unfinished one, with
  an icon for the result and for the place. An unfinished run says where it builds: Building on this
  PC, Queued on GitHub or Building on another runner. A finished run shows
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
- **Old runs die** every 10 seconds the page server force cancels an
  unfinished push or PR run when a newer run of the same repo, workflow,
  branch and event exists, or when it checks a PR that is merged or closed.
  Main and open PRs keep building, and so do `workflow_run` and `schedule`
  runs. `CANCEL_SUPERSEDED=off` in `.env.local` turns it off, and a rerun of
  the install script keeps that line. `pnpm dev` doesn't cancel. Each cancel
  goes to `dashboard.log` with its time and reason.
- **Stale page** when refreshes hang for 45 seconds, the line under the
  headline turns red and says when the page last updated. A stopped server
  shows the browser's error page instead, since Next reloads the tab. A
  hidden tab skips its refreshes.
- **Localhost only** the page answers on `localhost`, `127.0.0.1` and `[::1]`
  and refuses any other host name with 421. Other sites can't frame it.
- **Release and Install** the Release column links to the release a run
  published, on the one run of its repo that ended nearest to it. Install puts its APK on the phone plugged in over USB through
  adb. adb's error shows in a red box under the button. Needs exactly one
  phone in `adb devices`, and the public repo keeps 3 releases per app.
- **Failed step** a failed run names its failed job and step under the
  result, linked to that job's log.
- **PR and branch** the branch of a run is a link. The PR column links each
  PR of the run by its number, sorts by it, and search finds `#number`.
  GitHub gives no PR for pushes to the default branch or for PRs from forks.
- **Limits** a job counts as local when its runner name matches a runner
  folder of this PC, so the this PC checks need Windows. After a new gh login,
  run the install script again.
