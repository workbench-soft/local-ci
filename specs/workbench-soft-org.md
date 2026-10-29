# mac-setup moves to workbench-soft as a private repo

## Why

The repo left `oleg-chibikov` for the `workbench-soft` org, and it is private
now. The repos it clones are private too: git-aliases, agent-skills and
gh-review-notify. A clone without a login fails.

## User flows it touches

- **New Mac** the person clones mac-setup with a GitHub token, then runs
  `install.sh`.
- **install.sh** logs into `gh` first, then clones each repo with
  `gh repo clone`.

## Changes

- **`install.sh`** the `gh auth login` step comes before the clones. Each clone
  runs `gh repo clone workbench-soft/<repo>`.
- **`README.md`** the links and the clone line point at `workbench-soft`. The
  note on the private repo says a clone needs a token.
- **`CHANGELOG.md`** new, with one entry.

## Steps, in commit order

1. Log in, then clone from workbench-soft.

## Docs to update

- `README.md`: the clone line and the repo links.
