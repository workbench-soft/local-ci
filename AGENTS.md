# Agent rules

## Skills

Repo skills MUST sit in `.agents/skills/`, a folder each, where Codex reads them. `.claude/skills` MUST link to that folder for Claude Code and Copilot.
On Windows, `git config --global core.symlinks true` MUST run before the clone. Otherwise the link checks out as a text file.

- **`fix-stuck-ci`** you SHOULD load it to list the runners and the waiting runs across the org, then unstick them.
