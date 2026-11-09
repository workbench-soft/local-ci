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
