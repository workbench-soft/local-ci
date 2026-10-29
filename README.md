# local-ci

One script gives a Mac or a Windows PC the same dev tools. A second script can
then make the machine a self-hosted GitHub Actions runner. CI of the
`workbench-soft` repos then builds there for free. Software that IT manages
stays out of both.

On a Mac:

```sh
git clone https://github.com/workbench-soft/local-ci.git
./local-ci/install.sh
```

On Windows, in PowerShell:

```powershell
git clone https://github.com/workbench-soft/local-ci.git
.\local-ci\install.ps1
```

- **Run it again** each script skips the pieces already in place.
- **Fresh Windows** install Git first: `winget install Git.Git`.
- **Private repo** it sits in the `workbench-soft` org. On a new machine
  `git clone` asks for your GitHub user name, with a token as the password.
- **Old name** the `mac-setup` address redirects here.

## CI runner

The last question of each installer is whether to register the machine as a
runner. The runner scripts also work alone:

| Machine | Script | Labels | Starts |
| --- | --- | --- | --- |
| Mac | `runner/install.sh` | `self-hosted, macOS, ARM64, android, local` | launchd service while logged in |
| Windows | `runner/install.ps1` | `self-hosted, Windows, X64, local` | scheduled task at boot, before anyone logs in |

- **Token** the script gets a registration token from `gh api`. A login
  without the `admin:org` scope gets the runner settings URL to copy a token
  from.
- **Checksum** the script checks the download against the SHA256 in the
  runner release notes.
- **After a reboot** the Windows runner starts at boot as you, before anyone
  logs in. Setting that up takes admin rights, so the script asks Windows once.
- **Git Bash** the task starts `start.cmd`, which puts Git Bash first on PATH.
  Without it `shell: bash` would get the WSL bash from WindowsApps.
- **GitHub access** jobs on Windows see mise and `~/.gitconfig`. The `gh`
  login in the Windows credential store stays out of reach, so use the job's
  `GITHUB_TOKEN`.
- **Several runners** a runner takes one job at a time. Windows gets 4
  runners and a Mac 1, so Windows builds 4 jobs at once. `RUNNER_COUNT` picks
  another number. Jobs speed up only when the workflow splits its work into
  jobs or a `matrix`.
- **Tool cache** the runners share `~/actions-runner/_tool`, so a `setup-*`
  action downloads node, Java or Python once per machine. A rerun of the
  script moves old runners onto it.
- **pnpm store** every job uses the machine's pnpm store through
  `pnpm_config_store_dir`, so `pnpm install` downloads a package once.
- **Defender** on Windows the script excludes `~/actions-runner`,
  `~/.gradle` and the pnpm, npm and mise caches from scans, so
  `pnpm install` runs faster. `RUNNER_DEFENDER_EXCLUSIONS=off` skips it.
- **Folders** the first runner sits in `~/actions-runner/workbench-soft`, the
  next in `workbench-soft-2` and up. `RUNNER_ORG` picks another org.
- **Fewer runners** a lower `RUNNER_COUNT` leaves the extra ones registered.
  Remove one with `.\config.cmd remove` in its folder, then delete its boot
  task.
- **In a workflow** `runs-on: [self-hosted, local]` takes whichever machine is
  on. A job that needs macOS asks for `[self-hosted, macOS]`.

## Start the CI

Double click `START.cmd` in the repo root. It pulls the latest code, rebuilds
the status page when its code changed, starts each runner and the page that
isn't running, then opens `http://localhost:4280`.

- **Admin prompt** shows only when Windows refuses to start a task.
- **First run** without the page task, it runs `dashboard\install.ps1`. Without
  a runner task, it names `runner\install.ps1`.

## CI status page

`http://localhost:4280` shows what builds on this PC and what waits on GitHub.
The page starts with Windows and opens in the browser at each logon. Set it up
once, from the main checkout:

```powershell
.\dashboard\install.ps1
```

- **Shows** the jobs on this PC, the jobs waiting on GitHub for a runner, the
  org runners, and the latest runs with a filter and sorting.
