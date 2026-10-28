# local-ci

Sets up a dev machine, Mac or Windows, with the same tools. Then it can
register the machine as a self-hosted GitHub Actions runner, so CI of the
`workbench-soft` repos builds on it for free. IT-managed software stays out.

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

Both scripts are idempotent: run one again and it skips what is already there.
A fresh Windows needs Git first: `winget install Git.Git`.

The repo is private in the `workbench-soft` org. On a new machine, `git clone`
asks for your GitHub user name and a token as the password. The old
`mac-setup` address redirects here.

## CI runner

Each installer asks at the end whether to register the machine as a runner.
The runner scripts also run on their own:

| Machine | Script | Labels | Starts |
| --- | --- | --- | --- |
| Mac | `runner/install.sh` | `self-hosted, macOS, ARM64, android, local` | launchd service while logged in |
| Windows | `runner/install.ps1` | `self-hosted, Windows, X64, local` | scheduled task at boot, before anyone logs in |

- **Token** the script asks `gh api` for a registration token. Without the
  `admin:org` scope it prints the runner settings URL, and you paste the token.
- **Checksum** the download is checked against the SHA256 in the runner
  release notes.
- **After a reboot** the Windows runner starts at boot as you, before anyone
  logs in. The script asks Windows for admin rights once to set that up.
- **Git Bash** the task starts `start.cmd`, which puts Git Bash first on PATH.
  Otherwise `shell: bash` takes the WSL one from WindowsApps.
- **GitHub access** jobs on Windows see mise and `~/.gitconfig`, but not the
  `gh` login in the Windows credential store. Use the job's `GITHUB_TOKEN`.
- **Folder** `~/actions-runner/workbench-soft`. Set `RUNNER_ORG` for another org.
- **In a workflow** `runs-on: [self-hosted, local]` runs on whichever machine
  is on. A job that needs macOS asks for `[self-hosted, macOS]`.

## CI status page

A page at `http://localhost:4280` shows whether the runner is up and what it
builds. It starts with Windows. Set it up once, from the main checkout:

```powershell
.\dashboard\install.ps1
```

- **What it shows** this PC's runner task and job, the org runners, and the latest runs of each org repo.
- **Token** the script copies `gh auth token` into `dashboard\.env.local`, since the boot task can't read the gh login.
- **Rerun** after a `git pull` or a new gh login. It rebuilds and restarts the page.
- **Develop** `mise x -- pnpm dev` in `dashboard` serves it on port 4281.
- **Logs** `dashboard\dashboard.log`.

## Windows

