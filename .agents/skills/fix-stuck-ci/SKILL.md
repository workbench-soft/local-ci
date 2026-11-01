---
name: fix-stuck-ci
description: Use when a workbench-soft CI run sits in "queued", a runner is offline, every runner is busy, a job fails on the self-hosted runner but not on a laptop, or the user asks what CI is doing right now. Lists the runners and every waiting or running run across the org, then restarts the runners, cancels stale runs or reads the runner logs.
---

# Fix stuck CI

The `workbench-soft` repos build on the self-hosted Windows runners of this PC. The agent SHOULD read "CI runner" in `README.md` for how they are set up.

## 1. See the state

The agent MUST first print the state:

```sh
sh .agents/skills/fix-stuck-ci/ci-status.sh
```

The agent MUST read its output: each runner with its status, then each run that waits or runs, in every repo of the org.

## 2. Act on what it shows

The agent MUST act on each row that matches the output:

| It shows | Do |
| --- | --- |
| A runner `offline` | Ask the user to double click `START.cmd`. It starts each runner task and the status page. |
| Each runner `busy`, runs `queued` | The runs wait their turn. Cancel stale ones from step 3, or raise the count on the Runners card of <http://localhost:4280>. |
| A run `in_progress` for hours | Read its log, then cancel it: `GH_PAGER=cat gh run cancel <id> -R workbench-soft/<repo>`. |
| No runner listed | The token lacks `admin:org`. Run `gh auth refresh -s admin:org`. |

## 3. Cancel stale runs

A run for an older commit of the same branch is stale once a newer one is queued. Most workflows cancel those by themselves. The agent MUST cancel the rest:

```sh
GH_PAGER=cat gh run cancel <id> -R workbench-soft/<repo>
```

## 4. A job fails only on the runner

1. The agent MUST read the failed step: `GH_PAGER=cat gh run view <id> -R workbench-soft/<repo> --log-failed`.
2. The agent MUST check the runner's own log in `~/actions-runner/workbench-soft/_diag/`, the newest `Worker_*.log`.
3. The usual causes are a path over 260 characters, a tool missing from mise or the Android SDK, or a file another job holds open. A fix to the runner MUST go into `runner/install.ps1`, and the user reruns it.
4. A failure that also shows on the default branch MUST go into `TODO.md` of that repo.
