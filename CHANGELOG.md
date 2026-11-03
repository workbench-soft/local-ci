# Changelog

## Unreleased

- **Docs** the README names Bitwarden Secrets Manager as the place for secrets, in place of 1Password.
- **GitHub minutes** the router counts every repo in the billing API, Windows x2 and macOS x10, plus the jobs running on GitHub now, and sends jobs to this PC at 1700 of the 2000 free minutes. It counted only the private repos before, so GitHub cancelled Gradle builds at the cap. `GITHUB_FREE` and `GITHUB_MARGIN` replace `GITHUB_BUDGET`.
- **Runner order** jobs build on Blacksmith, then Oracle, then GitHub runners while their free minutes last, then on this PC. A third lane, `CI_WINDOWS_RUNNER`, takes the Windows builds to Blacksmith Windows or `windows-latest` first. The Cloud card shows the GitHub minutes of the private repos, read from the billing API with a stop at 1800 of 2000.

- **CI** Release waits while a PR of an agent session is open, so the last merge of a batch releases them all.
- **Rust cache** the setup installs sccache and sets `RUSTC_WRAPPER` in the global mise env. A second worktree of `property-trends` got 136 of 151 crates from the cache. Run `windows\defender-exclusions.ps1` again to exclude its folder.
- **Demo** the demo releases show Tick-a-Lot as the app spells it.

- **Screenshots** the README shows the status page, the latest runs and the releases. `mise run demo` takes them again.
- **Docs** each heading of `docs/features.md` links its spec, and each feature that had no spec got one.
- **Cloud runners first** CI jobs build on an Oracle Always Free VM and on Blacksmith while their free minutes last, then on this PC. The status page sets the org variables `CI_RUNNER` and `CI_HEAVY_RUNNER` each minute, and a Cloud card shows the routes and the Blacksmith minutes of the month. `runner/oracle.sh` installs the Oracle runner over SSH.
- **Repo variables** the cloud router writes `CI_RUNNER` and `CI_HEAVY_RUNNER` into each private repo. GitHub Free hides org variables from private repos, so jobs read the fallback and built on the PC.
- **Cloud runners first** CI jobs build on an Oracle Always Free VM and on Blacksmith while their free minutes last, then on this PC. The status page sets `CI_RUNNER` and `CI_HEAVY_RUNNER` in each private repo, and a Cloud card shows the routes and the Blacksmith minutes of the month. `runner/oracle.sh` installs the Oracle runner over SSH.
- **Machine column** each run in Latest runs names the machine its jobs built on: This PC, Oracle, Blacksmith or GitHub. A Cloud filter picks the runs with a cloud job, and the live jobs name the machine too.

- **Runner watchdog** a Windows runner that GitHub shows offline while its task runs gets a restart. The update task checks every 5 minutes, and `START.cmd` checks on each double click. On 2026-11-01 all 8 runners sat offline for 12 hours with their tasks Running.
- **Update with local edits** the update task stashes an edited `TODO.md` in the checkout during the move to a new release, where the edit stopped every update before.

- **Markdown** markdownlint-cli2 lints the docs in `mise run lint` and CI.

- **Open source** the repo gets an MIT `LICENSE` and runs its own CI on GitHub runners: Checks on `windows-latest` for pushes and PRs, Release on `ubuntu-latest`. The PC installs each release through the update task within 5 minutes, so Release no longer starts it.

- **Runner priority** the Windows runners stay online while the PC sits at 100% CPU. `Runner.Listener` and `Runner.Worker` start above normal, and their boot task runs at normal priority in place of below normal. Run `runner\install.ps1` again as admin to move existing runners over.

- **Status page start** the `local-ci dashboard` task runs node on Next directly, without mise and pnpm. On a PC at full load `mise x -- pnpm` hung for over 10 minutes, held `dashboard.log` open and made each restart fail.
- **Status page install** a failed build starts the old page again. Before, the page stayed down until the next install worked.

- **Icon** the status page tab and the Startup shortcut show a white loop arrow round a check on a teal to violet gradient. The 10 drafts sit in `design/icons/2026-11-01`.
- **Agent docs** `AGENTS.md` and the `fix-stuck-ci` skill state each rule with MUST, SHOULD or MAY.
- **Status page start** the `local-ci dashboard` task runs at normal priority. At the default low priority, a busy PC kept `next start` from answering for over 19 minutes.
- **Status page install** `dashboard\install.ps1` trusts the repo's `mise.toml` before it builds. An untrusted one failed each install, so the page stayed down and the Start button in Archon showed no page.

