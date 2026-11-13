---
name: fix-stuck-ci
description: Use when a workbench-soft CI run sits in "queued", a runner is offline, every runner is busy, a job fails on the self-hosted runner but not on a laptop, or the user asks what CI is doing right now. Lists the runners and every waiting or running run across the org, then cancels stale runs through the LocalCI Stop button, asks the user to restart runners or reads the runner logs.
---

# Fix stuck CI

The `workbench-soft` repos build on Blacksmith, Oracle and GitHub runners while their free minutes last, then on the self-hosted Windows runners of this PC. The agent SHOULD read "CI runner" and "Cloud runners first" in `README.md` for how they are set up.

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
| Each runner `busy`, runs `queued` | The runs wait their turn. Cancel stale ones from step 3, or raise the count on the Runners card of <http://localhost:4280/?tab=status>. |
| A runner `online` with no `busy`, runs `queued` | The run waits for a label the idle runners lack, such as `heavy` on the first 2 runners, or for a cloud runner. Open <http://localhost:4280/?tab=status>: "Queued on GitHub" names what each job waits for. When "Running now" says a runner sits idle while jobs wait, ask the user to restart that runner's boot task or reboot the PC. |
| A run `in_progress` for hours | Read its log, then press LocalCI Stop so the cancellation reason is saved. |
| `(needs gh with the admin:org scope ...)` under `Runners:` | The token lacks `admin:org`. Ask the user to run `gh auth refresh -s admin:org`, since it waits for a browser login. |
| No line at all under `Runners:` | No runner is registered in the org. Ask the user to run `runner\install.ps1`. |

## 3. Cancel stale runs

A run MUST count as replaced only when a newer push builds a different commit in the same repo, workflow, branch and event. Closing a PR alone MUST NOT cancel it. LocalCI MUST save the causing run, commit and PR before cancellation. LocalCI Stop MUST be the Stop button on the run's row under "Latest runs" of <http://localhost:4280/?tab=status>. The agent MAY press it on a run this step or step 2 finds stale, without asking. The agent MUST use it for a manual stop rather than bypass its history with `gh run cancel`. A runner restart MUST stay with the user, since its boot task runs as admin.

## 4. A job fails only on the runner

1. The agent MUST read the failed step: `GH_PAGER=cat gh run view <id> -R workbench-soft/<repo> --log-failed`.
2. The agent MUST check the log of the runner that took the job, the newest `Worker_*.log` in its `_diag` folder. The first runner keeps `%USERPROFILE%\actions-runner\workbench-soft\_diag\`, and runner N, named `<PC>-N` in step 1, keeps `%USERPROFILE%\actions-runner\workbench-soft-N\_diag\`.
3. The usual causes are a path over 260 characters, a tool missing from the jobs' mise or the Android SDK, or a file another job holds open. Jobs on Windows run their own mise in `C:\ci\_mise`, apart from the PC's tools, so the agent MUST check a tool there. A tool every job needs without a repo pin MUST go into `runner/mise-ci.toml`, and any other fix to the runner into `runner/install.ps1`. The user then reruns `runner\install.ps1`.
4. A failure that also shows on the default branch MUST go into `TODO.md` of that repo.
