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

## CI status page

`http://localhost:4280` shows the local CI at a glance. `dashboard\install.ps1`
sets it up. The page starts with Windows and opens in the browser after the
install build and at each logon.

- **Headline** counts jobs on this PC first, then jobs on other runners, then
  jobs waiting on GitHub. Red when a runner of this PC is down.
- **Now** a column per place: on this PC, waiting on GitHub with the labels the
  job asks for, and on another runner. Each job links to its GitHub log.
- **This PC** a row per runner: the job it runs, idle or stopped, its boot
  task, and when its last job started.
- **Runs** the latest 5 runs of each org repo, with an icon for the result and
  for the place. Filter chips pick this PC, waiting, other runners, failed or
  passed. A search box matches repo, workflow and branch. A click on a column
  head sorts by it.
- **Limits** a job counts as local when its runner name matches a runner
  folder of this PC, so the This PC parts need Windows. After a new gh login,
  run the install script again.
