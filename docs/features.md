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
- **Limit** the runner works only while the user is logged in.
- **Limit** one runner takes one job at a time.
