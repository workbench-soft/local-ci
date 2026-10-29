# Move mac-setup to workbench-soft and make it private

## Why

The repo moved from `oleg-chibikov` to the `workbench-soft` org and is private now.
So are the repos it clones: git-aliases, agent-skills and gh-review-notify.
A clone without a login fails.

## User flows it touches

- **New Mac** the person clones mac-setup with a GitHub token and runs `install.sh`.
- **install.sh** logs into `gh`, then clones each repo with `gh repo clone`.

## Changes

- **`install.sh`** the `gh auth login` step moves ahead of the clones. The clones use `gh repo clone workbench-soft/<repo>`.
- **`README.md`** links and the clone line name `workbench-soft`, and the private repo note says a token is needed.
- **`CHANGELOG.md`** new, with one entry.

## Steps, in commit order

1. Clone from workbench-soft after the login.

## Docs to update

- `README.md` clone line and the repo links.
