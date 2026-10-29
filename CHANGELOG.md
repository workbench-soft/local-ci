# Changelog

## Unreleased

- A `fix-stuck-ci` agent skill lists the runners and the waiting runs across the org. It sits in `.agents/skills`, linked for Claude Code and Copilot.
- `runner/install.ps1` installs the Android SDK parts the apps build with,
  and jobs no longer download SDK parts. Two Release builds at once broke NDK
  27.1 for every runner before.

- Runners check repos out under `C:\ci\<number>`. Expo release builds
  failed on a `.bat` path past 260 characters under `~ctions-runner`.

- The Runners card sets the number of runners on this PC and suggests a
  count from the logical processors and the memory. `runner\install.ps1`
  keeps the count in `~/actions-runner/runner-count` and removes the runners
  above it.

- Purge all clears every run the filter and search match, the older runs
  behind the 5 a repo shows included. It grays each row it purges at once,
  and a single Purge grays its row too.

- Latest runs has a PR column with the PR number of each run, linked to the
  PR and sortable.

- Stop on the status page reads Stopping at once and Stopped when GitHub
  ends the run, disabled the whole time. Stop force cancels now, so the
  runner takes the next release without waiting for `if: always()` steps.

- The status page shows one Running now card at the top in place of the
  Now card and the Running now card, which listed the same jobs.

- The Runners card spans the page and lists its runners in columns. It sat
  in a narrow cell beside empty space before.

- The cancel sweep keeps the first run of a new PR, keeps `workflow_run` and
  `schedule` runs, goes on when one repo's PR list fails, and stays off in
  `pnpm dev`. Each `dashboard.log` line gets a time and a reason.

- The status page answers on localhost only and can't be framed, which
  blocks DNS rebinding and clickjacking of Stop, Purge and Install.

- The status page shows at once from its last GitHub answer while a new one
  loads, and the page and the sweep share one set of calls. GitHub calls and
  the PowerShell read time out, and a failed PowerShell read keeps the last
  runner states for a minute in place of "runners down".

- The idle alert counts only the jobs the idle runner could take, a release
  shows on one run only, and a page that stopped updating says so in red.
  Light mode text, the dark filter chip, button names and sizes meet WCAG
  AA.

- `dashboard\install.ps1` keeps the other lines of `.env.local` and turns
  off Next telemetry. `runner\install.ps1` hides the pasted token.

- CI runs the page checks and lints the installers on each PR, and
  Dependabot proposes updates.

- The runner script turns on long paths for git and, in an admin run, for
  Windows. git clean failed on the deep `.open-next` cache before.

- `START.cmd` pulls the default branch and rebuilds the status page when its
  code changed, so a double click runs the latest version.

- Runner jobs share the machine's pnpm store. Before, each job kept its
  store in `_temp`, lost it at the end and downloaded every package again.

- Latest runs gets a Took column with the length of each run, sortable. A
  click on the time opens the time of each job and step.

- The usual time of a running job comes from the 10 latest finished runs of
  its workflow, in place of the 3 latest successful ones. A cancelled or
  failed job counts as at least the time it ran.

- The status page gets a Running now card above Latest runs, and each
  runner in Runners names its job. The page reads 30 runs per repo, so a
  run that builds under newer queued runs stays in view. ETags keep the page
  under the GitHub rate limit. The headline turns red when a runner of this
  PC sits idle while jobs wait.

- `runner/install.ps1` excludes the runner folders and the pnpm, npm, mise
  and Gradle caches from Defender scans. `RUNNER_DEFENDER_EXCLUSIONS=off`
  skips it.

- The runners of a machine share one tool cache in `~/actions-runner/_tool`.
  Node, Java or Python from a `setup-*` action downloads once for all of
  them. Run `runner/install.ps1` or `runner/install.sh` again to switch.

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
