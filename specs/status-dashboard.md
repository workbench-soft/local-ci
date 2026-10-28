# CI status dashboard

## What it does for the person

A page at `http://localhost:4280` shows whether the local CI works and what it
builds. It starts with Windows, so the page is there after a reboot.

## User flows

1. The person runs `.\dashboard\install.ps1` once.
2. The script builds the app and registers a scheduled task that starts it at
   boot.
3. The person opens `http://localhost:4280`. The page refreshes itself every
   15 seconds.

## How it works: modules, files, data

- **`dashboard/`** a Next.js app. One page, rendered on the server.
- **This PC** the page asks `schtasks` for the runner task state and
  `tasklist` for `Runner.Listener.exe` and `Runner.Worker.exe`. A worker
  process means a job runs right now.
- **Org runners** `GET /orgs/workbench-soft/actions/runners`: each runner
  online or offline, busy or idle, with its labels.
- **Runs** the latest runs of each org repo, through
  `GET /repos/{repo}/actions/runs`. Queued runs go on top, since they wait for
  a runner.
- **Token** `GITHUB_TOKEN` from `dashboard/.env.local`. The install script
  writes it from `gh auth token`. The task runs at boot without a password, so
  it can't read the gh login in the Windows credential store.
- **Cache** GitHub answers stay in memory for 20 seconds, so several open tabs
  cost one set of calls.
- **`dashboard/install.ps1`** installs the packages, builds, writes
  `.env.local`, and registers the task `local-ci dashboard` at boot.
- **Port** `4280` on `127.0.0.1` only. Set `DASHBOARD_PORT` for another one.

## Limits

- **Windows only** the This PC block reads Windows tools. On a Mac it shows
  that the checks are skipped.
- **Token** the page shows GitHub data only while the token in `.env.local`
  works. A new gh login needs a rerun of the install script.
- **Repos** up to 100 org repos, 5 runs each.

## Changes

### 2026-10-29 A web page with the CI status that starts with Windows

- **Why** the person wants to see at a glance whether the runner is up and
  what it builds, without opening GitHub.
- **Changes** new `dashboard/` app and its `install.ps1`. README, docs and
  TODO get a dashboard section.
- **Steps**
  1. This spec.
  2. The Next.js app.
  3. The install script and the boot task.
  4. Docs.
- **Docs** `README.md`, `docs/architecture.md`, `docs/user-flows.md`,
  `docs/features.md`.
