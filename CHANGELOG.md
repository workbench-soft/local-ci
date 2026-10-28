# Changelog

## Unreleased

- **TODO** lists what stays on the Mac and what to check after CI moved to the local runner.

- **Fixed** jobs on the Windows runner got CRLF scripts and the Store stub for `python`. Git now uses `core.autocrlf input`, and `start.cmd` and `.path` put Git Bash and the installed Python first.

- **Fixed** the Windows runner ran `shell: bash` in WSL. `start.cmd` puts Git Bash first, a rerun stops the old listener, and jobs get `ANDROID_HOME` when the SDK is in its default folder.

- **Runner** the Windows runner starts at boot, before anyone logs in. Both runners carry the `local` label, so a workflow on `[self-hosted, local]` runs on whichever machine is on.

- **Fixed** `install.ps1` on Windows PowerShell 5.1: the Copilot CLI installs again, mise works through its shims, agent-skills installs without a console, and `CLAUDE.md` is written without a BOM.

- **Renamed** the repo is `workbench-soft/local-ci` now. `install.ps1` sets up Windows with winget, and `runner/install.sh` and `runner/install.ps1` register the machine as a self-hosted Actions runner.
- **Moved** the repo is private in `workbench-soft` now. The script logs into `gh` before it clones git-aliases, agent-skills and gh-review-notify from the new owner.
