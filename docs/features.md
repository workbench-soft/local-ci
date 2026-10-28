# Features

## Mac setup

`install.sh` installs the Homebrew tools, mise, Oh My Zsh, the git config, the
`workbench-soft` repos, VS Code extensions, Claude memory and the MCP config.
Run it again and it skips what is there.

## Windows setup

`install.ps1` installs the same tools through winget and npm. It skips the
Mac only parts: Oh My Zsh, Maccy, gh-review-notify, terminal-notifier and twg.
Repos land in `C:\Programming\WorkbenchSoft`, or in `DEV_DIR`.

## Self-hosted CI runner

`runner/install.sh` and `runner/install.ps1` register the machine as a GitHub
Actions runner for `workbench-soft`. Private repos then build on it for 0
minutes.

- **Labels** `macOS, ARM64, android` on the Mac, `Windows, X64` on Windows.
- **Labels** both carry `local`, for jobs that run on either machine.
- **Limit** the Mac runner works only while the user is logged in. The Windows one starts at boot.
- **Limit** one runner takes one job at a time.

## CI status page

`http://localhost:4280` shows the local CI at a glance. It starts with
Windows, set up by `dashboard\install.ps1`.

- **Headline** green when idle, blue while a run builds, amber when runs wait in the queue, red when the runner is down.
- **This PC** the runner boot task, the listener, a job running now, and when the last job started.
- **Runners** each org runner online or offline, busy or idle, with its labels.
- **Runs** the latest 5 runs of each org repo, queued ones on top, with a link to GitHub.
- **Limit** Windows only for the This PC card. A new gh login needs a rerun of the install script.
