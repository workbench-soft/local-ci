# Changelog

## Unreleased

- **Metrics in each card** each app on the Releases tab and each site shows its runs, failed share and usual time over 30 days, each run in Latest runs its usual time with a mark when slower than 9 in 10, the Runners card each machine's failures and wait, and the Trends tab link the failed share of the last 7 days.
- **Trends tab** the status page charts the org's CI for free: runs a day by result, the share that failed, the build time, the wait for a runner, the steps that fail most and each machine, for one repo or all and for 7, 30 or 90 days. The page keeps 90 days of runs in `dashboardun-history.json`.
- **Why a release stopped** each errored or cancelled row on the Releases tab says what happened: the error line and the log of the failed step, the run that replaced it, a stop by Local CI, a PC turned off, a full disk or a timeout.
- **Oracle VM by script** `runner/oracle-vm.sh` creates the Oracle VM, retries while Sydney has no free host, and installs the runners once it is up. A fresh VM waits for its first apt updates before the runner install. The VM gets `gh` too.
- **Cause of a GitHub cancel** a run GitHub cancelled for a newer commit now shows that commit as the cause in the cancellation history.

- **Mac setup goes on** an app already in `/Applications`, a failed npm or twg install or a missing `code` command no longer stops `install.sh` before the repos. The last lines list what it skipped.
- **Voice on a Mac** the README says a Mac gets the spoken turn end of agent-skills too.
- **One line for a fresh Mac** the README gives one Terminal line too. `install.sh` puts the mise shims on its own PATH, so agent-skills finds node and adds its hooks, and finds brew on an Intel Mac.
- **One line for a fresh Windows** the README gives one PowerShell line that installs Git when it is missing, clones local-ci and runs the installer, which brings git-aliases and agent-skills with its hooks.
- **GitHub cancels old runs too** Checks and Release of the org repos set `concurrency` with `cancel-in-progress: true`, so a newer push cancels the older run with the page off. The sweep stays for the runs GitHub leaves, such as those of a merged PR.

- **Long lists scroll in their card** the Releases and Sites lists and the cancellation history stop at 60% of the window and scroll. The headline and the tabs stay on top while the page scrolls.

- **Old builds stop during an update** `dashboard\install.ps1` builds the new page beside the running one and stops the old page only for the swap. On 2026-11-11 the page was down for over an hour of building, and stale memories releases held all 8 runners. The update task also starts a page that died.

- **Deploy site** a Sites card on the Releases tab lists each org repo with a site, its last deploy and a button that starts its deploy workflow on `main`. The page finds the workflow in each repo, so no list is kept by hand.

- **Install while jobs run** `runner\install.ps1` keeps the jobs' `C:\ci\_mise\bin\mise.exe` when a job holds it, in place of stopping before the runners get their new settings.

- **gh retries more, and faster** the CI `gh` wrapper also retries a host name that didn't resolve, runs a call that reads a field from stdin (`-F body=@-`) once, and starts each call about half a second sooner.

- **Faster Status tab** the Status tab skips the release workflow lookup that only the Releases tab shows.

- **Next.js 16.4.6** the page moves past the 16.4.5 security release.

- **Scripts in lint** `mise run lint-scripts` holds the one list of scripts that CI and `mise run lint` check, now with `runner/gh` and the pre-push hook. `runner/install.sh` runs on a Mac without `chmod`.

- **Lint before the push** a pre-push hook runs `mise run lint`, so a lint or format error stays on the PC instead of failing Checks on `main`.

- **Release on CI for every app** each app on the Releases tab gets the button, and the hand kept `release-config.ts` is gone. The page takes the workflow whose run published the app's newest release, so a release of the latest `main` starts again even when that commit is already out. Build locally shows for each clone with `scripts/build-apk.sh`.

- **Half installed tools** the job hook removes an npm tool in `C:\ci\_mise` that has no `node_modules` after 15 minutes, so the job installs it again. A full disk left oxfmt that way and failed lumiere-player. `runner/install.ps1` also puts mise in `_mise\bin`, so the first jobs no longer download it at once.

- **gh retries** bash steps on the Windows runners get `runner/gh` first on PATH. It retries a call that never reached GitHub, a TLS handshake timeout or a refused connect, 4 times. Two skyaltar releases stopped on one such timeout.

- **Jobs keep their own mise** the runners install their tools in
  `C:\ci\_mise` from `runner/mise-ci.toml`. A tool a session on the PC held
  or swapped, such as an MCP server, failed CI jobs with "being used by
  another process". Run `runner/install.ps1` again to switch.

- **Quiet clean** a work folder a process holds stays for a later job with
  one plain line, in place of a red `Rename-Item` error in every job log.

- **Reruns keep their release** a rerun on GitHub keeps the run id, and the
  page kept the failed jobs of the first attempt. Checks that passed on the
  rerun then read as failed, and the sweep cancelled the release. The page
  now reads the jobs of the new attempt.

