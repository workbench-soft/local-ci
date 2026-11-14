#!/usr/bin/env bash
# Sets up a Mac with everything README.md lists. Running it again is safe,
# since each step looks for its piece first. install.ps1 is the Windows version.
set -euo pipefail

# WBS_ROOT names the workspace root, as in install.ps1. restore.sh of workspace sets it.
dev_dir="${WBS_ROOT:-${DEV_DIR:-$HOME/Documents/Dev}}"
script_dir=$(cd "$(dirname "$0")" && pwd)

step() { printf '\n==> %s\n' "$*"; }

# Appends a line to a file unless the file already holds it.
append_once() {
	grep -qxF "$2" "$1" || printf '%s\n' "$2" >>"$1"
}

# Asks for a global git setting that is still empty.
ask_git_setting() {
	if [ -z "$(git config --global "$1" || true)" ]; then
		read -rp "git $1: " value
		git config --global "$1" "$value"
	fi
}

# Optional steps that failed. The run goes on, and the list prints at the end.
# Plain strings, since bash 3.2 of macOS calls an empty array unbound under set -u.
skipped=""

# A formula or an app already there, such as one installed by hand or by IT,
# stays as it is. brew refuses a cask whose app sits in /Applications already.
brew_install() { # [--cask] name...
	local kind=""
	if [ "$1" = --cask ]; then
		kind=--cask
		shift
	fi
	for name in "$@"; do
		if brew list ${kind:+"$kind"} "$name" >/dev/null 2>&1; then continue; fi
		brew install ${kind:+"$kind"} "$name" || skipped="$skipped $name"
	done
}

copy_if_missing() {
	if [ ! -f "$2" ]; then
		step "$3"
		mkdir -p "$(dirname "$2")"
		cp "$1" "$2"
	fi
}

# --- Homebrew ---------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
	step "Installing Homebrew"
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
# Apple silicon keeps brew in /opt/homebrew, an Intel Mac in /usr/local.
for brew in /opt/homebrew/bin/brew /usr/local/bin/brew; do
	if [ -x "$brew" ]; then eval "$("$brew" shellenv)" && break; fi
done

step "Installing brew formulae"
brew_install git gh mise fzf jq shellcheck shfmt terminal-notifier mkcert agent-browser

step "Installing brew casks"
brew_install --cask visual-studio-code docker-desktop maccy claude android-platform-tools

# --- Oh My Zsh ---------------------------------------------------------------
if [ ! -d "$HOME/.oh-my-zsh" ]; then
	step "Installing Oh My Zsh"
	RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

# --- .zshrc lines ------------------------------------------------------------
zshrc="$HOME/.zshrc"
touch "$zshrc"
step "Updating .zshrc"
# shellcheck disable=SC2016  # .zshrc gets these lines as written, unexpanded
append_once "$zshrc" 'export PATH="$HOME/.local/bin:$PATH"'
# shellcheck disable=SC2016
append_once "$zshrc" 'eval "$(mise activate zsh)"'

# --- Node toolchain ----------------------------------------------------------
step "Installing node, pnpm, yarn and python through mise"
mise use -g node@22 pnpm@latest yarn@1 python@3.15
# The repo installers below run node, which this shell reaches through the shims.
eval "$(mise activate bash --shims)"

# Each worktree starts with an empty target folder. sccache lets it reuse the
# crates another worktree already compiled.
step "Installing sccache through mise"
mise use -g github:mozilla/sccache@0.19
mise set -g RUSTC_WRAPPER=sccache SCCACHE_CACHE_SIZE=20G

step "Installing the Copilot CLI"
mise exec -- npm install -g @github/copilot || skipped="$skipped copilot"

# --- Git config --------------------------------------------------------------
step "Setting git config"
git config --global color.ui true
git config --global push.autosetupremote true
ask_git_setting user.name
ask_git_setting user.email

# --- GitHub CLI --------------------------------------------------------------
# gh clones the repos below, so the login goes first.
if ! gh auth status >/dev/null 2>&1; then
	step "Logging into GitHub"
	gh auth login
fi

# --- My repos ----------------------------------------------------------------
mkdir -p "$dev_dir"
for repo in git-aliases agent-skills gh-review-notify; do
	repo_dir="$dev_dir/$repo"
	if [ ! -d "$repo_dir" ]; then
		step "Cloning $repo"
		gh repo clone "workbench-soft/$repo" "$repo_dir"
	fi
	step "Running $repo/install.sh"
	"$repo_dir/install.sh"
done
# The org's private skills, only for an account that can read them.
if gh repo view workbench-soft/agent-skills-private --json name >/dev/null 2>&1; then
	repo_dir="$dev_dir/agent-skills-private"
	if [ ! -d "$repo_dir" ]; then
		step "Cloning agent-skills-private"
		gh repo clone workbench-soft/agent-skills-private "$repo_dir"
	fi
	step "Running agent-skills-private/install.sh"
	"$repo_dir/install.sh"
fi

# --- gh extensions -----------------------------------------------------------
if ! gh extension list 2>/dev/null | grep -q gh-stack; then
	step "Installing gh-stack"
	gh extension install github/gh-stack
fi

# --- Teamwork Graph CLI ------------------------------------------------------
# The installer asks you to accept Atlassian's terms and log in. It then adds
# the upkeep LaunchAgent that keeps twg up to date.
if [ ! -x "$HOME/.local/bin/twg" ]; then
	step "Installing twg"
	bash <(curl -fsSL https://teamwork-graph.atlassian.com/cli/install) || skipped="$skipped twg"
fi

# --- VS Code extensions ------------------------------------------------------
step "Installing VS Code extensions"
for extension in \
	anthropic.claude-code \
	dbaeumer.vscode-eslint \
	esbenp.prettier-vscode \
	formulahendry.auto-rename-tag \
	huizhou.githd \
	nrwl.angular-console \
	orta.vscode-jest; do
	# VS Code installed by hand puts no code command on PATH.
	command -v code >/dev/null || break
	code --install-extension "$extension" >/dev/null || skipped="$skipped $extension"
done

# --- Claude Code memory ------------------------------------------------------
claude_dir="$HOME/.claude"
mkdir -p "$claude_dir"
copy_if_missing "$script_dir/claude/MEMORY.md" "$claude_dir/MEMORY.md" "Copying Claude memory"
claude_md="$claude_dir/CLAUDE.md"
touch "$claude_md"
if ! grep -qxF '@~/.claude/MEMORY.md' "$claude_md"; then
	printf '@~/.claude/MEMORY.md\n\n%s\n' "$(cat "$claude_md")" >"$claude_md"
fi

# --- MCP servers -------------------------------------------------------------
copy_if_missing "$script_dir/mcp-config.json" "$HOME/.copilot/mcp-config.json" "Copying MCP config"

# --- CI runner ---------------------------------------------------------------
read -rp "Register this Mac as a GitHub Actions runner for workbench-soft? [y/N] " runner_answer
if [[ $runner_answer =~ ^(y|yes)$ ]]; then
	"$script_dir/runner/install.sh"
fi

if [ -n "$skipped" ]; then
	step "Skipped, already there or failed:$skipped"
fi
step "Done. Open a new terminal to pick up the PATH and mise."
