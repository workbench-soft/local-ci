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

## Get a new version installed

1. A PR merges into `main`.
2. Checks run. Release starts once they pass on this commit.
3. Within 5 minutes the `local-ci update` task on the Windows PC runs.
4. The task moves the checkout to the new tag.
5. The task rebuilds the status page or reinstalls the runners when their
   files changed. `~/.local-ci/update.log` lists what ran.

```mermaid
flowchart TD
  A[PR merges into main] --> B[Checks runs]
  B -- passed --> C[Release starts on workflow_run, tags and publishes]
  B -- failed --> X[no release]
  T[every 5 minutes, at logon] --> E
  C -.-> E[windows/update.ps1 moves the checkout to the tag]
  E --> F{dashboard/ changed?}
  F -- yes --> G[dashboard/install.ps1 -Unattended]
  F -- no --> H
  G --> H{runner files changed?}
  H -- yes --> I[runner/install.ps1]
```

## Start the CI with a double click

1. Open the `local-ci` folder in Explorer.
2. Double click `START.cmd`.
3. A window shows the release on disk. When the update task is installing,
   the window waits for it.
4. When the page or runner code changed, an admin prompt opens and the
   installer runs. The first run also adds the update task.
5. The window lists each runner and the page as running or started.
6. The browser opens `http://localhost:4280`. The window closes on its own,
   and stays open on an error.

```mermaid
flowchart TD
  A[START.cmd] --> B[windows/start.ps1]
  B --> L{update task installing?}
  L -- yes --> W[wait for it]
  W --> P
  L -- no --> P[windows/update.ps1 moves to the newest release]
  P --> C{page or runner code changed?}
  C -- yes --> D[installer runs, admin prompt]
  D --> E
  C -- no --> E[add the update task if missing, start stopped tasks]
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
   GitHub. The Running now card lists those jobs.
5. In Latest runs, pick a filter chip, type in the search box or click a
   column head to sort.
6. Press Stop on a run or a job to cancel its run. The button reads
   Stopping, then Stopped, and its runner takes the next job. Press Purge
   and confirm to stop the run and delete it from GitHub. An error shows beside the buttons.
   To clear many runs, pick a filter or type a search, press Purge all and
   confirm. Its rows turn gray, and older runs move up and go too, until none
   match. The count of purged runs and the first error show beside it.
7. A failed run names its failed job and step. Click it to read the log.
   Click the time in Took to see how long each job and step took.
8. Plug the phone in over USB with USB debugging on. Press Install Release in
   the Release column. The button says the device, or shows adb's error in red.
   For several apps, read the Releases tab, the one the page opens on: each
   app says whether its release builds, waits, failed or was cancelled. A
   building app shows a progress bar and the time left. Read what changed
   under Changes, tick the apps and press Install. Each row says Installed or
   shows adb's error.
9. On the Releases tab, act on one app:
   - **Install Dev** installs the release, then unlocks the app's developer
     settings on the phone. Open Install Dev: WORKBENCH_DEV_KEY first when the
     tab says the key is missing.
   - **Release on CI** starts the app's release workflow on `main`. Force stop
     ends it.
   - **Build locally** builds the latest `main` on this PC. Install local
     then sends its APK to the phone.
   - **Rerun build** or **Retry failed jobs** runs an errored release again.
10. To free GitHub Actions storage, press **Clean old APK releases &
    artifacts**. The page counts what goes and what stays, then asks to
    confirm. Cleanup runs in small batches with progress. Runs, logs and the
    newest APK of each app stay.
11. Click the branch or the PR link to open it on GitHub. Open Cancellation
    history on either tab to read a saved stop reason. Follow its links to
    the replacement build, failed Checks, commit or PR.
12. To change the number of runners, type it in Runners on this PC, or press
    Use with the suggested count. Press Apply, and watch
    `runner\install.ps1` add or remove runners in its window.

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
  H -- Stop --> I[Stopping: force cancel] --> I2[Stopped: the runner takes the next job]
  H -- Purge, confirmed --> J[force cancel, wait, delete the run]
  H -- Purge all, confirmed --> P[gray the rows, purge them 5 at a time, reload, repeat until none match]
  H -- Install --> K[adb devices, download the APK, adb install]
  K --> L[installed on the device, or adb's error in red]
  F --> RT[Releases tab, open by default: each app's release state, its wait, the cancel reason]
  RT -- tick apps, Install --> K2[one install after another] --> K
  RT -- Install Dev --> DV[install the APK, send the unlock link over adb]
  RT -- Release on CI --> DS[dispatch the app's release workflow on main]
  RT -- Build locally --> LB[build the APK in a temporary clone] --> LI[Install local]
  RT -- Clean, confirmed --> CL[delete old artifacts and APK releases in batches]
  H -- Apply runner count --> R[write runner-count, start the count task]
  R --> T[runner/install.ps1 as admin adds or removes runners]
  I & J & P & T --> G
```