- **Refused cancels wait** a force cancel GitHub refuses waits 20 s, 40 s, up
  to 5 minutes before each try. One run got 2,204 tries in 6 hours and filled
  1.6 MB of `cancel-reasons.jsonl`.

- **CLEAN-CI restarts the runners** `windows\clean-ci.ps1` skips a work folder
  a process holds and starts the runner tasks even when a move fails.

- **Buttons and installs** Stop, Purge and Apply show an error when the page
  server is down. Install deletes its APK from `%TEMP%\local-ci-apk` once adb
  ends.

- **Faster page** a render shows the kept runner read while PowerShell runs
  again, and an unchanged cancel log is parsed once.

- **Screen readers** button names carry their state and their app, step
  results reach a screen reader, the Cloud meters have names, and progress
  bars stop sliding under reduced motion.

- **Release scripts** release notes drop the `Co-Authored-By` line, and
  `next-version.sh` fails without a date.

- **CI** Checks runs shellcheck on `runner/oracle.sh`, the release scripts and
  `ci-status.sh`. Each job stops after 10 minutes, and the type check rejects
  fallthrough, missing returns and silent overrides.

- **fix-stuck-ci skill** the table covers idle runners beside queued runs and
  an org with no runner, and names the log folder of each runner.

- **Runner pnpm store** on Windows each runner's `.env` points pnpm at
  `C:\ci\_pnpm-store` and copies packages, which ends the `EBUSY` failures of
  `expo export` and `pnpm install`.

- **One trash delete per runner** each job start launched one more delete of
  the runner's `_trash-*` folders at idle priority. About 530 piled up, starved,
  and the trash and the low disk stayed. Now one delete per runner runs at a
  time, at below normal priority.

- **Docs match the code** the README, the docs and the specs describe Release
  after Checks, Install Dev, release progress, storage cleanup and the cancel
  reasons the sweep writes. Build cancellation gets its own feature section.

- **Install Dev for every app** the button now shows on each release:
  the app id comes from the tag, such as `lumiere-v*` to
  `com.workbenchsoft.lumiere`. A new app needs no line in local-ci.

- **CI** Release starts on `workflow_run` once Checks pass on `main`, one at a time. It no longer holds a PC runner while it waits, which starved Checks and timed releases out.

- **Releases card in parts** the 430 line card splits into the list, one
  app row, its buttons and its detail line. The page looks the same.

- **SpotTheCam developer install** releases tagged `spotthecam-v*` get the
  Install Dev button again, like the older `speed-camera-map-v*` ones.

- **Cancel reasons** Stop and Purge write each reason once, through the same
  logger the sweep uses. The local APK install is no longer a server action
  the browser can call with any file path.

- **One release at a time** two pushes to main close together no longer
  pick the same version tag. The later release waits for the earlier one.

- **GitHub storage cleanup** the Releases tab can preview and confirm removal
  of completed Actions artifacts across the org and older APK releases in the
  shared releases repository. The newest published APK per app stays; active
  build artifacts, run logs, non-APK releases, drafts and prereleases stay.
  Deletion runs in small batches with progress and error reporting.

- **Local APK installation** build tokens accept UUID digits, so a newly built
  APK can be installed instead of showing an expired-build error.

- **Cancellation evidence in busy repos** active builds retain their matching
  checks and replacement runs beyond the recent-run display limit. A release
  stopped by its publication guard links the failed checks in cancellation history.

- **Build cancellation** only a different commit building in the same repo,
  workflow and branch replaces an active run. Closing a PR keeps its build.
  Failed Checks stop releases of the same commit. Both tabs show saved
  cancellation evidence with links to the causing run, commit and PR.
- **Parallel release builds** Release starts alongside Checks on pushes to
  main. Publication waits for matching Checks. Open PRs hold no release.

- **Manual and local app releases** the Releases tab can dispatch a supported
  app release on CI, build the latest `main` of supported Android apps in a
  temporary clone, and install the local APK over ADB. Published APK installs
  stay available.
- **Releases tab first** the page opens on the Releases tab, with Status one
  click away at `/?tab=status`. Each app shows the state of its release:
  released, building, queued, errored, cancelled, held while a session PR is
  open, or no release yet. A building or queued row says how long the run
  took and how long until the release, from the usual life of its workflow.
  A cancelled row says why: each force cancel writes its reason to
  `dashboard\cancel-reasons.jsonl`, from Stop and Purge or from the sweep.
  An app with no release yet shows from its repo's runs.
- **Clean scripts in step** `AGENTS.md` names what must change in the clean scripts, and a test fails when `runner/install.ps1` moves the work root, the org or the task names without them.
- **Work folder clean** each Windows runner deletes its old repo checkouts in `C:\ci` before a job, and `CLEAN-CI.cmd` empties `C:\ci` by hand. `C:\ci` had grown to about 200 GB.
- **Root folder** the scripts read the workspace root from `WBS_ROOT`, then `DEV_DIR`, then the folder that holds the clone. No script holds a fixed path.

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
  failed on a `.bat` path past 260 characters under `~\actions-runner`.

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
