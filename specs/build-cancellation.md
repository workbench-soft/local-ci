# Build cancellation

## One-pager

- **Problem** a build can stop without a replacement or a useful reason.
- **Fix** replace builds only within one repo, workflow and branch when a different commit starts that build type.
- **Checks** app repos build Release beside Checks, and failed Checks stop the releases of that same commit.
- **History** save each cancellation request, its result and the causing run, commit and PR before stopping a build.
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
