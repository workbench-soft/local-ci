# Auto update

## What it does for the person

The Windows PC installs each new release of local-ci by itself. A merge into
`main` that passes Checks reaches the status page and the runners within
minutes. No `git pull` or `install.ps1` by hand.

## User flows

1. A PR merges into `main`.
2. Checks passes, and Release tags the commit, such as `v2026.10.31.1`.
3. Within 5 minutes the `local-ci update` task on the Windows PC runs.
4. The task moves the checkout to that tag.
5. The task runs `dashboard\install.ps1` when the page code changed, and
   `runner\install.ps1` when the runner code changed.

The task runs every 5 minutes and at logon, so a release the PC missed
installs on the next run.

## How it works

- **`windows/update.ps1`** fetches the tags, fast forwards the checkout to the
  newest release tag and runs the installers whose files changed. It writes
  its output to `~/.local-ci/update.log`.
- **What changed** the page counts as changed when the latest commit of its
  files differs from `dashboard\.built-commit`. The runners keep the same mark
  in `~/.local-ci/runner-commit`.
- **The task** `local-ci update` runs as the person with admin rights, every
  5 minutes and at logon. `conhost --headless` keeps its window hidden.
  `START.cmd` adds it when it is missing, and so does `dashboard\install.ps1`.
  `windows\update.ps1 -Register` does it alone.
- **Start button** `START.cmd` runs `windows\update.ps1 -FromStart`, which
  prints each step and builds the page even when it was never installed.
- **One at a time** both hold `~/.local-ci/install.lock` open while they
  install. The task skips its turn when the lock is busy, and `START.cmd`
  waits for it.
- **The trigger** a job at the end of `release.yml` starts the task on a
  Windows runner.

## Limits

- **Logged in** the task runs only while the person is logged in, since git
  needs the login in the Windows credential store.
- **Default branch only** a checkout on another branch stays as it is.
- **Local edits** a pull that would overwrite an edited file stops, and the
  log says so.
- **Releases only** a commit on `main` installs once Checks passes and Release
  tags it.
- **Dev tools** the root `install.ps1` asks questions, so the task skips it.
- **Manual installers** a direct run of `dashboard\install.ps1` or
  `runner\install.ps1` takes no lock.
- **Mac** gets no task. Run `git pull` and the installers there by hand.

## Changes

### 2026-10-31 install each new release by itself

- **Why** each merge needed a `git pull` and an `install.ps1` run by hand.
  `TODO.md` filled up with those steps.
- **Changes** `windows/update.ps1` is new. `dashboard/install.ps1` registers
  the task and takes `-NoOpen`. `release.yml` starts the task.
- **Steps** this spec, then the script and the task, then the workflow, then
  the docs.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `docs/user-flows.md`, `CHANGELOG.md`.

### 2026-10-31 one install at a time, through START.cmd too

- **Why** `START.cmd` pulled the latest `main` and rebuilt the page on its own.
  A double click during an update ran two builds in one folder, and it could
  start a runner that `runner\install.ps1` was setting up.
- **Changes** `windows/boot-task.ps1` gets a lock file both scripts hold while
  they install. `windows/start.ps1` calls `windows\update.ps1 -FromStart` in
  place of its own pull and build, then starts the tasks. It adds the update
  task when it is missing, so a double click turns the update on.
- **Steps** this entry, then the lock and the scripts, then the docs.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `docs/user-flows.md`, `CHANGELOG.md`.
