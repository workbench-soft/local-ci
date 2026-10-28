# Rename mac-setup to local-ci and set up Windows the same way as the Mac

## Why

Development moves to Windows. The repo set up only a Mac, and its name said so.
The repo becomes `local-ci`: one script per OS installs the same tools, and a
second script per OS registers the machine as a self-hosted GitHub Actions
runner for `workbench-soft`. CI of the private repos then builds on the Mac and
on the Windows PC for 0 minutes.

## User flows it touches

- **New Mac** clone `local-ci`, run `./install.sh`. Same as before.
- **New Windows PC** clone `local-ci`, run `.\install.ps1` in PowerShell.
- **Runner on a Mac** `./runner/install.sh` registers the runner with labels
  `self-hosted, macOS, ARM64, android` and starts it under launchd.
- **Runner on Windows** `.\runner\install.ps1` registers the runner with labels
  `self-hosted, Windows, X64, local` and starts it at logon under the current user.

## Changes

- **`install.ps1`** new. winget installs the tools `install.sh` gets from
  Homebrew. mise, git config, gh login, git-aliases and agent-skills, gh-stack,
  VS Code extensions, Claude memory and the MCP config follow the Mac order.
  The PowerShell profile gets `mise activate pwsh`.
- **Mac only, skipped on Windows** Oh My Zsh, Maccy (Windows has Win+V),
  terminal-notifier, gh-review-notify (a LaunchAgent) and the twg installer
  (a bash script).
- **`runner/install.sh`** new. Downloads the latest runner, checks its SHA256
  against the release notes, registers it, starts the launchd service.
- **`runner/install.ps1`** new. The same on Windows, with a scheduled task at
  logon in place of a service. A service runs as NETWORK SERVICE and lacks the
  user's mise, gh login and `~/.gitconfig`.
- **Token** both runner scripts ask `gh api` for a registration token. Without
  the `admin:org` scope they print the settings URL and ask to paste one.
- **`install.sh`** offers to run `runner/install.sh` at the end.
- **`README.md`** new name, both OS, the runner.
- **`docs/`** `architecture.md`, `user-flows.md`, `features.md` new.
- **GitHub** the repo is renamed `workbench-soft/local-ci`. GitHub redirects
  the old address.

## Steps, in commit order

1. This plan.
2. `runner/install.sh` and `runner/install.ps1`.
3. `install.ps1`, and the runner offer in both installers.
4. README, docs, changelog, TODO.
5. Rename the repo on GitHub and point `origin` at the new address.

## Docs to update

- `README.md`
- `docs/architecture.md`, `docs/user-flows.md`, `docs/features.md`
- `CHANGELOG.md`
