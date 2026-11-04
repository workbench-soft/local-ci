# Agent rules

## Skills

Repo skills MUST sit in `.agents/skills/`, a folder each, where Codex reads them. `.claude/skills` MUST link to that folder for Claude Code and Copilot.
On Windows, `git config --global core.symlinks true` MUST run before the clone. Otherwise the link checks out as a text file.

- **`fix-stuck-ci`** you SHOULD load it to list the runners and the waiting runs across the org, then unstick them.

## Work folder clean

`runner/clean-work.ps1` and `windows/clean-ci.ps1`, which `CLEAN-CI.cmd` starts, clean what the runners leave on disk. They MUST stay in step with `runner/install.ps1`.

- **Keep in step** a change to the work root, `RUNNER_WORK_ROOT`, the org, the runner folders, the task names or the folders a runner keeps in its work folder MUST update both clean scripts in the same PR.
- **New leftovers** a new place where jobs leave big files, such as a cache or a build output outside the checkout, MUST get its clean rule in `runner/clean-work.ps1` or a reason in `specs/ci-runner.md` why it stays.
- **Test** `dashboard/status/clean-sync.test.ts` MUST pass. A new setting the clean scripts share with `runner/install.ps1` SHOULD get its check there.
