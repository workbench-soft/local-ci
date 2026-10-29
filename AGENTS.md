# Agent rules

## Skills

Repo skills sit in `.agents/skills/`, a folder each, and Codex reads them there. `.claude/skills` links to that folder for Claude Code and Copilot.
On Windows, run `git config --global core.symlinks true` before the clone. Otherwise the link checks out as a text file.

- **`fix-stuck-ci`** list the runners and the waiting runs across the org, then unstick them.