- **Stop and Purge** each run gets a Stop button to cancel it, and a Purge
  button to force cancel it and delete it from GitHub with its logs.
  Purge all, after a confirm, purges every run the filter and search match.
- **Old runs die** the page server force cancels a run that a newer run of
  its workflow and branch replaced, or whose PR is merged or closed. Each
  cancel goes to `dashboard.log`. `CANCEL_SUPERSEDED=off` in
  `dashboard.env.local` turns it off.
- **Release and Install** a run that published a release links to it in the
  Release column. Install puts its APK on the phone plugged in over USB,
  through `adb install -r`. adb comes from `ADB_PATH`, `PATH` or the
  Android SDK.
- **Errors** a failed run names its failed job and step, linked to the log. A
  failed install shows adb's error in a red box under the button.
- **Links** the branch and the PR of each run open on GitHub.
- **Opens** after the install build, and at logon through a shortcut in the
  Startup folder. Delete `local-ci dashboard.lnk` there to stop it.
- **Token** the boot task can't read the gh login, so the script copies
  `gh auth token` into `dashboard\.env.local`.
- **Rerun** after a `git pull` or a new gh login. The script rebuilds the page
  and restarts it.
- **Develop and test** in `dashboard`, `mise x -- pnpm dev` serves the page on
  port 4281. `mise x -- pnpm typecheck` and `mise x -- pnpm test` are the
  checks.
- **Logs** `dashboard\dashboard.log`.

## Windows

