# mac-setup becomes local-ci and sets up Windows like the Mac

## Why

Development moves to Windows. The repo set up only a Mac, and its name said
so. As `local-ci` it holds two scripts per OS:

- **Setup** installs the same tools on each OS.
- **Runner** registers the machine as a self-hosted GitHub Actions runner for
  `workbench-soft`.

CI of the private repos then builds on the Mac and on the Windows PC for 0
minutes.

## User flows it touches

- **New Mac** clone `local-ci` and run `./install.sh`, as before.
- **New Windows PC** clone `local-ci` and run `.\install.ps1` in PowerShell.
- **Runner on a Mac** `./runner/install.sh` registers the runner with the
  labels `self-hosted, macOS, ARM64, android` and starts it under launchd.
- **Runner on Windows** `.\runner\install.ps1` registers the runner with the
  labels `self-hosted, Windows, X64, local` and starts it at logon as the
  current user.

## Changes

- **`install.ps1`** new. winget installs the tools that Homebrew gives the
  Mac. Then come mise, the git config, the gh login, git-aliases and
  agent-skills, gh-stack, the VS Code extensions, the Claude memory and the MCP
  config, in the Mac order. The PowerShell profile gets `mise activate pwsh`.
- **Skipped on Windows** the Mac only pieces: Oh My Zsh, Maccy (Windows has
  Win+V), terminal-notifier, gh-review-notify (a LaunchAgent) and the twg
  installer (a bash script).
- **`runner/install.sh`** new. It downloads the latest runner and checks its
  SHA256 against the release notes. Then it registers the runner and starts
  the launchd service.
- **`runner/install.ps1`** new. It does the same on Windows, with a scheduled
  task at logon in place of a service. A service runs as NETWORK SERVICE,
  without the user's mise, gh login and `~/.gitconfig`.
- **Token** both runner scripts get a registration token from `gh api`.
  Without the `admin:org` scope they print the settings URL and ask for a
  pasted token.
- **`install.sh`** ends with an offer to run `runner/install.sh`.
- **`README.md`** the new name, both OS, the runner.
- **`docs/`** new `architecture.md`, `user-flows.md` and `features.md`.
- **GitHub** the repo gets the name `workbench-soft/local-ci`. GitHub
  redirects the old address.

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
