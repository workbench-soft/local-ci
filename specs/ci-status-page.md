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
5. The person presses Stop on an unfinished run to cancel it, or Purge to
   force cancel it and delete it from GitHub with its logs and artifacts.
6. A run that published a release shows it in the Release column. The person
   opens the release, or presses Install to put its APK on the phone plugged
   in over USB.
7. A failed run names its failed job and step under the result, with a link
   to that job's log. A failed install shows adb's error under the button.
8. The branch of a run opens on GitHub, and so does its PR.

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
- **Runners card** one card joins both sources by runner name. A row says
  where the runner lives, its state on this PC and on GitHub, and a hint when
  the two disagree.
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
- **Stop and Purge** server actions in `status/run-actions.ts`. Stop calls
  `POST /repos/{repo}/actions/runs/{id}/cancel`. Purge calls `force-cancel`,
  which also stops steps with `if: always()`. It then waits up to 60 seconds
  for the run to finish and calls `DELETE /repos/{repo}/actions/runs/{id}`.
  Each action drops the 20 second cache, so the next render shows the change.
- **Releases** the app repos are private, so each release goes to the public
  `workbench-soft/workbench-soft.github.io` repo with the tag
  `<repo>-v<version>`. `GET /repos/{public}/releases` gives them. A run owns
  the release of its repo created between its start and its last update.
- **Install** a server action in `status/install-apk.ts` downloads the `.apk`
  asset of the release to a temp folder and runs `adb install -r`. adb comes
  from `ADB_PATH`, `PATH`, `ANDROID_HOME` or `%LOCALAPPDATA%\Android\Sdk`.
- **Failed step** for a failed run the page reads its jobs and names the
  first failed job and step.
- **PR and branch** `pull_requests` of a run gives its PR numbers. GitHub
  leaves out PRs from forks and pushes to the default branch.

## Limits

- **Windows only** the this PC checks read Windows tools. On a Mac the
  Runners card shows the GitHub side only and says the checks are skipped.
- **Token** GitHub data shows only while the token in `.env.local` works.
  After a new gh login, run the install script again.
- **Repos** up to 100 org repos, with 5 runs each.
- **Whole runs** GitHub cancels a run, not a single job. Stop on a job in the
  Now card stops its whole run.
- **Token scope** Stop and Purge need write access to Actions. The `repo`
  scope of a gh login gives it.
- **One phone** Install needs one device in `adb devices`. With none or
  several, the button shows adb's error.
- **Last 3** the public repo keeps 3 releases per app, so older runs lose
  their release link.

## Changes

### 2025-10-29 A web page with the CI status that starts with Windows

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

### 2025-10-29 A row per runner of this PC

- **Why** `runner/install.ps1` now installs several runners, see
  `specs/ci-runner.md`.
- **Changes** `status/this-pc.ts` reads every runner folder.
  `cards/this-pc-card.tsx` shows a row per runner. The headline says how many
  runners are down.
- **Docs** `docs/features.md`, `docs/architecture.md`.

### 2025-10-29 Local jobs first, sorting, a filter, icons, and the page opens on its own

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

### 2025-10-29 An icon for the page and its shortcut

- **Why** the browser tab and the Startup shortcut show a blank default icon.
- **Changes**
  - **`app/icon.svg`** a blue rounded square with a white loop arrow around a
    green play sign: a build that runs again and again. Next serves it as the
    favicon.
  - **`dashboard/icon.ico`** the same icon at 16, 24, 32, 48 and 256 px.
    `install.ps1` sets it on the `local-ci dashboard.lnk` shortcut.
- **Steps**
  1. This spec.
  2. The icon, the favicon and the shortcut.
  3. Docs and changelog.
- **Docs** `docs/features.md`, `CHANGELOG.md`.

### 2025-10-29 Stop and purge runs from the page

- **Why** the person wants to kill a stuck or unwanted run from the page,
  including a full purge, without opening GitHub.
- **Changes**
  - **`status/org-status.ts`** a shared GitHub call for any method, and a way
    to drop the cache.
  - **`status/run-actions.ts`** server actions: Stop cancels a run. Purge,
    in `status/purge.ts`,
    force cancels it, waits for it to finish, then deletes it.
  - **`cards/run-controls.tsx`** Stop and Purge buttons. Purge asks to
    confirm first. An error shows next to the buttons.
  - **`cards/latest-runs-table.tsx`** the buttons on each run. A finished run
    gets Purge only.
  - **`cards/live-jobs-card.tsx`** the buttons on each job, for its run.
- **Steps**
  1. This spec.
  2. The GitHub calls and the server actions.
  3. The buttons.
  4. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `docs/user-flows.md`,
  `docs/architecture.md`, `CHANGELOG.md`.

### 2025-10-29 Every runner of this PC in the Now card

- **Why** the person wants all runners of this PC at the top, idle ones too,
  without scrolling to the This PC card.
- **Changes**
  - **`status/placement.ts`** `runnerSlots` pairs each runner of this PC with
    the job it builds. A local job whose runner has no folder here gets a row
    of its own.
  - **`cards/live-jobs-card.tsx`** the On this PC column shows a row per
    runner: its name, a dot, and its job, or idle, or stopped. The count reads
    busy runners out of all runners.
