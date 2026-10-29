# Changelog

## Unreleased

- The runs table of the status page says Building on this PC, Queued on
  GitHub or Building on another runner, with a hint on hover. A line under
  the heading says a finished run shows only its result.

- The runs table gets a Purge all button. After a confirm, it purges every
  run the filter and search match.

- Each running job on the status page gets a progress bar with its current
  step and the time left, from the 3 latest successful runs of its workflow.

- The status page server force cancels a run once a newer run of its
  workflow and branch shows, or once its PR is merged or closed.

- Long lists on the status page scroll inside their card: the Now columns
  and the Runners list past 420 px, the runs table past 70% of the window,
  with its head row pinned.

- The status page shows one Runners card in place of This PC and Runners of
  workbench-soft. Each runner says where it lives and its state on this PC and
  on GitHub, with a hint when the two disagree.

- The runs table of the status page gets a Release column. It links to the
  release a run published, and Install puts its APK on the phone over adb. A
  failed run names its failed step, and each run links to its branch and PR.

- `START.cmd` in the repo root starts the runners and the status page with a
  double click, then opens the page in the browser.

- The Now card of the status page lists every runner of this PC, idle ones
  too, with the job each one builds.

- The status page gets an icon, in the browser tab and on its Startup
  shortcut.

- The status page gets Stop and Purge buttons on each run and live job. Stop
  cancels the run. Purge force cancels it and deletes it from GitHub with its
  logs and artifacts.

- Both installs put Python 3.15 in through mise. On Windows `python3` now runs
  it in place of the Store stub, in a terminal and in runner jobs.

- The status page puts the jobs that build on this PC first and lists the jobs
  that wait on GitHub for a runner. The runs table gets icons, filter chips, a
  search box and sorting. The page opens in the browser after the install
  build and at each logon.

- The runner scripts install `RUNNER_COUNT` runners per machine, 4 on Windows
  and 1 on a Mac, so the PC builds several jobs at once. The status page shows
  a row per runner.
