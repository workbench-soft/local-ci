# User flows

## Set up a new Mac

1. Clone `workbench-soft/local-ci`, with a GitHub token as the password.
2. Run `./local-ci/install.sh`.
3. Give the git name and email when the script asks, then log into `gh`.
4. Say yes or no to the runner question.

```mermaid
flowchart TD
  A[git clone local-ci] --> B[install.sh]
  B --> C[Homebrew, mise, Oh My Zsh]
  C --> D[gh auth login]
  D --> E[clone and install the repos]
  E --> F{register a runner?}
  F -- yes --> G[runner/install.sh]
  F -- no --> H[done]
  G --> H
```

## Set up a new Windows PC

1. Install Git: `winget install Git.Git`.
2. Clone `workbench-soft/local-ci`, with a GitHub token as the password.
3. In PowerShell, run `.\local-ci\install.ps1`.
4. Give the git name and email when the script asks, then log into `gh`.
5. Say yes or no to the runner question.

```mermaid
flowchart TD
  A[git clone local-ci] --> B[install.ps1]
  B --> C[winget, mise, PowerShell profile]
  C --> D[gh auth login]
  D --> E[clone and install git-aliases, agent-skills]
  E --> F{register a runner?}
  F -- yes --> G[runner/install.ps1]
  F -- no --> H[done]
  G --> H
```

## Register a machine as a runner

1. Run `runner/install.sh` on a Mac, or `runner\install.ps1` on Windows.
   Set `RUNNER_COUNT` first for another number of runners.
2. Paste a registration token if the script asks for one.
3. Look under the org's Actions runners: each new runner shows as Idle.

```mermaid
flowchart TD
  A[runner script] --> B{each runner registered?}
  B -- all --> Z[print their state]
  B -- some missing --> C[download once, check SHA256]
  C --> D{gh gives a token?}
  D -- no --> E[person pastes a token]
  D -- yes --> F[config with labels]
  E --> F
  F --> G[start each: launchd or boot task]
```

## See the CI status

1. From the main checkout, run `.\dashboard\install.ps1` once.
2. Approve the admin prompt. The script builds the page and registers the
   `local-ci dashboard` task.
3. The browser opens `http://localhost:4280` once the page answers. It opens
   again at each logon.
4. Read the headline: how many jobs build on this PC and how many wait on
   GitHub. The Now card lists those jobs.
5. In Latest runs, pick a filter chip, type in the search box or click a
   column head to sort.

```mermaid
flowchart TD
  A[dashboard/install.ps1] --> B[pnpm install, pnpm build]
  B --> C[gh auth token into .env.local]
  C --> D[task at boot: start.cmd]
  D --> E[next start on 127.0.0.1:4280]
  A --> S[shortcut in the Startup folder]
  A & S --> O[open.ps1 waits for the port]
  E --> O
  O --> F[browser shows localhost:4280]
  F --> G[page refreshes every 15 s]
```
