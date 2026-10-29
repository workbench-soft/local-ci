# CI status page

## What it does for the person

`http://localhost:4280` shows whether the local CI works and what it builds.
The page starts with Windows, so it is back after each reboot.

## User flows

1. The person runs `.\dashboard\install.ps1` once.
2. The script builds the app. Then it registers a scheduled task that starts
   the app at boot.
3. The person opens `http://localhost:4280`. The page refreshes every 15
   seconds on its own.

## How it works: modules, files, data

- **`dashboard/`** a Next.js app with one page, rendered on the server.
- **This PC** the page asks `Get-ScheduledTask` for the runner task state. It
  asks `tasklist` for `Runner.Listener.exe` and `Runner.Worker.exe`. A worker
  process means a job is running right now.
- **Org runners** `GET /orgs/workbench-soft/actions/runners` gives each runner
  online or offline, busy or idle, with its labels.
- **Runs** `GET /repos/{repo}/actions/runs` gives the latest runs of each org
  repo. Queued runs go on top, since they wait for a runner.
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
