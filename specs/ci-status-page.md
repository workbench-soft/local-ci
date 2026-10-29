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
- **Runs** `GET /repos/{repo}/actions/runs?per_page=30` gives the latest
  runs of each org repo. The page keeps the latest 5 and every unfinished
  one. `GET /repos/{repo}/actions/runs/{id}/jobs` gives the jobs of each
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

### 2025-10-29 A new run kills the older runs of its workflow and branch

- **Why** the queue fills with runs of commits that a newer push already
  replaced, and with PR runs of PRs already merged. They take runners and
  build for nothing.
- **Changes**
  - **`status/superseded.ts`** picks the unfinished runs to kill: a newer
    run of the same repo, workflow, branch and event replaced them, or they
    check a PR that is merged or closed. Other workflows of the same push
    stay, since each builds a different thing. Main and open PRs keep
    building. Release and deploy workflows run on main only.
  - **`status/cancel-superseded.ts`** every 10 seconds reads the runs through
    the shared 20 second cache and force cancels each replaced run.
    `force-cancel` also stops steps with `if: always()`, so the run frees its
    runner at once. Each cancel goes to `dashboard.log`. The open PRs of a
    repo with an unfinished PR run are read once a minute.
  - **`instrumentation.ts`** starts the loop with the server, so it works
    with no tab open.
  - **`CANCEL_SUPERSEDED=off`** in `.env.local` turns it off.
- **Limits** a run dies up to 30 seconds after the newer one shows. A manual
  re-run of an older commit dies too while a newer run of its branch exists.
  The page server must run.
- **Steps**
  1. This spec.
  2. The picker, its tests and the loop.
  3. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `docs/architecture.md`,
  `CHANGELOG.md`.

### 2026-10-29 Long lists scroll inside their card

- **Why** the waiting column, and any list on the page, can grow to dozens of
  rows and push the rest of the page down.
- **Changes**
  - **`app/styles.css`** the job lists of the Now card and the Runners list
    stop at 420 px and scroll. The runs table stops at 70% of the window
    height and scrolls, with its head row pinned on top.
  - **`cards/latest-runs-table.tsx`** the table sits in a scroll box.
- **Steps**
  1. This spec.
  2. The styles and the table box.
  3. Docs and changelog.
- **Docs** `docs/features.md`, `CHANGELOG.md`.

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

### 2026-10-29 Purge all runs of the table

- **Why** the person wants to clear many runs at once, such as every failed
  run or every run of one repo, without pressing Purge on each.
- **Changes**
  - **`status/purge.ts`** `purgeRuns` purges a list of runs, 5 at a time,
    and returns the runs it failed on with their errors.
  - **`status/run-actions.ts`** a server action that checks each repo and
    run id, then purges them all.
  - **`cards/latest-runs-table.tsx`** a Purge all button in the toolbar. It
    acts on every run the filter and the search match, past the 60 rows the
    table shows too. It asks to confirm with the count first, then shows how
    many it purged and the first error.
- **Limits** a run that won't stop within 60 seconds stays, like with Purge.
- **Steps**
  1. This spec.
  2. `purgeRuns` with tests, and the server action.
  3. The button.
  4. Docs and changelog.
- **Docs** `docs/features.md`, `docs/user-flows.md`, `docs/architecture.md`,
  `README.md`, `CHANGELOG.md`.

### 2026-10-29 Place labels that say what they mean

- **Why** the person read "On this PC" in Latest runs and asked what it means,
  since every run of theirs builds on this PC. The label shows only while a
  run builds, and the page didn't say so.
- **Changes**
  - **`cards/icons.tsx`** each place gets a label with a verb and a hint:
    Building on this PC, Queued on GitHub, Building on another runner. The
    hint names who builds the job, for example a GitHub hosted runner.
  - **`cards/latest-runs-table.tsx`** the filter chips use the same labels,
    and each chip and place label shows its hint on hover. A line under the
    heading says the place shows only while a run is unfinished.
- **Steps**
  1. This spec.
  2. The labels, the hints and the line.
  3. Docs and changelog.
- **Docs** `docs/features.md`, `CHANGELOG.md`.

### 2026-10-29 A Running now banner, and every unfinished run on the page

- **Why** the Now card showed a long waiting list and no running job, while
  all 4 runners of this PC were busy. The page read only the latest 5 runs of
  each repo. A busy repo queues 5 newer runs on top of the one that builds,
  so that run dropped off the page. The cancel loop read the same 5 runs, so
  older replaced runs stayed in the queue and took runners.
