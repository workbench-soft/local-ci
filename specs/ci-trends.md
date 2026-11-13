# CI trends

## One-pager

- **What** a Trends tab on the status page at `http://localhost:4280/?tab=trends`
  shows charts of the org's CI: runs a day by result, build time, the wait for a
  runner, the failing steps and each machine's share.
- **Free** the page reads the GitHub API with the token it already has and keeps
  the history in `dashboard/run-history.json` on this PC. No account, no
  service, no extra install.
- **History** the first start reads 90 days of runs. Every 10 minutes the page
  adds the runs of the last 3 days. The file keeps 90 days.
- **Jobs** the jobs of each run tell the machine and the failed step. The page
  reads them for runs of the last 14 days, at most 120 runs per refresh.
- **Filter** the person picks a repo and 7, 30 or 90 days.
- **In the cards** each release, site, run and machine also shows its own
  numbers where it sits, with a link to the Trends tab.

## What it does for the person

The person sees whether CI gets slower, fails more or waits longer for a
runner, and which repo or step causes it. The page needs no new login, and
the data stays on the PC.

## User flows

1. The person opens the status page and presses Trends.
2. The tiles show the runs, the share that failed, the median build time and
   the median wait for a runner, each against the period before.
3. The charts show each day: runs by result, then the build time and the
   wait, each as the median and the slowest tenth (p90).
4. A hover over a day shows its numbers.
5. The tables list each workflow, each machine and the steps that fail most.
   A failed step links its last failed run.
6. The person picks a repo or a period, and the page shows only that.
7. On the Releases and Status tabs, each app, site, run and machine shows a
   line with its own numbers. The line links to the Trends tab of its repo.

## How it works: modules, files, data

- **`status/run-history.ts`** reads the finished runs of each org repo with
  `GET /repos/{repo}/actions/runs?created=<from>..<to>`, 100 a page, a week
  at a time. GitHub answers 1000 runs at most, so a full week splits in two. A run keeps
  its id, attempt, repo, workflow, branch, event, result, created, started
  and ended times. A rerun replaces the earlier attempt.
- **Jobs** `GET /repos/{repo}/actions/runs/{id}/jobs` gives each run its
  machines, through `kindsOfRun` of `status/runner-kind.ts`, the first failed
  job and step, and the time until the first job started.
- **`status/run-history-file.ts`** keeps the runs in `run-history.json`,
  written to a temp file and renamed. `RUN_HISTORY_FILE` in `.env.local`
  picks another file.
- **Refresh** the built server refreshes at start and every 10 minutes, from
  `instrumentation.ts`. A page load in dev refreshes when the data is older
  than 10 minutes. One refresh runs at a time.
- **`status/trends.ts`** turns the runs into the numbers the tab shows. Days
  follow the PC's time zone. The build time counts successful runs only,
  since a failure stops early.
- **Wait** the time from the push, or from the rerun, to its first job's start.
- **`cards/trends/`** the tab's tiles, charts and tables, drawn as SVG on the
  server. A hover shows the day through the SVG `title`.

## Limits

- **Org repos** the same repos the status page reads, up to 100.
- **Jobs** runs older than 14 days at the first start get no machine and no
  failed step. Their charts of results and build time still count them.
- **Purge** a run deleted on GitHub stays in the history.
- **Rate** a refresh costs about 1 call per repo plus up to 120 job calls.
  The first start reads 13 weeks per repo, about 600 calls.
- **Fill** the jobs of 14 days, about 3000 runs, take some hours to read, so
  the Wait chart and the Machines table fill in over that time.

## Changes

### 2026-11-13 Charts of errors, build time and runner wait on a Trends tab

- **Why** the person wants charts of CI errors, build speed and other
  observability, for free. Grafana Cloud needs an account and a push of the
  data, so the page draws the charts itself from the API it already calls.
- **Changes**
  - **`status/run-history.ts`, `status/run-history-file.ts`** the history
    and its file.
  - **`status/trends.ts`** the numbers, with tests.
  - **`cards/trends/`** the tab.
  - **`app/page.tsx`** the Trends tab link and view.
  - **`instrumentation.ts`** the refresh every 10 minutes.
  - **`demo/fake-github.ts`** a made up history for the screenshot.
- **Steps**
  1. This spec.
  2. The history, the numbers and their tests.
  3. The tab.
  4. Docs and the screenshot.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `docs/user-flows.md`, `CHANGELOG.md`.

### 2026-11-13 Each metric also in the card it belongs to

- **Why** the person asked to put the metrics where they are needed, so a
  glance at a card shows how its subject does over time.
- **Changes**
  - **`status/run-stats.ts`** the runs, failures and build times of each
    workflow over 30 days, and the fail rate of the last 7 days.
  - **`cards/trends/stats-line.tsx`** one muted line with those numbers and a
    link to the Trends tab for the repo.
  - **Releases tab** each app shows the stats of its release workflow.
  - **Sites card** each site shows the stats of its deploy workflow.
  - **Latest runs** the Took cell says the usual time of the workflow, and
    marks a run slower than its p90.
  - **Runners card** a line per machine: runs, failed share, build and wait
    over 14 days.
  - **Trends tab link** shows the fail rate of the last 7 days.
  - **`app/page.tsx`** reads the history on each tab.
- **Docs** `README.md`, `docs/features.md`, `CHANGELOG.md`.
