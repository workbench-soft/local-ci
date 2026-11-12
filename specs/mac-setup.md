# A new Mac set up by one script

Finished on 2025-10-20, before the history was reset to one commit. The old
commits live under `refs/backup/master` in the local backup mirror of
`mac-setup`.

## Why

A new Mac took a day to set up by hand. `install.sh` now installs the tools,
the MCP config and the Claude Code notes.

## User flows it touches

- **New Mac** `install.sh` brings the tools, the Teamwork Graph CLI and the
  MCP config.

## Changes

- **`install.sh`** new.
- **`mcp-config.json`** new.
- **`claude/MEMORY.md`** new.

## Steps, in commit order

1. First setup: README, install.sh, MCP config (ff5f115, 2025-10-20)
2. The Teamwork Graph CLI (a087af2, 2025-10-20)
3. The Claude Code memory notes (0e9f859, 2025-10-20)

## Docs to update

- `README.md`

## 2026-11-12 one line, and the run goes on past what is there

- **Why** the setup of a work Mac stopped on an app already in `/Applications`, before the skills.
- **Changes** the README opens with one line per system that clones and runs the installer. `install.sh` installs each brew formula and cask alone, skips the ones there, and goes on past a failed npm, twg or VS Code step. It puts the mise shims on its PATH for the agent-skills hooks and finds brew on an Intel Mac.
- **Docs** `README.md`, `docs/features.md`, `docs/user-flows.md`, `CHANGELOG.md`.