- **Changes**
  - **`status/org-status.ts`** each repo call asks for 30 runs, at the same
    cost of 1 call. The page keeps every unfinished run of those 30, and the
    latest 5 of the rest. Failed runs get their jobs read only among those 5.
    The jobs of a run in `queued` state stay in memory while the run's
    `updated_at` stays the same, for up to 60 seconds, since 20 queued runs
    cost 20 calls each load.
  - **ETags** each GET sends `If-None-Match` with the ETag of its last
    answer. A 304 costs no rate limit. The page ran out of its 5000 calls an
    hour on 2026-10-29 and showed no runs until the reset.
  - **`status/headline.ts`** a runner of this PC sits idle while a job waits
    for `self-hosted`: the headline turns red and says so.
  - **`cards/running-now-card.tsx`** a wide card right above Latest runs.
    Each running job gets a large row: runner, repo, workflow, job, progress
    bar, start time and Stop. With no job running and a queue, the card says
    how many jobs wait and that no runner takes them.
  - **`cards/runners-card.tsx`** each runner row names the job it builds,
    with a link to its log.
- **Limits** a repo with over 30 runs since its oldest unfinished one hides
  that run. The idle check uses the labels `self-hosted` and `local`. A job
  that asks for macOS waits for the Mac and doesn't count.
- **Steps**
  1. This spec.
  2. The run window, the jobs cache and the idle check, with tests.
  3. The Running now card and the jobs in the Runners card.
  4. Docs and changelog.
- **Docs** `docs/features.md`, `docs/architecture.md`, `CHANGELOG.md`.

### 2026-10-29 The usual time counts cancelled and failed runs, over a window of 10

- **Why** the usual time came from the 3 latest successful runs only. A job
  cancelled after 10 minutes says the job takes 10 minutes or more, and the
  page dropped that. Three runs also react slowly when a job gets faster or
  slower.
- **Changes**
  - **`status/org-status.ts`** reads the 10 latest finished runs of the
    workflow, any conclusion, in 1 call. Their jobs stay in memory as before,
    since a finished run doesn't change.
  - **`status/progress.ts`** a successful job gives its full time. A
    cancelled, failed or timed out job gives a lower bound: it ran this long
    and still had work left. A skipped job counts for nothing. The usual time
    is the Kaplan-Meier median of these times. A lower bound under the
    median only shrinks the pool of jobs, and a lower bound above it pushes
    the median up. With no full time over the middle, the usual time is the
    longest time seen, so 3 jobs cancelled at 10 minutes give 10 minutes.
  - **Window** each new finished run pushes the oldest of the 10 out. More
    fast runs pull the usual time down, more slow ones push it up.
- **Limits** a run cancelled by a newer push counts as a short lower bound,
  which moves the median little. A window of 10 cancelled runs and no
  success gives the longest of them, which can sit under the real time.
- **Steps**
  1. This spec.
  2. The window and the median, with tests.
  3. Docs and changelog.
- **Docs** `docs/features.md`, `docs/architecture.md`, `CHANGELOG.md`.

### 2026-10-29 How long a run took, and the time of each step

- **Why** the person asked to see in Latest runs how long each build took,
  and where that time went step by step.
- **Changes**
  - **`status/org-status.ts`** each run keeps `run_started_at` from the runs
    call, at no extra cost.
  - **`status/durations.ts`** the length of a run: from its start to its
    last update once it has finished, and up to now while it builds. A run
    still in the queue says "in queue". GitHub starts a run when it is
    created, so the wait for a runner counts in. The breakdown row shows
    the time of each job without that wait.
  - **`cards/latest-runs-table.tsx`** a Took column, sortable. A click on
    the time opens a row under the run with each job and its steps, each
    with its time and a bar in scale with the longest step of the run.
  - **`status/run-actions.ts`** a server action reads the jobs of 1 run with
    the step times. The page asks only when a row opens, so the rate limit
    stays as it was. An open row of an unfinished run reads again on each
    refresh. GitHub answers 304 to an unchanged run, which costs no calls.
- **Limits** a rerun counts from the start of its latest attempt. GitHub
  keeps step times to the second, so a short step shows 0 s.
- **Steps**
  1. This spec.
  2. The run length and the step times, with tests.
  3. The column and the breakdown row.
  4. Docs and changelog.
- **Docs** `docs/features.md`, `docs/architecture.md`, `CHANGELOG.md`.

### 2026-10-29 START.cmd runs the latest version

- **Why** after each merge the person had to run `dashboard\install.ps1` as
  admin to see the new page. They asked for one script that pulls, installs
  and starts the latest version.
- **Changes**
  - **`windows/start.ps1`** pulls the default branch first with
    `git pull --ff-only`, when the checkout sits on it. A pull that fails,
    such as with local edits in the way, says so and goes on with the code
    on disk.
  - **Rebuild** `dashboard\install.ps1` writes the commit of `dashboard/` it
    built to `dashboard/.built-commit`. `start.ps1` compares that commit
    with the latest one that touched `dashboard/`. A mismatch, or no file,
    runs `install.ps1`, which asks for admin, rebuilds and restarts the
    page. Otherwise the page task starts as before.
- **Limits** a checkout on another branch skips the pull. Runner scripts
  don't rerun, since a runner update needs its own install.
- **Steps**
  1. This spec.
  2. The pull and the rebuild check.
  3. Docs and changelog.
- **Docs** `README.md`, `docs/features.md`, `docs/user-flows.md`,
  `docs/architecture.md`, `CHANGELOG.md`.
