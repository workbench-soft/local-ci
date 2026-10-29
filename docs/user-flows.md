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

## Start the CI with a double click

1. Open the `local-ci` folder in Explorer.
2. Double click `START.cmd`.
3. A window lists each runner and the page as running or started.
4. The browser opens `http://localhost:4280`. The window closes on its own,
   and stays open on an error.

```mermaid
flowchart TD
  A[START.cmd] --> B[windows/start.ps1]
  B --> C{page task exists?}
  C -- no --> D[dashboard/install.ps1]
  C -- yes --> E[start stopped runner and page tasks]
  E --> F{Windows refused?}
  F -- yes --> G[admin prompt, start again]
  F -- no --> H[dashboard/open.ps1 opens the page]
  G --> H
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
6. Press Stop on a run or a job to cancel its run. Press Purge and confirm to
   stop the run and delete it from GitHub. An error shows beside the buttons.
   To clear many runs, pick a filter or type a search, press Purge all and
   confirm. The count of purged runs and the first error show beside it.
7. A failed run names its failed job and step. Click it to read the log.
   Click the time in Took to see how long each job and step took.
8. Plug the phone in over USB with USB debugging on. Press Install in the
   Release column. The button says the device, or shows adb's error in red.
9. Click the branch or the PR link to open it on GitHub.

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
  F --> H{button}
  H -- Stop --> I[GitHub cancels the run]
  H -- Purge, confirmed --> J[force cancel, wait, delete the run]
  H -- Purge all, confirmed --> P[purge every matched run, 5 at a time]
  H -- Install --> K[adb devices, download the APK, adb install]
  K --> L[installed on the device, or adb's error in red]
  I & J & P --> G
```