[winget](https://learn.microsoft.com/windows/package-manager/winget/) stands in
for Homebrew. It installs git, gh, mise, fzf, jq, shellcheck, shfmt, mkcert,
VS Code, Docker Desktop, Claude and the Android platform tools. npm adds
`agent-browser`.

`install.ps1` leaves out the Mac only pieces:

- **Oh My Zsh** the PowerShell 7 profile gets `mise activate pwsh` in its
  place. Windows PowerShell 5.1 reaches node and pnpm through the mise shims on
  PATH.
- **Maccy** Windows has its own clipboard history under Win+V.
- **terminal-notifier and gh-review-notify** both depend on macOS
  notifications.
- **twg** its installer is a bash script for macOS.

- **Repos** land in `C:\Programming\WorkbenchSoft`. `DEV_DIR` picks another
  folder.
- **Line endings** git gets `core.autocrlf input` on top of the Mac config.
  Checkouts keep LF, so bash scripts run on the Windows runner.

## Homebrew (Mac)

[brew.sh](https://brew.sh) is the source. A Mac without Homebrew gets it from
the script first.

| Formula | Why |
| --- | --- |
| [git](https://formulae.brew.sh/formula/git) | newer than the one Apple ships |
| [gh](https://formulae.brew.sh/formula/gh) | GitHub CLI |
| [mise](https://formulae.brew.sh/formula/mise) | node, pnpm, yarn and Python 3.15 versions per project. On Windows a `python3` forwarder in `.local/bin` of the home folder runs the same Python |
| [fzf](https://formulae.brew.sh/formula/fzf) | the branch picker behind `git sb` |
| [jq](https://formulae.brew.sh/formula/jq) | git-aliases and gh-review-notify read JSON with it |
| [shellcheck](https://formulae.brew.sh/formula/shellcheck) | `lint.sh` in git-aliases calls it |
| [shfmt](https://formulae.brew.sh/formula/shfmt) | the same `lint.sh` formats with it |
| [terminal-notifier](https://formulae.brew.sh/formula/terminal-notifier) | gh-review-notify shows macOS notifications with it |
| [mkcert](https://formulae.brew.sh/formula/mkcert) | HTTPS certificates for local servers |
| [agent-browser](https://agent-browser.dev/) | a browser that coding agents drive |

| Cask | Why |
| --- | --- |
| [visual-studio-code](https://formulae.brew.sh/cask/visual-studio-code) | editor |
| [docker-desktop](https://formulae.brew.sh/cask/docker-desktop) | containers |
| [maccy](https://formulae.brew.sh/cask/maccy) | clipboard history |
| [claude](https://formulae.brew.sh/cask/claude) | the Claude desktop app |
| [android-platform-tools](https://formulae.brew.sh/cask/android-platform-tools) | adb, for testing on a phone |

## Node toolchain

[mise](https://mise.jdx.dev) sets the global versions:

```sh
mise use -g node@22 pnpm@latest yarn@1
```

One npm global goes on top: the Copilot CLI,
[`@github/copilot`](https://www.npmjs.com/package/@github/copilot).

## Git

The script sets this global config:

```sh
git config --global color.ui true
git config --global push.autosetupremote true
```

- **Name and email** the first run asks for `user.name` and `user.email`. The
  script itself holds no personal data.
- **Aliases** come from
  [workbench-soft/git-aliases](https://github.com/workbench-soft/git-aliases).
  Its own `install.sh` adds the `include.path` and offers to source
  `git-sb.zsh`.
- **Why a separate wrapper** `git sb` can switch to a branch in another
  worktree. Only a shell function can `cd` the parent shell there.

## Shell

- **Oh My Zsh** from [ohmyz.sh](https://ohmyz.sh), with the default
  `robbyrussell` theme and the `git` plugin.
- **`~/.local/bin` on PATH** for the CLIs I write myself.
- **`mise activate zsh`** in `.zshrc`.

## My repos

They are private in `workbench-soft`, so the script logs into `gh` first. Then
`gh repo clone` puts each one in `~/Documents/Dev`, and the repo's own
`install.sh` installs it:

| Repo | What it gives |
| --- | --- |
| [git-aliases](https://github.com/workbench-soft/git-aliases) | short git commands: `git sb`, `git db`, `git m` and more |
| [agent-skills](https://github.com/workbench-soft/agent-skills) | Copilot skills: writing-style, review, create-pr, implement-ticket, address-comments |
| [gh-review-notify](https://github.com/workbench-soft/gh-review-notify) | a macOS notification for each new PR review comment, from a LaunchAgent |

## GitHub CLI

```sh
gh auth login
gh extension install github/gh-stack
```

[gh-stack](https://github.com/github/gh-stack) handles stacked PRs.

## Teamwork Graph CLI

`twg` reads and writes Jira and Confluence, for you in the terminal and for
agents. The source is
[teamwork-graph.atlassian.com](https://teamwork-graph.atlassian.com).

```sh
bash <(curl -fsSL https://teamwork-graph.atlassian.com/cli/install)
```

- **Install** the installer puts `twg` in `~/.local/bin`. It asks you to accept
  Atlassian's terms and to log in.
- **Updates** it adds the `com.atlassian.twg.upkeep` LaunchAgent. That agent
  runs `twg upkeep` every 12 minutes to keep the CLI current.
- **Skip npm** the package there is too old to run.

## VS Code extensions

- [anthropic.claude-code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
- [dbaeumer.vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [esbenp.prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [formulahendry.auto-rename-tag](https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-rename-tag)
- [huizhou.githd](https://marketplace.visualstudio.com/items?itemName=huizhou.githd)
- [nrwl.angular-console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)
- [oleg-chibikov.open-in-remote-repo](https://marketplace.visualstudio.com/items?itemName=oleg-chibikov.open-in-remote-repo)
- [orta.vscode-jest](https://marketplace.visualstudio.com/items?itemName=orta.vscode-jest)

## MCP servers

[mcp-config.json](./mcp-config.json) wires the Atlassian and GitHub MCP
servers. The script copies it to `~/.copilot/mcp-config.json` when that file
is missing.

## Claude Code memory

[claude/MEMORY.md](./claude/MEMORY.md) holds notes that Claude Code reads in
every project:

- **pnpm version** mise pins it per repo, from `packageManager`.
- **`GH_PAGER=cat`** stops `gh` from opening a pager that hangs the agent.
- **Review asks** load the `review` skill from agent-skills first.

The script copies the file to `~/.claude/MEMORY.md` when that file is missing.
It also imports it at the top of `~/.claude/CLAUDE.md`. The agent-skills
installer adds the writing-style import to the same file.

## Left to do by hand

- **Secrets** live in 1Password, and no dotfile holds them.