- **Architecture decisions** `docs/architecture.md` gets a Decisions section. Each big choice names its reason, its cost and the rivals it beat.

- **Lint and format** the dashboard lints with oxlint and formats with oxfmt, and CI checks both. `mise run lint` runs them with shellcheck and shfmt.

- **Icon** the status page tab and the Startup shortcut show a gold check traced on a green circuit board. The 10 drafts sit in `design/icons/2026-10-31`.
- **Releases tab** the status page gets a Releases tab beside Status. It lists the newest release of each app with its notes, says which app still builds a newer one on `main`, and installs the ticked APKs on the phone over adb one after another.
- **Dashboard** the CI tab of the Workbench launcher shows the status page. `frame-ancestors` lets only the launcher on `http://127.0.0.1:47821` frame it.
- **Claude memory** the review rule names the skill as `%USERPROFILE%\.agents\skills\review\SKILL.md`, a path Windows reads.
- **Start button** the `START.cmd` window shows each installer line as it comes, so a long wait for a runner job shows. A second `runner\install.ps1` run now says one is still going, in place of "Transcription cannot be started".

- **Start button** `START.cmd` installs through the same `windows\update.ps1` as the update task, up to the newest release. It waits while the task installs and adds the task on the first double click.
- **Updates by themselves** the Windows PC installs each new release. Release starts the `local-ci update` task, which moves the checkout to the new tag and rebuilds the status page or the runners when their files changed. Run `dashboard\install.ps1` once to add the task.
- **Dashboard** the Release column shows each run's release again. It matched releases by the date of the tagged commit, which is the same for all of them.
- **Releases** a release built on the PC carries the Sydney date again. Before 11:00 in Sydney it got the day before.
- **Releases** each push to `main` that passes Checks gets a GitHub release such as `v2026.10.30.1`. Its notes list the commits since the release before.
- **Dashboard tooling** TypeScript 7.0.2 and `@types/node` 26.6.5 for the status page. Typecheck, tests and the build pass.

- **Default branch** the repo now uses `main` in place of `master`. CI runs on pushes to `main`.

- **Faster action cache** `runner\cache-actions.ps1` reads the Worker logs
  from each runner's `_diag` folder. It walked all of `~/actions-runner`
  before, which took 203 s of each `runner\install.ps1` run.
- **Faster downloads** `runner\install.ps1` and `runner\cache-actions.ps1`
  turn off the Windows PowerShell progress bar, which made a download about
  10 times slower.
- **Count messages** the Runners card names `runner\install.ps1` with its
  backslash after Apply. It read `runnerinstall.ps1` before.
- **CI** `actions/checkout` is pinned to its v7 commit, since the checks run
  on the PC that keeps an admin token.

- **Heavy lane** the first 2 Windows runners carry the `heavy` label, and
  `runner\install.ps1` fixes the label on GitHub for runners registered
  earlier. Jobs that run Gradle, Cargo or Tauri ask for it, so at most 2 of
  them share the PC. With 8 at once a keeppad release took 50 minutes.
- **Action cache** the runners copy action zips from the shared folder
  `~/actions-runner/_actions-cache`, so "Set up job" no longer downloads
  them on every job. The runner only reads the folder:
  `runner\cache-actions.ps1` fills it through the GitHub API, and
  `runner\install.ps1` runs it.
- **Android SDK** the runners read the SDK from `C:\Android\Sdk`, and
  `runner\install.ps1` copies it there from `%LOCALAPPDATA%` on the first
  run. Claude Desktop redirects `%LOCALAPPDATA%` writes into its own
  folder, so SDK parts installed from a Claude session were invisible to the
  runners, and every Expo release build failed on `minifyReleaseWithR8`.
  The script also points `ANDROID_HOME` in `~/.config/mise/config.toml` at
  the new folder, since `mise-action` exports it over the runner `.env`.
- **Releases** the dashboard links runs of the `memories` repo to the `memories-mobile-v*` and `media-organizer-v*` releases. The repo was renamed, and its apps kept their release names.

- The admin window of `runner\install.ps1` stays open on an error, with the
  line that failed, and each run writes `~/actions-runner/install.log`. It
  closed at once before, so the error was lost.

- **Defender** `windows/defender-exclusions.ps1` holds every Defender exclusion and runs alone. It adds `~/.cargo`, `~/.rustup`, the repos folder and the media-organizer build folder to the list.
- **CI** runs on pushes to main only. PR runs are off, and the workflow says how to turn them back on.
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
