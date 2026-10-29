# CI status page

## What it does for the person

`http://localhost:4280` shows whether the local CI works, what builds on this
PC and what waits on GitHub. The page starts with Windows and opens in the
browser at each logon.

## User flows

1. The person runs `.\dashboard\install.ps1` once.
2. The script builds the app. Then it registers a scheduled task that starts
   the app at boot.
3. The browser opens `http://localhost:4280` after the build and at each
   logon. The page refreshes every 15 seconds on its own.
4. The person filters, searches and sorts the runs table.

## How it works: modules, files, data

- **`dashboard/`** a Next.js app with one page, rendered on the server.
- **This PC** the page finds each runner folder of the org under
  `~/actions-runner`. For each runner it reads the boot task state. A live
  listener holds its newest `_diag/Runner_*.log` open, and a live worker its
  newest `_diag/Worker_*.log`. The page tries to open each log for read only.
  A refusal means the process runs. A worker means a job is running right now.
- **Why the logs** the boot task starts the runner without a login, so
  Windows hides its process path from the page. The path is the only link
  from a process to its folder.
- **Org runners** `GET /orgs/workbench-soft/actions/runners` gives each runner
  online or offline, busy or idle, with its labels.
- **Runs** `GET /repos/{repo}/actions/runs` gives the latest runs of each org
  repo. `GET /repos/{repo}/actions/runs/{id}/jobs` gives the jobs of each
  unfinished run, with the runner name of each job.
- **Place** a job is local when its runner name matches the `agentName` in a
  runner folder's `.runner` file. A started job on another runner is
  elsewhere, and a job without a runner waits on GitHub. Local runs go on top
  of the table, then the waiting ones.
- **Open at logon** a shortcut in the Startup folder runs `open.ps1`. The
  script waits for the port, then opens the page through `explorer.exe`.
- **Token** `GITHUB_TOKEN` comes from `dashboard/.env.local`, which the install
  script writes from `gh auth token`. The task runs at boot without a
  password, so the gh login in the Windows credential store is out of its
  reach.
- **Cache** the page keeps GitHub answers in memory for 20 seconds. Several
  open tabs then cost one set of calls.
- **`dashboard/install.ps1`** installs the packages and builds. Then it writes
  `.env.local` and registers the `local-ci dashboard` task at boot.
- **Port** `4280`, on `127.0.0.1` only. `DASHBOARD_PORT` picks another one.

## Limits

- **Windows only** the This PC block reads Windows tools. On a Mac it says
  the checks are skipped.
- **Token** GitHub data shows only while the token in `.env.local` works.
  After a new gh login, run the install script again.
- **Repos** up to 100 org repos, with 5 runs each.

## Changes

### 2026-10-29 A web page with the CI status that starts with Windows

- **Why** the person wants to see at a glance whether the runner is up and
  what it builds, without opening GitHub.
- **Changes** a new `dashboard/` app with its `install.ps1`. README, docs and
  TODO each get a section on the page.
- **Steps**
  1. This spec.
  2. The Next.js app.
  3. The install script and the boot task.
  4. Docs.
- **Docs** `README.md`, `docs/architecture.md`, `docs/user-flows.md`,
  `docs/features.md`.

### 2026-10-29 A row per runner of this PC

- **Why** `runner/install.ps1` now installs several runners, see
  `specs/ci-runner.md`.
- **Changes** `status/this-pc.ts` reads every runner folder.
  `cards/this-pc-card.tsx` shows a row per runner. The headline says how many
  runners are down.
- **Docs** `docs/features.md`, `docs/architecture.md`.

### 2026-10-29 Local jobs first, sorting, a filter, icons, and the page opens on its own

- **Why** the person wants to see at once what builds on this PC and what
  waits on GitHub. The runs list needs sorting and a filter. The page should
  open in the browser after the install build and at each logon.
- **Changes**
  - **`status/org-status.ts`** reads the jobs of each unfinished run, with the
    runner that took each job.
  - **`status/placement.ts`** sorts each run into one place: on this PC, on
    another runner, waiting on GitHub, or done. A job counts as local when its
    runner name matches a runner folder of this PC.
  - **`cards/local-jobs-card.tsx`** a card on top with the jobs that run on
    this PC, and a card with the jobs that wait for a runner on GitHub.
  - **`cards/latest-runs-table.tsx`** a client table: a filter by place and
    result, a text search, and sorting by a click on a column head.
  - **`cards/icons.tsx`** an icon per result and per place.
  - **`dashboard/open.ps1`** waits for the page to answer, then opens it in the
    default browser. `install.ps1` runs it at the end and puts a shortcut to it
    in the Startup folder, so it runs at each logon.
- **Steps**
  1. This spec.
  2. Jobs and the place of each run.
  3. The cards, the table and the icons.
  4. The page opens after install and at logon.
  5. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `docs/user-flows.md`,
  `docs/architecture.md`, `CHANGELOG.md`.
