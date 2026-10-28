# User flows

## Set up a new Mac

1. Clone `workbench-soft/local-ci` with a GitHub token.
2. Run `./local-ci/install.sh`.
3. Type the git name and email when asked, then log into `gh`.
4. Answer the runner question.

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
2. Clone `workbench-soft/local-ci` with a GitHub token.
3. Run `.\local-ci\install.ps1` in PowerShell.
4. Type the git name and email when asked, then log into `gh`.
5. Answer the runner question.

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

1. Run `runner/install.sh` on a Mac or `runner\install.ps1` on Windows.
2. Paste a registration token if the script asks for one.
3. Check the runner shows as Idle under the org's Actions runners.

```mermaid
flowchart TD
  A[runner script] --> B{already registered?}
  B -- yes --> Z[print its state]
  B -- no --> C[download, check SHA256]
  C --> D{gh gives a token?}
  D -- no --> E[person pastes a token]
  D -- yes --> F[config with labels]
  E --> F
  F --> G[start: launchd or logon task]
```

## See the CI status

1. Run `.\dashboard\install.ps1` once, from the main checkout.
2. Approve the admin prompt. The script builds the page and registers the
   `local-ci dashboard` task.
3. Open `http://localhost:4280`. After a reboot the page is there again.
4. The headline says whether the runner is up, builds or has a queue. The
   cards below show this PC, the org runners and the latest runs.

```mermaid
flowchart TD
  A[dashboard/install.ps1] --> B[pnpm install, pnpm build]
  B --> C[gh auth token into .env.local]
  C --> D[task at boot: start.cmd]
  D --> E[next start on 127.0.0.1:4280]
  E --> F[person opens localhost:4280]
  F --> G[page refreshes every 15 s]
```
