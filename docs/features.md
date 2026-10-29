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
sets it up, and it starts with Windows.

- **Headline** green when idle, blue while a run builds, amber when runs wait
  in the queue, red when a runner of this PC is down.
- **This PC** a row per runner: running, idle or stopped, its boot task, and
  when its last job started.
- **Runners** each org runner online or offline, busy or idle, with its labels.
- **Runs** the latest 5 runs of each org repo, queued runs on top, each linked
  to GitHub. A repo GitHub refuses drops out, and the rest still show.
- **Limit** the This PC card needs Windows. After a new gh login, run the
  install script again.