- **Steps**
  1. This spec.
  2. The runner rows.
  3. Docs and changelog.
- **Docs** `docs/features.md`, `CHANGELOG.md`.

### 2026-10-29 A START file in the repo root

- **Why** the person wants one file in the repo root to double click. It
  starts the runners and the page, then opens the page in the browser.
- **Changes**
  - **`START.cmd`** in the repo root, upper case like `README.md`, so it is
    easy to spot. It runs `windows/start.ps1` and keeps the window open on an
    error.
  - **`windows/start.ps1`** starts each `GitHub Actions runner (...)` task and
    the `local-ci dashboard` task that isn't running. Windows refuses? It asks
    once for admin rights and tries again. No page task yet? It runs
    `dashboard/install.ps1`. No runner task? It names `runner/install.ps1`.
    Then it opens the page through `dashboard/open.ps1`.
- **Limits** Windows only. The tasks must exist, so a new PC runs the install
  scripts first.
- **Steps**
  1. This spec.
  2. `START.cmd` and `windows/start.ps1`.
  3. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `docs/user-flows.md`,
  `docs/architecture.md`, `CHANGELOG.md`.

### 2025-10-29 A release column with an Install button, the failed step, PR and branch links

- **Why** the person wants to open the release a run made and put it on an
  Android phone over adb in one click, from a column of its own. Errors, of
  the install and of a failed run, should be easy to see. The branch and its
  PR should open from the row.
- **Changes**
  - **`status/releases.ts`** reads the releases of the public repo and pairs
    each with the run that made it.
  - **`status/install-apk.ts`** a server action: download the APK, run
    `adb install -r`, return adb's output on failure.
  - **`status/org-status.ts`** reads the jobs of failed runs too, with their
    steps, and the releases. Each run gets its branch link and the links of
    its PRs from `pull_requests`.
  - **`cards/latest-runs-table.tsx`** a Release column with the link and an
    Install button. A failed run names its failed job and step. The branch
    is a link, with a PR link beside the event.
  - **`cards/install-button.tsx`** the button, its progress and its error.
- **Steps**
  1. This spec.
  2. Releases, the install action and the failed step.
  3. The column and the button.
  4. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `docs/user-flows.md`,
  `docs/architecture.md`, `CHANGELOG.md`.

### 2025-10-29 One Runners card in place of This PC and Runners of the org

- **Why** the person saw two runner cards and couldn't tell them apart. This
  PC read the runner folders, Runners of workbench-soft read GitHub, and the
  page said neither.
- **Changes**
  - **`status/runners.ts`** `mergeRunners` joins the runners of this PC and
    the org runners from GitHub by name. Each row gets its place, this PC or
    another machine, its state on each side, and a hint when the two sides
    disagree.
  - **`cards/runners-card.tsx`** one Runners card. A row per runner: a dot,
    the name, `this PC: ...` and `GitHub: ...`, the labels, the boot task and
    the last job. A row with a hint gets a warning style.
  - **`cards/this-pc-card.tsx`**, **`cards/org-runners-card.tsx`** removed.
- **Hints**
  - Runs here, GitHub sees it offline: the process is alive, check the
    network or register the runner again.
  - Folder here, GitHub has no runner with that name: register it again.
  - Stopped here, GitHub sees it online: it runs outside its boot task, so
    the log check misses it, or a runner with this name runs on another
    machine. The first case showed up on the live page.
  - Stopped here, offline on GitHub: start it with `START.cmd`.
- **Steps**
  1. This spec.
  2. `mergeRunners` with its tests.
  3. The Runners card.
  4. Docs and changelog.
- **Docs** `docs/features.md`, `docs/architecture.md`, `CHANGELOG.md`.

### 2025-10-29 A progress bar and a time left on each running job

- **Why** the person wants to see how far a running job got and when it ends,
  without opening its log.
- **Changes**
  - **`status/org-status.ts`** each job keeps its step count, its current
    step and its end time. For a workflow with a running job, the page also
    asks `GET /repos/{repo}/actions/workflows/{id}/runs?status=success` for
    its 3 latest successful runs and reads their jobs. The latest 5 runs of a
    busy repo are often all queued, so they can't serve here. A finished run
    doesn't change, so its jobs stay in memory for good, up to 200 runs.
  - **`status/progress.ts`** the typical time of a job is the median time of
    the same job name in those successful runs. The bar fills by elapsed
    time over the typical time, capped at 99 %. Without a past run it fills
    by finished steps over all steps.
  - **`status/placement.ts`** each live job carries its steps and its
    typical time.
  - **`cards/job-progress.tsx`** the bar under a running job, with
    `step 4 of 9: Build` and `about 3 min left`, or `2 min over the usual 5`
    once it runs long.
  - **`cards/live-jobs-card.tsx`** the bar on the jobs of this PC and of other
    runners. A queued job gets none.
- **Limits** the estimate needs a successful run of the same workflow with a
  job of the same name. Steps come from GitHub, which updates them every
  few seconds, and the page reads them every 15 to 20 seconds.
- **Steps**
  1. This spec.
  2. Steps, past jobs and the estimate, with tests.
  3. The bar.
  4. Docs and changelog.
- **Docs** `docs/features.md`, `docs/architecture.md`, `CHANGELOG.md`.
