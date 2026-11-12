# Build cancellation

## One-pager

- **Problem** a build can stop without a replacement or a useful reason.
- **Fix** replace builds only within one repo, workflow and branch when a different commit starts that build type.
- **Checks** app repos build Release beside Checks, and failed Checks stop the releases of that same commit.
- **History** save each cancellation request, its result and the causing run, commit and PR before stopping a build.
- **GitHub first** Checks and Release set `concurrency`, so GitHub cancels the older run when a newer push starts, with the PC off too. The sweep stops the runs GitHub leaves.
- **Stays up** the sweep runs inside the status page, so an update builds the new page beside the running one and swaps them in seconds.
- **Limits** external cancellations without evidence remain unattributed.

## Behaviour

A newer push or dispatch replaces an active run of the same repo, workflow
and branch only when the commits differ. Identified PRs keep separate scopes
so forks with the same branch name cannot stop each other. Closing a PR alone stops no build.
A run with no commit id keeps building. Manual reruns of the same commit
are not replacements. Other products and build types keep running.

In the app repos, Release builds on the push beside Checks and publishes
once Checks pass. A failed Checks run, or a failed job in it, stops active
release workflows of the same repo, branch and commit. A release workflow
with its checks as a job of its own, such as `Deploy` of spotthecam, stops
when that job fails. local-ci itself starts Release only after Checks pass.
The dashboard does not infer a dependency from an unrelated workflow failure.

A cancel GitHub refuses waits before its next try: 20 s, 40 s, 80 s and so on
up to 5 minutes. The wait ends when the run finishes or the server restarts.

A run that waits for a runner is active too, so a newer run stops it in the
queue. A `workflow_run` run replaces no build: GitHub stamps it with the
newest commit of `main`, which can belong to another product of the repo.

## GitHub cancels first

Checks and each Release that builds on a push set a workflow `concurrency`
with `cancel-in-progress: true`, from the `repo-ci` templates.

- **Group** the workflow name with the PR number or the branch. Release,
  Shuttrix release and Desktop release of `memories` have 3 groups.
- **`workflow_run`** such a Release run takes its run id as the group. It
  publishes its commit, and a newer push leaves it alone.
- **Left alone** a workflow that uploads or deploys in the run of the push
  keeps `cancel-in-progress: false`.
- **Log line** the sweep finds a run that ended as cancelled within 5 minutes
  after a newer commit started the same build. It writes the newer run as
  the cause, so the row says why. A run a person cancelled in that window
  gets the same line.
- **Sweep** it still stops the runs of a merged PR, the repos without the
  block and a release whose Checks failed.

## The sweep stays up

The sweep runs every 10 s inside the production status page. While the page
is down, only GitHub cancels a run.

- **Update** `dashboard\install.ps1` builds the new page into its own folder,
  `.next-a` or `.next-b`, while the old page serves and sweeps. It stops the
  old page only once the build is done, then starts the new one.
- **Failed build** the old page keeps running.
- **Dead page** `windows\update.ps1` starts the page task when no process
  listens on the page's port. The task runs it every 5 minutes.

## Cancellation history

The JSONL cancellation log stores the reason, causing run ID and URL,
commit SHA, branch and any PR links. Each request is durable before the
GitHub call. Accepted and failed requests receive separate result records.
Logging failures prevent automatic cancellation. A later request can recover
after a temporary logging error. Status and Releases show linked evidence.
The first accepted cancellation remains the cause; later retries cannot overwrite it.
Manual stops record that the page requested them. External cancellations
without evidence show an unknown cause rather than an invented cause.
If the publication guard stops a release before the sweep, the history records
the blocked publication and links the matching failed checks without another
cancellation request. Busy repos retain check results and replacements for
their active commits even past the displayed recent-run limit.

## Changes

### 2026-11-05 scope cancellation and record its cause

- **Changes** cancellation selection, commit metadata, durable history and linked reasons on both dashboard tabs.
- **Steps** spec, selection and log tests, server actions, dashboard and docs, workflow rollout.
- **Docs** README, architecture, features, user flows and changelog.

### 2026-11-10 a refused cancel backs off

- **Problem** on 2026-11-09 GitHub answered 409 to the cancel of one run for 6 h 22 min. The sweep tried every 10 s: 2204 calls, 4408 log lines, 1.6 MB of the 2 MB log.
- **Changes** `status/superseded.ts` holds the wait per run, and `status/cancel-superseded.ts` skips a run until its wait is over. The same 6 hours now take 80 tries.
- **Docs** architecture and features.

### 2026-11-12 the sweep stays up while the page updates

- **Problem** on 2026-11-11 at 13:39 UTC `dashboard\install.ps1` stopped the page, then built the new one. All 8 runners were busy, so the build took over an hour. In that hour no run got cancelled: 3 memories releases of commit `274768b` and 2 of `8f8f591` held runners while newer commits waited, and Farnear Checks sat in the queue for 20 minutes. `update.log` shows the stop at 00:39:40 local time, and `cancel-reasons.jsonl` has no line after 13:36:05 UTC.
- **Not the rules** `replacementRuns` picks each of those runs as replaced by the newer `push` run of its workflow. GitHub got no cancel request, so no 409 was in play.
- **Changes** `dashboard/next.config.ts` reads the build folder from `NEXT_DIST_DIR`. `dashboard/install.ps1` builds into the folder the running page doesn't use, writes it to `start.cmd`, and stops the old page after the build. `windows/update.ps1` starts the page task when the port is silent.
- **Test** `dashboard/status/install-order.test.ts` fails when the install script stops the page ahead of the build.
- **Docs** README, architecture, features and changelog.

### 2026-11-12 GitHub cancels the older run too

- **Problem** the fix above keeps the sweep up through an update, but the sweep still needs the PC. The owner wants the cancel in the CI logic.
- **Changes** the `repo-ci` templates of `agent-skills-private` set `concurrency` with `cancel-in-progress: true` in Checks and in the Release that builds on a push. `farnear`, `memories` and the other org repos take the block. `checks.yml` of this repo takes it too. The sweep code stays as it is.
- **Test** on 2026-11-11 at 15:07:20 UTC a second push to `farnear` followed the first. GitHub cancelled Release run 43044782163 of the first commit at 15:07:24, and `cancel-reasons.jsonl` has no line for it. Checks run 43044782120 got both: GitHub held the new run as pending, and the sweep sent its own cancel at 15:07:39.
- **Docs** architecture, features, README and changelog.

### 2026-11-12 a run GitHub cancelled gets its cause

- **Problem** a run GitHub cancels through `concurrency` had no line in `cancel-reasons.jsonl`, so its row showed an unknown cause.
- **Changes** `status/superseded.ts` gets `cancelledByGitHub`: a run that ended as cancelled up to 5 minutes after a newer commit started the same repo, workflow and branch. `status/cancel-superseded.ts` writes one `accepted` line for each such run without a line, with the newer run as the cause. It sends no request to GitHub.
- **Test** `status/superseded.test.ts` covers the match, the 5 minute window and a run of the same commit.
- **Docs** architecture, features and changelog.
