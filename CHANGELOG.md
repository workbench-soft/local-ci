# Changelog

## Unreleased

- **Fixed** `install.ps1` on Windows PowerShell 5.1: the Copilot CLI installs again, mise works through its shims, agent-skills installs without a console, and `CLAUDE.md` is written without a BOM.

- **Renamed** the repo is `workbench-soft/local-ci` now. `install.ps1` sets up Windows with winget, and `runner/install.sh` and `runner/install.ps1` register the machine as a self-hosted Actions runner.
- **Moved** the repo is private in `workbench-soft` now. The script logs into `gh` before it clones git-aliases, agent-skills and gh-review-notify from the new owner.
