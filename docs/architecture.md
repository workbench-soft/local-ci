# Architecture

local-ci is a set of scripts, plus one local web page. Each script runs on the
machine it sets up and talks to package managers and GitHub. The page in
`dashboard/` shows the runner and the latest runs.

## Modules

- **`install.sh`** sets up a Mac with Homebrew, mise, Oh My Zsh and the repos.
- **`install.ps1`** sets up Windows with winget, mise and the repos.
- **`runner/install.sh`** registers a Mac as a GitHub Actions runner.
- **`runner/install.ps1`** registers a Windows PC as a GitHub Actions runner.
- **`dashboard/`** a Next.js app with the CI status page, started at boot by
  `dashboard/install.ps1`.
- **Data files** `mcp-config.json` and `claude/MEMORY.md`, copied into the home
  folder when missing.

```mermaid
flowchart LR
  sh[install.sh] --> brew[Homebrew]
  ps[install.ps1] --> winget[winget]
  sh & ps --> mise[mise: node, pnpm, yarn]
  sh & ps --> gh[gh: login, clone repos]
  gh --> repos[git-aliases, agent-skills, gh-review-notify on Mac]
  sh --> rsh[runner/install.sh]
  ps --> rps[runner/install.ps1]
  rsh & rps --> gha[GitHub: workbench-soft runners]
```

## Outside services

| Service | Used for |
| --- | --- |
| Homebrew, winget | tools and apps |
| npm through mise | the Copilot CLI and agent-browser |
| GitHub API | the clones, the runner release and its registration token, the runners and runs on the status page |
| `github.com/actions/runner` releases | the runner download and its SHA256 |

## How a runner gets a job

```mermaid
sequenceDiagram
  participant S as runner/install
  participant G as GitHub
  participant R as runner on the machine
  S->>G: latest release and SHA256
  S->>G: registration token (or the person pastes one)
  S->>R: config with labels, then launchd or a logon task
  R->>G: long poll for jobs
  G-->>R: a job whose runs-on matches the labels
```

## How the status page gets its data

The page renders on the server for each request. `lib/local.ts` reads this PC,
`lib/github.ts` reads GitHub with the token from `.env.local`. GitHub answers
stay in memory for 20 seconds.

```mermaid
sequenceDiagram
  participant B as browser
  participant N as next start (dashboard)
  participant W as Windows
  participant G as GitHub API
  B->>N: GET / every 15 s
  N->>W: Get-ScheduledTask, tasklist, _diag/Worker_*.log
  N->>G: org runners, org repos, 5 runs per repo
  N-->>B: HTML with the headline, cards and runs
```
