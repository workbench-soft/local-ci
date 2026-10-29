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

## Start button

`START.cmd` in the repo root starts the runners and the status page with a
double click, then opens `http://localhost:4280`.

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
  jobs waiting on GitHub. Red when a runner of this PC is down.
- **Now** a column per place. On this PC lists every runner of this PC with
  the job it builds, or idle, or stopped, and counts busy runners out of all.
  Then the jobs waiting on GitHub with the labels they ask for, and the jobs on
  another runner. Each job links to its GitHub log.
- **Runners** one row per runner of the org. Each row says whether the
  runner lives on this PC or another machine, and its state on each side:
  `this PC` from the runner folder and processes, `GitHub` from the API. A row
  whose sides disagree turns yellow, with a hint on what to check. Runners of
  this PC also show their boot task and when their last job started.
- **Runs** the latest 5 runs of each org repo, with an icon for the result and
  for the place. Filter chips pick this PC, waiting, other runners, failed or
  passed. A search box matches repo, workflow and branch. A click on a column
  head sorts by it.
- **Stop and Purge** buttons on each run and each live job. Stop cancels the
  run on GitHub. Purge asks to confirm, force cancels the run and deletes it
  with its logs and artifacts. A finished run gets Purge only. A job's
  buttons act on its whole run, since GitHub cancels runs only.
- **Limits** a job counts as local when its runner name matches a runner
  folder of this PC, so the this PC checks need Windows. After a new gh login,
  run the install script again.