[winget](https://learn.microsoft.com/windows/package-manager/winget/) installs
what Homebrew gives the Mac: git, gh, mise, fzf, jq, shellcheck, shfmt,
mkcert, VS Code, Docker Desktop, Claude and the Android platform tools.
`agent-browser` comes from npm.

Mac only, so `install.ps1` skips them:

- **Oh My Zsh** the PowerShell 7 profile gets `mise activate pwsh` instead. Windows PowerShell 5.1 finds node and pnpm through the mise shims on PATH.
- **Maccy** Windows keeps clipboard history under Win+V.
- **terminal-notifier and gh-review-notify** both need macOS notifications.
- **twg** its installer is a bash script for macOS.

Repos go to `C:\Programming\WorkbenchSoft`. Set `DEV_DIR` for another folder.
Git gets `core.autocrlf input` on top of the Mac config, so checkouts keep LF
and bash scripts run on the Windows runner.

## Homebrew (Mac)

Source: [brew.sh](https://brew.sh). The script installs Homebrew itself when
missing.

| Formula | Why |
| --- | --- |
| [git](https://formulae.brew.sh/formula/git) | newer than the Apple one |
| [gh](https://formulae.brew.sh/formula/gh) | GitHub CLI |
| [mise](https://formulae.brew.sh/formula/mise) | node, pnpm and yarn versions per project |
| [fzf](https://formulae.brew.sh/formula/fzf) | the branch picker in `git sb` |
| [jq](https://formulae.brew.sh/formula/jq) | git-aliases and gh-review-notify parse JSON with it |
| [shellcheck](https://formulae.brew.sh/formula/shellcheck) | `lint.sh` in git-aliases runs it |
| [shfmt](https://formulae.brew.sh/formula/shfmt) | same `lint.sh` formats with it |
| [terminal-notifier](https://formulae.brew.sh/formula/terminal-notifier) | gh-review-notify pops macOS notifications through it |
| [mkcert](https://formulae.brew.sh/formula/mkcert) | local HTTPS certificates |
| [agent-browser](https://agent-browser.dev/) | browser automation for coding agents |

| Cask | Why |
| --- | --- |
| [visual-studio-code](https://formulae.brew.sh/cask/visual-studio-code) | editor |
| [docker-desktop](https://formulae.brew.sh/cask/docker-desktop) | containers |
| [maccy](https://formulae.brew.sh/cask/maccy) | clipboard history |
| [claude](https://formulae.brew.sh/cask/claude) | Claude desktop app |
| [android-platform-tools](https://formulae.brew.sh/cask/android-platform-tools) | adb for mobile testing |

## Node toolchain

[mise](https://mise.jdx.dev) pins the versions globally:

```sh
mise use -g node@22 pnpm@latest yarn@1
```

On top, one npm global:
[`@github/copilot`](https://www.npmjs.com/package/@github/copilot), the Copilot
CLI.

## Git

Global config the script sets:

```sh
git config --global color.ui true
git config --global push.autosetupremote true
```

`user.name` and `user.email` are prompted on first run, so the script carries
no personal data.

Aliases come from
[workbench-soft/git-aliases](https://github.com/workbench-soft/git-aliases). Its
own `install.sh` wires the `include.path` and offers to source `git-sb.zsh`.
That wrapper is separate from the aliases on purpose: `git sb` can land on a
branch in another worktree, and only a shell function can `cd` the parent
shell there.

## Shell

- **Oh My Zsh** from [ohmyz.sh](https://ohmyz.sh), default `robbyrussell`
  theme, `git` plugin.
- **`~/.local/bin` on PATH** for the self-written CLIs.
- **`mise activate zsh`** in `.zshrc`.

## My repos

Private in `workbench-soft`, so the script logs into `gh` first. Then
`gh repo clone` puts each one in `~/Documents/Dev`, and its own `install.sh`
installs it:

| Repo | What it gives |
| --- | --- |
| [git-aliases](https://github.com/workbench-soft/git-aliases) | short git commands: `git sb`, `git db`, `git m` and the rest |
| [agent-skills](https://github.com/workbench-soft/agent-skills) | Copilot skills: writing-style, review, create-pr, implement-ticket, address-comments |
| [gh-review-notify](https://github.com/workbench-soft/gh-review-notify) | macOS notification for every new PR review comment, runs as a LaunchAgent |

## GitHub CLI

```sh
gh auth login
gh extension install github/gh-stack
```

[gh-stack](https://github.com/github/gh-stack) manages stacked PRs.

## Teamwork Graph CLI

`twg` reads and writes Jira and Confluence from the terminal and from agents.
Source: [teamwork-graph.atlassian.com](https://teamwork-graph.atlassian.com).

```sh
bash <(curl -fsSL https://teamwork-graph.atlassian.com/cli/install)
```

The installer puts `twg` in `~/.local/bin`, asks you to accept Atlassian's
terms and log in. It also adds the `com.atlassian.twg.upkeep` LaunchAgent,
which runs `twg upkeep` every 12 minutes to keep the CLI updated. Skip npm: the
package there is too old to run.

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

The script copies [mcp-config.json](./mcp-config.json) to
`~/.copilot/mcp-config.json` when the file is missing. It wires the Atlassian
and GitHub MCP servers.

## Claude Code memory

[claude/MEMORY.md](./claude/MEMORY.md) holds notes Claude Code reads in every
project:

- **pnpm version** comes from `packageManager`, pinned per repo through mise.
- **`GH_PAGER=cat`** keeps `gh` from opening a pager and hanging the agent.
- **Review asks** load the `review` skill from agent-skills first.

The script copies the file to `~/.claude/MEMORY.md` when missing and imports
it at the top of `~/.claude/CLAUDE.md`. The writing-style import in the same
file comes from the agent-skills installer.

## Not scripted

- **Secrets** go into 1Password, no dotfile keeps them.
